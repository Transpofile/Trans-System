// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://airrabkojxzzilgdcraz.supabase.co';
// Note: In a production environment, keys should be stored in environment variables, not hardcoded.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcnJhYmtvanh6emlsZ2RjcmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NjY4MjEsImV4cCI6MjA3NDQ0MjgyMX0._XUe8Mk7jjY4RGyzaJ44mN5slfIP8pPYLNjcJYQkg-g';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- UPLOAD HELPER ---
async function uploadImageToSupabase(file) {
    if (!file) return null;
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload to bucket 'inventory-images'
        const { error: uploadError } = await supabase.storage.from('inventory-images').upload(filePath, file);
        if (uploadError) throw uploadError;

        // Get URL
        const { data: urlData } = supabase.storage.from('inventory-images').getPublicUrl(filePath);
        return urlData.publicUrl;
    } catch (err) {
        console.error("Upload failed", err);
        return null;
    }
}

let chartInstance = null;
let activeReqId = null;
let activeCategory = 'All'; 
let activeReqFilter = 'All'; 
let tempReqItems = []; // For disposal logic

const DEFAULT_MASTER = {
    categories: ['Spare Parts', 'Tires', 'Fluids', 'Electrical', 'Tools', 'Safety Gear'],
    units: ['Pcs', 'Liters', 'Sets', 'Boxes', 'Rolls', 'Kgs'],
    departments: ['Mining Ops', 'Maintenance', 'Safety', 'Admin', 'Truck Master']
};

window.onload = async () => {
    updateTime(); setInterval(updateTime, 1000);
    await loadMasterData(); await seedPRData(); await seedDisposalData();
    loadThemePreference();
    renderDashboard(); setupCalculatorDrag();
    
    document.getElementById('form-pr-edit').onsubmit = submitPRForm;
    document.getElementById('form-inv-edit').onsubmit = submitInvEdit;
    document.getElementById('form-req-edit').onsubmit = submitReqEdit;
    document.getElementById('form-disposal-edit').onsubmit = submitDisposalForm;
    
    // Initial setup for requests
    addWithdrawalRow(); 
    
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => { if(e.target === m) m.classList.remove('open'); });
    });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); });
};

// --- SUPABASE DB ACTION BRIDGE ---
async function dbAction(storeName, mode, callback) {
    const storeMock = {
        getAll: async () => {
            const { data, error } = await supabase.from(storeName).select('*');
            if(error) { console.error('Supabase Error:', error); return []; }
            return data || [];
        },
        get: async (key) => {
            if(storeName === 'master') {
                const { data, error } = await supabase.from('master_data').select('*').eq('key', key).single();
                return data; 
            }
            const { data, error } = await supabase.from(storeName).select('*').eq('id', key).single();
            if(error) { console.error('Supabase Error:', error); return null; }
            return data;
        },
        add: async (val) => {
            if(!val.id) delete val.id;
            const { data, error } = await supabase.from(storeName).insert(val).select();
            if(error) { console.error('Supabase Error:', error); throw error; }
            return data;
        },
        put: async (val) => {
            if(storeName === 'master') {
                 const { error } = await supabase.from('master_data').upsert(val);
                 if(error) console.error(error);
                 return;
            }
            const { error } = await supabase.from(storeName).update(val).eq('id', val.id);
            if(error) { console.error('Supabase Error:', error); throw error; }
        },
        delete: async (key) => {
            const { error } = await supabase.from(storeName).delete().eq('id', key);
            if(error) { console.error('Supabase Error:', error); throw error; }
        },
        count: async () => {
            const { count } = await supabase.from(storeName).select('*', { count: 'exact', head: true });
            return count || 0;
        },
        clear: async () => {
            const { error } = await supabase.from(storeName).delete().neq('id', 0);
            if(error) console.error('Supabase Error:', error);
        }
    };
    return await callback(storeMock);
}

async function logAction(action, details) { await dbAction('logs', 'readwrite', store => store.add({ timestamp: new Date().toLocaleString(), action, details })); }

function navTo(viewId, btn) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    if(btn) { document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-nav', 'bg-brand-700', 'text-white')); btn.classList.add('active-nav', 'bg-brand-700', 'text-white'); }
    if (viewId === 'view-inventory') renderInventory();
    if (viewId === 'view-requests') renderRequests();
    if (viewId === 'view-pr-requests') renderPRRequests();
    if (viewId === 'view-disposal') renderDisposal();
    if (viewId === 'view-logs') renderLogs();
    if (viewId === 'view-dashboard') renderDashboard();
    if (viewId === 'view-master-data') renderMasterLists();
    
    if(window.innerWidth < 768) { document.getElementById('sidebar').classList.add('hidden'); }
}

function showToast(msg, type='info') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    const icon = document.getElementById('toast-icon');
    if(type==='success') icon.className = "fas fa-check-circle";
    else if(type==='error') icon.className = "fas fa-exclamation-circle";
    else icon.className = "fas fa-info-circle";
    
    toast.className = `fixed top-5 right-5 px-6 py-3 rounded-lg shadow-xl transform transition-transform duration-300 z-50 flex items-center gap-3 text-white ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`;
    toast.classList.remove('translate-x-full');
    setTimeout(() => toast.classList.add('translate-x-full'), 3000);
}
function updateTime() { const now = new Date(); document.getElementById('header-time').innerText = now.toLocaleTimeString(); document.getElementById('header-date').innerText = now.toLocaleDateString(undefined, {weekday:'short', year:'numeric', month:'short', day:'numeric'}); }

let masterData = DEFAULT_MASTER;

async function loadMasterData() {
    try { 
        const result = await dbAction('master', 'readonly', store => store.get('config')); 
        if (result && result.data) masterData = result.data;
        else await dbAction('master', 'readwrite', store => store.put({ key: 'config', data: DEFAULT_MASTER }));
    } catch (e) { console.warn("Master data load issue", e); }
    populateDropdowns('add-category', masterData.categories); populateDropdowns('add-unit', masterData.units); populateDropdowns('req-dept', masterData.departments);
    populateDropdowns('pr-category', masterData.categories); populateDropdowns('pr-unit', masterData.units); populateDropdowns('req-edit-dept', masterData.departments);
}

async function seedPRData() {
    try {
        const prCount = await dbAction('pr_requests', 'readonly', store => store.count());
        if (prCount > 0) return; 
        const seedData = [
            { materialCode: 'MTRL001', materialDescription: 'Heavy Duty Truck Filter Pack', unit: 'Sets', quantity: 10, unitPrice: 45.50, category: 'Spare Parts', dateProcess: '2023-11-01', prNumber: 'PR2311001', status: 'Received', imageLink1: 'https://via.placeholder.com/600x400/0000FF/FFFFFF?text=Filter+Pack+A', expectedDate: '2023-11-15', receivedDate: '2023-11-14', vendorName: 'Global Filters Inc.', remarks: 'Urgent replacement for CAT 793D' },
            { materialCode: 'CHEM020', materialDescription: 'Industrial Lubricant (ISO 46)', unit: 'Liters', quantity: 500, unitPrice: 3.20, category: 'Fluids', dateProcess: '2023-12-01', prNumber: 'PR2312001', status: 'Pending', imageLink2: 'https://via.placeholder.com/600x400/FF0000/FFFFFF?text=Lubricant+Drum', expectedDate: '2024-01-15', receivedDate: '', vendorName: 'PetroChem Supplies', remarks: 'Large volume order' }
        ];
        for (const data of seedData) await dbAction('pr_requests', 'readwrite', store => store.add(data));
    } catch(e) { console.log("Seeding skipped"); }
}

async function seedDisposalData() {
    try {
         const dspCount = await dbAction('disposal', 'readonly', store => store.count());
         if (dspCount > 0) return;
         const seed = [
             { sourceRequestId: 99, assetName: 'Old Hydraulic Pump', assetCode: 'HYD-99', category: 'Spare Parts', reason: 'Damaged/Broken', method: 'Scrap', quantity: 2, disposalDate: '2023-10-15', approvedBy: 'Engr. Smith', status: 'Disposed' }
         ];
         for(const s of seed) await dbAction('disposal', 'readwrite', store => store.add(s));
    } catch(e) { console.log("Disposal Seeding skipped/failed"); }
}

function populateDropdowns(id, items) {
    const sel = document.getElementById(id); if(!sel) return;
    sel.innerHTML = '<option value="">Select...</option>';
    if(items) items.forEach(i => { const opt = document.createElement('option'); opt.value = i; opt.innerText = i; sel.appendChild(opt); });
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if(window.innerWidth >= 768) { sidebar.classList.toggle('sidebar-collapsed'); } else { sidebar.classList.toggle('hidden'); }
}

function toggleDarkMode() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    renderDashboard();
}

function loadThemePreference() {
    const pref = localStorage.getItem('theme');
    if (pref === 'dark') { document.documentElement.classList.add('dark'); document.getElementById('theme-icon').className = 'fas fa-sun'; }
}

// --- INVENTORY ---
function filterCat(cat) { activeCategory = cat; renderInventory(); }
async function renderInventory() {
    const items = await dbAction('inventory', 'readonly', store => store.getAll());
    const tbody = document.getElementById('inventory-body');
    const filter = document.getElementById('inv-search').value.toLowerCase();
    let catHTML = `<button onclick="filterCat('All')" class="px-3 py-1 rounded-full text-xs font-bold border transition ${activeCategory === 'All' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-500 text-slate-600 border-slate-300 hover:bg-slate-50'}">All</button>`;
    masterData.categories.forEach(c => {
        const isActive = activeCategory === c;
        catHTML += `<button onclick="filterCat('${c}')" class="px-3 py-1 rounded-full text-xs font-bold border transition whitespace-nowrap ${isActive ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-500 text-slate-600 border-slate-300 hover:bg-slate-50'}">${c}</button>`;
    });
    document.getElementById('inventory-categories').innerHTML = catHTML;
    tbody.innerHTML = ''; let count = 0;
    items.sort((a,b) => b.id - a.id).forEach(item => {
        const code = item.code || `ID-${item.id}`;
        const matchesSearch = code.toLowerCase().includes(filter) || item.name.toLowerCase().includes(filter);
        const matchesCat = activeCategory === 'All' || item.category === activeCategory;
        if (matchesSearch && matchesCat) {
            const isLow = item.stock <= (item.threshold || 5);
            const row = `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 transition border-b border-slate-100 dark:border-slate-700 ${isLow ? 'bg-red-50 dark:bg-red-900/20' : ''}">
                    <td class="px-6 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">${code}</td>
                    <td class="px-6 py-3 text-slate-800 dark:text-white">${item.name} ${isLow ? '<span class="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-1 rounded ml-1 font-bold border border-red-200 dark:border-red-800">LOW</span>' : ''}</td>
                    <td class="px-6 py-3"><span class="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-bold">${item.category}</span></td>
                    <td class="px-6 py-3 text-center font-bold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}">${item.stock} <span class="text-xs font-normal text-slate-500 dark:text-slate-400">${item.unit}</span></td>
                    <td class="px-6 py-3 text-xs text-slate-600 dark:text-slate-400">${item.location || '-'}</td>
                    <td class="px-6 py-3 text-right">
                        <div class="flex justify-end gap-2">
                            <button onclick="viewInventory(${item.id})" class="text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 p-1.5 rounded transition" title="View"><i class="fas fa-eye"></i></button>
                            <button onclick="editInventory(${item.id})" class="text-yellow-600 hover:bg-yellow-100 dark:hover:bg-slate-700 p-1.5 rounded transition" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                            <button onclick="deleteItem(${item.id})" class="text-red-500 hover:bg-red-100 dark:hover:bg-slate-700 p-1.5 rounded transition" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
            tbody.innerHTML += row; count++;
        }
    });
    document.getElementById('inventory-empty').classList.toggle('hidden', count > 0);
}

// --- ADD ITEM (UPDATED WITH IMAGE UPLOAD) ---
document.getElementById('form-add-item').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if(btn) btn.disabled = true;

    try {
        // Image Logic
        let imageUrl = '';
        const fileInput = document.getElementById('add-image-file');
        const urlInput = document.getElementById('add-image');

        if (fileInput && fileInput.files && fileInput.files[0]) {
            showToast('Uploading Image...', 'info');
            imageUrl = await uploadImageToSupabase(fileInput.files[0]);
            if(!imageUrl) throw new Error("Image upload failed");
        } else if (urlInput && urlInput.value) {
            imageUrl = urlInput.value.trim();
        }

        const newItem = {
            code: document.getElementById('add-code').value.trim(), 
            name: document.getElementById('add-name').value.trim(),
            category: document.getElementById('add-category').value, 
            stock: parseInt(document.getElementById('add-stock').value) || 0,
            unit: document.getElementById('add-unit').value, 
            threshold: parseInt(document.getElementById('add-threshold').value) || 5,
            location: document.getElementById('add-location').value.trim(), 
            sds: document.getElementById('add-sds').value.trim(),
            image: imageUrl // Save the URL
        };
        
        await dbAction('inventory', 'readwrite', store => store.add(newItem));
        await logAction('ADD_ITEM', `Added ${newItem.code}`);
        showToast('Item Added Successfully', 'success'); 
        e.target.reset(); 
        renderDashboard();
    } catch(err) {
        console.error(err);
        showToast(err.message || 'Error adding item', 'error');
    } finally {
        if(btn) btn.disabled = false;
    }
};

// --- EDIT INVENTORY (UPDATED WITH IMAGE) ---
async function editInventory(id) {
    const item = await dbAction('inventory', 'readonly', store => store.get(id));
    document.getElementById('inv-edit-id').value = item.id; 
    document.getElementById('inv-edit-code').value = item.code || `ID-${item.id}`;
    document.getElementById('inv-edit-name').value = item.name; 
    document.getElementById('inv-edit-stock').value = item.stock;
    document.getElementById('inv-edit-loc').value = item.location || '';
    
    // NEW: Set existing image URL
    document.getElementById('inv-edit-image').value = item.image || ''; 

    document.getElementById('inv-edit-modal').classList.add('open');
}

async function submitInvEdit(e) {
    e.preventDefault(); 
    const id = parseInt(document.getElementById('inv-edit-id').value);
    const item = await dbAction('inventory', 'readonly', store => store.get(id));
    
    item.name = document.getElementById('inv-edit-name').value; 
    item.stock = parseInt(document.getElementById('inv-edit-stock').value);
    item.location = document.getElementById('inv-edit-loc').value;
    
    // NEW: Save image URL
    item.image = document.getElementById('inv-edit-image').value;

    await dbAction('inventory', 'readwrite', store => store.put(item));
    showToast('Inventory Updated', 'success'); 
    closeModal('inv-edit-modal'); 
    renderInventory();
}

async function viewInventory(id) {
    const item = await dbAction('inventory', 'readonly', store => store.get(id));
    
    // Robust Image Handling
    const imgSrc = item.image && item.image.length > 5 
        ? item.image 
        : 'https://placehold.co/400x400/e2e8f0/475569?text=No+Image';

    document.getElementById('inv-view-content').innerHTML = `
        <div class="flex flex-col gap-4">
             <!-- Image Display -->
            <div class="max-w-xs h-48 mx-auto bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                <img src="${imgSrc}" alt="${item.name}" class="max-w-full max-h-full object-contain" onerror="this.src='https://placehold.co/400?text=Image+Error';">
            </div>

            <div class="grid grid-cols-2 gap-y-2">
                <span class="font-bold text-slate-500 dark:text-slate-400">Material Code:</span> <span class="font-mono text-brand-700 dark:text-brand-400">${item.code || '-'}</span>
                <span class="font-bold text-slate-500 dark:text-slate-400">Description:</span> <span>${item.name}</span>
                <span class="font-bold text-slate-500 dark:text-slate-400">Category:</span> <span>${item.category}</span>
                <span class="font-bold text-slate-500 dark:text-slate-400">Current Stock:</span> <span class="font-bold text-lg">${item.stock} <small class="font-normal text-slate-500 dark:text-slate-400">${item.unit}</small></span>
                <span class="font-bold text-slate-500 dark:text-slate-400">Threshold:</span> <span class="text-red-600 dark:text-red-400">${item.threshold || 5}</span>
                <span class="font-bold text-slate-500 dark:text-slate-400">Location:</span> <span>${item.location || 'N/A'}</span>
                <span class="font-bold text-slate-500 dark:text-slate-400">SDS Link:</span> <span>${item.sds ? `<a href="${item.sds}" target="_blank" class="text-blue-600 underline hover:text-blue-800">View Document</a>` : 'N/A'}</span>
            </div>
        </div>`;
    document.getElementById('inv-view-modal').classList.add('open');
}
async function deleteItem(id) { if(confirm('Are you sure you want to delete this item?')) { await dbAction('inventory', 'readwrite', store => store.delete(id)); renderInventory(); showToast('Item Deleted', 'error'); renderDashboard(); } }

// --- WITHDRAWAL (ENHANCED) ---
async function addWithdrawalRow() {
    const container = document.getElementById('withdrawal-rows');
    const items = await dbAction('inventory', 'readonly', store => store.getAll());
    
    let options = '<option value="">-- Select Material --</option>';
    items.sort((a,b) => a.name.localeCompare(b.name)).forEach(i => {
        const display = `${i.code ? i.code + ' - ' : ''}${i.name}`;
        options += `<option value="${i.id}" data-max="${i.stock}" data-unit="${i.unit}" data-code="${i.code||''}">${display}</option>`;
    });

    const rowId = 'row-' + Date.now();
    const rowHTML = `
        <div id="${rowId}" class="grid grid-cols-12 gap-4 items-center fade-in bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-600 shadow-sm">
            <div class="col-span-7">
                <select class="w-full border p-2 rounded text-sm req-item-select dark:bg-slate-700 dark:text-white dark:border-slate-500 focus:ring-brand-500" onchange="updateRowDetails(this)" required>
                    ${options}
                </select>
            </div>
            <div class="col-span-2 text-center text-xs font-bold">
                <span class="req-item-available text-slate-500 dark:text-slate-400">-</span>
            </div>
            <div class="col-span-2">
                <input type="number" oninput="validateRowQty(this)" class="w-full border p-2 rounded text-sm req-item-qty dark:bg-slate-700 dark:text-white dark:border-slate-500 focus:ring-brand-500 text-center" placeholder="0" min="1" required>
                <div class="text-[10px] text-red-500 hidden qty-error">Exceeds Stock</div>
            </div>
            <div class="col-span-1 text-center">
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 p-2 rounded transition"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', rowHTML);
}

function updateRowDetails(select) {
    const row = select.closest('div[id^="row-"]');
    const opt = select.options[select.selectedIndex];
    const availableSpan = row.querySelector('.req-item-available');
    const qtyInput = row.querySelector('.req-item-qty');
    
    if (select.value) {
        const maxStock = parseInt(opt.dataset.max);
        const unit = opt.dataset.unit;
        availableSpan.innerHTML = `<span class="${maxStock === 0 ? 'text-red-600' : 'text-green-600'}">${maxStock} ${unit}</span>`;
        qtyInput.max = maxStock;
        qtyInput.value = '';
        validateRowQty(qtyInput);
    } else {
        availableSpan.innerText = '-';
        qtyInput.removeAttribute('max');
    }
}

function validateRowQty(input) {
    const row = input.closest('div[id^="row-"]');
    const max = parseInt(input.max);
    const val = parseInt(input.value);
    const errorMsg = row.querySelector('.qty-error');
    const btn = document.getElementById('btn-submit-req');
    
    if (max && val > max) {
        input.classList.add('border-red-500', 'bg-red-50');
        errorMsg.classList.remove('hidden');
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        input.classList.remove('border-red-500', 'bg-red-50');
        errorMsg.classList.add('hidden');
        if (!document.querySelector('.qty-error:not(.hidden)')) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

document.getElementById('form-withdrawal').onsubmit = async (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll('#withdrawal-rows > div');
    if(rows.length === 0) return showToast('Please add items to withdraw', 'error');
    
    const items = [];
    const seenIds = new Set();
    let valid = true;

    for (const row of rows) {
        const sel = row.querySelector('.req-item-select');
        const qtyInput = row.querySelector('.req-item-qty');
        const qty = parseInt(qtyInput.value);
        const opt = sel.options[sel.selectedIndex];

        if(!sel.value || !qty || qty <= 0) { valid = false; break; }
        if(seenIds.has(sel.value)) { showToast('Duplicate item selected. Please combine quantities.', 'error'); return; }
        
        seenIds.add(sel.value);
        items.push({ 
            id: parseInt(sel.value), 
            name: opt.text.includes(' - ') ? opt.text.split(' - ')[1] : opt.text, 
            code: opt.dataset.code, 
            qty, 
            unit: opt.dataset.unit 
        });
    }

    if(!valid) return showToast('Please fill out all item details correctly.', 'error');

    const reqData = { 
        requester: document.getElementById('req-name').value, 
        department: document.getElementById('req-dept').value, 
        reason: document.getElementById('req-reason').value, 
        items, 
        status: 'Pending', 
        date: new Date().toLocaleDateString() 
    };

    await dbAction('requests', 'readwrite', store => store.add(reqData));
    showToast('Request Submitted Successfully', 'success'); 
    e.target.reset(); 
    document.getElementById('withdrawal-rows').innerHTML = ''; 
    addWithdrawalRow(); 
    navTo('view-requests');
    renderDashboard();
};

function setReqFilter(status, btn) {
    activeReqFilter = status;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRequests();
}

async function renderRequests() {
    const all = await dbAction('requests', 'readonly', store => store.getAll());
    const search = document.getElementById('req-search').value.toLowerCase();
    const tbody = document.getElementById('requests-body'); 
    tbody.innerHTML = '';
    
    let count = 0;
    all.sort((a,b) => b.id - a.id).forEach(r => {
        if (activeReqFilter !== 'All' && r.status !== activeReqFilter) return;
        const matchesSearch = r.requester.toLowerCase().includes(search) || 
                              r.department.toLowerCase().includes(search) || 
                              r.id.toString().includes(search);
        if (!matchesSearch) return;

        count++;
        const badge = r.status === 'Pending' ? 'badge-pending' : r.status === 'Approved' ? 'badge-approved' : r.status === 'Rejected' ? 'badge-rejected' : 'bg-slate-200 dark:bg-slate-600 dark:text-slate-300';
        
        let actions = `<button onclick="openRequestModal(${r.id})" class="text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700 p-1.5 px-3 rounded transition font-bold text-xs border border-brand-200 dark:border-slate-600">Details</button>`;
        if(r.status === 'Pending') { 
            actions += `<button onclick="openRequestEditModal(${r.id})" class="text-yellow-600 hover:bg-yellow-50 dark:hover:bg-slate-700 p-1.5 rounded transition ml-2" title="Edit Details"><i class="fas fa-pencil-alt"></i></button>`; 
        }
        actions += `<button onclick="deleteRequest(${r.id})" class="text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 p-1.5 rounded transition ml-1" title="Delete"><i class="fas fa-trash"></i></button>`;
        
        let locationBadge = '<span class="text-slate-400 text-[10px] italic">No Data</span>';
        if(r.metadata && r.metadata.geo) {
            locationBadge = `<a href="https://www.google.com/maps?q=${r.metadata.geo.lat},${r.metadata.geo.lng}" target="_blank" class="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-bold text-xs"><i class="fas fa-map-marker-alt text-red-500"></i> View Map</a>`;
        } else if (r.metadata && r.metadata.ip) {
            locationBadge = `<span class="text-slate-500 text-[10px]" title="${r.metadata.ip}">IP Tracked</span>`;
        }

        const row = `
            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">#${r.id}</td>
                <td class="px-6 py-3 text-xs whitespace-nowrap">${r.date}</td>
                <td class="px-6 py-3 font-medium text-slate-800 dark:text-white">${r.requester}</td>
                <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">${r.department}</td>
                <td class="px-6 py-3">${locationBadge}</td>
                <td class="px-6 py-3 text-center"><span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs font-bold">${r.items.length} Items</span></td>
                <td class="px-6 py-3"><span class="badge ${badge}">${r.status}</span></td>
                <td class="px-6 py-3 text-right">${actions}</td>
            </tr>`;
        tbody.innerHTML += row;
    });
    document.getElementById('requests-empty').classList.toggle('hidden', count > 0);
}

async function openRequestModal(id) {
    activeReqId = id; 
    const req = await dbAction('requests', 'readonly', store => store.get(id));
    document.getElementById('thpal-emp-name').innerText = req.requester;
    document.getElementById('thpal-dept').innerText = req.department;
    document.getElementById('thpal-date').innerText = req.date;
    document.getElementById('thpal-time').innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('thpal-reason').innerText = req.reason || '';
    document.getElementById('thpal-sig-req').innerText = req.requester;
    const tbody = document.getElementById('thpal-items-body'); tbody.innerHTML = '';
    
    for(let i=0; i<15; i++) {
        const item = req.items[i];
        const ser = i + 1;
        const unit = item ? item.unit : '';
        const qty = item ? item.qty : '';
        const desc = item ? `${item.code || ''} - ${item.name}` : '';
        tbody.innerHTML += `<tr><td class="text-center h-5">${ser}</td><td class="text-center">${unit}</td><td class="text-center">${qty}</td><td class="pl-2">${desc}</td></tr>`;
    }
    
    document.getElementById('chk-approved').checked = (req.status === 'Approved');
    document.getElementById('chk-onhold').checked = (req.status === 'Pending');
    document.getElementById('chk-declined').checked = (req.status === 'Rejected');
    document.getElementById('chk-cancelled').checked = false;
    
    const btns = document.getElementById('approval-buttons'); 
    if(req.status === 'Pending') btns.classList.remove('hidden'); else btns.classList.add('hidden');
    document.getElementById('request-details-modal').classList.add('open');
}

async function openRequestEditModal(id) {
    const req = await dbAction('requests', 'readonly', s=>s.get(id));
    document.getElementById('req-edit-id').value = req.id; document.getElementById('req-edit-name').value = req.requester;
    document.getElementById('req-edit-dept').value = req.department; document.getElementById('req-edit-reason').value = req.reason || '';
    document.getElementById('req-edit-modal').classList.add('open');
}
async function submitReqEdit(e) {
    e.preventDefault(); const id = parseInt(document.getElementById('req-edit-id').value);
    const req = await dbAction('requests', 'readonly', s=>s.get(id));
    req.requester = document.getElementById('req-edit-name').value; req.department = document.getElementById('req-edit-dept').value;
    req.reason = document.getElementById('req-edit-reason').value;
    await dbAction('requests', 'readwrite', s=>s.put(req));
    showToast('Request Details Updated', 'success'); closeModal('req-edit-modal'); renderRequests(); renderDashboard();
}
async function deleteRequest(id) { if(confirm(`Delete Request #${id}?`)) { await dbAction('requests', 'readwrite', store => store.delete(id)); renderRequests(); renderDashboard(); } }

async function processRequest(status) {
    const req = await dbAction('requests', 'readonly', store => store.get(activeReqId));
    if (status === 'Approved') {
        let insufficient = false;
        for (const i of req.items) {
            const inv = await dbAction('inventory', 'readonly', s=>s.get(i.id));
            if (!inv || inv.stock < i.qty) {
                alert(`Cannot Approve: Insufficient stock for ${i.name}. Available: ${inv ? inv.stock : 0}`);
                insufficient = true; break;
            }
        }
        if (insufficient) return;
        for (const i of req.items) {
            const inv = await dbAction('inventory', 'readonly', s=>s.get(i.id));
            inv.stock -= i.qty;
            await dbAction('inventory', 'readwrite', s=>s.put(inv));
        }
        await logAction('APPROVE_REQ', `Approved Req #${req.id} for ${req.requester}`);
    } else {
         await logAction('REJECT_REQ', `Rejected Req #${req.id}`);
    }
    req.status = status; 
    await dbAction('requests', 'readwrite', s=>s.put(req));
    closeModal('request-details-modal'); renderRequests(); renderDashboard();
}

// --- DISPOSAL LOGIC (Updated to depend on Approved Requests) ---
async function renderDisposal() {
    const data = await dbAction('disposal', 'readonly', s=>s.getAll());
    const tbody = document.getElementById('disposal-body');
    const filter = document.getElementById('disposal-search').value.toLowerCase();
    tbody.innerHTML = '';
    let count = 0;
    data.sort((a,b)=>b.id - a.id).forEach(d => {
        const matches = (d.assetName && d.assetName.toLowerCase().includes(filter)) || 
                        (d.assetCode && d.assetCode.toLowerCase().includes(filter)) || 
                        (d.reason && d.reason.toLowerCase().includes(filter)) ||
                        (d.sourceRequestId && d.sourceRequestId.toString().includes(filter));
        if(matches) {
            count++;
            const badge = d.status === 'Pending' ? 'badge-pending' : 'badge-disposed';
            tbody.innerHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 transition border-b border-slate-100 dark:border-slate-700">
                <td class="px-6 py-3 text-xs text-slate-500">#${d.id}</td>
                <td class="px-6 py-3 text-xs font-mono text-blue-600 dark:text-blue-400">Req #${d.sourceRequestId || 'N/A'}</td>
                <td class="px-6 py-3">
                    <div class="font-bold text-slate-700 dark:text-white text-sm">${d.assetName}</div>
                    <div class="text-[10px] text-slate-500">${d.assetCode || 'No Code'}</div>
                </td>
                <td class="px-6 py-3 text-xs">${d.reason}</td>
                <td class="px-6 py-3 text-xs">${d.method}</td>
                <td class="px-6 py-3 text-xs font-mono">${d.disposalDate}</td>
                <td class="px-6 py-3"><span class="badge ${badge}">${d.status}</span></td>
                <td class="px-6 py-3 text-right">
                     <button onclick="openDisposalModal(${d.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1.5"><i class="fas fa-pencil-alt"></i></button>
                     <button onclick="deleteDisposal(${d.id})" class="text-red-500 hover:text-red-700 p-1.5"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }
    });
    document.getElementById('disposal-empty').classList.toggle('hidden', count > 0);
}

async function openDisposalModal(id=null) {
    document.getElementById('form-disposal-edit').reset();
    document.getElementById('dsp-id').value = '';
    
    // Populate "Approved Requests" dropdown
    const allReqs = await dbAction('requests', 'readonly', s=>s.getAll());
    const approvedReqs = allReqs.filter(r => r.status === 'Approved');
    
    const reqSelect = document.getElementById('dsp-select-req');
    const itemSelect = document.getElementById('dsp-select-item');
    reqSelect.innerHTML = '<option value="">-- Select Approved Withdrawal Request --</option>';
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>';
    itemSelect.disabled = true;

    approvedReqs.sort((a,b)=>b.id - a.id).forEach(r => {
         const opt = document.createElement('option');
         opt.value = r.id;
         opt.innerText = `Req #${r.id} - ${r.requester} (${r.date})`;
         reqSelect.appendChild(opt);
    });

    if(id) {
        const d = await dbAction('disposal', 'readonly', s=>s.get(id));
        document.getElementById('dsp-id').value = d.id;
        
        // Set Req Select
        if(d.sourceRequestId) {
            reqSelect.value = d.sourceRequestId;
            await loadReqItems(reqSelect); // Load items first
            // Need to find which item corresponds to this record logic
            const options = itemSelect.options;
            for(let i=0; i<options.length; i++) {
                 if(options[i].dataset.name === d.assetName && options[i].dataset.code === d.assetCode) {
                     itemSelect.selectedIndex = i;
                     break;
                 }
            }
        }
        
        document.getElementById('dsp-name').value = d.assetName;
        document.getElementById('dsp-code').value = d.assetCode;
        document.getElementById('dsp-category').value = d.category;
        document.getElementById('dsp-reason').value = d.reason;
        document.getElementById('dsp-method').value = d.method;
        document.getElementById('dsp-quantity').value = d.quantity;
        document.getElementById('dsp-date').value = d.disposalDate;
        document.getElementById('dsp-approved-by').value = d.approvedBy;
        document.getElementById('dsp-status').value = d.status;
    } else {
         document.getElementById('dsp-date').value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('disposal-edit-modal').classList.add('open');
}

async function loadReqItems(reqSelect) {
    const itemSelect = document.getElementById('dsp-select-item');
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>';
    itemSelect.disabled = true;
    
    const reqId = parseInt(reqSelect.value);
    if(!reqId) return;

    const req = await dbAction('requests', 'readonly', s=>s.get(reqId));
    if(req && req.items) {
         tempReqItems = req.items; // Store globally for next step
         req.items.forEach((item, index) => {
             const opt = document.createElement('option');
             opt.value = index; // Use index to retrieve obj from tempReqItems
             opt.innerText = `${item.qty} x ${item.name} (${item.code || 'No Code'})`;
             opt.dataset.name = item.name;
             opt.dataset.code = item.code || '';
             opt.dataset.qty = item.qty;
             itemSelect.appendChild(opt);
         });
         itemSelect.disabled = false;
    }
}

async function fillDisposalItem(itemSelect) {
    if(itemSelect.value === "") return;
    
    const idx = parseInt(itemSelect.value);
    const item = tempReqItems[idx];
    
    if(item) {
        document.getElementById('dsp-name').value = item.name;
        document.getElementById('dsp-code').value = item.code || '';
        document.getElementById('dsp-quantity').value = item.qty;
        
        // Try to find category from Inventory DB for auto-fill
        if(item.id) {
             const invItem = await dbAction('inventory', 'readonly', s=>s.get(item.id));
             if(invItem) document.getElementById('dsp-category').value = invItem.category;
        }
    }
}

async function submitDisposalForm(e) {
    e.preventDefault();
    
    const id = document.getElementById('dsp-id').value;
    const reqId = document.getElementById('dsp-select-req').value;
    const itemIndex = document.getElementById('dsp-select-item').value;
    
    // Basic Validation
    if(!reqId || itemIndex === "") {
        showToast('Please select a valid Withdrawal Request and Item.', 'error');
        return;
    }

    const data = {
        sourceRequestId: parseInt(reqId),
        assetName: document.getElementById('dsp-name').value,
        assetCode: document.getElementById('dsp-code').value,
        category: document.getElementById('dsp-category').value,
        quantity: parseInt(document.getElementById('dsp-quantity').value),
        reason: document.getElementById('dsp-reason').value,
        method: document.getElementById('dsp-method').value,
        disposalDate: document.getElementById('dsp-date').value,
        approvedBy: document.getElementById('dsp-approved-by').value,
        status: document.getElementById('dsp-status').value
    };
    
    if(id) {
        // Update Existing Record
        data.id = parseInt(id);
        await dbAction('disposal', 'readwrite', s=>s.put(data));
        await logAction('UPDATE_DISPOSAL', `Updated disposal record #${id}`);
        showToast('Disposal Record Updated', 'success');
    } else {
        // Add New Record
        await dbAction('disposal', 'readwrite', s=>s.add(data));
        await logAction('ADD_DISPOSAL', `Added disposal for ${data.assetName} from Req #${reqId}`);
        showToast('Disposal Record Added', 'success');
    }
    
    closeModal('disposal-edit-modal');
    renderDisposal();
    renderDashboard();
}

async function deleteDisposal(id) {
    if(confirm('Delete this disposal record?')) {
        await dbAction('disposal', 'readwrite', s=>s.delete(id));
        renderDisposal();
        renderDashboard();
        showToast('Record Deleted', 'error');
    }
}

// --- PR LOGIC ---
async function renderPRRequests() {
    const list = document.getElementById('pr-requests-body'); list.innerHTML = '';
    const prs = await dbAction('pr_requests', 'readonly', store => store.getAll());
    if(prs.length === 0) { list.innerHTML = '<div class="p-8 text-center text-slate-400">No PRs found</div>'; return; }
    prs.sort((a,b) => b.id - a.id).forEach(r => {
        const badge = r.status === 'Pending' ? 'badge-pending' : r.status === 'Received' ? 'badge-approved' : r.status === 'For Withdrawal' ? 'badge-withdrawal' : r.status === 'Ordered' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-600 dark:text-slate-300';
        const dateDisplay = `<span class="text-[10px] text-slate-500 dark:text-slate-400">P: ${r.dateProcess||'-'}</span><br><span class="text-[10px] text-orange-600 dark:text-orange-400">E: ${r.expectedDate||'N/A'}</span>`;
        const trackingDisplay = `<span class="text-[10px] text-slate-500 dark:text-slate-400">PR: ${r.prNumber||'-'}</span><br><span class="text-[10px] text-slate-500 dark:text-slate-400">PO: ${r.poNumber||'-'}</span>`;
        list.innerHTML += `<div class="pr-list-grid hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-xs transition">
            <div><span class="font-mono text-slate-500 dark:text-slate-400">#${r.id}</span></div><div><span class="font-bold text-slate-700 dark:text-slate-200">${r.materialDescription}</span><br><span class="text-[10px] text-slate-500 dark:text-slate-400">${r.materialCode||'-'}</span></div><div class="text-center font-bold">${r.quantity} <span class="font-normal text-slate-500 dark:text-slate-400">${r.unit}</span></div><div class="font-mono text-green-700 dark:text-green-400">₱${(r.unitPrice||0).toFixed(2)}</div><div>${r.category}</div><div>${dateDisplay}</div><div>${trackingDisplay}</div><div class="text-right flex flex-col items-end gap-1"><span class="badge ${badge}">${r.status}</span><div class="flex gap-2 mt-1"><button onclick="openPRViewModal(${r.id})" class="text-brand-600 hover:text-brand-800 dark:text-brand-400 transition" title="View Details"><i class="fas fa-eye"></i></button><button onclick="openPREditModal(${r.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 transition" title="Edit"><i class="fas fa-pencil-alt"></i></button><button onclick="deletePR(${r.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 transition" title="Delete"><i class="fas fa-trash"></i></button></div></div></div>`;
    });
}
async function openPREditModal(id=null) {
    document.getElementById('form-pr-edit').reset(); document.getElementById('pr-edit-id').value = '';
    if(id) {
        const pr = await dbAction('pr_requests', 'readonly', s=>s.get(id));
        document.getElementById('pr-edit-id').value = pr.id; document.getElementById('pr-material-code').value = pr.materialCode;
        document.getElementById('pr-quantity').value = pr.quantity; document.getElementById('pr-unit').value = pr.unit;
        document.getElementById('pr-description').value = pr.materialDescription; document.getElementById('pr-category').value = pr.category;
        document.getElementById('pr-date-process').value = pr.dateProcess; document.getElementById('pr-number').value = pr.prNumber;
        document.getElementById('pr-po-number').value = pr.poNumber; document.getElementById('pr-arf-number').value = pr.arfNumber;
        document.getElementById('pr-purchaser').value = pr.purchaserAssign; document.getElementById('pr-unit-price').value = pr.unitPrice;
        document.getElementById('pr-status').value = pr.status;
        document.getElementById('pr-image-link-1').value = pr.imageLink1 || ''; document.getElementById('pr-image-link-2').value = pr.imageLink2 || '';
        document.getElementById('pr-expected-date').value = pr.expectedDate || ''; document.getElementById('pr-received-date').value = pr.receivedDate || '';
        document.getElementById('pr-vendor-name').value = pr.vendorName || ''; document.getElementById('pr-remarks').value = pr.remarks || '';
    } else { 
        document.getElementById('pr-date-process').value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('pr-edit-modal').classList.add('open');
}
async function submitPRForm(e) {
    e.preventDefault(); const id = document.getElementById('pr-edit-id').value;
    const data = { 
        materialCode: document.getElementById('pr-material-code').value, materialDescription: document.getElementById('pr-description').value, 
        quantity: parseInt(document.getElementById('pr-quantity').value), unit: document.getElementById('pr-unit').value, 
        category: document.getElementById('pr-category').value, dateProcess: document.getElementById('pr-date-process').value, 
        prNumber: document.getElementById('pr-number').value, poNumber: document.getElementById('pr-po-number').value, 
        arfNumber: document.getElementById('pr-arf-number').value, purchaserAssign: document.getElementById('pr-purchaser').value, 
        unitPrice: parseFloat(document.getElementById('pr-unit-price').value), status: document.getElementById('pr-status').value,
        imageLink1: document.getElementById('pr-image-link-1').value, imageLink2: document.getElementById('pr-image-link-2').value,  
        expectedDate: document.getElementById('pr-expected-date').value, receivedDate: document.getElementById('pr-received-date').value,
        vendorName: document.getElementById('pr-vendor-name').value, remarks: document.getElementById('pr-remarks').value 
    };
    if(id) { data.id = parseInt(id); await dbAction('pr_requests', 'readwrite', s=>s.put(data)); showToast('PR Updated', 'success'); } 
    else { await dbAction('pr_requests', 'readwrite', s=>s.add(data)); showToast('PR Added', 'success'); }
    closeModal('pr-edit-modal'); renderPRRequests(); renderDashboard();
}
async function deletePR(id) { if(confirm('Delete PR?')) await dbAction('pr_requests', 'readwrite', s=>s.delete(id)); renderPRRequests(); }

async function openPRViewModal(id) {
    const pr = await dbAction('pr_requests', 'readonly', s=>s.get(id));
    const container = document.getElementById('pr-view-content');
    const imageContainer = document.getElementById('pr-view-image-container');
    const linksContainer = document.getElementById('pr-view-links');
    const noImage = document.getElementById('pr-view-no-image');
    document.getElementById('pr-view-id-display').innerText = `(#${pr.id})`;
    imageContainer.innerHTML = '';
    const primaryImageLink = pr.imageLink1 || pr.imageLink2;
    if (primaryImageLink) {
        imageContainer.innerHTML = `<img src="${primaryImageLink}" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400/CCCCCC/808080?text=Image+Load+Error';" alt="Reference Image" class="w-full h-auto object-cover max-h-full">`;
        noImage.classList.add('hidden');
    } else {
        imageContainer.innerHTML = `<div class="flex items-center justify-center h-48 text-slate-400"><i class="fas fa-image text-4xl"></i></div>`;
        noImage.classList.remove('hidden');
    }
    linksContainer.innerHTML = '';
    if (pr.imageLink1) linksContainer.innerHTML += `<a href="${pr.imageLink1}" target="_blank" class="mx-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"><i class="fas fa-link mr-1"></i> Link 1</a>`;
    if (pr.imageLink2) linksContainer.innerHTML += `<a href="${pr.imageLink2}" target="_blank" class="mx-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"><i class="fas fa-link mr-1"></i> Link 2</a>`;

    const totalValue = (pr.quantity * (pr.unitPrice || 0)).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const badge = pr.status === 'Pending' ? 'badge-pending' : pr.status === 'Received' ? 'badge-approved' : pr.status === 'For Withdrawal' ? 'badge-withdrawal' : 'bg-slate-200 dark:bg-slate-600 dark:text-slate-300';
    const remarksDisplay = pr.remarks ? `<div class="col-span-2 text-xs italic mt-2 p-2 bg-slate-50 dark:bg-slate-700 rounded border dark:border-slate-600">${pr.remarks}</div>` : '';

    container.innerHTML = `
        <span class="font-bold text-slate-500 dark:text-slate-400">Material Code:</span> <span class="font-mono text-brand-700 dark:text-brand-400">${pr.materialCode || '-'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400 col-span-2">Description:</span> <span class="col-span-2">${pr.materialDescription}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Quantity:</span> <span class="font-bold">${pr.quantity} ${pr.unit}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Category:</span> <span>${pr.category}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Unit Price:</span> <span>₱${(pr.unitPrice||0).toFixed(2)}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Total Value:</span> <span class="font-bold text-lg text-emerald-600 dark:text-emerald-400">${totalValue}</span>
        <hr class="col-span-2 my-2 dark:border-slate-600">
        <span class="font-bold text-slate-500 dark:text-slate-400">Date Processed:</span> <span>${pr.dateProcess}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Expected Date:</span> <span class="font-bold text-orange-600 dark:text-orange-400">${pr.expectedDate || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Received Date:</span> <span class="font-bold text-green-600 dark:text-green-400">${pr.receivedDate || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Vendor:</span> <span>${pr.vendorName || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Current Status:</span> <span><span class="badge ${badge}">${pr.status}</span></span>
        <hr class="col-span-2 my-2 dark:border-slate-600">
        <span class="font-bold text-slate-500 dark:text-slate-400">PR Number:</span> <span>${pr.prNumber || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">PO Number:</span> <span>${pr.poNumber || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">ARF Number:</span> <span>${pr.arfNumber || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Purchaser:</span> <span>${pr.purchaserAssign || 'N/A'}</span>
        <div class="col-span-2"><span class="font-bold text-slate-500 dark:text-slate-400">Remarks:</span></div>${remarksDisplay}
    `;
    document.getElementById('pr-view-modal').classList.add('open');
}

// --- MASTER DATA & DASHBOARD ---
async function addMasterItem(key) { const input = document.getElementById(`add-master-${key}`); const val = input.value.trim(); if(val) { masterData[key].push(val); await dbAction('master','readwrite',s=>s.put({key:'config',data:masterData})); input.value=''; renderMasterLists(); loadMasterData(); } }
async function deleteMasterItem(key, val) { if(!confirm(`Delete ${val}?`)) return; masterData[key] = masterData[key].filter(i => i !== val); await dbAction('master','readwrite',s=>s.put({key:'config',data:masterData})); renderMasterLists(); loadMasterData(); }
async function renderMasterLists() { ['categories','units','departments'].forEach(k => { const list = document.getElementById(`master-${k}-list`); if(list && masterData[k]) { list.innerHTML = `<ul class="divide-y divide-slate-100 dark:divide-slate-700">${masterData[k].map(i=>`<li class="py-2 px-1 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700"><span>${i}</span><button class="text-red-400 hover:text-red-600" onclick="deleteMasterItem('${k}','${i}')"><i class="fas fa-trash-alt"></i></button></li>`).join('')}</ul>`; } }); }

async function renderDashboard() {
    const inv = await dbAction('inventory', 'readonly', s=>s.getAll());
    const req = await dbAction('requests', 'readonly', s=>s.getAll());
    const pr = await dbAction('pr_requests', 'readonly', s=>s.getAll());
    const dsp = await dbAction('disposal', 'readonly', s=>s.getAll());
    
    document.getElementById('dash-total-items').innerText = inv.length;
    document.getElementById('dash-low-stock').innerText = inv.filter(i=>i.stock <= (i.threshold||5)).length;
    document.getElementById('dash-pending').innerText = req.filter(r=>r.status === 'Pending').length;
    document.getElementById('dash-pr-active').innerText = pr.length;
    document.getElementById('dash-disposed').innerText = dsp.filter(d=>d.status === 'Disposed').length;
    
    document.getElementById('nav-pending-badge').innerText = req.filter(r=>r.status === 'Pending').length;
    document.getElementById('nav-pending-badge').classList.toggle('hidden', req.filter(r=>r.status === 'Pending').length === 0);

    const totalWithdrawn = req.filter(r => r.status === 'Approved').reduce((total, r) => total + r.items.reduce((sum, i) => sum + i.qty, 0), 0);
    document.getElementById('dash-total-withdraw').innerText = totalWithdrawn;
    const totalPRValue = pr.reduce((total, p) => total + (p.quantity * (p.unitPrice || 0)), 0);
    document.getElementById('dash-pr-value').innerText = totalPRValue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    const cats = {}; inv.forEach(i => cats[i.category] = (cats[i.category]||0) + i.stock);
    const ctx = document.getElementById('trading-chart').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)'); gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    chartInstance = new Chart(ctx, { type: 'line', data: { labels: Object.keys(cats), datasets: [{ label: 'Stock Volume', data: Object.values(cats), borderColor: '#10b981', backgroundColor: gradient, borderWidth: 2, pointBackgroundColor: isDark ? '#1e293b' : '#fff', pointBorderColor: '#10b981', pointRadius: 4, fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }, x: { grid: { display: false }, ticks: { color: textColor } } } } });
    
    const logs = await dbAction('logs', 'readonly', s=>s.getAll());
    const list = document.getElementById('recent-logs-list'); list.innerHTML = '';
    logs.sort((a,b)=>b.id-a.id).slice(0,5).forEach(l=>list.innerHTML+=`<li class="border-b dark:border-slate-700 py-2 text-xs flex flex-col"><span class="flex justify-between font-bold text-slate-700 dark:text-slate-200"><span>${l.action}</span><span class="font-mono text-[10px] text-slate-400">${l.timestamp.split(',')[1]}</span></span><span class="text-slate-500 dark:text-slate-400">${l.details}</span></li>`);
}

async function renderLogs() { const l = await dbAction('logs','readonly',s=>s.getAll()); document.getElementById('logs-body').innerHTML = l.sort((a,b)=>b.id-a.id).map(x=>`<tr class="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"><td class="px-4 py-2 text-xs">#${x.id}</td><td class="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">${x.timestamp}</td><td class="px-4 py-2"><span class="badge bg-slate-200 dark:bg-slate-700 dark:text-slate-300">${x.action}</span></td><td class="px-4 py-2 text-sm">${x.details}</td></tr>`).join(''); }
async function clearLogs() { if(!confirm('Are you sure you want to clear all audit logs? This cannot be undone.')) return; await dbAction('logs', 'readwrite', store => store.clear()); showToast('Logs Cleared', 'success'); renderLogs(); renderDashboard(); }

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function filterInventoryByLowStock() { document.getElementById('inv-search').value = ""; navTo('view-inventory'); }
function exportToExcel(t) { dbAction(t, 'readonly', s=>s.getAll()).then(d => { const ws = XLSX.utils.json_to_sheet(d); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sheet1"); XLSX.writeFile(wb, `${t}_export.xlsx`); }); }
function toggleCalculator(){document.getElementById('floating-calculator').classList.toggle('hidden');}
function setupCalculatorDrag(){ const calc = document.getElementById('floating-calculator'); let isDragging = false, offset = { x: 0, y: 0 }; document.getElementById('calc-header').addEventListener('mousedown', (e) => { isDragging = true; offset.x = e.clientX - calc.offsetLeft; offset.y = e.clientY - calc.offsetTop; }); document.addEventListener('mousemove', (e) => { if (isDragging) { calc.style.left = (e.clientX - offset.x) + 'px'; calc.style.top = (e.clientY - offset.y) + 'px'; } }); document.addEventListener('mouseup', () => isDragging = false); }
function calcInput(v){const d=document.getElementById('calc-display'); if(v=='C')d.value='0'; else if(v=='DEL')d.value=d.value.slice(0,-1); else if(v=='=')try{d.value=eval(d.value)}catch{d.value='Err'} else d.value=d.value=='0'?v:d.value+v;}
