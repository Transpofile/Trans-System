/**
 * --- DISPOSAL MANAGEMENT & ANALYTICS SUITE ---
 * Version: 5.2 (Image Support Added)
 * Architecture: Singleton Stateful Service
 */

class DisposalManager {
    
    constructor() {
        if (DisposalManager.instance) return DisposalManager.instance;
        
        // State Management
        this.state = {
            logs: [],           // Stores fetched disposal records
            analyticsData: null,// Stores calculated stats
            viewMode: 'type',   // Analytics: 'type' | 'trend'
            timeFilter: 'all',  // Analytics: 'all' | '30' | '90' | '365'
            isLoading: false
        };
        
        // DOM Elements Map
        this.dom = {
            // Analytics
            container: 'disposal-analytics-container',
            canvas: 'disposal-trend-canvas',
            filterSelect: 'disposal-time-filter',
            kpiVolume: 'kpi-disp-volume',
            kpiCount: 'kpi-disp-count',
            kpiTopCategory: 'kpi-disp-top-cat',
            kpiTopUser: 'kpi-disp-top-user',
            
            // CRUD / Main UI
            tableBody: 'tbl-disp-hist',
            submitBtn: 'btn-disp-submit'
        };

        this.chartInstance = null;
        DisposalManager.instance = this;
    }

    /**
     * CORE: INITIALIZATION
     */
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._bootstrap());
        } else {
            this._bootstrap();
        }
    }

    _bootstrap() {
        this._checkDependencies();
        this._injectAnalyticsUI();
        this._bindEvents();
        
        // Delay slightly to allow script.js caches (invCache, wrCache) to populate for images
        setTimeout(() => this.loadLogs(), 1000);
    }

    _checkDependencies() {
        if (typeof supabaseClient === 'undefined') {
            console.warn("DisposalManager: 'supabaseClient' is undefined. Make sure script.js loads first.");
        }
    }

    /**
     * CORE: EVENT BINDING
     */
    _bindEvents() {
        const el = (id) => document.getElementById(id);

        // Analytics Events
        el('disposal-trigger-btn')?.addEventListener('click', () => this.openAnalytics());
        el('disposal-close-btn')?.addEventListener('click', () => this.closeAnalytics());
        el('disposal-export-btn')?.addEventListener('click', () => this.exportCSV());
        el('disposal-view-toggle')?.addEventListener('click', () => this.toggleAnalyticsView());
        el(this.dom.filterSelect)?.addEventListener('change', (e) => {
            this.state.timeFilter = e.target.value;
            this._refreshAnalytics();
        });

        // Hijack the disposal submit button
        const submitBtn = el(this.dom.submitBtn);
        if (submitBtn) {
            const newBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newBtn, submitBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCreate();
            });
        }
    }

    /**
     * ==========================================
     *  SECTION 1: CRUD OPERATIONS
     * ==========================================
     */

    /**
     * READ: Fetch logs
     */
    async loadLogs() {
        if (typeof supabaseClient === 'undefined') return;

        this._setLoading(true);
        try {
            const { data, error } = await supabaseClient
                .from('disposal_records')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Disposal Fetch Error:', error); 
                this._renderTable(); 
                return;
            }

            this.state.logs = data || [];
            this._renderTable();
            this._refreshAnalytics(); 
            
        } catch (err) {
            console.error('Error loading disposal logs:', err);
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * CREATE: Handle new disposal entry
     */
    async handleCreate() {
        if (typeof supabaseClient === 'undefined') return Swal.fire('Error', 'Database not ready', 'error');

        const wrId = document.getElementById('disp-wr-id').value;
        const type = document.getElementById('disp-type').value;
        const dest = document.getElementById('disp-dest').value;
        const reason = document.getElementById('disp-reason').value;
        const auth = document.getElementById('disp-auth').value;

        if (!wrId || !auth) {
            Swal.fire('Missing Information', 'Please select a WR source and Authorizer.', 'warning');
            return;
        }

        const payload = {
            ref_number: `DISP-${Date.now().toString().slice(-6)}`,
            wr_source_id: wrId,
            waste_type: type,
            destination: dest,
            reason: reason,
            authorized_by: auth,
            status: 'COMPLETED',
            created_at: new Date().toISOString(),
            remarks: `${type} | ${dest} | ${reason}`
        };

        try {
            const { error } = await supabaseClient.from('disposal_records').insert([payload]);
            if (error) throw error;

            Swal.fire({ icon: 'success', title: 'Disposed', text: 'Item successfully logged.', timer: 1500, showConfirmButton: false });
            document.getElementById('disp-auth').value = '';
            this.loadLogs();

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }

    /**
     * RENDER: Populate HTML Table with Images
     */
    _renderTable() {
        const tbody = document.getElementById(this.dom.tableBody);
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.state.logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-slate-400 italic">No disposal records found.</td></tr>`;
            return;
        }

        this.state.logs.forEach(log => {
            const type = log.waste_type || (log.remarks ? log.remarks.split('|')[0] : 'Unclassified');
            const dest = log.destination || (log.remarks ? log.remarks.split('|')[1] : 'Unknown');
            
            // --- IMAGE LOGIC ---
            // Default generic icon
            let imgDisplay = `
                <div class="h-10 w-10 rounded bg-red-50 text-red-400 flex items-center justify-center border border-red-100">
                    <i class="fas fa-trash-alt"></i>
                </div>
            `;

            // Try to find the actual image using global caches from script.js
            if (typeof wrCache !== 'undefined' && typeof invCache !== 'undefined' && log.wr_source_id) {
                // Find the source WR
                const sourceWr = wrCache.find(w => w.wr_id == log.wr_source_id);
                // If WR exists and has items
                if (sourceWr && sourceWr.wr_items && sourceWr.wr_items.length > 0) {
                    // Grab the first material code
                    const firstMatCode = sourceWr.wr_items[0].material_code;
                    // Find item in inventory cache
                    const invItem = invCache.find(i => i.material_code === firstMatCode);
                    
                    if (invItem && invItem.image_link) {
                        imgDisplay = `
                            <img src="${invItem.image_link}" 
                                 class="h-10 w-10 rounded object-cover border border-slate-200 shadow-sm cursor-pointer hover:scale-150 transition-transform duration-200 bg-white relative z-10" 
                                 onclick="openLightbox('${invItem.image_link}')"
                                 title="${invItem.description}">
                        `;
                    }
                }
            }
            // -------------------

            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";
            tr.innerHTML = `
                <td class="p-4 text-center">
                    ${imgDisplay}
                </td>
                <td class="p-4 font-mono text-xs font-bold text-slate-700">${log.ref_number}</td>
                <td class="p-4">
                    <div class="text-sm font-bold text-slate-800">WR #${log.wr_source_id || 'N/A'}</div>
                    <div class="text-xs text-slate-500"><i class="fas fa-user-check mr-1"></i> ${log.authorized_by}</div>
                </td>
                <td class="p-4 text-center font-bold text-slate-700">-</td>
                <td class="p-4">
                    <span class="block text-xs font-bold text-slate-700">${type}</span>
                    <span class="block text-[10px] text-slate-400">${dest}</span>
                </td>
                <td class="p-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="DisposalManager.instance.viewRecord('${log.id}')" 
                                class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-all flex items-center justify-center" 
                                title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="DisposalManager.instance.editRecord('${log.id}')" 
                                class="w-8 h-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-all flex items-center justify-center" 
                                title="Edit Record">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button onclick="DisposalManager.instance.deleteRecord('${log.id}')" 
                                class="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all flex items-center justify-center" 
                                title="Delete Log">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    /**
     * ACTION: View Record
     */
    viewRecord(id) {
        const record = this.state.logs.find(r => r.id == id);
        if (!record) return;

        Swal.fire({
            title: `<span class="text-slate-700">Disposal Details</span>`,
            html: `
                <div class="text-left bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div class="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <label class="text-[10px] uppercase font-bold text-slate-400">Ref Number</label>
                            <div class="font-mono font-bold text-slate-800">${record.ref_number}</div>
                        </div>
                        <div>
                            <label class="text-[10px] uppercase font-bold text-slate-400">Date Logged</label>
                            <div class="font-medium text-slate-800">${new Date(record.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="text-[10px] uppercase font-bold text-slate-400">Waste Type</label>
                        <div class="font-medium text-red-600">${record.waste_type || 'N/A'}</div>
                    </div>
                    <div class="mb-3">
                        <label class="text-[10px] uppercase font-bold text-slate-400">Destination</label>
                        <div class="font-medium text-slate-700">${record.destination || 'N/A'}</div>
                    </div>
                    <div class="mb-3">
                        <label class="text-[10px] uppercase font-bold text-slate-400">Reason / Remarks</label>
                        <div class="font-medium text-slate-600 italic">"${record.reason || record.remarks}"</div>
                    </div>
                    <div>
                        <label class="text-[10px] uppercase font-bold text-slate-400">Authorized By</label>
                        <div class="flex items-center gap-2 mt-1">
                            <div class="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-xs"><i class="fas fa-user"></i></div>
                            <span class="font-bold text-slate-700">${record.authorized_by}</span>
                        </div>
                    </div>
                </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'Close',
            confirmButtonColor: '#64748b'
        });
    }

    /**
     * ACTION: Edit Record
     */
    async editRecord(id) {
        const record = this.state.logs.find(r => r.id == id);
        if (!record) return;

        const { value: formValues } = await Swal.fire({
            title: 'Edit Disposal Record',
            html: `
                <div class="mb-2 text-left"><label class="text-xs font-bold text-slate-500">Waste Type</label>
                <input id="swal-type" class="swal2-input" placeholder="Type" value="${record.waste_type || ''}" style="margin:5px 0 15px 0;"></div>
                
                <div class="mb-2 text-left"><label class="text-xs font-bold text-slate-500">Destination</label>
                <input id="swal-dest" class="swal2-input" placeholder="Destination" value="${record.destination || ''}" style="margin:5px 0 15px 0;"></div>
                
                <div class="mb-2 text-left"><label class="text-xs font-bold text-slate-500">Reason</label>
                <input id="swal-reason" class="swal2-input" placeholder="Reason" value="${record.reason || ''}" style="margin:5px 0 0 0;"></div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'Update',
            preConfirm: () => {
                return {
                    waste_type: document.getElementById('swal-type').value,
                    destination: document.getElementById('swal-dest').value,
                    reason: document.getElementById('swal-reason').value
                }
            }
        });

        if (formValues) {
            formValues.remarks = `${formValues.waste_type} | ${formValues.destination} | ${formValues.reason}`;
            try {
                const { error } = await supabaseClient
                    .from('disposal_records')
                    .update(formValues)
                    .eq('id', id);

                if (error) throw error;
                Swal.fire('Updated!', 'Record has been updated.', 'success');
                this.loadLogs(); 
            } catch (err) {
                Swal.fire('Error', 'Failed to update: ' + err.message, 'error');
            }
        }
    }

    /**
     * ACTION: Delete Record
     */
    async deleteRecord(id) {
        const result = await Swal.fire({
            title: 'Delete Log?',
            text: "This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete'
        });

        if (result.isConfirmed) {
            try {
                const { error } = await supabaseClient
                    .from('disposal_records')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                Swal.fire('Deleted!', 'Record removed.', 'success');
                this.loadLogs();
            } catch (err) {
                Swal.fire('Error', 'Failed to delete: ' + err.message, 'error');
            }
        }
    }

    /**
     * ==========================================
     *  SECTION 2: ANALYTICS SUITE
     * ==========================================
     */

    _injectAnalyticsUI() {
        if (document.getElementById(this.dom.container)) return;

        const uiTemplate = `
            <div id="${this.dom.container}" class="hidden col-span-1 lg:col-span-3 card bg-white border border-slate-200 shadow-lg mb-8 rounded-xl overflow-hidden transition-all duration-300">
                <div class="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50">
                    <h3 class="font-bold text-slate-700 flex items-center gap-3">
                        <div class="bg-gradient-to-br from-red-500 to-red-600 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-sm">
                            <i class="fas fa-chart-pie text-sm"></i>
                        </div>
                        <span class="text-sm font-bold uppercase tracking-wide text-slate-800">Disposal Intelligence</span>
                    </h3>
                    <div class="flex items-center gap-3">
                        <div class="relative group">
                            <i class="fas fa-calendar-alt absolute left-3 top-2.5 text-slate-400 text-xs z-10"></i>
                            <select id="${this.dom.filterSelect}" class="pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:border-royal-500 outline-none">
                                <option value="all">All History</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last 90 Days</option>
                                <option value="365">Last Year</option>
                            </select>
                        </div>
                        <button id="disposal-view-toggle" class="btn-xs bg-white border border-slate-200 hover:text-royal-600 rounded-lg px-3 py-2 text-xs font-semibold transition-all flex items-center gap-2">
                            <i class="fas fa-exchange-alt"></i> Toggle Chart
                        </button>
                        <div class="h-6 w-px bg-slate-200 mx-1"></div>
                        <button id="disposal-export-btn" title="Download Report" class="text-slate-400 hover:text-emerald-600 p-2"><i class="fas fa-file-csv fa-lg"></i></button>
                        <button id="disposal-close-btn" title="Hide Dashboard" class="text-slate-400 hover:text-red-500 p-2"><i class="fas fa-times fa-lg"></i></button>
                    </div>
                </div>

                <div class="p-6">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                            <div class="text-[10px] text-blue-500 font-bold uppercase mb-1">Total Logs</div>
                            <div id="${this.dom.kpiCount}" class="text-2xl font-bold text-slate-800">-</div>
                        </div>
                        <div class="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                            <div class="text-[10px] text-emerald-500 font-bold uppercase mb-1">Active Status</div>
                            <div id="${this.dom.kpiVolume}" class="text-2xl font-bold text-slate-800">-</div>
                        </div>
                        <div class="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                            <div class="text-[10px] text-purple-500 font-bold uppercase mb-1">Top Category</div>
                            <div id="${this.dom.kpiTopCategory}" class="text-lg font-bold text-slate-800 truncate">-</div>
                        </div>
                        <div class="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                            <div class="text-[10px] text-amber-500 font-bold uppercase mb-1">Top Auth</div>
                            <div id="${this.dom.kpiTopUser}" class="text-lg font-bold text-slate-800 truncate">-</div>
                        </div>
                    </div>
                    <div class="h-80 w-full relative p-2 border border-slate-100 rounded-lg bg-slate-50/30">
                        <canvas id="${this.dom.canvas}"></canvas>
                    </div>
                </div>
            </div>
            <div class="col-span-full mb-4 flex justify-end">
                <button id="disposal-trigger-btn" class="bg-white border border-slate-200 text-slate-600 hover:text-royal-600 shadow-sm px-5 py-2 rounded-full text-sm font-medium flex items-center transition-all">
                    <i class="fas fa-magic mr-2 text-slate-400"></i> Analytics
                </button>
            </div>
        `;

        const target = document.querySelector('#disposal h1.page-title');
        if (target) target.insertAdjacentHTML('afterend', uiTemplate);
    }

    _refreshAnalytics() {
        if (!this.state.logs) return;
        
        const cutoffDate = new Date();
        const days = parseInt(this.state.timeFilter);
        if (this.state.timeFilter !== 'all') cutoffDate.setDate(cutoffDate.getDate() - days);

        const filtered = this.state.logs.filter(l => 
            this.state.timeFilter === 'all' || new Date(l.created_at) >= cutoffDate
        );

        const stats = {
            count: filtered.length,
            active: filtered.filter(l => l.status === 'COMPLETED').length,
            byType: {},
            byDate: {},
            byUser: {}
        };

        filtered.forEach(l => {
            const type = l.waste_type || 'Unclassified';
            const user = l.authorized_by || 'Unknown';
            const date = new Date(l.created_at).toLocaleDateString('en-US', {month:'short', year:'2-digit'});

            stats.byType[type] = (stats.byType[type] || 0) + 1;
            stats.byUser[user] = (stats.byUser[user] || 0) + 1;
            stats.byDate[date] = (stats.byDate[date] || 0) + 1;
        });

        const el = (id) => document.getElementById(id);
        if (el(this.dom.kpiCount)) {
            el(this.dom.kpiCount).textContent = stats.count;
            el(this.dom.kpiVolume).textContent = stats.active;
            el(this.dom.kpiTopCategory).textContent = Object.keys(stats.byType).reduce((a,b) => stats.byType[a] > stats.byType[b] ? a : b, '-');
            el(this.dom.kpiTopUser).textContent = Object.keys(stats.byUser).reduce((a,b) => stats.byUser[a] > stats.byUser[b] ? a : b, '-');
            this._drawChart(stats);
        }
    }

    _drawChart(data) {
        const ctx = document.getElementById(this.dom.canvas)?.getContext('2d');
        if (!ctx) return;
        if (this.chartInstance) this.chartInstance.destroy();

        const isTrend = this.state.viewMode === 'trend';
        const labels = isTrend ? Object.keys(data.byDate) : Object.keys(data.byType);
        const values = isTrend ? Object.values(data.byDate) : Object.values(data.byType);

        this.chartInstance = new Chart(ctx, {
            type: isTrend ? 'bar' : 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Records',
                    data: values,
                    backgroundColor: isTrend ? '#3b82f6' : ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', display: !isTrend }
                }
            }
        });
    }

    openAnalytics() {
        const c = document.getElementById(this.dom.container);
        if(c) { c.classList.remove('hidden'); this._refreshAnalytics(); }
    }
    closeAnalytics() { document.getElementById(this.dom.container)?.classList.add('hidden'); }
    toggleAnalyticsView() {
        this.state.viewMode = this.state.viewMode === 'type' ? 'trend' : 'type';
        this._refreshAnalytics();
    }

    exportCSV() {
        if (!this.state.logs || this.state.logs.length === 0) return;
        let csv = "Ref No,Date,Type,Destination,Reason,Authorized By\n";
        this.state.logs.forEach(l => {
            csv += `"${l.ref_number}","${new Date(l.created_at).toLocaleDateString()}","${l.waste_type}","${l.destination}","${l.reason}","${l.authorized_by}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Disposal_Logs.csv`;
        a.click();
    }

    _setLoading(bool) { this.state.isLoading = bool; }
}

const disposalManager = new DisposalManager();
disposalManager.init();
window.DisposalManager = DisposalManager;
