// --- CONFIGURATION ---
const SB_URL = 'https://agggkqvbnotpborqcitx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZ2drcXZibm90cGJvcnFjaXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODYxNjgsImV4cCI6MjA4MTY2MjE2OH0.XJHmLfRRJHVhsrImqnRpdwt7eN4eiO1VGk6B68uG5oo';

// State
let supabaseClient;
let invCache = [], movementCache = [];
let masterData = { cats: [], uoms: [], depts: [] };
let charts = { cat: null, trend: null };
let appSettings = { showArchived: false, sortCol: 'created_at', sortAsc: false };

// Utilities
const escapeHTML = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
const formatNum = (num) => new Intl.NumberFormat('en-US').format(num);

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
    // Mobile Menu
    $('#mobile-menu-btn').click(() => $('#sidebar').toggleClass('-translate-x-full translate-x-0'));

    // ID Generators
    $('#pr-num').val('PR-' + Date.now().toString().slice(-6));
    $('#wr-num').val('WR-' + Date.now().toString().slice(-6));

    // --- Enhanced Drag & Drop Logic ---
    const dropZone = $('#drop-zone');
    const fileInput = $('#i-file');

    // Prevent default browser behavior for all drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.on(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Visual feedback
    dropZone.on('dragenter dragover', () => {
        dropZone.addClass('bg-blue-50 border-brand-400');
    });

    dropZone.on('dragleave drop', () => {
        dropZone.removeClass('bg-blue-50 border-brand-400');
    });

    // Handle File Drop
    dropZone.on('drop', (e) => {
        const dt = e.originalEvent.dataTransfer;
        const files = dt.files;
        
        if (files && files.length) {
            fileInput[0].files = files; // Sync file to input element
            handleImageFile(fileInput[0]); // Trigger processing
        }
    });

    // Handle Click to Browse
    dropZone.on('click', () => fileInput.click());
}

// --- DATA FETCHING ---
async function refreshAll() {
    const isFirstLoad = invCache.length === 0;
    if(isFirstLoad) $('#loader-overlay').fadeIn(200);
    
    try {
        await loadMasterData();
        const [inv, pr, wr, mov] = await Promise.all([
            getInventoryData(),
            getPRs(),
            getWRs(),
            getMovements()
        ]);
        
        renderInventoryTable();
        updateDashboard();
        updateItemSelects();
    } catch (e) {
        console.error(e);
        Swal.fire('Sync Error', 'Failed to load data. Check network connection.', 'error');
    } finally {
        $('#loader-overlay').fadeOut(300);
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
    
    const fill = (id, data, fn) => {
        const el = $(`#${id}`);
        const current = el.val();
        let html = id.includes('filter') ? '<option value="">All Categories</option>' : '';
        html += data.map(fn).join('');
        el.html(html);
        if(current) el.val(current);
    };
    
    fill('i-cat', masterData.cats, c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`);
    fill('filter-cat', masterData.cats, c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`);
    fill('i-uom', masterData.uoms, u => `<option value="${escapeHTML(u.code)}">${escapeHTML(u.name)} (${escapeHTML(u.code)})</option>`);
    fill('wr-dept', masterData.depts, d => `<option value="${escapeHTML(d.name)}">${escapeHTML(d.name)}</option>`);
}

function renderMasterList(data, listId, table, isUom = false) {
    const html = data.length ? data.map(item => `
        <li class="flex justify-between items-center py-3 px-2 hover:bg-slate-50 rounded transition">
            <span class="font-medium text-slate-700">${isUom ? `<b>${escapeHTML(item.code)}</b> - ${escapeHTML(item.name)}` : escapeHTML(item.name)}</span>
            <button class="text-slate-400 hover:text-red-500 transition" onclick="deleteMaster('${table}', ${item.id})"><i class="fas fa-trash-alt"></i></button>
        </li>
    `).join('') : '<li class="text-center py-4 text-slate-400 italic">No records found</li>';
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

    // Charts
    const catMap = {}; 
    active.forEach(i => { catMap[i.category||'Other'] = (catMap[i.category||'Other']||0) + i.current_stock; });

    if(charts.cat) charts.cat.destroy();
    const catCtx = document.getElementById('catChart');
    if(catCtx) {
        charts.cat = new Chart(catCtx, {
            type: 'doughnut',
            data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6', '#6366f1'] }] },
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
                    { label: 'In (PR)', data: Object.values(dateMap).map(x=>x.in), backgroundColor: '#10b981', borderRadius:4 },
                    { label: 'Out (WR/Disp)', data: Object.values(dateMap).map(x=>x.out), backgroundColor: '#3b82f6', borderRadius:4 }
                ] 
            },
            options: { maintainAspectRatio: false, scales: { x:{stacked:true, grid:{display:false}}, y:{stacked:true, grid:{borderDash:[4,4]}} }, plugins:{legend:{position:'top'}} }
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
        tb.html('<tr><td colspan="7" class="p-8 text-center text-slate-400 italic">No matching items found.</td></tr>');
        return;
    }

    filtered.forEach(i => {
        let status;
        if(i.status === 'ARCHIVED') status = '<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs font-bold">Archived</span>';
        else if(i.current_stock <= 0) status = '<span class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">Out of Stock</span>';
        else if(i.current_stock <= i.low_stock_threshold) status = '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-bold">Low Stock</span>';
        else status = '<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">Available</span>';

        const img = i.image_link ? `<img src="${i.image_link}" class="w-10 h-10 rounded object-cover cursor-pointer hover:scale-150 transition border border-slate-200 bg-white" onclick="openLightbox('${i.image_link}')">` : 
                                   `<div class="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-300"><i class="fas fa-image"></i></div>`;

        tb.append(`
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition group ${i.status==='ARCHIVED'?'opacity-60':''}">
                <td class="p-4">${img}</td>
                <td class="p-4">
                    <div class="font-bold text-brand-700 font-mono text-xs">${i.material_code}</div>
                    <div class="text-slate-700 font-medium">${escapeHTML(i.description)}</div>
                </td>
                <td class="p-4"><span class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">${escapeHTML(i.category)}</span></td>
                <td class="p-4">
                    <div class="flex items-center">
                        <span class="font-bold text-lg text-slate-700">${formatNum(i.current_stock)}</span>
                        <span class="text-xs text-slate-400 ml-1">${escapeHTML(i.uom)}</span>
                    </div>
                </td>
                <td class="p-4 text-center font-bold text-slate-600">${formatNum(i.total_withdrawn || 0)}</td>
                <td class="p-4 text-center">${status}</td>
                <td class="p-4 text-right">
                    <div class="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        ${i.status !== 'ARCHIVED' ? `
                        <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:text-blue-600 hover:border-blue-500 transition flex items-center justify-center" onclick="viewItemHistory('${i.material_code}')" title="History"><i class="fas fa-history"></i></button>
                        <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:text-brand-600 hover:border-brand-500 transition flex items-center justify-center" onclick="openStockAdjustModal('${i.material_code}')" title="Adjust"><i class="fas fa-sliders-h"></i></button>
                        <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:text-brand-600 hover:border-brand-500 transition flex items-center justify-center" onclick="openInventoryModal('edit', '${i.material_code}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:text-red-600 hover:border-red-500 transition flex items-center justify-center" onclick="delItem('${i.material_code}')" title="Archive"><i class="fas fa-trash-alt"></i></button>
                        ` : `
                        <button class="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded border border-emerald-200 hover:bg-emerald-100" onclick="restoreItem('${i.material_code}')">Restore</button>
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

// --- CRUD ACTIONS ---

async function saveInventory(e) {
    e.preventDefault();
    const btn = $('#btn-save-inv').prop('disabled', true).addClass('opacity-75');
    
    try {
        const mode = $('#inv-mode').val();
        const code = $('#i-code').val().trim().toUpperCase();
        // Uses the hidden field populated by handleImageFile or handleUrlInput
        const imgVal = $('#i-img-data').val();

        const payload = {
            material_code: code,
            description: $('#i-desc').val().trim(),
            category: $('#i-cat').val(),
            uom: $('#i-uom').val(),
            low_stock_threshold: Number($('#i-low').val()),
            image_link: imgVal // Compressed Base64 or URL
        };

        if(mode === 'add') {
            if(invCache.some(i => i.material_code === code)) throw new Error("SKU/Code already exists!");
            payload.current_stock = Number($('#i-stock').val());
            payload.initial_stock = payload.current_stock;
            payload.status = 'ACTIVE';
            const { error } = await supabaseClient.from('inventory').insert([payload]);
            if(error) throw error;
        } else {
            const { error } = await supabaseClient.from('inventory').update(payload).eq('material_code', code);
            if(error) throw error;
        }

        closeModal('m-inventory');
        await refreshAll();
        Swal.fire({icon: 'success', title: 'Saved successfully', showConfirmButton: false, timer: 1500});
        
    } catch(err) {
        console.error(err);
        Swal.fire('Error', err.message || 'Failed to save', 'error');
    } finally {
        btn.prop('disabled', false).removeClass('opacity-75');
    }
}

async function createPR(e) {
    e.preventDefault();
    const btn = $('#btn-save-pr').prop('disabled', true).addClass('opacity-75');
    
    try {
        const prNum = $('#pr-num').val();
        const { data, error } = await supabaseClient.from('purchase_requests').insert([
            { pr_number: prNum, requester_name: $('#pr-name').val(), status: 'PENDING' }
        ]).select();
        
        if(error) throw error;
        
        await supabaseClient.from('pr_items').insert([{ 
            pr_id: data[0].pr_id, 
            material_code: $('#pr-mat').val(), 
            quantity_requested: Number($('#pr-qty').val()),
            unit_price: Number($('#pr-price').val())
        }]);

        closeModal('m-create-pr');
        await refreshAll();
        Swal.fire('Success', 'Purchase Request Created', 'success');
        $('#pr-num').val('PR-'+Date.now().toString().slice(-6));

    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        btn.prop('disabled', false).removeClass('opacity-75');
    }
}

async function createWR(e) {
    e.preventDefault();
    const btn = $('#btn-submit-wr').prop('disabled', true).addClass('opacity-75');

    try {
        const mat = $('#wr-mat').val();
        const qty = Number($('#wr-qty').val());
        const item = invCache.find(i => i.material_code === mat);
        
        if(!item) throw new Error("Invalid Item Selection");
        if(item.current_stock < qty) throw new Error(`Insufficient stock. Only ${item.current_stock} available.`);

        const { data, error } = await supabaseClient.from('withdrawal_requests').insert([
            { wr_number: $('#wr-num').val(), requester_name: $('#wr-name').val(), department: $('#wr-dept').val(), status: 'PENDING' }
        ]).select();

        if(error) throw error;

        await supabaseClient.from('wr_items').insert([{
            wr_id: data[0].wr_id, material_code: mat, quantity_requested: qty
        }]);

        closeModal('m-create-wr');
        await refreshAll();
        Swal.fire('Success', 'Withdrawal Request Submitted', 'success');
        $('#wr-num').val('WR-'+Date.now().toString().slice(-6));

    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        btn.prop('disabled', false).removeClass('opacity-75');
    }
}

async function processPR(id) {
    const res = await Swal.fire({ title: 'Receive Items?', text: "This will add to your current inventory stock.", icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, Receive', confirmButtonColor: '#10b981' });
    if(!res.isConfirmed) return;

    $('#loader-overlay').show();
    try {
        const { data: items } = await supabaseClient.from('pr_items').select('*').eq('pr_id', id);
        for(let item of items) {
            const curr = invCache.find(i => i.material_code === item.material_code);
            if(curr) {
                await supabaseClient.from('inventory').update({current_stock: curr.current_stock + item.quantity_requested}).eq('material_code', item.material_code);
                await supabaseClient.from('stock_movements').insert({ material_code: item.material_code, change_amount: item.quantity_requested, reason: `PR Received: ${id}` });
            }
        }
        await supabaseClient.from('purchase_requests').update({status: 'COMPLETED'}).eq('pr_id', id);
        await refreshAll();
        Swal.fire('Received', 'Stock updated successfully', 'success');
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    } finally { $('#loader-overlay').hide(); }
}

async function processWR(id) {
    const res = await Swal.fire({ title: 'Approve Withdrawal?', text: "Stock will be deducted immediately.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Approve', confirmButtonColor: '#3b82f6' });
    if(!res.isConfirmed) return;

    $('#loader-overlay').show();
    try {
        const { data: items } = await supabaseClient.from('wr_items').select('*').eq('wr_id', id);
        for(let item of items) {
            const curr = invCache.find(i => i.material_code === item.material_code);
            if(curr.current_stock < item.quantity_requested) throw new Error(`Insufficient stock for ${item.material_code}`);
            
            await supabaseClient.from('inventory').update({
                current_stock: curr.current_stock - item.quantity_requested,
                total_withdrawn: (curr.total_withdrawn || 0) + item.quantity_requested
            }).eq('material_code', item.material_code);

            await supabaseClient.from('stock_movements').insert({ material_code: item.material_code, change_amount: -item.quantity_requested, reason: `WR Approved: ${id}` });
        }
        await supabaseClient.from('withdrawal_requests').update({status: 'APPROVED'}).eq('wr_id', id);
        await refreshAll();
        Swal.fire('Approved', 'Stock released to fleet', 'success');
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    } finally { $('#loader-overlay').hide(); }
}

async function handleDisposal(e) {
    e.preventDefault();
    const res = await Swal.fire({ title: 'Confirm Disposal', text: "This action cannot be undone. Stock will be reduced.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if(!res.isConfirmed) return;

    $('#btn-disp-submit').prop('disabled', true);
    try {
        const mat = $('#disp-mat').val();
        const qty = Number($('#disp-qty').val());
        const reason = $('#disp-reason').val();
        const curr = invCache.find(i => i.material_code === mat);
        
        if(curr.current_stock < qty) throw new Error('Insufficient stock for disposal');

        const { data } = await supabaseClient.from('withdrawal_requests').insert([{
            wr_number: 'DISP-'+Date.now(),
            requester_name: `${$('#disp-auth').val()} (Disposal)`,
            department: 'DISPOSAL',
            status: 'APPROVED'
        }]).select();

        await supabaseClient.from('wr_items').insert([{ wr_id: data[0].wr_id, material_code: mat, quantity_requested: qty }]);
        
        await supabaseClient.from('inventory').update({ current_stock: curr.current_stock - qty }).eq('material_code', mat);
        await supabaseClient.from('stock_movements').insert({ material_code: mat, change_amount: -qty, reason: `Disposal: ${reason}` });

        e.target.reset();
        await refreshAll();
        Swal.fire('Recorded', 'Disposal logged successfully', 'success');

    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    } finally { $('#btn-disp-submit').prop('disabled', false); }
}

// --- MASTER DATA ---
async function addMaster(table, idVal, idName) {
    const v1 = $(`#${idVal}`).val().trim();
    const v2 = idName ? $(`#${idName}`).val().trim() : null;
    if(!v1) return;
    
    try {
        const payload = table === 'uoms' ? {code: v1, name: v2} : {name: v1};
        const { error } = await supabaseClient.from(table).insert([payload]);
        if(error) throw error;
        
        $(`#${idVal}, #${idName ? idName : idVal}`).val('');
        loadMasterData();
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 3000});
        Toast.fire({icon: 'success', title: 'Added successfully'});
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    }
}

async function deleteMaster(table, id) {
    if(!(await Swal.fire({title:'Delete?', icon:'warning', showCancelButton:true})).isConfirmed) return;
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if(error) Swal.fire('Error', 'Record likely in use. Cannot delete.', 'error');
    else loadMasterData();
}

// --- NAVIGATION & HELPERS ---
function nav(id) {
    $('.nav-link').removeClass('active bg-slate-800 text-white').addClass('text-slate-400');
    $('.nav-link i').removeClass('text-brand-400');
    const btn = $(`.nav-link[onclick="nav('${id}')"]`);
    btn.addClass('active bg-slate-800 text-white').removeClass('text-slate-400');
    btn.find('i').addClass('text-brand-400');

    $('#sidebar').addClass('-translate-x-full').removeClass('translate-x-0');

    $('.page-section').fadeOut(150, function() {
        if(this.id === id) {
            $(this).fadeIn(200);
            if(id === 'dashboard') setTimeout(() => Object.values(charts).forEach(c => c?.resize()), 50);
        }
    });
}

async function getPRs() {
    const { data } = await supabaseClient.from('purchase_requests').select(`*, pr_items(*)`).order('created_at', {ascending:false}).limit(20);
    $('#tbl-pr').html((data||[]).map(pr => `
        <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
            <td class="p-4 font-mono font-bold text-brand-700">${pr.pr_number}</td>
            <td class="p-4">${escapeHTML(pr.requester_name)}</td>
            <td class="p-4 text-xs text-slate-500">${pr.pr_items.length} Items</td>
            <td class="p-4 text-xs">${new Date(pr.created_at).toLocaleDateString()}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${pr.status==='COMPLETED'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}">${pr.status}</span></td>
            <td class="p-4 text-right">${pr.status==='PENDING' ? `<button onclick="processPR(${pr.pr_id})" class="text-emerald-600 font-bold hover:underline">Receive</button>` : '<i class="fas fa-check text-emerald-500"></i>'}</td>
        </tr>
    `).join(''));
}

async function getWRs() {
    const { data } = await supabaseClient.from('withdrawal_requests').select(`*, wr_items(*)`).order('created_at', {ascending:false}).limit(20);
    const disposals = (data||[]).filter(w => w.wr_number.startsWith('DISP'));
    $('#tbl-disp-hist').html(disposals.map(d => `<tr><td class="p-4 font-mono font-bold">${d.wr_number}</td><td class="p-4 text-slate-600">${escapeHTML(d.requester_name)}</td><td class="p-4 text-xs text-slate-400">${new Date(d.created_at).toLocaleDateString()}</td></tr>`).join(''));

    $('#tbl-wr').html((data||[]).filter(w => !w.wr_number.startsWith('DISP')).map(wr => `
        <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
            <td class="p-4 font-mono font-bold text-brand-700">${wr.wr_number}</td>
            <td class="p-4">${escapeHTML(wr.requester_name)} <div class="text-xs text-slate-400">${escapeHTML(wr.department)}</div></td>
            <td class="p-4 text-xs text-slate-500">${wr.wr_items[0]?.material_code || '-'}</td>
            <td class="p-4 text-xs">${new Date(wr.created_at).toLocaleDateString()}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${wr.status==='APPROVED'?'bg-blue-100 text-brand-700':'bg-amber-100 text-amber-700'}">${wr.status}</span></td>
            <td class="p-4 text-right">${wr.status==='PENDING' ? `<button onclick="processWR(${wr.wr_id})" class="text-brand-600 font-bold hover:underline">Approve</button>` : '<i class="fas fa-check text-brand-500"></i>'}</td>
        </tr>
    `).join(''));
}

// Modal & Form Helpers
function openInventoryModal(mode, code) {
    $('#inv-mode').val(mode);
    $('#inv-modal-title').text(mode==='add'?'Add Part':'Edit Part');
    $('#form-inventory')[0].reset();
    clearImage();
    
    // Default UI State: Upload Tab
    toggleImgInput('upload');
    $('input[name="img-src-type"][value="upload"]').prop('checked', true);

    if(mode === 'edit') {
        const item = invCache.find(i => i.material_code === code);
        $('#i-code').val(item.material_code).prop('readonly', true).addClass('bg-slate-100');
        $('#i-desc').val(item.description);
        $('#i-cat').val(item.category);
        $('#i-uom').val(item.uom);
        $('#i-low').val(item.low_stock_threshold);
        $('#div-init-stock').hide();
        
        // Handle Existing Image
        if(item.image_link) {
            $('#i-preview').attr('src', item.image_link);
            $('#preview-container').removeClass('hidden');
            $('#i-img-data').val(item.image_link);
            
            // Check if it's a URL or Base64
            if(item.image_link.startsWith('http')) {
                // Switch to URL tab
                $('input[name="img-src-type"][value="url"]').prop('checked', true);
                toggleImgInput('url');
                $('#i-url-input').val(item.image_link);
            }
        }
    } else {
        $('#i-code').prop('readonly', false).removeClass('bg-slate-100');
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
    Swal.fire('Updated', 'Stock adjusted manually', 'success');
}

async function delItem(code) {
    if((await Swal.fire({title:'Archive Item?', text:'Hides item from active lists.', icon:'warning', showCancelButton:true})).isConfirmed) {
        await supabaseClient.from('inventory').update({status:'ARCHIVED'}).eq('material_code', code);
        refreshAll();
    }
}
async function restoreItem(code) {
    await supabaseClient.from('inventory').update({status:'ACTIVE'}).eq('material_code', code);
    refreshAll();
}

// Misc Helpers
function openModal(id) { $(`#${id}`).removeClass('hidden').css('display','flex').hide().fadeIn(200); setTimeout(()=> $(`#${id} > div`).removeClass('scale-95'), 10); }
function closeModal(id) { $(`#${id} > div`).addClass('scale-95'); $(`#${id}`).fadeOut(200, function(){ $(this).addClass('hidden'); }); }
function filterInventory() { renderInventoryTable(); }
function toggleArchivedView() { appSettings.showArchived = !appSettings.showArchived; $('#btn-show-archived').toggleClass('bg-slate-200'); refreshAll(); }
function updateItemSelects() {
    const opts = '<option value="">-- Select Item --</option>' + invCache.filter(x=>x.status!=='ARCHIVED').map(i => `<option value="${i.material_code}">${i.material_code} - ${i.description}</option>`).join('');
    $('#pr-mat, #wr-mat, #disp-mat').html(opts);
}

// --- IMAGE HANDLING V2 (ATTACHMENT LOGIC) ---

// Toggle between Upload Dropzone and URL Input
function toggleImgInput(type) {
    if(type === 'upload') {
        $('#img-input-upload').removeClass('hidden');
        $('#img-input-url').addClass('hidden');
    } else {
        $('#img-input-upload').addClass('hidden');
        $('#img-input-url').removeClass('hidden');
    }
}

// Handle pasting an image URL
function handleUrlInput(val) {
    if(val && val.trim().length > 0) {
        $('#i-preview').attr('src', val);
        $('#preview-container').removeClass('hidden');
        $('#i-img-data').val(val);
    } else {
        $('#preview-container').addClass('hidden');
        $('#i-img-data').val('');
    }
}

// Handle File Selection (Input or Drop)
async function handleImageFile(input) {
    if (input.files && input.files[0]) {
        try {
            // Client-side compression
            const compressedBase64 = await compressImage(input.files[0]);
            
            // Update Preview
            $('#i-preview').attr('src', compressedBase64);
            $('#preview-container').removeClass('hidden');
            
            // Populate hidden field for saving
            $('#i-img-data').val(compressedBase64); 
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Could not process image', 'error');
            clearImage();
        }
    }
}

// Client-side Compression Utility
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Resize to max 800px width
                const scaleSize = MAX_WIDTH / img.width;
                const finalWidth = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
                const finalHeight = (img.width > MAX_WIDTH) ? (img.height * scaleSize) : img.height;
                
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
                
                // Export as JPEG quality 0.7
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

function clearImage() {
    $('#i-file').val('');
    $('#i-url-input').val('');
    $('#i-img-data').val('');
    $('#i-preview').attr('src', '');
    $('#preview-container').addClass('hidden');
}
// --- END IMAGE HANDLING ---

function switchTab(id) { $('.tab-btn').removeClass('active border-brand-600 text-brand-600').addClass('border-transparent text-slate-500'); $(event.target).removeClass('border-transparent text-slate-500').addClass('active border-brand-600 text-brand-600'); $('.tab-content').addClass('hidden'); $(`#${id}`).removeClass('hidden'); }
function openLightbox(src) { $('#lightbox-img').attr('src', src); openModal('m-lightbox'); }

function checkStockAvailability(code) {
    const hint = $('#wr-stock-hint');
    if(!code) { hint.css('opacity', 0); return; }
    
    const item = invCache.find(i => i.material_code === code);
    if(item) {
        let cls = 'stock-badge-good';
        if(item.current_stock <= 0) cls = 'stock-badge-out';
        else if(item.current_stock <= item.low_stock_threshold) cls = 'stock-badge-low';
        
        hint.html(`<span class="${cls}">Available Stock: ${formatNum(item.current_stock)} ${item.uom}</span>`);
        hint.css('opacity', 1);
        $('#wr-qty').attr('max', item.current_stock);
    }
}

function viewItemHistory(code) {
    const history = movementCache.filter(m => m.material_code === code).reverse();
    const item = invCache.find(i => i.material_code === code);
    
    let html = '';
    if(history.length === 0) html = '<tr><td colspan="3" class="p-4 text-center text-slate-400">No movements recorded.</td></tr>';
    else {
        html = history.map(h => `
            <tr class="border-b border-slate-200">
                <td class="p-3 text-slate-500">${new Date(h.created_at).toLocaleDateString()}</td>
                <td class="p-3 text-slate-700 font-medium">${escapeHTML(h.reason)}</td>
                <td class="p-3 text-right font-bold ${h.change_amount > 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${h.change_amount > 0 ? '+' : ''}${h.change_amount}
                </td>
            </tr>
        `).join('');
    }
    
    $('#tbl-item-history').html(html);
    openModal('m-item-history');
}
