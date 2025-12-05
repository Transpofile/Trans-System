/**
 * TRANS-SYSTEM PRO | ULTIMATE EXTENSION MODULE
 * ------------------------------------------------
 * This file contains enhanced logic, advanced CSS injection,
 * and robust database handling for the Logistics System.
 */

// --- 1. CONFIGURATION & STATE ---
const CONFIG = {
    supabaseUrl: 'https://airrabkojxzzilgdcraz.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcnJhYmtvanh6emlsZ2RjcmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NjY4MjEsImV4cCI6MjA3NDQ0MjgyMX0._XUe8Mk7jjY4RGyzaJ44mN5slfIP8pPYLNjcJYQkg-g',
    themeColor: '#4f46e5',
    lowStockThreshold: 5
};

// Initialize Supabase
const supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// Global State
window.appState = {
    master: { categories: [], units: [], departments: [] },
    activeInvTab: 'all',
    activeReqId: null,
    charts: {}
};

// --- 2. ADVANCED CSS INJECTION (CSS-IN-JS) ---
// This ensures consistent, high-quality styling without cluttering HTML
(function injectStyles() {
    const css = `
        /* Glassmorphism & Animations */
        :root { --glass-bg: rgba(255, 255, 255, 0.85); --glass-border: rgba(255, 255, 255, 0.5); }
        .dark { --glass-bg: rgba(15, 23, 42, 0.85); --glass-border: rgba(255, 255, 255, 0.1); }
        
        .glass-panel {
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
        }

        /* Animated Rows */
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-row { animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; opacity: 0; }
        
        /* Staggered Delay for rows */
        .animate-row:nth-child(1) { animation-delay: 0.05s; }
        .animate-row:nth-child(2) { animation-delay: 0.1s; }
        .animate-row:nth-child(3) { animation-delay: 0.15s; }
        .animate-row:nth-child(4) { animation-delay: 0.2s; }
        .animate-row:nth-child(5) { animation-delay: 0.25s; }

        /* Custom Custom Confirm Modal */
        .custom-confirm-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            z-index: 9999; display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: opacity 0.2s;
        }
        .custom-confirm-overlay.active { opacity: 1; pointer-events: all; }
        .custom-confirm-box {
            background: white; border-radius: 16px; padding: 24px; max-width: 320px; width: 90%;
            transform: scale(0.9); transition: transform 0.2s; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .dark .custom-confirm-box { background: #1e293b; color: white; border: 1px solid #334155; }
        .custom-confirm-overlay.active .custom-confirm-box { transform: scale(1); }

        /* Master Data Tags */
        .tag-pill {
            display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 99px;
            font-size: 0.75rem; font-weight: 600; margin: 2px; transition: all 0.2s;
            border: 1px solid transparent; cursor: default;
        }
        .tag-pill:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .tag-delete { margin-left: 6px; cursor: pointer; opacity: 0.6; }
        .tag-delete:hover { opacity: 1; color: #ef4444; }

        /* Image Preview in Table */
        .table-img-preview {
            width: 32px; height: 32px; border-radius: 6px; object-fit: cover; border: 1px solid #cbd5e1;
            transition: transform 0.2s; cursor: zoom-in;
        }
        .table-img-preview:hover { transform: scale(2.5); z-index: 10; border-color: #4f46e5; }
    `;
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
    
    // Inject Custom Confirm HTML
    const confirmHTML = `
    <div id="custom-confirm" class="custom-confirm-overlay">
        <div class="custom-confirm-box">
            <h3 id="confirm-title" class="text-lg font-bold mb-2">Are you sure?</h3>
            <p id="confirm-msg" class="text-sm text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone.</p>
            <div class="flex justify-end gap-3">
                <button id="confirm-cancel" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700 transition">Cancel</button>
                <button id="confirm-ok" class="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition">Yes, Proceed</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', confirmHTML);
})();

// --- 3. CORE UTILITIES ---

// Toast Notification System
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    const tMsg = document.getElementById('toast-msg');
    const icon = t.querySelector('i');
    
    // Colors
    const colors = {
        success: { bg: 'bg-slate-900', icon: 'fa-check-circle', color: 'text-green-400' },
        error:   { bg: 'bg-red-900', icon: 'fa-exclamation-circle', color: 'text-white' },
        info:    { bg: 'bg-blue-900', icon: 'fa-info-circle', color: 'text-blue-400' }
    };
    
    const style = colors[type];
    t.className = `fixed top-20 right-5 ${style.bg} text-white px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-300 z-50 flex items-center gap-3 border border-white/10`;
    icon.className = `fas ${style.icon} ${style.color} text-lg`;
    tMsg.innerText = msg;
    
    t.classList.remove('translate-x-full');
    setTimeout(() => t.classList.add('translate-x-full'), 3500);
}

// Custom Confirm Dialog (Promise based)
function safeConfirm(title, msg) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-msg').innerText = msg;
        
        modal.classList.add('active');
        
        const handleOk = () => { cleanup(); resolve(true); };
        const handleCancel = () => { cleanup(); resolve(false); };
        
        const cleanup = () => {
            modal.classList.remove('active');
            document.getElementById('confirm-ok').removeEventListener('click', handleOk);
            document.getElementById('confirm-cancel').removeEventListener('click', handleCancel);
        };
        
        document.getElementById('confirm-ok').addEventListener('click', handleOk);
        document.getElementById('confirm-cancel').addEventListener('click', handleCancel);
    });
}

// Debounce for Search (Performance)
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Google Drive Link Parser
function parseDriveLink(url) {
    if (!url) return null;
    if (url.includes('drive.google.com') && url.includes('/d/')) {
        const id = url.match(/\/d\/(.+?)\//);
        if (id && id[1]) return `https://drive.google.com/uc?export=view&id=${id[1]}`;
    }
    return url; // Return as is if it's a direct link
}

// --- 4. DATABASE & LOGIC ---

// Safe Database Wrapper
async function db(table, op, data) {
    try {
        let result = null;
        if (op === 'get') {
            const { data: d, error } = await supabase.from(table).select('*').order('id', { ascending: false });
            if (error) throw error;
            result = d || [];
        } 
        else if (op === 'getOne') {
            const { data: d, error } = await supabase.from(table).select('*').eq('id', data).single();
            if (error) throw error;
            result = d;
        }
        else if (op === 'add') {
            delete data.id; // Ensure ID is auto-generated
            const { data: d, error } = await supabase.from(table).insert(data).select();
            if (error) throw error;
            if (table !== 'logs') logSystemAction('CREATE', `Added new entry to ${table}`);
            result = d;
        }
        else if (op === 'update') {
            const { error } = await supabase.from(table).update(data).eq('id', data.id);
            if (error) throw error;
            if (table !== 'logs') logSystemAction('UPDATE', `Updated record #${data.id} in ${table}`);
        }
        else if (op === 'delete') {
            const { error } = await supabase.from(table).delete().eq('id', data);
            if (error) throw error;
            if (table !== 'logs') logSystemAction('DELETE', `Deleted record #${data} from ${table}`);
        }
        return result;
    } catch (e) {
        console.error("DB Error:", e);
        showToast(e.message, 'error');
        return null;
    }
}

async function logSystemAction(action, details) {
    await supabase.from('logs').insert({ 
        timestamp: new Date().toLocaleString('en-US'), 
        action: action, 
        details: details 
    });
}

// --- 5. INITIALIZATION & GLOBAL OVERRIDES ---

document.addEventListener("DOMContentLoaded", async () => {
    // Override window load to control flow
    setLoading(true);
    loadTheme();
    await loadFullMasterData();
    await renderDashboard(); // Initial load
    
    // Attach Debounced Search
    const searchInput = document.getElementById('inv-search');
    if (searchInput) {
        searchInput.addEventListener('keyup', debounce(() => renderInventory(), 300));
    }
    
    setLoading(false);
});

// --- 6. MASTER DATA LOGIC (Restored & Enhanced) ---

async function loadFullMasterData() {
    const d = await db('master_data', 'get');
    const config = d.find(x => x.key === 'config');
    
    if (config) {
        window.appState.master = config.data;
    } else {
        // Initialize if empty
        window.appState.master = { categories: ['Parts', 'Tires'], units: ['Pcs', 'Set'], departments: ['Logistics', 'Ops'] };
        await supabase.from('master_data').insert({ key: 'config', data: window.appState.master });
    }

    // Populate all dropdowns dynamically
    updateDropdown('inv-cat', window.appState.master.categories);
    updateDropdown('inv-unit', window.appState.master.units);
    updateDropdown('req-dept', window.appState.master.departments);
    updateDropdown('pr-unit', window.appState.master.units); // Ensure PR modal has units too

    // Render configuration lists
    renderMasterUILists();
    
    // Refresh Inventory Tabs based on categories
    renderDynamicTabs();
}

function updateDropdown(id, items) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">Select...</option>' + items.map(x => `<option value="${x}">${x}</option>`).join('');
}

function renderMasterUILists() {
    const types = ['categories', 'units', 'departments'];
    types.forEach(type => {
        const container = document.getElementById(`master-${type}-list`); // Ensure IDs match HTML
        if (!container) return; // Fallback for list-categories etc
        
        // Handle both ID naming conventions from previous versions
        const fallbackContainer = document.getElementById(`list-${type}`);
        const target = container || fallbackContainer;
        
        if (target) {
            target.innerHTML = window.appState.master[type].map(item => `
                <div class="flex justify-between items-center bg-white dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600 mb-2 shadow-sm animate-row">
                    <span class="text-sm font-medium dark:text-slate-200">${item}</span>
                    <button onclick="modifyMaster('${type}', '${item}', 'delete')" class="text-slate-400 hover:text-red-500 transition p-1">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('');
        }
    });
}

// Unified Master Data Function (Add/Delete)
window.addMasterItem = async (type) => {
    const inputId = type.startsWith('add') ? type : `add-master-${type}`; // Handle ID variation
    // Fallback for older IDs
    const fallbackId = `new-${type.substring(0,3)}`; // new-cat, new-unit
    
    let input = document.getElementById(inputId) || document.getElementById(`new-${type.substring(0,3)}`) || document.getElementById(`new-${type}`);
    if (!input) return console.error('Input not found', type);

    const val = input.value.trim();
    if (!val) return showToast('Value cannot be empty', 'error');

    await modifyMaster(type, val, 'add');
    input.value = '';
};

// Internal Master Modifier
async function modifyMaster(type, value, action) {
    setLoading(true);
    const master = window.appState.master;
    
    if (action === 'add') {
        if (master[type].includes(value)) { setLoading(false); return showToast('Already exists', 'error'); }
        master[type].push(value);
    } else if (action === 'delete') {
        if (!(await safeConfirm('Delete Configuration?', `Remove "${value}" from ${type}?`))) { setLoading(false); return; }
        master[type] = master[type].filter(x => x !== value);
    }

    await supabase.from('master_data').update({ data: master }).eq('key', 'config');
    await loadFullMasterData(); // Refresh UI
    setLoading(false);
    showToast(action === 'add' ? 'Added successfully' : 'Deleted successfully');
}

// Global exposure for HTML onclicks
window.addMaster = window.addMasterItem; // Alias
window.delMaster = (t, v) => modifyMaster(t, v, 'delete'); // Alias

// --- 7. INVENTORY LOGIC ---

function renderDynamicTabs() {
    const container = document.getElementById('inventory-tabs-container');
    if (!container) return;
    
    let html = `
        <button class="inv-tab ${window.appState.activeInvTab === 'all' ? 'active' : ''}" onclick="switchInvTab('all', this)">All</button>
        <button class="inv-tab text-red-500 ${window.appState.activeInvTab === 'low' ? 'active' : ''}" onclick="switchInvTab('low', this)">Low Stock</button>
    `;
    
    window.appState.master.categories.forEach(cat => {
        html += `<button class="inv-tab ${window.appState.activeInvTab === cat ? 'active' : ''}" onclick="switchInvTab('${cat}', this)">${cat}</button>`;
    });
    
    container.innerHTML = html;
}

window.switchInvTab = (tab, btn) => {
    window.appState.activeInvTab = tab;
    renderDynamicTabs(); // Re-render to update active class
    renderInventory();
};

window.renderInventory = async () => {
    const items = await db('inventory', 'get');
    if (!items) return;

    const term = document.getElementById('inv-search').value.toLowerCase();
    const tbody = document.getElementById('inventory-body');
    const tab = window.appState.activeInvTab;
    
    // Filtering
    let filtered = items.filter(i => 
        (i.name.toLowerCase().includes(term) || i.code.toLowerCase().includes(term))
    );

    if (tab === 'low') filtered = filtered.filter(i => i.stock <= CONFIG.lowStockThreshold);
    else if (tab !== 'all') filtered = filtered.filter(i => i.category === tab);

    // Render Table
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        document.getElementById('inv-empty').classList.remove('hidden');
        return;
    }
    document.getElementById('inv-empty').classList.add('hidden');

    filtered.forEach(i => {
        const isLow = i.stock <= CONFIG.lowStockThreshold;
        const imgUrl = parseDriveLink(i.image_link);
        const imgHtml = imgUrl 
            ? `<img src="${imgUrl}" class="table-img-preview" alt="img">` 
            : `<div class="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400"><i class="fas fa-box"></i></div>`;

        const row = `
        <tr class="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition animate-row">
            <td class="px-4 py-3" data-label="Item">
                <div class="flex items-center gap-3">
                    ${imgHtml}
                    <div>
                        <div class="font-bold dark:text-white">${i.name}</div>
                        <div class="text-xs text-slate-500 font-mono">${i.code}</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3" data-label="Category">
                <span class="tag-pill bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">${i.category}</span>
            </td>
            <td class="px-4 py-3" data-label="Stock">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-lg ${isLow ? 'text-red-500' : 'text-emerald-600'}">${i.stock}</span>
                    <span class="text-xs text-slate-400">${i.unit}</span>
                    ${isLow ? '<i class="fas fa-exclamation-circle text-red-500 animate-pulse" title="Low Stock"></i>' : ''}
                </div>
            </td>
            <td class="px-4 py-3 text-sm dark:text-slate-300" data-label="Location">
                <i class="fas fa-map-marker-alt text-slate-400 mr-1"></i>${i.location || '-'}
            </td>
            <td class="px-4 py-3 text-right" data-label="Actions">
                <div class="flex justify-end gap-2">
                    <button onclick="viewItemDetails(${i.id})" class="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition" title="View"><i class="fas fa-eye"></i></button>
                    <button onclick="editItem(${i.id})" class="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600 transition" title="Edit"><i class="fas fa-pen"></i></button>
                    <button onclick="deleteItem(${i.id})" class="p-2 rounded-lg hover:bg-red-50 text-red-600 transition" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });

    // Update Chart if in specific category tab
    const chartCont = document.getElementById('category-trends-container');
    if (tab !== 'all' && tab !== 'low' && filtered.length > 0 && chartCont) {
        chartCont.classList.remove('hidden');
        renderCategoryChart(filtered, tab);
    } else if (chartCont) {
        chartCont.classList.add('hidden');
    }
};

function renderCategoryChart(items, title) {
    const ctx = document.getElementById('category-chart');
    if (!ctx) return;
    
    if (window.appState.categoryChartInstance) window.appState.categoryChartInstance.destroy();
    
    window.appState.categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: items.map(i => i.code),
            datasets: [{ 
                label: 'Stock Level', 
                data: items.map(i => i.stock), 
                backgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: `${title} Trends` } },
            scales: { y: { beginAtZero: true } } 
        }
    });
}

// --- 8. WITHDRAWAL LOGIC (Smart Validation) ---

window.addWithdrawalRow = async () => {
    const items = await db('inventory', 'get');
    if (!items.length) return showToast('No inventory available', 'error');

    // Create dropdown options with data attributes for validation
    const opts = items.map(i => `<option value="${i.id}" data-stock="${i.stock}" data-unit="${i.unit}" data-code="${i.code}">${i.name}</option>`).join('');
    
    const row = document.createElement('div');
    row.className = "flex gap-2 items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm animate-row";
    row.innerHTML = `
        <div class="flex-1">
            <select class="req-item w-full p-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-700 dark:text-white border-0 focus:ring-2 ring-brand-500" onchange="validateRow(this)">
                <option value="">Select Item...</option>${opts}
            </select>
            <div class="text-[10px] text-slate-500 mt-1 pl-1 stock-info">Availability: -</div>
        </div>
        <div class="w-20">
            <input type="number" min="1" class="req-qty w-full p-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-700 border-0 focus:ring-2 ring-brand-500" placeholder="Qty" oninput="validateRow(this)">
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-2"><i class="fas fa-trash"></i></button>
    `;
    document.getElementById('withdrawal-rows').appendChild(row);
};

// Global function to validate row input
window.validateRow = (el) => {
    const row = el.closest('div.flex'); // Find parent row
    const sel = row.querySelector('.req-item');
    const input = row.querySelector('.req-qty');
    const info = row.querySelector('.stock-info');
    
    if (sel.selectedIndex < 1) return;

    const opt = sel.options[sel.selectedIndex];
    const stock = parseInt(opt.getAttribute('data-stock'));
    const unit = opt.getAttribute('data-unit');
    
    info.innerHTML = `Available: <b class="${stock < 5 ? 'text-red-500' : 'text-green-600'}">${stock} ${unit}</b>`;
    
    // Constraint Logic
    if (input.value > stock) {
        input.value = stock; // Auto-correct max
        showToast(`Max stock is ${stock}`, 'info');
    }
};

// --- 9. PURCHASE REQUESTS ---

window.renderPRs = async () => {
    const prs = await db('pr_requests', 'get');
    const tbody = document.getElementById('pr-requests-body');
    tbody.innerHTML = '';
    
    if (!prs || prs.length === 0) return;

    prs.forEach(p => {
        let statusColor = 'bg-slate-100 text-slate-600';
        if (p.status === 'Pending') statusColor = 'bg-yellow-100 text-yellow-800';
        if (p.status === 'Ordered') statusColor = 'bg-blue-100 text-blue-800';
        if (p.status === 'Received') statusColor = 'bg-green-100 text-green-800';

        tbody.innerHTML += `
        <tr class="border-b dark:border-slate-700 animate-row">
            <td class="px-4 py-3">
                <div class="font-bold dark:text-white">${p.materialDescription}</div>
                <div class="text-xs text-slate-500">${p.materialCode || '-'}</div>
            </td>
            <td class="px-4 py-3 font-bold">${p.quantity} <span class="text-xs font-normal">${p.unit}</span></td>
            <td class="px-4 py-3"><span class="px-2 py-1 rounded-md text-xs font-bold ${statusColor}">${p.status}</span></td>
            <td class="px-4 py-3 text-right">
                <button onclick="editPR(${p.id})" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deletePR(${p.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
};

window.editPR = async (id) => {
    const p = await db('pr_requests', 'getOne', id);
    document.getElementById('pr-id').value = p.id;
    document.getElementById('pr-desc').value = p.materialDescription;
    document.getElementById('pr-code').value = p.materialCode;
    document.getElementById('pr-qty').value = p.quantity;
    // ensure unit select is populated before setting value
    const unitSel = document.getElementById('pr-unit');
    if(unitSel.options.length <= 1) updateDropdown('pr-unit', window.appState.master.units);
    unitSel.value = p.unit;
    document.getElementById('pr-status').value = p.status; // Optional status field logic
    document.getElementById('pr-modal').classList.add('open');
};

window.deletePR = async (id) => {
    if (await safeConfirm('Delete PR?', 'This cannot be undone.')) {
        await db('pr_requests', 'delete', id);
        renderPRs();
    }
};

// --- 10. HELPER FUNCTIONS FOR MODALS & EXPORT ---

// Close Modal global
window.closeModal = (id) => document.getElementById(id).classList.remove('open');

// Excel Export with Timestamp
window.exportToExcel = async (table) => {
    setLoading(true);
    const data = await db(table, 'get');
    if (data.length) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        const date = new Date().toISOString().slice(0,10);
        XLSX.writeFile(wb, `TRANS-SYSTEM_${table}_${date}.xlsx`);
        showToast('Export Successful');
    } else {
        showToast('No data to export', 'error');
    }
    setLoading(false);
};

// View Details Modal Populator
window.viewItemDetails = async (id) => {
    setLoading(true);
    const i = await db('inventory', 'getOne', id);
    setLoading(false);
    
    if (!i) return;

    const imgUrl = parseDriveLink(i.image_link);
    const sdsUrl = parseDriveLink(i.sds_link); // Assuming SDS might also be drive link

    // HTML Injection
    const content = document.getElementById('view-item-content');
    content.innerHTML = `
        <div class="flex flex-col items-center mb-4">
            ${imgUrl ? `<img src="${imgUrl}" class="w-32 h-32 object-contain rounded-lg border mb-2 bg-white">` : `<div class="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300"><i class="fas fa-image text-3xl"></i></div>`}
            <h3 class="text-lg font-bold dark:text-white">${i.name}</h3>
            <span class="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-xs font-mono">${i.code}</span>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg"><span class="text-xs text-slate-500 block">Stock</span><b class="text-lg">${i.stock}</b> ${i.unit}</div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg"><span class="text-xs text-slate-500 block">Category</span><b>${i.category}</b></div>
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg col-span-2"><span class="text-xs text-slate-500 block">Location</span><b>${i.location || 'N/A'}</b></div>
        </div>
    `;

    // Configure Buttons
    const btnImg = document.getElementById('btn-view-image');
    const btnSds = document.getElementById('btn-view-sds');
    
    btnImg.href = imgUrl || '#';
    btnImg.style.display = imgUrl ? 'block' : 'none';
    
    btnSds.href = sdsUrl || '#';
    btnSds.style.display = sdsUrl ? 'block' : 'none';

    document.getElementById('view-item-modal').classList.add('open');
};
