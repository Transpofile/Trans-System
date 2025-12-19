// --- CONFIGURATION ---
const SB_URL = 'https://agggkqvbnotpborqcitx.supabase.co';
// WARNING: In production, ensure Row Level Security (RLS) is enabled in Supabase
// so this Anon key cannot be used to wipe your database.
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZ2drcXZibm90cGJvcnFjaXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODYxNjgsImV4cCI6MjA4MTY2MjE2OH0.XJHmLfRRJHVhsrImqnRpdwt7eN4eiO1VGk6B68uG5oo';

// Global State
let supabaseClient;
let invCache = [];
let masterData = { cats: [], uoms: [], depts: [] };
let charts = { move: null, cat: null, analytics: {} };
let appSettings = { showArchived: false, sortCol: 'created_at', sortAsc: false };

// --- UTILITIES ---
const escapeHTML = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
};

const formatNum = (num) => new Intl.NumberFormat('en-US').format(num);

const setLoading = (state) => {
    const loader = document.getElementById('global-loader'); // Assuming you add a loader div
    if(loader) loader.style.display = state ? 'flex' : 'none';
};

// --- INIT ---
window.onload = async () => {
    try {
        if (typeof supabase === 'undefined') throw new Error("Supabase library missing");
        supabaseClient = supabase.createClient(SB_URL, SB_KEY);
        
        setupDragDrop();
        setupTableSorting();
        
        // Initial Load
        await loadMasterData();
        await refreshAll();
    } catch (e) {
        showToast("System Init Error: " + e.message, 'error');
        console.error(e);
    }
};

// --- NAVIGATION & UI ---
function nav(id) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    // Highlight Nav Button
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(btn => { 
        if(btn.getAttribute('onclick')?.includes(`'${id}'`)) btn.classList.add('active'); 
    });

    if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    
    // Resize charts if dashboard
    if(id === 'dashboard') {
        setTimeout(() => Object.values(charts).forEach(c => { 
            if(c && typeof c.resize === 'function') c.resize(); 
        }), 100);
    }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${icon}"></i>
            <span>${escapeHTML(msg)}</span>
        </div>`;
        
    container.appendChild(toast);
    // Trigger reflow for animation
    void toast.offsetWidth; 
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- MASTER DATA MANAGEMENT (Enhanced) ---
async function loadMasterData() {
    const [c, u, d] = await Promise.all([
        supabaseClient.from('categories').select('*').order('name'),
        supabaseClient.from('uoms').select('*').order('name'),
        supabaseClient.from('departments').select('*').order('name')
    ]);
    masterData = { cats: c.data || [], uoms: u.data || [], depts: d.data || [] };
    renderMasterLists();
    populateDropdowns();
}

function renderMasterLists() {
    // Helper to calculate usage count from cached inventory
    const getUsageCount = (type, value) => {
        if (!invCache.length) return 0;
        if (type === 'cat') return invCache.filter(i => i.category === value).length;
        if (type === 'uom') return invCache.filter(i => i.uom === value).length;
        return 0; // Depts tracked in WRs, harder to count from cache, skipping for now
    };

    const mkList = (list, id, table, type, fn) => {
        const el = document.getElementById(id);
        if(!el) return;
        
        if(list.length === 0) {
            el.innerHTML = '<li class="text-muted text-center">No records found</li>';
            return;
        }

        el.innerHTML = list.map(i => {
            const count = getUsageCount(type, type==='uom'? i.code : i.name);
            const badgeClass = count > 0 ? 'badge-info' : 'badge-secondary';
            const countHtml = type !== 'dept' ? `<span class="badge ${badgeClass} ml-2" title="${count} items linked">${count}</span>` : '';

            return `
            <li class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                    <span class="font-weight-500">${fn(i)}</span>
                    ${countHtml}
                </div>
                <button class="btn btn-outline-danger btn-sm p-1" 
                    onclick="deleteMaster('${table}', ${i.id}, '${escapeHTML(type==='uom'?i.code:i.name)}', ${count})"
                    title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </li>
        `}).join('');
    };

    mkList(masterData.cats, 'list-categories', 'categories', 'cat', i => escapeHTML(i.name));
    mkList(masterData.uoms, 'list-uoms', 'uoms', 'uom', i => `<b>${escapeHTML(i.code)}</b> - ${escapeHTML(i.name)}`);
    mkList(masterData.depts, 'list-departments', 'departments', 'dept', i => escapeHTML(i.name));
}

async function addMaster(table, ...ids) {
    const vals = ids.map(id => document.getElementById(id).value.trim());
    if(vals.some(v => !v)) return showToast("All fields are required", "error");
    
    // Check for duplicates in local cache before network call
    let exists = false;
    if(table === 'categories' && masterData.cats.some(c => c.name.toLowerCase() === vals[0].toLowerCase())) exists = true;
    if(table === 'uoms' && masterData.uoms.some(u => u.code.toLowerCase() === vals[0].toLowerCase())) exists = true;
    
    if(exists) return showToast("Entry already exists", "error");

    const payload = table === 'uoms' ? {code:vals[0], name:vals[1]} : {name:vals[0]};
    const { error } = await supabaseClient.from(table).insert([payload]);
    
    if(error) showToast(error.message, "error");
    else {
        ids.forEach(id => document.getElementById(id).value = '');
        await loadMasterData();
        showToast("Added successfully", "success");
    }
}

async function deleteMaster(table, id, name, usageCount) {
    if(usageCount > 0) {
        return showToast(`Cannot delete "${name}". It is used by ${usageCount} items.`, "warning");
    }
    if(!confirm(`Delete "${name}" permanently?`)) return;
    
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if(error) showToast("Delete failed: " + error.message, "error");
    else { await loadMasterData(); showToast("Deleted", "success"); }
}

function populateDropdowns() {
    const fill = (id, data, fn) => {
        const el = document.getElementById(id);
        if(!el) return;
        const currentVal = el.value;
        const isFilter = id.includes('filter');
        
        let html = isFilter ? '<option value="">All Categories</option>' : '';
        html += data.map(fn).join('');
        
        el.innerHTML = html;
        if(currentVal && !isFilter) el.value = currentVal; // Preserve selection if possible
    };
    
    fill('i-cat', masterData.cats, c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`);
    fill('filter-cat', masterData.cats, c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`);
    fill('i-uom', masterData.uoms, u => `<option value="${escapeHTML(u.code)}">${escapeHTML(u.name)} (${escapeHTML(u.code)})</option>`);
    fill('wr-dept', masterData.depts, d => `<option value="${escapeHTML(d.name)}">${escapeHTML(d.name)}</option>`);
}

// --- IMAGE HANDLING ---
function setupDragDrop() {
    const zone = document.getElementById('drop-zone');
    const input = document.getElementById('i-file');
    if(!zone || !input) return;
    
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            handleImageFile(input);
        }
    });
}

function handleImageFile(input) {
    const file = input.files[0];
    if (!file) return;
    if(file.size > 2 * 1024 * 1024) return showToast("Image too large (Max 2MB)", "error");

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxW = 600; // Optimized size
            const scale = maxW / img.width;
            canvas.width = (scale < 1) ? maxW : img.width;
            canvas.height = (scale < 1) ? img.height * scale : img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
            
            document.getElementById('i-preview').src = dataUrl;
            document.getElementById('i-preview').style.display = 'block';
            document.querySelector('.drop-zone-content').style.display = 'none';
            document.getElementById('i-img-data').value = dataUrl;
        };
    };
    reader.readAsDataURL(file);
}

function clearImage() {
    document.getElementById('i-file').value = '';
    document.getElementById('i-img-data').value = '';
    const prev = document.getElementById('i-preview');
    prev.src = ''; prev.style.display = 'none';
    const content = document.querySelector('.drop-zone-content');
    if(content) content.style.display = 'block';
}

function openLightbox(src) {
    const m = document.getElementById('m-lightbox');
    document.getElementById('lightbox-img').src = src;
    m.style.display = 'flex';
}

// --- INVENTORY LOGIC ---
async function refreshAll() {
    const btn = document.querySelector('.refresh-btn i');
    if(btn) btn.classList.add('fa-spin');
    
    await Promise.all([getInventory(), getPRs(), getWRs()]);
    renderAnalytics();
    
    if(btn) setTimeout(() => btn.classList.remove('fa-spin'), 500);
}

async function getInventory() {
    let q = supabaseClient.from('inventory').select('*');
    if(!appSettings.showArchived) q = q.neq('status', 'ARCHIVED');
    
    const { data, error } = await q;
    if(error) return showToast("Load Failed: " + error.message, "error");
    
    invCache = data || [];
    renderInventoryTable();
    updateDashboard();
    
    // Update Item Selects for Transactions
    const activeItems = invCache.filter(i => i.status !== 'ARCHIVED');
    const opts = '<option value="">-- Select Material --</option>' + 
                 activeItems.map(i => `<option value="${escapeHTML(i.material_code)}">${escapeHTML(i.material_code)} - ${escapeHTML(i.description)} (Stock: ${i.current_stock})</option>`).join('');
    
    ['pr-mat','wr-mat','disp-mat'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = opts;
    });
}

// Table Sorting Setup
function setupTableSorting() {
    document.querySelectorAll('#tbl-inv-head th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if(appSettings.sortCol === field) appSettings.sortAsc = !appSettings.sortAsc;
            else { appSettings.sortCol = field; appSettings.sortAsc = true; }
            
            // UI Arrow update
            document.querySelectorAll('#tbl-inv-head th i').forEach(i => i.className = 'fas fa-sort text-muted');
            const icon = th.querySelector('i');
            if(icon) icon.className = `fas fa-sort-${appSettings.sortAsc ? 'up' : 'down'}`;
            
            renderInventoryTable();
        });
    });
}

function renderInventoryTable() {
    const search = document.getElementById('search-inv').value.toLowerCase();
    const cat = document.getElementById('filter-cat').value;
    
    // Filter
    let filtered = invCache.filter(i => {
        return (i.material_code.toLowerCase().includes(search) || i.description.toLowerCase().includes(search)) &&
               (!cat || i.category === cat);
    });

    // Sort
    filtered.sort((a, b) => {
        let valA = a[appSettings.sortCol];
        let valB = b[appSettings.sortCol];
        if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
        if (valA < valB) return appSettings.sortAsc ? -1 : 1;
        if (valA > valB) return appSettings.sortAsc ? 1 : -1;
        return 0;
    });

    const tb = document.getElementById('tbl-inv');
    tb.innerHTML = '';
    
    if(!filtered.length) {
        tb.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">No items found matches your search.</td></tr>`;
        return;
    }

    filtered.forEach(i => {
        const isArchived = i.status === 'ARCHIVED';
        let statusBadge;
        
        if (isArchived) statusBadge = '<span class="badge badge-archived">Archived</span>';
        else if (i.current_stock <= 0) statusBadge = '<span class="badge badge-danger">Out of Stock</span>';
        else if (i.current_stock <= i.low_stock_threshold) statusBadge = '<span class="badge badge-warning">Low Stock</span>';
        else statusBadge = '<span class="badge badge-success">Good</span>';

        const imgHtml = i.image_link 
            ? `<div class="img-thumb-container"><img src="${escapeHTML(i.image_link)}" class="img-thumb" onclick="openLightbox('${escapeHTML(i.image_link)}')"></div>` 
            : `<div class="img-placeholder text-muted"><i class="fas fa-cube"></i></div>`;

        const row = `
            <tr class="${isArchived ? 'row-archived' : ''}">
                <td style="width:60px">${imgHtml}</td>
                <td>
                    <div class="font-weight-bold text-primary">${escapeHTML(i.material_code)}</div>
                    <div class="text-muted small text-truncate" style="max-width: 200px;" title="${escapeHTML(i.description)}">${escapeHTML(i.description)}</div>
                </td>
                <td><span class="badge badge-light border">${escapeHTML(i.category || 'Uncategorized')}</span></td>
                <td>
                    <div class="d-flex align-items-baseline">
                        <span class="font-weight-bold h5 mb-0 mr-1">${formatNum(i.current_stock)}</span>
                        <small class="text-muted">${escapeHTML(i.uom)}</small>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td class="text-right">
                    <div class="btn-group">
                        ${!isArchived ? `
                            <button class="btn btn-outline-secondary btn-sm" onclick="openStockAdjustModal('${escapeHTML(i.material_code)}')"><i class="fas fa-sliders-h"></i></button>
                            <button class="btn btn-outline-primary btn-sm" onclick="openInventoryModal('edit', '${escapeHTML(i.material_code)}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-outline-danger btn-sm" onclick="delItem('${escapeHTML(i.material_code)}')"><i class="fas fa-trash"></i></button>
                        ` : `
                            <button class="btn btn-outline-success btn-sm" onclick="restoreItem('${escapeHTML(i.material_code)}')"><i class="fas fa-undo"></i> Restore</button>
                        `}
                    </div>
                </td>
            </tr>`;
        tb.innerHTML += row;
    });
}

function toggleArchivedView() {
    appSettings.showArchived = !appSettings.showArchived;
    document.getElementById('btn-show-archived').innerHTML = appSettings.showArchived ? '<i class="fas fa-eye-slash"></i> Hide Archived' : '<i class="fas fa-archive"></i> Show Archived';
    getInventory();
}

// --- ADD / EDIT / DELETE ---
function openInventoryModal(mode, code) {
    document.getElementById('inv-mode').value = mode;
    const isEdit = mode === 'edit';
    document.getElementById('inv-modal-title').innerText = isEdit ? 'Edit Material' : 'Add New Material';
    
    // Reset
    clearImage();
    document.getElementById('form-inventory').reset();
    document.getElementById('i-code').disabled = isEdit;
    document.getElementById('div-init-stock').style.display = isEdit ? 'none' : 'block';
    
    if(isEdit) {
        const item = invCache.find(i => i.material_code === code);
        if(item) {
            document.getElementById('i-code').value = item.material_code;
            document.getElementById('i-desc').value = item.description;
            document.getElementById('i-cat').value = item.category;
            document.getElementById('i-uom').value = item.uom;
            document.getElementById('i-low').value = item.low_stock_threshold;
            if(item.image_link) {
                document.getElementById('i-preview').src = item.image_link;
                document.getElementById('i-preview').style.display = 'block';
                document.querySelector('.drop-zone-content').style.display = 'none';
                document.getElementById('i-img-data').value = item.image_link;
            }
        }
    }
    openModal('m-inventory');
}

async function saveInventory(e) {
    e.preventDefault();
    const mode = document.getElementById('inv-mode').value;
    const code = document.getElementById('i-code').value.trim();
    
    if(!code) return showToast("Material Code is required", "error");

    const payload = {
        material_code: code,
        description: document.getElementById('i-desc').value.trim(),
        category: document.getElementById('i-cat').value,
        uom: document.getElementById('i-uom').value,
        low_stock_threshold: Number(document.getElementById('i-low').value),
        image_link: document.getElementById('i-img-data').value
    };

    let error;
    if(mode === 'add') {
        // Check duplication
        if(invCache.some(i => i.material_code === code)) return showToast("Material Code already exists", "error");
        
        payload.current_stock = Number(document.getElementById('i-stock').value);
        payload.initial_stock = payload.current_stock;
        payload.status = 'ACTIVE';
        ({ error } = await supabaseClient.from('inventory').insert([payload]));
    } else {
        ({ error } = await supabaseClient.from('inventory').update(payload).eq('material_code', payload.material_code));
    }
    
    if(error) showToast(error.message, "error");
    else {
        closeModal('m-inventory');
        await getInventory();
        // Force refresh analytics if stock changed
        if(mode === 'add' && payload.current_stock > 0) renderAnalytics();
        showToast(`Item ${mode === 'add' ? 'created' : 'updated'} successfully`, "success");
    }
}

async function delItem(code) {
    if(!confirm("Are you sure you want to delete this item?")) return;

    // 1. Try Physical Delete
    const { error } = await supabaseClient.from('inventory').delete().eq('material_code', code);
    
    if (error) {
        // 2. If FK error, Offer Soft Delete
        if (error.code === '23503' || error.message.includes('constraint')) {
            if(confirm("Cannot delete permanently because this item has history.\nArchive it instead?")) {
                const { error: archiveErr } = await supabaseClient.from('inventory').update({status: 'ARCHIVED'}).eq('material_code', code);
                if(archiveErr) showToast("Archive failed: " + archiveErr.message, "error");
                else {
                    showToast("Item Archived", "success");
                    getInventory();
                }
            }
        } else {
            showToast("Delete Failed: " + error.message, "error");
        }
    } else {
        showToast("Item Deleted Permanently", "success");
        getInventory();
    }
}

async function restoreItem(code) {
    if(!confirm("Restore this item to active status?")) return;
    const { error } = await supabaseClient.from('inventory').update({status:'ACTIVE'}).eq('material_code', code);
    if(!error) { showToast("Item Restored", "success"); getInventory(); }
}

// --- MODALS ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function switchTab(id) {
    // Hide all contents
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // Activate target
    document.getElementById(id).classList.add('active');
    // Find button that triggered this or matches id
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.onclick.toString().includes(id));
    if(btn) btn.classList.add('active');
}

// --- TRANSACTIONS (PR/WR) ---

async function getPRs() {
    // Limit to last 50 for performance
    const { data } = await supabaseClient.from('purchase_requests').select('*').order('created_at', {ascending:false}).limit(50);
    const tbl = document.getElementById('tbl-pr');
    if(!tbl) return;

    tbl.innerHTML = (data||[]).map(pr => `
        <tr>
            <td><span class="font-weight-bold text-dark">${escapeHTML(pr.pr_number)}</span></td>
            <td>${escapeHTML(pr.requester_name)}</td>
            <td>
                <span class="badge ${pr.status==='COMPLETED'?'badge-success':'badge-warning'}">
                    ${pr.status}
                </span>
            </td>
            <td>${new Date(pr.created_at).toLocaleDateString()}</td>
            <td class="text-right">
                <button class="btn btn-outline-secondary btn-sm" onclick="viewDetails('pr','${pr.pr_id}')" title="View Items"><i class="fas fa-eye"></i></button>
                ${pr.status==='PENDING' ? `<button class="btn btn-success btn-sm" onclick="processPR('${pr.pr_id}')" title="Receive Goods"><i class="fas fa-check"></i> Receive</button>` : ''}
            </td>
        </tr>`).join('');
}

async function createPR(e) {
    e.preventDefault();
    try {
        const mat = document.getElementById('pr-mat').value;
        const qty = Number(document.getElementById('pr-qty').value);
        if(qty <= 0) throw new Error("Quantity must be greater than 0");
        if(!mat) throw new Error("Select a material");

        // Header
        const { data:h, error:he } = await supabaseClient.from('purchase_requests').insert([{
            pr_number: document.getElementById('pr-num').value.trim(),
            requester_name: document.getElementById('pr-name').value.trim(),
            status: 'PENDING'
        }]).select();
        
        if(he) throw he;
        
        // Item
        await supabaseClient.from('pr_items').insert([{
            pr_id: h[0].pr_id,
            material_code: mat,
            quantity_requested: qty,
            unit_price: document.getElementById('pr-price').value
        }]);

        closeModal('m-create-pr'); 
        document.getElementById('form-create-pr').reset();
        refreshAll(); 
        showToast("PR Created Successfully", "success");
    } catch(err) { showToast(err.message, "error"); }
}

async function processPR(id) {
    if(!confirm("Receive goods into stock? This will update inventory counts.")) return;
    
    // Note: Ideally do this via RPC for atomicity. Doing client-side logic for demonstration.
    // 1. Get items
    const { data: items } = await supabaseClient.from('pr_items').select('*').eq('pr_id', id);
    if(!items || !items.length) return showToast("No items in PR", "error");

    // 2. Update stock for each
    for(let item of items) {
        // Fetch current to be safe
        const { data: curr } = await supabaseClient.from('inventory').select('current_stock').eq('material_code', item.material_code).single();
        if(curr) {
            await supabaseClient.from('inventory').update({current_stock: curr.current_stock + item.quantity_requested}).eq('material_code', item.material_code);
            // Log Movement
            await supabaseClient.from('stock_movements').insert({
                material_code: item.material_code,
                change_amount: item.quantity_requested,
                reason: `PR Receive: ${id}`
            });
        }
    }

    // 3. Close PR
    const { error } = await supabaseClient.from('purchase_requests').update({status:'COMPLETED'}).eq('pr_id', id);
    
    if(!error) { refreshAll(); showToast("Stock Updated & PR Closed", "success"); }
    else showToast(error.message, "error");
}

async function getWRs() {
    const { data } = await supabaseClient.from('withdrawal_requests').select('*').order('created_at', {ascending:false}).limit(50);
    const tb = document.getElementById('tbl-wr'); 
    const tbD = document.getElementById('tbl-disp-hist');
    
    tb.innerHTML=''; 
    if(tbD) tbD.innerHTML='';

    (data||[]).forEach(wr => {
        if(wr.wr_number.startsWith('DISP')) {
            if(tbD) {
                const parts = wr.requester_name.split('(Disposal:');
                const auth = parts[0];
                const reason = parts[1] ? parts[1].replace(')', '') : 'N/A';
                tbD.innerHTML += `
                    <tr>
                        <td><span class="font-weight-bold text-danger">${escapeHTML(wr.wr_number)}</span></td>
                        <td>${escapeHTML(auth)}</td>
                        <td>${escapeHTML(reason)}</td>
                        <td>${new Date(wr.created_at).toLocaleDateString()}</td>
                        <td class="text-right"><button class="btn btn-outline-secondary btn-sm" onclick="viewDetails('wr','${wr.wr_id}')"><i class="fas fa-eye"></i></button></td>
                    </tr>`;
            }
        } else {
            tb.innerHTML += `
            <tr>
                <td><b>${escapeHTML(wr.wr_number)}</b></td>
                <td>${escapeHTML(wr.requester_name)}</td>
                <td><span class="badge badge-info">${escapeHTML(wr.department)}</span></td>
                <td><span class="badge ${wr.status==='APPROVED'?'badge-success':'badge-warning'}">${wr.status}</span></td>
                <td class="text-right">
                    <button class="btn btn-outline-secondary btn-sm" onclick="viewDetails('wr','${wr.wr_id}')" title="View"><i class="fas fa-eye"></i></button>
                    ${wr.status==='PENDING' ? `<button class="btn btn-primary btn-sm" onclick="processWR('${wr.wr_id}')" title="Approve"><i class="fas fa-check"></i></button>` : ''}
                </td>
            </tr>`;
        }
    });
}

async function createWR(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    
    try {
        const mat = document.getElementById('wr-mat').value;
        const qty = Number(document.getElementById('wr-qty').value);
        if(qty <= 0) throw new Error("Quantity must be valid");
        
        // **ACCURACY CHECK**: Fetch REAL DB stock, don't trust cache
        const { data: dbItem, error: fetchErr } = await supabaseClient.from('inventory').select('current_stock').eq('material_code', mat).single();
        if(fetchErr || !dbItem) throw new Error("Item not found in DB");
        if(dbItem.current_stock < qty) throw new Error(`Insufficient Stock in DB! Available: ${dbItem.current_stock}`);

        const { data:h, error:he } = await supabaseClient.from('withdrawal_requests').insert([{
            wr_number: document.getElementById('wr-num').value.trim(),
            requester_name: document.getElementById('wr-name').value.trim(),
            department: document.getElementById('wr-dept').value,
            status: 'PENDING' // Requires approval step
        }]).select();
        
        if(he) throw he;
        await supabaseClient.from('wr_items').insert([{wr_id:h[0].wr_id, material_code:mat, quantity_requested:qty}]);
        
        closeModal('m-create-wr'); 
        document.getElementById('form-create-wr').reset();
        refreshAll(); 
        showToast("WR Submitted for Approval", "success");
    } catch(err) { showToast(err.message, "error"); }
    finally { btn.disabled = false; }
}

async function processWR(id) {
    if(!confirm("Approve withdrawal and deduct stock?")) return;
    
    // 1. Get Items
    const { data: items } = await supabaseClient.from('wr_items').select('*').eq('wr_id', id);
    
    // 2. Deduct (Double check stock again in loop)
    for(let item of items) {
        const { data: curr } = await supabaseClient.from('inventory').select('current_stock').eq('material_code', item.material_code).single();
        if(curr.current_stock < item.quantity_requested) {
            return showToast(`Stock too low for ${item.material_code}. Cannot Approve.`, "error");
        }
        await supabaseClient.from('inventory').update({current_stock: curr.current_stock - item.quantity_requested}).eq('material_code', item.material_code);
        await supabaseClient.from('stock_movements').insert({
            material_code: item.material_code,
            change_amount: -item.quantity_requested,
            reason: `WR Approved: ${id}`
        });
    }

    const { error } = await supabaseClient.from('withdrawal_requests').update({status:'APPROVED'}).eq('wr_id', id);
    if(!error) { refreshAll(); showToast("Approved & Stock Deducted", "success"); }
}

async function handleDisposal(e) {
    e.preventDefault();
    if(!confirm("Confirm Disposal? This permanently removes stock.")) return;
    
    try {
        const mat = document.getElementById('disp-mat').value;
        const qty = Number(document.getElementById('disp-qty').value);
        
        // Real-time check
        const { data: dbItem } = await supabaseClient.from('inventory').select('current_stock').eq('material_code', mat).single();
        if(dbItem.current_stock < qty) throw new Error("Insufficient Stock");
        
        // Create Logic Record (WR Type)
        const { data:h } = await supabaseClient.from('withdrawal_requests').insert([{
            wr_number: 'DISP-'+Date.now().toString().slice(-6),
            requester_name: `${document.getElementById('disp-auth').value} (Disposal: ${document.getElementById('disp-reason').value})`,
            status: 'APPROVED',
            department: 'DISPOSAL'
        }]).select();
        
        await supabaseClient.from('wr_items').insert([{wr_id:h[0].wr_id, material_code:mat, quantity_requested:qty}]);
        
        // Deduct
        await supabaseClient.from('inventory').update({current_stock: dbItem.current_stock - qty}).eq('material_code', mat);
        await supabaseClient.from('stock_movements').insert({
            material_code: mat,
            change_amount: -qty,
            reason: `Disposal: ${document.getElementById('disp-reason').value}`
        });

        e.target.reset(); refreshAll(); showToast("Disposal Recorded", "success");
    } catch(err) { showToast(err.message, "error"); }
}

async function viewDetails(type, id) {
    const table = type === 'pr' ? 'pr_items' : 'wr_items';
    const idCol = type === 'pr' ? 'pr_id' : 'wr_id';
    
    const { data } = await supabaseClient.from(table).select('*').eq(idCol, id);
    
    document.getElementById('view-content').innerHTML = `
        <table class="table table-sm table-striped">
            <thead class="thead-light">
                <tr><th>Material</th><th class="text-right">Qty</th>${type==='pr'?'<th class="text-right">Unit Price</th>':''}</tr>
            </thead>
            <tbody>
                ${data.map(d => {
                    // Try to find description in cache for better UX
                    const desc = invCache.find(i=>i.material_code===d.material_code)?.description || '';
                    return `
                    <tr>
                        <td>
                            <strong>${escapeHTML(d.material_code)}</strong><br>
                            <small class="text-muted">${escapeHTML(desc)}</small>
                        </td>
                        <td class="text-right font-weight-bold">${formatNum(d.quantity_requested)}</td>
                        ${type==='pr' ? `<td class="text-right">$${formatNum(d.unit_price)}</td>` : ''}
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
    openModal('m-view-details');
}

// --- STOCK ADJUSTMENT ---
function openStockAdjustModal(code) {
    const item = invCache.find(i => i.material_code === code);
    document.getElementById('adj-code').value = code;
    document.getElementById('adj-name').innerText = item.description;
    document.getElementById('adj-current').innerText = formatNum(item.current_stock);
    document.getElementById('adj-qty').value = '';
    document.getElementById('adj-reason').value = '';
    openModal('m-stock-adjust');
}

async function submitAdjustment(e) {
    e.preventDefault();
    const code = document.getElementById('adj-code').value;
    const qty = parseInt(document.getElementById('adj-qty').value);
    const reason = document.getElementById('adj-reason').value.trim();
    
    if(!qty) return showToast("Enter a quantity", "warning");
    if(!reason) return showToast("Reason is required", "warning");

    const item = invCache.find(i => i.material_code === code);
    if(item.current_stock + qty < 0) return showToast("Resulting stock cannot be negative", "error");

    const { error } = await supabaseClient.from('inventory').update({current_stock: item.current_stock + qty}).eq('material_code', code);
    await supabaseClient.from('stock_movements').insert([{
        material_code: code, 
        change_amount: qty, 
        reason: "Manual Adj: " + reason
    }]);
    
    if(error) showToast(error.message, "error");
    else { closeModal('m-stock-adjust'); refreshAll(); showToast("Stock Adjusted", "success"); }
}

// --- DASHBOARD ANALYTICS ---
function updateDashboard() {
    const active = invCache.filter(i => i.status !== 'ARCHIVED');
    
    // Counters
    document.getElementById('d-items').innerText = formatNum(active.length);
    document.getElementById('d-low').innerText = formatNum(active.filter(i => i.current_stock <= i.low_stock_threshold).length);
    document.getElementById('d-cats').innerText = formatNum([...new Set(active.map(i => i.category))].length);

    // Chart 1: Stock by Category
    const catMap = {}; 
    active.forEach(i => { 
        const c = i.category || 'Uncategorized'; 
        catMap[c] = (catMap[c]||0) + i.current_stock; 
    });
    
    const ctx1 = document.getElementById('catChart');
    if(charts.cat) charts.cat.destroy();
    
    charts.cat = new Chart(ctx1, { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(catMap), 
            datasets: [{ 
                data: Object.values(catMap), 
                backgroundColor: ['#4f46e5','#10b981','#f59e0b','#ef4444','#64748b','#8b5cf6','#ec4899'],
                borderWidth: 0
            }] 
        }, 
        options: { 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } }
        } 
    });

    // Chart 2: Top Items by Stock
    const topItems = [...active].sort((a,b) => b.current_stock - a.current_stock).slice(0, 10);
    const ctx2 = document.getElementById('moveChart');
    if(charts.move) charts.move.destroy();
    
    charts.move = new Chart(ctx2, { 
        type: 'bar', 
        data: { 
            labels: topItems.map(i => i.material_code), 
            datasets: [{ 
                label: 'Current Stock', 
                data: topItems.map(i => i.current_stock), 
                backgroundColor: '#3b82f6', 
                borderRadius: 4 
            }] 
        }, 
        options: { 
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        } 
    });
}

async function renderAnalytics() {
    // 30 Days trend
    const { data: moves } = await supabaseClient.from('stock_movements').select('*').order('created_at', {ascending: true}).limit(200);
    
    const grouped = {};
    (moves||[]).forEach(m => {
        const d = new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        if(!grouped[d]) grouped[d] = {in:0,out:0,loss:0};
        
        if(m.change_amount > 0) grouped[d].in += m.change_amount;
        else if(m.reason?.toLowerCase().includes('disposal')) grouped[d].loss += Math.abs(m.change_amount);
        else grouped[d].out += Math.abs(m.change_amount);
    });

    const dates = Object.keys(grouped);
    const inData = dates.map(k => grouped[k].in);
    const outData = dates.map(k => grouped[k].out);
    const lossData = dates.map(k => grouped[k].loss);

    const mkChart = (id, lbl, col, d) => {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        if(charts.analytics[id]) charts.analytics[id].destroy();
        
        charts.analytics[id] = new Chart(ctx, { 
            type: 'line', 
            data: { 
                labels: dates, 
                datasets: [{ 
                    label: lbl, 
                    data: d, 
                    borderColor: col, 
                    backgroundColor: col+'15', // very transparent fill
                    fill: true, 
                    tension: 0.4, 
                    pointRadius: 2,
                    pointHoverRadius: 4
                }] 
            }, 
            options: { 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, 
                scales: { x: { display: false }, y: { display: false } },
                interaction: { mode: 'nearest', axis: 'x', intersect: false }
            } 
        });
    };
    
    if(dates.length > 0) {
        mkChart('mini-in', 'In', '#10b981', inData); 
        mkChart('mini-out', 'Out', '#f59e0b', outData); 
        mkChart('mini-loss', 'Loss', '#ef4444', lossData);
    }
}
