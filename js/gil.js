/**
 * TRANS-SYSTEM ULTIMATE SUITE v5.0 (Cloud Edition)
 * ---------------------------------------------------
 * Enhances Trans-System Pro with Cloud optimizations, Real-time listeners,
 * and high-end UI/UX features.
 * 
 * COMPATIBILITY: Works with Supabase-enabled Trans-System.html
 * 
 * CHANGE LOG:
 * - V5.0: Added Real-time Supabase Listeners (Collaborative Toasts).
 *         Optimized Backup/Restore to use Batch Inserts (High Performance).
 *         Added Cloud Status Indicator.
 * - V4.2: Enhanced QRCode data embedding.
 * - V4.1: Global Loading Overlay.
 * 
 * Connection: <script src="js/gil.js"></script>
 */

class TransSystemUltimate {
    constructor() {
        this.version = "5.0.0";
        this.loaderTimer = null; 

        // Wait for window load + check for core DB function
        window.addEventListener('load', () => this.waitForCore());
    }

    async waitForCore() {
        let attempts = 0;
        const check = setInterval(() => {
            // Checks for core global functions defined in Trans-System.html
            if (typeof window.dbAction === 'function') {
                clearInterval(check);
                this.init();
            } else {
                attempts++;
                if (attempts > 20) clearInterval(check); // Timeout 10s
            }
        }, 500);
    }

    init() {
        console.log(`%c TRANS-SYSTEM ULTIMATE v${this.version} [Cloud Ready] `, "background: #10b981; color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold;");
        
        this._setupLoadingOverlay();
        this.injectStyles();
        this.injectHeaderControls(); 
        this.injectCommandPalette();
        this.injectAnalyticsModal(); 
        this.setupTableObserver();   
        this.setupKeyboardShortcuts();
        this.setupRealtimeListeners(); // New in v5.0
        
        // Initial Health Check
        setTimeout(() => this.runHealthCheck(), 2000);
    }

    // =================================================================
    // LOADING MECHANISM
    // =================================================================

    _setupLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'ts-loading-overlay';
        overlay.className = "fixed inset-0 z-[5000] hidden bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 transition-opacity duration-300";
        
        overlay.innerHTML = `
            <div class="ts-glass p-8 rounded-xl flex flex-col items-center shadow-2xl animate-pulse">
                <i class="fas fa-cloud-upload-alt fa-spin text-4xl text-brand-500 dark:text-brand-400"></i>
                <p class="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100" id="ts-loader-msg">Syncing...</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Please wait</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    showLoader(message = "Processing data...") {
        clearTimeout(this.loaderTimer);
        const overlay = document.getElementById('ts-loading-overlay');
        document.getElementById('ts-loader-msg').innerText = message;
        this.loaderTimer = setTimeout(() => {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('opacity-100'), 10);
        }, 300);
    }

    hideLoader() {
        clearTimeout(this.loaderTimer);
        const overlay = document.getElementById('ts-loading-overlay');
        overlay.classList.remove('opacity-100');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }

    // =================================================================
    // REAL-TIME COLLABORATION (New in v5.0)
    // =================================================================
    setupRealtimeListeners() {
        if (!window.supabase) return;

        // Listen for new requests from other users
        window.supabase.channel('public:requests')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, payload => {
                this.showToast(`New Request from ${payload.new.requester}`, 'info');
                // Refresh request view if active
                if (!document.getElementById('view-requests').classList.contains('hidden')) {
                    if (typeof renderRequests === 'function') renderRequests();
                }
                // Update dashboard counts
                if (typeof renderDashboard === 'function') renderDashboard();
            })
            .subscribe();

        // Listen for inventory updates (low stock warnings etc)
        window.supabase.channel('public:inventory')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, payload => {
                if (payload.new.stock <= payload.new.threshold && payload.new.stock < payload.old.stock) {
                    this.showToast(`Low Stock Warning: ${payload.new.name}`, 'error');
                }
            })
            .subscribe();
            
        console.log("Real-time listeners active.");
    }

    // =================================================================
    // CORE ENHANCEMENTS & UI
    // =================================================================

    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            :root {
                --ts-glass-bg: rgba(255, 255, 255, 0.9);
                --ts-glass-border: 1px solid rgba(255, 255, 255, 0.5);
                --ts-shadow: 0 10px 40px -10px rgba(0,0,0,0.1);
                --ts-accent: #4f46e5;
            }
            .dark {
                --ts-glass-bg: rgba(15, 23, 42, 0.9);
                --ts-glass-border: 1px solid rgba(255, 255, 255, 0.05);
                --ts-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
                --ts-accent: #6366f1;
            }
            .ts-glass {
                background: var(--ts-glass-bg);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: var(--ts-glass-border);
                box-shadow: var(--ts-shadow);
            }
            /* Table Enhancements */
            table thead th { 
                background: rgba(241, 245, 249, 0.95) !important; 
                backdrop-filter: blur(4px);
                position: sticky; top: 0; z-index: 10;
            }
            .dark table thead th { background: rgba(30, 41, 59, 0.95) !important; color: #e2e8f0; }
            table tbody tr { transition: background 0.2s, transform 0.1s; }
            table tbody tr:hover { transform: scale(1.002); background: rgba(99, 102, 241, 0.05) !important; }

            /* Animations */
            .ts-scale-in { animation: tsScale 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes tsScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

            /* Grid Menu */
            .ts-grid-menu { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 8px; }
            .ts-grid-item {
                display: flex; flex-direction: column; align-items: center; text-align: center;
                padding: 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s;
                background: rgba(128,128,128, 0.05);
            }
            .ts-grid-item:hover { background: var(--ts-accent); color: white; }
            .ts-grid-item i { font-size: 1.2rem; margin-bottom: 5px; }
        `;
        document.head.appendChild(style);
    }

    injectHeaderControls() {
        const themeBtn = document.querySelector('button[onclick="toggleDarkMode()"]');
        if (!themeBtn) return;
        
        const container = themeBtn.parentElement;

        const toolsWrapper = document.createElement('div');
        toolsWrapper.className = "relative group z-30 mr-2"; 
        toolsWrapper.innerHTML = `
            <button class="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition tooltip border border-indigo-500/20" title="System Tools">
                <i class="fas fa-cube"></i>
            </button>
            <div class="absolute right-0 mt-3 w-64 ts-glass rounded-xl hidden group-hover:block ts-scale-in origin-top-right overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700">
                <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Suite v${this.version}</span>
                    <span class="flex items-center gap-1 text-[10px] text-emerald-500 font-bold"><i class="fas fa-wifi"></i> Cloud</span>
                </div>
                <div class="ts-grid-menu">
                    <div onclick="ext.backupData()" class="ts-grid-item text-slate-600 dark:text-slate-300">
                        <i class="fas fa-download text-blue-500 group-hover:text-white"></i> <span class="text-xs font-bold">Backup</span>
                    </div>
                    <div onclick="document.getElementById('restore-input').click()" class="ts-grid-item text-slate-600 dark:text-slate-300">
                        <i class="fas fa-upload text-orange-500 group-hover:text-white"></i> <span class="text-xs font-bold">Restore</span>
                    </div>
                    <div onclick="ext.openBulkImport()" class="ts-grid-item text-slate-600 dark:text-slate-300">
                        <i class="fas fa-file-csv text-emerald-500 group-hover:text-white"></i> <span class="text-xs font-bold">Import</span>
                    </div>
                    <div onclick="ext.downloadTemplate()" class="ts-grid-item text-slate-600 dark:text-slate-300">
                        <i class="fas fa-table text-purple-500 group-hover:text-white"></i> <span class="text-xs font-bold">Template</span>
                    </div>
                </div>
            </div>
            <input type="file" id="restore-input" accept=".json" class="hidden" onchange="ext.restoreData(this)">
        `;

        const analyticsBtn = document.createElement('button');
        analyticsBtn.className = "p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition tooltip border border-emerald-500/20 mr-2";
        analyticsBtn.title = "Financial Overview";
        analyticsBtn.innerHTML = '<i class="fas fa-chart-pie"></i>';
        analyticsBtn.onclick = () => this.openAnalyticsModal();

        container.insertBefore(toolsWrapper, themeBtn);
        container.insertBefore(analyticsBtn, toolsWrapper);
    }

    // --- FINANCIAL ANALYTICS ---
    injectAnalyticsModal() {
        if(document.getElementById('ts-analytics-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'ts-analytics-modal';
        modal.className = "fixed inset-0 z-[2000] hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center transition-opacity";
        
        modal.innerHTML = `
            <div class="ts-glass w-full max-w-4xl h-[80vh] rounded-2xl flex flex-col shadow-2xl relative ts-scale-in m-4 overflow-hidden">
                <div class="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-white/50 dark:bg-slate-800/50">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                            <i class="fas fa-coins text-xl"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-slate-800 dark:text-white">Financial Intelligence</h2>
                            <p class="text-xs text-slate-500 dark:text-slate-400">Real-time PR & Inventory Analysis</p>
                        </div>
                    </div>
                    <button onclick="document.getElementById('ts-analytics-modal').classList.add('hidden')" class="w-8 h-8 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition flex items-center justify-center">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="flex-1 p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                        <div class="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                            <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-4 border-b pb-2">Spend by Category (PR Value)</h3>
                            <div class="flex-1 relative w-full h-full min-h-[300px]"><canvas id="ts-cost-chart"></canvas></div>
                        </div>
                        <div class="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                            <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-4 border-b pb-2">Stock Distribution</h3>
                            <div class="flex-1 relative w-full h-full min-h-[300px] flex items-center justify-center"><canvas id="ts-dist-chart"></canvas></div>
                        </div>
                    </div>
                </div>
                <div class="p-3 bg-white/80 dark:bg-slate-800/80 border-t border-gray-200 dark:border-slate-700 flex justify-around text-center text-xs">
                    <div><p class="text-slate-400 uppercase font-bold">Total PR Value</p><p class="text-lg font-mono font-bold text-emerald-600" id="ts-total-val">₱0.00</p></div>
                    <div><p class="text-slate-400 uppercase font-bold">Dashboard Inv. Value</p><p class="text-lg font-mono font-bold text-yellow-600" id="ts-inventory-val">₱0.00</p></div>
                    <div><p class="text-slate-400 uppercase font-bold">Active PRs</p><p class="text-lg font-mono font-bold text-blue-600" id="ts-total-req">0</p></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden'); });
    }

    async openAnalyticsModal() {
        if(typeof Chart === 'undefined') { this.showToast("Chart.js missing.", 'error'); return; }
        this.showLoader("Analyzing cloud data...");
        document.getElementById('ts-analytics-modal').classList.remove('hidden');

        try {
            const prs = await dbAction('pr_requests', 'readonly', s => s.getAll());
            const inv = await dbAction('inventory', 'readonly', s => s.getAll());

            let totalPRVal = 0;
            const costData = {};
            const distData = {};

            prs.forEach(p => {
                if(p.status !== 'Cancelled' && p.status !== 'Received') {
                    const val = (p.quantity || 0) * (p.unitPrice || 0);
                    totalPRVal += val;
                    const cat = p.category || 'Uncategorized';
                    costData[cat] = (costData[cat] || 0) + val;
                }
            });

            inv.forEach(i => { distData[i.category] = (distData[i.category] || 0) + 1; });
            
            const totalInvValElement = document.getElementById('dash-pr-value');
            let totalInvVal = 0;
            if (totalInvValElement) totalInvVal = parseFloat(totalInvValElement.innerText.replace(/[^0-9.-]+/g,""));

            document.getElementById('ts-total-val').innerText = '₱' + totalPRVal.toLocaleString('en-US', {minimumFractionDigits:2});
            document.getElementById('ts-inventory-val').innerText = '₱' + totalInvVal.toLocaleString('en-US', {minimumFractionDigits:2});
            document.getElementById('ts-total-req').innerText = prs.filter(p => p.status !== 'Received' && p.status !== 'Cancelled').length;

            this.renderCharts(costData, distData);

        } catch (error) {
            this.showToast(`Analytics Error: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    renderCharts(costData, distData) {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        
        const ctx1 = document.getElementById('ts-cost-chart');
        if(Chart.getChart(ctx1)) Chart.getChart(ctx1).destroy();
        
        const ctx1_2d = ctx1.getContext('2d');
        const grad = ctx1_2d.createLinearGradient(0,0,0,300);
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.7)'); grad.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

        new Chart(ctx1_2d, {
            type: 'bar',
            data: { labels: Object.keys(costData), datasets: [{ label: 'Cost (PHP)', data: Object.values(costData), backgroundColor: grad, borderColor: '#10b981', borderWidth: 1, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: textColor } }, x: { ticks: { color: textColor } } } }
        });

        const ctx2 = document.getElementById('ts-dist-chart');
        if(Chart.getChart(ctx2)) Chart.getChart(ctx2).destroy();

        new Chart(ctx2, {
            type: 'doughnut',
            data: { labels: Object.keys(distData), datasets: [{ data: Object.values(distData), backgroundColor: ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'], borderWidth: 0, hoverOffset: 10 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 20 } } }, cutout: '65%' }
        });
    }

    // --- BACKUP & RESTORE (Supabase Batch Optimized) ---
    async backupData() {
        this.showLoader("Generating system backup...");
        try {
            const data = {};
            const stores = ['inventory', 'requests', 'pr_requests', 'logs', 'master'];
            for(const s of stores) data[s] = await dbAction(s, 'readonly', store => store.getAll());
            
            data.meta = { version: this.version, date: new Date().toISOString() };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `TRANS_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            this.showToast('Backup Downloaded Successfully', 'success');
        } catch (error) {
            this.showToast(`Backup failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async restoreData(input) {
        if(!input.files.length) return;
        if(!confirm("⚠️ Overwrite current CLOUD data with this backup? This action cannot be reversed.")) return;
        
        this.showLoader("Restoring data to Cloud. Please wait...");
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if(!data.inventory || !data.master) throw new Error("Invalid or corrupt backup file.");
                
                const stores = ['inventory', 'requests', 'pr_requests', 'logs', 'master'];
                
                for(const s of stores) {
                    if(data[s] && data[s].length > 0) {
                        // 1. Clear Table
                        await dbAction(s, 'readwrite', st => st.clear());

                        // 2. Batch Insert Optimization for Supabase
                        if (window.supabase && s !== 'master') {
                            const cleanData = data[s].map(item => {
                                // Keep IDs to maintain history if possible, else Supabase auto-increments
                                // For simplicity in this suite, we remove ID to avoid sequence conflicts 
                                // unless strict ID matching is needed.
                                const { id, ...rest } = item; 
                                return rest; 
                            });
                            
                            // Insert in chunks of 100 to avoid payload limits
                            const chunkSize = 100;
                            for (let i = 0; i < cleanData.length; i += chunkSize) {
                                const chunk = cleanData.slice(i, i + chunkSize);
                                const { error } = await window.supabase.from(s).insert(chunk);
                                if(error) throw error;
                            }
                        } else {
                            // Fallback for non-Supabase or Master data
                            const tx = db.transaction(s, 'readwrite'); // Assuming old db var exists if no supabase
                            data[s].forEach(item => { if (s !== 'master') delete item.id; dbAction(s, 'readwrite', st => st.add(item)); });
                        }
                    }
                }
                this.showToast('Restore successful! Reloading...', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch(err) { 
                this.showToast(`Restore Error: ${err.message}`, 'error'); 
            } finally {
                this.hideLoader();
            }
        };
        reader.readAsText(input.files[0]);
    }

    // --- DATA HELPERS (CSV & Label) ---
    downloadTemplate() {
        const csv = "MaterialCode,Description,Category,Stock,Unit,Location,Threshold\nMTRL-001,Heavy Duty Oil Filter,Fluids,100,Pcs,A-01,10";
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        a.download = 'inventory_template.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

    openBulkImport() {
        const i = document.createElement('input');
        i.type='file'; i.accept='.csv';
        i.onchange=e=>this.processCSV(e.target.files[0]);
        i.click();
    }

    processCSV(file) {
        if(!file) return;
        this.showLoader("Importing items to Cloud...");
        
        const r = new FileReader();
        r.onload = async (e) => {
            try {
                const lines = e.target.result.split('\n');
                const itemsToAdd = [];
                
                for(let i=1; i<lines.length; i++) {
                    const c = lines[i].split(',');
                    if(c.length >= 4 && c[0].trim() && c[1].trim()) { 
                        itemsToAdd.push({
                            code: c[0].trim()||`CSV-${Date.now()}`, 
                            name: c[1].trim()||'Unknown', 
                            category: c[2]?.trim()||'Misc',
                            stock: parseInt(c[3])||0, 
                            unit: c[4]?.trim()||'Pcs', 
                            location: c[5]?.trim()||'', 
                            threshold: parseInt(c[6])||5
                        });
                    }
                }

                if (itemsToAdd.length > 0) {
                    if (window.supabase) {
                        const { error } = await window.supabase.from('inventory').insert(itemsToAdd);
                        if (error) throw error;
                    } else {
                        // Fallback loop
                        for (const item of itemsToAdd) await dbAction('inventory','readwrite',s=>s.add(item));
                    }
                }

                this.showToast(`Imported ${itemsToAdd.length} items. Refreshing...`, 'success');
                if (typeof renderInventory === 'function') renderInventory();
                if (typeof renderDashboard === 'function') renderDashboard();

            } catch (error) {
                this.showToast(`Import failed: ${error.message}`, 'error');
            } finally {
                this.hideLoader();
            }
        };
        r.readAsText(file);
    }

    setupTableObserver() {
        const obs = new MutationObserver((muts) => {
            muts.forEach(m => {
                m.addedNodes.forEach(n => {
                    if(n.nodeName === 'TR' && n.parentElement?.id === 'inventory-body') {
                        const div = n.querySelector('td:last-child div');
                        if(div && !div.querySelector('.btn-lbl')) {
                            const btn = document.createElement('button');
                            btn.className = "btn-lbl text-purple-600 hover:bg-purple-100 dark:hover:bg-slate-700 p-1.5 rounded transition";
                            btn.innerHTML = '<i class="fas fa-tag"></i>';
                            btn.title = "Print Label";
                            const editBtn = div.querySelector('button[onclick*="editInventory"]');
                            if(editBtn) {
                                const idMatch = editBtn.getAttribute('onclick').match(/\d+/);
                                if(idMatch) {
                                    const id = idMatch[0];
                                    btn.onclick = () => this.printLabel(id);
                                    div.prepend(btn);
                                }
                            }
                        }
                    }
                });
            });
        });
        const target = document.getElementById('inventory-body');
        if(target) obs.observe(target, {childList:true});
    }

    async printLabel(id) {
        const item = await dbAction('inventory', 'readonly', s => s.get(parseInt(id)));
        if (!item) { this.showToast("Item not found.", 'error'); return; }

        const qrData = {
            id: item.id,
            code: item.code || 'N/A',
            name: item.name,
            stock: item.stock,
            unit: item.unit,
            loc: item.location || 'N/A',
            cat: item.category || 'N/A',
            threshold: item.threshold || 5,
            sds: item.sds || 'N/A'
        };
        const qrText = JSON.stringify(qrData);
        const sdsLinkHtml = item.sds ? 
            `<a href="${item.sds}" target="_blank" class="text-xs text-blue-600 font-bold underline block mt-2 break-all">VIEW DOCUMENT / SDS</a>` : 
            `<span class="text-xs text-gray-500 block mt-2">No SDS/Datasheet Link Available</span>`;

        const w = window.open('', '', 'width=450,height=550');
        w.document.write(`
            <html><head><title>Label: ${item.code}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: 4in 6in; margin: 0.25in; }
                body { font-family: sans-serif; }
                .label-container { height: 5.5in; width: 3.5in; padding: 0.1in; }
            </style>
            </head>
            <body class="flex justify-center items-center h-screen bg-white">
            <div class="label-container border-2 border-black flex flex-col justify-between">
                <div class="border-b-4 border-black pb-2">
                    <h1 class="text-3xl font-black break-all leading-none">${item.code}</h1>
                    <p class="text-xs font-bold text-gray-500 uppercase">Stock: ${item.stock} ${item.unit}</p>
                </div>
                <div class="flex-1 py-4 flex flex-col justify-between">
                    <div><p class="text-lg font-bold leading-tight mb-2">${item.name}</p>${sdsLinkHtml}</div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div class="bg-gray-100 p-1"><span class="text-[10px] block font-bold text-gray-600">CATEGORY</span><span class="font-bold">${item.category}</span></div>
                        <div class="bg-gray-100 p-1"><span class="text-[10px] block font-bold text-gray-600">LOCATION</span><span class="font-bold">${item.location||'N/A'}</span></div>
                        <div class="bg-gray-100 p-1 col-span-2"><span class="text-[10px] block font-bold text-gray-600">LOW THRESHOLD</span><span class="font-bold text-red-600">${item.threshold||5} ${item.unit}</span></div>
                    </div>
                </div>
                <div class="border-t-4 border-black pt-2 flex justify-between items-end">
                    <div id="qr"></div>
                    <div class="text-right">
                        <p class="text-[8px] font-mono text-gray-600">Scan for Full Data (JSON)</p>
                        <p class="text-xs font-mono text-gray-600">Generated: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
                new QRCode(document.getElementById("qr"), {text:'${qrText.replace(/'/g, "\\'")}', width:90, height:90, correctLevel : QRCode.CorrectLevel.H});
                setTimeout(()=>window.print(), 1000); 
            </script>
            </body></html>
        `);
        w.document.close();
    }

    // --- COMMAND PALETTE ---
    injectCommandPalette() {
        if(document.getElementById('ts-cmd-palette')) return;
        const el = document.createElement('div');
        el.id = 'ts-cmd-palette';
        el.className = "fixed inset-0 z-[3000] hidden bg-slate-900/60 backdrop-blur-sm flex justify-center pt-[15vh]";
        el.innerHTML = `
            <div class="ts-glass w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] mx-4 bg-white dark:bg-slate-800">
                <div class="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
                    <i class="fas fa-search text-slate-400"></i>
                    <input type="text" id="ts-cmd-input" placeholder="Search commands, items, or PRs (Ctrl+K)..." class="flex-1 bg-transparent outline-none text-lg text-slate-700 dark:text-slate-200">
                    <span class="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-400">ESC</span>
                </div>
                <div id="ts-cmd-results" class="overflow-y-auto p-2"></div>
            </div>
        `;
        document.body.appendChild(el);

        const input = document.getElementById('ts-cmd-input');
        const results = document.getElementById('ts-cmd-results');
        
        const commands = [
            { t:'Analytics', d:'Open Financial Overview', i:'fa-chart-pie', a:()=>this.openAnalyticsModal() },
            { t:'Dashboard', d:'Go to Home', i:'fa-chart-line', a:()=>document.querySelector('[onclick*="view-dashboard"]').click() },
            { t:'Inventory', d:'Manage Items', i:'fa-boxes-stacked', a:()=>document.getElementById('nav-inventory').click() },
            { t:'Withdrawal Requests', d:'Review Approvals', i:'fa-file-signature', a:()=>document.getElementById('nav-requests').click() },
            { t:'PR List', d:'Manage Purchase Requests', i:'fa-list-check', a:()=>document.querySelector('[onclick*="view-pr-requests"]').click() },
            { t:'Add Stock', d:'Open Add Item Form', i:'fa-plus-circle', a:()=>document.querySelector('[onclick*="view-add-item"]').click() },
            { t:'Backup Data', d:'Download System Backup', i:'fa-download', a:()=>this.backupData() },
            { t:'Theme', d:'Toggle Dark/Light Mode', i:'fa-adjust', a:()=>toggleDarkMode() },
            { t:'Calculator', d:'Open Floating Calculator', i:'fa-calculator', a:()=>toggleCalculator() }
        ];

        const render = async (q) => {
            q = q.toLowerCase().trim();
            let resultsHTML = '';
            
            const filteredCommands = commands.filter(c => c.t.toLowerCase().includes(q));
            resultsHTML += filteredCommands.map(c => {
                const actionString = c.a.toString().replace('() => ', '').replace('() {', '{').slice(0, -1);
                return `<div class="p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-3 transition" onclick="document.getElementById('ts-cmd-palette').classList.add('hidden'); ${actionString}"><div class="w-8 h-8 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500"><i class="fas ${c.i}"></i></div><div><div class="font-bold text-sm text-slate-700 dark:text-slate-200">${c.t}</div><div class="text-xs text-slate-400">${c.d}</div></div></div>`;
            }).join('');

            if (q.length > 2) {
                const inv = await dbAction('inventory', 'readonly', s => s.getAll());
                const prs = await dbAction('pr_requests', 'readonly', s => s.getAll());

                inv.filter(i => (i.code || '').toLowerCase().includes(q) || i.name.toLowerCase().includes(q)).slice(0, 3).forEach(i => {
                    resultsHTML += `<div class="p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-3 transition border-t dark:border-slate-700 mt-1" onclick="document.getElementById('ts-cmd-palette').classList.add('hidden'); viewInventory(${i.id});"><div class="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><i class="fas fa-cube"></i></div><div><div class="font-bold text-sm text-slate-700 dark:text-slate-200">${i.name}</div><div class="text-xs text-slate-400">Inventory | Stock: ${i.stock} | ${i.code}</div></div></div>`;
                });
                
                prs.filter(p => (p.materialCode || '').toLowerCase().includes(q) || p.materialDescription.toLowerCase().includes(q)).slice(0, 3).forEach(p => {
                    resultsHTML += `<div class="p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-3 transition border-t dark:border-slate-700 mt-1" onclick="document.getElementById('ts-cmd-palette').classList.add('hidden'); openPRViewModal(${p.id});"><div class="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600"><i class="fas fa-file-invoice"></i></div><div><div class="font-bold text-sm text-slate-700 dark:text-slate-200">${p.materialDescription}</div><div class="text-xs text-slate-400">PR | Status: ${p.status} | PR# ${p.prNumber||'N/A'}</div></div></div>`;
                });
            }
            results.innerHTML = resultsHTML || '<div class="p-4 text-center text-slate-400 italic">No results found.</div>';
        };

        input.addEventListener('input', e => render(e.target.value));
        input.addEventListener('keyup', e => { if (e.key === 'Enter') results.querySelector('.cursor-pointer')?.click(); });
        document.addEventListener('keydown', e => {
            if((e.ctrlKey||e.metaKey) && e.key === 'k') { e.preventDefault(); el.classList.remove('hidden'); input.focus(); render(''); }
            if(e.key === 'Escape') el.classList.add('hidden');
        });
        el.addEventListener('click', e => { if(e.target===el) el.classList.add('hidden'); });
    }

    runHealthCheck() {
        if(typeof dbAction === 'function') {
            dbAction('inventory', 'readonly', s => s.count()).then(c => {
                if(c === 0) this.showToast('System Ready. Connected to Cloud.', 'info');
            });
        }
    }

    showToast(msg, type) { if(typeof showToast === 'function') showToast(msg, type); else console.log(`[Toast]: ${msg}`); }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            if(e.key.toLowerCase() === 'r' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                this.showLoader('Refreshing data...');
                location.reload();
            }
        });
    }
}

// Initialize Extension
const ext = new TransSystemUltimate();