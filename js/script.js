// --- CONFIGURATION ---
const SB_URL = 'https://agggkqvbnotpborqcitx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZ2drcXZibm90cGJvcnFjaXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODYxNjgsImV4cCI6MjA4MTY2MjE2OH0.XJHmLfRRJHVhsrImqnRpdwt7eN4eiO1VGk6B68uG5oo';

// State
let supabaseClient;
let invCache = [], movementCache = [], wrCache = [], prCache = [];
let masterData = { cats: [], uoms: [], depts: [] };
let charts = { cat: null, trend: null };
let appSettings = { showArchived: false, sortCol: 'created_at', sortAsc: false };

// Cart State for Multi-Item Transactions
let prCart = [];
let wrCart = [];

// Utilities
const escapeHTML = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
const formatNum = (num) => new Intl.NumberFormat('en-US').format(num);
const formatMoney = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : '-';

// --- INITIALIZATION ---
$(document).ready(async () => {
    try {
        if (typeof supabase === 'undefined') throw new Error("Supabase library missing");
        supabaseClient = supabase.createClient(SB_URL, SB_KEY);
        
        setupUI();
        await refreshAll();
        
    } catch (e) {
        Swal.fire('Initialization Error', e.message, 'error');
    }
});

function setupUI() {
    $('#mobile-menu-btn').click(() => $('#sidebar').toggleClass('-translate-x-full translate-x-0'));
    // Generate suggested PR/WR numbers
    $('#pr-num').val('PR-' + Date.now().toString().slice(-6));
    $('#wr-num').val('WR-' + Date.now().toString().slice(-6));

    const z = $('#drop-zone');
    z.on('click', () => $('#i-file').click());
    z.on('dragover', (e) => { e.preventDefault(); z.addClass('dragover'); });
    z.on('dragleave drop', (e) => { e.preventDefault(); z.removeClass('dragover'); });
    z.on('drop', (e) => {
        e.preventDefault();
        const f = e.originalEvent.dataTransfer.files;
        if(f.length) { $('#i-file')[0].files = f; handleImageFile($('#i-file')[0]); }
    });
}

// --- DATA FETCHING ---
async function refreshAll() {
    const isFirstLoad = invCache.length === 0;
    if(isFirstLoad) $('#loader-overlay').removeClass('hidden opacity-0').addClass('flex');
    
    try {
        await loadMasterData();
        await getInventoryData(); 
        await Promise.all([
            getPRs(),
            getWRs(),
            getMovements()
        ]);
        
        renderInventoryTable();
        updateDashboard();
        updateItemSelects();
        updateDisposalSelects(); 
    } catch (e) {
        console.error(e);
    } finally {
        if(isFirstLoad) {
            $('#loader-overlay').addClass('opacity-0');
            setTimeout(() => $('#loader-overlay').addClass('hidden').removeClass('flex'), 300);
        }
    }
}

async function loadMasterData() {
    const [c, u, d] = await Promise.all([
        supabaseClient.from('categories').select('*').order('name'),
        supabaseClient.from('uoms').select('*').order('name'),
        supabaseClient.from('departments').select('*').order('name')
    ]);
    masterData = { cats: c.data || [], uoms: u.data || [], depts: d.data || [] };
    
    renderMasterList(masterData.cats, 'list-categories', 'categories');
    renderMasterList(masterData.uoms, 'list-uoms', 'uoms', true);
    renderMasterList(masterData.depts, 'list-departments', 'departments');
    
    fillSelect('i-cat', masterData.cats, c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`);
    fillSelect('filter-cat', masterData.cats, c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`, true);
    fillSelect('i-uom', masterData.uoms, u => `<option value="${escapeHTML(u.code)}">${escapeHTML(u.name)} (${escapeHTML(u.code)})</option>`);
    fillSelect('wr-dept', masterData.depts, d => `<option value="${escapeHTML(d.name)}">${escapeHTML(d.name)}</option>`);
}

function fillSelect(id, data, fn, hasAll = false) {
    const el = $(`#${id}`);
    const current = el.val();
    let html = hasAll ? '<option value="">All Categories</option>' : '';
    html += data.map(fn).join('');
    el.html(html);
    if(current) el.val(current);
}

function renderMasterList(data, listId, table, isUom = false) {
    const html = data.length ? data.map(item => `
        <li class="flex justify-between items-center py-2 px-3 bg-white border border-slate-200 rounded shadow-sm hover:border-royal-300 transition">
            <span class="font-medium text-slate-700 text-sm truncate pr-2">${isUom ? `<b class="text-royal-600">${escapeHTML(item.code)}</b> - ${escapeHTML(item.name)}` : escapeHTML(item.name)}</span>
            <button class="text-slate-400 hover:text-red-500 transition" onclick="deleteMaster('${table}', ${item.id})"><i class="fas fa-trash-alt"></i></button>
        </li>
    `).join('') : '<li class="col-span-full text-center py-4 text-slate-400 text-sm bg-slate-50 rounded border border-dashed">No records.</li>';
    $(`#${listId}`).html(html);
}

// --- CORE LOGIC ---
async function getInventoryData() {
    const { data } = await supabaseClient.from('inventory').select('*');
    invCache = data || [];
}

async function getMovements() {
    const { data } = await supabaseClient.from('stock_movements').select('*').order('created_at', {ascending: true});
    movementCache = data || [];
}

// --- DASHBOARD ---
function updateDashboard() {
    const active = invCache.filter(i => i.status !== 'ARCHIVED');
    $('#d-items').text(formatNum(active.length));
    $('#d-low').text(formatNum(active.filter(i => i.current_stock <= i.low_stock_threshold).length));
    $('#d-depts').text(masterData.depts.length);
    const totalOut = movementCache
        .filter(m => m.change_amount < 0 && !m.reason.toLowerCase().includes('disposal'))
        .reduce((acc, curr) => acc + Math.abs(curr.change_amount), 0);
    $('#d-withdrawn').text(formatNum(totalOut));

    // Charts Logic
    const catMap = {}; 
    active.forEach(i => { catMap[i.category||'Other'] = (catMap[i.category||'Other']||0) + i.current_stock; });

    const palette = ['#1e40af', '#10b981', '#ef4444', '#64748b', '#f59e0b', '#8b5cf6'];

    if(charts.cat) charts.cat.destroy();
    const catCtx = document.getElementById('catChart');
    if(catCtx) {
        charts.cat = new Chart(catCtx, {
            type: 'doughnut',
            data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: palette, borderWidth: 1, borderColor: '#ffffff' }] },
            options: { maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
        });
    }

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
    const trendCtx = document.getElementById('trendChart');
    if(trendCtx) {
        charts.trend = new Chart(trendCtx, {
            type: 'bar',
            data: { 
                labels: Object.keys(dateMap), 
                datasets: [
                    { label: 'Inbound', data: Object.values(dateMap).map(x=>x.in), backgroundColor: '#10b981', borderRadius:4 },
                    { label: 'Outbound', data: Object.values(dateMap).map(x=>x.out), backgroundColor: '#1e40af', borderRadius:4 }
                ] 
            },
            options: { 
                maintainAspectRatio: false, 
                scales: { 
                    x:{stacked:true, grid:{display:false}}, 
                    y:{stacked:true, grid:{borderDash:[4,4], color:'#e2e8f0'}} 
                }, 
                plugins:{legend:{position:'top'}} 
            }
        });
    }
}

// --- IMAGE HELPER ---
function getItemImage(code) {
    const item = invCache.find(i => i.material_code === code);
    if(item && item.image_link) {
        return `<img src="${item.image_link}" class="img-thumb cursor-pointer hover:scale-110 transition" onclick="openLightbox('${item.image_link}')">`;
    }
    return `<div class="img-placeholder"><i class="fas fa-cube"></i></div>`;
}

// --- INVENTORY TABLE ---
function renderInventoryTable() {
    const search = $('#search-inv').val().toLowerCase();
    const cat = $('#filter-cat').val();
    const tb = $('#tbl-inv').empty();
    
    let filtered = invCache.filter(i => {
        if(!appSettings.showArchived && i.status === 'ARCHIVED') return false;
        const txt = (i.material_code + ' ' + i.description).toLowerCase();
        return txt.includes(search) && (!cat || i.category === cat);
    });

    filtered.sort((a,b) => {
        const va = a[appSettings.sortCol], vb = b[appSettings.sortCol];
        if (typeof va === 'string') return appSettings.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        return appSettings.sortAsc ? (va>vb?1:-1) : (va<vb?1:-1);
    });

    if(filtered.length === 0) {
        tb.html('<tr><td colspan="8" class="p-6 text-center text-slate-400 italic">No matching items found.</td></tr>');
        return;
    }

    filtered.forEach(i => {
        let statusBadge = i.current_stock <= 0 ? '<span class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold">Out</span>' : 
                          (i.current_stock <= i.low_stock_threshold ? '<span class="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold">Low</span>' : '');
        
        const sdsBtn = i.sds_link ? `<a href="${i.sds_link}" target="_blank" class="text-royal-600 hover:text-royal-800"><i class="fas fa-file-pdf fa-lg"></i></a>` : '<span class="text-slate-300">-</span>';
        
        tb.append(`
            <tr class="transition ${i.status==='ARCHIVED'?'opacity-50 bg-slate-50':''}">
                <td class="p-3">${getItemImage(i.material_code)}</td>
                <td class="p-3 font-bold font-mono text-xs text-royal-700">${escapeHTML(i.material_code)}</td>
                <td class="p-3">
                    <div class="font-medium text-slate-800">${escapeHTML(i.description)}</div>
                    ${statusBadge}
                </td>
                <td class="p-3 font-bold text-slate-700">${formatNum(i.current_stock)}</td>
                <td class="p-3 text-xs text-slate-500">${escapeHTML(i.uom)}</td>
                <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">${escapeHTML(i.category)}</span></td>
                <td class="p-3 text-center">${sdsBtn}</td>
                <td class="p-3 text-right">
                    <div class="flex justify-end gap-2">
                        ${i.status !== 'ARCHIVED' ? `
                        <button class="text-slate-400 hover:text-royal-600" onclick="viewItemHistory('${i.material_code}')" title="History"><i class="fas fa-history"></i></button>
                        <button class="text-slate-400 hover:text-royal-600" onclick="openStockAdjustModal('${i.material_code}')" title="Adjust"><i class="fas fa-sliders-h"></i></button>
                        <button class="text-slate-400 hover:text-royal-600" onclick="openInventoryModal('edit', '${i.material_code}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="text-slate-400 hover:text-red-600" onclick="delItem('${i.material_code}')" title="Archive"><i class="fas fa-trash-alt"></i></button>
                        ` : `
                        <button class="text-xs font-bold text-emerald-600 hover:text-emerald-800" onclick="restoreItem('${i.material_code}')">Restore</button>
                        `}
                    </div>
                </td>
            </tr>
        `);
    });
}

function sortInv(col) {
    if(appSettings.sortCol === col) appSettings.sortAsc = !appSettings.sortAsc;
    else { appSettings.sortCol = col; appSettings.sortAsc = true; }
    renderInventoryTable();
}

// --- CRUD INVENTORY ---
async function saveInventory(e) {
    e.preventDefault();
    const btn = $('#btn-save-inv').prop('disabled', true).text('Saving...');
    try {
        const mode = $('#inv-mode').val();
        const code = $('#i-code').val().trim().toUpperCase();
        const payload = {
            material_code: code,
            description: $('#i-desc').val().trim(),
            category: $('#i-cat').val(),
            uom: $('#i-uom').val(),
            low_stock_threshold: Number($('#i-low').val()),
            image_link: $('#i-img-data').val(),
            sds_link: $('#i-sds').val().trim(),
            remarks: $('#i-remarks').val().trim()
        };

        if(mode === 'add') {
            if(invCache.some(i => i.material_code === code)) throw new Error("Code exists!");
            payload.current_stock = Number($('#i-stock').val());
            payload.status = 'ACTIVE';
            const { error } = await supabaseClient.from('inventory').insert([payload]);
            if(error) throw error;
        } else {
            const { error } = await supabaseClient.from('inventory').update(payload).eq('material_code', code);
            if(error) throw error;
        }

        closeModal('m-inventory');
        await refreshAll();
        Swal.fire({icon: 'success', title: 'Saved', showConfirmButton: false, timer: 1000});
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        btn.prop('disabled', false).text('Save Item');
    }
}

// --- PR CART FUNCTIONS ---
function addToPrCart() {
    const mat = $('#pr-mat').val();
    const qty = parseFloat($('#pr-qty').val());
    const cost = parseFloat($('#pr-price').val()) || 0;
    const partNo = $('#pr-part-no').val().trim(); // New Field
    
    if(!mat || !qty || qty <= 0) return Swal.fire('Error', 'Invalid Material or Quantity', 'warning');

    // Check existing
    const exists = prCart.find(i => i.material_code === mat);
    if(exists) {
        exists.quantity_requested += qty;
        exists.unit_price = cost; 
        exists.part_number = partNo;
    } else {
        const item = invCache.find(i => i.material_code === mat);
        prCart.push({ 
            material_code: mat, 
            description: item.description, 
            quantity_requested: qty, 
            unit_price: cost,
            part_number: partNo 
        });
    }
    renderPrCart();
    $('#pr-mat').val(''); $('#pr-qty').val(''); $('#pr-price').val(''); $('#pr-part-no').val('');
}

function removePrCart(idx) {
    prCart.splice(idx, 1);
    renderPrCart();
}

function renderPrCart() {
    const tb = $('#pr-cart-body').empty();
    if(!prCart.length) tb.html('<tr><td colspan="5" class="p-3 text-center text-slate-400 italic">No items added.</td></tr>');
    else {
        prCart.forEach((item, idx) => {
            tb.append(`
                <tr class="hover:bg-slate-50">
                    <td class="p-2">
                        <div class="font-bold text-xs">${item.material_code}</div>
                        <div class="text-[10px] text-slate-500 truncate max-w-[150px]">${item.description}</div>
                    </td>
                    <td class="p-2 text-xs">${item.part_number || '-'}</td>
                    <td class="p-2 text-center font-bold text-xs">${item.quantity_requested}</td>
                    <td class="p-2 text-right text-xs">${formatMoney(item.unit_price)}</td>
                    <td class="p-2 text-right"><button type="button" onclick="removePrCart(${idx})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
                </tr>
            `);
        });
    }
}

async function createPR(e) {
    e.preventDefault();
    if(!prCart.length) return Swal.fire('Error', 'Add at least one item.', 'warning');

    const btn = $('#btn-save-pr').prop('disabled', true);
    const prId = $('#pr-id').val();
    
    try {
        const payloadHeader = { 
            pr_number: $('#pr-num').val().trim(), 
            requester_name: $('#pr-name').val(), 
            remarks: $('#pr-remarks').val().trim(),
            // New Fields
            purchaser: $('#pr-purchaser').val().trim(),
            arf_number: $('#pr-arf').val().trim(),
            gl_account: $('#pr-gl').val().trim(),
            expected_date: $('#pr-expected').val() || null
        };

        let activePrId = prId;

        if(!prId) {
            // INSERT Header
            payloadHeader.status = 'Pending';
            const { data, error } = await supabaseClient.from('purchase_requests').insert([payloadHeader]).select();
            if(error) throw error;
            activePrId = data[0].pr_id;
        } else {
            // UPDATE Header
            const { error } = await supabaseClient.from('purchase_requests').update(payloadHeader).eq('pr_id', prId);
            if(error) throw error;
            // Clear old items to replace with cart
            await supabaseClient.from('pr_items').delete().eq('pr_id', prId);
        }

        // Insert Items
        const itemsPayload = prCart.map(i => ({
            pr_id: activePrId,
            material_code: i.material_code,
            quantity_requested: i.quantity_requested,
            unit_price: i.unit_price,
            part_number: i.part_number // Save Part No to Items
        }));

        const { error: itemErr } = await supabaseClient.from('pr_items').insert(itemsPayload);
        if(itemErr) throw itemErr;

        closeModal('m-create-pr');
        await refreshAll();
        Swal.fire({icon: 'success', title: prId ? 'Updated' : 'Created', confirmButtonColor: '#1e40af'});
        
    } catch(err) { Swal.fire('Error', err.message, 'error'); } 
    finally { btn.prop('disabled', false); }
}

// --- WR CART FUNCTIONS ---
function checkStockAvailability(code) {
    const hint = $('#wr-stock-hint');
    if(!code) { hint.text(''); return; }
    const item = invCache.find(i => i.material_code === code);
    if(item) {
        hint.text(`Available: ${formatNum(item.current_stock)} ${item.uom}`);
        hint.toggleClass('text-red-500', item.current_stock <= 0).toggleClass('text-emerald-600', item.current_stock > 0);
        $('#wr-qty').attr('max', item.current_stock);
    }
}

function addToWrCart() {
    const mat = $('#wr-mat').val();
    const qty = parseFloat($('#wr-qty').val());
    
    if(!mat || !qty || qty <= 0) return Swal.fire('Error', 'Invalid Material or Quantity', 'warning');

    const invItem = invCache.find(i => i.material_code === mat);
    // Simple stock check against current cart + input
    const inCart = wrCart.find(i => i.material_code === mat);
    const totalQty = (inCart ? inCart.quantity_requested : 0) + qty;
    
    if(totalQty > invItem.current_stock) {
        return Swal.fire('Stock Error', `Insufficient stock. Max available: ${invItem.current_stock}`, 'error');
    }

    if(inCart) {
        inCart.quantity_requested += qty;
    } else {
        wrCart.push({ material_code: mat, description: invItem.description, quantity_requested: qty });
    }
    renderWrCart();
    $('#wr-mat').val(''); $('#wr-qty').val(''); $('#wr-stock-hint').text('');
}

function removeWrCart(idx) {
    wrCart.splice(idx, 1);
    renderWrCart();
}

function renderWrCart() {
    const tb = $('#wr-cart-body').empty();
    if(!wrCart.length) tb.html('<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">No items added.</td></tr>');
    else {
        wrCart.forEach((item, idx) => {
            tb.append(`
                <tr class="hover:bg-slate-50">
                    <td class="p-2">
                        <div class="font-bold text-xs">${item.material_code}</div>
                        <div class="text-[10px] text-slate-500 truncate max-w-[150px]">${item.description}</div>
                    </td>
                    <td class="p-2 text-center font-bold text-xs">${item.quantity_requested}</td>
                    <td class="p-2 text-right"><button type="button" onclick="removeWrCart(${idx})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
                </tr>
            `);
        });
    }
}

async function createWR(e) {
    e.preventDefault();
    if(!wrCart.length) return Swal.fire('Error', 'Add at least one item.', 'warning');

    const btn = $('#btn-submit-wr').prop('disabled', true);
    const wrId = $('#wr-id').val();
    
    try {
        const payloadHeader = { 
            wr_number: $('#wr-num').val(), 
            requester_name: $('#wr-name').val(), 
            department: $('#wr-dept').val(),
            remarks: $('#wr-remarks').val() 
        };

        let activeWrId = wrId;

        if(!wrId) {
            payloadHeader.status = 'PENDING';
            const { data, error } = await supabaseClient.from('withdrawal_requests').insert([payloadHeader]).select();
            if(error) throw error;
            activeWrId = data[0].wr_id;
        } else {
            const { error } = await supabaseClient.from('withdrawal_requests').update(payloadHeader).eq('wr_id', wrId);
            if(error) throw error;
            await supabaseClient.from('wr_items').delete().eq('wr_id', wrId);
        }

        const itemsPayload = wrCart.map(i => ({
            wr_id: activeWrId,
            material_code: i.material_code,
            quantity_requested: i.quantity_requested
        }));

        const { error: itemErr } = await supabaseClient.from('wr_items').insert(itemsPayload);
        if(itemErr) throw itemErr;

        closeModal('m-create-wr');
        await refreshAll();
        Swal.fire({icon: 'success', title: 'Saved', confirmButtonColor: '#1e40af'});
    } catch(err) { Swal.fire('Error', err.message, 'error'); } 
    finally { btn.prop('disabled', false); }
}

// --- TABLE RENDERING (PR/WR/DISPOSAL) ---

async function getPRs() {
    const { data } = await supabaseClient.from('purchase_requests').select(`*, pr_items(*)`).order('created_at', {ascending:false}).limit(50);
    prCache = data || [];
    let rowsHtml = '';

    if(!prCache.length) rowsHtml = '<tr><td colspan="16" class="p-4 text-center text-slate-400">No records found.</td></tr>';
    else {
        // Flat map: One row per item to show images clearly
        prCache.forEach(pr => {
            if (pr.pr_items && pr.pr_items.length > 0) {
                pr.pr_items.forEach((item, idx) => {
                    const invItem = invCache.find(i => i.material_code === item.material_code) || {};
                    const totalVal = (item.quantity_requested || 0) * (item.unit_price || 0);
                    
                    let badgeClass = 'bg-slate-100 text-slate-700'; 
                    if(pr.status === 'Processing') badgeClass = 'bg-blue-100 text-blue-700';
                    if(pr.status === 'For Withdrawal') badgeClass = 'bg-purple-100 text-purple-700';
                    if(pr.status === 'Withdrawn') badgeClass = 'bg-orange-100 text-orange-700';
                    if(pr.status === 'Received') badgeClass = 'bg-emerald-100 text-emerald-700';
                    if(pr.status === 'Cancel') badgeClass = 'bg-red-100 text-red-700';

                    const actionStatus = `
                        <select onchange="updatePRStatus('${pr.pr_id}', this.value, '${item.material_code}', ${item.quantity_requested})" class="w-24 text-xs border border-slate-300 rounded p-1 bg-white focus:outline-none mb-1">
                            <option value="Pending" ${pr.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Processing" ${pr.status === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="For Withdrawal" ${pr.status === 'For Withdrawal' ? 'selected' : ''}>For Withdrawal</option>
                            <option value="Withdrawn" ${pr.status === 'Withdrawn' ? 'selected' : ''}>Withdrawn</option>
                            <option value="Received" ${pr.status === 'Received' ? 'selected' : ''}>Received</option>
                            <option value="Cancel" ${pr.status === 'Cancel' ? 'selected' : ''}>Cancel</option>
                        </select>
                    `;
                    
                    const isFirst = idx === 0;
                    const borderClass = isFirst ? 'border-t border-slate-200' : '';

                    rowsHtml += `
                    <tr class="${borderClass} hover:bg-slate-50 transition">
                        <td class="p-3 sticky left-0 bg-white z-10">${getItemImage(item.material_code)}</td>
                        <td class="p-3 font-mono font-bold text-royal-700 text-xs sticky left-16 bg-white z-10">${isFirst ? escapeHTML(pr.pr_number) : '<span class="opacity-0">"</span>'}</td>
                        <td class="p-3 text-xs">${isFirst ? escapeHTML(pr.requester_name) : ''}</td>
                        <td class="p-3 font-mono text-xs font-bold">${escapeHTML(item.material_code)}</td>
                        <td class="p-3 text-xs max-w-[200px] truncate" title="${escapeHTML(invItem.description || '')}">${escapeHTML(invItem.description || '-')}</td>
                        <td class="p-3 text-center font-bold">${formatNum(item.quantity_requested)}</td>
                        <td class="p-3 text-right font-mono text-xs text-slate-600">${formatMoney(totalVal)}</td>
                        <td class="p-3 text-center">
                           ${isFirst ? `<span class="block px-2 py-1 rounded text-[10px] uppercase font-bold ${badgeClass} mb-1">${pr.status}</span>` : ''}
                        </td>
                        <td class="p-3 text-xs">${isFirst ? escapeHTML(pr.purchaser || '-') : ''}</td>
                        <td class="p-3 text-xs font-mono">${escapeHTML(item.part_number || '-')}</td>
                        <td class="p-3 text-xs">${isFirst ? escapeHTML(pr.arf_number || '-') : ''}</td>
                        <td class="p-3 text-xs">${isFirst ? escapeHTML(pr.gl_account || '-') : ''}</td>
                        <td class="p-3 text-xs">${isFirst ? formatDate(pr.expected_date) : ''}</td>
                        <td class="p-3 text-xs">${isFirst ? formatDate(pr.date_processed) : ''}</td>
                        <td class="p-3 text-xs">${isFirst ? formatDate(pr.date_received) : ''}</td>
                        
                        <td class="p-3 text-right">
                             ${isFirst ? `
                             <div class="flex flex-col items-end gap-1">
                                ${['Received','Cancel'].includes(pr.status) === false ? actionStatus : ''}
                                <div class="flex gap-1">
                                    <button onclick="editPR('${pr.pr_id}')" class="text-amber-500 hover:text-amber-700 p-1" title="Edit" ${pr.status!=='Pending'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-edit"></i></button>
                                    <button onclick="deletePR('${pr.pr_id}')" class="text-red-500 hover:text-red-700 p-1" title="Delete" ${pr.status!=='Pending'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>` : ''}
                        </td>
                    </tr>
                    `;
                });
            }
        });
    }
    $('#tbl-pr').html(rowsHtml);
}

async function getWRs() {
    const { data } = await supabaseClient.from('withdrawal_requests').select(`*, wr_items(*)`).order('created_at', {ascending:false}).limit(50);
    wrCache = data || []; 
    
    const valid = wrCache.filter(w => w.department !== 'DISPOSAL' && !w.wr_number.startsWith('DISP'));
    const disps = wrCache.filter(w => w.department === 'DISPOSAL' || w.wr_number.startsWith('DISP'));

    let wrHtml = '';
    if(!valid.length) wrHtml = '<tr><td colspan="9" class="p-4 text-center text-slate-400">No records found.</td></tr>';
    else {
        valid.forEach(wr => {
            if(wr.wr_items && wr.wr_items.length > 0) {
                wr.wr_items.forEach((item, idx) => {
                    const inv = invCache.find(i => i.material_code === item.material_code) || {};
                    const isFirst = idx === 0;
                    const borderClass = isFirst ? 'border-t border-slate-200' : '';
                    
                    const approveBtn = (isFirst && wr.status === 'PENDING') 
                        ? `<button onclick="processWR('${wr.wr_id}')" class="text-xs font-bold text-white bg-royal-600 hover:bg-royal-700 px-2 py-1 rounded shadow mb-1">Approve</button>` 
                        : '';

                    wrHtml += `
                    <tr class="${borderClass} hover:bg-slate-50">
                        <td class="p-3">${getItemImage(item.material_code)}</td>
                        <td class="p-3 font-mono font-bold text-royal-700 text-xs">${isFirst ? wr.wr_number : ''}</td>
                        <td class="p-3 text-xs">${isFirst ? escapeHTML(wr.requester_name) : ''}</td>
                        <td class="p-3 font-mono text-xs">${escapeHTML(item.material_code || '-')}</td>
                        <td class="p-3 text-xs max-w-[150px] truncate" title="${escapeHTML(inv.description)}">${escapeHTML(inv.description || '-')}</td>
                        <td class="p-3 text-center font-bold">${item.quantity_requested || 0}</td>
                        <td class="p-3 text-xs text-slate-400">${isFirst ? new Date(wr.created_at).toLocaleDateString() : ''}</td>
                        <td class="p-3 text-center">
                            ${isFirst ? `<span class="px-2 py-1 rounded text-[10px] uppercase font-bold ${wr.status==='APPROVED'?'bg-royal-100 text-royal-700':'bg-amber-100 text-amber-700'}">${wr.status}</span><div class="mt-1">${approveBtn}</div>` : ''}
                        </td>
                        <td class="p-3 text-right">
                            ${isFirst ? `
                            <div class="flex justify-end gap-1">
                                <button onclick="editWR('${wr.wr_id}')" class="text-amber-500 hover:text-amber-700 p-1" title="Edit" ${wr.status!=='PENDING'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-edit"></i></button>
                                <button onclick="deleteWR('${wr.wr_id}')" class="text-red-500 hover:text-red-700 p-1" title="Delete" ${wr.status!=='PENDING'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-trash-alt"></i></button>
                            </div>` : ''}
                        </td>
                    </tr>`;
                });
            }
        });
    }
    $('#tbl-wr').html(wrHtml);

    // Disposal Table
    let dispHtml = '';
    if(!disps.length) dispHtml = '<tr><td colspan="6" class="p-4 text-center text-slate-400">No disposal records.</td></tr>';
    else {
        disps.forEach(d => {
            if(d.wr_items && d.wr_items.length > 0) {
                d.wr_items.forEach(item => {
                    const inv = invCache.find(i => i.material_code === item.material_code) || {};
                    dispHtml += `
                    <tr class="border-b border-slate-100">
                        <td class="p-3">${getItemImage(item.material_code)}</td>
                        <td class="p-3 font-mono text-xs text-red-600">${d.wr_number}</td>
                        <td class="p-3">
                            <div class="font-bold text-xs">${escapeHTML(item.material_code)}</div>
                            <div class="text-xs truncate max-w-[150px] text-slate-500">${escapeHTML(inv.description || '-')}</div>
                        </td>
                        <td class="p-3 text-center font-bold">${item.quantity_requested || 0}</td>
                        <td class="p-3 text-xs italic text-slate-500">${escapeHTML(d.remarks || '-')}</td>
                        <td class="p-3"><span class="px-2 py-1 rounded text-[10px] uppercase font-bold bg-red-100 text-red-700">LOGGED</span></td>
                    </tr>`;
                });
            }
        });
    }
    $('#tbl-disp-hist').html(dispHtml);
}

// --- HELPER ACTIONS ---

async function editPR(id) {
    const pr = prCache.find(p => p.pr_id == id);
    if(!pr) return Swal.fire('Error', 'Record missing', 'error');
    
    openModal('m-create-pr');
    $('#pr-id').val(pr.pr_id);
    $('#pr-modal-title').text('Edit Purchase Request');
    $('#pr-num').val(pr.pr_number).prop('readonly', true);
    $('#pr-name').val(pr.requester_name);
    $('#pr-remarks').val(pr.remarks);
    
    // Populate New Fields
    $('#pr-purchaser').val(pr.purchaser || '');
    $('#pr-arf').val(pr.arf_number || '');
    $('#pr-gl').val(pr.gl_account || '');
    $('#pr-expected').val(pr.expected_date || '');

    $('#btn-save-pr').text('Update Request');

    // Load Cart
    prCart = pr.pr_items.map(i => {
        const inv = invCache.find(x => x.material_code === i.material_code);
        return { 
            material_code: i.material_code, 
            description: inv?.description, 
            quantity_requested: i.quantity_requested, 
            unit_price: i.unit_price,
            part_number: i.part_number
        };
    });
    renderPrCart();
}

async function editWR(id) {
    const wr = wrCache.find(w => w.wr_id == id);
    if(!wr) return Swal.fire('Error', 'Record missing', 'error');

    openModal('m-create-wr');
    $('#wr-id').val(wr.wr_id);
    $('#wr-modal-title').text('Edit Withdrawal Request');
    $('#wr-num').val(wr.wr_number).prop('readonly', true);
    $('#wr-name').val(wr.requester_name);
    $('#wr-dept').val(wr.department);
    $('#wr-remarks').val(wr.remarks);
    $('#btn-submit-wr').text('Update Withdrawal');

    // Load Cart
    wrCart = wr.wr_items.map(i => {
        const inv = invCache.find(x => x.material_code === i.material_code);
        return { material_code: i.material_code, description: inv?.description, quantity_requested: i.quantity_requested };
    });
    renderWrCart();
}

async function deletePR(id) {
    if(!(await Swal.fire({title:'Delete?', text:"This cannot be undone.", icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
    const { error } = await supabaseClient.from('purchase_requests').delete().eq('pr_id', id);
    if(error) Swal.fire('Error', 'Cannot delete. Record may be linked.', 'error');
    else { await refreshAll(); Swal.fire('Deleted', '', 'success'); }
}

async function deleteWR(id) {
    if(!(await Swal.fire({title:'Delete?', text:"This cannot be undone.", icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
    const { error } = await supabaseClient.from('withdrawal_requests').delete().eq('wr_id', id);
    if(error) Swal.fire('Error', 'Cannot delete. Record may be linked.', 'error');
    else { await refreshAll(); Swal.fire('Deleted', '', 'success'); }
}

async function updatePRStatus(id, newStatus, matCode, qty) {
    // Note: In multi-item PRs, receiving means receiving ALL items in this simple logic.
    try {
        const timestamp = new Date().toISOString();
        let updatePayload = { status: newStatus };

        // Auto Date Logic
        if(newStatus === 'Processing') updatePayload.date_processed = timestamp;
        if(newStatus === 'Received') updatePayload.date_received = timestamp;

        if(newStatus === 'Received') {
            const confirm = await Swal.fire({title: 'Confirm Receipt?', text: `Add items to inventory?`, icon: 'question', showCancelButton: true, confirmButtonColor: '#10b981'});
            if(!confirm.isConfirmed) return; 
            
            // Get items for this PR
            const pr = prCache.find(p => p.pr_id == id);
            for(let item of pr.pr_items) {
                const curr = invCache.find(i => i.material_code === item.material_code);
                if(curr) {
                    await supabaseClient.from('inventory').update({current_stock: curr.current_stock + item.quantity_requested}).eq('material_code', item.material_code);
                    await supabaseClient.from('stock_movements').insert({ material_code: item.material_code, change_amount: item.quantity_requested, reason: `PR Received: ${pr.pr_number}` });
                }
            }
        } else if (newStatus === 'Cancel') {
             if(!(await Swal.fire({title:'Cancel Request?', icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
        }

        await supabaseClient.from('purchase_requests').update(updatePayload).eq('pr_id', id);
        await refreshAll();
        Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 3000}).fire({icon: 'success', title: `Status: ${newStatus}`});
    } catch(err) { Swal.fire('Error', err.message, 'error'); await refreshAll(); }
}

async function processWR(id) {
    if(!(await Swal.fire({title:'Approve & Dispense?', icon:'warning', showCancelButton:true, confirmButtonColor: '#1e40af'})).isConfirmed) return;
    try {
        const wr = wrCache.find(w => w.wr_id == id);
        for(let item of wr.wr_items) {
            const curr = invCache.find(i => i.material_code === item.material_code);
            if(curr.current_stock < item.quantity_requested) throw new Error(`Insufficient stock for ${item.material_code}`);
            await supabaseClient.from('inventory').update({
                current_stock: curr.current_stock - item.quantity_requested,
                total_withdrawn: (curr.total_withdrawn || 0) + item.quantity_requested
            }).eq('material_code', item.material_code);
            await supabaseClient.from('stock_movements').insert({ material_code: item.material_code, change_amount: -item.quantity_requested, reason: `WR: ${wr.wr_number}` });
        }
        await supabaseClient.from('withdrawal_requests').update({status: 'APPROVED'}).eq('wr_id', id);
        await refreshAll();
        Swal.fire({icon:'success', title:'Approved', showConfirmButton:false, timer:1000});
    } catch(err) { Swal.fire('Error', err.message, 'error'); }
}

// --- DISPOSAL LOGIC ---
async function handleDisposal(e) {
    e.preventDefault();
    if(!(await Swal.fire({title:'Confirm Disposal?', text:'Record will be permanently logged.', icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
    
    $('#btn-disp-submit').prop('disabled', true);
    try {
        const wrId = $('#disp-wr-id').val();
        if(!wrId) throw new Error("Please select a Source WR");

        // Fetch WR details to duplicate items
        const selectedWR = wrCache.find(w => w.wr_id == wrId);
        
        // Create new Disposal Header (using Withdrawal Requests table but specific Dept)
        const { data } = await supabaseClient.from('withdrawal_requests').insert([{
            wr_number: 'DISP-'+Date.now().toString().slice(-8),
            requester_name: $('#disp-auth').val(),
            department: 'DISPOSAL', 
            status: 'APPROVED',
            remarks: `${$('#disp-type').val()} | ${$('#disp-dest').val()} | ${$('#disp-reason').val()}`
        }]).select();
        
        const newWrId = data[0].wr_id;

        // Copy items from source WR to Disposal Log
        for(let item of selectedWR.wr_items) {
             await supabaseClient.from('wr_items').insert([{ 
                wr_id: newWrId, 
                material_code: item.material_code, 
                quantity_requested: item.quantity_requested 
            }]);
             // Log movement (Qty 0 change because items were already withdrawn via source WR, this is just logging the fate)
             await supabaseClient.from('stock_movements').insert({ 
                material_code: item.material_code, 
                change_amount: 0, 
                reason: `Disposed: ${data[0].wr_number}` 
            });
        }

        e.target.reset();
        await refreshAll();
        Swal.fire({icon:'success', title: 'Disposal Logged', showConfirmButton: false, timer: 1000});
    } catch(err) { Swal.fire('Error', err.message, 'error'); } 
    finally { $('#btn-disp-submit').prop('disabled', false); }
}

// --- STANDARD UI HELPERS ---
function nav(id) {
    $('.nav-link').removeClass('active');
    $(`.nav-link[onclick="nav('${id}')"]`).addClass('active');
    $('#sidebar').addClass('-translate-x-full').removeClass('translate-x-0');
    $('.page-section').addClass('hidden');
    $(`#${id}`).removeClass('hidden');
    if(id === 'dashboard') setTimeout(() => Object.values(charts).forEach(c => c?.resize()), 50);
}

function openInventoryModal(mode, code) {
    $('#inv-mode').val(mode);
    $('#inv-modal-title').text(mode==='add'?'Add New Asset':'Edit Asset');
    $('#form-inventory')[0].reset();
    clearImage();
    toggleImgInput('upload');
    $('input[name="img-src-type"][value="upload"]').prop('checked', true);

    if(mode === 'edit') {
        const item = invCache.find(i => i.material_code === code);
        $('#i-code').val(item.material_code).prop('readonly', true);
        $('#i-desc').val(item.description);
        $('#i-cat').val(item.category);
        $('#i-uom').val(item.uom);
        $('#i-low').val(item.low_stock_threshold);
        $('#i-sds').val(item.sds_link || '');
        $('#i-remarks').val(item.remarks || '');
        $('#div-init-stock').hide();
        if(item.image_link) {
            $('#i-preview').attr('src', item.image_link);
            $('#preview-container').removeClass('hidden');
            $('#i-img-data').val(item.image_link);
            if(item.image_link.startsWith('http')) {
                $('input[name="img-src-type"][value="url"]').prop('checked', true);
                toggleImgInput('url');
                $('#i-url-input').val(item.image_link);
            }
        }
    } else {
        $('#i-code').prop('readonly', false).val('');
        $('#div-init-stock').show();
    }
    openModal('m-inventory');
}

function openStockAdjustModal(code) {
    const item = invCache.find(i => i.material_code === code);
    $('#adj-code').val(code);
    $('#adj-name').text(item.description);
    $('#adj-current').text(formatNum(item.current_stock));
    $('#adj-qty, #adj-reason').val('');
    openModal('m-stock-adjust');
}

async function submitAdjustment(e) {
    e.preventDefault();
    const code = $('#adj-code').val(), qty = parseInt($('#adj-qty').val());
    if(!qty) return;
    const item = invCache.find(i => i.material_code === code);
    await supabaseClient.from('inventory').update({current_stock: item.current_stock + qty}).eq('material_code', code);
    await supabaseClient.from('stock_movements').insert({material_code: code, change_amount: qty, reason: "Adj: "+$('#adj-reason').val()});
    closeModal('m-stock-adjust');
    await refreshAll();
    Swal.fire({icon:'success', title: 'Stock Updated', showConfirmButton: false, timer: 1000});
}

async function delItem(code) {
    if((await Swal.fire({title:'Archive?', text:'Item will be hidden.', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444'})).isConfirmed) {
        await supabaseClient.from('inventory').update({status:'ARCHIVED'}).eq('material_code', code);
        refreshAll();
    }
}

async function restoreItem(code) {
    await supabaseClient.from('inventory').update({status:'ACTIVE'}).eq('material_code', code);
    refreshAll();
}

function openModal(id) { 
    if(id === 'm-create-pr') {
        if(!$('#pr-id').val()) { $('#pr-form')[0].reset(); prCart = []; renderPrCart(); $('#pr-num').val('PR-'+Date.now().toString().slice(-6)); $('#pr-num').prop('readonly',false); $('#btn-save-pr').text('Submit Request'); }
    }
    if(id === 'm-create-wr') {
        if(!$('#wr-id').val()) { $('#wr-form')[0].reset(); wrCart = []; renderWrCart(); $('#wr-num').val('WR-'+Date.now().toString().slice(-6)); $('#wr-num').prop('readonly',false); $('#btn-submit-wr').text('Issue Stock'); }
    }
    $(`#${id}`).removeClass('hidden').css('display','flex').hide().fadeIn(150); 
}
function closeModal(id) { 
    $(`#${id}`).fadeOut(150, function(){ $(this).addClass('hidden'); }); 
    if(id==='m-create-pr') $('#pr-id').val('');
    if(id==='m-create-wr') $('#wr-id').val('');
}

// Master Data Helpers
async function addMaster(table, idVal, idName) {
    const v1 = $(`#${idVal}`).val().trim();
    const v2 = idName ? $(`#${idName}`).val().trim() : null;
    if(!v1) return Swal.fire('Error', 'Field cannot be empty', 'warning');
    try {
        const payload = table === 'uoms' ? {code: v1, name: v2} : {name: v1};
        const { error } = await supabaseClient.from(table).insert([payload]);
        if(error) throw error;
        $(`#${idVal}, #${idName ? idName : idVal}`).val('');
        await refreshAll();
    } catch(err) { Swal.fire('Error', err.message, 'error'); }
}
async function deleteMaster(table, id) {
    if(!(await Swal.fire({title:'Delete?', icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if(error) Swal.fire('Error', 'Record likely in use.', 'error');
    else await refreshAll();
}

// UI Toggles & Selects
function filterInventory() { renderInventoryTable(); }
function toggleArchivedView() { appSettings.showArchived = !appSettings.showArchived; $('#btn-show-archived').toggleClass('bg-royal-600 text-white'); refreshAll(); }
function updateItemSelects() {
    const opts = '<option value="">-- Select Material --</option>' + invCache.filter(x=>x.status!=='ARCHIVED').map(i => `<option value="${i.material_code}">${i.material_code} - ${i.description}</option>`).join('');
    $('#pr-mat, #wr-mat').html(opts);
}
function updateDisposalSelects() {
    const approvedWRs = wrCache.filter(w => w.status === 'APPROVED' && w.department !== 'DISPOSAL');
    const opts = '<option value="">-- Select WR --</option>' + approvedWRs.map(w => `<option value="${w.wr_id}">${w.wr_number} (${w.requester_name})</option>`).join('');
    $('#disp-wr-id').html(opts);
    $('#disp-details-view').text('No WR Selected');
}
function onDisposalWrChange(wrId) {
    if(!wrId) { $('#disp-details-view').text('No WR Selected'); return; }
    const wr = wrCache.find(w => w.wr_id == wrId);
    if(wr) {
        const itemCount = wr.wr_items ? wr.wr_items.length : 0;
        $('#disp-details-view').html(`<b>Requester:</b> ${wr.requester_name} | <b>Items to Dispose:</b> ${itemCount}`);
    }
}
function toggleImgInput(type) {
    if(type === 'upload') { $('#img-input-upload').removeClass('hidden'); $('#img-input-url').addClass('hidden'); } 
    else { $('#img-input-upload').addClass('hidden'); $('#img-input-url').removeClass('hidden'); }
}
function handleUrlInput(val) {
    if(val && val.trim().length > 0) { $('#i-preview').attr('src', val); $('#preview-container').removeClass('hidden'); $('#i-img-data').val(val); } 
    else { $('#preview-container').addClass('hidden'); }
}
async function handleImageFile(input) {
    if (input.files && input.files[0]) {
        try {
            const compressed = await compressImage(input.files[0]);
            $('#i-preview').attr('src', compressed);
            $('#preview-container').removeClass('hidden');
            $('#i-img-data').val(compressed); 
        } catch (e) { Swal.fire('Error', 'Image error', 'error'); }
    }
}
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 600; 
                let w = img.width, h = img.height;
                if(w > h) { if(w > MAX) { h *= MAX/w; w = MAX; } } else { if(h > MAX) { w *= MAX/h; h = MAX; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}
function clearImage() {
    $('#i-file').val(''); $('#i-url-input').val(''); $('#i-img-data').val('');
    $('#i-preview').attr('src', ''); $('#preview-container').addClass('hidden');
}
function switchTab(id) { 
    $('.tab-content').addClass('hidden'); 
    $(`#${id}`).removeClass('hidden');
    $('.active-tab').removeClass('active-tab'); 
    $(event.target).addClass('active-tab');
}
function openLightbox(src) { $('#lightbox-img').attr('src', src); openModal('m-lightbox'); }
function viewItemHistory(code) {
    const history = movementCache.filter(m => m.material_code === code).reverse();
    let html = '';
    if(!history.length) html = '<tr><td colspan="3" class="p-4 text-center text-slate-400">No records.</td></tr>';
    else {
        html = history.map(h => `
            <tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="p-3 text-slate-500 text-xs">${new Date(h.created_at).toLocaleDateString()}</td>
                <td class="p-3 font-medium text-slate-700">${escapeHTML(h.reason)}</td>
                <td class="p-3 text-right font-bold ${h.change_amount > 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${h.change_amount > 0 ? '+' : ''}${h.change_amount}
                </td>
            </tr>
        `).join('');
    }
    $('#tbl-item-history').html(html);
    openModal('m-item-history');
}
