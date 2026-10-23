"""
MediTrack 360 - Database Layer
SQLite schema and helper functions for small clinic & rural pharmacy medicine tracking.
"""

import sqlite3
import os
import json
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(__file__), "meditrack360.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        created_at TEXT NOT NULL
    )
    """)

    # 2. medicines table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        generic_name TEXT,
        category TEXT NOT NULL,
        manufacturer TEXT,
        supplier TEXT,
        unit TEXT NOT NULL DEFAULT 'Tablets',
        minimum_stock INTEGER NOT NULL DEFAULT 20,
        notes TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # 3. medicine_batches table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medicine_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL, -- YYYY-MM-DD
        quantity INTEGER NOT NULL DEFAULT 0,
        purchase_date TEXT,       -- YYYY-MM-DD
        created_at TEXT NOT NULL
    )
    """)

    # 4. stock_movements table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER REFERENCES medicine_batches(id) ON DELETE SET NULL,
        medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        movement_type TEXT NOT NULL, -- 'Stock In', 'Stock Out', 'Adjustment'
        quantity INTEGER NOT NULL,
        previous_quantity INTEGER NOT NULL,
        new_quantity INTEGER NOT NULL,
        reason TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        staff_name TEXT,
        timestamp TEXT NOT NULL
    )
    """)

    # 5. alerts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER REFERENCES medicine_batches(id) ON DELETE CASCADE,
        medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        alert_type TEXT NOT NULL, -- 'Expired', 'Expiring Soon', 'Low Stock', 'Out of Stock'
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Viewed', 'Resolved', 'Dismissed'
        created_at TEXT NOT NULL
    )
    """)

    # 6. clinic_settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clinic_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    # Set default clinic settings if missing
    default_settings = {
        "clinic_name": "Rampur Primary Health Center & Rural Pharmacy",
        "clinic_location": "District Hospital Sector 4, Rural Zone",
        "license_number": "PHC-RMP-2024-8891",
        "contact_phone": "+91 98765 43210",
        "expiring_soon_days": "30",
        "warning_days": "50",
        "default_min_stock": "20"
    }

    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO clinic_settings (key, value) VALUES (?, ?)", (k, v))

    conn.commit()
    conn.close()

def calculate_expiry_status(expiry_date_str, today=None):
    if today is None:
        today = date.today()
    try:
        exp_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
    except Exception:
        return {"days_remaining": 999, "status": "Normal", "urgency": "low"}

    days_remaining = (exp_date - today).days

    if days_remaining < 0:
        return {"days_remaining": days_remaining, "status": "Expired", "urgency": "critical", "color": "red"}
    elif days_remaining <= 30:
        return {"days_remaining": days_remaining, "status": "Expiring Soon", "urgency": "high", "color": "orange"}
    elif days_remaining <= 50:
        return {"days_remaining": days_remaining, "status": "Warning", "urgency": "medium", "color": "yellow"}
    else:
        return {"days_remaining": days_remaining, "status": "Normal", "urgency": "low", "color": "green"}

def recalculate_alerts():
    """Dynamically scan medicines and batches to sync active alerts table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    today = date.today()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Fetch all batches with medicine info
    cursor.execute("""
        SELECT b.id AS batch_id, b.medicine_id, b.batch_number, b.expiry_date, b.quantity,
               m.name AS medicine_name, m.unit, m.minimum_stock
        FROM medicine_batches b
        JOIN medicines m ON b.medicine_id = m.id
    """)
    batches = cursor.fetchall()

    # Track alerts per batch/medicine
    for b in batches:
        exp_info = calculate_expiry_status(b["expiry_date"], today)
        status = exp_info["status"]
        days = exp_info["days_remaining"]

        # Check Expiry alerts
        if status == "Expired":
            msg = f"{b['medicine_name']} (Batch {b['batch_number']}) has expired {abs(days)} days ago! DO NOT DISPENSE."
            cursor.execute("""
                INSERT OR IGNORE INTO alerts (batch_id, medicine_id, alert_type, message, status, created_at)
                SELECT ?, ?, 'Expired', ?, 'Active', ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM alerts WHERE batch_id = ? AND alert_type = 'Expired' AND status IN ('Active', 'Viewed')
                )
            """, (b["batch_id"], b["medicine_id"], msg, now_str, b["batch_id"]))
        elif status == "Expiring Soon":
            msg = f"{b['medicine_name']} (Batch {b['batch_number']}) expires in {days} days ({b['expiry_date']}). Prioritize usage."
            cursor.execute("""
                INSERT OR IGNORE INTO alerts (batch_id, medicine_id, alert_type, message, status, created_at)
                SELECT ?, ?, 'Expiring Soon', ?, 'Active', ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM alerts WHERE batch_id = ? AND alert_type = 'Expiring Soon' AND status IN ('Active', 'Viewed')
                )
            """, (b["batch_id"], b["medicine_id"], msg, now_str, b["batch_id"]))

    # Check Total Stock per medicine for Low Stock & Out of Stock alerts
    cursor.execute("""
        SELECT m.id AS medicine_id, m.name AS medicine_name, m.unit, m.minimum_stock,
               COALESCE(SUM(b.quantity), 0) AS total_stock
        FROM medicines m
        LEFT JOIN medicine_batches b ON m.id = b.medicine_id
        GROUP BY m.id
    """)
    medicines_stock = cursor.fetchall()

    for m in medicines_stock:
        tot = m["total_stock"]
        min_s = m["minimum_stock"]

        if tot == 0:
            msg = f"{m['medicine_name']} is currently OUT OF STOCK! Restocking urgently required."
            cursor.execute("""
                INSERT OR IGNORE INTO alerts (batch_id, medicine_id, alert_type, message, status, created_at)
                SELECT NULL, ?, 'Out of Stock', ?, 'Active', ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM alerts WHERE medicine_id = ? AND alert_type = 'Out of Stock' AND status IN ('Active', 'Viewed')
                )
            """, (m["medicine_id"], msg, now_str, m["medicine_id"]))
        elif tot <= min_s:
            msg = f"{m['medicine_name']} is running low ({tot} {m['unit']} remaining, min threshold is {min_s})."
            cursor.execute("""
                INSERT OR IGNORE INTO alerts (batch_id, medicine_id, alert_type, message, status, created_at)
                SELECT NULL, ?, 'Low Stock', ?, 'Active', ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM alerts WHERE medicine_id = ? AND alert_type = 'Low Stock' AND status IN ('Active', 'Viewed')
                )
            """, (m["medicine_id"], msg, now_str, m["medicine_id"]))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    recalculate_alerts()
    print("Database initialized successfully at:", DB_PATH)
