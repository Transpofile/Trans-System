/**
 * --- INVENTORY MANAGEMENT EXTENSION (RUBY EDITION V4) ---
 * Description: Analytics, Visual Dashboard, and Reporting Suite.
 * Features: PHP Currency, Table Sorting, Chart Toggles, Smart Search.
 * Design: Ruby (Rose/Slate) Glassmorphism.
 */

const EXT_CONFIG = {
    theme: {
        primary: '#be123c', // Rose 700
        secondary: '#881337', // Rose 900
        accent: '#fb7185', // Rose 400
        bg: '#f8fafc', // Slate 50
        text: '#334155' // Slate 700
    },
    libs: {
        xlsx: 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
        jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js',
        pptx: 'https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
        docx: 'https://cdn.jsdelivr.net/npm/docx@7.1.0/build/index.js',
        chartjs: 'https://cdn.jsdelivr.net/npm/chart.js'
    }
};

class InventoryExtension {
    constructor() {
        this.chartInstance = null;
        this.currentTab = 'table'; // 'table' | 'chart'
        this.chartType = 'bar';    // 'bar' | 'pie'
        this.sortConfig = { key: null, direction: 'asc' }; // Sorting state
        this.searchTimer = null;
        this.init();
    }

    init() {
        console.log("%c [System] Initializing Data Studio V4...", "color: #be123c; font-weight: bold;");
        this.injectStyles();
        this.loadLibraries();
        this.injectSidebar();
        this.injectModal();
        this.attachGlobalListeners();
    }

    // --- 1. CORE STYLING ---
    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* Ruby Theme Core */
            .ruby-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .ruby-scroll::-webkit-scrollbar-track { background: transparent; }
            .ruby-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; }
            .ruby-scroll::-webkit-scrollbar-thumb:hover { background-color: #be123c; }

            .anim-fade-up { animation: fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes fadeUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

            .radio-card input:checked + div { border-color: #be123c; background-color: #fff1f2; box-shadow: 0 0 0 1px #be123c; }
            .radio-card input:checked + div i { color: #be123c; transform: scale(1.1); }
            
            .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; position: relative; overflow: hidden; transition: transform 0.2s; }
            .kpi-card:hover { transform: translateY(-2px); border-color: #fb7185; }
            .kpi-card::after { content:''; position: absolute; top:0; left:0; width: 4px; height: 100%; background: #be123c; opacity: 0; transition: opacity 0.2s; }
            .kpi-card:hover::after { opacity: 1; }
            
            .tab-active { border-bottom: 2px solid #be123c; color: #be123c; background-color: #fff1f2; }
            .tab-inactive { border-bottom: 2px solid transparent; color: #64748b; }
            .tab-inactive:hover { color: #334155; background-color: #f1f5f9; }

            th.sortable { cursor: pointer; user-select: none; transition: background 0.2s; }
            th.sortable:hover { background-color: #f1f5f9; color: #be123c; }
            th.sortable i { margin-left: 4px; opacity: 0.3; font-size: 10px; }
            th.sortable.sorted-asc i { opacity: 1; transform: rotate(180deg); color: #be123c; }
            th.sortable.sorted-desc i { opacity: 1; transform: rotate(0deg); color: #be123c; }
        `;
        document.head.appendChild(style);
    }

    async loadLibraries() {
        const load = (url) => new Promise((resolve) => {
            if (document.querySelector(`script[src="${url}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = () => { console.warn(`Failed to load ${url}`); resolve(); }; 
            document.head.appendChild(script);
        });
        await Promise.all(Object.values(EXT_CONFIG.libs).map(load));
    }

    // --- 2. UI INJECTION ---
    injectSidebar() {
        const interval = setInterval(() => {
            const nav = $('#sidebar nav');
            if (nav.length) {
                clearInterval(interval);
                if ($('#nav-data-studio').length) return;

                const html = `
                    <div class="px-3 mb-2 mt-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Analytics</div>
                    <a href="#" id="nav-data-studio" onclick="window.InvExt.openModal()" class="nav-link group flex items-center px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all duration-200">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-rose-800 flex items-center justify-center mr-3 shadow-lg group-hover:shadow-rose-500/30 transition-all">
                            <i class="fas fa-chart-pie text-white text-xs"></i>
                        </div>
                        <span class="font-medium tracking-wide">Data Studio</span>
                    </a>
                `;
                nav.append(html);
            }
        }, 500);
    }

    injectModal() {
        const modalHtml = `
        <div id="ruby-export-modal" class="fixed inset-0 z-[100] hidden flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
            <div class="bg-slate-50 rounded-2xl shadow-2xl w-[95%] max-w-7xl h-[90vh] flex overflow-hidden anim-fade-up border border-slate-200 relative">
                
                <button onclick="window.InvExt.closeModal()" class="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-white hover:bg-rose-500 text-slate-400 hover:text-white transition shadow-md flex items-center justify-center border border-slate-200 hover:border-rose-500">
                    <i class="fas fa-times"></i>
                </button>

                <!-- LEFT PANEL: CONTROLS -->
                <div class="w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                    <div class="p-6 border-b border-slate-100">
                        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <i class="fas fa-layer-group text-rose-600"></i> Data Studio <span class="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded border border-rose-200">V4</span>
                        </h2>
                        <p class="text-[11px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Analytics & Export Suite</p>
                    </div>

                    <div class="p-6 flex-1 overflow-y-auto space-y-8 ruby-scroll">
                        <!-- Source -->
                        <div>
                            <label class="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3 block">1. Data Source</label>
                            <div class="space-y-3">
                                <label class="radio-card cursor-pointer block">
                                    <input type="radio" name="rb-source" value="inventory" checked class="hidden" onchange="window.InvExt.updateDashboard()">
                                    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-3 transition-all bg-slate-50 hover:bg-white">
                                        <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><i class="fas fa-boxes"></i></div>
                                        <div><div class="font-bold text-slate-700 text-sm">Inventory Assets</div><div class="text-[10px] text-slate-400">Master stock levels</div></div>
                                    </div>
                                </label>
                                <label class="radio-card cursor-pointer block">
                                    <input type="radio" name="rb-source" value="pr" class="hidden" onchange="window.InvExt.updateDashboard()">
                                    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-3 transition-all bg-slate-50 hover:bg-white">
                                        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600"><i class="fas fa-arrow-down"></i></div>
                                        <div><div class="font-bold text-slate-700 text-sm">Inbound (PR)</div><div class="text-[10px] text-slate-400">Purchasing Logs</div></div>
                                    </div>
                                </label>
                                <label class="radio-card cursor-pointer block">
                                    <input type="radio" name="rb-source" value="wr" class="hidden" onchange="window.InvExt.updateDashboard()">
                                    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-3 transition-all bg-slate-50 hover:bg-white">
                                        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600"><i class="fas fa-arrow-up"></i></div>
                                        <div><div class="font-bold text-slate-700 text-sm">Outbound (WR)</div><div class="text-[10px] text-slate-400">Usage & Withdrawals</div></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Date Filters -->
                        <div id="date-filter-group" class="transition-opacity duration-200">
                            <label class="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3 block">2. Time Period</label>
                            <div class="flex gap-2 mb-3">
                                <button onclick="window.InvExt.setDates('month')" class="flex-1 py-1.5 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition bg-white">This Month</button>
                                <button onclick="window.InvExt.setDates('all')" class="flex-1 py-1.5 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition bg-white">All Time</button>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <input type="date" id="exp-start" onchange="window.InvExt.updateDashboard()" class="w-full text-[10px] p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none">
                                <input type="date" id="exp-end" onchange="window.InvExt.updateDashboard()" class="w-full text-[10px] p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none">
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="p-5 bg-slate-50 border-t border-slate-200">
                        <label class="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 block">3. Export Data</label>
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <button onclick="window.InvExt.exportData('excel')" class="flex items-center justify-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-500 transition shadow-sm group">
                                <i class="fas fa-file-excel text-emerald-500 group-hover:scale-110 transition"></i>
                                <span class="text-xs font-bold text-slate-600">Excel</span>
                            </button>
                            <button onclick="window.InvExt.exportData('pdf')" class="flex items-center justify-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 hover:border-rose-500 transition shadow-sm group">
                                <i class="fas fa-file-pdf text-rose-500 group-hover:scale-110 transition"></i>
                                <span class="text-xs font-bold text-slate-600">PDF</span>
                            </button>
                        </div>
                        <div class="grid grid-cols-3 gap-1">
                             <button onclick="window.InvExt.exportData('csv')" class="text-[10px] py-1 text-slate-400 hover:text-slate-600">CSV</button>
                             <button onclick="window.InvExt.exportData('word')" class="text-[10px] py-1 text-slate-400 hover:text-blue-600">Word</button>
                             <button onclick="window.InvExt.printData()" class="text-[10px] py-1 text-slate-400 hover:text-slate-800">Print</button>
                        </div>
                    </div>
                </div>

                <!-- RIGHT PANEL: DASHBOARD -->
                <div class="flex-1 flex flex-col bg-slate-50/50 relative">
                    
                    <!-- Header / Search -->
                    <div class="p-6 bg-white border-b border-slate-200 shadow-sm z-10 flex flex-col gap-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-lg text-slate-800" id="preview-title">Dashboard</h3>
                                <div class="flex items-center gap-2 mt-1">
                                    <p class="text-xs text-slate-500" id="preview-insight">Loading insights...</p>
                                </div>
                            </div>
                            
                            <!-- Search Bar -->
                            <div class="relative group">
                                <input type="text" id="global-search" onkeyup="window.InvExt.handleSearch()" placeholder="Search data..." 
                                    class="w-64 pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all">
                                <i class="fas fa-search absolute left-3 top-2 text-slate-400 text-xs group-focus-within:text-rose-500 transition-colors"></i>
                            </div>
                        </div>

                        <!-- KPI Grid -->
                        <div class="grid grid-cols-4 gap-4" id="kpi-container"></div>
                    </div>

                    <!-- Tabs & Content -->
                    <div class="flex-1 p-6 overflow-hidden flex flex-col">
                        
                        <!-- View Toggle -->
                        <div class="flex border-b border-slate-200 mb-0 bg-white rounded-t-xl px-2 pt-2 gap-1 w-fit">
                            <button onclick="window.InvExt.switchTab('table')" id="tab-btn-table" class="px-4 py-2 text-xs font-bold rounded-t-lg transition-all tab-active">
                                <i class="fas fa-table mr-1"></i> Data Grid
                            </button>
                            <button onclick="window.InvExt.switchTab('chart')" id="tab-btn-chart" class="px-4 py-2 text-xs font-bold rounded-t-lg transition-all tab-inactive">
                                <i class="fas fa-chart-bar mr-1"></i> Visuals
                            </button>
                        </div>

                        <!-- Main Content Area -->
                        <div class="bg-white rounded-b-xl rounded-tr-xl border border-slate-200 h-full flex flex-col shadow-sm relative overflow-hidden">
                            
                            <!-- Table View -->
                            <div id="view-table" class="flex-1 overflow-auto ruby-scroll h-full">
                                <table class="w-full text-left border-collapse">
                                    <thead class="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr id="preview-headers"></tr>
                                    </thead>
                                    <tbody id="preview-body" class="text-xs text-slate-600 divide-y divide-slate-100"></tbody>
                                </table>
                            </div>

                            <!-- Chart View -->
                            <div id="view-chart" class="flex-1 h-full hidden flex flex-col relative">
                                <!-- Chart Controls -->
                                <div class="absolute top-4 right-4 z-10 flex bg-white border border-slate-200 rounded-lg shadow-sm p-1">
                                    <button onclick="window.InvExt.setChartType('bar')" class="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-rose-600"><i class="fas fa-chart-bar"></i></button>
                                    <button onclick="window.InvExt.setChartType('pie')" class="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-rose-600"><i class="fas fa-chart-pie"></i></button>
                                </div>
                                <div class="flex-1 p-6 flex items-center justify-center bg-slate-50/30">
                                    <div class="w-full max-w-3xl h-80">
                                        <canvas id="analyticsChart"></canvas>
                                    </div>
                                </div>
                            </div>

                            <!-- Footer Stats -->
                            <div class="p-2 border-t border-slate-100 bg-slate-50 text-center flex justify-between px-4">
                                <span class="text-[10px] text-slate-400 font-bold" id="footer-count">0 Records</span>
                                <span class="text-[10px] text-slate-400 italic"><i class="fas fa-check-circle text-emerald-500 mr-1"></i>Currency: PHP (₱)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        $('body').append(modalHtml);
    }

    attachGlobalListeners() {
        window.InvExt = this;
    }

    // --- 3. DATA LOGIC & PROCESSING ---

    openModal() {
        $('#ruby-export-modal').removeClass('hidden');
        this.setDates('all');
        this.sortConfig = { key: null, direction: 'asc' }; // Reset sort
        this.switchTab('table');
        this.updateDashboard();
    }

    closeModal() {
        $('#ruby-export-modal').addClass('hidden');
    }

    setDates(range) {
        const now = new Date();
        const startEl = document.getElementById('exp-start');
        const endEl = document.getElementById('exp-end');
        if (range === 'month') {
            startEl.valueAsDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endEl.valueAsDate = now;
        } else {
            startEl.value = ''; endEl.value = '';
        }
        this.updateDashboard();
    }

    handleSearch() {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.updateDashboard(), 300); // Debounce
    }

    switchTab(tab) {
        this.currentTab = tab;
        $('#tab-btn-table').toggleClass('tab-active', tab === 'table').toggleClass('tab-inactive', tab !== 'table');
        $('#tab-btn-chart').toggleClass('tab-active', tab === 'chart').toggleClass('tab-inactive', tab !== 'chart');
        
        if (tab === 'table') {
            $('#view-table').removeClass('hidden');
            $('#view-chart').addClass('hidden');
        } else {
            $('#view-table').addClass('hidden');
            $('#view-chart').removeClass('hidden');
            this.renderChart();
        }
    }

    setChartType(type) {
        this.chartType = type;
        this.renderChart();
    }

    sortTable(key) {
        if (this.sortConfig.key === key) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.key = key;
            this.sortConfig.direction = 'asc';
        }
        this.updateDashboard();
    }

    // Main Data Aggregator
    getFilteredData() {
        const type = $('input[name="rb-source"]:checked').val();
        const start = $('#exp-start').val();
        const end = $('#exp-end').val();
        const search = $('#global-search').val().toLowerCase();

        // Safe Access to Global Cache
        const _inv = (typeof invCache !== 'undefined') ? invCache : [];
        const _pr = (typeof prCache !== 'undefined') ? prCache : [];
        const _wr = (typeof wrCache !== 'undefined') ? wrCache : [];

        const inDateRange = (dStr) => {
            if (!dStr) return false;
            if (!start && !end) return true;
            const d = new Date(dStr).setHours(0,0,0,0);
            const s = start ? new Date(start).setHours(0,0,0,0) : null;
            const e = end ? new Date(end).setHours(0,0,0,0) : null;
            return (!s || d >= s) && (!e || d <= e);
        };

        const matchesSearch = (obj) => {
            if (!search) return true;
            return Object.values(obj).some(val => String(val).toLowerCase().includes(search));
        };

        const fmtPHP = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

        let raw = [];
        let title = "";
        
        if (type === 'inventory') {
            title = "Inventory Master List";
            $('#date-filter-group').addClass('opacity-50 pointer-events-none');
            raw = _inv.map(i => ({
                "Code": i.material_code,
                "Description": i.description,
                "Category": i.category || 'Uncategorized',
                "Stock": i.current_stock,
                "UoM": i.uom,
                "Status": i.current_stock <= 0 ? "OUT" : (i.current_stock <= i.low_stock_threshold ? "LOW" : "OK"),
                "Value": fmtPHP(i.current_stock * (i.unit_price || 0)),
                "_rawValue": (i.current_stock * (i.unit_price || 0)) // Hidden for sorting
            }));
        } else if (type === 'pr') {
            title = "Inbound Purchase Logs";
            $('#date-filter-group').removeClass('opacity-50 pointer-events-none');
            _pr.forEach(h => {
                if (inDateRange(h.created_at) && h.pr_items) {
                    h.pr_items.forEach(i => {
                        raw.push({
                            "Date": new Date(h.created_at).toLocaleDateString(),
                            "PR No": h.pr_number,
                            "Item": i.material_code,
                            "Qty": i.quantity_requested,
                            "Cost": fmtPHP(i.unit_price || 0),
                            "Total": fmtPHP((i.quantity_requested || 0) * (i.unit_price || 0)),
                            "Status": h.status,
                            "_rawTotal": ((i.quantity_requested || 0) * (i.unit_price || 0))
                        });
                    });
                }
            });
        } else if (type === 'wr') {
            title = "Outbound Usage Logs";
            $('#date-filter-group').removeClass('opacity-50 pointer-events-none');
            _wr.forEach(h => {
                if (!h.wr_number.startsWith('DISP') && inDateRange(h.created_at) && h.wr_items) {
                    h.wr_items.forEach(i => {
                        raw.push({
                            "Date": new Date(h.created_at).toLocaleDateString(),
                            "WR No": h.wr_number,
                            "Dept": h.department,
                            "Item": i.material_code,
                            "Qty": i.quantity_requested,
                            "Status": h.status
                        });
                    });
                }
            });
        }

        // Apply Search Filter
        let data = raw.filter(matchesSearch);

        // Apply Sorting
        if (this.sortConfig.key) {
            const { key, direction } = this.sortConfig;
            data.sort((a, b) => {
                // Use hidden raw values for currency sorting if they exist
                const valA = (key === 'Value' && a._rawValue !== undefined) ? a._rawValue : 
                             (key === 'Total' && a._rawTotal !== undefined) ? a._rawTotal : a[key];
                const valB = (key === 'Value' && b._rawValue !== undefined) ? b._rawValue : 
                             (key === 'Total' && b._rawTotal !== undefined) ? b._rawTotal : b[key];

                if (typeof valA === 'number' && typeof valB === 'number') {
                    return direction === 'asc' ? valA - valB : valB - valA;
                }
                return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }

        // Calc KPIs
        const kpi = { count: data.length, qty: 0, val: 0, map: {} };
        data.forEach(r => {
            kpi.qty += parseFloat(r.Qty || r.Stock || 0);
            // Sum up raw values for accurate KPI
            kpi.val += parseFloat(r._rawTotal || r._rawValue || 0);
            
            const key = r.Status || r.Category || r.Dept || 'Unknown';
            kpi.map[key] = (kpi.map[key] || 0) + 1;
        });

        // Generate Smart Insight
        let topKey = Object.keys(kpi.map).reduce((a, b) => kpi.map[a] > kpi.map[b] ? a : b, '-');
        const insight = data.length ? `Most records are <b>${topKey}</b> (${kpi.map[topKey]} items).` : "No data available.";

        return { data, title, type, kpi, insight };
    }

    updateDashboard() {
        const result = this.getFilteredData();
        this.currentData = result; 

        // 1. Text Updates
        $('#preview-title').text(result.title);
        $('#preview-insight').html(`<i class="fas fa-lightbulb text-amber-500 mr-1"></i> ${result.insight}`);
        $('#footer-count').text(`${result.kpi.count.toLocaleString()} Records Found`);

        // 2. KPI Cards (Using PHP Currency)
        const kpiHtml = `
            <div class="kpi-card">
                <div class="text-[10px] text-slate-400 uppercase font-bold">Records</div>
                <div class="text-2xl font-bold text-slate-700">${result.kpi.count.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
                <div class="text-[10px] text-slate-400 uppercase font-bold">Total Quantity</div>
                <div class="text-2xl font-bold text-blue-600">${result.kpi.qty.toLocaleString()}</div>
            </div>
            ${result.type !== 'wr' ? `
            <div class="kpi-card">
                <div class="text-[10px] text-slate-400 uppercase font-bold">Est. Value (PHP)</div>
                <div class="text-2xl font-bold text-emerald-600">₱${result.kpi.val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
            </div>` : ''}
        `;
        $('#kpi-container').html(kpiHtml).removeClass().addClass(`grid grid-cols-${result.type==='wr'?2:3} gap-4`);

        // 3. Render Table
        const $head = $('#preview-headers').empty();
        const $body = $('#preview-body').empty();

        if (result.data.length === 0) {
            $body.html('<tr><td colspan="10" class="p-10 text-center text-slate-400 flex flex-col items-center"><i class="fas fa-search text-3xl mb-2 opacity-50"></i><span>No records found matching criteria.</span></td></tr>');
        } else {
            const keys = Object.keys(result.data[0]).filter(k => !k.startsWith('_')); // Exclude internal keys
            
            // Header with Sort Capability
            keys.forEach(k => {
                const sortClass = (this.sortConfig.key === k) ? (this.sortConfig.direction === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';
                $head.append(`<th onclick="window.InvExt.sortTable('${k}')" class="sortable ${sortClass} p-3 text-[10px] font-bold uppercase text-slate-500 bg-slate-50 tracking-wider whitespace-nowrap border-b border-slate-200">
                    ${k} <i class="fas fa-arrow-down"></i>
                </th>`);
            });

            // Render top 100 for preview
            result.data.slice(0, 100).forEach(row => {
                let tr = '<tr class="hover:bg-rose-50/50 transition group">';
                keys.forEach(k => {
                    let val = row[k];
                    if (k === 'Status') {
                        const color = ['OK','Received','APPROVED','Completed'].includes(val) ? 'bg-emerald-100 text-emerald-700' : 
                                      ['OUT','Cancel','Rejected'].includes(val) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                        val = `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${color}">${val}</span>`;
                    }
                    tr += `<td class="p-2.5 whitespace-nowrap border-b border-slate-50 group-last:border-0">${val}</td>`;
                });
                $body.append(tr + '</tr>');
            });
        }

        if(this.currentTab === 'chart') this.renderChart();
    }

    renderChart() {
        if (!this.currentData || !window.Chart) return;
        
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        const map = this.currentData.kpi.map;
        const labels = Object.keys(map);
        const data = Object.values(map);

        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: this.chartType, // Dynamic: 'bar' or 'pie'
            data: {
                labels: labels,
                datasets: [{
                    label: 'Count',
                    data: data,
                    backgroundColor: [
                        '#be123c', '#fb7185', '#e11d48', '#881337', // Rose variants
                        '#059669', '#3b82f6', '#d97706', '#64748b'  // Accent variants
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { usePointStyle: true, font: { size: 10 } } },
                    title: { display: true, text: 'Distribution Analysis' }
                }
            }
        });
    }

    // --- 4. EXPORT HANDLERS ---
    async exportData(format) {
        const { data, title, type } = this.currentData;
        if (!data || data.length === 0) return Swal.fire('Empty Dataset', 'Nothing to export.', 'info');

        const cleanData = data.map(row => {
            const newRow = {...row};
            delete newRow._rawValue; delete newRow._rawTotal; // Remove hidden sorting keys
            return newRow;
        });

        const filename = `${type.toUpperCase()}_Report_${new Date().toISOString().slice(0,10)}`;
        
        Swal.fire({
            title: 'Generating File...',
            html: `Processing ${cleanData.length} records into ${format.toUpperCase()}.`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            await new Promise(r => setTimeout(r, 500));

            switch (format) {
                case 'csv': this.toCSV(cleanData, filename); break;
                case 'excel': this.toExcel(cleanData, filename); break;
                case 'pdf': this.toPDF(cleanData, filename, title); break;
                case 'word': await this.toWord(cleanData, filename, title); break;
            }

            Swal.close();
            Swal.fire({ icon: 'success', title: 'Download Ready', text: `${filename}.${format}`, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });

        } catch (e) {
            Swal.fire('Export Failed', e.message, 'error');
        }
    }

    printData() {
        const { data, title } = this.currentData;
        if (!data.length) return;
        const cleanData = data.map(row => { const r = {...row}; delete r._rawValue; delete r._rawTotal; return r; });

        let html = `<html><head><title>${title}</title><style>body{font-family:sans-serif;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px;text-align:left}th{background:#f0f0f0}</style></head><body><h2>${title}</h2><table><thead><tr>`;
        Object.keys(cleanData[0]).forEach(k => html += `<th>${k}</th>`);
        html += `</tr></thead><tbody>`;
        cleanData.forEach(r => { html += `<tr>${Object.values(r).map(v => `<td>${v}</td>`).join('')}</tr>`; });
        html += `</tbody></table></body></html>`;
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    }

    // -- FORMAT IMPLEMENTATIONS --
    toCSV(data, filename) {
        const header = Object.keys(data[0]).join(',');
        const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
    }

    toExcel(data, filename) {
        if (!window.XLSX) throw new Error("Excel Library not loaded");
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    toPDF(data, filename, title) {
        if (!window.jspdf) throw new Error("PDF Library not loaded");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: Object.keys(data[0]).length > 6 ? 'l' : 'p' });
        
        doc.setFillColor(190, 18, 60); doc.rect(0, 0, 300, 20, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text(title, 14, 13);
        
        doc.autoTable({
            head: [Object.keys(data[0])],
            body: data.map(Object.values),
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: [190, 18, 60] },
            styles: { fontSize: 8 }
        });
        doc.save(`${filename}.pdf`);
    }

    async toWord(data, filename, title) {
        if (!window.docx) throw new Error("Word Library not loaded");
        const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType } = window.docx;
        const createRow = (cells, bold = false) => new TableRow({
            children: cells.map(c => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(c), bold: bold, size: 18 })] })],
                width: { size: 100 / cells.length, type: WidthType.PERCENTAGE }
            }))
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32, color: "BE123C" })], spacing: { after: 300 } }),
                    new Table({ rows: [createRow(Object.keys(data[0]), true), ...data.map(r => createRow(Object.values(r)))], width: { size: 100, type: WidthType.PERCENTAGE } })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${filename}.docx`; a.click();
    }
}

// Initialize
$(document).ready(() => { setTimeout(() => new InventoryExtension(), 1000); });
