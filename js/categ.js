/**
 * TRANS-SYSTEM EXTENSION: CATEGORY ANALYTICS & DRILL-DOWN
 * Description: Enhanced visualization with modal drill-down capabilities.
 * Features: Gradient bars, Interactive filtering, Auto-refresh hook, Item-level detail view.
 */

(function() {
    'use strict';

    // --- 1. CONFIGURATION ---
    const CAT_CONFIG = {
        targets: [
            { name: 'Tires',        color: '#ef4444', icon: 'fa-truck-monster' }, // Red
            { name: 'Spare Parts',  color: '#3b82f6', icon: 'fa-cogs' },          // Blue
            { name: 'Fluids',       color: '#06b6d4', icon: 'fa-oil-can' },       // Cyan
            { name: 'Electrical',   color: '#eab308', icon: 'fa-bolt' },          // Yellow
            { name: 'Tools',        color: '#a855f7', icon: 'fa-wrench' },        // Purple
            { name: 'Bulb',         color: '#f97316', icon: 'fa-lightbulb' },     // Orange
            { name: 'Others',       color: '#64748b', icon: 'fa-box-open' }       // Slate
        ]
    };

    // --- 2. SYSTEM INTEGRATION ---
    const originalRenderDashboard = window.renderDashboard;

    window.renderDashboard = async function() {
        if (typeof originalRenderDashboard === 'function') {
            await originalRenderDashboard();
        }
        await CategoryExtension.init();
    };

    // --- 3. LOGIC CONTROLLER ---
    const CategoryExtension = {
        inventoryCache: [], // Store raw data for drill-down
        detailChartInstance: null, // Keep track of modal chart to destroy it later

        /**
         * Main Initialization function
         */
        init: async function() {
            // 1. Inject Modal HTML if it doesn't exist
            this.injectModal();

            const ctx = document.getElementById('trading-chart');
            if (!ctx) return;

            // 2. Fetch Data
            this.inventoryCache = await this.fetchData();
            
            // 3. Process Data (Aggregate counts)
            const chartData = this.processData(this.inventoryCache);

            // 4. Render Main Chart
            this.renderMainChart(ctx.getContext('2d'), chartData);
        },

        /**
         * Inject the Modal HTML dynamically so we don't need to edit the main HTML file
         */
        injectModal: function() {
            if (document.getElementById('cat-drilldown-modal')) return;

            const modalHTML = `
                <div id="cat-drilldown-modal" class="modal fixed inset-0 z-[2000] hidden items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <div class="glass-panel bg-white dark:bg-slate-800 w-full max-w-4xl mx-4 rounded-xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
                        <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition" onclick="document.getElementById('cat-drilldown-modal').classList.remove('open'); document.getElementById('cat-drilldown-modal').classList.add('hidden');">
                            <i class="fas fa-times text-2xl"></i>
                        </button>
                        <div class="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                            <div id="cat-modal-icon" class="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl"></div>
                            <div>
                                <h2 id="cat-modal-title" class="text-xl font-bold text-slate-800 dark:text-white">Category Details</h2>
                                <p class="text-xs text-slate-500 dark:text-slate-400">Item Stock Breakdown</p>
                            </div>
                        </div>
                        <div class="flex-1 overflow-hidden relative min-h-[400px]">
                            <canvas id="cat-detail-chart"></canvas>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Close modal on outside click
            const modal = document.getElementById('cat-drilldown-modal');
            modal.addEventListener('click', (e) => {
                if(e.target === modal) {
                    modal.classList.remove('open');
                    modal.classList.add('hidden');
                }
            });
        },

        fetchData: async function() {
            try {
                return await dbAction('inventory', 'readonly', store => store.getAll());
            } catch (error) {
                console.error("Extension Error: Could not fetch inventory", error);
                return [];
            }
        },

        processData: function(items) {
            const counts = {};
            CAT_CONFIG.targets.forEach(t => counts[t.name.toLowerCase()] = 0);

            items.forEach(item => {
                if (!item.category) return;
                const catName = item.category.trim().toLowerCase();
                
                if (counts.hasOwnProperty(catName)) {
                    counts[catName] += (parseInt(item.stock) || 0);
                } else if (catName === 'others' || catName === 'miscellaneous') {
                    counts['others'] += (parseInt(item.stock) || 0);
                }
            });
            return counts;
        },

        createGradient: function(ctx, hexColor) {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, this.hexToRgba(hexColor, 0.9));
            gradient.addColorStop(1, this.hexToRgba(hexColor, 0.2));
            return gradient;
        },

        hexToRgba: function(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        },

        /**
         * Render the Main Category Overview Chart
         */
        renderMainChart: function(ctx, dataMap) {
            if (window.chartInstance) {
                window.chartInstance.destroy();
            }

            const labels = CAT_CONFIG.targets.map(t => t.name);
            const dataValues = CAT_CONFIG.targets.map(t => dataMap[t.name.toLowerCase()]);
            const backgroundColors = CAT_CONFIG.targets.map(t => this.createGradient(ctx, t.color));
            const borderColors = CAT_CONFIG.targets.map(t => t.color);

            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#94a3b8' : '#64748b';
            const gridColor = isDark ? '#334155' : '#e2e8f0';

            window.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Current Stock Level',
                        data: dataValues,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 2,
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 1000, easing: 'easeOutQuart' },
                    onClick: (evt, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const categoryObj = CAT_CONFIG.targets[index];
                            this.openDetailModal(categoryObj);
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: { label: (context) => ` Total Items: ${context.raw}` }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor, borderDash: [5, 5] },
                            ticks: { color: textColor },
                            title: { display: true, text: 'Total Quantity', color: textColor }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { weight: 'bold' } }
                        }
                    }
                }
            });
        },

        /**
         * Open Modal and Render Drill-down Graph
         */
        openDetailModal: function(categoryObj) {
            // 1. Filter items for this category
            const items = this.inventoryCache.filter(item => 
                item.category && item.category.toLowerCase() === categoryObj.name.toLowerCase()
            );

            // Sort items by stock descending
            items.sort((a, b) => b.stock - a.stock);

            // 2. Open Modal UI
            const modal = document.getElementById('cat-drilldown-modal');
            const iconDiv = document.getElementById('cat-modal-icon');
            const title = document.getElementById('cat-modal-title');

            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('open'), 10); // Trigger transition
            
            iconDiv.style.backgroundColor = categoryObj.color;
            iconDiv.innerHTML = `<i class="fas ${categoryObj.icon}"></i>`;
            title.innerText = `${categoryObj.name} Inventory Breakdown`;

            // 3. Render Detail Chart
            const ctx = document.getElementById('cat-detail-chart').getContext('2d');
            this.renderDetailChart(ctx, items, categoryObj.color);
        },

        /**
         * Render the Drill-down Horizontal Bar Chart
         */
        renderDetailChart: function(ctx, items, themeColor) {
            if (this.detailChartInstance) {
                this.detailChartInstance.destroy();
            }

            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#e2e8f0' : '#475569';
            const gridColor = isDark ? '#334155' : '#e2e8f0';

            // Prepare data (Top 30 items to prevent overcrowding if list is huge)
            const displayItems = items.slice(0, 30);
            const labels = displayItems.map(i => i.name.length > 25 ? i.name.substring(0, 25) + '...' : i.name);
            const data = displayItems.map(i => i.stock);
            
            // Create Horizontal Gradient
            const gradient = ctx.createLinearGradient(0, 0, 400, 0);
            gradient.addColorStop(0, this.hexToRgba(themeColor, 0.8));
            gradient.addColorStop(1, this.hexToRgba(themeColor, 0.4));

            this.detailChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Stock',
                        data: data,
                        backgroundColor: gradient,
                        borderColor: themeColor,
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.7
                    }]
                },
                options: {
                    indexAxis: 'y', // Horizontal Bar Chart
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            titleColor: isDark ? '#fff' : '#1e293b',
                            bodyColor: isDark ? '#cbd5e1' : '#475569',
                            callbacks: {
                                title: (context) => displayItems[context[0].dataIndex].name, // Full name in tooltip
                                label: (context) => {
                                    const item = displayItems[context.dataIndex];
                                    return ` Stock: ${item.stock} ${item.unit || 'units'}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { 
                                color: textColor,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }
    };
})();
