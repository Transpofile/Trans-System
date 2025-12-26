/**
 * --- DISPOSAL LOG EXTENSION ---
 * Architecture: Service-Oriented (Java-Style Structure)
 * Logic: Functional Enumerable Processing (Ruby-Style Data Manipulation)
 */

class DisposalAnalyticsService {
    
    constructor() {
        // Singleton Instance Check (Java-like robustness)
        if (DisposalAnalyticsService.instance) return DisposalAnalyticsService.instance;
        
        this.chartInstance = null;
        this.containerId = 'disposal-analytics-container';
        this.canvasId = 'disposal-trend-canvas';
        DisposalAnalyticsService.instance = this;
    }

    /**
     * INITIALIZATION
     * Injects the UI components into the DOM safely.
     */
    init() {
        // Wait for jQuery and DOM
        $(document).ready(() => {
            this._injectUI();
            this._attachEventListeners();
            console.log("Disposal Analytics Extension: Initialized");
        });
    }

    /**
     * UI INJECTION
     * Adds the Graph container dynamically to the Disposal Section
     */
    _injectUI() {
        const targetSection = $('#disposal .grid'); // targeting the grid layout in disposal section
        
        // Java-style: Defensive check if already exists
        if ($(`#${this.containerId}`).length > 0) return;

        const uiTemplate = `
            <div id="${this.containerId}" class="col-span-1 lg:col-span-3 card p-5 mb-6 border-l-4 border-slate-700 bg-white shadow-sm hidden">
                <div class="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                    <h3 class="font-bold text-slate-700"><i class="fas fa-chart-bar text-red-600 mr-2"></i>Waste Stream Analysis</h3>
                    <button onclick="DisposalService.toggleVisibility()" class="text-slate-400 hover:text-royal-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="h-72 relative w-full">
                    <canvas id="${this.canvasId}"></canvas>
                </div>
                <div class="mt-4 text-xs text-slate-400 text-center italic">
                    Data aggregated from verified disposal logs.
                </div>
            </div>
            
            <!-- Floating Action Button for Analytics -->
            <div class="col-span-full mb-4 flex justify-end">
                <button onclick="DisposalService.refreshAndShow()" class="btn-secondary text-sm bg-white border border-slate-300 shadow-sm hover:text-royal-600">
                    <i class="fas fa-chart-pie mr-2"></i> View Waste Trends
                </button>
            </div>
        `;

        // Prepend to the grid or insert before the grid
        $('#disposal h1.page-title').after(uiTemplate);
    }

    /**
     * DATA PROCESSING (Ruby-Style)
     * Extracts Type of Waste from the composite 'remarks' string.
     * Logic: Enumerable.select -> map -> reduce
     */
    _processData() {
        // Accessing global wrCache from script.js
        if (typeof wrCache === 'undefined') return {};

        // RUBY-LIKE CHAINING: Filter -> Map -> Reduce (Tally)
        const wasteStats = wrCache
            .filter(wr => wr.department === 'DISPOSAL' || wr.wr_number.startsWith('DISP')) // Select logic
            .flatMap(wr => {
                // Parse the "Type | Dest | Reason" string
                // Java-style defensive parsing
                const parts = (wr.remarks || "").split('|');
                const wasteType = parts.length > 0 ? parts[0].trim() : "Unclassified";
                
                // Map items to their specific type and quantity
                return (wr.wr_items || []).map(item => ({
                    type: wasteType,
                    qty: item.quantity_requested || 0
                }));
            })
            .reduce((acc, curr) => {
                // Tally/Group By logic
                acc[curr.type] = (acc[curr.type] || 0) + curr.qty;
                return acc;
            }, {}); // Returns hash map { "Hazardous": 50, "Biodegradable": 20 }

        return wasteStats;
    }

    /**
     * RENDER GRAPH
     * Uses Chart.js to visualize the processed data.
     */
    renderGraph() {
        const ctx = document.getElementById(this.canvasId);
        if (!ctx) return;

        const dataMap = this._processData();
        const labels = Object.keys(dataMap);
        const values = Object.values(dataMap);

        // Robust cleanup of previous instance
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Color Palette Generator
        const colors = [
            '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
            '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
        ];

        this.chartInstance = new Chart(ctx, {
            type: 'bar', // Using Bar for Trend/Comparison
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Quantity Disposed (Units)',
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 4,
                        callbacks: {
                            label: function(context) {
                                return ` Quantity: ${new Intl.NumberFormat().format(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [4, 4], color: '#f1f5f9' },
                        title: { display: true, text: 'Units Disposed' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    /**
     * INTERACTIVE: SHOW DETAILS
     * Displays a robust modal with details about a specific disposal record.
     * @param {string} wrNumber - The Reference Number
     */
    showDetails(wrNumber) {
        // Java-style: Find object by attribute
        const record = wrCache.find(w => w.wr_number === wrNumber);
        
        if (!record) {
            Swal.fire('Error', 'Record Data Not Found in Cache', 'error');
            return;
        }

        // Parsing the formatted string again
        const parts = (record.remarks || "").split('|');
        const type = parts[0] ? parts[0].trim() : "-";
        const dest = parts[1] ? parts[1].trim() : "-";
        const reason = parts[2] ? parts[2].trim() : "-";

        // Building the HTML for the view
        let itemRows = (record.wr_items || []).map(item => {
            const mat = invCache.find(i => i.material_code === item.material_code);
            const desc = mat ? mat.description : "Unknown Item";
            return `
                <tr class="border-b border-slate-100">
                    <td class="py-2 text-xs font-mono font-bold text-slate-600">${item.material_code}</td>
                    <td class="py-2 text-xs text-slate-700">${desc}</td>
                    <td class="py-2 text-xs font-bold text-right text-red-600">${item.quantity_requested}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <div class="text-left bg-slate-50 p-4 rounded border border-slate-200 mb-4">
                <div class="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div><span class="font-bold text-slate-500 text-xs uppercase">Waste Type:</span><br>${type}</div>
                    <div><span class="font-bold text-slate-500 text-xs uppercase">Destination:</span><br>${dest}</div>
                </div>
                <div class="text-sm">
                    <span class="font-bold text-slate-500 text-xs uppercase">Authorization:</span><br>
                    <span class="text-slate-800 font-medium">${record.requester_name}</span>
                </div>
                <div class="mt-2 text-sm italic text-slate-500 border-t border-slate-200 pt-2">
                    "${reason}"
                </div>
            </div>
            <div class="overflow-y-auto max-h-48 border rounded border-slate-200">
                <table class="w-full text-left p-2">
                    <thead class="bg-slate-100 text-xs uppercase font-bold text-slate-500 sticky top-0">
                        <tr><th class="p-2">Code</th><th class="p-2">Item</th><th class="p-2 text-right">Qty</th></tr>
                    </thead>
                    <tbody class="p-2 bg-white">
                        ${itemRows}
                    </tbody>
                </table>
            </div>
        `;

        Swal.fire({
            title: `<span class="text-slate-700">Disposal #${record.wr_number}</span>`,
            html: htmlContent,
            showCloseButton: true,
            focusConfirm: false,
            confirmButtonText: 'Close',
            confirmButtonColor: '#64748b',
            width: '600px'
        });
    }

    /**
     * Event Listener Helper
     * Attaches click events to the dynamic table generated in script.js
     */
    _attachEventListeners() {
        // Event Delegation for Table Rows
        $(document).on('click', '#tbl-disp-hist tr', (e) => {
            // Find the Ref No cell (2nd column usually)
            const row = $(e.currentTarget);
            const refNo = row.find('td:nth-child(2)').text().trim();
            if(refNo) {
                this.showDetails(refNo);
            }
        });
        
        // Add visual cue to rows
        $(document).on('mouseenter', '#tbl-disp-hist tr', function() {
            $(this).addClass('bg-yellow-50 cursor-pointer transition');
            $(this).attr('title', 'Click to view details');
        }).on('mouseleave', '#tbl-disp-hist tr', function() {
            $(this).removeClass('bg-yellow-50 cursor-pointer transition');
        });
    }

    // --- Public Methods ---

    toggleVisibility() {
        $(`#${this.containerId}`).slideToggle();
    }

    refreshAndShow() {
        $(`#${this.containerId}`).removeClass('hidden').hide().slideDown();
        this.renderGraph();
    }
}

// Instantiate Global Service (Java-style Static Access Pattern)
const DisposalService = new DisposalAnalyticsService();
DisposalService.init();