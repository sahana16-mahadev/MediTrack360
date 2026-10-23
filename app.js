/**
 * MediTrack 360 - Frontend React Application
 * Complete medicine expiry & stock management system for small clinics & rural pharmacies.
 * Modular top-level React components ensuring strict compliance with React Rules of Hooks.
 */

(function () {
  const { createElement: h, useState, useEffect, useMemo, useCallback, useRef } = window.React;

  // Utility helpers
  function formatDate(dStr) {
    if (!dStr) return 'N/A';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dStr;
    }
  }

  function getStatusBadge(status, days) {
    if (status === 'Expired' || (days !== undefined && days < 0)) {
      return h('span', { className: 'badge badge-expired' }, '⚠️ Expired');
    } else if (status === 'Expiring Soon' || (days !== undefined && days <= 30)) {
      return h('span', { className: 'badge badge-expiring' }, `⏳ ${days !== undefined ? days + 'd left' : 'Expiring Soon'}`);
    } else if (status === 'Warning' || (days !== undefined && days <= 50)) {
      return h('span', { className: 'badge badge-warning' }, `⚠️ ${days !== undefined ? days + 'd left' : 'Warning'}`);
    } else if (status === 'Out of Stock') {
      return h('span', { className: 'badge badge-expired' }, '🚫 Out of Stock');
    } else if (status === 'Low Stock') {
      return h('span', { className: 'badge badge-low-stock' }, '📉 Low Stock');
    } else {
      return h('span', { className: 'badge badge-healthy' }, '✓ Healthy');
    }
  }

  // ==========================================
  // VIEW 1: DASHBOARD VIEW
  // ==========================================
  function DashboardView({ dashboardData, clinicInfo, onNavigate, onOpenAddModal, onOpenStockModal }) {
    const s = dashboardData ? dashboardData.summary : {
      total_medicines: 0,
      expiring_soon: 0,
      low_stock: 0,
      out_of_stock: 0,
      total_units: 0,
      expired: 0
    };

    const expDist = dashboardData ? dashboardData.expiry_distribution : {
      expired: 0, range_0_30: 0, range_31_50: 0, range_50_plus: 0
    };

    const fefoList = dashboardData ? dashboardData.fefo_recommendations : [];
    const recentMovements = dashboardData ? dashboardData.recent_activities : [];

    return h('div', { className: 'dashboard-view' },
      // Page Header
      h('div', { className: 'page-header' },
        h('div', { className: 'page-title' },
          h('h2', null, 'Pharmacy Operations Dashboard'),
          h('p', null, `${clinicInfo.clinic_name || 'Clinic Pharmacy'} • Real-time Expiry & Inventory Intelligence`)
        ),
        h('div', { className: 'header-actions' },
          h('button', {
            className: 'btn btn-primary',
            onClick: onOpenAddModal
          }, '➕ Add Medicine'),
          h('button', {
            className: 'btn btn-secondary',
            onClick: () => onOpenStockModal(null, null, 'Stock Out')
          }, '📦 Quick Stock In / Out')
        )
      ),

      // 4 Summary Metrics Cards (Clickable)
      h('div', { className: 'metrics-grid' },
        h('div', {
          className: 'metric-card accent-green',
          onClick: () => onNavigate('medicines', 'All'),
          style: { cursor: 'pointer' },
          title: 'Click to view all registered medicines'
        },
          h('div', { className: 'metric-header' },
            h('span', { className: 'metric-title' }, 'Total Registered'),
            h('div', { className: 'metric-icon-box', style: { background: 'var(--status-green-bg)', color: 'var(--status-green)' } }, '💊')
          ),
          h('div', { className: 'metric-value' }, s.total_medicines),
          h('div', { className: 'metric-subtitle' }, `${s.total_units} total units across active batches`)
        ),

        h('div', {
          className: 'metric-card accent-orange',
          onClick: () => onNavigate('medicines', 'Expiring Soon'),
          style: { cursor: 'pointer' },
          title: 'Click to view medicines expiring within 30 days'
        },
          h('div', { className: 'metric-header' },
            h('span', { className: 'metric-title' }, 'Expiring Soon'),
            h('div', { className: 'metric-icon-box', style: { background: 'var(--status-orange-bg)', color: 'var(--orange-primary)' } }, '⏳')
          ),
          h('div', { className: 'metric-value', style: { color: 'var(--orange-primary)' } }, s.expiring_soon),
          h('div', { className: 'metric-subtitle' }, 'Batches expiring within 30 days (High Priority)')
        ),

        h('div', {
          className: 'metric-card accent-blue',
          onClick: () => onNavigate('medicines', 'Low Stock'),
          style: { cursor: 'pointer' },
          title: 'Click to view medicines at or below minimum safety stock'
        },
          h('div', { className: 'metric-header' },
            h('span', { className: 'metric-title' }, 'Low Stock Warning'),
            h('div', { className: 'metric-icon-box', style: { background: 'var(--status-blue-bg)', color: 'var(--status-blue)' } }, '📉')
          ),
          h('div', { className: 'metric-value', style: { color: 'var(--status-blue)' } }, s.low_stock),
          h('div', { className: 'metric-subtitle' }, 'Medicines below clinic reorder threshold')
        ),

        h('div', {
          className: 'metric-card accent-red',
          onClick: () => onNavigate('medicines', 'Out of Stock'),
          style: { cursor: 'pointer' },
          title: 'Click to view depleted or expired medicines'
        },
          h('div', { className: 'metric-header' },
            h('span', { className: 'metric-title' }, 'Out of Stock / Expired'),
            h('div', { className: 'metric-icon-box', style: { background: 'var(--status-red-bg)', color: 'var(--status-red)' } }, '🚫')
          ),
          h('div', { className: 'metric-value', style: { color: 'var(--status-red)' } }, (s.out_of_stock + s.expired)),
          h('div', { className: 'metric-subtitle' }, `${s.expired} expired batches • ${s.out_of_stock} depleted`)
        )
      ),

      // FEFO Recommendation Feature Card
      fefoList && fefoList.length > 0 && h('div', { className: 'fefo-banner' },
        h('div', { className: 'fefo-icon' }, '⭐'),
        h('div', { className: 'fefo-content', style: { flex: 1 } },
          h('h3', null, 'FEFO (First Expire, First Out) Dispensing Protocol Active'),
          h('p', null,
            `Small clinics prevent medicine spoilage by dispensing earlier-expiring batches first. `,
            h('strong', null, fefoList[0].medicine_name),
            `: Prioritize Batch `,
            h('span', { className: 'badge badge-fefo' }, fefoList[0].recommended_batch.batch_number),
            ` (${fefoList[0].recommended_batch.quantity} ${fefoList[0].unit}, expires in ${fefoList[0].recommended_batch.days_remaining} days) before newer deliveries.`
          ),
          h('div', { style: { marginTop: '8px' } },
            h('button', {
              className: 'btn btn-sm btn-primary',
              onClick: () => onOpenStockModal(fefoList[0].medicine_id, fefoList[0].recommended_batch.batch_id, 'Stock Out')
            }, '⚡ Dispense Recommended Batch')
          )
        )
      ),

      // Expiry Shelf-life Visual Distribution
      h('div', { className: 'card' },
        h('div', { className: 'card-header' },
          h('div', { className: 'card-title' },
            h('span', null, '🕒 Expiry Distribution Overview'),
            h('span', { className: 'badge badge-expiring' }, 'Shelf Life Categorization')
          ),
          h('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'Click any tier to view medicines')
        ),
        h('div', { className: 'shelf-life-grid' },
          h('div', {
            className: 'shelf-box',
            style: { borderColor: 'rgba(239, 68, 68, 0.4)' },
            onClick: () => onNavigate('medicines', 'Expired'),
            title: 'Click to filter Expired medicines'
          },
            h('div', { className: 'shelf-tag', style: { color: 'var(--status-red)' } }, '⛔ Already Expired'),
            h('div', { className: 'shelf-count', style: { color: 'var(--status-red)' } }, expDist.expired),
            h('div', { className: 'shelf-desc' }, 'Quarantined • Safe disposal required')
          ),
          h('div', {
            className: 'shelf-box',
            style: { borderColor: 'rgba(249, 115, 22, 0.4)' },
            onClick: () => onNavigate('medicines', 'Expiring Soon'),
            title: 'Click to filter medicines expiring in 0–30 days'
          },
            h('div', { className: 'shelf-tag', style: { color: 'var(--orange-primary)' } }, '⚡ 0 – 30 Days Left'),
            h('div', { className: 'shelf-count', style: { color: 'var(--orange-primary)' } }, expDist.range_0_30),
            h('div', { className: 'shelf-desc' }, 'Critical shelf life • Dispense immediately')
          ),
          h('div', {
            className: 'shelf-box',
            style: { borderColor: 'rgba(245, 158, 11, 0.4)' },
            onClick: () => onNavigate('medicines', 'Warning'),
            title: 'Click to filter medicines in warning window (31–50 days)'
          },
            h('div', { className: 'shelf-tag', style: { color: 'var(--status-yellow)' } }, '⚠️ 31 – 50 Days Left'),
            h('div', { className: 'shelf-count', style: { color: 'var(--status-yellow)' } }, expDist.range_31_50),
            h('div', { className: 'shelf-desc' }, 'Warning window • Monitor usage trends')
          ),
          h('div', {
            className: 'shelf-box',
            style: { borderColor: 'rgba(16, 185, 129, 0.4)' },
            onClick: () => onNavigate('medicines', 'Available'),
            title: 'Click to filter healthy shelf life stock'
          },
            h('div', { className: 'shelf-tag', style: { color: 'var(--status-green)' } }, '✓ 50+ Days Shelf Life'),
            h('div', { className: 'shelf-count', style: { color: 'var(--status-green)' } }, expDist.range_50_plus),
            h('div', { className: 'shelf-desc' }, 'Healthy shelf life inventory')
          )
        )
      ),

      // Recent Stock Activity & Low Stock Urgency
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' } },
        // Recent Stock Movements
        h('div', { className: 'card' },
          h('div', { className: 'card-header' },
            h('div', { className: 'card-title' },
              h('span', null, '📋 Recent Stock Movements'),
              h('span', { className: 'badge' }, 'Audit Trail')
            ),
            h('button', {
              className: 'btn btn-sm btn-secondary',
              onClick: () => onNavigate('stock')
            }, 'View All')
          ),
          recentMovements && recentMovements.length > 0 ? h('div', { className: 'table-responsive' },
            h('table', { className: 'data-table' },
              h('thead', null,
                h('tr', null,
                  h('th', null, 'Time / Date'),
                  h('th', null, 'Medicine'),
                  h('th', null, 'Action'),
                  h('th', null, 'Qty'),
                  h('th', null, 'Staff')
                )
              ),
              h('tbody', null,
                recentMovements.slice(0, 5).map((m, idx) =>
                  h('tr', { key: idx },
                    h('td', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, formatDate(m.timestamp)),
                    h('td', null,
                      h('strong', null, m.medicine_name),
                      h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, `Batch: ${m.batch_number || 'N/A'}`)
                    ),
                    h('td', null,
                      h('span', {
                        className: `badge ${m.movement_type === 'Stock In' ? 'badge-healthy' : (m.movement_type === 'Stock Out' ? 'badge-expiring' : 'badge-low-stock')}`
                      }, m.movement_type)
                    ),
                    h('td', null,
                      h('span', { style: { fontWeight: '700' } }, `${m.movement_type === 'Stock Out' ? '-' : '+'}${m.quantity} ${m.unit || ''}`)
                    ),
                    h('td', { style: { fontSize: '11px' } }, m.staff_name || 'Staff')
                  )
                )
              )
            )
          ) : h('p', { style: { color: 'var(--text-muted)', fontSize: '13px' } }, 'No recent stock movements recorded.')
        ),

        // Low Stock Urgent Attention
        h('div', { className: 'card' },
          h('div', { className: 'card-header' },
            h('div', { className: 'card-title' },
              h('span', null, '🚨 Low Stock & Reorder Alert'),
              h('span', { className: 'badge badge-low-stock' }, 'Action Needed')
            ),
            h('button', {
              className: 'btn btn-sm btn-secondary',
              onClick: () => onNavigate('reports')
            }, 'Stock Report')
          ),
          dashboardData && dashboardData.low_stock_items && dashboardData.low_stock_items.length > 0 ? h('div', { className: 'table-responsive' },
            h('table', { className: 'data-table' },
              h('thead', null,
                h('tr', null,
                  h('th', null, 'Medicine'),
                  h('th', null, 'Current Stock'),
                  h('th', null, 'Min Level'),
                  h('th', null, 'Action')
                )
              ),
              h('tbody', null,
                dashboardData.low_stock_items.slice(0, 5).map((item, idx) =>
                  h('tr', { key: idx },
                    h('td', null,
                      h('strong', null, item.name),
                      h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, item.generic_name || item.category)
                    ),
                    h('td', null,
                      h('span', {
                        style: {
                          fontWeight: '700',
                          color: item.current_stock === 0 ? 'var(--status-red)' : 'var(--status-blue)'
                        }
                      }, `${item.current_stock} ${item.unit}`),
                      h('div', { style: { fontSize: '10px' } }, getStatusBadge(item.status))
                    ),
                    h('td', { style: { color: 'var(--text-muted)' } }, `${item.minimum_stock} ${item.unit}`),
                    h('td', null,
                      h('button', {
                        className: 'btn btn-sm btn-primary',
                        onClick: () => onOpenStockModal(item.id, null, 'Stock In')
                      }, 'Restock')
                    )
                  )
                )
              )
            )
          ) : h('p', { style: { color: 'var(--text-muted)', fontSize: '13px' } }, 'All medicines are above minimum safety thresholds.')
        )
      )
    );
  }

  // ==========================================
  // VIEW 2: MEDICINES MANAGEMENT VIEW
  // ==========================================
  function MedicinesView({ medicinesData, currentUser, initialFilter, onOpenAddModal, onOpenEditModal, onOpenDetailModal, onOpenStockModal, onDeleteMedicine }) {
    const [filterStatus, setFilterStatus] = useState(initialFilter || 'All');
    const [sortOption, setSortOption] = useState('name');
    const [filterCategory, setFilterCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Sync if initialFilter changes from external navigation
    useEffect(() => {
      if (initialFilter) setFilterStatus(initialFilter);
    }, [initialFilter]);

    const categories = useMemo(() => {
      const set = new Set((medicinesData || []).map(m => m.category).filter(Boolean));
      return Array.from(set);
    }, [medicinesData]);

    const filteredMeds = useMemo(() => {
      let list = [...(medicinesData || [])];

      if (filterStatus === 'Available') {
        list = list.filter(m => m.current_stock > 0);
      } else if (filterStatus === 'Low Stock') {
        list = list.filter(m => m.stock_status === 'Low Stock');
      } else if (filterStatus === 'Out of Stock') {
        list = list.filter(m => m.stock_status === 'Out of Stock');
      } else if (filterStatus === 'Expiring Soon') {
        list = list.filter(m => m.expiry_status === 'Expiring Soon');
      } else if (filterStatus === 'Expired') {
        list = list.filter(m => m.expiry_status === 'Expired');
      } else if (filterStatus === 'Warning') {
        list = list.filter(m => m.expiry_status === 'Warning');
      }

      if (filterCategory) {
        list = list.filter(m => m.category === filterCategory);
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(m =>
          m.name.toLowerCase().includes(q) ||
          (m.generic_name && m.generic_name.toLowerCase().includes(q)) ||
          (m.manufacturer && m.manufacturer.toLowerCase().includes(q)) ||
          (m.batches && m.batches.some(b => b.batch_number.toLowerCase().includes(q)))
        );
      }

      if (sortOption === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortOption === 'name_desc') {
        list.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sortOption === 'expiry') {
        list.sort((a, b) => (a.days_remaining !== undefined ? a.days_remaining : 999) - (b.days_remaining !== undefined ? b.days_remaining : 999));
      } else if (sortOption === 'stock_desc') {
        list.sort((a, b) => b.current_stock - a.current_stock);
      } else if (sortOption === 'stock_asc') {
        list.sort((a, b) => a.current_stock - b.current_stock);
      }

      return list;
    }, [medicinesData, filterStatus, sortOption, filterCategory, searchQuery]);

    return h('div', { className: 'medicines-view' },
      h('div', { className: 'page-header' },
        h('div', { className: 'page-title' },
          h('h2', null, 'Medicine & Batch Directory'),
          h('p', null, 'Complete clinic inventory catalog with FEFO recommendations and expiry tracking.')
        ),
        h('div', { className: 'header-actions' },
          h('button', {
            className: 'btn btn-primary',
            onClick: onOpenAddModal
          }, '➕ Add Medicine')
        )
      ),

      // Filter and Search Bar
      h('div', { className: 'filter-bar' },
        ['All', 'Available', 'Expiring Soon', 'Low Stock', 'Expired', 'Out of Stock'].map(st =>
          h('button', {
            key: st,
            className: `filter-pill ${filterStatus === st ? 'active' : ''}`,
            onClick: () => setFilterStatus(st)
          }, st)
        ),
        h('div', { style: { display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' } },
          h('input', {
            className: 'form-input',
            style: { width: '180px' },
            placeholder: 'Filter medicines...',
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value)
          }),
          h('select', {
            className: 'form-select',
            value: filterCategory,
            onChange: (e) => setFilterCategory(e.target.value)
          },
            h('option', { value: '' }, 'All Categories'),
            categories.map(cat => h('option', { key: cat, value: cat }, cat))
          ),
          h('select', {
            className: 'form-select',
            value: sortOption,
            onChange: (e) => setSortOption(e.target.value)
          },
            h('option', { value: 'name' }, 'Sort by Name (A-Z)'),
            h('option', { value: 'name_desc' }, 'Sort by Name (Z-A)'),
            h('option', { value: 'expiry' }, 'Sort by Expiry (Earliest First)'),
            h('option', { value: 'stock_asc' }, 'Sort by Stock (Low to High)'),
            h('option', { value: 'stock_desc' }, 'Sort by Stock (High to Low)')
          )
        )
      ),

      // Medicines Table
      h('div', { className: 'card' },
        h('div', { className: 'table-responsive' },
          h('table', { className: 'data-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Medicine Name & Generic'),
                h('th', null, 'Category'),
                h('th', null, 'Batch(es) & FEFO Priority'),
                h('th', null, 'Earliest Expiry'),
                h('th', null, 'Current Stock'),
                h('th', null, 'Status'),
                h('th', { style: { textAlign: 'right' } }, 'Actions')
              )
            ),
            h('tbody', null,
              filteredMeds.length > 0 ? filteredMeds.map(med => {
                const hasMultiple = med.batches && med.batches.length > 1;
                return h('tr', { key: med.id },
                  h('td', null,
                    h('div', { style: { fontWeight: '700', fontSize: '14px' } }, med.name),
                    h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, med.generic_name || 'Generic not set')
                  ),
                  h('td', null,
                    h('span', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, med.category)
                  ),
                  h('td', null,
                    med.fefo_recommended ? h('div', null,
                      h('span', { className: 'badge badge-fefo' }, `⭐ FEFO: ${med.fefo_recommended.batch_number}`),
                      hasMultiple && h('div', { style: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' } }, `+ ${med.batches.length - 1} other batch(es)`)
                    ) : (med.batches && med.batches[0] ? h('span', { style: { fontSize: '12px', fontWeight: '600' } }, med.batches[0].batch_number) : 'No Batch')
                  ),
                  h('td', null,
                    h('div', { style: { fontWeight: '600', fontSize: '12px' } }, formatDate(med.earliest_expiry)),
                    h('div', { style: { fontSize: '11px' } },
                      med.days_remaining !== undefined ? (
                        med.days_remaining < 0 ? h('span', { style: { color: 'var(--status-red)', fontWeight: '700' } }, `Expired ${Math.abs(med.days_remaining)}d ago`) :
                        (med.days_remaining <= 30 ? h('span', { style: { color: 'var(--orange-primary)', fontWeight: '700' } }, `⚠️ ${med.days_remaining} days left`) :
                        `${med.days_remaining} days left`)
                      ) : ''
                    )
                  ),
                  h('td', null,
                    h('div', { style: { fontWeight: '700', fontSize: '14px' } }, `${med.current_stock} ${med.unit}`),
                    h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, `Min: ${med.minimum_stock} ${med.unit}`)
                  ),
                  h('td', null,
                    getStatusBadge(med.expiry_status === 'Expired' ? 'Expired' : (med.current_stock === 0 ? 'Out of Stock' : (med.current_stock <= med.minimum_stock ? 'Low Stock' : med.expiry_status)), med.days_remaining)
                  ),
                  h('td', { style: { textAlign: 'right' } },
                    h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' } },
                      h('button', {
                        className: 'btn btn-sm btn-secondary',
                        title: 'View Details & Batches',
                        onClick: () => onOpenDetailModal(med)
                      }, '👁️ View'),
                      h('button', {
                        className: 'btn btn-sm btn-edit',
                        title: 'Edit Medicine Info',
                        onClick: () => onOpenEditModal(med)
                      }, '✏️ Edit'),
                      h('button', {
                        className: 'btn btn-sm btn-primary',
                        title: 'Update Stock',
                        onClick: () => onOpenStockModal(med.id, med.batches && med.batches[0] ? med.batches[0].id : null, 'Stock Out')
                      }, '📦 Stock'),
                      currentUser.role === 'admin' && h('button', {
                        className: 'btn btn-sm btn-danger',
                        title: 'Delete Medicine',
                        onClick: () => onDeleteMedicine(med)
                      }, '🗑️')
                    )
                  )
                );
              }) : h('tr', null,
                h('td', { colSpan: 7, style: { textAlign: 'center', padding: '30px', color: 'var(--text-muted)' } }, 'No medicines found matching the active filters.')
              )
            )
          )
        )
      )
    );
  }

  // ==========================================
  // VIEW 3: STOCK MANAGEMENT VIEW
  // ==========================================
  function StockView({ stockHistoryData, onOpenStockModal }) {
    const [typeFilter, setTypeFilter] = useState('All');
    const [searchFilter, setSearchFilter] = useState('');

    const filteredMovements = useMemo(() => {
      let list = [...(stockHistoryData || [])];
      if (typeFilter !== 'All') {
        list = list.filter(m => m.movement_type === typeFilter);
      }
      if (searchFilter) {
        const q = searchFilter.toLowerCase().trim();
        list = list.filter(m =>
          (m.medicine_name && m.medicine_name.toLowerCase().includes(q)) ||
          (m.batch_number && m.batch_number.toLowerCase().includes(q)) ||
          (m.reason && m.reason.toLowerCase().includes(q)) ||
          (m.staff_name && m.staff_name.toLowerCase().includes(q))
        );
      }
      return list;
    }, [stockHistoryData, typeFilter, searchFilter]);

    return h('div', { className: 'stock-view' },
      h('div', { className: 'page-header' },
        h('div', { className: 'page-title' },
          h('h2', null, 'Stock Management & Audit Movement Trail'),
          h('p', null, 'Record medicine additions, patient dispensations, damaged stock write-offs and physical count adjustments.')
        ),
        h('div', { className: 'header-actions' },
          h('button', {
            className: 'btn btn-primary',
            onClick: () => onOpenStockModal(null, null, 'Stock In')
          }, '➕ Record Stock Transaction')
        )
      ),

      // Quick Stats row
      h('div', { className: 'metrics-grid', style: { marginBottom: '20px' } },
        h('div', { className: 'metric-card accent-green' },
          h('div', { className: 'metric-title' }, 'Total Stock Transactions'),
          h('div', { className: 'metric-value' }, (stockHistoryData || []).length),
          h('div', { className: 'metric-subtitle' }, 'Logged in persistent audit history')
        ),
        h('div', { className: 'metric-card accent-blue' },
          h('div', { className: 'metric-title' }, 'Stock Out / Dispensed'),
          h('div', { className: 'metric-value' }, (stockHistoryData || []).filter(m => m.movement_type === 'Stock Out').length),
          h('div', { className: 'metric-subtitle' }, 'Patient prescriptions fulfilled')
        ),
        h('div', { className: 'metric-card accent-orange' },
          h('div', { className: 'metric-title' }, 'Restock Consignments'),
          h('div', { className: 'metric-value' }, (stockHistoryData || []).filter(m => m.movement_type === 'Stock In').length),
          h('div', { className: 'metric-subtitle' }, 'Depot & supplier intakes')
        )
      ),

      // Movement Filter Bar
      h('div', { className: 'filter-bar' },
        ['All', 'Stock In', 'Stock Out', 'Adjustment'].map(t =>
          h('button', {
            key: t,
            className: `filter-pill ${typeFilter === t ? 'active' : ''}`,
            onClick: () => setTypeFilter(t)
          }, t)
        ),
        h('input', {
          className: 'form-input',
          style: { width: '220px', marginLeft: 'auto' },
          placeholder: 'Search movements...',
          value: searchFilter,
          onChange: (e) => setSearchFilter(e.target.value)
        })
      ),

      // Movements Table
      h('div', { className: 'card' },
        h('div', { className: 'table-responsive' },
          h('table', { className: 'data-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Date & Time'),
                h('th', null, 'Medicine'),
                h('th', null, 'Batch No.'),
                h('th', null, 'Type'),
                h('th', null, 'Quantity Changed'),
                h('th', null, 'Stock Level (Prev → New)'),
                h('th', null, 'Reason / Notes'),
                h('th', null, 'Recorded By')
              )
            ),
            h('tbody', null,
              filteredMovements.length > 0 ? filteredMovements.map(sm =>
                h('tr', { key: sm.id },
                  h('td', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, formatDate(sm.timestamp)),
                  h('td', null,
                    h('strong', null, sm.medicine_name),
                    h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, sm.generic_name || '')
                  ),
                  h('td', null,
                    h('span', { style: { fontFamily: 'monospace', fontWeight: '600' } }, sm.batch_number || 'General')
                  ),
                  h('td', null,
                    h('span', {
                      className: `badge ${sm.movement_type === 'Stock In' ? 'badge-healthy' : (sm.movement_type === 'Stock Out' ? 'badge-expiring' : 'badge-low-stock')}`
                    }, sm.movement_type)
                  ),
                  h('td', null,
                    h('strong', {
                      style: {
                        color: sm.movement_type === 'Stock Out' ? 'var(--status-red)' : (sm.movement_type === 'Stock In' ? 'var(--status-green)' : 'var(--status-blue)')
                      }
                    }, `${sm.movement_type === 'Stock Out' ? '-' : '+'}${sm.quantity} ${sm.unit || ''}`)
                  ),
                  h('td', { style: { fontSize: '12px' } }, `${sm.previous_quantity} → ${sm.new_quantity} ${sm.unit || ''}`),
                  h('td', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, sm.reason || 'General transaction'),
                  h('td', { style: { fontSize: '12px' } }, sm.staff_name || 'Staff')
                )
              ) : h('tr', null,
                h('td', { colSpan: 8, style: { textAlign: 'center', padding: '30px', color: 'var(--text-muted)' } }, 'No stock movements recorded.')
              )
            )
          )
        )
      )
    );
  }

  // ==========================================
  // VIEW 4: EXPIRY ALERTS VIEW
  // ==========================================
  function AlertsView({ alertsData, onReadAlert, onResolveAlert, onOpenStockModal }) {
    const [filterStatus, setFilterStatus] = useState('Active');
    const [filterType, setFilterType] = useState('All');

    const filteredAlerts = useMemo(() => {
      let list = [...(alertsData || [])];
      if (filterStatus !== 'All') {
        list = list.filter(a => a.status === filterStatus);
      }
      if (filterType !== 'All') {
        list = list.filter(a => a.alert_type === filterType);
      }
      return list;
    }, [alertsData, filterStatus, filterType]);

    return h('div', { className: 'alerts-view' },
      h('div', { className: 'page-header' },
        h('div', { className: 'page-title' },
          h('h2', null, 'Medicine Expiry & Quarantine Alert Center'),
          h('p', null, 'Automated alerts prevent expired medicines from reaching patients and notify staff of urgent stock conditions.')
        )
      ),

      // Safety Banner
      h('div', {
        className: 'card',
        style: {
          background: 'rgba(239, 68, 68, 0.08)',
          borderColor: 'rgba(239, 68, 68, 0.35)',
          marginBottom: '20px'
        }
      },
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'flex-start' } },
          h('span', { style: { fontSize: '24px' } }, '🛡️'),
          h('div', null,
            h('h4', { style: { color: 'var(--status-red)', fontSize: '15px', fontWeight: '700', marginBottom: '4px' } }, 'Patient Safety Protocol: Expired Batch Quarantine'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.4' } },
              'Any batch with a negative shelf life is automatically flagged in red and blocked from normal dispensing. Staff must mark expired batches as quarantined and log safe disposal.'
            )
          )
        )
      ),

      // Alert Filter Bar
      h('div', { className: 'filter-bar' },
        h('span', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' } }, 'Status:'),
        ['Active', 'Viewed', 'Resolved', 'All'].map(s =>
          h('button', {
            key: s,
            className: `filter-pill ${filterStatus === s ? 'active' : ''}`,
            onClick: () => setFilterStatus(s)
          }, s)
        ),
        h('span', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginLeft: '14px' } }, 'Type:'),
        ['All', 'Expired', 'Expiring Soon', 'Low Stock', 'Out of Stock'].map(t =>
          h('button', {
            key: t,
            className: `filter-pill ${filterType === t ? 'active' : ''}`,
            onClick: () => setFilterType(t)
          }, t)
        )
      ),

      // Alerts List Table
      h('div', { className: 'card' },
        h('div', { className: 'table-responsive' },
          h('table', { className: 'data-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Alert Type'),
                h('th', null, 'Medicine & Batch'),
                h('th', null, 'Alert Message'),
                h('th', null, 'Shelf Life / Days Remaining'),
                h('th', null, 'Created At'),
                h('th', null, 'Status'),
                h('th', { style: { textAlign: 'right' } }, 'Action')
              )
            ),
            h('tbody', null,
              filteredAlerts.length > 0 ? filteredAlerts.map(alt =>
                h('tr', { key: alt.id },
                  h('td', null,
                    h('span', {
                      className: `badge ${alt.alert_type === 'Expired' ? 'badge-expired' : (alt.alert_type === 'Expiring Soon' ? 'badge-expiring' : 'badge-low-stock')}`
                    }, alt.alert_type)
                  ),
                  h('td', null,
                    h('strong', null, alt.medicine_name),
                    alt.batch_number && h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, `Batch: ${alt.batch_number}`)
                  ),
                  h('td', { style: { fontSize: '13px' } }, alt.message),
                  h('td', null,
                    alt.days_remaining !== null && alt.days_remaining !== undefined ? (
                      alt.days_remaining < 0 ? h('span', { style: { color: 'var(--status-red)', fontWeight: '700' } }, `Expired ${Math.abs(alt.days_remaining)}d ago`) :
                      (alt.days_remaining <= 30 ? h('span', { style: { color: 'var(--orange-primary)', fontWeight: '700' } }, `⚠️ ${alt.days_remaining} days left`) :
                      `${alt.days_remaining} days left`)
                    ) : h('span', { style: { color: 'var(--text-muted)' } }, 'N/A')
                  ),
                  h('td', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, formatDate(alt.created_at)),
                  h('td', null,
                    h('span', {
                      className: `badge ${alt.status === 'Active' ? 'badge-expiring' : (alt.status === 'Viewed' ? 'badge-low-stock' : 'badge-healthy')}`
                    }, alt.status)
                  ),
                  h('td', { style: { textAlign: 'right' } },
                    h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } },
                      alt.status === 'Active' && h('button', {
                        className: 'btn btn-sm btn-secondary',
                        onClick: () => onReadAlert(alt.id)
                      }, 'Mark Viewed'),
                      alt.status !== 'Resolved' && h('button', {
                        className: 'btn btn-sm btn-primary',
                        onClick: () => onResolveAlert(alt.id)
                      }, 'Resolve')
                    )
                  )
                )
              ) : h('tr', null,
                h('td', { colSpan: 7, style: { textAlign: 'center', padding: '30px', color: 'var(--text-muted)' } }, 'No alerts matching the selected criteria.')
              )
            )
          )
        )
      )
    );
  }

  // ==========================================
  // VIEW 5: REPORTS & AUDIT VIEW
  // ==========================================
  function ReportsView({ medicinesData, stockHistoryData, clinicInfo, showToast }) {
    const [reportTab, setReportTab] = useState('stock'); // 'stock', 'expiry', 'movement'
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    const categories = useMemo(() => {
      const set = new Set((medicinesData || []).map(m => m.category).filter(Boolean));
      return Array.from(set);
    }, [medicinesData]);

    // Filtered medicines for stock & expiry reports
    const filteredMeds = useMemo(() => {
      let list = [...(medicinesData || [])];
      if (categoryFilter !== 'All') {
        list = list.filter(m => m.category === categoryFilter);
      }
      if (statusFilter !== 'All') {
        if (statusFilter === 'Healthy') list = list.filter(m => m.stock_status === 'Healthy');
        else if (statusFilter === 'Low Stock') list = list.filter(m => m.stock_status === 'Low Stock');
        else if (statusFilter === 'Out of Stock') list = list.filter(m => m.stock_status === 'Out of Stock');
        else if (statusFilter === 'Expired') list = list.filter(m => m.expiry_status === 'Expired');
      }
      return list;
    }, [medicinesData, categoryFilter, statusFilter]);

    // Filtered movements for movement report
    const filteredMovements = useMemo(() => {
      let list = [...(stockHistoryData || [])];
      if (dateFrom) {
        list = list.filter(m => m.timestamp >= dateFrom);
      }
      if (dateTo) {
        list = list.filter(m => m.timestamp <= dateTo + ' 23:59:59');
      }
      return list;
    }, [stockHistoryData, dateFrom, dateTo]);

    // CSV Exporter
    const handleExportCSV = () => {
      let csvContent = 'data:text/csv;charset=utf-8,';

      if (reportTab === 'stock') {
        csvContent += 'Medicine Name,Generic Name,Category,Unit,Current Stock,Minimum Stock,Status\n';
        filteredMeds.forEach(m => {
          csvContent += `"${m.name}","${m.generic_name || ''}","${m.category}","${m.unit}",${m.current_stock},${m.minimum_stock},"${m.stock_status}"\n`;
        });
      } else if (reportTab === 'expiry') {
        csvContent += 'Medicine,Batch Number,Expiry Date,Days Remaining,Quantity,Unit,Expiry Status\n';
        filteredMeds.forEach(m => {
          (m.batches || []).forEach(b => {
            csvContent += `"${m.name}","${b.batch_number}","${b.expiry_date}",${b.days_remaining || 0},${b.quantity},"${m.unit}","${b.expiry_status}"\n`;
          });
        });
      } else {
        csvContent += 'Date,Medicine,Batch,Action,Quantity,Previous Stock,New Stock,Staff,Reason\n';
        filteredMovements.forEach(sm => {
          csvContent += `"${sm.timestamp}","${sm.medicine_name}","${sm.batch_number || ''}","${sm.movement_type}",${sm.quantity},${sm.previous_quantity},${sm.new_quantity},"${sm.staff_name || ''}","${sm.reason || ''}"\n`;
        });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `MediTrack360_${reportTab}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${reportTab} report to CSV successfully.`);
    };

    return h('div', { className: 'reports-view' },
      h('div', { className: 'page-header' },
        h('div', { className: 'page-title' },
          h('h2', null, 'Clinical Reports & Inventory Audit'),
          h('p', null, 'Generate exportable reports for district health authorities, audits, and reorder planning.')
        ),
        h('div', { className: 'header-actions' },
          h('button', {
            className: 'btn btn-secondary',
            onClick: () => window.print()
          }, '🖨️ Print Report'),
          h('button', {
            className: 'btn btn-primary',
            onClick: handleExportCSV
          }, '📥 Export to CSV')
        )
      ),

      // Tabs
      h('div', { className: 'filter-bar' },
        h('button', {
          className: `filter-pill ${reportTab === 'stock' ? 'active' : ''}`,
          onClick: () => setReportTab('stock')
        }, '📦 Current Stock Inventory Report'),
        h('button', {
          className: `filter-pill ${reportTab === 'expiry' ? 'active' : ''}`,
          onClick: () => setReportTab('expiry')
        }, '⏳ Expiry & Shelf Life Audit Report'),
        h('button', {
          className: `filter-pill ${reportTab === 'movement' ? 'active' : ''}`,
          onClick: () => setReportTab('movement')
        }, '📋 Stock Movement History Report')
      ),

      // Report Specific Filter Controls
      h('div', { className: 'card', style: { padding: '14px 20px', marginBottom: '16px' } },
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' } },
          reportTab === 'movement' ? h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
            h('span', { style: { fontSize: '12px', fontWeight: '600' } }, 'Date Range:'),
            h('input', {
              type: 'date',
              className: 'form-input',
              value: dateFrom,
              onChange: (e) => setDateFrom(e.target.value)
            }),
            h('span', null, 'to'),
            h('input', {
              type: 'date',
              className: 'form-input',
              value: dateTo,
              onChange: (e) => setDateTo(e.target.value)
            }),
            (dateFrom || dateTo) && h('button', {
              className: 'btn btn-sm btn-secondary',
              onClick: () => { setDateFrom(''); setDateTo(''); }
            }, 'Clear')
          ) : h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' } },
            h('span', { style: { fontSize: '12px', fontWeight: '600' } }, 'Filter Category:'),
            h('select', {
              className: 'form-select',
              value: categoryFilter,
              onChange: (e) => setCategoryFilter(e.target.value)
            },
              h('option', { value: 'All' }, 'All Categories'),
              categories.map(c => h('option', { key: c, value: c }, c))
            ),
            h('span', { style: { fontSize: '12px', fontWeight: '600', marginLeft: '10px' } }, 'Status:'),
            h('select', {
              className: 'form-select',
              value: statusFilter,
              onChange: (e) => setStatusFilter(e.target.value)
            },
              h('option', { value: 'All' }, 'All Statuses'),
              h('option', { value: 'Healthy' }, 'Healthy'),
              h('option', { value: 'Low Stock' }, 'Low Stock'),
              h('option', { value: 'Expired' }, 'Expired'),
              h('option', { value: 'Out of Stock' }, 'Out of Stock')
            )
          )
        )
      ),

      // Report Content Card
      h('div', { className: 'card' },
        h('div', { className: 'card-header' },
          h('div', { className: 'card-title' },
            h('span', null, `${clinicInfo.clinic_name || 'Clinic'} — ${reportTab.toUpperCase()} REPORT`),
            h('span', { className: 'badge' }, `Generated: ${new Date().toLocaleDateString()}`)
          )
        ),

        reportTab === 'stock' && h('div', { className: 'table-responsive' },
          h('table', { className: 'data-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Medicine'),
                h('th', null, 'Category'),
                h('th', null, 'Current Stock'),
                h('th', null, 'Minimum Stock'),
                h('th', null, 'Status'),
                h('th', null, 'Reorder Recommendation')
              )
            ),
            h('tbody', null,
              filteredMeds.length > 0 ? filteredMeds.map(m =>
                h('tr', { key: m.id },
                  h('td', null,
                    h('strong', null, m.name),
                    h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, m.generic_name || '')
                  ),
                  h('td', null, m.category),
                  h('td', null,
                    h('strong', null, `${m.current_stock} ${m.unit}`)
                  ),
                  h('td', null, `${m.minimum_stock} ${m.unit}`),
                  h('td', null, getStatusBadge(m.stock_status)),
                  h('td', null,
                    m.current_stock <= m.minimum_stock ?
                      h('span', { style: { color: 'var(--orange-primary)', fontWeight: '700' } }, `Reorder ${Math.max(10, (m.minimum_stock * 2) - m.current_stock)} ${m.unit}`) :
                      h('span', { style: { color: 'var(--text-muted)' } }, 'Adequate stock')
                  )
                )
              ) : h('tr', null,
                h('td', { colSpan: 6, style: { textAlign: 'center', padding: '24px', color: 'var(--text-muted)' } }, 'No medicines found matching the active report filters.')
              )
            )
          )
        ),

        reportTab === 'expiry' && h('div', { className: 'table-responsive' },
          h('table', { className: 'data-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Medicine'),
                h('th', null, 'Batch No.'),
                h('th', null, 'Expiry Date'),
                h('th', null, 'Days Remaining'),
                h('th', null, 'Available Quantity'),
                h('th', null, 'Shelf Life Status')
              )
            ),
            h('tbody', null,
              filteredMeds.flatMap(m =>
                (m.batches || []).map(b =>
                  h('tr', { key: `${m.id}-${b.id}` },
                    h('td', null, h('strong', null, m.name)),
                    h('td', { style: { fontFamily: 'monospace' } }, b.batch_number),
                    h('td', null, formatDate(b.expiry_date)),
                    h('td', null,
                      b.days_remaining !== undefined ? (
                        b.days_remaining < 0 ? h('span', { style: { color: 'var(--status-red)', fontWeight: '700' } }, `Expired ${Math.abs(b.days_remaining)}d ago`) :
                        (b.days_remaining <= 30 ? h('span', { style: { color: 'var(--orange-primary)', fontWeight: '700' } }, `${b.days_remaining}d (Critical)`) :
                        `${b.days_remaining}d`)
                      ) : 'N/A'
                    ),
                    h('td', null, `${b.quantity} ${m.unit}`),
                    h('td', null, getStatusBadge(b.expiry_status, b.days_remaining))
                  )
                )
              )
            )
          )
        ),

        reportTab === 'movement' && h('div', { className: 'table-responsive' },
          h('table', { className: 'data-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Timestamp'),
                h('th', null, 'Medicine'),
                h('th', null, 'Batch'),
                h('th', null, 'Action'),
                h('th', null, 'Quantity Changed'),
                h('th', null, 'Stock Level'),
                h('th', null, 'Staff / User'),
                h('th', null, 'Reason')
              )
            ),
            h('tbody', null,
              filteredMovements.length > 0 ? filteredMovements.map(sm =>
                h('tr', { key: sm.id },
                  h('td', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, formatDate(sm.timestamp)),
                  h('td', null, sm.medicine_name),
                  h('td', { style: { fontFamily: 'monospace' } }, sm.batch_number || 'N/A'),
                  h('td', null,
                    h('span', {
                      className: `badge ${sm.movement_type === 'Stock In' ? 'badge-healthy' : 'badge-expiring'}`
                    }, sm.movement_type)
                  ),
                  h('td', null, `${sm.movement_type === 'Stock Out' ? '-' : '+'}${sm.quantity}`),
                  h('td', null, `${sm.previous_quantity} → ${sm.new_quantity}`),
                  h('td', null, sm.staff_name || 'Staff'),
                  h('td', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, sm.reason || '')
                )
              ) : h('tr', null,
                h('td', { colSpan: 8, style: { textAlign: 'center', padding: '24px', color: 'var(--text-muted)' } }, 'No movements found matching the selected date range.')
              )
            )
          )
        )
      )
    );
  }

  // ==========================================
  // VIEW 6: SETTINGS VIEW
  // ==========================================
  function SettingsView({ clinicInfo, currentUser, isOnline, pendingCount, onSaveSettings, onToggleRole, onSync, onResetDemo }) {
    const [formClinicName, setFormClinicName] = useState(clinicInfo.clinic_name || '');
    const [formLocation, setFormLocation] = useState(clinicInfo.clinic_location || '');
    const [formLicense, setFormLicense] = useState(clinicInfo.license_number || '');
    const [formPhone, setFormPhone] = useState(clinicInfo.contact_phone || '');
    const [expiringThreshold, setExpiringThreshold] = useState(clinicInfo.expiring_soon_days || '30');
    const [warningThreshold, setWarningThreshold] = useState(clinicInfo.warning_days || '50');

    // Update form if clinicInfo changes
    useEffect(() => {
      setFormClinicName(clinicInfo.clinic_name || '');
      setFormLocation(clinicInfo.clinic_location || '');
      setFormLicense(clinicInfo.license_number || '');
      setFormPhone(clinicInfo.contact_phone || '');
      setExpiringThreshold(clinicInfo.expiring_soon_days || '30');
      setWarningThreshold(clinicInfo.warning_days || '50');
    }, [clinicInfo]);

    const handleSubmit = (e) => {
      e.preventDefault();
      onSaveSettings({
        clinic_name: formClinicName,
        clinic_location: formLocation,
        license_number: formLicense,
        contact_phone: formPhone,
        expiring_soon_days: expiringThreshold,
        warning_days: warningThreshold
      });
    };

    return h('div', { className: 'settings-view' },
      h('div', { className: 'page-header' },
        h('div', { className: 'page-title' },
          h('h2', null, 'Clinic Profile & System Configuration'),
          h('p', null, 'Customize clinic details, alert thresholds, user access, and offline data storage.')
        )
      ),

      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' } },
        // Clinic Profile Form
        h('div', { className: 'card' },
          h('div', { className: 'card-header' },
            h('div', { className: 'card-title' }, '🏥 Primary Health Center Profile')
          ),
          h('form', { onSubmit: handleSubmit },
            h('div', { className: 'form-group' },
              h('label', { className: 'form-label' }, 'Clinic / Pharmacy Facility Name'),
              h('input', {
                className: 'form-input',
                style: { width: '100%' },
                value: formClinicName,
                onChange: e => setFormClinicName(e.target.value),
                required: true
              })
            ),
            h('div', { className: 'form-group' },
              h('label', { className: 'form-label' }, 'District / Rural Location'),
              h('input', {
                className: 'form-input',
                style: { width: '100%' },
                value: formLocation,
                onChange: e => setFormLocation(e.target.value)
              })
            ),
            h('div', { className: 'form-grid' },
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Pharmacy License / PHC Code'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  value: formLicense,
                  onChange: e => setFormLicense(e.target.value)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Helpline / Contact Phone'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  value: formPhone,
                  onChange: e => setFormPhone(e.target.value)
                })
              )
            ),

            h('div', { className: 'card-header', style: { marginTop: '16px', marginBottom: '14px' } },
              h('div', { className: 'card-title', style: { fontSize: '14px' } }, '⏱️ Expiry Alert Thresholds')
            ),
            h('div', { className: 'form-grid' },
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Expiring Soon Alert (Days)'),
                h('input', {
                  type: 'number',
                  className: 'form-input',
                  style: { width: '100%' },
                  value: expiringThreshold,
                  onChange: e => setExpiringThreshold(e.target.value)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Warning Horizon (Days)'),
                h('input', {
                  type: 'number',
                  className: 'form-input',
                  style: { width: '100%' },
                  value: warningThreshold,
                  onChange: e => setWarningThreshold(e.target.value)
                })
              )
            ),

            h('div', { style: { marginTop: '18px' } },
              h('button', { type: 'submit', className: 'btn btn-primary' }, '💾 Save Clinic Configuration')
            )
          )
        ),

        // User Access & Offline State
        h('div', null,
          h('div', { className: 'card' },
            h('div', { className: 'card-header' },
              h('div', { className: 'card-title' }, '👤 Role-Based Access Control')
            ),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' } },
              'MediTrack 360 supports separate Administrator and Staff permissions tailored for clinic environments.'
            ),
            h('div', { style: { background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                h('div', null,
                  h('strong', null, currentUser.name),
                  h('div', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, currentUser.email)
                ),
                h('span', { className: `badge ${currentUser.role === 'admin' ? 'badge-fefo' : 'badge-healthy'}` },
                  currentUser.role.toUpperCase()
                )
              )
            ),
            h('button', {
              className: 'btn btn-secondary',
              onClick: onToggleRole
            }, `Switch to ${currentUser.role === 'admin' ? 'Staff' : 'Admin'} Role (Demo)`)
          ),

          // Offline Sync & Local Cache Status
          h('div', { className: 'card' },
            h('div', { className: 'card-header' },
              h('div', { className: 'card-title' }, '📶 Offline Mode & PWA Synchronization')
            ),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' } },
              'Small rural clinics often face power or network cuts. MediTrack 360 caches medicines locally and queues stock transactions when offline.'
            ),
            h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' } },
              h('div', {
                className: `status-pill ${isOnline ? '' : 'offline'}`
              },
                h('span', { className: 'status-dot pulse' }),
                isOnline ? 'Online (Connected)' : 'Offline Mode Active'
              ),
              h('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } },
                `${pendingCount} pending offline update(s)`
              )
            ),
            h('div', { style: { display: 'flex', gap: '10px' } },
              h('button', {
                className: 'btn btn-primary btn-sm',
                disabled: pendingCount === 0 || !isOnline,
                onClick: onSync
              }, '🔄 Sync Offline Queue Now'),
              h('button', {
                className: 'btn btn-danger btn-sm',
                onClick: onResetDemo
              }, '⚠️ Reset Demo Sample Data')
            )
          )
        )
      )
    );
  }

  // ==========================================
  // VIEW 7: LANDING PAGE VIEW
  // ==========================================
  function LandingView({ onNavigate }) {
    return h('div', { className: 'landing-view' },
      h('div', { className: 'landing-hero' },
        h('span', { className: 'landing-tag' }, '🏥 Healthcare Innovation for Rural Health'),
        h('h1', { className: 'landing-title' },
          'MediTrack 360 — ',
          h('span', { style: { color: 'var(--orange-primary)' } }, 'Smart Medicine Expiry & Stock Tracker')
        ),
        h('p', { className: 'landing-subtitle' },
          'Helping small clinics and rural pharmacies manage medicines easily, prevent critical stock shortages, and stop medicine waste.'
        ),
        h('div', { className: 'landing-cta-group' },
          h('button', {
            className: 'btn btn-primary',
            style: { padding: '12px 28px', fontSize: '15px' },
            onClick: () => onNavigate('dashboard')
          }, '🚀 Launch Clinic Dashboard'),
          h('button', {
            className: 'btn btn-secondary',
            style: { padding: '12px 24px', fontSize: '15px' },
            onClick: () => onNavigate('medicines')
          }, '💊 Explore Sample Medicines')
        )
      ),

      // Problem Section
      h('div', { className: 'card', style: { marginTop: '30px' } },
        h('div', { className: 'card-header' },
          h('div', { className: 'card-title', style: { fontSize: '20px' } },
            '❓ Still managing medicines with notebooks and spreadsheets?'
          )
        ),
        h('div', { className: 'landing-grid', style: { marginTop: '0' } },
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon' }, '📖'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Handwritten Registers'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Paper logbooks that take too long to search, degrade over time, and get updated erratically.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon' }, '⏳'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Missed Expiry Dates'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Medicines expiring unnoticed on bottom shelves, resulting in waste and risking accidental dispensing to rural patients.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon' }, '🚫'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Unexpected Shortages'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Critical medicines like antibiotics, ORS, or insulin suddenly running out during clinic emergencies without advance warnings.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon' }, '⏱️'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Time-Consuming Checks'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Pharmacy staff spending hours manually checking every bottle and blister strip instead of serving patients.'
            )
          )
        )
      ),

      // Solution Section
      h('div', { className: 'card' },
        h('div', { className: 'card-header' },
          h('div', { className: 'card-title', style: { fontSize: '20px' } },
            '💡 How MediTrack 360 Solves These Problems'
          )
        ),
        h('div', { className: 'landing-grid', style: { marginTop: '0' } },
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon', style: { color: 'var(--orange-primary)' } }, '🔔'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Dynamic Expiry Alerts'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Categorizes shelf life (0–30 days critical orange, 31–50 days warning yellow, expired red) with automatic quarantine safeguards.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon', style: { color: 'var(--orange-primary)' } }, '⚡'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'FEFO-Based Management'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'First Expire, First Out intelligence automatically recommends earlier-expiring batches to staff for priority patient dispensing.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon', style: { color: 'var(--orange-primary)' } }, '📉'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Low-Stock Warnings'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Real-time threshold alerts and calculated reorder suggestions before critical drugs run out.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { className: 'landing-card-icon', style: { color: 'var(--orange-primary)' } }, '📶'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Offline PWA Capability'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Works smoothly even when the rural clinic loses internet. Caches medicine data and queues stock transactions until reconnection.'
            )
          )
        )
      ),

      // Comparison Table
      h('div', { className: 'card' },
        h('div', { className: 'card-header' },
          h('div', { className: 'card-title', style: { fontSize: '20px' } },
            '⚖️ Existing Market Gap Comparison'
          )
        ),
        h('div', { className: 'comparison-table-wrapper' },
          h('table', { className: 'comparison-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Existing Approach'),
                h('th', null, 'Problem Identified in Practice'),
                h('th', null, 'What MediTrack 360 Delivers')
              )
            ),
            h('tbody', null,
              h('tr', null,
                h('td', null, h('strong', null, 'Paper Registers')),
                h('td', null, 'Hard to update, illegible handwriting, impossible to set automated expiry alarms.'),
                h('td', null, 'Instant digital search, real-time stock balances, and automated expiry alarms.')
              ),
              h('tr', null,
                h('td', null, h('strong', null, 'Excel Spreadsheets')),
                h('td', null, 'Manual data entry, prone to cell overwrites, formula errors, no role permission control.'),
                h('td', null, 'Simple tap-to-update workflows, validated inputs, automated FEFO recommendations.')
              ),
              h('tr', null,
                h('td', null, h('strong', null, 'Complex Pharmacy ERPs')),
                h('td', null, 'Extremely expensive recurring fees, steep learning curves, requires high-spec hardware and constant fast internet.'),
                h('td', null, 'Affordable, designed for non-technical staff, works on low-cost devices and offline.')
              )
            )
          )
        )
      ),

      // Impact Section
      h('div', { className: 'card' },
        h('div', { className: 'card-header' },
          h('div', { className: 'card-title', style: { fontSize: '20px' } },
            '🌱 Real-World Health & Economic Impact'
          )
        ),
        h('div', { className: 'landing-grid', style: { marginTop: '0' } },
          h('div', { className: 'landing-card' },
            h('div', { style: { fontSize: '32px', fontWeight: '800', color: 'var(--status-green)', marginBottom: '4px' } }, '30%–45%'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Reduction in Medicine Waste'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Eliminates expired medicines rotting on shelves through early alerts and FEFO prioritization.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { style: { fontSize: '32px', fontWeight: '800', color: 'var(--orange-primary)', marginBottom: '4px' } }, '4+ Hours'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Saved Per Week'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Pharmacy staff no longer spend full afternoons manually auditing dates and register counts.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { style: { fontSize: '32px', fontWeight: '800', color: 'var(--status-blue)', marginBottom: '4px' } }, 'Zero'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Unexpected Shortages'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Automated minimum stock alerts notify staff in advance to order from central medical supply depots.'
            )
          ),
          h('div', { className: 'landing-card' },
            h('div', { style: { fontSize: '32px', fontWeight: '800', color: 'var(--status-green)', marginBottom: '4px' } }, '100%'),
            h('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '6px' } }, 'Patient Safety Assurance'),
            h('p', { style: { fontSize: '13px', color: 'var(--text-secondary)' } },
              'Strict quarantine rules prevent expired pharmaceuticals from ever reaching rural patients.'
            )
          )
        )
      )
    );
  }

  // ==========================================
  // MODALS
  // ==========================================

  // ADD MEDICINE MODAL
  function AddMedicineModal({ onClose, onSave }) {
    const [name, setName] = useState('');
    const [genericName, setGenericName] = useState('');
    const [category, setCategory] = useState('Antibiotics');
    const [manufacturer, setManufacturer] = useState('');
    const [supplier, setSupplier] = useState('');
    const [unit, setUnit] = useState('Tablets');
    const [minStock, setMinStock] = useState(25);
    const [batchNumber, setBatchNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [quantity, setQuantity] = useState(50);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!name || !batchNumber || !expiryDate) {
        alert('Please fill out medicine name, batch number, and expiry date.');
        return;
      }

      setIsSubmitting(true);
      await onSave({
        name,
        generic_name: genericName,
        category,
        manufacturer,
        supplier,
        unit,
        minimum_stock: minStock,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        quantity: quantity,
        notes
      });
      setIsSubmitting(false);
    };

    return h('div', { className: 'modal-overlay', onClick: onClose },
      h('div', { className: 'modal-content', onClick: e => e.stopPropagation() },
        h('div', { className: 'modal-header' },
          h('h3', null, '➕ Register New Medicine & Opening Batch'),
          h('button', { className: 'modal-close', onClick: onClose }, '✕')
        ),
        h('form', { onSubmit: handleSubmit },
          h('div', { className: 'modal-body' },
            h('div', { className: 'form-grid' },
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Medicine Name ', h('span', { className: 'required' }, '*')),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  placeholder: 'e.g. Paracetamol 650mg',
                  value: name,
                  onChange: e => setName(e.target.value),
                  required: true
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Generic / Chemical Composition'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  placeholder: 'e.g. Acetaminophen',
                  value: genericName,
                  onChange: e => setGenericName(e.target.value)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Therapeutic Category'),
                h('select', {
                  className: 'form-select',
                  style: { width: '100%' },
                  value: category,
                  onChange: e => setCategory(e.target.value)
                },
                  ['Analgesic & Antipyretic', 'Antibiotics', 'Antidiabetic', 'Antihistamine / Allergy', 'Gastrointestinal', 'Electrolyte & Rehydration', 'Respiratory', 'Cardiovascular', 'Vitamins & Supplements'].map(c =>
                    h('option', { key: c, value: c }, c)
                  )
                )
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Dosage Unit'),
                h('select', {
                  className: 'form-select',
                  style: { width: '100%' },
                  value: unit,
                  onChange: e => setUnit(e.target.value)
                },
                  ['Tablets', 'Capsules', 'Syrup Bottles', 'Vials', 'Ampoules', 'Sachets', 'Ointment Tubes'].map(u =>
                    h('option', { key: u, value: u }, u)
                  )
                )
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Manufacturer'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  placeholder: 'e.g. Cipla Ltd.',
                  value: manufacturer,
                  onChange: e => setManufacturer(e.target.value)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Supplier / Depot'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  placeholder: 'e.g. Jan Aushadhi Central Depot',
                  value: supplier,
                  onChange: e => setSupplier(e.target.value)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Initial Batch Number ', h('span', { className: 'required' }, '*')),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  placeholder: 'e.g. PAR2409',
                  value: batchNumber,
                  onChange: e => setBatchNumber(e.target.value),
                  required: true
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Batch Expiry Date ', h('span', { className: 'required' }, '*')),
                h('input', {
                  type: 'date',
                  className: 'form-input',
                  style: { width: '100%' },
                  value: expiryDate,
                  onChange: e => setExpiryDate(e.target.value),
                  required: true
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Initial Quantity Received'),
                h('input', {
                  type: 'number',
                  className: 'form-input',
                  style: { width: '100%' },
                  min: '0',
                  value: quantity,
                  onChange: e => setQuantity(parseInt(e.target.value) || 0)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Minimum Safety Stock Level'),
                h('input', {
                  type: 'number',
                  className: 'form-input',
                  style: { width: '100%' },
                  min: '1',
                  value: minStock,
                  onChange: e => setMinStock(parseInt(e.target.value) || 10)
                })
              ),
              h('div', { className: 'form-group full-width' },
                h('label', { className: 'form-label' }, 'Storage Instructions / Clinical Notes'),
                h('textarea', {
                  className: 'form-textarea',
                  placeholder: 'e.g. Store in cool dark place. Critical fever medicine.',
                  value: notes,
                  onChange: e => setNotes(e.target.value)
                })
              )
            )
          ),
          h('div', { className: 'modal-footer' },
            h('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: onClose
            }, 'Cancel'),
            h('button', {
              type: 'submit',
              className: 'btn btn-primary',
              disabled: isSubmitting
            }, isSubmitting ? 'Saving...' : 'Add Medicine')
          )
        )
      )
    );
  }

  // EDIT MEDICINE MODAL
  function EditMedicineModal({ medicine, onClose, onSave }) {
    const [name, setName] = useState(medicine ? medicine.name : '');
    const [genericName, setGenericName] = useState(medicine ? medicine.generic_name || '' : '');
    const [category, setCategory] = useState(medicine ? medicine.category : 'General');
    const [manufacturer, setManufacturer] = useState(medicine ? medicine.manufacturer || '' : '');
    const [supplier, setSupplier] = useState(medicine ? medicine.supplier || '' : '');
    const [unit, setUnit] = useState(medicine ? medicine.unit : 'Tablets');
    const [minStock, setMinStock] = useState(medicine ? medicine.minimum_stock : 20);
    const [notes, setNotes] = useState(medicine ? medicine.notes || '' : '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!name) {
        alert('Medicine name is required.');
        return;
      }
      setIsSubmitting(true);
      await onSave(medicine.id, {
        name,
        generic_name: genericName,
        category,
        manufacturer,
        supplier,
        unit,
        minimum_stock: minStock,
        notes
      });
      setIsSubmitting(false);
    };

    return h('div', { className: 'modal-overlay', onClick: onClose },
      h('div', { className: 'modal-content', onClick: e => e.stopPropagation() },
        h('div', { className: 'modal-header' },
          h('h3', null, `✏️ Edit Medicine: ${medicine ? medicine.name : ''}`),
          h('button', { className: 'modal-close', onClick: onClose }, '✕')
        ),
        h('form', { onSubmit: handleSubmit },
          h('div', { className: 'modal-body' },
            h('div', { className: 'form-grid' },
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Medicine Name ', h('span', { className: 'required' }, '*')),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  value: name,
                  onChange: e => setName(e.target.value),
                  required: true
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Generic / Chemical Composition'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  value: genericName,
                  onChange: e => setGenericName(e.target.value)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Therapeutic Category'),
                h('select', {
                  className: 'form-select',
                  style: { width: '100%' },
                  value: category,
                  onChange: e => setCategory(e.target.value)
                },
                  ['Analgesic & Antipyretic', 'Antibiotics', 'Antidiabetic', 'Antihistamine / Allergy', 'Gastrointestinal', 'Electrolyte & Rehydration', 'Respiratory', 'Cardiovascular', 'Vitamins & Supplements'].map(c =>
                    h('option', { key: c, value: c }, c)
                  )
                )
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Dosage Unit'),
                h('select', {
                  className: 'form-select',
                  style: { width: '100%' },
                  value: unit,
                  onChange: e => setUnit(e.target.value)
                },
                  ['Tablets', 'Capsules', 'Syrup Bottles', 'Vials', 'Ampoules', 'Sachets', 'Ointment Tubes'].map(u =>
                    h('option', { key: u, value: u }, u)
                  )
                )
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Manufacturer'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  value: manufacturer,
                  onChange: e => setManufacturer(e.target.value)
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Supplier / Depot'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  value: supplier,
                  onChange: e => setSupplier(e.target.value)
                })
              ),
              h('div', { className: 'form-group full-width' },
                h('label', { className: 'form-label' }, 'Minimum Safety Stock Level'),
                h('input', {
                  type: 'number',
                  className: 'form-input',
                  style: { width: '100%' },
                  min: '1',
                  value: minStock,
                  onChange: e => setMinStock(parseInt(e.target.value) || 10)
                })
              ),
              h('div', { className: 'form-group full-width' },
                h('label', { className: 'form-label' }, 'Storage Instructions / Clinical Notes'),
                h('textarea', {
                  className: 'form-textarea',
                  value: notes,
                  onChange: e => setNotes(e.target.value)
                })
              )
            )
          ),
          h('div', { className: 'modal-footer' },
            h('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: onClose
            }, 'Cancel'),
            h('button', {
              type: 'submit',
              className: 'btn btn-primary',
              disabled: isSubmitting
            }, isSubmitting ? 'Saving...' : 'Save Changes')
          )
        )
      )
    );
  }

  // STOCK UPDATE MODAL
  function StockUpdateModal({ initialMedicineId, initialBatchId, initialAction, medicinesData, currentUser, onClose, onSave }) {
    const [selMedId, setSelMedId] = useState(initialMedicineId || (medicinesData[0] ? medicinesData[0].id : null));
    const [selBatchId, setSelBatchId] = useState(initialBatchId || null);
    const [movementType, setMovementType] = useState(initialAction || 'Stock Out');
    const [quantity, setQuantity] = useState(5);
    const [reason, setReason] = useState(initialAction === 'Stock In' ? 'Fresh Consignment Received' : 'Prescription Dispense to Patient');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentMed = useMemo(() => {
      return (medicinesData || []).find(m => m.id === parseInt(selMedId)) || (medicinesData ? medicinesData[0] : null);
    }, [selMedId, medicinesData]);

    const batches = useMemo(() => {
      return currentMed && currentMed.batches ? currentMed.batches : [];
    }, [currentMed]);

    useEffect(() => {
      if (batches.length > 0 && !selBatchId) {
        setSelBatchId(batches[0].id);
      }
    }, [batches, selBatchId]);

    const selectedBatch = useMemo(() => {
      return batches.find(b => b.id === parseInt(selBatchId)) || batches[0];
    }, [batches, selBatchId]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!selectedBatch) {
        alert('No batch selected.');
        return;
      }

      if (movementType === 'Stock Out' && selectedBatch.days_remaining !== undefined && selectedBatch.days_remaining < 0) {
        if (!confirm(`WARNING: Batch ${selectedBatch.batch_number} is EXPIRED (${selectedBatch.expiry_date})! Are you sure you are recording a waste/quarantine disposal? DO NOT dispense to a patient.`)) {
          return;
        }
      }

      setIsSubmitting(true);
      await onSave({
        medicine_id: currentMed.id,
        batch_id: selectedBatch.id,
        movement_type: movementType,
        quantity: quantity,
        reason: reason,
        staff_name: currentUser.name,
        user_id: currentUser.id
      });
      setIsSubmitting(false);
    };

    return h('div', { className: 'modal-overlay', onClick: onClose },
      h('div', { className: 'modal-content', onClick: e => e.stopPropagation() },
        h('div', { className: 'modal-header' },
          h('h3', null, '📦 Record Stock Movement / Dispense'),
          h('button', { className: 'modal-close', onClick: onClose }, '✕')
        ),
        h('form', { onSubmit: handleSubmit },
          h('div', { className: 'modal-body' },
            h('div', { className: 'form-group' },
              h('label', { className: 'form-label' }, 'Select Medicine'),
              h('select', {
                className: 'form-select',
                style: { width: '100%' },
                value: selMedId || '',
                onChange: e => {
                  setSelMedId(e.target.value);
                  setSelBatchId(null);
                }
              },
                (medicinesData || []).map(m =>
                  h('option', { key: m.id, value: m.id }, `${m.name} (${m.current_stock} ${m.unit} in stock)`)
                )
              )
            ),

            h('div', { className: 'form-group' },
              h('label', { className: 'form-label' }, 'Select Batch (FEFO Recommended)'),
              batches.length > 0 ? h('select', {
                className: 'form-select',
                style: { width: '100%' },
                value: selBatchId || (batches[0] ? batches[0].id : ''),
                onChange: e => setSelBatchId(e.target.value)
              },
                batches.map((b, idx) =>
                  h('option', { key: b.id, value: b.id },
                    `Batch ${b.batch_number} — Exp: ${formatDate(b.expiry_date)} (${b.days_remaining}d left) — Qty: ${b.quantity} ${currentMed ? currentMed.unit : ''} ${idx === 0 ? '⭐ [EARLIEST EXPIRY]' : ''}`
                  )
                )
              ) : h('p', { style: { color: 'var(--status-red)', fontSize: '13px' } }, 'No batches registered for this medicine.')
            ),

            h('div', { className: 'form-group' },
              h('label', { className: 'form-label' }, 'Movement Action'),
              h('div', { style: { display: 'flex', gap: '10px' } },
                ['Stock Out', 'Stock In', 'Adjustment'].map(act =>
                  h('button', {
                    type: 'button',
                    key: act,
                    className: `btn ${movementType === act ? 'btn-primary' : 'btn-secondary'} btn-sm`,
                    onClick: () => {
                      setMovementType(act);
                      if (act === 'Stock Out') setReason('Prescription Dispense to Patient');
                      else if (act === 'Stock In') setReason('Fresh Consignment Received');
                      else setReason('Physical Count Adjustment');
                    }
                  }, act === 'Stock Out' ? '➖ Dispense (Stock Out)' : (act === 'Stock In' ? '➕ Intake (Stock In)' : '⚖️ Adjust Quantity'))
                )
              )
            ),

            h('div', { className: 'form-grid' },
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' },
                  movementType === 'Adjustment' ? 'New Target Quantity' : 'Quantity Units'
                ),
                h('input', {
                  type: 'number',
                  className: 'form-input',
                  style: { width: '100%' },
                  min: '1',
                  value: quantity,
                  onChange: e => setQuantity(parseInt(e.target.value) || 1),
                  required: true
                })
              ),
              h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Staff Member Dispensing'),
                h('input', {
                  className: 'form-input',
                  style: { width: '100%' },
                  value: currentUser.name,
                  readOnly: true
                })
              )
            ),

            h('div', { className: 'form-group' },
              h('label', { className: 'form-label' }, 'Transaction Reason / Prescription Reference'),
              h('input', {
                className: 'form-input',
                style: { width: '100%' },
                value: reason,
                onChange: e => setReason(e.target.value),
                required: true
              })
            )
          ),
          h('div', { className: 'modal-footer' },
            h('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: onClose
            }, 'Cancel'),
            h('button', {
              type: 'submit',
              className: 'btn btn-primary',
              disabled: isSubmitting || !selectedBatch
            }, isSubmitting ? 'Saving...' : 'Confirm Stock Transaction')
          )
        )
      )
    );
  }

  // MEDICINE DETAIL MODAL
  function MedicineDetailModal({ medicine, onClose, onOpenEdit, onOpenStock }) {
    if (!medicine) return null;

    return h('div', { className: 'modal-overlay', onClick: onClose },
      h('div', { className: 'modal-content', style: { maxWidth: '720px' }, onClick: e => e.stopPropagation() },
        h('div', { className: 'modal-header' },
          h('div', null,
            h('h3', null, medicine.name),
            h('p', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, medicine.generic_name || 'Generic not specified')
          ),
          h('button', { className: 'modal-close', onClick: onClose }, '✕')
        ),
        h('div', { className: 'modal-body' },
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' } },
            h('div', { style: { background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' } },
              h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'CATEGORY'),
              h('div', { style: { fontWeight: '600', fontSize: '13px' } }, medicine.category)
            ),
            h('div', { style: { background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' } },
              h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'TOTAL STOCK'),
              h('div', { style: { fontWeight: '700', fontSize: '14px', color: 'var(--orange-primary)' } }, `${medicine.current_stock} ${medicine.unit}`)
            ),
            h('div', { style: { background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' } },
              h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'MINIMUM LEVEL'),
              h('div', { style: { fontWeight: '600', fontSize: '13px' } }, `${medicine.minimum_stock} ${medicine.unit}`)
            ),
            h('div', { style: { background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' } },
              h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'MANUFACTURER'),
              h('div', { style: { fontWeight: '600', fontSize: '13px' } }, medicine.manufacturer || 'N/A')
            )
          ),

          h('h4', { style: { fontSize: '14px', fontWeight: '700', marginBottom: '10px' } }, 'Active Batches & Expiry Countdown'),
          h('div', { className: 'table-responsive', style: { marginBottom: '20px' } },
            h('table', { className: 'data-table' },
              h('thead', null,
                h('tr', null,
                  h('th', null, 'Batch No.'),
                  h('th', null, 'Expiry Date'),
                  h('th', null, 'Days Remaining'),
                  h('th', null, 'Stock Qty'),
                  h('th', null, 'FEFO Priority'),
                  h('th', null, 'Action')
                )
              ),
              h('tbody', null,
                (medicine.batches || []).map((b, idx) =>
                  h('tr', { key: b.id },
                    h('td', { style: { fontFamily: 'monospace', fontWeight: '700' } }, b.batch_number),
                    h('td', null, formatDate(b.expiry_date)),
                    h('td', null,
                      b.days_remaining !== undefined ? (
                        b.days_remaining < 0 ? h('span', { style: { color: 'var(--status-red)', fontWeight: '700' } }, `Expired ${Math.abs(b.days_remaining)}d ago`) :
                        (b.days_remaining <= 30 ? h('span', { style: { color: 'var(--orange-primary)', fontWeight: '700' } }, `${b.days_remaining} days left`) :
                        `${b.days_remaining} days left`)
                      ) : 'N/A'
                    ),
                    h('td', null, `${b.quantity} ${medicine.unit}`),
                    h('td', null,
                      idx === 0 && b.quantity > 0 && b.days_remaining >= 0 ?
                        h('span', { className: 'badge badge-fefo' }, '⭐ Recommended Batch') :
                        (b.days_remaining < 0 ? h('span', { className: 'badge badge-expired' }, '⛔ Quarantined') : 'Standard')
                    ),
                    h('td', null,
                      h('button', {
                        className: 'btn btn-sm btn-primary',
                        onClick: () => {
                          onClose();
                          onOpenStock(medicine.id, b.id, 'Stock Out');
                        }
                      }, 'Update Stock')
                    )
                  )
                )
              )
            )
          ),

          medicine.notes && h('div', { style: { background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '13px' } },
            h('strong', null, 'Clinical Notes: '),
            medicine.notes
          )
        ),
        h('div', { className: 'modal-footer' },
          h('button', {
            className: 'btn btn-edit',
            onClick: () => {
              onClose();
              onOpenEdit(medicine);
            }
          }, '✏️ Edit Medicine Details'),
          h('button', {
            className: 'btn btn-secondary',
            onClick: onClose
          }, 'Close')
        )
      )
    );
  }

  // NOTIFICATION DROPDOWN PANEL
  function NotificationPanelModal({ alerts, onClose, onNavigate, onReadAlert, onResolveAlert }) {
    const unread = (alerts || []).filter(a => a.status === 'Active');

    return h('div', { className: 'notification-dropdown', onClick: e => e.stopPropagation() },
      h('div', { className: 'notification-header' },
        h('strong', null, `Notifications (${unread.length} Active)`),
        h('button', { className: 'modal-close', onClick: onClose }, '✕')
      ),
      h('div', { className: 'notification-list' },
        unread.length > 0 ? unread.slice(0, 6).map(alt =>
          h('div', { key: alt.id, className: 'notification-item unread' },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              h('span', {
                className: `badge ${alt.alert_type === 'Expired' ? 'badge-expired' : (alt.alert_type === 'Expiring Soon' ? 'badge-expiring' : 'badge-low-stock')}`
              }, alt.alert_type),
              h('span', { style: { fontSize: '10px', color: 'var(--text-muted)' } }, formatDate(alt.created_at))
            ),
            h('div', { style: { fontSize: '12px', color: 'var(--text-primary)', marginTop: '4px' } }, alt.message),
            h('div', { style: { display: 'flex', gap: '6px', marginTop: '6px' } },
              h('button', {
                className: 'btn btn-sm btn-secondary',
                style: { padding: '2px 8px', fontSize: '10px' },
                onClick: () => onReadAlert(alt.id)
              }, 'Mark Viewed'),
              h('button', {
                className: 'btn btn-sm btn-primary',
                style: { padding: '2px 8px', fontSize: '10px' },
                onClick: () => onResolveAlert(alt.id)
              }, 'Resolve')
            )
          )
        ) : h('div', { style: { padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' } },
          'No active notifications right now.'
        )
      ),
      h('div', { className: 'notification-footer' },
        h('button', {
          className: 'btn btn-sm btn-primary',
          style: { width: '100%' },
          onClick: () => {
            onClose();
            onNavigate('alerts');
          }
        }, 'View All in Alert Center →')
      )
    );
  }

  // GLOBAL SEARCH MODAL
  function SearchModal({ medicinesData, onClose, onSelectMedicine }) {
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
      const q = query.toLowerCase().trim();
      if (!q) return medicinesData || [];
      return (medicinesData || []).filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.generic_name && m.generic_name.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q)) ||
        (m.batches && m.batches.some(b => b.batch_number.toLowerCase().includes(q)))
      );
    }, [medicinesData, query]);

    return h('div', { className: 'modal-overlay', onClick: onClose },
      h('div', { className: 'modal-content', style: { maxWidth: '650px' }, onClick: e => e.stopPropagation() },
        h('div', { className: 'modal-header' },
          h('h3', null, '🔍 Global Medicine & Batch Search'),
          h('button', { className: 'modal-close', onClick: onClose }, '✕')
        ),
        h('div', { className: 'modal-body' },
          h('div', { className: 'search-container', style: { marginBottom: '18px' } },
            h('span', { className: 'search-icon' }, '🔍'),
            h('input', {
              className: 'search-input',
              autoFocus: true,
              placeholder: 'Type medicine name, generic chemical, or batch code...',
              value: query,
              onChange: e => setQuery(e.target.value)
            })
          ),

          h('div', { style: { maxHeight: '350px', overflowY: 'auto' } },
            results.length > 0 ? results.map(med =>
              h('div', {
                key: med.id,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer'
                },
                onClick: () => onSelectMedicine(med)
              },
                h('div', null,
                  h('div', { style: { fontWeight: '700', fontSize: '14px' } }, med.name),
                  h('div', { style: { fontSize: '11px', color: 'var(--text-muted)' } },
                    `${med.generic_name || 'Generic'} • ${med.category} • Batches: ${med.batches ? med.batches.map(b => b.batch_number).join(', ') : 'None'}`
                  )
                ),
                h('div', { style: { textAlign: 'right' } },
                  h('div', { style: { fontWeight: '700', fontSize: '13px', color: 'var(--orange-primary)' } }, `${med.current_stock} ${med.unit}`),
                  getStatusBadge(med.stock_status, med.days_remaining)
                )
              )
            ) : h('p', { style: { color: 'var(--text-muted)', textAlign: 'center', padding: '20px' } },
              `No medicine or batch found matching "${query}".`
            )
          )
        )
      )
    );
  }

  // ==========================================
  // MAIN ORCHESTRATOR APP
  // ==========================================
  function MediTrackApp() {
    // Determine initial view from URL hash if available (e.g. #medicines, #stock)
    const getInitialView = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const valid = ['dashboard', 'medicines', 'stock', 'alerts', 'reports', 'settings', 'landing'];
      return valid.includes(hash) ? hash : 'dashboard';
    };

    const [currentView, setCurrentView] = useState(getInitialView);
    const [initialFilter, setInitialFilter] = useState('All');
    const [theme, setTheme] = useState(localStorage.getItem('meditrack_theme') || 'dark');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);

    // Current user state
    const [currentUser, setCurrentUser] = useState({
      id: 1,
      name: 'Dr. Ananya Sharma',
      email: 'admin@meditrack.org',
      role: 'admin'
    });

    // Modals
    const [activeModal, setActiveModal] = useState(null); // 'add_medicine', 'edit_medicine', 'stock_update', 'medicine_detail', 'search'
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [stockModalMedId, setStockModalMedId] = useState(null);
    const [stockModalBatchId, setStockModalBatchId] = useState(null);
    const [stockModalAction, setStockModalAction] = useState('Stock Out');
    const [toastMessage, setToastMessage] = useState(null);

    // Core data cache
    const [dashboardData, setDashboardData] = useState(null);
    const [medicinesData, setMedicinesData] = useState([]);
    const [alertsData, setAlertsData] = useState([]);
    const [stockHistoryData, setStockHistoryData] = useState([]);
    const [clinicInfo, setClinicInfo] = useState({
      clinic_name: 'Rampur Primary Health Center & Rural Pharmacy',
      clinic_location: 'District Hospital Sector 4, Rural Zone',
      license_number: 'PHC-RMP-2024-8891',
      contact_phone: '+91 98765 43210',
      expiring_soon_days: '30',
      warning_days: '50'
    });

    // Sync currentView with browser URL hash
    useEffect(() => {
      window.location.hash = '#' + currentView;
    }, [currentView]);

    // Listen to hashchange for browser back/forward buttons
    useEffect(() => {
      const onHashChange = () => {
        const hash = window.location.hash.replace('#', '').trim();
        const valid = ['dashboard', 'medicines', 'stock', 'alerts', 'reports', 'settings', 'landing'];
        if (valid.includes(hash)) {
          setCurrentView(hash);
        }
      };
      window.addEventListener('hashchange', onHashChange);
      return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // Theme effect
    useEffect(() => {
      if (theme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
      localStorage.setItem('meditrack_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

    // Network status
    useEffect(() => {
      const unsub = window.api.subscribeNetworkStatus((online, count) => {
        setIsOnline(online);
        setPendingCount(count);
      });
      return unsub;
    }, []);

    // Load initial data from API / Local
    const refreshData = useCallback(async () => {
      try {
        const dash = await window.api.getDashboard();
        if (dash) {
          setDashboardData(dash);
          if (dash.clinic_info) setClinicInfo(dash.clinic_info);
        }

        const meds = await window.api.getMedicines();
        if (meds && meds.medicines) setMedicinesData(meds.medicines);

        const alts = await window.api.getAlerts();
        if (alts && alts.alerts) setAlertsData(alts.alerts);

        const hist = await window.api.getStockHistory();
        if (hist && hist.movements) setStockHistoryData(hist.movements);
      } catch (err) {
        console.warn('Data fetch warning:', err);
      }
    }, []);

    useEffect(() => {
      refreshData();
    }, [refreshData]);

    const showToast = (msg, duration = 3500) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), duration);
    };

    const handleSync = async () => {
      showToast('Syncing offline data with server...');
      const res = await window.api.syncPendingQueue();
      showToast(res.message || `Synced ${res.synced_count} records successfully.`);
      refreshData();
    };

    const toggleUserRole = () => {
      if (currentUser.role === 'admin') {
        setCurrentUser({ id: 2, name: 'Rajesh Patel', email: 'staff@meditrack.org', role: 'staff' });
        showToast('Switched role: Pharmacy Staff (Restricted Admin actions)');
      } else {
        setCurrentUser({ id: 1, name: 'Dr. Ananya Sharma', email: 'admin@meditrack.org', role: 'admin' });
        showToast('Switched role: Clinic Administrator (Full Permissions)');
      }
    };

    // Navigation handler
    const navigateTo = (view, filter = 'All') => {
      setCurrentView(view);
      setInitialFilter(filter);
      setSidebarOpen(false);
      setNotificationOpen(false);
      window.scrollTo(0, 0);
    };

    // Modal triggers
    const openAddModal = () => setActiveModal('add_medicine');

    const openEditModal = (med) => {
      setSelectedMedicine(med);
      setActiveModal('edit_medicine');
    };

    const openDetailModal = (med) => {
      setSelectedMedicine(med);
      setActiveModal('medicine_detail');
    };

    const openStockModal = (medId, batchId, action = 'Stock Out') => {
      setStockModalMedId(medId);
      setStockModalBatchId(batchId);
      setStockModalAction(action);
      setActiveModal('stock_update');
    };

    // Modal submit actions
    const handleSaveAddMedicine = async (medData) => {
      try {
        const res = await window.api.createMedicine(medData);
        showToast(res.message || 'Medicine registered successfully!');
        setActiveModal(null);
        refreshData();
      } catch (err) {
        alert(`Error saving medicine: ${err.message}`);
      }
    };

    const handleSaveEditMedicine = async (medId, medData) => {
      try {
        const res = await window.api.updateMedicine(medId, medData);
        showToast(res.message || 'Medicine details updated successfully!');
        setActiveModal(null);
        refreshData();
      } catch (err) {
        alert(`Error updating medicine: ${err.message}`);
      }
    };

    const handleSaveStockUpdate = async (stockData) => {
      try {
        const res = await window.api.updateStock(stockData);
        showToast(res.message || 'Stock updated successfully!');
        setActiveModal(null);
        refreshData();
      } catch (err) {
        alert(`Error updating stock: ${err.message}`);
      }
    };

    const handleDeleteMedicine = async (med) => {
      if (confirm(`Are you sure you want to delete ${med.name}? All associated batches and records will be removed.`)) {
        await window.api.deleteMedicine(med.id);
        showToast(`Deleted ${med.name}.`);
        refreshData();
      }
    };

    const handleReadAlert = async (id) => {
      await window.api.readAlert(id);
      showToast('Alert marked as viewed.');
      refreshData();
    };

    const handleResolveAlert = async (id) => {
      await window.api.resolveAlert(id);
      showToast('Alert marked as resolved.');
      refreshData();
    };

    const handleSaveSettings = async (payload) => {
      await window.api.updateSettings(payload);
      setClinicInfo(payload);
      showToast('Clinic configuration saved.');
      refreshData();
    };

    const handleResetDemo = async () => {
      if (confirm('Reset all demo medicines, batches and stock movements to default state?')) {
        await window.api.resetDemoData();
        showToast('Demo data re-initialized successfully.');
        refreshData();
      }
    };

    // Nav Items
    const navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'medicines', label: 'Medicines', icon: '💊', badge: (medicinesData || []).length },
      { id: 'stock', label: 'Stock Manager', icon: '📦' },
      {
        id: 'alerts',
        label: 'Expiry Alerts',
        icon: '⚠️',
        badge: (alertsData || []).filter(a => a.status === 'Active').length,
        danger: true
      },
      { id: 'reports', label: 'Reports & Export', icon: '📈' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
      { id: 'landing', label: 'About MediTrack', icon: '🌐' }
    ];

    return h('div', { className: 'app-container' },
      // SIDEBAR
      h('aside', { className: `sidebar ${sidebarOpen ? 'open' : ''}` },
        // Brand Header
        h('div', { className: 'brand-section', onClick: () => navigateTo('landing'), style: { cursor: 'pointer' } },
          h('div', { className: 'brand-icon' }, '+'),
          h('div', { className: 'brand-text' },
            h('h1', null, 'MediTrack 360'),
            h('span', null, 'Stock & Expiry')
          )
        ),

        // Navigation Links
        h('nav', { className: 'sidebar-nav' },
          navItems.map(item =>
            h('div', {
              key: item.id,
              className: `nav-link ${currentView === item.id ? 'active' : ''}`,
              onClick: () => navigateTo(item.id)
            },
              h('span', null, item.icon),
              h('span', null, item.label),
              item.badge !== undefined && item.badge > 0 && h('span', {
                className: `nav-badge ${item.danger ? 'danger' : ''}`
              }, item.badge)
            )
          )
        ),

        // Sidebar Footer
        h('div', { className: 'sidebar-footer' },
          h('div', { className: 'clinic-badge' },
            h('strong', null, clinicInfo.clinic_name || 'Clinic Facility'),
            h('span', null, clinicInfo.clinic_location || 'Rural Health Center')
          )
        )
      ),

      // MAIN WRAPPER
      h('div', { className: 'main-wrapper' },
        // Top Header
        h('header', { className: 'top-header' },
          // Header Left
          h('div', { className: 'header-left' },
            h('button', {
              className: 'mobile-toggle',
              onClick: () => setSidebarOpen(o => !o)
            }, '☰'),
            h('div', { className: 'search-container', onClick: () => setActiveModal('search'), style: { cursor: 'pointer' } },
              h('span', { className: 'search-icon' }, '🔍'),
              h('input', {
                className: 'search-input',
                placeholder: 'Quick search medicine, generic, or batch...',
                readOnly: true
              })
            )
          ),

          // Header Right
          h('div', { className: 'header-right' },
            // Status Pill
            h('div', {
              className: `status-pill ${isOnline ? '' : 'offline'}`,
              title: isOnline ? 'Connected to database' : 'Offline Mode: Local Storage active',
              onClick: !isOnline || pendingCount > 0 ? handleSync : undefined
            },
              h('span', { className: 'status-dot pulse' }),
              isOnline ? (pendingCount > 0 ? `Sync (${pendingCount})` : 'Online') : `Offline (${pendingCount})`
            ),

            // Theme Toggle
            h('button', {
              className: 'btn-icon',
              title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
              onClick: toggleTheme
            }, theme === 'dark' ? '☀️' : '🌙'),

            // Notification Bell with Dropdown
            h('div', { style: { position: 'relative' } },
              h('button', {
                className: 'btn-icon',
                title: 'View Expiry & Stock Alerts',
                onClick: () => setNotificationOpen(o => !o)
              },
                '🔔',
                (alertsData || []).filter(a => a.status === 'Active').length > 0 && h('span', { className: 'bell-badge' },
                  (alertsData || []).filter(a => a.status === 'Active').length
                )
              ),
              notificationOpen && h(NotificationPanelModal, {
                alerts: alertsData,
                onClose: () => setNotificationOpen(false),
                onNavigate: navigateTo,
                onReadAlert: handleReadAlert,
                onResolveAlert: handleResolveAlert
              })
            ),

            // User Profile Menu
            h('div', {
              className: 'user-profile-menu',
              title: 'Click to switch between Admin and Staff role',
              onClick: toggleUserRole
            },
              h('div', { className: `user-avatar ${currentUser.role}` }, currentUser.role === 'admin' ? 'DR' : 'RP'),
              h('div', { className: 'user-details' },
                h('span', { className: 'user-name' }, currentUser.name),
                h('span', { className: 'user-role' }, `${currentUser.role} (Demo Switch)`)
              )
            )
          )
        ),

        // Main Content Router (Pure function components with isolated hooks)
        h('main', { className: 'content-area' },
          currentView === 'dashboard' && h(DashboardView, {
            dashboardData,
            clinicInfo,
            onNavigate: navigateTo,
            onOpenAddModal: openAddModal,
            onOpenStockModal: openStockModal
          }),
          currentView === 'medicines' && h(MedicinesView, {
            medicinesData,
            currentUser,
            initialFilter,
            onOpenAddModal: openAddModal,
            onOpenEditModal: openEditModal,
            onOpenDetailModal: openDetailModal,
            onOpenStockModal: openStockModal,
            onDeleteMedicine: handleDeleteMedicine
          }),
          currentView === 'stock' && h(StockView, {
            stockHistoryData,
            onOpenStockModal: openStockModal
          }),
          currentView === 'alerts' && h(AlertsView, {
            alertsData,
            onReadAlert: handleReadAlert,
            onResolveAlert: handleResolveAlert,
            onOpenStockModal: openStockModal
          }),
          currentView === 'reports' && h(ReportsView, {
            medicinesData,
            stockHistoryData,
            clinicInfo,
            showToast
          }),
          currentView === 'settings' && h(SettingsView, {
            clinicInfo,
            currentUser,
            isOnline,
            pendingCount,
            onSaveSettings: handleSaveSettings,
            onToggleRole: toggleUserRole,
            onSync: handleSync,
            onResetDemo: handleResetDemo
          }),
          currentView === 'landing' && h(LandingView, {
            onNavigate: navigateTo
          })
        )
      ),

      // Modals
      activeModal === 'add_medicine' && h(AddMedicineModal, {
        onClose: () => setActiveModal(null),
        onSave: handleSaveAddMedicine
      }),

      activeModal === 'edit_medicine' && h(EditMedicineModal, {
        medicine: selectedMedicine,
        onClose: () => setActiveModal(null),
        onSave: handleSaveEditMedicine
      }),

      activeModal === 'stock_update' && h(StockUpdateModal, {
        initialMedicineId: stockModalMedId,
        initialBatchId: stockModalBatchId,
        initialAction: stockModalAction,
        medicinesData: medicinesData,
        currentUser: currentUser,
        onClose: () => setActiveModal(null),
        onSave: handleSaveStockUpdate
      }),

      activeModal === 'medicine_detail' && h(MedicineDetailModal, {
        medicine: selectedMedicine,
        onClose: () => setActiveModal(null),
        onOpenEdit: openEditModal,
        onOpenStock: openStockModal
      }),

      activeModal === 'search' && h(SearchModal, {
        medicinesData: medicinesData,
        onClose: () => setActiveModal(null),
        onSelectMedicine: (med) => {
          setActiveModal(null);
          openDetailModal(med);
        }
      }),

      // Toast Feedback
      toastMessage && h('div', {
        style: {
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--orange-primary)',
          boxShadow: 'var(--shadow-lg)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          fontWeight: '600',
          zIndex: 2000,
          animation: 'modalIn 0.2s ease-out'
        }
      }, toastMessage)
    );
  }

  // Mount Application
  window.addEventListener('DOMContentLoaded', () => {
    const rootEl = document.getElementById('root');
    if (rootEl) {
      if (window.ReactDOM.createRoot) {
        const root = window.ReactDOM.createRoot(rootEl);
        root.render(h(MediTrackApp));
      } else if (window.ReactDOM.render) {
        window.ReactDOM.render(h(MediTrackApp), rootEl);
      }
    }
  });
})();
