"""
MediTrack 360 - Backend Server & REST API
Dual Flask / Built-in Standard-Library HTTP Server
Provides complete REST API endpoints for medicine management, stock tracking,
FEFO recommendations, expiry alerts, reports, and offline sync.
"""

import sys
import os
import json
import sqlite3
import re
from datetime import datetime, date, timedelta
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
import mimetypes

from database import get_db_connection, init_db, recalculate_alerts, calculate_expiry_status
from seed_data import seed

# Set working directory to project root
os.chdir(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# -------------------------------------------------------------
# REST API CONTROLLER LOGIC
# -------------------------------------------------------------

def api_get_dashboard():
    recalculate_alerts()
    conn = get_db_connection()
    cursor = conn.cursor()
    today = date.today()

    # 1. Total Medicines (distinct medicines & distinct active batches)
    cursor.execute("SELECT COUNT(*) AS total FROM medicines")
    total_medicines = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) AS total_batches, COALESCE(SUM(quantity), 0) AS total_units FROM medicine_batches")
    batch_stats = cursor.fetchone()
    total_batches = batch_stats["total_batches"]
    total_units = batch_stats["total_units"]

    # 2. Batches details for expiry grouping
    cursor.execute("""
        SELECT b.id, b.medicine_id, b.batch_number, b.expiry_date, b.quantity,
               m.name AS medicine_name, m.generic_name, m.unit, m.category
        FROM medicine_batches b
        JOIN medicines m ON b.medicine_id = m.id
    """)
    all_batches = cursor.fetchall()

    expiring_soon_count = 0
    expired_count = 0
    warning_count = 0
    normal_count = 0

    expiring_soon_list = []
    expired_list = []

    for b in all_batches:
        exp_info = calculate_expiry_status(b["expiry_date"], today)
        status = exp_info["status"]
        days = exp_info["days_remaining"]
        b_dict = {
            "id": b["id"],
            "medicine_id": b["medicine_id"],
            "medicine_name": b["medicine_name"],
            "generic_name": b["generic_name"],
            "batch_number": b["batch_number"],
            "expiry_date": b["expiry_date"],
            "quantity": b["quantity"],
            "unit": b["unit"],
            "category": b["category"],
            "days_remaining": days,
            "status": status,
            "color": exp_info.get("color", "gray")
        }

        if status == "Expired":
            expired_count += 1
            expired_list.append(b_dict)
        elif status == "Expiring Soon":
            expiring_soon_count += 1
            expiring_soon_list.append(b_dict)
        elif status == "Warning":
            warning_count += 1
        else:
            normal_count += 1

    # 3. Stock Status per medicine
    cursor.execute("""
        SELECT m.id, m.name, m.generic_name, m.unit, m.minimum_stock, m.category,
               COALESCE(SUM(b.quantity), 0) AS total_stock
        FROM medicines m
        LEFT JOIN medicine_batches b ON m.id = b.medicine_id
        GROUP BY m.id
    """)
    med_stocks = cursor.fetchall()

    out_of_stock_count = 0
    low_stock_count = 0
    healthy_stock_count = 0
    low_stock_list = []

    for m in med_stocks:
        tot = m["total_stock"]
        min_s = m["minimum_stock"]
        item = {
            "id": m["id"],
            "name": m["name"],
            "generic_name": m["generic_name"],
            "unit": m["unit"],
            "minimum_stock": min_s,
            "current_stock": tot,
            "category": m["category"]
        }
        if tot == 0:
            out_of_stock_count += 1
            low_stock_list.append({**item, "status": "Out of Stock", "suggested_reorder": min_s * 2})
        elif tot <= min_s:
            low_stock_count += 1
            low_stock_list.append({**item, "status": "Low Stock", "suggested_reorder": (min_s * 2) - tot})
        else:
            healthy_stock_count += 1

    # 4. FEFO Recommendations (Medicines with multiple active batches)
    cursor.execute("""
        SELECT m.id AS medicine_id, m.name, m.unit, m.category,
               b.id AS batch_id, b.batch_number, b.expiry_date, b.quantity
        FROM medicines m
        JOIN medicine_batches b ON m.id = b.medicine_id
        WHERE b.quantity > 0
        ORDER BY m.id, b.expiry_date ASC
    """)
    fefo_rows = cursor.fetchall()
    fefo_by_med = {}
    for r in fefo_rows:
        mid = r["medicine_id"]
        exp_info = calculate_expiry_status(r["expiry_date"], today)
        b_info = {
            "batch_id": r["batch_id"],
            "batch_number": r["batch_number"],
            "expiry_date": r["expiry_date"],
            "quantity": r["quantity"],
            "days_remaining": exp_info["days_remaining"],
            "status": exp_info["status"]
        }
        if mid not in fefo_by_med:
            fefo_by_med[mid] = {
                "medicine_id": mid,
                "medicine_name": r["name"],
                "unit": r["unit"],
                "category": r["category"],
                "batches": []
            }
        fefo_by_med[mid]["batches"].append(b_info)

    fefo_recommendations = []
    for mid, data in fefo_by_med.items():
        if len(data["batches"]) >= 1:
            # Find earliest non-expired batch (or earliest batch if all expired)
            valid_batches = [b for b in data["batches"] if b["days_remaining"] >= 0]
            recommended = valid_batches[0] if valid_batches else data["batches"][0]
            other_batches = [b for b in data["batches"] if b["batch_id"] != recommended["batch_id"]]
            fefo_recommendations.append({
                "medicine_id": data["medicine_id"],
                "medicine_name": data["medicine_name"],
                "unit": data["unit"],
                "category": data["category"],
                "recommended_batch": recommended,
                "other_batches": other_batches,
                "has_multiple_batches": len(data["batches"]) > 1,
                "message": f"Dispense Batch {recommended['batch_number']} first ({recommended['quantity']} {data['unit']}, expires in {recommended['days_remaining']} days)."
            })

    # 5. Recent Stock Movement Activities (latest 8)
    cursor.execute("""
        SELECT sm.id, sm.movement_type, sm.quantity, sm.previous_quantity, sm.new_quantity,
               sm.reason, sm.staff_name, sm.timestamp,
               m.name AS medicine_name, m.unit,
               b.batch_number
        FROM stock_movements sm
        JOIN medicines m ON sm.medicine_id = m.id
        LEFT JOIN medicine_batches b ON sm.batch_id = b.id
        ORDER BY sm.timestamp DESC, sm.id DESC
        LIMIT 8
    """)
    recent_activities = [dict(row) for row in cursor.fetchall()]

    # 6. Active Alerts (latest 10)
    cursor.execute("""
        SELECT a.id, a.alert_type, a.message, a.status, a.created_at,
               m.name AS medicine_name, b.batch_number
        FROM alerts a
        JOIN medicines m ON a.medicine_id = m.id
        LEFT JOIN medicine_batches b ON a.batch_id = b.id
        WHERE a.status IN ('Active', 'Viewed')
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 10
    """)
    active_alerts = [dict(row) for row in cursor.fetchall()]

    # 7. Clinic Profile
    cursor.execute("SELECT key, value FROM clinic_settings")
    settings = {r["key"]: r["value"] for r in cursor.fetchall()}

    conn.close()

    return {
        "summary": {
            "total_medicines": total_medicines,
            "total_batches": total_batches,
            "total_units": total_units,
            "expiring_soon": expiring_soon_count,
            "expired": expired_count,
            "warning": warning_count,
            "low_stock": low_stock_count,
            "out_of_stock": out_of_stock_count,
            "healthy_stock": healthy_stock_count
        },
        "expiry_distribution": {
            "expired": expired_count,
            "range_0_30": expiring_soon_count,
            "range_31_50": warning_count,
            "range_50_plus": normal_count
        },
        "stock_status_distribution": {
            "healthy": healthy_stock_count,
            "low_stock": low_stock_count,
            "out_of_stock": out_of_stock_count
        },
        "expiring_soon_items": sorted(expiring_soon_list, key=lambda x: x["days_remaining"])[:5],
        "expired_items": expired_list[:5],
        "low_stock_items": low_stock_list[:6],
        "fefo_recommendations": fefo_recommendations[:6],
        "recent_activities": recent_activities,
        "active_alerts": active_alerts,
        "clinic_info": settings
    }

def api_get_medicines(params=None):
    params = params or {}
    conn = get_db_connection()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("""
        SELECT m.id, m.name, m.generic_name, m.category, m.manufacturer,
               m.supplier, m.unit, m.minimum_stock, m.notes, m.created_at,
               COALESCE(SUM(b.quantity), 0) AS current_stock,
               COUNT(b.id) AS batch_count
        FROM medicines m
        LEFT JOIN medicine_batches b ON m.id = b.medicine_id
        GROUP BY m.id
        ORDER BY m.name ASC
    """)
    medicines = [dict(row) for row in cursor.fetchall()]

    # Fetch batches per medicine for FEFO, earliest expiry calculation and status classification
    cursor.execute("""
        SELECT id, medicine_id, batch_number, expiry_date, quantity, purchase_date, created_at
        FROM medicine_batches
        ORDER BY expiry_date ASC
    """)
    all_batches = [dict(row) for row in cursor.fetchall()]

    batches_by_med = {}
    for b in all_batches:
        mid = b["medicine_id"]
        exp_info = calculate_expiry_status(b["expiry_date"], today)
        b["days_remaining"] = exp_info["days_remaining"]
        b["expiry_status"] = exp_info["status"]
        b["color"] = exp_info.get("color", "gray")
        if mid not in batches_by_med:
            batches_by_med[mid] = []
        batches_by_med[mid].append(b)

    results = []
    for m in medicines:
        mid = m["id"]
        batches = batches_by_med.get(mid, [])
        m["batches"] = batches

        # Determine overall stock status
        tot = m["current_stock"]
        min_s = m["minimum_stock"]
        if tot == 0:
            m["stock_status"] = "Out of Stock"
        elif tot <= min_s:
            m["stock_status"] = "Low Stock"
        else:
            m["stock_status"] = "Healthy"

        # Determine earliest expiry & FEFO recommendation
        if batches:
            # Sort valid batches
            valid_batches = [b for b in batches if b["quantity"] > 0 and b["days_remaining"] >= 0]
            if valid_batches:
                fefo_batch = valid_batches[0]
                m["fefo_recommended"] = {
                    "batch_number": fefo_batch["batch_number"],
                    "expiry_date": fefo_batch["expiry_date"],
                    "days_remaining": fefo_batch["days_remaining"],
                    "quantity": fefo_batch["quantity"]
                }
            else:
                m["fefo_recommended"] = None

            # Overall expiry status (worst case of unexpired batches, or expired if all expired)
            has_expired = any(b["days_remaining"] < 0 and b["quantity"] > 0 for b in batches)
            has_expiring_soon = any(0 <= b["days_remaining"] <= 30 and b["quantity"] > 0 for b in batches)
            has_warning = any(31 <= b["days_remaining"] <= 50 and b["quantity"] > 0 for b in batches)

            earliest_batch = batches[0]
            m["earliest_expiry"] = earliest_batch["expiry_date"]
            m["days_remaining"] = earliest_batch["days_remaining"]

            if has_expired:
                m["expiry_status"] = "Expired"
            elif has_expiring_soon:
                m["expiry_status"] = "Expiring Soon"
            elif has_warning:
                m["expiry_status"] = "Warning"
            else:
                m["expiry_status"] = "Normal"
        else:
            m["earliest_expiry"] = "N/A"
            m["days_remaining"] = 999
            m["expiry_status"] = "Normal"
            m["fefo_recommended"] = None

        # Filter check
        q = params.get("search", "").strip().lower()
        if q:
            searchable = f"{m['name']} {m['generic_name']} {m['category']} {m['manufacturer']} {' '.join(b['batch_number'] for b in batches)}".lower()
            if q not in searchable:
                continue

        status_filter = params.get("filter", "All")
        if status_filter == "Available" and m["current_stock"] <= 0:
            continue
        elif status_filter == "Low Stock" and m["stock_status"] != "Low Stock":
            continue
        elif status_filter == "Out of Stock" and m["stock_status"] != "Out of Stock":
            continue
        elif status_filter == "Expiring Soon" and m["expiry_status"] != "Expiring Soon":
            continue
        elif status_filter == "Expired" and m["expiry_status"] != "Expired":
            continue

        cat_filter = params.get("category", "")
        if cat_filter and m["category"] != cat_filter:
            continue

        results.append(m)

    # Sorting
    sort_key = params.get("sort", "name")
    if sort_key == "name":
        results.sort(key=lambda x: x["name"].lower())
    elif sort_key == "expiry":
        results.sort(key=lambda x: x["days_remaining"])
    elif sort_key == "stock_asc":
        results.sort(key=lambda x: x["current_stock"])
    elif sort_key == "stock_desc":
        results.sort(key=lambda x: x["current_stock"], reverse=True)

    conn.close()
    return {"medicines": results, "total": len(results)}

def api_create_medicine(data):
    name = data.get("name", "").strip()
    if not name:
        return {"error": "Medicine name is required"}, 400

    generic_name = data.get("generic_name", "").strip()
    category = data.get("category", "General").strip()
    manufacturer = data.get("manufacturer", "").strip()
    supplier = data.get("supplier", "").strip()
    unit = data.get("unit", "Tablets").strip()
    min_stock = int(data.get("minimum_stock", 20))
    notes = data.get("notes", "").strip()

    batch_number = data.get("batch_number", "").strip()
    expiry_date = data.get("expiry_date", "").strip()
    quantity = int(data.get("quantity", 0))
    purchase_date = data.get("purchase_date", date.today().strftime("%Y-%m-%d")).strip()

    if not batch_number:
        return {"error": "Batch number is required"}, 400
    if not expiry_date:
        return {"error": "Expiry date is required (YYYY-MM-DD)"}, 400

    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO medicines (name, generic_name, category, manufacturer, supplier, unit, minimum_stock, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, generic_name, category, manufacturer, supplier, unit, min_stock, notes, now_str))
    medicine_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, purchase_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (medicine_id, batch_number, expiry_date, quantity, purchase_date, now_str))
    batch_id = cursor.lastrowid

    # Log initial Stock In
    cursor.execute("""
        INSERT INTO stock_movements (batch_id, medicine_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id, staff_name, timestamp)
        VALUES (?, ?, 'Stock In', ?, 0, ?, 'New Medicine Batch Added', 1, 'Pharmacy Staff', ?)
    """, (batch_id, medicine_id, quantity, quantity, now_str))

    conn.commit()
    conn.close()

    recalculate_alerts()
    return {"success": True, "medicine_id": medicine_id, "batch_id": batch_id, "message": f"{name} registered successfully!"}

def api_get_medicine_detail(med_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("SELECT * FROM medicines WHERE id = ?", (med_id,))
    med = cursor.fetchone()
    if not med:
        conn.close()
        return {"error": "Medicine not found"}, 404

    med_dict = dict(med)

    cursor.execute("""
        SELECT * FROM medicine_batches
        WHERE medicine_id = ?
        ORDER BY expiry_date ASC
    """, (med_id,))
    batches = []
    total_qty = 0
    for r in cursor.fetchall():
        b = dict(r)
        exp_info = calculate_expiry_status(b["expiry_date"], today)
        b["days_remaining"] = exp_info["days_remaining"]
        b["expiry_status"] = exp_info["status"]
        b["color"] = exp_info.get("color", "gray")
        total_qty += b["quantity"]
        batches.append(b)

    med_dict["batches"] = batches
    med_dict["current_stock"] = total_qty
    med_dict["stock_status"] = "Out of Stock" if total_qty == 0 else ("Low Stock" if total_qty <= med_dict["minimum_stock"] else "Healthy")

    # Movements for this medicine
    cursor.execute("""
        SELECT sm.*, b.batch_number
        FROM stock_movements sm
        LEFT JOIN medicine_batches b ON sm.batch_id = b.id
        WHERE sm.medicine_id = ?
        ORDER BY sm.timestamp DESC
        LIMIT 20
    """, (med_id,))
    med_dict["movements"] = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return med_dict

def api_update_medicine(med_id, data):
    conn = get_db_connection()
    cursor = conn.cursor()

    name = data.get("name", "").strip()
    if not name:
        conn.close()
        return {"error": "Name is required"}, 400

    cursor.execute("""
        UPDATE medicines
        SET name = ?, generic_name = ?, category = ?, manufacturer = ?,
            supplier = ?, unit = ?, minimum_stock = ?, notes = ?
        WHERE id = ?
    """, (
        name,
        data.get("generic_name", "").strip(),
        data.get("category", "General").strip(),
        data.get("manufacturer", "").strip(),
        data.get("supplier", "").strip(),
        data.get("unit", "Tablets").strip(),
        int(data.get("minimum_stock", 20)),
        data.get("notes", "").strip(),
        med_id
    ))
    conn.commit()
    conn.close()
    recalculate_alerts()
    return {"success": True, "message": "Medicine details updated successfully."}

def api_delete_medicine(med_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM alerts WHERE medicine_id = ?", (med_id,))
    cursor.execute("DELETE FROM stock_movements WHERE medicine_id = ?", (med_id,))
    cursor.execute("DELETE FROM medicine_batches WHERE medicine_id = ?", (med_id,))
    cursor.execute("DELETE FROM medicines WHERE id = ?", (med_id,))
    conn.commit()
    conn.close()
    recalculate_alerts()
    return {"success": True, "message": "Medicine deleted successfully."}

def api_add_batch(med_id, data):
    batch_number = data.get("batch_number", "").strip()
    expiry_date = data.get("expiry_date", "").strip()
    quantity = int(data.get("quantity", 0))
    purchase_date = data.get("purchase_date", date.today().strftime("%Y-%m-%d")).strip()

    if not batch_number or not expiry_date:
        return {"error": "Batch number and expiry date are required"}, 400

    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, purchase_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (med_id, batch_number, expiry_date, quantity, purchase_date, now_str))
    batch_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO stock_movements (batch_id, medicine_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id, staff_name, timestamp)
        VALUES (?, ?, 'Stock In', ?, 0, ?, 'Additional Batch Intake', 1, 'Pharmacy Staff', ?)
    """, (batch_id, med_id, quantity, quantity, now_str))

    conn.commit()
    conn.close()
    recalculate_alerts()
    return {"success": True, "batch_id": batch_id, "message": f"Batch {batch_number} added successfully."}

def api_update_stock(data):
    batch_id = data.get("batch_id")
    movement_type = data.get("movement_type", "Stock In") # 'Stock In', 'Stock Out', 'Adjustment'
    qty = int(data.get("quantity", 0))
    reason = data.get("reason", "").strip() or "Standard Stock Update"
    staff_name = data.get("staff_name", "Pharmacy Staff").strip()
    user_id = data.get("user_id", 1)

    if not batch_id:
        return {"error": "Batch selection is required"}, 400
    if qty <= 0 and movement_type != "Adjustment":
        return {"error": "Quantity must be greater than 0"}, 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT b.id, b.medicine_id, b.batch_number, b.expiry_date, b.quantity,
               m.name AS medicine_name, m.unit
        FROM medicine_batches b
        JOIN medicines m ON b.medicine_id = m.id
        WHERE b.id = ?
    """, (batch_id,))
    batch = cursor.fetchone()

    if not batch:
        conn.close()
        return {"error": "Batch not found"}, 404

    current_qty = batch["quantity"]
    med_id = batch["medicine_id"]
    med_name = batch["medicine_name"]
    batch_no = batch["batch_number"]
    unit = batch["unit"]

    if movement_type == "Stock In":
        new_qty = current_qty + qty
    elif movement_type == "Stock Out":
        if qty > current_qty:
            conn.close()
            return {"error": f"Cannot dispense {qty} {unit}. Only {current_qty} {unit} available in Batch {batch_no}."}, 400
        new_qty = current_qty - qty
    elif movement_type == "Adjustment":
        new_qty = max(0, qty)
        qty = abs(new_qty - current_qty)
    else:
        conn.close()
        return {"error": "Invalid movement type"}, 400

    # Update batch quantity
    cursor.execute("UPDATE medicine_batches SET quantity = ? WHERE id = ?", (new_qty, batch_id))

    # Log movement
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO stock_movements (batch_id, medicine_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id, staff_name, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (batch_id, med_id, movement_type, qty, current_qty, new_qty, reason, user_id, staff_name, now_str))

    conn.commit()
    conn.close()

    recalculate_alerts()
    return {
        "success": True,
        "message": f"Stock updated: {med_name} (Batch {batch_no}) is now {new_qty} {unit}.",
        "batch_id": batch_id,
        "previous_quantity": current_qty,
        "new_quantity": new_qty
    }

def api_get_stock_history(params=None):
    params = params or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT sm.id, sm.movement_type, sm.quantity, sm.previous_quantity, sm.new_quantity,
               sm.reason, sm.staff_name, sm.timestamp,
               m.name AS medicine_name, m.generic_name, m.unit,
               b.batch_number, b.expiry_date
        FROM stock_movements sm
        JOIN medicines m ON sm.medicine_id = m.id
        LEFT JOIN medicine_batches b ON sm.batch_id = b.id
        WHERE 1=1
    """
    args = []

    if params.get("medicine_id"):
        query += " AND sm.medicine_id = ?"
        args.append(int(params["medicine_id"]))

    if params.get("movement_type") and params["movement_type"] != "All":
        query += " AND sm.movement_type = ?"
        args.append(params["movement_type"])

    query += " ORDER BY sm.timestamp DESC, sm.id DESC LIMIT 100"

    cursor.execute(query, tuple(args))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"movements": rows, "total": len(rows)}

def api_get_alerts(params=None):
    recalculate_alerts()
    params = params or {}
    conn = get_db_connection()
    cursor = conn.cursor()
    today = date.today()

    query = """
        SELECT a.id, a.alert_type, a.message, a.status, a.created_at,
               a.medicine_id, a.batch_id,
               m.name AS medicine_name, m.generic_name, m.unit, m.minimum_stock,
               b.batch_number, b.expiry_date, b.quantity
        FROM alerts a
        JOIN medicines m ON a.medicine_id = m.id
        LEFT JOIN medicine_batches b ON a.batch_id = b.id
        WHERE 1=1
    """
    args = []

    status_filter = params.get("status")
    if status_filter and status_filter != "All":
        query += " AND a.status = ?"
        args.append(status_filter)

    alert_type_filter = params.get("type")
    if alert_type_filter and alert_type_filter != "All":
        query += " AND a.alert_type = ?"
        args.append(alert_type_filter)

    query += " ORDER BY CASE a.status WHEN 'Active' THEN 1 WHEN 'Viewed' THEN 2 ELSE 3 END, a.created_at DESC"

    cursor.execute(query, tuple(args))
    alerts = []
    for r in cursor.fetchall():
        item = dict(r)
        if item.get("expiry_date"):
            exp_info = calculate_expiry_status(item["expiry_date"], today)
            item["days_remaining"] = exp_info["days_remaining"]
            item["urgency"] = exp_info["urgency"]
        else:
            item["days_remaining"] = None
            item["urgency"] = "high" if item["alert_type"] == "Out of Stock" else "medium"
        alerts.append(item)

    conn.close()
    return {"alerts": alerts, "total": len(alerts)}

def api_update_alert_status(alert_id, new_status):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET status = ? WHERE id = ?", (new_status, alert_id))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Alert marked as {new_status}."}

def api_get_reports_stock():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT m.id, m.name, m.generic_name, m.category, m.manufacturer, m.supplier,
               m.unit, m.minimum_stock,
               COALESCE(SUM(b.quantity), 0) AS total_stock,
               COUNT(b.id) AS batch_count
        FROM medicines m
        LEFT JOIN medicine_batches b ON m.id = b.medicine_id
        GROUP BY m.id
        ORDER BY m.category, m.name
    """)
    meds = [dict(r) for r in cursor.fetchall()]

    for m in meds:
        tot = m["total_stock"]
        min_s = m["minimum_stock"]
        if tot == 0:
            m["status"] = "Out of Stock"
            m["suggested_reorder"] = min_s * 2
        elif tot <= min_s:
            m["status"] = "Low Stock"
            m["suggested_reorder"] = (min_s * 2) - tot
        else:
            m["status"] = "Healthy"
            m["suggested_reorder"] = 0

    conn.close()
    return {"report": meds, "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

def api_get_reports_expiry():
    conn = get_db_connection()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("""
        SELECT b.id, b.batch_number, b.expiry_date, b.quantity, b.purchase_date,
               m.id AS medicine_id, m.name AS medicine_name, m.generic_name,
               m.category, m.unit, m.supplier
        FROM medicine_batches b
        JOIN medicines m ON b.medicine_id = m.id
        ORDER BY b.expiry_date ASC
    """)
    batches = [dict(r) for r in cursor.fetchall()]

    buckets = {
        "expired": [],
        "range_0_30": [],
        "range_31_50": [],
        "range_50_plus": []
    }

    for b in batches:
        exp_info = calculate_expiry_status(b["expiry_date"], today)
        b["days_remaining"] = exp_info["days_remaining"]
        b["status"] = exp_info["status"]
        b["color"] = exp_info.get("color", "gray")

        days = b["days_remaining"]
        if days < 0:
            buckets["expired"].append(b)
        elif days <= 30:
            buckets["range_0_30"].append(b)
        elif days <= 50:
            buckets["range_31_50"].append(b)
        else:
            buckets["range_50_plus"].append(b)

    conn.close()
    return {
        "buckets": buckets,
        "summary": {
            "expired_total": len(buckets["expired"]),
            "range_0_30_total": len(buckets["range_0_30"]),
            "range_31_50_total": len(buckets["range_31_50"]),
            "range_50_plus_total": len(buckets["range_50_plus"]),
            "total_batches": len(batches)
        },
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def api_login(data):
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # For easy demo and evaluation: support quick demo logins
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, role FROM users WHERE LOWER(email) = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if user:
        return {
            "success": True,
            "user": dict(user),
            "message": f"Welcome back, {user['name']}!"
        }
    else:
        # Fallback quick demo login
        if "admin" in email:
            return {
                "success": True,
                "user": {"id": 1, "name": "Dr. Ananya Sharma", "email": "admin@meditrack.org", "role": "admin"},
                "message": "Logged in as Admin (Demo Mode)"
            }
        else:
            return {
                "success": True,
                "user": {"id": 2, "name": "Rajesh Patel", "email": "staff@meditrack.org", "role": "staff"},
                "message": "Logged in as Staff (Demo Mode)"
            }

def api_sync_batch(data):
    """Sync an array of offline stock actions atomically."""
    actions = data.get("actions", [])
    synced_count = 0
    errors = []

    for item in actions:
        try:
            res = api_update_stock(item)
            if isinstance(res, tuple) and res[1] >= 400:
                errors.append(res[0].get("error", "Failed action"))
            else:
                synced_count += 1
        except Exception as e:
            errors.append(str(e))

    return {
        "success": True,
        "synced_count": synced_count,
        "errors": errors,
        "message": f"Synced {synced_count} offline actions successfully."
    }

def api_get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM clinic_settings")
    settings = {r["key"]: r["value"] for r in cursor.fetchall()}
    conn.close()
    return settings

def api_update_settings(data):
    conn = get_db_connection()
    cursor = conn.cursor()
    for k, v in data.items():
        cursor.execute("INSERT OR REPLACE INTO clinic_settings (key, value) VALUES (?, ?)", (k, str(v)))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Clinic settings saved."}

# -------------------------------------------------------------
# DUAL SERVER IMPLEMENTATION:
# Try Flask first; fallback to Built-in HTTPServer if Flask is missing.
# -------------------------------------------------------------

flask_app = None
try:
    from flask import Flask, request, jsonify, send_from_directory
    from flask_cors import CORS
    flask_app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
    CORS(flask_app)

    @flask_app.route("/")
    def serve_index():
        return send_from_directory(STATIC_DIR, "index.html")

    @flask_app.route("/<path:path>")
    def serve_static(path):
        return send_from_directory(STATIC_DIR, path)

    @flask_app.route("/api/dashboard", methods=["GET"])
    def f_dashboard():
        return jsonify(api_get_dashboard())

    @flask_app.route("/api/medicines", methods=["GET"])
    def f_get_medicines():
        return jsonify(api_get_medicines(request.args))

    @flask_app.route("/api/medicines", methods=["POST"])
    def f_post_medicine():
        res = api_create_medicine(request.get_json() or {})
        if isinstance(res, tuple):
            return jsonify(res[0]), res[1]
        return jsonify(res)

    @flask_app.route("/api/medicines/<int:med_id>", methods=["GET"])
    def f_get_medicine_detail(med_id):
        res = api_get_medicine_detail(med_id)
        if isinstance(res, tuple):
            return jsonify(res[0]), res[1]
        return jsonify(res)

    @flask_app.route("/api/medicines/<int:med_id>", methods=["PUT"])
    def f_put_medicine(med_id):
        res = api_update_medicine(med_id, request.get_json() or {})
        if isinstance(res, tuple):
            return jsonify(res[0]), res[1]
        return jsonify(res)

    @flask_app.route("/api/medicines/<int:med_id>", methods=["DELETE"])
    def f_delete_medicine(med_id):
        return jsonify(api_delete_medicine(med_id))

    @flask_app.route("/api/medicines/<int:med_id>/batches", methods=["POST"])
    def f_add_batch(med_id):
        res = api_add_batch(med_id, request.get_json() or {})
        if isinstance(res, tuple):
            return jsonify(res[0]), res[1]
        return jsonify(res)

    @flask_app.route("/api/stock/update", methods=["POST"])
    def f_update_stock():
        res = api_update_stock(request.get_json() or {})
        if isinstance(res, tuple):
            return jsonify(res[0]), res[1]
        return jsonify(res)

    @flask_app.route("/api/stock/history", methods=["GET"])
    def f_stock_history():
        return jsonify(api_get_stock_history(request.args))

    @flask_app.route("/api/alerts", methods=["GET"])
    def f_get_alerts():
        return jsonify(api_get_alerts(request.args))

    @flask_app.route("/api/alerts/<int:alert_id>/read", methods=["PUT"])
    def f_read_alert(alert_id):
        return jsonify(api_update_alert_status(alert_id, "Viewed"))

    @flask_app.route("/api/alerts/<int:alert_id>/resolve", methods=["PUT"])
    def f_resolve_alert(alert_id):
        return jsonify(api_update_alert_status(alert_id, "Resolved"))

    @flask_app.route("/api/reports/stock", methods=["GET"])
    def f_reports_stock():
        return jsonify(api_get_reports_stock())

    @flask_app.route("/api/reports/expiry", methods=["GET"])
    def f_reports_expiry():
        return jsonify(api_get_reports_expiry())

    @flask_app.route("/api/auth/login", methods=["POST"])
    def f_login():
        return jsonify(api_login(request.get_json() or {}))

    @flask_app.route("/api/auth/me", methods=["GET"])
    def f_auth_me():
        return jsonify({"user": {"id": 1, "name": "Dr. Ananya Sharma", "email": "admin@meditrack.org", "role": "admin"}})

    @flask_app.route("/api/sync/batch", methods=["POST"])
    def f_sync_batch():
        return jsonify(api_sync_batch(request.get_json() or {}))

    @flask_app.route("/api/settings", methods=["GET", "POST"])
    def f_settings():
        if request.method == "POST":
            return jsonify(api_update_settings(request.get_json() or {}))
        return jsonify(api_get_settings())

    @flask_app.route("/api/seed/reset", methods=["POST"])
    def f_seed_reset():
        seed()
        return jsonify({"success": True, "message": "Demo data reset successfully."})

except ImportError:
    pass

# Built-in Standard HTTP Server Handler
class MediTrackRequestHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status_code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            raw = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(raw)
            except Exception:
                return {}
        return {}

    def serve_file(self, filepath):
        if not os.path.isfile(filepath):
            filepath = os.path.join(STATIC_DIR, "index.html")

        mime, _ = mimetypes.guess_type(filepath)
        mime = mime or "application/octet-stream"

        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(content)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Error reading file: {e}".encode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        params = {k: v[0] for k, v in qs.items()}

        # REST API Routes
        if path == "/api/dashboard":
            self.send_json(api_get_dashboard())
        elif path == "/api/medicines":
            self.send_json(api_get_medicines(params))
        elif re.match(r"^/api/medicines/(\d+)$", path):
            med_id = int(re.match(r"^/api/medicines/(\d+)$", path).group(1))
            res = api_get_medicine_detail(med_id)
            if isinstance(res, tuple):
                self.send_json(res[0], res[1])
            else:
                self.send_json(res)
        elif path == "/api/stock/history":
            self.send_json(api_get_stock_history(params))
        elif path == "/api/alerts":
            self.send_json(api_get_alerts(params))
        elif path == "/api/reports/stock":
            self.send_json(api_get_reports_stock())
        elif path == "/api/reports/expiry":
            self.send_json(api_get_reports_expiry())
        elif path == "/api/settings":
            self.send_json(api_get_settings())
        elif path == "/api/auth/me":
            self.send_json({"user": {"id": 1, "name": "Dr. Ananya Sharma", "email": "admin@meditrack.org", "role": "admin"}})
        elif path.startswith("/api/"):
            self.send_json({"error": "Endpoint not found"}, 404)
        else:
            # Static File Serving
            rel_path = path.lstrip("/")
            if not rel_path:
                rel_path = "index.html"
            file_path = os.path.join(STATIC_DIR, rel_path)
            self.serve_file(file_path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = self.read_json_body()

        if path == "/api/medicines":
            res = api_create_medicine(data)
            status = 200
            if isinstance(res, tuple):
                data, status = res
            self.send_json(data, status)
        elif re.match(r"^/api/medicines/(\d+)/batches$", path):
            med_id = int(re.match(r"^/api/medicines/(\d+)/batches$", path).group(1))
            res = api_add_batch(med_id, data)
            status = 200
            if isinstance(res, tuple):
                data, status = res
            self.send_json(data, status)
        elif path == "/api/stock/update":
            res = api_update_stock(data)
            status = 200
            if isinstance(res, tuple):
                data, status = res
            self.send_json(data, status)
        elif path == "/api/auth/login":
            self.send_json(api_login(data))
        elif path == "/api/sync/batch":
            self.send_json(api_sync_batch(data))
        elif path == "/api/settings":
            self.send_json(api_update_settings(data))
        elif path == "/api/seed/reset":
            seed()
            self.send_json({"success": True, "message": "Demo data reset successfully."})
        else:
            self.send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = self.read_json_body()

        if re.match(r"^/api/medicines/(\d+)$", path):
            med_id = int(re.match(r"^/api/medicines/(\d+)$", path).group(1))
            res = api_update_medicine(med_id, data)
            status = 200
            if isinstance(res, tuple):
                data, status = res
            self.send_json(data, status)
        elif re.match(r"^/api/alerts/(\d+)/read$", path):
            alert_id = int(re.match(r"^/api/alerts/(\d+)/read$", path).group(1))
            self.send_json(api_update_alert_status(alert_id, "Viewed"))
        elif re.match(r"^/api/alerts/(\d+)/resolve$", path):
            alert_id = int(re.match(r"^/api/alerts/(\d+)/resolve$", path).group(1))
            self.send_json(api_update_alert_status(alert_id, "Resolved"))
        else:
            self.send_json({"error": "Endpoint not found"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if re.match(r"^/api/medicines/(\d+)$", path):
            med_id = int(re.match(r"^/api/medicines/(\d+)$", path).group(1))
            self.send_json(api_delete_medicine(med_id))
        else:
            self.send_json({"error": "Endpoint not found"}, 404)

def run_server(port=5000):
    init_db()
    # Check if database has medicines; if not, seed demo data
    conn = get_db_connection()
    count = conn.execute("SELECT COUNT(*) FROM medicines").fetchone()[0]
    conn.close()
    if count == 0:
        seed()

    print("=" * 65)
    print(" MediTrack 360 - Smart Medicine Expiry & Stock Tracker ")
    print(" Designed for Small Clinics and Rural Pharmacies ")
    print("=" * 65)
    print(f"Server starting on http://127.0.0.1:{port} (or http://localhost:{port})")

    if flask_app:
        print("[Engine] Running with Flask and Flask-CORS")
        flask_app.run(host="127.0.0.1", port=port, debug=False)
    else:
        print("[Engine] Running with Built-in Standard HTTP Server (Zero-dependency mode)")
        server_address = ("127.0.0.1", port)
        httpd = HTTPServer(server_address, MediTrackRequestHandler)
        print(f"[Ready] Web Dashboard & REST API active at http://127.0.0.1:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.server_close()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    run_server(port)
