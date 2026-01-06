/**
 * --- DISPOSAL LOG ANALYTICS SUITE ---
 * Version: 3.1 (Robust / ES6+ / Secure Events)
 * Architecture: Stateful Service-Oriented Class
 */

class DisposalAnalyticsService {
    
    constructor() {
        if (DisposalAnalyticsService.instance) return DisposalAnalyticsService.instance;
        
        // Reactive State
        this.state = {
            viewMode: 'type',   // 'type' | 'trend'
            timeFilter: 'all',  // 'all' | '30' | '90' | '365'
            isLoading: false,
            processedData: null
        };
        
        // DOM ID Constants (Single Source of Truth)
        this.ids = {
            container: 'disposal-analytics-container',
            canvas: 'disposal-trend-canvas',
            kpiVolume: 'kpi-disp-volume',
            kpiCount: 'kpi-disp-count',
            kpiTop: 'kpi-disp-top',
            filterSelect: 'disposal-time-filter',
            viewToggle: 'disposal-view-toggle',
            exportBtn: 'disposal-export-btn',
            closeBtn: 'disposal-close-btn',
            triggerBtn: 'disposal-trigger-btn',
            loader: 'disposal-loader',
            emptyState: 'disposal-empty-state'
        };

        this.chartInstance = null;
        DisposalAnalyticsService.instance = this;
    }

    /**
     * CORE: INITIALIZATION
     */
    init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._bootstrap());
        } else {
            this._bootstrap();
        }
    }

    _bootstrap() {
        // Dependency Check
        const deps = [
            { name: 'Chart.js', valid: typeof Chart !== 'undefined' },
            { name: 'jQuery', valid: typeof $ !== 'undefined' },
            { name: 'SweetAlert2', valid: typeof Swal !== 'undefined' }
        ];

        const missing = deps.filter(d => !d.valid);
        if (missing.length > 0) {
            console.error(`DisposalAnalytics: Missing dependencies: ${missing.map(m => m.name).join(', ')}`);
            return;
        }

        this._injectUI();
        this._bindInternalEvents();
        this._bindExternalTableEvents();
        console.log("Disposal Analytics v3.1: Initialized");
    }

    /**
     * UI: INJECT DASHBOARD
     * Note: Removed inline onclick handlers for better security/separation of concerns
     */
    _injectUI() {
        if (document.getElementById(this.ids.container)) return;

        const uiTemplate = `
            <div id="${this.ids.container}" class="hidden col-span-1 lg:col-span-3 card bg-white border border-slate-200 shadow-md mb-6 rounded-xl overflow-hidden animate-fade-in-down">
                
                <!-- Header Toolbar -->
                <div class="px-5 py-3 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50">
                    <h3 class="font-bold text-slate-700 flex items-center gap-2">
                        <span class="bg-red-100 text-red-600 p-1.5 rounded-lg"><i class="fas fa-chart-pie"></i></span>
                        <span>Disposal Intelligence</span>
                        <span id="${this.ids.loader}" class="hidden ml-2 text-xs text-slate-400"><i class="fas fa-circle-notch fa-spin"></i> Processing...</span>
                    </h3>
                    
                    <div class="flex items-center gap-2">
                        <!-- Time Filter -->
                        <div class="relative">
                            <i class="fas fa-calendar-alt absolute left-2.5 top-2 text-slate-400 text-xs"></i>
                            <select id="${this.ids.filterSelect}" class="pl-8 py-1 text-xs border-slate-200 rounded-lg shadow-sm focus:border-royal-500 focus:ring-royal-500 font-medium text-slate-600 cursor-pointer">
                                <option value="all">All History</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last 90 Days</option>
                                <option value="365">Last Year</option>
                            </select>
                        </div>

                        <!-- View Toggle -->
                        <button id="${this.ids.viewToggle}" class="btn-xs bg-white text-slate-600 border border-slate-200 hover:border-royal-400 hover:text-royal-600 rounded-lg px-3 py-1 text-xs font-semibold transition shadow-sm">
                            <i class="fas fa-exchange-alt mr-1"></i> Toggle View
                        </button>
                        
                        <!-- Actions -->
                        <div class="h-4 w-px bg-slate-300 mx-1"></div>
                        <button id="${this.ids.exportBtn}" title="Download CSV" class="text-slate-400 hover:text-emerald-600 transition p-1"><i class="fas fa-file-download"></i></button>
                        <button id="${this.ids.closeBtn}" title="Close" class="text-slate-400 hover:text-red-500 transition p-1"><i class="fas fa-times"></i></button>
                    </div>
                </div>

                <div class="p-5">
                    <!-- KPI Cards -->
                    <div class="grid grid-cols-3 gap-4 mb-6">
                        <div class="bg-blue-50/50 border border-blue-100 p-3 rounded-lg text-center transition hover:shadow-sm">
                            <div class="text-xs text-blue-500 font-bold uppercase tracking-wide">Total Volume</div>
                            <div id="${this.ids.kpiVolume}" class="text-xl font-bold text-slate-700 mt-1">-</div>
                        </div>
                        <div class="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg text-center transition hover:shadow-sm">
                            <div class="text-xs text-emerald-500 font-bold uppercase tracking-wide">Requests</div>
                            <div id="${this.ids.kpiCount}" class="text-xl font-bold text-slate-700 mt-1">-</div>
                        </div>
                        <div class="bg-purple-50/50 border border-purple-100 p-3 rounded-lg text-center transition hover:shadow-sm">
                            <div class="text-xs text-purple-500 font-bold uppercase tracking-wide">Top Category</div>
                            <div id="${this.ids.kpiTop}" class="text-lg font-bold text-slate-700 mt-1 truncate">-</div>
                        </div>
                    </div>

                    <!-- Chart Area -->
                    <div class="h-72 w-full relative">
                        <canvas id="${this.ids.canvas}"></canvas>
                        <div id="${this.ids.emptyState}" class="hidden absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm bg-white/90 z-10">
                            <i class="fas fa-inbox text-3xl mb-2 text-slate-300"></i>
                            <span class="italic">No disposal data found for this period.</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Floating Trigger -->
            <div class="col-span-full mb-4 flex justify-end">
                <button id="${this.ids.triggerBtn}" class="group bg-white border border-slate-300 text-slate-600 hover:border-royal-500 hover:text-royal-600 shadow-sm px-4 py-2 rounded-full text-sm font-medium transition-all duration-300">
                    <i class="fas fa-magic mr-2 text-slate-400 group-hover:text-royal-500"></i> Disposal Analytics
                </button>
            </div>
        `;

        // Safe Injection
        const target = document.querySelector('#disposal h1.page-title');
        if (target) {
            target.insertAdjacentHTML('afterend', uiTemplate);
        } else {
            // Fallback if page structure changes
            document.querySelector('.container-fluid')?.prepend(document.createRange().createContextualFragment(uiTemplate));
        }
    }

    /**
     * EVENT BINDING: INTERNAL UI
     */
    _bindInternalEvents() {
        const el = (id) => document.getElementById(id);

        el(this.ids.triggerBtn)?.addEventListener('click', () => this.open());
        el(this.ids.closeBtn)?.addEventListener('click', () => this.close());
        el(this.ids.exportBtn)?.addEventListener('click', () => this.exportCSV());
        el(this.ids.viewToggle)?.addEventListener('click', () => this.toggleView());
        
        el(this.ids.filterSelect)?.addEventListener('change', (e) => {
            this.state.timeFilter = e.target.value;
            this._refresh();
        });
    }

    /**
     * EVENT BINDING: EXTERNAL TABLE INTERACTION
     */
    _bindExternalTableEvents() {
        // Delegated event listener using jQuery for existing table compatibility
        $(document).on('click', '#tbl-disp-hist tr', (e) => {
            const row = $(e.currentTarget);
            // Robust finding of the reference number (usually 2nd column)
            const refNo = row.find('td').eq(1).text().trim();
            
            if (refNo && refNo.startsWith('DISP')) {
                // Visual feedback
                row.siblings().removeClass('bg-yellow-50 ring-2 ring-inset ring-yellow-200');
                row.addClass('bg-yellow-50 ring-2 ring-inset ring-yellow-200');
                
                this.showDetails(refNo);
            }
        });
    }

    /**
     * DATA ENGINE: CALCULATE & AGGREGATE
     */
    _calculateData() {
        this._setLoading(true);
        
        try {
            // Check global variable existence safely
            const cache = (typeof wrCache !== 'undefined' && Array.isArray(wrCache)) ? wrCache : [];
            if (cache.length === 0) return this._getEmptyStats();

            const cutoffDate = new Date();
            const filterDays = parseInt(this.state.timeFilter);
            
            if (this.state.timeFilter !== 'all' && !isNaN(filterDays)) {
                cutoffDate.setDate(cutoffDate.getDate() - filterDays);
            }

            // High Performance Filtering
            const filteredLogs = cache.filter(wr => {
                // Safety Checks
                if (!wr || !wr.created_at) return false;

                const isDisposal = (wr.department === 'DISPOSAL' || wr.wr_number?.startsWith('DISP'));
                const isNotCancelled = wr.status !== 'CANCELLED';
                const wrDate = new Date(wr.created_at);
                const isWithinTime = this.state.timeFilter === 'all' || wrDate >= cutoffDate;
                
                return isDisposal && isNotCancelled && isWithinTime;
            });

            // Aggregation
            const stats = {
                totalVolume: 0,
                requestCount: filteredLogs.length,
                byType: {},
                byDate: {},
                topType: 'N/A'
            };

            filteredLogs.forEach(wr => {
                // Robust parsing of pipe-separated remarks
                const remarks = wr.remarks ?? "";
                const type = remarks.includes('|') 
                    ? remarks.split('|')[0].trim() 
                    : (remarks.trim() || "Unclassified");

                // Date Key (YYYY-MM)
                const dateKey = wr.created_at.substring(0, 7);

                // Safe Quantity Summation
                const qty = (wr.wr_items ?? []).reduce((sum, item) => {
                    const val = parseFloat(item.quantity_requested);
                    return sum + (isNaN(val) ? 0 : val);
                }, 0);

                stats.totalVolume += qty;
                
                // Maps
                stats.byType[type] = (stats.byType[type] || 0) + qty;
                stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + qty;
            });

            // Determine Top Category
            if (Object.keys(stats.byType).length > 0) {
                stats.topType = Object.entries(stats.byType)
                    .reduce((a, b) => a[1] > b[1] ? a : b)[0];
            }

            this.state.processedData = stats;
            return stats;

        } catch (error) {
            console.error("Analytics Calculation Error:", error);
            return this._getEmptyStats();
        } finally {
            this._setLoading(false);
        }
    }

    _getEmptyStats() {
        return { totalVolume: 0, requestCount: 0, byType: {}, byDate: {}, topType: '-' };
    }

    /**
     * RENDERER
     */
    _render(data) {
        if (!data) data = this._calculateData();

        // Safe DOM updates
        const updateText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        const fmt = new Intl.NumberFormat('en-US');

        updateText(this.ids.kpiVolume, fmt.format(data.totalVolume));
        updateText(this.ids.kpiCount, fmt.format(data.requestCount));
        updateText(this.ids.kpiTop, data.topType);
        
        // Handle Chart Visibility
        const emptyState = document.getElementById(this.ids.emptyState);
        const canvas = document.getElementById(this.ids.canvas);

        if (data.requestCount === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (this.chartInstance) {
                this.chartInstance.destroy();
                this.chartInstance = null;
            }
            return;
        } else {
            if (emptyState) emptyState.classList.add('hidden');
        }

        this._drawChart(canvas, data);
    }

    _drawChart(canvas, data) {
        if (!canvas) return;
        
        // Clean previous instance
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        const config = this.state.viewMode === 'type' 
            ? this._getConfigDoughnut(data.byType) 
            : this._getConfigBar(ctx, data.byDate);

        this.chartInstance = new Chart(ctx, config);
    }

    // Chart Configuration Strategies
    _getConfigDoughnut(dataMap) {
        return {
            type: 'doughnut',
            data: {
                labels: Object.keys(dataMap),
                datasets: [{
                    data: Object.values(dataMap),
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b', '#ec4899'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                animation: { animateScale: true, animateRotate: true },
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, padding: 20 } }
                }
            }
        };
    }

    _getConfigBar(ctx, dataMap) {
        const sortedKeys = Object.keys(dataMap).sort();
        const values = sortedKeys.map(k => dataMap[k]);

        // Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, '#3b82f6'); 
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');

        return {
            type: 'bar',
            data: {
                labels: sortedKeys,
                datasets: [{
                    label: 'Volume',
                    data: values,
                    backgroundColor: gradient,
                    borderRadius: 5,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [4, 4], color: '#e2e8f0' } },
                    x: { grid: { display: false } }
                }
            }
        };
    }

    /**
     * UI LOGIC: MODAL
     */
    showDetails(wrNumber) {
        // Find record safely
        const cache = (typeof wrCache !== 'undefined') ? wrCache : [];
        const record = cache.find(w => w.wr_number === wrNumber);
        
        if (!record) {
            Swal.fire({ icon: 'error', title: 'Record Not Found', text: `Could not locate data for ${wrNumber}` });
            return;
        }

        // Parsing
        const rawRemarks = record.remarks ?? "";
        const parts = rawRemarks.split('|');
        const meta = {
            type: parts[0]?.trim() || "General",
            dest: parts[1]?.trim() || "Unknown",
            reason: parts[2]?.trim() || "No specific reason logged."
        };

        // Inventory lookup safely
        const getDesc = (code) => {
            if (typeof invCache === 'undefined') return "Unknown Item";
            return invCache.find(i => i.material_code === code)?.description || "Unknown Item";
        };

        const rowsHtml = (record.wr_items || []).map(item => `
            <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td class="py-2.5 px-3 text-xs font-mono text-slate-500">${item.material_code}</td>
                <td class="py-2.5 px-3 text-xs font-medium text-slate-700">${getDesc(item.material_code)}</td>
                <td class="py-2.5 px-3 text-xs font-bold text-right text-royal-600">${parseFloat(item.quantity_requested || 0)}</td>
            </tr>
        `).join('');

        Swal.fire({
            html: `
                <div class="text-left font-sans">
                    <div class="flex justify-between items-start mb-5 pb-3 border-b border-slate-100">
                        <div>
                            <h3 class="text-xl font-bold text-slate-800">${record.wr_number}</h3>
                            <div class="text-xs text-slate-400 mt-1">
                                <i class="fas fa-user-circle mr-1"></i> ${record.requester_name || 'System'} 
                                <span class="mx-2">•</span> 
                                <i class="far fa-clock mr-1"></i> ${new Date(record.created_at).toLocaleDateString()}
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                            ${meta.type}
                        </span>
                    </div>
                    
                    <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-5 relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
                        <p class="text-sm text-slate-600 italic">"${meta.reason}"</p>
                    </div>

                    <div class="border rounded-lg overflow-hidden border-slate-200 shadow-sm">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                                <tr>
                                    <th class="py-2 px-3">Code</th>
                                    <th class="py-2 px-3">Description</th>
                                    <th class="py-2 px-3 text-right">Qty</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            width: '600px',
            customClass: { popup: 'rounded-xl shadow-xl' }
        });
    }

    /**
     * UTILS
     */
    _setLoading(active) {
        this.state.isLoading = active;
        const loader = document.getElementById(this.ids.loader);
        if (loader) {
            active ? loader.classList.remove('hidden') : loader.classList.add('hidden');
        }
    }

    _refresh() {
        this._render();
    }

    // --- Public API ---

    open() {
        const container = document.getElementById(this.ids.container);
        if (!container) return;
        
        container.classList.remove('hidden');
        $(container).hide().slideDown(300); // jQuery for smooth slide
        
        // Use requestAnimationFrame to render after DOM updates
        requestAnimationFrame(() => this._render());
    }

    close() {
        $(`#${this.ids.container}`).slideUp(300);
    }

    toggleView() {
        this.state.viewMode = this.state.viewMode === 'type' ? 'trend' : 'type';
        this._refresh();
    }

    exportCSV() {
        if (!this.state.processedData) return;
        
        try {
            const data = this.state.processedData;
            const dateStr = new Date().toISOString().slice(0,10);
            
            // CSV Injection Protection: Escape fields starting with sensitive chars
            const sanitize = (val) => {
                const str = String(val);
                const dangerous = ['=', '+', '-', '@'];
                return dangerous.includes(str[0]) ? `'${str}` : str;
            };

            const rows = [];
            rows.push(['Metric', 'Category/Date', 'Value']);
            rows.push(['Summary', 'Total Volume', sanitize(data.totalVolume)]);
            rows.push(['Summary', 'Total Request Count', sanitize(data.requestCount)]);
            
            Object.entries(data.byType).forEach(([k,v]) => rows.push(['Breakdown by Type', sanitize(k), sanitize(v)]));
            Object.entries(data.byDate).forEach(([k,v]) => rows.push(['Trend Data', sanitize(k), sanitize(v)]));

            const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n"); // Add BOM for Excel
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            
            link.href = url;
            link.download = `Disposal_Analytics_${dateStr}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Cleanup memory
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            const btn = document.getElementById(this.ids.exportBtn);
            if(btn) {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check text-emerald-500"></i>';
                setTimeout(() => btn.innerHTML = original, 2000);
            }

        } catch (e) {
            console.error("Export failed", e);
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Export failed' });
        }
    }
}

// Instantiate
new DisposalAnalyticsService().init();
const DisposalService = DisposalAnalyticsService.instance;
