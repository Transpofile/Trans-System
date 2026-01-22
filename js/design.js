/**
 * design.js
 * Enhanced Extension for Trans-System v2.1
 * Features: Smart Health Score, ABC Analysis, Predictive Dates, Gradient Charts.
 */

// Global variable to hold the specific item chart instance
let itemDetailChart = null;

$(document).ready(function() {
    initDesignExtension();
});

function initDesignExtension() {
    // 1. Inject the Enhanced Details Modal into the DOM if missing
    if ($('#m-design-details').length === 0) {
        $('body').append(generateEnhancedDetailsModalHTML());
    }

    // 2. Inject Export Button into Inventory Toolbar
    // We check if it exists to prevent duplicates on re-init
    if ($('#inventory .flex.gap-2 button[onclick="design_exportCSV()"]').length === 0) {
        const exportBtn = `
            <button onclick="design_exportCSV()" class="btn-secondary text-xs font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-emerald-700 mr-2 shadow-sm transition-all group">
                <i class="fas fa-file-csv mr-2 text-emerald-600 group-hover:scale-110 transition-transform"></i> Export Data
            </button>
        `;
        $('#inventory .flex.gap-2').prepend(exportBtn);
    }

    // 3. Add Keyboard Listener for ESC key to close modal
    $(document).keydown(function(e) {
        if (e.key === "Escape") {
            if (!$('#m-design-details').hasClass('hidden')) {
                design_closeDetails();
            }
        }
    });

    // 4. OVERRIDE renderInventoryTable
    // Hijacks the main table render to inject advanced UI elements
    window.renderInventoryTable = function() {
        const search = $('#search-inv').val().toLowerCase();
        const cat = $('#filter-cat').val();
        const tb = $('#tbl-inv').empty();
        
        // Safety check for cache
        const safeInv = typeof invCache !== 'undefined' ? invCache : [];

        let filtered = safeInv.filter(i => {
            if(!appSettings.showArchived && i.status === 'ARCHIVED') return false;
            const txt = (i.material_code + ' ' + i.description).toLowerCase();
            return txt.includes(search) && (!cat || i.category === cat);
        });

        // Advanced Sort logic (handles numbers correctly)
        filtered.sort((a,b) => {
            let va = a[appSettings.sortCol], vb = b[appSettings.sortCol];
            
            // Handle undefined/null
            if (va == null) va = "";
            if (vb == null) vb = "";

            // Check if both are numbers
            if (!isNaN(parseFloat(va)) && !isNaN(parseFloat(vb)) && typeof va !== 'string') {
                return appSettings.sortAsc ? va - vb : vb - va;
            }
            
            // String comparison
            va = va.toString().toLowerCase();
            vb = vb.toString().toLowerCase();
            return appSettings.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });

        if(filtered.length === 0) {
            tb.html(`
                <tr>
                    <td colspan="8" class="p-12 text-center flex flex-col items-center justify-center opacity-50">
                        <div class="bg-slate-100 p-4 rounded-full mb-3"><i class="fas fa-search fa-2x text-slate-400"></i></div>
                        <span class="text-slate-500 font-medium">No matching items found.</span>
                    </td>
                </tr>`
            );
            return;
        }

        filtered.forEach(i => {
            // Logic for status badges with more nuance
            let statusBadge = '';
            let rowClass = '';
            
            if (i.current_stock <= 0) {
                statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200"><i class="fas fa-times-circle mr-1"></i>Out of Stock</span>';
                rowClass = 'bg-red-50/30';
            } else if (i.current_stock <= i.low_stock_threshold) {
                statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200"><i class="fas fa-exclamation-triangle mr-1"></i>Low Stock</span>';
            } else {
                statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fas fa-check-circle mr-1"></i>In Stock</span>';
            }
            
            const sdsBtn = i.sds_link 
                ? `<a href="${i.sds_link}" target="_blank" class="text-slate-400 hover:text-red-600 transition-colors tooltip-wrap" title="View PDF"><i class="fas fa-file-pdf fa-lg"></i></a>` 
                : '<span class="text-slate-200 text-xs select-none">N/A</span>';
            
            // --- NEW: Eye Icon with Pulse effect if critical ---
            const isCritical = i.current_stock <= i.low_stock_threshold;
            const viewBtn = `
                <button class="group relative text-slate-400 hover:text-royal-600 transition-all p-1.5 rounded hover:bg-royal-50" onclick="design_viewDetails('${i.material_code}')">
                    <i class="fas fa-eye transform group-hover:scale-110 transition-transform ${isCritical ? 'text-amber-500' : ''}"></i>
                    ${isCritical ? '<span class="absolute top-0 right-0 -mt-1 -mr-1 flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span>' : ''}
                    <span class="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity mb-2 whitespace-nowrap z-10 shadow-lg">View Analytics</span>
                </button>
            `;

            const imageDisplay = getItemImage(i.material_code); // Uses script.js helper

            tb.append(`
                <tr class="group transition border-b border-slate-50 hover:bg-blue-50/40 ${i.status==='ARCHIVED'?'opacity-60 grayscale bg-slate-50':rowClass}">
                    <td class="p-3 w-16">${imageDisplay}</td>
                    <td class="p-3">
                        <div class="font-bold font-mono text-xs text-royal-700 group-hover:text-royal-600 cursor-pointer" onclick="design_viewDetails('${i.material_code}')">${escapeHTML(i.material_code)}</div>
                    </td>
                    <td class="p-3">
                        <div class="font-medium text-slate-700 text-sm mb-0.5">${escapeHTML(i.description)}</div>
                        <div class="mt-1">${statusBadge}</div>
                    </td>
                    <td class="p-3 font-bold text-slate-700 text-sm">
                        ${formatNum(i.current_stock)}
                    </td>
                    <td class="p-3 text-xs text-slate-500 uppercase font-semibold">${escapeHTML(i.uom)}</td>
                    <td class="p-3">
                        <span class="inline-block bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold tracking-wide uppercase shadow-sm">
                            ${escapeHTML(i.category)}
                        </span>
                    </td>
                    <td class="p-3 text-center">${sdsBtn}</td>
                    <td class="p-3 text-right">
                        <div class="flex justify-end items-center gap-1">
                            ${viewBtn}
                            <div class="h-4 w-px bg-slate-200 mx-2"></div>
                            ${i.status !== 'ARCHIVED' ? `
                            <button class="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-royal-600 hover:bg-royal-50 transition" onclick="openStockAdjustModal('${i.material_code}')" title="Adjust Stock"><i class="fas fa-sliders-h text-xs"></i></button>
                            <button class="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition" onclick="openInventoryModal('edit', '${i.material_code}')" title="Edit Details"><i class="fas fa-edit text-xs"></i></button>
                            <button class="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition" onclick="delItem('${i.material_code}')" title="Archive"><i class="fas fa-trash-alt text-xs"></i></button>
                            ` : `
                            <button class="text-xs font-bold text-emerald-600 hover:text-emerald-800 border border-emerald-200 bg-emerald-50 px-2 py-1 rounded shadow-sm" onclick="restoreItem('${i.material_code}')"><i class="fas fa-trash-restore mr-1"></i>Restore</button>
                            `}
                        </div>
                    </td>
                </tr>
            `);
        });
    };

    // Trigger refresh if data exists
    if(typeof invCache !== 'undefined' && invCache.length > 0) renderInventoryTable();
}

// --- LOGIC: VIEW DETAILS & ANALYTICS ---

window.design_viewDetails = function(code) {
    const item = invCache.find(i => i.material_code === code);
    if (!item) return;

    // Reset UI
    design_switchTab('d-tab-overview');

    // 1. Data Preparation
    // Find unit cost from Purchase History
    let unitCost = 0;
    let lastPrDate = 'Never';
    let purchaseFrequency = 0;
    
    if (typeof prCache !== 'undefined') {
        const allPrItems = [];
        prCache.forEach(pr => {
            if(pr.pr_items) {
                const found = pr.pr_items.find(x => x.material_code === code);
                if(found) {
                    if(found.unit_price > 0) allPrItems.push({ date: pr.created_at, price: found.unit_price });
                    purchaseFrequency++;
                }
            }
        });
        allPrItems.sort((a,b) => new Date(b.date) - new Date(a.date));
        if(allPrItems.length > 0) {
            unitCost = allPrItems[0].price;
            lastPrDate = new Date(allPrItems[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
    }
    const totalValue = unitCost * item.current_stock;

    // 2. Populate Header & Basic Info
    $('#d-modal-code').text(item.material_code);
    $('#d-modal-desc').text(item.description);
    $('#d-modal-cat').text(item.category);
    
    const imgHtml = item.image_link 
        ? `<img src="${item.image_link}" class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition" onclick="openLightbox('${item.image_link}')">` 
        : `<div class="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300"><i class="fas fa-image fa-2x"></i></div>`;
    $('#d-img-container').html(imgHtml);

    // 3. Populate Overview Tab
    $('#d-ov-stock').text(formatNum(item.current_stock));
    $('#d-ov-uom').text(item.uom);
    $('#d-ov-low').text(item.low_stock_threshold);
    $('#d-ov-val').text(formatMoney(totalValue));
    $('#d-ov-cost').text(unitCost > 0 ? formatMoney(unitCost) : '₱0.00');
    $('#d-ov-last-buy').text(lastPrDate);
    $('#d-ov-remarks').text(item.remarks || 'No specific remarks.');

    // --- HEALTH SCORE CALCULATION ---
    let healthScore = 100;
    let healthReason = "Optimal";
    
    if (item.current_stock <= 0) {
        healthScore = 0; healthReason = "Stockout";
    } else if (item.current_stock <= item.low_stock_threshold) {
        healthScore = 40; healthReason = "Critical";
    } else if (item.current_stock < (item.low_stock_threshold * 1.5)) {
        healthScore = 70; healthReason = "Fair";
    } else if (item.current_stock > (item.low_stock_threshold * 10)) {
        healthScore = 85; healthReason = "Overstock";
    }

    // Render Health Ring Color
    let healthColor = 'text-emerald-500';
    if(healthScore < 50) healthColor = 'text-red-500';
    else if(healthScore < 80) healthColor = 'text-amber-500';
    
    $('#d-health-score').text(healthScore).removeClass('text-red-500 text-amber-500 text-emerald-500').addClass(healthColor);
    $('#d-health-reason').text(healthReason);

    // Stock Bar Logic
    const maxBar = Math.max(item.current_stock, item.low_stock_threshold * 3);
    const pct = Math.min((item.current_stock / maxBar) * 100, 100);
    const thresholdPct = (item.low_stock_threshold / maxBar) * 100;
    
    let barColor = 'bg-emerald-500';
    if(item.current_stock <= item.low_stock_threshold) barColor = item.current_stock <= 0 ? 'bg-red-500' : 'bg-amber-500';

    $('#d-ov-bar').css('width', pct + '%').removeClass('bg-red-500 bg-amber-500 bg-emerald-500').addClass(barColor);
    // Add marker for low stock threshold on the bar
    $('#d-ov-bar-container').find('.threshold-marker').remove();
    $('#d-ov-bar-container').append(`<div class="threshold-marker absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 opacity-70" style="left: ${thresholdPct}%" title="Reorder Point"></div>`);

    // 4. Populate Analytics Tab
    calculateAnalytics(item, code, unitCost);

    // 5. Populate History Tab
    const history = movementCache.filter(m => m.material_code === code).reverse();
    const histHtml = history.length ? history.map(h => `
        <tr class="text-xs border-b border-slate-50 hover:bg-blue-50/20 transition-colors">
            <td class="p-3 text-slate-600 font-mono">${new Date(h.created_at).toLocaleDateString()}</td>
            <td class="p-3 text-slate-400">${new Date(h.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
            <td class="p-3 font-medium text-slate-700">${escapeHTML(h.reason)}</td>
            <td class="p-3 text-right font-bold ${h.change_amount > 0 ? 'text-emerald-600' : 'text-red-600'}">
                ${h.change_amount > 0 ? '+' : ''}${h.change_amount}
            </td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">No movement recorded.</td></tr>';
    $('#d-hist-tbody').html(histHtml);

    // Show Modal
    $('#m-design-details').removeClass('hidden').css('display', 'flex').hide().fadeIn(150);
}

function calculateAnalytics(item, code, unitCost) {
    const now = new Date();
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(now.getDate() - 60);

    const movements = movementCache.filter(m => m.material_code === code);
    
    // Consumption last 30 days
    const consLast30 = movements
        .filter(m => new Date(m.created_at) >= thirtyDaysAgo && m.change_amount < 0)
        .reduce((acc, curr) => acc + Math.abs(curr.change_amount), 0);
    
    // Consumption previous 30 days (for trend)
    const consPrev30 = movements
        .filter(m => new Date(m.created_at) >= sixtyDaysAgo && new Date(m.created_at) < thirtyDaysAgo && m.change_amount < 0)
        .reduce((acc, curr) => acc + Math.abs(curr.change_amount), 0);

    // A. Average Daily Usage (ADU) - smoothed over 90 days if data exists, else 30
    const dailyRate = consLast30 / 30;
    
    $('#d-an-cons').text(dailyRate > 0 ? dailyRate.toFixed(1) + ' /day' : '0');
    
    // Trend Arrow
    let trendHtml = '<span class="text-slate-400">-</span>';
    if(consPrev30 > 0) {
        if(consLast30 > consPrev30) trendHtml = '<span class="text-red-500 text-xs"><i class="fas fa-arrow-up"></i> + Usage</span>';
        else if(consLast30 < consPrev30) trendHtml = '<span class="text-emerald-500 text-xs"><i class="fas fa-arrow-down"></i> - Usage</span>';
    }
    $('#d-an-trend').html(trendHtml);

    // B. Days until Stockout & Predicted Date
    let daysLeft = '∞';
    let predictedDate = 'No Stockout Risk';
    let daysClass = 'text-emerald-600';
    
    if (dailyRate > 0 && item.current_stock > 0) {
        const days = Math.floor(item.current_stock / dailyRate);
        daysLeft = days;
        
        const pDate = new Date();
        pDate.setDate(pDate.getDate() + days);
        predictedDate = pDate.toLocaleDateString('en-US', {month:'short', day:'numeric'});

        if(days < 7) daysClass = 'text-red-600';
        else if(days < 30) daysClass = 'text-amber-600';
    } else if (item.current_stock <= 0) {
        daysLeft = '0';
        predictedDate = 'Now';
        daysClass = 'text-red-600';
    }

    $('#d-an-days').text(daysLeft).removeClass('text-emerald-600 text-amber-600 text-red-600').addClass(daysClass);
    $('#d-an-date').text(predictedDate);

    // C. ABC Analysis Calculation
    // Logic: Usage Value = (Monthly Consumption * Unit Cost)
    // Class A: High Value, Class C: Low Value
    let abcClass = 'C';
    const estimatedMonthlyValue = (dailyRate * 30) * unitCost;
    
    // Thresholds are arbitrary for this example, usually based on Pareto principle relative to total inv
    if(estimatedMonthlyValue > 50000) abcClass = 'A';
    else if(estimatedMonthlyValue > 10000) abcClass = 'B';
    
    $('#d-an-abc').text(abcClass).removeClass('text-red-600 text-amber-600 text-slate-500');
    if(abcClass === 'A') $('#d-an-abc').addClass('text-emerald-600'); // High priority
    else if(abcClass === 'B') $('#d-an-abc').addClass('text-amber-600');
    else $('#d-an-abc').addClass('text-slate-400');

    // D. Render Advanced Chart
    renderItemChart(code, item.low_stock_threshold);
}

function renderItemChart(code, threshold) {
    const ctx = document.getElementById('d-an-chart');
    if(!ctx) return;

    if(itemDetailChart) {
        itemDetailChart.destroy();
    }

    // Generate last 14 days labels and reconstruct stock level
    const labels = [];
    const stockHistory = [];
    
    const today = new Date();
    // Start from current stock and work backwards
    let runningStock = invCache.find(i => i.material_code === code).current_stock;
    
    // We need movements for the last 14 days
    const relevantMoves = movementCache.filter(m => m.material_code === code).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    for(let i=0; i<14; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
        
        labels.unshift(dateStr);
        stockHistory.unshift(runningStock);

        // Adjust running stock for previous day (reverse the moves of this day)
        // If today is index i, we find moves that happened on date d
        const startOfDay = new Date(d.setHours(0,0,0,0));
        const endOfDay = new Date(d.setHours(23,59,59,999));
        
        const daysMoves = relevantMoves.filter(m => {
            const mDate = new Date(m.created_at);
            return mDate >= startOfDay && mDate <= endOfDay;
        });

        // To go back to yesterday's stock, we subtract the changes (reverse logic)
        // If stock increased today (+), yesterday it was lower (-).
        daysMoves.forEach(m => {
            runningStock -= m.change_amount; 
        });
    }

    // Create Gradient
    const chartCtx = ctx.getContext('2d');
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Royal Blue
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    itemDetailChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Stock Level',
                    data: stockHistory,
                    borderColor: '#3b82f6',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#3b82f6',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3 // Smooth curves
                },
                {
                    label: 'Safety Limit',
                    data: new Array(14).fill(threshold),
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 1 // Draw on top
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 10 } }
                },
                x: { 
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                }
            }
        }
    });
}

// --- UI HELPERS ---

window.design_closeDetails = function() {
    $('#m-design-details').fadeOut(150, function() { 
        $(this).addClass('hidden'); 
        if(itemDetailChart) { itemDetailChart.destroy(); itemDetailChart = null; }
    });
}

window.design_switchTab = function(tabName) {
    // Hide all contents
    $('#d-content-overview, #d-content-analytics, #d-content-history').addClass('hidden');
    
    // Reset Tab Styles
    ['overview', 'analytics', 'history'].forEach(t => {
        $(`#d-tab-${t}`)
            .removeClass('text-royal-600 border-royal-600 bg-royal-50')
            .addClass('text-slate-500 border-transparent hover:text-royal-600');
    });
    
    // Activate selected
    $(`#d-content-${tabName.split('-')[2]}`).removeClass('hidden');
    $(`#${tabName}`)
        .removeClass('text-slate-500 border-transparent hover:text-royal-600')
        .addClass('text-royal-600 border-royal-600 bg-royal-50');
    
    // Resize chart if showing analytics
    if(tabName === 'd-tab-analytics' && itemDetailChart) {
        setTimeout(() => itemDetailChart.resize(), 50);
    }
}

// --- CSV EXPORT ---
window.design_exportCSV = function() {
    if(typeof invCache === 'undefined' || invCache.length === 0) return Swal.fire('Info', 'No data to export', 'info');

    // Add Byte Order Mark for Excel Unicode compatibility
    let csvContent = "\uFEFF"; 
    
    // Header
    const headers = ["Material Code", "Category", "Description", "UoM", "Current Stock", "Low Limit", "Unit Cost (Est)", "Total Value (Est)", "Status", "Last Updated"];
    csvContent += headers.join(",") + "\r\n";

    invCache.forEach(row => {
        // Calculate estimated unit price
        let estPrice = 0;
        if(typeof prCache !== 'undefined') {
            const prItems = [];
            prCache.forEach(pr => { if(pr.pr_items) prItems.push(...pr.pr_items.filter(i=>i.material_code===row.material_code)); });
            prItems.sort((a,b) => b.unit_price - a.unit_price);
            if(prItems.length) estPrice = prItems[0].unit_price || 0;
        }
        
        // Escape quotes for CSV
        const safeDesc = (row.description||'').replace(/"/g, '""');
        const safeCat = (row.category||'').replace(/"/g, '""');

        let r = [
            `"${row.material_code}"`,
            `"${safeCat}"`,
            `"${safeDesc}"`,
            row.uom,
            row.current_stock,
            row.low_stock_threshold,
            estPrice.toFixed(2),
            (row.current_stock * estPrice).toFixed(2),
            row.status,
            row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'
        ];
        csvContent += r.join(",") + "\r\n";
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    // Filename with timestamp
    const dateStr = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `Inventory_Master_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- HTML TEMPLATE GENERATOR ---
function generateEnhancedDetailsModalHTML() {
    return `
    <div id="m-design-details" class="fixed inset-0 bg-slate-900 bg-opacity-80 z-[60] hidden flex items-center justify-center p-4 backdrop-blur-sm font-sans transition-opacity duration-300">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-slate-900/5">
            
            <!-- Header Area -->
            <div class="bg-white border-b border-slate-100 p-6 flex gap-6 items-start relative">
                <!-- Image Box -->
                <div class="w-24 h-24 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center" id="d-img-container"></div>
                
                <!-- Title & Actions -->
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h2 class="text-2xl font-bold text-slate-800 tracking-tight font-mono" id="d-modal-code">CODE</h2>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider border border-slate-200" id="d-modal-cat">CAT</span>
                            </div>
                            <p class="text-slate-500 text-sm font-medium" id="d-modal-desc">Description</p>
                        </div>
                        <button onclick="design_closeDetails()" class="text-slate-400 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50" title="Close (Esc)">
                            <i class="fas fa-times fa-lg"></i>
                        </button>
                    </div>
                    
                    <!-- Quick Actions Bar -->
                    <div class="mt-4 flex gap-3">
                        <button onclick="$('#m-design-details').addClass('hidden'); openInventoryModal('edit', $('#d-modal-code').text())" class="group px-3 py-1.5 text-xs font-bold bg-white text-slate-600 border border-slate-300 rounded shadow-sm hover:border-royal-500 hover:text-royal-600 transition flex items-center gap-2">
                            <i class="fas fa-edit text-slate-400 group-hover:text-royal-500"></i> Edit Details
                        </button>
                        <button onclick="$('#m-design-details').addClass('hidden'); openStockAdjustModal($('#d-modal-code').text())" class="group px-3 py-1.5 text-xs font-bold bg-white text-slate-600 border border-slate-300 rounded shadow-sm hover:border-royal-500 hover:text-royal-600 transition flex items-center gap-2">
                            <i class="fas fa-sliders-h text-slate-400 group-hover:text-royal-500"></i> Manual Adjust
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="flex border-b border-slate-200 bg-white">
                <button id="d-tab-overview" onclick="design_switchTab('d-tab-overview')" class="flex-1 py-3 text-sm font-bold text-royal-600 border-b-2 border-royal-600 bg-royal-50 transition">Overview</button>
                <button id="d-tab-analytics" onclick="design_switchTab('d-tab-analytics')" class="flex-1 py-3 text-sm font-bold text-slate-500 border-b-2 border-transparent hover:text-royal-600 transition">Analytics & Trends</button>
                <button id="d-tab-history" onclick="design_switchTab('d-tab-history')" class="flex-1 py-3 text-sm font-bold text-slate-500 border-b-2 border-transparent hover:text-royal-600 transition">Transaction Log</button>
            </div>

            <!-- Body Content -->
            <div class="flex-1 overflow-y-auto bg-slate-50 p-6 custom-scrollbar">
                
                <!-- TAB: OVERVIEW -->
                <div id="d-content-overview" class="space-y-6">
                    <!-- Status Card -->
                    <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200 relative overflow-hidden">
                        <div class="flex justify-between items-end mb-4 relative z-10">
                            <div>
                                <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Available Stock</div>
                                <div class="flex items-baseline gap-2">
                                    <span class="text-4xl font-bold text-slate-800 tracking-tight" id="d-ov-stock">0</span>
                                    <span class="text-sm text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded" id="d-ov-uom">PCS</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="flex flex-col items-end">
                                    <span class="text-3xl font-bold text-emerald-500" id="d-health-score">100</span>
                                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Health Score</span>
                                </div>
                                <div class="text-xs font-bold mt-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 inline-block" id="d-health-reason">Optimal</div>
                            </div>
                        </div>
                        <!-- Progress Bar Container -->
                        <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative" id="d-ov-bar-container">
                            <div id="d-ov-bar" class="h-full bg-emerald-500 transition-all duration-1000 ease-out" style="width: 50%"></div>
                        </div>
                        <div class="flex justify-between mt-2 text-xs text-slate-400 font-medium">
                            <span>0</span>
                            <span>Low Limit: <span id="d-ov-low" class="text-slate-600">5</span></span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Valuation -->
                        <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                            <h4 class="font-bold text-slate-700 text-sm border-b border-slate-100 pb-2 mb-3 flex items-center">
                                <span class="bg-amber-100 text-amber-600 w-6 h-6 flex items-center justify-center rounded-full mr-2 text-xs"><i class="fas fa-coins"></i></span>
                                Financial Value
                            </h4>
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between items-center">
                                    <span class="text-slate-500">Unit Cost (Est)</span>
                                    <span class="font-mono font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded" id="d-ov-cost">-</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-slate-500">Total Asset Value</span>
                                    <span class="font-mono font-bold text-emerald-600 text-lg" id="d-ov-val">-</span>
                                </div>
                            </div>
                        </div>

                        <!-- Logistics Info -->
                        <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                            <h4 class="font-bold text-slate-700 text-sm border-b border-slate-100 pb-2 mb-3 flex items-center">
                                <span class="bg-royal-100 text-royal-600 w-6 h-6 flex items-center justify-center rounded-full mr-2 text-xs"><i class="fas fa-truck"></i></span>
                                Supply Chain
                            </h4>
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-slate-500">Last Purchase</span>
                                    <span class="font-medium text-slate-700" id="d-ov-last-buy">-</span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Remarks</span>
                                    <p class="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100" id="d-ov-remarks">No remarks.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB: ANALYTICS -->
                <div id="d-content-analytics" class="hidden space-y-6">
                    <!-- KPI Grid -->
                    <div class="grid grid-cols-3 gap-3">
                        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
                            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">ABC Class</div>
                            <div class="text-2xl font-black text-slate-800" id="d-an-abc">C</div>
                            <div class="text-[9px] text-slate-400 mt-1">Value Priority</div>
                        </div>
                        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
                            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Avg Usage</div>
                            <div class="text-xl font-bold text-slate-800" id="d-an-cons">0 /day</div>
                            <div id="d-an-trend" class="mt-1"></div>
                        </div>
                        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
                            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Run Out Date</div>
                            <div class="text-lg font-bold text-royal-600 leading-tight" id="d-an-date">-</div>
                            <div class="text-[9px] font-bold text-emerald-600 mt-1" id="d-an-days">∞ Days</div>
                        </div>
                    </div>

                    <!-- Chart Container -->
                    <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="font-bold text-slate-700 text-sm">Stock Level History (14 Days)</h4>
                            <div class="flex items-center gap-2 text-[10px]">
                                <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-blue-500 mr-1"></span> Stock</span>
                                <span class="flex items-center"><span class="w-2 h-0.5 bg-red-500 mr-1"></span> Safety Limit</span>
                            </div>
                        </div>
                        <div class="h-64 relative w-full">
                            <canvas id="d-an-chart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- TAB: HISTORY -->
                <div id="d-content-history" class="hidden">
                    <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                                <tr>
                                    <th class="p-3">Date</th>
                                    <th class="p-3">Time</th>
                                    <th class="p-3">Activity / Reference</th>
                                    <th class="p-3 text-right">Movement</th>
                                </tr>
                            </thead>
                            <tbody id="d-hist-tbody" class="divide-y divide-slate-50 bg-white">
                                <!-- JS Injected -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            
            <!-- Footer -->
            <div class="p-4 bg-slate-50 border-t border-slate-200 text-right flex justify-between items-center">
                <div class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Trans-System Extended v2.1</div>
                <button onclick="design_closeDetails()" class="px-5 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded shadow-sm hover:bg-slate-100 hover:text-slate-900 transition text-sm">Close Details</button>
            </div>
        </div>
    </div>
    `;
}