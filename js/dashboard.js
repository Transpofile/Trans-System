/**
 * Trans-System Dashboard Extension
 * Improves design, interactivity, and adds dynamic widgets.
 * Overrides the default updateDashboard() function from script.js
 */

const DashboardEnhanced = {
    // Configuration for Chart Colors matching Tailwind Theme
    colors: {
        primary: { start: 'rgba(37, 99, 235, 0.9)', end: 'rgba(37, 99, 235, 0.1)' }, // Royal-600
        success: { start: 'rgba(16, 185, 129, 0.9)', end: 'rgba(16, 185, 129, 0.1)' }, // Emerald-500
        danger:  { start: 'rgba(239, 68, 68, 0.9)',  end: 'rgba(239, 68, 68, 0.1)' },  // Red-500
        text: '#64748b',
        grid: '#f1f5f9'
    },

    // Initialize the extension
    init: function() {
        console.log("Dashboard Extension Initialized");
        // Inject the additional widget containers if they don't exist
        this.injectLayout();
    },

    // Inject HTML for new widgets (Recent Activity & Critical Stock)
    injectLayout: function() {
        if ($('#dashboard-extended-widgets').length === 0) {
            const widgetHtml = `
            <div id="dashboard-extended-widgets" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <!-- Recent Activity Feed -->
                <div class="card p-5 h-full">
                    <div class="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 class="font-bold text-slate-700"><i class="fas fa-history text-royal-500 mr-2"></i>Recent Activity</h3>
                        <span class="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Last 5 Actions</span>
                    </div>
                    <div class="overflow-y-auto max-h-[250px]">
                        <ul id="widget-recent-activity" class="space-y-3">
                            <li class="text-center text-slate-400 text-xs italic py-4">Loading activity...</li>
                        </ul>
                    </div>
                </div>

                <!-- Critical Stock List -->
                <div class="card p-5 h-full">
                    <div class="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 class="font-bold text-slate-700"><i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>Critical Stock</h3>
                        <button onclick="nav('inventory')" class="text-xs text-royal-600 hover:underline">View All</button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th class="p-2">Item</th>
                                    <th class="p-2 text-center">Current</th>
                                    <th class="p-2 text-center">Limit</th>
                                    <th class="p-2 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody id="widget-critical-stock">
                                <tr><td colspan="4" class="text-center p-4">No alerts.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
            
            // Append after the chart section
            $('#dashboard .grid:last').after(widgetHtml);
        }
    },

    // Helper: Number Animation
    animateValue: function(id, start, end, duration) {
        if (start === end) return;
        const range = end - start;
        let current = start;
        const increment = end > start ? 1 : -1;
        const stepTime = Math.abs(Math.floor(duration / range));
        const obj = document.getElementById(id);
        
        // If huge jump, just set it to avoid UI blocking
        if(Math.abs(range) > 100) {
            obj.innerHTML = new Intl.NumberFormat('en-US').format(end);
            return;
        }

        const timer = setInterval(function() {
            current += increment;
            obj.innerHTML = new Intl.NumberFormat('en-US').format(current);
            if (current == end) {
                clearInterval(timer);
            }
        }, Math.max(stepTime, 10)); // Min 10ms per frame
    },

    // Render Recent Activity Widget
    renderActivityWidget: function() {
        const container = $('#widget-recent-activity');
        container.empty();

        // Combine PRs and WRs for a timeline
        // Note: Using global prCache and wrCache from script.js
        let activities = [];
        
        if (typeof prCache !== 'undefined') {
            prCache.slice(0, 5).forEach(pr => {
                activities.push({
                    type: 'PR',
                    ref: pr.pr_number,
                    desc: `Request by ${pr.requester_name}`,
                    date: new Date(pr.created_at),
                    status: pr.status,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-100',
                    icon: 'fa-arrow-down'
                });
            });
        }
        
        if (typeof wrCache !== 'undefined') {
            wrCache.slice(0, 5).forEach(wr => {
                activities.push({
                    type: 'WR',
                    ref: wr.wr_number,
                    desc: `${wr.department} (${wr.requester_name})`,
                    date: new Date(wr.created_at),
                    status: wr.status,
                    color: 'text-amber-600',
                    bg: 'bg-amber-100',
                    icon: 'fa-arrow-up'
                });
            });
        }

        // Sort by date desc and take top 5
        activities.sort((a, b) => b.date - a.date);
        const top5 = activities.slice(0, 5);

        if(top5.length === 0) {
            container.html('<li class="text-center text-slate-400 text-xs italic py-4">No recent transactions.</li>');
            return;
        }

        top5.forEach(act => {
            const timeAgo = Math.floor((new Date() - act.date) / (1000 * 60 * 60 * 24));
            const timeStr = timeAgo === 0 ? 'Today' : `${timeAgo}d ago`;
            
            container.append(`
                <li class="flex items-start gap-3 p-2 hover:bg-slate-50 rounded transition duration-200">
                    <div class="w-8 h-8 rounded-full ${act.bg} ${act.color} flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                        <i class="fas ${act.icon} text-xs"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-slate-700 text-xs">${act.ref}</span>
                            <span class="text-[10px] text-slate-400">${timeStr}</span>
                        </div>
                        <p class="text-xs text-slate-500 truncate">${act.desc}</p>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">${act.status}</span>
                </li>
            `);
        });
    },

    // Render Critical Stock Widget
    renderCriticalStock: function() {
        const tbody = $('#widget-critical-stock').empty();
        
        // Use global invCache
        if (typeof invCache === 'undefined') return;

        const critical = invCache.filter(i => i.status !== 'ARCHIVED' && i.current_stock <= i.low_stock_threshold)
                                 .sort((a,b) => a.current_stock - b.current_stock)
                                 .slice(0, 5); // Top 5 critical

        if(critical.length === 0) {
            tbody.html('<tr><td colspan="4" class="text-center p-4 text-xs text-emerald-600"><i class="fas fa-check-circle mr-1"></i> Stock levels healthy</td></tr>');
            return;
        }

        critical.forEach(item => {
            const isOut = item.current_stock <= 0;
            const badge = isOut 
                ? '<span class="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded">OUT</span>' 
                : '<span class="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">LOW</span>';
            
            tbody.append(`
                <tr class="border-b border-slate-50 last:border-0 hover:bg-red-50 transition cursor-pointer" onclick="openInventoryModal('edit', '${item.material_code}')">
                    <td class="p-2">
                        <div class="font-bold text-xs text-slate-700">${item.material_code}</div>
                        <div class="text-[10px] text-slate-500 truncate max-w-[120px]">${item.description}</div>
                    </td>
                    <td class="p-2 text-center text-xs font-bold ${isOut ? 'text-red-600' : 'text-slate-700'}">${item.current_stock}</td>
                    <td class="p-2 text-center text-xs text-slate-400">${item.low_stock_threshold}</td>
                    <td class="p-2 text-right">${badge}</td>
                </tr>
            `);
        });
    }
};

// ==========================================
// OVERRIDE: Replace the Main Script Function
// ==========================================

window.updateDashboard = function() {
    DashboardEnhanced.init();

    // 1. Calculate Stats
    const active = invCache.filter(i => i.status !== 'ARCHIVED');
    const totalItems = active.length;
    const lowStockCount = active.filter(i => i.current_stock <= i.low_stock_threshold).length;
    const deptCount = masterData.depts.length;
    
    // Calculate Total Withdrawn (excluding disposal)
    const totalOut = movementCache
        .filter(m => m.change_amount < 0 && !m.reason.toLowerCase().includes('disposal'))
        .reduce((acc, curr) => acc + Math.abs(curr.change_amount), 0);

    // 2. Animate Numbers using Extension
    // Get current values to prevent animation from 0 every time if refreshing
    const getCurr = (id) => parseInt($(`#${id}`).text().replace(/,/g, '')) || 0;
    
    DashboardEnhanced.animateValue("d-items", getCurr('d-items'), totalItems, 1000);
    DashboardEnhanced.animateValue("d-low", getCurr('d-low'), lowStockCount, 1000);
    DashboardEnhanced.animateValue("d-depts", getCurr('d-depts'), deptCount, 1000);
    DashboardEnhanced.animateValue("d-withdrawn", getCurr('d-withdrawn'), totalOut, 1500);

    // 3. Render Widgets
    DashboardEnhanced.renderActivityWidget();
    DashboardEnhanced.renderCriticalStock();

    // 4. Enhanced Charts
    
    // --- Category Chart (Doughnut) ---
    const catMap = {}; 
    active.forEach(i => { catMap[i.category||'Other'] = (catMap[i.category||'Other']||0) + i.current_stock; });

    if(charts.cat) charts.cat.destroy();
    const catCtx = document.getElementById('catChart');
    if(catCtx) {
        charts.cat = new Chart(catCtx, {
            type: 'doughnut',
            data: { 
                labels: Object.keys(catMap), 
                datasets: [{ 
                    data: Object.values(catMap), 
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 10
                }] 
            },
            options: { 
                maintainAspectRatio: false, 
                cutout: '75%', 
                layout: { padding: 10 },
                plugins: { 
                    legend: { 
                        position: 'right',
                        labels: { usePointStyle: true, font: { size: 11 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1e293b',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${context.raw} units`;
                            }
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const category = charts.cat.data.labels[index];
                        // Interactive: Jump to Inventory and Filter
                        nav('inventory');
                        $('#filter-cat').val(category);
                        filterInventory();
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'info',
                            title: `Filtering: ${category}`,
                            showConfirmButton: false,
                            timer: 1500
                        });
                    }
                }
            }
        });
    }

    // --- Trend Chart (Bar with Gradients) ---
    const days = 14;
    const dateMap = {};
    const now = new Date();
    for(let i=days-1; i>=0; i--) {
        const d = new Date(); d.setDate(now.getDate() - i);
        dateMap[d.toLocaleDateString('en-US',{month:'short',day:'numeric'})] = {in:0, out:0};
    }

    movementCache.forEach(m => {
        const d = new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        if(dateMap[d]) {
            if(m.change_amount > 0) dateMap[d].in += m.change_amount;
            else dateMap[d].out += Math.abs(m.change_amount);
        }
    });

    if(charts.trend) charts.trend.destroy();
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    
    // Create Gradients
    const gradientIn = trendCtx.createLinearGradient(0, 0, 0, 300);
    gradientIn.addColorStop(0, DashboardEnhanced.colors.success.start);
    gradientIn.addColorStop(1, DashboardEnhanced.colors.success.end);

    const gradientOut = trendCtx.createLinearGradient(0, 0, 0, 300);
    gradientOut.addColorStop(0, DashboardEnhanced.colors.primary.start);
    gradientOut.addColorStop(1, DashboardEnhanced.colors.primary.end);

    if(trendCtx) {
        charts.trend = new Chart(trendCtx, {
            type: 'bar',
            data: { 
                labels: Object.keys(dateMap), 
                datasets: [
                    { 
                        label: 'Stock In', 
                        data: Object.values(dateMap).map(x=>x.in), 
                        backgroundColor: gradientIn,
                        hoverBackgroundColor: '#059669',
                        borderRadius: 4,
                        barPercentage: 0.6
                    },
                    { 
                        label: 'Stock Out', 
                        data: Object.values(dateMap).map(x=>x.out), 
                        backgroundColor: gradientOut,
                        hoverBackgroundColor: '#1d4ed8',
                        borderRadius: 4,
                        barPercentage: 0.6
                    }
                ] 
            },
            options: { 
                maintainAspectRatio: false, 
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: { 
                    x: {
                        stacked: true, 
                        grid: { display: false },
                        ticks: { color: DashboardEnhanced.colors.text, font: {size: 10} }
                    }, 
                    y: {
                        stacked: true, 
                        grid: { borderDash: [4, 4], color: DashboardEnhanced.colors.grid },
                        ticks: { color: DashboardEnhanced.colors.text, font: {size: 10} }
                    } 
                }, 
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        padding: 10,
                    }
                } 
            }
        });
    }
};