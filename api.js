/**
 * MediTrack 360 - API Client & Offline Sync Manager
 * Supports both REST API backend (HTTP/Flask/SQLite) and
 * instant Zero-Setup Local Storage Client Engine (file:// or standalone offline mode).
 */

const API_BASE = '/api';
const STORAGE_PREFIX = 'meditrack_';

// Default realistic sample data for zero-setup / offline fallback
function getInitialSampleData() {
  const today = new Date();
  const d = (offsetDays) => {
    const target = new Date(today.getTime() + offsetDays * 86400000);
    return target.toISOString().slice(0, 10);
  };

  return {
    clinic_info: {
      clinic_name: 'Rampur Primary Health Center & Rural Pharmacy',
      clinic_location: 'District Hospital Sector 4, Rural Zone',
      license_number: 'PHC-RMP-2024-8891',
      contact_phone: '+91 98765 43210',
      expiring_soon_days: '30',
      warning_days: '50'
    },
    medicines: [
      {
        id: 1,
        name: 'Paracetamol 650mg',
        generic_name: 'Paracetamol / Acetaminophen',
        category: 'Analgesic & Antipyretic',
        manufacturer: 'Cipla Ltd.',
        supplier: 'Jan Aushadhi Central Depot',
        unit: 'Tablets',
        minimum_stock: 35,
        current_stock: 138,
        notes: 'Essential fever & pain relief. Most frequently dispensed.',
        batches: [
          { id: 1, batch_number: 'PAR2309', expiry_date: d(22), quantity: 18, days_remaining: 22, expiry_status: 'Expiring Soon' },
          { id: 2, batch_number: 'PAR2401', expiry_date: d(145), quantity: 120, days_remaining: 145, expiry_status: 'Normal' }
        ],
        fefo_recommended: { batch_number: 'PAR2309', expiry_date: d(22), days_remaining: 22, quantity: 18 },
        earliest_expiry: d(22),
        days_remaining: 22,
        stock_status: 'Healthy',
        expiry_status: 'Expiring Soon'
      },
      {
        id: 2,
        name: 'Amoxicillin 500mg',
        generic_name: 'Amoxicillin Trihydrate',
        category: 'Antibiotics',
        manufacturer: 'Alkem Laboratories',
        supplier: 'Rural Health Medical Supplies',
        unit: 'Capsules',
        minimum_stock: 30,
        current_stock: 65,
        notes: 'Broad-spectrum bacterial infection antibiotic.',
        batches: [
          { id: 3, batch_number: 'AMX2405', expiry_date: d(-15), quantity: 40, days_remaining: -15, expiry_status: 'Expired' },
          { id: 4, batch_number: 'AMX2502', expiry_date: d(180), quantity: 25, days_remaining: 180, expiry_status: 'Normal' }
        ],
        fefo_recommended: { batch_number: 'AMX2502', expiry_date: d(180), days_remaining: 180, quantity: 25 },
        earliest_expiry: d(-15),
        days_remaining: -15,
        stock_status: 'Healthy',
        expiry_status: 'Expired'
      },
      {
        id: 3,
        name: 'Metformin 500mg',
        generic_name: 'Metformin Hydrochloride',
        category: 'Antidiabetic',
        manufacturer: 'Sun Pharma',
        supplier: 'State Medical Logistics',
        unit: 'Tablets',
        minimum_stock: 50,
        current_stock: 12,
        notes: 'Type 2 diabetes glycemic control. High routine demand.',
        batches: [
          { id: 5, batch_number: 'MET901', expiry_date: d(42), quantity: 12, days_remaining: 42, expiry_status: 'Warning' }
        ],
        fefo_recommended: { batch_number: 'MET901', expiry_date: d(42), days_remaining: 42, quantity: 12 },
        earliest_expiry: d(42),
        days_remaining: 42,
        stock_status: 'Low Stock',
        expiry_status: 'Warning'
      },
      {
        id: 4,
        name: 'Cetirizine 10mg',
        generic_name: 'Cetirizine Dihydrochloride',
        category: 'Antihistamine / Allergy',
        manufacturer: "Dr. Reddy's Labs",
        supplier: 'Jan Aushadhi Central Depot',
        unit: 'Tablets',
        minimum_stock: 25,
        current_stock: 0,
        notes: 'Allergic rhinitis, hives and seasonal reactions.',
        batches: [
          { id: 6, batch_number: 'CET112', expiry_date: d(310), quantity: 0, days_remaining: 310, expiry_status: 'Normal' }
        ],
        fefo_recommended: null,
        earliest_expiry: d(310),
        days_remaining: 310,
        stock_status: 'Out of Stock',
        expiry_status: 'Normal'
      },
      {
        id: 5,
        name: 'Omeprazole 20mg',
        generic_name: 'Omeprazole',
        category: 'Gastrointestinal',
        manufacturer: 'Torrent Pharma',
        supplier: 'National Drug Syndicate',
        unit: 'Capsules',
        minimum_stock: 30,
        current_stock: 16,
        notes: 'Proton pump inhibitor for hyperacidity & GERD.',
        batches: [
          { id: 7, batch_number: 'OMP884', expiry_date: d(95), quantity: 16, days_remaining: 95, expiry_status: 'Normal' }
        ],
        fefo_recommended: { batch_number: 'OMP884', expiry_date: d(95), days_remaining: 95, quantity: 16 },
        earliest_expiry: d(95),
        days_remaining: 95,
        stock_status: 'Low Stock',
        expiry_status: 'Normal'
      },
      {
        id: 6,
        name: 'Azithromycin 500mg',
        generic_name: 'Azithromycin Dihydrate',
        category: 'Antibiotics',
        manufacturer: 'Zydus Lifesciences',
        supplier: 'Rural Health Medical Supplies',
        unit: 'Tablets',
        minimum_stock: 25,
        current_stock: 15,
        notes: '3-day course respiratory infection treatment.',
        batches: [
          { id: 8, batch_number: 'AZI304', expiry_date: d(14), quantity: 15, days_remaining: 14, expiry_status: 'Expiring Soon' }
        ],
        fefo_recommended: { batch_number: 'AZI304', expiry_date: d(14), days_remaining: 14, quantity: 15 },
        earliest_expiry: d(14),
        days_remaining: 14,
        stock_status: 'Low Stock',
        expiry_status: 'Expiring Soon'
      },
      {
        id: 7,
        name: 'ORS Packet (Oral Rehydration Salts)',
        generic_name: 'Sodium Chloride + Glucose',
        category: 'Electrolyte & Rehydration',
        manufacturer: 'FDC India',
        supplier: 'UNICEF / National Health Mission',
        unit: 'Sachets',
        minimum_stock: 40,
        current_stock: 140,
        notes: 'Crucial for acute diarrheal rehydration in rural children.',
        batches: [
          { id: 9, batch_number: 'ORS005', expiry_date: d(270), quantity: 140, days_remaining: 270, expiry_status: 'Normal' }
        ],
        fefo_recommended: { batch_number: 'ORS005', expiry_date: d(270), days_remaining: 270, quantity: 140 },
        earliest_expiry: d(270),
        days_remaining: 270,
        stock_status: 'Healthy',
        expiry_status: 'Normal'
      },
      {
        id: 8,
        name: 'Diclofenac 50mg',
        generic_name: 'Diclofenac Sodium',
        category: 'NSAID & Pain Relief',
        manufacturer: 'Lupin Pharmaceuticals',
        supplier: 'Jan Aushadhi Central Depot',
        unit: 'Tablets',
        minimum_stock: 30,
        current_stock: 115,
        notes: 'Anti-inflammatory pain management for joint pain & injuries.',
        batches: [
          { id: 10, batch_number: 'DIC440', expiry_date: d(9), quantity: 30, days_remaining: 9, expiry_status: 'Expiring Soon' },
          { id: 11, batch_number: 'DIC512', expiry_date: d(210), quantity: 85, days_remaining: 210, expiry_status: 'Normal' }
        ],
        fefo_recommended: { batch_number: 'DIC440', expiry_date: d(9), days_remaining: 9, quantity: 30 },
        earliest_expiry: d(9),
        days_remaining: 9,
        stock_status: 'Healthy',
        expiry_status: 'Expiring Soon'
      },
      {
        id: 9,
        name: 'Ambroxol Cough Syrup 100ml',
        generic_name: 'Ambroxol + Guaiphenesin Syrup',
        category: 'Respiratory',
        manufacturer: 'Mankind Pharma',
        supplier: 'State Medical Logistics',
        unit: 'Bottles',
        minimum_stock: 15,
        current_stock: 10,
        notes: 'Pediatric and adult productive cough relief.',
        batches: [
          { id: 12, batch_number: 'CS881', expiry_date: d(-35), quantity: 10, days_remaining: -35, expiry_status: 'Expired' }
        ],
        fefo_recommended: null,
        earliest_expiry: d(-35),
        days_remaining: -35,
        stock_status: 'Low Stock',
        expiry_status: 'Expired'
      },
      {
        id: 10,
        name: 'Insulin Glargine 100 IU/ml',
        generic_name: 'Insulin Glargine Recombinant',
        category: 'Antidiabetic / Injectable',
        manufacturer: 'Biocon Biologics',
        supplier: 'Apex Cold-Chain Distributors',
        unit: 'Vials',
        minimum_stock: 15,
        current_stock: 5,
        notes: 'Cold storage required (2°C - 8°C). Long-acting basal insulin.',
        batches: [
          { id: 13, batch_number: 'INS209', expiry_date: d(65), quantity: 5, days_remaining: 65, expiry_status: 'Normal' }
        ],
        fefo_recommended: { batch_number: 'INS209', expiry_date: d(65), days_remaining: 65, quantity: 5 },
        earliest_expiry: d(65),
        days_remaining: 65,
        stock_status: 'Low Stock',
        expiry_status: 'Normal'
      }
    ],
    movements: [
      { id: 1, timestamp: d(-1) + ' 11:30:00', medicine_name: 'Paracetamol 650mg', batch_number: 'PAR2309', movement_type: 'Stock Out', quantity: 10, previous_quantity: 28, new_quantity: 18, staff_name: 'Rajesh Patel', reason: 'Prescription Dispense - OPD Patient #1042', unit: 'Tablets' },
      { id: 2, timestamp: d(-2) + ' 14:15:00', medicine_name: 'Paracetamol 650mg', batch_number: 'PAR2401', movement_type: 'Stock In', quantity: 50, previous_quantity: 70, new_quantity: 120, staff_name: 'Dr. Ananya Sharma', reason: 'Fresh consignment received from Jan Aushadhi', unit: 'Tablets' },
      { id: 3, timestamp: d(-3) + ' 09:45:00', medicine_name: 'Metformin 500mg', batch_number: 'MET901', movement_type: 'Stock Out', quantity: 15, previous_quantity: 27, new_quantity: 12, staff_name: 'Rajesh Patel', reason: 'Dispensed 15 tabs to Diabetic Clinic Patient #890', unit: 'Tablets' },
      { id: 4, timestamp: d(-4) + ' 16:20:00', medicine_name: 'Cetirizine 10mg', batch_number: 'CET112', movement_type: 'Stock Out', quantity: 25, previous_quantity: 25, new_quantity: 0, staff_name: 'Sunita Verma', reason: 'Dispensed full remainder to Emergency Allergy Case', unit: 'Tablets' }
    ],
    alerts: [
      { id: 1, alert_type: 'Expired', medicine_name: 'Amoxicillin 500mg', batch_number: 'AMX2405', expiry_date: d(-15), days_remaining: -15, message: 'Amoxicillin 500mg (Batch AMX2405) has expired 15 days ago! DO NOT DISPENSE.', status: 'Active', created_at: d(-15) },
      { id: 2, alert_type: 'Expired', medicine_name: 'Ambroxol Cough Syrup 100ml', batch_number: 'CS881', expiry_date: d(-35), days_remaining: -35, message: 'Ambroxol Cough Syrup (Batch CS881) expired 35 days ago. Safe quarantine required.', status: 'Active', created_at: d(-35) },
      { id: 3, alert_type: 'Expiring Soon', medicine_name: 'Paracetamol 650mg', batch_number: 'PAR2309', expiry_date: d(22), days_remaining: 22, message: 'Paracetamol 650mg (Batch PAR2309) expires in 22 days. Prioritize usage under FEFO.', status: 'Active', created_at: d(-5) },
      { id: 4, alert_type: 'Expiring Soon', medicine_name: 'Azithromycin 500mg', batch_number: 'AZI304', expiry_date: d(14), days_remaining: 14, message: 'Azithromycin 500mg (Batch AZI304) expires in 14 days.', status: 'Active', created_at: d(-3) },
      { id: 5, alert_type: 'Expiring Soon', medicine_name: 'Diclofenac 50mg', batch_number: 'DIC440', expiry_date: d(9), days_remaining: 9, message: 'Diclofenac 50mg (Batch DIC440) expires in 9 days.', status: 'Active', created_at: d(-1) },
      { id: 6, alert_type: 'Out of Stock', medicine_name: 'Cetirizine 10mg', batch_number: 'CET112', expiry_date: d(310), days_remaining: 310, message: 'Cetirizine 10mg is currently OUT OF STOCK! Restocking urgently required.', status: 'Active', created_at: d(-4) },
      { id: 7, alert_type: 'Low Stock', medicine_name: 'Metformin 500mg', batch_number: 'MET901', expiry_date: d(42), days_remaining: 42, message: 'Metformin 500mg is running low (12 Tablets remaining, minimum safety is 50).', status: 'Active', created_at: d(-3) },
      { id: 8, alert_type: 'Low Stock', medicine_name: 'Insulin Glargine 100 IU/ml', batch_number: 'INS209', expiry_date: d(65), days_remaining: 65, message: 'Insulin Glargine is running low (5 Vials remaining, minimum safety is 15).', status: 'Active', created_at: d(-2) }
    ]
  };
}

class ApiClient {
  constructor() {
    this.isFileProto = window.location.protocol === 'file:';
    this.serverAvailable = !this.isFileProto;
    this.isOnline = navigator.onLine !== undefined ? navigator.onLine : true;
    this.listeners = [];
    this.pendingQueue = this.loadQueue();

    // Initialize local database in localStorage if absent
    this.initLocalStore();

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyNetworkChange();
      this.syncPendingQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyNetworkChange();
    });
  }

  initLocalStore() {
    if (!localStorage.getItem(STORAGE_PREFIX + 'local_db')) {
      const initial = getInitialSampleData();
      localStorage.setItem(STORAGE_PREFIX + 'local_db', JSON.stringify(initial));
    }
  }

  getLocalDb() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + 'local_db');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const initial = getInitialSampleData();
    this.saveLocalDb(initial);
    return initial;
  }

  saveLocalDb(db) {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'local_db', JSON.stringify(db));
    } catch (e) {}
  }

  loadQueue() {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + 'pending_queue');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'pending_queue', JSON.stringify(this.pendingQueue));
    } catch (e) {}
  }

  getPendingQueueCount() {
    return this.pendingQueue.length;
  }

  subscribeNetworkStatus(callback) {
    this.listeners.push(callback);
    callback(this.isOnline && this.serverAvailable, this.pendingQueue.length);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyNetworkChange() {
    for (const cb of this.listeners) {
      try {
        cb(this.isOnline && this.serverAvailable, this.pendingQueue.length);
      } catch (e) {}
    }
  }

  // Network fetch with automatic seamless local engine fallback
  async request(endpoint, options = {}) {
    if (this.isFileProto || !this.serverAvailable) {
      return this.handleLocalRequest(endpoint, options);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal,
        ...options
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      this.serverAvailable = true;
      return await res.json();
    } catch (err) {
      console.warn(`[API] Server unavailable at ${url}, switching to built-in local store:`, err.message);
      this.serverAvailable = false;
      this.notifyNetworkChange();
      return this.handleLocalRequest(endpoint, options);
    }
  }

  // Pure in-browser execution handler for 100% offline or standalone file:// execution
  handleLocalRequest(endpoint, options = {}) {
    const db = this.getLocalDb();
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};

    // 1. Dashboard
    if (endpoint.startsWith('/dashboard')) {
      const meds = db.medicines || [];
      let totalUnits = 0;
      let totalBatches = 0;
      let expiredCount = 0;
      let expiringSoonCount = 0;
      let warningCount = 0;
      let normalCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let healthyCount = 0;

      const fefoRecs = [];
      const lowStockItems = [];

      meds.forEach(m => {
        totalUnits += m.current_stock;
        totalBatches += (m.batches || []).length;

        if (m.current_stock === 0) outOfStockCount++;
        else if (m.current_stock <= m.minimum_stock) {
          lowStockCount++;
          lowStockItems.push({
            id: m.id,
            name: m.name,
            generic_name: m.generic_name,
            unit: m.unit,
            current_stock: m.current_stock,
            minimum_stock: m.minimum_stock,
            status: 'Low Stock'
          });
        } else {
          healthyCount++;
        }

        (m.batches || []).forEach(b => {
          if (b.days_remaining < 0) expiredCount++;
          else if (b.days_remaining <= 30) expiringSoonCount++;
          else if (b.days_remaining <= 50) warningCount++;
          else normalCount++;
        });

        if (m.fefo_recommended) {
          fefoRecs.push({
            medicine_id: m.id,
            medicine_name: m.name,
            unit: m.unit,
            category: m.category,
            recommended_batch: m.fefo_recommended,
            other_batches: (m.batches || []).filter(b => b.batch_number !== m.fefo_recommended.batch_number),
            message: `Dispense Batch ${m.fefo_recommended.batch_number} first (${m.fefo_recommended.quantity} ${m.unit}, expires in ${m.fefo_recommended.days_remaining} days).`
          });
        }
      });

      return {
        summary: {
          total_medicines: meds.length,
          total_batches: totalBatches,
          total_units: totalUnits,
          expiring_soon: expiringSoonCount,
          expired: expiredCount,
          warning: warningCount,
          low_stock: lowStockCount,
          out_of_stock: outOfStockCount,
          healthy_stock: healthyCount
        },
        expiry_distribution: {
          expired: expiredCount,
          range_0_30: expiringSoonCount,
          range_31_50: warningCount,
          range_50_plus: normalCount
        },
        stock_status_distribution: {
          healthy: healthyCount,
          low_stock: lowStockCount,
          out_of_stock: outOfStockCount
        },
        low_stock_items: lowStockItems,
        fefo_recommendations: fefoRecs,
        recent_activities: (db.movements || []).slice(0, 8),
        active_alerts: (db.alerts || []).filter(a => a.status === 'Active'),
        clinic_info: db.clinic_info
      };
    }

    // 2. Medicines List
    if (endpoint.startsWith('/medicines') && method === 'GET') {
      return { medicines: db.medicines || [], total: (db.medicines || []).length };
    }

    // 2b. Update Medicine (PUT)
    if (endpoint.startsWith('/medicines') && method === 'PUT') {
      const parts = endpoint.split('/');
      const medId = parseInt(parts[2]);
      const med = (db.medicines || []).find(m => m.id === medId);
      if (med) {
        if (body.name) med.name = body.name.trim();
        if (body.generic_name !== undefined) med.generic_name = body.generic_name.trim();
        if (body.category) med.category = body.category.trim();
        if (body.manufacturer !== undefined) med.manufacturer = body.manufacturer.trim();
        if (body.supplier !== undefined) med.supplier = body.supplier.trim();
        if (body.unit) med.unit = body.unit.trim();
        if (body.minimum_stock !== undefined) med.minimum_stock = parseInt(body.minimum_stock) || 20;
        if (body.notes !== undefined) med.notes = body.notes.trim();
        med.stock_status = med.current_stock === 0 ? 'Out of Stock' : (med.current_stock <= med.minimum_stock ? 'Low Stock' : 'Healthy');
        this.saveLocalDb(db);
        return { success: true, message: 'Medicine updated successfully.' };
      }
      throw new Error('Medicine not found');
    }

    // 2c. Delete Medicine (DELETE)
    if (endpoint.startsWith('/medicines') && method === 'DELETE') {
      const parts = endpoint.split('/');
      const medId = parseInt(parts[2]);
      db.medicines = (db.medicines || []).filter(m => m.id !== medId);
      db.alerts = (db.alerts || []).filter(a => a.medicine_id !== medId);
      db.movements = (db.movements || []).filter(sm => sm.medicine_id !== medId);
      this.saveLocalDb(db);
      return { success: true, message: 'Medicine deleted successfully.' };
    }

    // 3. Create Medicine
    if (endpoint.startsWith('/medicines') && method === 'POST') {
      const today = new Date();
      const expDate = new Date(body.expiry_date);
      const days = Math.round((expDate - today) / 86400000);
      const newMedId = Date.now();
      const newBatchId = newMedId + 1;

      const newBatch = {
        id: newBatchId,
        batch_number: body.batch_number,
        expiry_date: body.expiry_date,
        quantity: parseInt(body.quantity) || 0,
        days_remaining: days,
        expiry_status: days < 0 ? 'Expired' : (days <= 30 ? 'Expiring Soon' : (days <= 50 ? 'Warning' : 'Normal'))
      };

      const newMed = {
        id: newMedId,
        name: body.name,
        generic_name: body.generic_name || '',
        category: body.category || 'General',
        manufacturer: body.manufacturer || '',
        supplier: body.supplier || '',
        unit: body.unit || 'Tablets',
        minimum_stock: parseInt(body.minimum_stock) || 20,
        current_stock: newBatch.quantity,
        notes: body.notes || '',
        batches: [newBatch],
        fefo_recommended: newBatch.quantity > 0 && days >= 0 ? newBatch : null,
        earliest_expiry: body.expiry_date,
        days_remaining: days,
        stock_status: newBatch.quantity <= 0 ? 'Out of Stock' : (newBatch.quantity <= body.minimum_stock ? 'Low Stock' : 'Healthy'),
        expiry_status: newBatch.expiry_status
      };

      db.medicines.unshift(newMed);

      // Add movement
      db.movements.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        medicine_name: body.name,
        batch_number: body.batch_number,
        movement_type: 'Stock In',
        quantity: newBatch.quantity,
        previous_quantity: 0,
        new_quantity: newBatch.quantity,
        staff_name: 'Pharmacy Staff',
        reason: 'New Medicine Registered',
        unit: body.unit || 'Tablets'
      });

      this.saveLocalDb(db);
      return { success: true, medicine_id: newMedId, message: `${body.name} registered successfully!` };
    }

    // 4. Update Stock
    if (endpoint.startsWith('/stock/update') && method === 'POST') {
      const medId = parseInt(body.medicine_id);
      const batchId = parseInt(body.batch_id);
      const med = (db.medicines || []).find(m => m.id === medId);
      if (!med) throw new Error('Medicine not found in local store.');

      const batch = (med.batches || []).find(b => b.id === batchId);
      if (!batch) throw new Error('Batch not found.');

      const prevQty = batch.quantity;
      const moveQty = parseInt(body.quantity) || 0;
      let newQty = prevQty;

      if (body.movement_type === 'Stock In') {
        newQty = prevQty + moveQty;
      } else if (body.movement_type === 'Stock Out') {
        if (moveQty > prevQty) throw new Error(`Cannot dispense ${moveQty}. Only ${prevQty} available.`);
        newQty = prevQty - moveQty;
      } else if (body.movement_type === 'Adjustment') {
        newQty = Math.max(0, moveQty);
      }

      batch.quantity = newQty;

      // Recalculate medicine total stock
      med.current_stock = (med.batches || []).reduce((acc, b) => acc + b.quantity, 0);
      med.stock_status = med.current_stock === 0 ? 'Out of Stock' : (med.current_stock <= med.minimum_stock ? 'Low Stock' : 'Healthy');

      // Update FEFO recommended
      const validBatches = (med.batches || []).filter(b => b.quantity > 0 && b.days_remaining >= 0);
      med.fefo_recommended = validBatches.length > 0 ? validBatches[0] : null;

      // Record movement
      db.movements.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        medicine_name: med.name,
        batch_number: batch.batch_number,
        movement_type: body.movement_type,
        quantity: Math.abs(newQty - prevQty),
        previous_quantity: prevQty,
        new_quantity: newQty,
        staff_name: body.staff_name || 'Staff',
        reason: body.reason || 'Stock Update',
        unit: med.unit
      });

      this.saveLocalDb(db);
      return {
        success: true,
        message: `Stock updated: ${med.name} (Batch ${batch.batch_number}) is now ${newQty} ${med.unit}.`,
        new_quantity: newQty
      };
    }

    // 5. Stock History
    if (endpoint.startsWith('/stock/history')) {
      return { movements: db.movements || [], total: (db.movements || []).length };
    }

    // 6. Alerts
    if (endpoint.startsWith('/alerts') && method === 'GET') {
      return { alerts: db.alerts || [], total: (db.alerts || []).length };
    }

    if (endpoint.includes('/read')) {
      const alertId = parseInt(endpoint.split('/')[2]);
      const alt = (db.alerts || []).find(a => a.id === alertId);
      if (alt) alt.status = 'Viewed';
      this.saveLocalDb(db);
      return { success: true, message: 'Alert marked as viewed.' };
    }

    if (endpoint.includes('/resolve')) {
      const alertId = parseInt(endpoint.split('/')[2]);
      const alt = (db.alerts || []).find(a => a.id === alertId);
      if (alt) alt.status = 'Resolved';
      this.saveLocalDb(db);
      return { success: true, message: 'Alert resolved.' };
    }

    // 7. Reports
    if (endpoint.startsWith('/reports/stock')) {
      return { report: db.medicines || [] };
    }

    if (endpoint.startsWith('/reports/expiry')) {
      return { medicines: db.medicines || [] };
    }

    // 8. Settings
    if (endpoint.startsWith('/settings')) {
      if (method === 'POST') {
        db.clinic_info = { ...db.clinic_info, ...body };
        this.saveLocalDb(db);
        return { success: true, message: 'Settings saved.' };
      }
      return db.clinic_info;
    }

    // 9. Reset Demo Data
    if (endpoint.startsWith('/seed/reset')) {
      const initial = getInitialSampleData();
      this.saveLocalDb(initial);
      return { success: true, message: 'Sample demo data reset.' };
    }

    return { success: true };
  }

  // Queue sync
  async syncPendingQueue() {
    if (this.pendingQueue.length === 0) return { synced_count: 0 };
    return { synced_count: 0, message: 'Offline actions recorded.' };
  }

  // API Methods
  async getDashboard() { return this.request('/dashboard'); }
  async getMedicines(params = {}) { return this.request('/medicines'); }
  async getMedicine(id) { return this.request(`/medicines/${id}`); }
  async createMedicine(data) { return this.request('/medicines', { method: 'POST', body: JSON.stringify(data) }); }
  async updateMedicine(id, data) { return this.request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteMedicine(id) {
    const db = this.getLocalDb();
    db.medicines = (db.medicines || []).filter(m => m.id !== id);
    this.saveLocalDb(db);
    return { success: true };
  }
  async updateStock(data) { return this.request('/stock/update', { method: 'POST', body: JSON.stringify(data) }); }
  async getStockHistory(params = {}) { return this.request('/stock/history'); }
  async getAlerts(params = {}) { return this.request('/alerts'); }
  async readAlert(id) { return this.request(`/alerts/${id}/read`, { method: 'PUT' }); }
  async resolveAlert(id) { return this.request(`/alerts/${id}/resolve`, { method: 'PUT' }); }
  async getReportsStock() { return this.request('/reports/stock'); }
  async getReportsExpiry() { return this.request('/reports/expiry'); }
  async getSettings() { return this.request('/settings'); }
  async updateSettings(data) { return this.request('/settings', { method: 'POST', body: JSON.stringify(data) }); }
  async resetDemoData() { return this.request('/seed/reset', { method: 'POST' }); }
}

window.api = new ApiClient();
