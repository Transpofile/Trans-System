// --- CONFIGURATION ---
const SB_URL = 'https://agggkqvbnotpborqcitx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZ2drcXZibm90cGJvcnFjaXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODYxNjgsImV4cCI6MjA4MTY2MjE2OH0.XJHmLfRRJHVhsrImqnRpdwt7eN4eiO1VGk6B68uG5oo';

// State
let supabaseClient;
let invCache = [], movementCache = [], wrCache = [], prCache = [];
let masterData = { cats: [], uoms: [], depts: [] };
let charts = { cat: null, trend: null };
let appSettings = { showArchived: false, sortCol: 'created_at', sortAsc: false };

// Utilities
const escapeHTML = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
const formatNum = (num) => new Intl.NumberFormat('en-US').format(num);
const formatMoney = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

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
    // Generate suggested PR/WR numbers but allow editing
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
        
        const img = i.image_link ? `<img src="${i.image_link}" class="w-10 h-10 rounded border border-slate-200 object-cover cursor-pointer hover:scale-110 transition" onclick="openLightbox('${i.image_link}')">` : 
                                   `<div class="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-300"><i class="fas fa-image"></i></div>`;
        
        const sdsBtn = i.sds_link ? `<a href="${i.sds_link}" target="_blank" class="text-royal-600 hover:text-royal-800"><i class="fas fa-file-pdf fa-lg"></i></a>` : '<span class="text-slate-300">-</span>';
        
        tb.append(`
            <tr class="transition ${i.status==='ARCHIVED'?'opacity-50 bg-slate-50':''}">
                <td class="p-3">${img}</td>
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

// --- CRUD ACTIONS & TRANSACTIONS ---

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

// -- PR FUNCTIONS --
async function createPR(e) {
    e.preventDefault();
    const btn = $('#btn-save-pr').prop('disabled', true);
    const prId = $('#pr-id').val();
    
    try {
        const payloadHeader = { 
            pr_number: $('#pr-num').val().trim(), 
            requester_name: $('#pr-name').val(), 
            remarks: $('#pr-remarks').val().trim()
            // Status remains as is or Pending for new
        };

        let newPrId = prId;

        if(!prId) {
            // INSERT
            payloadHeader.status = 'Pending';
            const { data, error } = await supabaseClient.from('purchase_requests').insert([payloadHeader]).select();
            if(error) throw error;
            newPrId = data[0].pr_id;

            // INSERT ITEM
            await supabaseClient.from('pr_items').insert([{ 
                pr_id: newPrId, 
                material_code: $('#pr-mat').val(), 
                quantity_requested: Number($('#pr-qty').val()),
                unit_price: Number($('#pr-price').val())
            }]);
        } else {
            // UPDATE HEADER
            const { error } = await supabaseClient.from('purchase_requests').update(payloadHeader).eq('pr_id', prId);
            if(error) throw error;

            // UPDATE ITEM (Simplified: Delete old items and insert new for this single-item form logic)
            // Or better: update the item associated with this PR. Since we show 1 item per row, let's update that specific item.
            // For now, assuming 1 item per PR for simplicity of this specific UI form:
            const { error: itemErr } = await supabaseClient.from('pr_items').delete().eq('pr_id', prId);
            if(!itemErr) {
                 await supabaseClient.from('pr_items').insert([{ 
                    pr_id: prId, 
                    material_code: $('#pr-mat').val(), 
                    quantity_requested: Number($('#pr-qty').val()),
                    unit_price: Number($('#pr-price').val())
                }]);
            }
        }

        closeModal('m-create-pr');
        await refreshAll();
        Swal.fire({icon: 'success', title: prId ? 'Updated' : 'Created', confirmButtonColor: '#1e40af'});
        
    } catch(err) { Swal.fire('Error', err.message, 'error'); } 
    finally { btn.prop('disabled', false); }
}

async function viewPR(id) {
    const pr = prCache.find(p => p.pr_id == id);
    if(!pr) return;
    openModal('m-create-pr');
    $('#pr-id').val(pr.pr_id);
    $('#pr-modal-title').text('View Purchase Request');
    $('#pr-num').val(pr.pr_number).prop('readonly', true);
    $('#pr-name').val(pr.requester_name).prop('readonly', true);
    $('#pr-mat').val(pr.pr_items[0]?.material_code).prop('disabled', true);
    $('#pr-qty').val(pr.pr_items[0]?.quantity_requested).prop('readonly', true);
    $('#pr-price').val(pr.pr_items[0]?.unit_price).prop('readonly', true);
    $('#pr-remarks').val(pr.remarks).prop('readonly', true);
    $('#btn-save-pr').addClass('hidden');
}

async function editPR(id) {
    const pr = prCache.find(p => p.pr_id == id);
    if(!pr) return;
    openModal('m-create-pr');
    $('#pr-id').val(pr.pr_id);
    $('#pr-modal-title').text('Edit Purchase Request');
    $('#pr-num').val(pr.pr_number).prop('readonly', true); // Keep num static
    $('#pr-name').val(pr.requester_name).prop('readonly', false);
    $('#pr-mat').val(pr.pr_items[0]?.material_code).prop('disabled', false);
    $('#pr-qty').val(pr.pr_items[0]?.quantity_requested).prop('readonly', false);
    $('#pr-price').val(pr.pr_items[0]?.unit_price).prop('readonly', false);
    $('#pr-remarks').val(pr.remarks).prop('readonly', false);
    $('#btn-save-pr').removeClass('hidden').text('Update Request');
}

async function deletePR(id) {
    if(!(await Swal.fire({title:'Delete Request?', text:"This cannot be undone.", icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
    const { error } = await supabaseClient.from('purchase_requests').delete().eq('pr_id', id);
    if(error) Swal.fire('Error', 'Cannot delete. Record may be linked.', 'error');
    else { await refreshAll(); Swal.fire('Deleted', '', 'success'); }
}

async function updatePRStatus(id, newStatus, matCode, qty) {
    try {
        if(newStatus === 'Received') {
            const confirm = await Swal.fire({title: 'Confirm Receipt?', text: `Add ${qty} units to inventory?`, icon: 'question', showCancelButton: true, confirmButtonColor: '#10b981'});
            if(!confirm.isConfirmed) return; 
            const curr = invCache.find(i => i.material_code === matCode);
            if(curr) {
                await supabaseClient.from('inventory').update({current_stock: curr.current_stock + qty}).eq('material_code', matCode);
                await supabaseClient.from('stock_movements').insert({ material_code: matCode, change_amount: qty, reason: `PR Received: ${id}` });
            }
        } else if (newStatus === 'Cancel') {
             if(!(await Swal.fire({title:'Cancel Request?', icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
        }
        await supabaseClient.from('purchase_requests').update({status: newStatus}).eq('pr_id', id);
        await refreshAll();
        Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 3000}).fire({icon: 'success', title: `Status: ${newStatus}`});
    } catch(err) { Swal.fire('Error', err.message, 'error'); await refreshAll(); }
}

// -- WR FUNCTIONS --
async function createWR(e) {
    e.preventDefault();
    const btn = $('#btn-submit-wr').prop('disabled', true);
    const wrId = $('#wr-id').val();
    
    try {
        const mat = $('#wr-mat').val();
        const qty = Number($('#wr-qty').val());
        
        // Stock Check (Only if new or if qty changed, but for simplicity check always if Pending)
        const item = invCache.find(i => i.material_code === mat);
        if(!item) throw new Error("Invalid Selection");
        if(!wrId && item.current_stock < qty) throw new Error(`Only ${item.current_stock} available.`);

        const payload = { 
            wr_number: $('#wr-num').val(), 
            requester_name: $('#wr-name').val(), 
            department: $('#wr-dept').val(),
            remarks: $('#wr-remarks').val() // Assuming a remarks column or we fit it in
        };

        if(!wrId) {
            // INSERT
            payload.status = 'PENDING';
            const { data, error } = await supabaseClient.from('withdrawal_requests').insert([payload]).select();
            if(error) throw error;
            await supabaseClient.from('wr_items').insert([{ wr_id: data[0].wr_id, material_code: mat, quantity_requested: qty }]);
        } else {
            // UPDATE
            const { error } = await supabaseClient.from('withdrawal_requests').update(payload).eq('wr_id', wrId);
            if(error) throw error;
            // Update items similarly to PR
            const { error: itemErr } = await supabaseClient.from('wr_items').delete().eq('wr_id', wrId);
            if(!itemErr) {
                 await supabaseClient.from('wr_items').insert([{ wr_id: wrId, material_code: mat, quantity_requested: qty }]);
            }
        }

        closeModal('m-create-wr');
        await refreshAll();
        Swal.fire({icon: 'success', title: 'Saved', confirmButtonColor: '#1e40af'});
    } catch(err) { Swal.fire('Error', err.message, 'error'); } 
    finally { btn.prop('disabled', false); }
}

async function viewWR(id) {
    const wr = wrCache.find(w => w.wr_id == id);
    if(!wr) return;
    openModal('m-create-wr');
    $('#wr-id').val(wr.wr_id);
    $('#wr-modal-title').text('View Withdrawal Request');
    $('#wr-num').val(wr.wr_number).prop('readonly', true);
    $('#wr-name').val(wr.requester_name).prop('readonly', true);
    $('#wr-dept').val(wr.department).prop('disabled', true);
    $('#wr-mat').val(wr.wr_items[0]?.material_code).prop('disabled', true);
    $('#wr-qty').val(wr.wr_items[0]?.quantity_requested).prop('readonly', true);
    $('#wr-remarks').val(wr.remarks || '').prop('readonly', true);
    $('#btn-submit-wr').addClass('hidden');
    $('#wr-stock-hint').text('');
}

async function editWR(id) {
    const wr = wrCache.find(w => w.wr_id == id);
    if(!wr) return;
    openModal('m-create-wr');
    $('#wr-id').val(wr.wr_id);
    $('#wr-modal-title').text('Edit Withdrawal Request');
    $('#wr-num').val(wr.wr_number).prop('readonly', true);
    $('#wr-name').val(wr.requester_name).prop('readonly', false);
    $('#wr-dept').val(wr.department).prop('disabled', false);
    $('#wr-mat').val(wr.wr_items[0]?.material_code).prop('disabled', false);
    $('#wr-qty').val(wr.wr_items[0]?.quantity_requested).prop('readonly', false);
    $('#wr-remarks').val(wr.remarks || '').prop('readonly', false);
    $('#btn-submit-wr').removeClass('hidden').text('Update Withdrawal');
    checkStockAvailability(wr.wr_items[0]?.material_code);
}

async function deleteWR(id) {
    if(!(await Swal.fire({title:'Delete Record?', text:"This cannot be undone.", icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
    const { error } = await supabaseClient.from('withdrawal_requests').delete().eq('wr_id', id);
    if(error) Swal.fire('Error', 'Cannot delete. Record may be linked.', 'error');
    else { await refreshAll(); Swal.fire('Deleted', '', 'success'); }
}

async function processWR(id) {
    if(!(await Swal.fire({title:'Approve & Dispense?', icon:'warning', showCancelButton:true, confirmButtonColor: '#1e40af'})).isConfirmed) return;
    try {
        const { data: items } = await supabaseClient.from('wr_items').select('*').eq('wr_id', id);
        for(let item of items) {
            const curr = invCache.find(i => i.material_code === item.material_code);
            if(curr.current_stock < item.quantity_requested) throw new Error(`Insufficient stock for ${item.material_code}`);
            await supabaseClient.from('inventory').update({
                current_stock: curr.current_stock - item.quantity_requested,
                total_withdrawn: (curr.total_withdrawn || 0) + item.quantity_requested
            }).eq('material_code', item.material_code);
            await supabaseClient.from('stock_movements').insert({ material_code: item.material_code, change_amount: -item.quantity_requested, reason: `WR: ${id}` });
        }
        await supabaseClient.from('withdrawal_requests').update({status: 'APPROVED'}).eq('wr_id', id);
        await refreshAll();
        Swal.fire({icon:'success', title:'Approved', showConfirmButton:false, timer:1000});
    } catch(err) { Swal.fire('Error', err.message, 'error'); }
}

// -- DISPOSAL FUNCTIONS --
async function handleDisposal(e) {
    e.preventDefault();
    if(!(await Swal.fire({title:'Confirm Disposal?', text:'Record will be permanently logged.', icon:'warning', showCancelButton:true, confirmButtonColor: '#ef4444'})).isConfirmed) return;
    
    $('#btn-disp-submit').prop('disabled', true);
    try {
        const wrId = $('#disp-wr-id').val();
        const selectedWR = wrCache.find(w => w.wr_id == wrId);
        
        // Manual entry if no WR selected is not implemented here based on UI, assuming WR selection required.
        // Actually creating a Log entry.
        const mat = selectedWR ? selectedWR.wr_items[0].material_code : ''; 
        const qty = selectedWR ? selectedWR.wr_items[0].quantity_requested : 0;

        const { data } = await supabaseClient.from('withdrawal_requests').insert([{
            wr_number: 'DISP-'+Date.now().toString().slice(-8),
            requester_name: $('#disp-auth').val(), // Auth person
            department: 'DISPOSAL', 
            status: 'APPROVED',
            remarks: $('#disp-reason').val() // Using Remarks for Reason
        }]).select();

        await supabaseClient.from('wr_items').insert([{ 
            wr_id: data[0].wr_id, 
            material_code: mat, 
            quantity_requested: qty 
        }]);

        await supabaseClient.from('stock_movements').insert({ 
            material_code: mat, 
            change_amount: 0, 
            reason: `Disposal Log: ${$('#disp-reason').val()}` 
        });

        e.target.reset();
        await refreshAll();
        Swal.fire({icon:'success', title: 'Disposal Logged', showConfirmButton: false, timer: 1000});
    } catch(err) { Swal.fire('Error', err.message, 'error'); } 
    finally { $('#btn-disp-submit').prop('disabled', false); }
}

// --- TABLE RENDERING ---

async function getPRs() {
    const { data } = await supabaseClient.from('purchase_requests').select(`*, pr_items(*)`).order('created_at', {ascending:false}).limit(50);
    prCache = data || [];
    let rowsHtml = '';

    if(!prCache.length) rowsHtml = '<tr><td colspan="10" class="p-4 text-center text-slate-400">No records found.</td></tr>';
    else {
        prCache.forEach(pr => {
            if (pr.pr_items && pr.pr_items.length > 0) {
                pr.pr_items.forEach(item => {
                    const invItem = invCache.find(i => i.material_code === item.material_code) || {};
                    const totalVal = (item.quantity_requested || 0) * (item.unit_price || 0);
                    
                    let badgeClass = 'bg-slate-100 text-slate-700'; 
                    if(pr.status === 'Processing') badgeClass = 'bg-blue-100 text-blue-700';
                    if(pr.status === 'For Withdrawal') badgeClass = 'bg-purple-100 text-purple-700';
                    if(pr.status === 'Withdrawn') badgeClass = 'bg-orange-100 text-orange-700';
                    if(pr.status === 'Received') badgeClass = 'bg-emerald-100 text-emerald-700';
                    if(pr.status === 'Cancel') badgeClass = 'bg-red-100 text-red-700';

                    const actionStatus = `
                        <select onchange="updatePRStatus(${pr.pr_id}, this.value, '${item.material_code}', ${item.quantity_requested})" class="w-24 text-xs border border-slate-300 rounded p-1 bg-white focus:outline-none mb-1">
                            <option value="Pending" ${pr.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Processing" ${pr.status === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="For Withdrawal" ${pr.status === 'For Withdrawal' ? 'selected' : ''}>For Withdrawal</option>
                            <option value="Withdrawn" ${pr.status === 'Withdrawn' ? 'selected' : ''}>Withdrawn</option>
                            <option value="Received" ${pr.status === 'Received' ? 'selected' : ''}>Received</option>
                            <option value="Cancel" ${pr.status === 'Cancel' ? 'selected' : ''}>Cancel</option>
                        </select>
                    `;

                    rowsHtml += `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td class="p-3 font-mono font-bold text-royal-700 text-xs">${escapeHTML(pr.pr_number)}</td>
                        <td class="p-3 font-mono text-xs font-bold">${escapeHTML(item.material_code)}</td>
                        <td class="p-3 text-xs max-w-[200px] truncate" title="${escapeHTML(invItem.description || '')}">${escapeHTML(invItem.description || '-')}</td>
                        <td class="p-3 text-center font-bold">${formatNum(item.quantity_requested)}</td>
                        <td class="p-3 text-xs text-slate-500">${escapeHTML(invItem.uom || '-')}</td>
                        <td class="p-3 text-xs"><span class="bg-slate-100 px-2 py-0.5 rounded border">${escapeHTML(invItem.category || '-')}</span></td>
                        <td class="p-3 text-right font-mono text-xs text-slate-600">${formatMoney(totalVal)}</td>
                        <td class="p-3 text-xs italic text-slate-400 max-w-[150px] truncate">${escapeHTML(pr.remarks || '-')}</td>
                        <td class="p-3 text-center">
                           <span class="block px-2 py-1 rounded text-[10px] uppercase font-bold ${badgeClass} mb-1">${pr.status}</span>
                           ${['Received','Cancel'].includes(pr.status) ? '' : actionStatus}
                        </td>
                        <td class="p-3 text-right">
                             <div class="flex justify-end gap-1">
                                <button onclick="viewPR(${pr.pr_id})" class="text-blue-500 hover:text-blue-700 p-1" title="View"><i class="fas fa-eye"></i></button>
                                <button onclick="editPR(${pr.pr_id})" class="text-amber-500 hover:text-amber-700 p-1" title="Edit" ${pr.status!=='Pending'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-edit"></i></button>
                                <button onclick="deletePR(${pr.pr_id})" class="text-red-500 hover:text-red-700 p-1" title="Delete" ${pr.status!=='Pending'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-trash-alt"></i></button>
                            </div>
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
    
    const valid = (wrCache).filter(w => w.department !== 'DISPOSAL' && !w.wr_number.startsWith('DISP'));
    const disps = (wrCache).filter(w => w.department === 'DISPOSAL' || w.wr_number.startsWith('DISP'));

    // WR Table
    // Columns: WR No, Mat Code, Description, Qty, Recipient, Date, Status, Remarks, Action
    $('#tbl-wr').html(valid.map(wr => {
        const item = wr.wr_items[0] || {};
        const inv = invCache.find(i => i.material_code === item.material_code) || {};
        const approveBtn = wr.status === 'PENDING' 
            ? `<button onclick="processWR(${wr.wr_id})" class="text-xs font-bold text-white bg-royal-600 hover:bg-royal-700 px-2 py-1 rounded shadow mb-1">Approve</button>` 
            : '';

        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="p-3 font-mono font-bold text-royal-700 text-xs">${wr.wr_number}</td>
            <td class="p-3 font-mono text-xs">${escapeHTML(item.material_code || '-')}</td>
            <td class="p-3 text-xs max-w-[150px] truncate" title="${escapeHTML(inv.description)}">${escapeHTML(inv.description || '-')}</td>
            <td class="p-3 text-center font-bold">${item.quantity_requested || 0}</td>
            <td class="p-3 text-xs">${escapeHTML(wr.requester_name)}</td>
            <td class="p-3 text-xs text-slate-400">${new Date(wr.created_at).toLocaleDateString()}</td>
            <td class="p-3 text-center">
                <span class="px-2 py-1 rounded text-[10px] uppercase font-bold ${wr.status==='APPROVED'?'bg-royal-100 text-royal-700':'bg-amber-100 text-amber-700'}">${wr.status}</span>
                <div class="mt-1">${approveBtn}</div>
            </td>
            <td class="p-3 text-xs italic text-slate-400 max-w-[100px] truncate">${escapeHTML(wr.remarks || '-')}</td>
            <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                    <button onclick="viewWR(${wr.wr_id})" class="text-blue-500 hover:text-blue-700 p-1" title="View"><i class="fas fa-eye"></i></button>
                    <button onclick="editWR(${wr.wr_id})" class="text-amber-500 hover:text-amber-700 p-1" title="Edit" ${wr.status!=='PENDING'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-edit"></i></button>
                    <button onclick="deleteWR(${wr.wr_id})" class="text-red-500 hover:text-red-700 p-1" title="Delete" ${wr.status!=='PENDING'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        </tr>
    `}).join(''));

    // Disposal Table
    // Columns: Ref, Mat Code, Description, Qty, Date, Status, Remarks
    $('#tbl-disp-hist').html(disps.map(d => {
        const item = d.wr_items[0] || {};
        const inv = invCache.find(i => i.material_code === item.material_code) || {};
        return `
        <tr class="border-b border-slate-100">
            <td class="p-3 font-mono text-xs text-red-600">${d.wr_number}</td>
            <td class="p-3 text-xs font-mono">${escapeHTML(item.material_code || '-')}</td>
            <td class="p-3 text-xs truncate max-w-[150px]">${escapeHTML(inv.description || '-')}</td>
            <td class="p-3 text-center font-bold">${item.quantity_requested || 0}</td>
            <td class="p-3 text-xs text-slate-400">${new Date(d.created_at).toLocaleDateString()}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-[10px] uppercase font-bold bg-red-100 text-red-700">LOGGED</span></td>
            <td class="p-3 text-xs italic text-slate-500">${escapeHTML(d.remarks || '-')}</td>
        </tr>
    `}).join(''));
}

// --- MASTER DATA & UI HELPERS ---
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

// Modal Helpers
function openModal(id) { 
    // Reset inputs if opening a "create" modal from scratch
    if(id === 'm-create-pr' && !$('#pr-id').val()) {
        $('#pr-form')[0]?.reset(); // if using form id
        // Reset manual
    }
    $(`#${id}`).removeClass('hidden').css('display','flex').hide().fadeIn(150); 
}
function closeModal(id) { 
    $(`#${id}`).fadeOut(150, function(){ $(this).addClass('hidden'); }); 
    // Reset specific forms on close to avoid data leak to next open
    if(id==='m-create-pr') { $('#pr-id').val(''); $('#pr-num').prop('readonly',false); $('#btn-save-pr').removeClass('hidden').text('Submit Request'); $('#pr-form')[0].reset(); $('#pr-num').val('PR-'+Date.now().toString().slice(-6)); }
    if(id==='m-create-wr') { $('#wr-id').val(''); $('#wr-num').prop('readonly',false); $('#btn-submit-wr').removeClass('hidden').text('Issue Stock'); $('#wr-form')[0].reset(); $('#wr-num').val('WR-'+Date.now().toString().slice(-6)); }
}

function filterInventory() { renderInventoryTable(); }
function toggleArchivedView() { appSettings.showArchived = !appSettings.showArchived; $('#btn-show-archived').toggleClass('bg-royal-600 text-white'); refreshAll(); }
function updateItemSelects() {
    const opts = '<option value=""></option>' + invCache.filter(x=>x.status!=='ARCHIVED').map(i => `<option value="${i.material_code}">${i.material_code} - ${i.description}</option>`).join('');
    $('#pr-mat, #wr-mat').html(opts);
}

function updateDisposalSelects() {
    const approvedWRs = wrCache.filter(w => w.status === 'APPROVED' && w.department !== 'DISPOSAL');
    const opts = '<option value="">-- Select WR --</option>' + approvedWRs.map(w => `<option value="${w.wr_id}">${w.wr_number}</option>`).join('');
    $('#disp-wr-id').html(opts);
    $('#disp-recipient').val('');
    $('#disp-item-details').val('');
}

function onDisposalWrChange(wrId) {
    if(!wrId) { $('#disp-recipient').val(''); $('#disp-item-details').val(''); return; }
    const wr = wrCache.find(w => w.wr_id == wrId);
    if(wr) {
        $('#disp-recipient').val(wr.requester_name);
        const item = wr.wr_items[0]; 
        if(item) { $('#disp-item-details').val(`${item.material_code} (Qty: ${item.quantity_requested})`); }
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
