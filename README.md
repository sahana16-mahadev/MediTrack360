# MediTrack 360 — Smart Medicine Expiry & Stock Tracker

> **Tagline:** Smart Medicine Expiry & Stock Tracker  
> **Mission:** Helping small clinics and rural pharmacies manage medicines easily.

---

## 🚀 Quick Launch (Two Ways to Open)

You can open MediTrack 360 in whichever way is most convenient for you:

### Option 1: 1-Click Instant Browser Launch (Zero Setup)
Simply double-click:
👉 [**`open_app_in_browser.bat`**](file:///C:/Users/SAHANA%20M/.gemini/antigravity/scratch/meditrack360/open_app_in_browser.bat)  
*(Or double-click [**`index.html`**](file:///C:/Users/SAHANA%20M/.gemini/antigravity/scratch/meditrack360/index.html) or [**`static/index.html`**](file:///C:/Users/SAHANA%20M/.gemini/antigravity/scratch/meditrack360/static/index.html))*

- Opens immediately in your web browser.
- Runs with complete interactive functionality (Dashboard, FEFO recommendations, Expiry alerts, Stock In/Out updates, Medicine management, CSV export, Print reports) powered by the built-in offline local storage engine.

---

### Option 2: Full Python & SQLite Backend Server
Double-click:
👉 [**`run_server.bat`**](file:///C:/Users/SAHANA%20M/.gemini/antigravity/scratch/meditrack360/run_server.bat)

- Automatically detects the verified Python 3.12 runtime on your PC.
- Starts the REST API backend on `http://localhost:5000` with the SQLite database (`meditrack360.db`).
- Automatically launches your browser to:
  👉 **`http://localhost:5000`**

---

## 🎨 Visual Healthcare Design System

- **Primary Colors:** Dark navy background (`#090e17` / `#0f172a`), deep slate cards (`#111a2e`), and vibrant orange accent (`#f97316` / `#ea580c`).
- **Clinical Status Codes:**
  - ⛔ **Red (`#ef4444`)**: Expired / Depleted (Quarantine safeguard)
  - ⏳ **Orange (`#f97316`)**: Critical Expiry (0–30 days remaining)
  - ⚠️ **Amber (`#f59e0b`)**: Warning window (31–50 days remaining)
  - ✓ **Green (`#10b981`)**: Healthy stock (>50 days shelf life)
  - 📉 **Sky Blue (`#38bdf8`)**: Low Stock (at or below reorder threshold)
- **Theme Modes:** Supports both **Dark Navy / Charcoal** and **Clinical Light Mode** with a single click.

---

## 📦 Features Included

1. **Dashboard:** 4 metric cards, FEFO recommendation banner, expiry shelf-life meter (0–30d, 31–50d, 50+d, Expired), and recent stock movement timeline.
2. **Medicines Directory:** Search, sort, and filter (Available, Low Stock, Expiring Soon, Expired, Out of Stock) with Add, Edit, View, and Delete actions.
3. **Stock Manager:** Dedicated Stock In (+), Stock Out (-), and Adjustment (=) workflow with clinical reasons and staff logging.
4. **Expiry Alert Center:** Categorized alerts with auto-calculated days remaining and quarantine safeguards.
5. **FEFO Protocol:** Automatically prioritizes earlier-expiring batches for patient dispensing.
6. **Reports & Exports:** Stock Report, Expiry Report, and Movement History with **Export to CSV** and clean **Print View**.
7. **Offline PWA:** Service Worker shell caching, IndexedDB / LocalStorage client database, and offline transaction queue.
8. **Role Switcher:** Admin (Dr. Ananya Sharma) and Staff (Rajesh Patel) permissions.
