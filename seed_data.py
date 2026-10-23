"""
MediTrack 360 - Demo Data Seeder
Populates realistic sample data for small clinics & rural pharmacies.
Includes multi-batch medicines to demonstrate FEFO (First Expire, First Out),
expired batches, expiring soon (0-30 days), warning (31-50 days), low stock,
and out-of-stock scenarios.
"""

from datetime import date, timedelta, datetime
import hashlib
from database import get_db_connection, init_db, recalculate_alerts

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def seed():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clear existing demo data
    cursor.execute("DELETE FROM alerts")
    cursor.execute("DELETE FROM stock_movements")
    cursor.execute("DELETE FROM medicine_batches")
    cursor.execute("DELETE FROM medicines")
    cursor.execute("DELETE FROM users")
    try:
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('users', 'medicines', 'medicine_batches', 'stock_movements', 'alerts')")
    except Exception:
        pass

    today = date.today()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Seed Users
    users_data = [
        ("Dr. Ananya Sharma", "admin@meditrack.org", hash_pw("admin123"), "admin", now_str),
        ("Rajesh Patel", "staff@meditrack.org", hash_pw("staff123"), "staff", now_str),
        ("Sunita Verma", "sunita@meditrack.org", hash_pw("staff123"), "staff", now_str)
    ]
    user_ids = []
    for u in users_data:
        cursor.execute("INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)", u)
        user_ids.append(cursor.lastrowid)

    admin_id = user_ids[0]
    staff_id = user_ids[1]

    # Helper to calculate date relative to today
    def d(days_offset):
        return (today + timedelta(days=days_offset)).strftime("%Y-%m-%d")

    medicines = [
        {
            "name": "Paracetamol 650mg",
            "generic_name": "Paracetamol / Acetaminophen",
            "category": "Analgesic & Antipyretic",
            "manufacturer": "Cipla Ltd.",
            "supplier": "Jan Aushadhi Central Depot",
            "unit": "Tablets",
            "minimum_stock": 35,
            "notes": "Essential fever & pain relief. Most frequently dispensed.",
            "batches": [
                {
                    "batch_number": "PAR2309",
                    "expiry_date": d(22), # 22 days -> Expiring Soon (Critical/Orange)
                    "quantity": 18,
                    "purchase_date": d(-200)
                },
                {
                    "batch_number": "PAR2401",
                    "expiry_date": d(145), # 145 days -> Healthy shelf life
                    "quantity": 120,
                    "purchase_date": d(-40)
                }
            ]
        },
        {
            "name": "Amoxicillin 500mg",
            "generic_name": "Amoxicillin Trihydrate",
            "category": "Antibiotics",
            "manufacturer": "Alkem Laboratories",
            "supplier": "Rural Health Medical Supplies",
            "unit": "Capsules",
            "minimum_stock": 30,
            "notes": "Broad-spectrum bacterial infection antibiotic.",
            "batches": [
                {
                    "batch_number": "AMX2405",
                    "expiry_date": d(-15), # Expired 15 days ago -> Red Alert!
                    "quantity": 40,
                    "purchase_date": d(-365)
                },
                {
                    "batch_number": "AMX2502",
                    "expiry_date": d(180), # Healthy batch
                    "quantity": 25,
                    "purchase_date": d(-60)
                }
            ]
        },
        {
            "name": "Metformin 500mg",
            "generic_name": "Metformin Hydrochloride",
            "category": "Antidiabetic",
            "manufacturer": "Sun Pharma",
            "supplier": "State Medical Logistics",
            "unit": "Tablets",
            "minimum_stock": 50,
            "notes": "Type 2 diabetes glycemic control. High routine demand.",
            "batches": [
                {
                    "batch_number": "MET901",
                    "expiry_date": d(42), # 42 days -> Warning range (31-50 days)
                    "quantity": 12,        # 12 < 50 -> LOW STOCK alert!
                    "purchase_date": d(-280)
                }
            ]
        },
        {
            "name": "Cetirizine 10mg",
            "generic_name": "Cetirizine Dihydrochloride",
            "category": "Antihistamine / Allergy",
            "manufacturer": "Dr. Reddy's Labs",
            "supplier": "Jan Aushadhi Central Depot",
            "unit": "Tablets",
            "minimum_stock": 25,
            "notes": "Allergic rhinitis, hives and seasonal reactions.",
            "batches": [
                {
                    "batch_number": "CET112",
                    "expiry_date": d(310),
                    "quantity": 0, # OUT OF STOCK!
                    "purchase_date": d(-120)
                }
            ]
        },
        {
            "name": "Omeprazole 20mg",
            "generic_name": "Omeprazole",
            "category": "Gastrointestinal",
            "manufacturer": "Torrent Pharma",
            "supplier": "National Drug Syndicate",
            "unit": "Capsules",
            "minimum_stock": 30,
            "notes": "Proton pump inhibitor for hyperacidity & GERD.",
            "batches": [
                {
                    "batch_number": "OMP884",
                    "expiry_date": d(95),
                    "quantity": 16, # 16 < 30 -> LOW STOCK!
                    "purchase_date": d(-150)
                }
            ]
        },
        {
            "name": "Azithromycin 500mg",
            "generic_name": "Azithromycin Dihydrate",
            "category": "Antibiotics",
            "manufacturer": "Zydus Lifesciences",
            "supplier": "Rural Health Medical Supplies",
            "unit": "Tablets",
            "minimum_stock": 25,
            "notes": "3-day course respiratory infection treatment.",
            "batches": [
                {
                    "batch_number": "AZI304",
                    "expiry_date": d(14), # 14 days -> Critical Expiring Soon!
                    "quantity": 15,        # 15 < 25 -> Low Stock as well!
                    "purchase_date": d(-190)
                }
            ]
        },
        {
            "name": "ORS Packet (Oral Rehydration Salts)",
            "generic_name": "Sodium Chloride + Glucose",
            "category": "Electrolyte & Rehydration",
            "manufacturer": "FDC India",
            "supplier": "UNICEF / National Health Mission",
            "unit": "Sachets",
            "minimum_stock": 40,
            "notes": "Crucial for acute diarrheal rehydration in rural children.",
            "batches": [
                {
                    "batch_number": "ORS005",
                    "expiry_date": d(270),
                    "quantity": 140, # Healthy stock
                    "purchase_date": d(-30)
                }
            ]
        },
        {
            "name": "Diclofenac 50mg",
            "generic_name": "Diclofenac Sodium",
            "category": "NSAID & Pain Relief",
            "manufacturer": "Lupin Pharmaceuticals",
            "supplier": "Jan Aushadhi Central Depot",
            "unit": "Tablets",
            "minimum_stock": 30,
            "notes": "Anti-inflammatory pain management for joint pain & injuries.",
            "batches": [
                {
                    "batch_number": "DIC440",
                    "expiry_date": d(9), # 9 days -> Expiring soon!
                    "quantity": 30,
                    "purchase_date": d(-240)
                },
                {
                    "batch_number": "DIC512",
                    "expiry_date": d(210),
                    "quantity": 85,
                    "purchase_date": d(-45)
                }
            ]
        },
        {
            "name": "Ambroxol Cough Syrup 100ml",
            "generic_name": "Ambroxol + Guaiphenesin Syrup",
            "category": "Respiratory",
            "manufacturer": "Mankind Pharma",
            "supplier": "State Medical Logistics",
            "unit": "Bottles",
            "minimum_stock": 15,
            "notes": "Pediatric and adult productive cough relief.",
            "batches": [
                {
                    "batch_number": "CS881",
                    "expiry_date": d(-35), # Expired 35 days ago!
                    "quantity": 10,
                    "purchase_date": d(-400)
                }
            ]
        },
        {
            "name": "Insulin Glargine 100 IU/ml",
            "generic_name": "Insulin Glargine Recombinant",
            "category": "Antidiabetic / Injectable",
            "manufacturer": "Biocon Biologics",
            "supplier": "Apex Cold-Chain Distributors",
            "unit": "Vials",
            "minimum_stock": 15,
            "notes": "Cold storage required (2°C - 8°C). Long-acting basal insulin.",
            "batches": [
                {
                    "batch_number": "INS209",
                    "expiry_date": d(65), # 65 days
                    "quantity": 5,        # 5 < 15 -> Low Stock!
                    "purchase_date": d(-90)
                }
            ]
        }
    ]

    saved_med_ids = []
    saved_batch_ids = []

    for med in medicines:
        cursor.execute("""
            INSERT INTO medicines (name, generic_name, category, manufacturer, supplier, unit, minimum_stock, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            med["name"], med["generic_name"], med["category"],
            med["manufacturer"], med["supplier"], med["unit"],
            med["minimum_stock"], med["notes"], now_str
        ))
        med_id = cursor.lastrowid
        saved_med_ids.append(med_id)

        for b in med["batches"]:
            cursor.execute("""
                INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, purchase_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                med_id, b["batch_number"], b["expiry_date"],
                b["quantity"], b["purchase_date"], now_str
            ))
            batch_id = cursor.lastrowid
            saved_batch_ids.append((med_id, batch_id))

            # Initial intake movement
            cursor.execute("""
                INSERT INTO stock_movements (batch_id, medicine_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id, staff_name, timestamp)
                VALUES (?, ?, 'Stock In', ?, 0, ?, 'Initial intake / opening balance', ?, 'System Setup', ?)
            """, (
                batch_id, med_id, b["quantity"], b["quantity"], admin_id, b["purchase_date"] + " 10:00:00"
            ))

    # Add realistic recent stock movements using verified dynamic IDs
    if len(saved_batch_ids) >= 4:
        p_med, p_batch = saved_batch_ids[0]
        cursor.execute("""
            INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id, staff_name, timestamp)
            VALUES (?, ?, 'Stock Out', 10, 28, 18, 'Prescription Dispense - OPD Patient #1042', ?, 'Rajesh Patel', ?)
        """, (p_med, p_batch, staff_id, d(-1) + " 11:30:00"))

        p2_med, p2_batch = saved_batch_ids[1]
        cursor.execute("""
            INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id, staff_name, timestamp)
            VALUES (?, ?, 'Stock In', 50, 70, 120, 'Fresh consignment received from Jan Aushadhi', ?, 'Dr. Ananya Sharma', ?)
        """, (p2_med, p2_batch, admin_id, d(-2) + " 14:15:00"))

    conn.commit()
    conn.close()

    # Recalculate dynamic alerts
    recalculate_alerts()
    print("Seed data loaded successfully!")

if __name__ == "__main__":
    seed()
