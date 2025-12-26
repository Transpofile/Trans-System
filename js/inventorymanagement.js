/**
 * --- INVENTORY MANAGEMENT EXTENSION (RUBY EDITION V2) ---
 * Description: Advanced Reporting, Analytics, and Data Export Suite.
 * Features: Live KPI Dashboard, Multi-format Export, Deep Data Extraction.
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
        docx: 'https://cdn.jsdelivr.net/npm/docx@7.1.0/build/index.js'
    }
};

class InventoryExtension {
    constructor() {
        this.isLoading = false;
        this.init();
    }

    init() {
        console.log("%c [System] Initializing Data Studio...", "color: #be123c; font-weight: bold;");
        this.injectStyles();
        this.loadLibraries();
        this.injectSidebar();
        this.injectModal();
        this.attachGlobalListeners();
    }

    // --- 1. CORE STYLING & ASSETS ---
    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .ruby-gradient { background: linear-gradient(135deg, #be123c 0%, #881337 100%); }
            .ruby-text { color: #be123c; }
            .radio-card input:checked + div { border-color: #be123c; background-color: #fff1f2; box-shadow: 0 4px 6px -1px rgba(190, 18, 60, 0.1); }
            .radio-card input:checked + div i { color: #be123c; transform: scale(1.1); }
            
            .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: transform 0.2s; }
            .kpi-card:hover { transform: translateY(-2px); border-color: #fb7185; }
            
            .anim-fade-up { animation: fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes fadeUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            
            .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
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
        this.isLoading = false;
    }

    // --- 2. UI INJECTION ---
    injectSidebar() {
        const interval = setInterval(() => {
            const nav = $('#sidebar nav');
            if (nav.length) {
                clearInterval(interval);
                if ($('#nav-data-studio').length) return; // Prevent duplicate

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
            <div class="bg-slate-50 rounded-2xl shadow-2xl w-[95%] max-w-6xl h-[90vh] flex overflow-hidden anim-fade-up border border-slate-200 relative">
                
                <!-- Close Button -->
                <button onclick="window.InvExt.closeModal()" class="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white hover:bg-rose-500 text-slate-400 hover:text-white transition shadow-sm flex items-center justify-center border border-slate-200 hover:border-rose-500">
                    <i class="fas fa-times"></i>
                </button>

                <!-- LEFT PANEL: CONFIGURATION -->
                <div class="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-lg">
                    <div class="p-6 border-b border-slate-100">
                        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <i class="fas fa-layer-group text-rose-600"></i> Data Studio
                        </h2>
                        <p class="text-[11px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Report Generator</p>
                    </div>

                    <div class="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                        
                        <!-- Source Selection -->
                        <div>
                            <div class="flex justify-between items-center mb-3">
                                <label class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">1. Select Data Source</label>
                            </div>
                            <div class="space-y-3">
                                <label class="radio-card cursor-pointer block">
                                    <input type="radio" name="rb-source" value="inventory" checked class="hidden" onchange="window.InvExt.updatePreview()">
                                    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-3 transition-all bg-slate-50 hover:bg-white">
                                        <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><i class="fas fa-boxes"></i></div>
                                        <div>
                                            <div class="font-bold text-slate-700 text-sm">Inventory Assets</div>
                                            <div class="text-[10px] text-slate-400">Master list & stock levels</div>
                                        </div>
                                    </div>
                                </label>
                                <label class="radio-card cursor-pointer block">
                                    <input type="radio" name="rb-source" value="pr" class="hidden" onchange="window.InvExt.updatePreview()">
                                    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-3 transition-all bg-slate-50 hover:bg-white">
                                        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600"><i class="fas fa-arrow-down"></i></div>
                                        <div>
                                            <div class="font-bold text-slate-700 text-sm">Inbound (PR)</div>
                                            <div class="text-[10px] text-slate-400">Purchases & Receiving</div>
                                        </div>
                                    </div>
                                </label>
                                <label class="radio-card cursor-pointer block">
                                    <input type="radio" name="rb-source" value="wr" class="hidden" onchange="window.InvExt.updatePreview()">
                                    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-3 transition-all bg-slate-50 hover:bg-white">
                                        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600"><i class="fas fa-arrow-up"></i></div>
                                        <div>
                                            <div class="font-bold text-slate-700 text-sm">Outbound (WR)</div>
                                            <div class="text-[10px] text-slate-400">Withdrawals & Usage</div>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Filters -->
                        <div id="date-filter-group" class="transition-opacity duration-200">
                            <label class="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3 block">2. Date Filter</label>
                            <div class="flex gap-2 mb-3">
                                <button onclick="window.InvExt.setDates('month')" class="flex-1 py-1.5 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition bg-white">This Month</button>
                                <button onclick="window.InvExt.setDates('all')" class="flex-1 py-1.5 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition bg-white">All Time</button>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[9px] text-slate-400 block mb-1">From</label>
                                    <input type="date" id="exp-start" onchange="window.InvExt.updatePreview()" class="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none">
                                </div>
                                <div>
                                    <label class="text-[9px] text-slate-400 block mb-1">To</label>
                                    <input type="date" id="exp-end" onchange="window.InvExt.updatePreview()" class="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="p-6 bg-slate-50 border-t border-slate-200">
                        <label class="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3 block">3. Export Actions</label>
                        <div class="grid grid-cols-3 gap-2 mb-2">
                            <button onclick="window.InvExt.exportData('excel')" class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-500 transition shadow-sm group">
                                <i class="fas fa-file-excel text-emerald-500 text-xl mb-1 group-hover:scale-110 transition"></i>
                                <span class="text-[9px] font-bold text-slate-500">Excel</span>
                            </button>
                            <button onclick="window.InvExt.exportData('pdf')" class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:bg-rose-50 hover:border-rose-500 transition shadow-sm group">
                                <i class="fas fa-file-pdf text-rose-500 text-xl mb-1 group-hover:scale-110 transition"></i>
                                <span class="text-[9px] font-bold text-slate-500">PDF</span>
                            </button>
                            <button onclick="window.InvExt.printData()" class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-500 transition shadow-sm group">
                                <i class="fas fa-print text-slate-600 text-xl mb-1 group-hover:scale-110 transition"></i>
                                <span class="text-[9px] font-bold text-slate-500">Print</span>
                            </button>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                             <button onclick="window.InvExt.exportData('csv')" class="text-[10px] py-1 text-slate-400 hover:text-slate-600">CSV</button>
                             <button onclick="window.InvExt.exportData('word')" class="text-[10px] py-1 text-slate-400 hover:text-blue-600">Word</button>
                             <button onclick="window.InvExt.exportData('ppt')" class="text-[10px] py-1 text-slate-400 hover:text-orange-600">PPT</button>
                        </div>
                    </div>
                </div>

                <!-- RIGHT PANEL: PREVIEW & KPI -->
                <div class="flex-1 flex flex-col bg-slate-50/50 relative">
                    
                    <!-- KPI Header -->
                    <div class="p-6 bg-white border-b border-slate-200 shadow-sm z-10">
                        <div class="flex justify-between items-center mb-4">
                            <div>
                                <h3 class="font-bold text-lg text-slate-800" id="preview-title">Dataset Preview</h3>
                                <p class="text-xs text-slate-500" id="preview-subtitle">Generated Snapshot</p>
                            </div>
                            <span id="preview-badge" class="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold border border-rose-200">
                                Live Data
                            </span>
                        </div>
                        
                        <!-- Quick Stats Grid -->
                        <div class="grid grid-cols-4 gap-4" id="kpi-container">
                            <!-- Dynamic KPIs injected here -->
                        </div>
                    </div>

                    <!-- Table Container -->
                    <div class="flex-1 p-6 overflow-hidden">
                        <div class="bg-white rounded-xl border border-slate-200 h-full flex flex-col shadow-sm">
                            <div class="flex-1 overflow-auto custom-scrollbar">
                                <table class="w-full text-left border-collapse">
                                    <thead class="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr id="preview-headers"></tr>
                                    </thead>
                                    <tbody id="preview-body" class="text-xs text-slate-600 divide-y divide-slate-100"></tbody>
                                </table>
                            </div>
                            <div class="p-2 border-t border-slate-100 bg-slate-50 text-center">
                                <p class="text-[10px] text-slate-400 font-medium italic">
                                    <i class="fas fa-info-circle mr-1"></i> Preview showing top 50 records. Exports contain full dataset.
                                </p>
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

    // --- 3. LOGIC & DATA PROCESSING ---
    
    openModal() {
        $('#ruby-export-modal').removeClass('hidden');
        this.setDates('all'); 
        this.updatePreview();
    }

    closeModal() {
        $('#ruby-export-modal').addClass('hidden');
    }

    setDates(range) {
        const now = new Date();
        const startEl = document.getElementById('exp-start');
        const endEl = document.getElementById('exp-end');
        
        if (range === 'today') {
            startEl.valueAsDate = now;
            endEl.valueAsDate = now;
        } else if (range === 'month') {
            startEl.valueAsDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endEl.valueAsDate = now;
        } else {
            startEl.value = '';
            endEl.value = '';
        }
        this.updatePreview();
    }

    // CORE DATA ENGINE
    getDataAndTitle() {
        const type = $('input[name="rb-source"]:checked').val();
        const start = $('#exp-start').val();
        const end = $('#exp-end').val();

        // Safety check for cache variables from script.js
        const _inv = (typeof invCache !== 'undefined') ? invCache : [];
        const _pr = (typeof prCache !== 'undefined') ? prCache : [];
        const _wr = (typeof wrCache !== 'undefined') ? wrCache : [];

        let data = [];
        let title = "Report";
        let kpi = { count: 0, qty: 0, val: 0 };

        const inRange = (dStr) => {
            if (!dStr) return false;
            if (!start && !end) return true;
            const d = new Date(dStr).setHours(0,0,0,0);
            const s = start ? new Date(start).setHours(0,0,0,0) : null;
            const e = end ? new Date(end).setHours(0,0,0,0) : null;
            if (s && d < s) return false;
            if (e && d > e) return false;
            return true;
        };

        const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
        const fmtMoney = (n) => n ? parseFloat(n).toFixed(2) : '0.00';

        if (type === 'inventory') {
            title = "Inventory Master List";
            $('#date-filter-group').addClass('opacity-50 pointer-events-none');
            
            data = _inv.map(i => {
                kpi.count++;
                kpi.qty += (i.current_stock || 0);
                return {
                    "Code": i.material_code,
                    "Description": i.description,
                    "Category": i.category || '-',
                    "Stock Qty": i.current_stock,
                    "UoM": i.uom,
                    "Status": i.current_stock <= 0 ? "OUT" : (i.current_stock <= i.low_stock_threshold ? "LOW" : "OK"),
                    "Total Out": i.total_withdrawn || 0,
                    "Remarks": i.remarks || ''
                };
            });

        } else if (type === 'pr') {
            title = "Purchase Request (Inbound) Log";
            $('#date-filter-group').removeClass('opacity-50 pointer-events-none');
            
            _pr.forEach(h => {
                if (inRange(h.created_at) && h.pr_items && h.pr_items.length) {
                    h.pr_items.forEach(i => {
                        const rowTotal = (i.quantity_requested || 0) * (i.unit_price || 0);
                        kpi.count++;
                        kpi.qty += (i.quantity_requested || 0);
                        kpi.val += rowTotal;

                        data.push({
                            "Date": fmtDate(h.created_at),
                            "PR No": h.pr_number,
                            "Requester": h.requester_name,
                            "Item Code": i.material_code,
                            "Part No": i.part_number || '-',
                            "Qty": i.quantity_requested,
                            "Unit Cost": fmtMoney(i.unit_price),
                            "Total Cost": fmtMoney(rowTotal),
                            "Purchaser": h.purchaser || '-',
                            "GL Account": h.gl_account || '-',
                            "ARF No": h.arf_number || '-',
                            "Status": h.status,
                            "Expected": fmtDate(h.expected_date),
                            "Received": fmtDate(h.date_received)
                        });
                    });
                }
            });

        } else if (type === 'wr') {
            title = "Withdrawal Request (Outbound) Log";
            $('#date-filter-group').removeClass('opacity-50 pointer-events-none');
            
            _wr.filter(w => !w.wr_number.startsWith('DISP')).forEach(h => {
                if (inRange(h.created_at) && h.wr_items && h.wr_items.length) {
                    h.wr_items.forEach(i => {
                        kpi.count++;
                        kpi.qty += (i.quantity_requested || 0);

                        data.push({
                            "Date": fmtDate(h.created_at),
                            "WR No": h.wr_number,
                            "Recipient": h.requester_name,
                            "Department": h.department,
                            "Item Code": i.material_code,
                            "Qty": i.quantity_requested,
                            "Status": h.status,
                            "Remarks": h.remarks || '-'
                        });
                    });
                }
            });
        }

        return { data, title, type, kpi };
    }

    updatePreview() {
        const { data, title, type, kpi } = this.getDataAndTitle();
        
        $('#preview-title').text(title);
        $('#preview-subtitle').text(`Generated: ${new Date().toLocaleString()}`);

        // Update KPI Cards
        const kpiHtml = `
            <div class="kpi-card">
                <div class="text-[10px] text-slate-400 uppercase font-bold">Total Records</div>
                <div class="text-2xl font-bold text-slate-700">${kpi.count.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
                <div class="text-[10px] text-slate-400 uppercase font-bold">Total Quantity</div>
                <div class="text-2xl font-bold text-blue-600">${kpi.qty.toLocaleString()}</div>
            </div>
            ${type === 'pr' ? `
            <div class="kpi-card">
                <div class="text-[10px] text-slate-400 uppercase font-bold">Total Value</div>
                <div class="text-2xl font-bold text-emerald-600">$${kpi.val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
            </div>
            ` : ''}
        `;
        $('#kpi-container').html(kpiHtml).removeClass().addClass(`grid grid-cols-${type==='pr'?3:2} gap-4`);

        // Render Table
        const $head = $('#preview-headers').empty();
        const $body = $('#preview-body').empty();

        if (data.length === 0) {
            $body.html('<tr><td colspan="10" class="p-10 text-center text-slate-400 flex flex-col items-center"><i class="fas fa-search text-3xl mb-2 opacity-50"></i><span>No records found matching criteria.</span></td></tr>');
            return;
        }

        const keys = Object.keys(data[0]);
        keys.forEach(k => $head.append(`<th class="p-3 text-[10px] font-bold uppercase text-slate-500 bg-slate-50 tracking-wider whitespace-nowrap border-b border-slate-200">${k}</th>`));

        data.slice(0, 50).forEach(row => {
            let tr = '<tr class="hover:bg-rose-50/50 transition group">';
            keys.forEach(k => {
                let val = row[k];
                // Styling
                if (k === 'Status') {
                    const color = val === 'OK' || val === 'Received' || val === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                                 (val === 'OUT' || val === 'Cancel' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700');
                    val = `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${color}">${val}</span>`;
                }
                tr += `<td class="p-2.5 whitespace-nowrap border-b border-slate-50 group-last:border-0">${val}</td>`;
            });
            tr += '</tr>';
            $body.append(tr);
        });
    }

    // --- 4. EXPORT HANDLERS ---
    
    async exportData(format) {
        const { data, title, type } = this.getDataAndTitle();
        if (data.length === 0) return Swal.fire('Empty Dataset', 'Nothing to export.', 'info');

        const filename = `${type.toUpperCase()}_Report_${new Date().toISOString().slice(0,10)}`;
        
        // Show Loading
        Swal.fire({
            title: 'Generating File...',
            html: `Processing ${data.length} records.`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            await new Promise(r => setTimeout(r, 500)); // UI delay

            switch (format) {
                case 'csv': this.toCSV(data, filename); break;
                case 'excel': this.toExcel(data, filename); break;
                case 'pdf': this.toPDF(data, filename, title); break;
                case 'word': await this.toWord(data, filename, title); break;
                case 'ppt': this.toPPT(data, filename, title); break;
            }

            Swal.close();
            const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 3000});
            Toast.fire({icon: 'success', title: 'Download Successful'});

        } catch (e) {
            Swal.fire('Export Failed', e.message, 'error');
        }
    }

    printData() {
        const { data, title } = this.getDataAndTitle();
        if (!data.length) return;
        
        let html = `<html><head><title>${title}</title><style>
            body{font-family:sans-serif;font-size:12px;} table{width:100%;border-collapse:collapse;} 
            th,td{border:1px solid #ddd;padding:6px;text-align:left;} th{background:#eee;}
            h1{color:#be123c;}
        </style></head><body>
        <h1>${title}</h1><p>Date: ${new Date().toLocaleString()}</p>
        <table><thead><tr>`;
        
        Object.keys(data[0]).forEach(k => html += `<th>${k}</th>`);
        html += `</tr></thead><tbody>`;
        
        data.forEach(row => {
            html += `<tr>`;
            Object.values(row).forEach(v => html += `<td>${v}</td>`);
            html += `</tr>`;
        });
        
        html += `</tbody></table></body></html>`;
        
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    }

    // -- FORMAT IMPLEMENTATIONS --

    toCSV(data, filename) {
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(','))
        ].join('\r\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.csv`; a.click();
    }

    toExcel(data, filename) {
        if (!window.XLSX) throw new Error("Excel Library not loaded");
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Auto-width columns
        const colWidths = Object.keys(data[0]).map(key => ({
            wch: Math.max(key.length, ...data.map(row => String(row[key]).length)) + 2
        }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report Data");
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    toPDF(data, filename, title) {
        if (!window.jspdf) throw new Error("PDF Library not loaded");
        const { jsPDF } = window.jspdf;
        
        // Auto-detect Orientation based on col count
        const colCount = Object.keys(data[0]).length;
        const orientation = colCount > 7 ? 'l' : 'p';
        const doc = new jsPDF({ orientation: orientation });

        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(190, 18, 60); // Rose 700
        doc.rect(0, 0, pageWidth, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, 13);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 13, { align: 'right' });

        const headers = [Object.keys(data[0])];
        const rows = data.map(obj => Object.values(obj).map(String));

        doc.autoTable({
            head: headers,
            body: rows,
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: [190, 18, 60], fontSize: 8, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [255, 241, 242] },
            styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
            margin: { top: 25 }
        });

        doc.save(`${filename}.pdf`);
    }

    toPPT(data, filename, title) {
        if (!window.PptxGenJS) throw new Error("PPT Library not loaded");
        let pptx = new PptxGenJS();
        
        // Slide 1: Cover
        let slide1 = pptx.addSlide();
        slide1.background = { color: "F8FAFC" };
        slide1.addText(title, { x: 1, y: 2, w: '80%', fontSize: 32, bold: true, color: 'BE123C' });
        slide1.addText(`Confidential Report`, { x: 1, y: 3, fontSize: 14, color: '64748B' });
        
        // Slide 2: Table
        let slide2 = pptx.addSlide();
        slide2.addText(title, { x: 0.5, y: 0.5, fontSize: 18, color: 'BE123C', bold: true });
        
        const keys = Object.keys(data[0]);
        const pptRows = [keys.map(k => ({ text: k, options: { fill: "BE123C", color: "FFFFFF", bold: true, fontSize: 10 } }))];
        
        data.slice(0, 20).forEach(row => { // Limit rows for PPT readability
            pptRows.push(Object.values(row).map(v => String(v)));
        });

        slide2.addTable(pptRows, { x: 0.5, y: 1.0, w: '90%', fontSize: 9, border: { color: "E2E8F0" }, autoPage: true });
        pptx.writeFile({ fileName: `${filename}.pptx` });
    }

    async toWord(data, filename, title) {
        if (!window.docx) throw new Error("Word Library not loaded");
        const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, ShadingType } = window.docx;

        const headers = Object.keys(data[0]);
        const tableRows = [
            new TableRow({
                children: headers.map(h => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 16 })] })],
                    shading: { fill: "BE123C", type: ShadingType.CLEAR, color: "auto" },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                }))
            })
        ];

        data.forEach(row => {
            tableRows.push(new TableRow({
                children: Object.values(row).map(v => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 16 })] })]
                }))
            }));
        });

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: title, size: 32, bold: true, color: "BE123C" })],
                        spacing: { after: 400 }
                    }),
                    new Table({
                        rows: tableRows,
                        width: { size: 100, type: WidthType.PERCENTAGE }
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.docx`; a.click();
    }
}

// --- INITIALIZE ---
$(document).ready(() => {
    // Slight delay to ensure main scripts are loaded
    setTimeout(() => new InventoryExtension(), 1000);
});
