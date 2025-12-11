/**
 * TRANS-SYSTEM EXTENSION: CATEGORY ANALYTICS
 * Description: Enhanced visualization for specific inventory categories.
 * Features: Gradient bars, Interactive filtering, Auto-refresh hook.
 */

(function() {
    'use strict';

    // --- 1. CONFIGURATION ---
    // Define the specific categories to track and their visual themes
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
    
    // Safely capture the existing dashboard render function
    const originalRenderDashboard = window.renderDashboard;

    // Override to inject our graph logic after the standard dashboard loads
    window.renderDashboard = async function() {
        if (typeof originalRenderDashboard === 'function') {
            await originalRenderDashboard();
        }
        await CategoryExtension.init();
    };

    // --- 3. LOGIC CONTROLLER ---
    
    const CategoryExtension = {
        
        /**
         * Main Initialization function
         */
        init: async function() {
            const ctx = document.getElementById('trading-chart');
            if (!ctx) return; // Guard clause if canvas is missing

            // 1. Fetch Data
            const inventory = await this.fetchData();
            
            // 2. Process Data (Aggregate counts)
            const chartData = this.processData(inventory);

            // 3. Render Chart
            this.renderChart(ctx.getContext('2d'), chartData);
        },

        /**
         * Fetch inventory from Supabase wrapper
         */
        fetchData: async function() {
            try {
                // Using the global dbAction from Trans-System.html
                return await dbAction('inventory', 'readonly', store => store.getAll());
            } catch (error) {
                console.error("Extension Error: Could not fetch inventory", error);
                return [];
            }
        },

        /**
         * Aggregate stock numbers based on Target Categories
         */
        processData: function(items) {
            // Initialize counts
            const counts = {};
            CAT_CONFIG.targets.forEach(t => counts[t.name.toLowerCase()] = 0);

            // Sum up stock
            items.forEach(item => {
                if (!item.category) return;
                
                const catName = item.category.trim().toLowerCase();
                
                // Check if this item belongs to our target list
                if (counts.hasOwnProperty(catName)) {
                    counts[catName] += (parseInt(item.stock) || 0);
                } 
                // Optional: Logic to catch items that aren't in the list but should be 'Others'
                else if (catName === 'others' || catName === 'miscellaneous') {
                    counts['others'] += (parseInt(item.stock) || 0);
                }
            });

            return counts;
        },

        /**
         * Create Gradients for better visuals
         */
        createGradient: function(ctx, hexColor) {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, this.hexToRgba(hexColor, 0.8)); // Top: High opacity
            gradient.addColorStop(1, this.hexToRgba(hexColor, 0.1)); // Bottom: Low opacity
            return gradient;
        },

        /**
         * Helper: Convert Hex to RGBA
         */
        hexToRgba: function(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        },

        /**
         * Draw the Chart.js instance
         */
        renderChart: function(ctx, dataMap) {
            // Clean up old instance
            if (window.chartInstance) {
                window.chartInstance.destroy();
            }

            // Prepare Data Arrays
            const labels = CAT_CONFIG.targets.map(t => t.name);
            const dataValues = CAT_CONFIG.targets.map(t => dataMap[t.name.toLowerCase()]);
            const backgroundColors = CAT_CONFIG.targets.map(t => this.createGradient(ctx, t.color));
            const borderColors = CAT_CONFIG.targets.map(t => t.color);

            // Theme Detection
            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#94a3b8' : '#64748b';
            const gridColor = isDark ? '#334155' : '#e2e8f0';

            // Chart Configuration
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
                        borderRadius: 8, // Rounded corners on bars
                        borderSkipped: false,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1500,
                        easing: 'easeOutQuart'
                    },
                    onClick: (evt, elements) => {
                        // INTERACTIVITY: Click bar to filter inventory
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const categoryName = labels[index];
                            this.handleBarClick(categoryName);
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                            titleColor: isDark ? '#fff' : '#1e293b',
                            bodyColor: isDark ? '#cbd5e1' : '#475569',
                            borderColor: isDark ? '#475569' : '#e2e8f0',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: true,
                            callbacks: {
                                label: (context) => ` Total Items: ${context.raw}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor, borderDash: [5, 5] },
                            ticks: { color: textColor, font: { size: 11 } },
                            title: { display: true, text: 'Quantity', color: textColor }
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
         * Handle Drill-down navigation
         */
        handleBarClick: function(categoryName) {
            // Switch to Inventory View
            const inventoryBtn = document.getElementById('nav-inventory');
            if (inventoryBtn) inventoryBtn.click();

            // Apply Filter (Wait small delay for view to swap)
            setTimeout(() => {
                // Check if the main system's filter function exists
                if (typeof window.filterCat === 'function') {
                    window.filterCat(categoryName);
                    
                    // Optional: Visual feedback via Toast
                    if(typeof window.showToast === 'function') {
                        window.showToast(`Filtered by ${categoryName}`, 'info');
                    }
                }
            }, 100);
        }
    };

})();