/**
 * TRANS-SYSTEM PRO | EXTENSION MODULE
 * Features: Advanced CSS Injection, Master Data Logic, PR Logic,
 * Google Drive Image Rendering, and Item Disposal System.
 */

document.addEventListener("DOMContentLoaded", () => {
    injectAdvancedStyles();
    // Re-bind global functions to ensure extension logic takes precedence
    window.renderInventory = extensionRenderInventory;
    window.viewItemDetails = extensionViewItemDetails;
    window.renderPRs = extensionRenderPRs;
    window.addMasterItem = extensionAddMasterItem;
    window.deleteMasterItem = extensionDeleteMasterItem;
    window.renderMasterLists = extensionRenderMasterLists;
    
    // Initialize specific views if active
    if (!window.master) window.master = { categories: [], units: [], departments: [] };
});

/* =========================================
   1. ADVANCED CSS3 INJECTION
   ========================================= */
function injectAdvancedStyles() {
    const css = `
        /* --- Extension Glassmorphism & Animations --- */
        .ext-glass {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .dark .ext-glass {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* --- Master Data Tags --- */
        .master-tag {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0.75rem;
            margin-bottom: 0.5rem;
            background: white;
            border-radius: 8px;
            border-left: 3px solid #6366f1;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .dark .master-tag {
            background: #1e293b;
            border-color: #818cf8;
            color: #e2e8f0;
        }
        .master-tag:hover {
            transform: translateX(3px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .delete-icon {
            opacity: 0;
            color: #ef4444;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .master-tag:hover .delete-icon { opacity: 1; }

        /* --- Image Preview --- */
        .img-preview-container {
            width: 100%;
            height: 200px;
            background-color: #f1f5f9;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
            border: 2px dashed #cbd5e1;
        }
        .dark .img-preview-container {
            background-color: #0f172a;
            border-color: #334155;
        }
        .img-preview-content {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            transition: transform 0.3s;
        }
        .img-preview-content:hover { transform: scale(1.05); }

        /* --- Disposal Modal specific --- */
        .disposal-warning {
            background: #fef2f2;
            color: #991b1b;
            padding: 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            border: 1px solid #fecaca;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .dark .disposal-warning {
            background: #450a0a;
            color: #fca5a5;
            border-color: #7f1d1d;
        }

        /* --- Animations --- */
        @keyframes slideInUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slideInUp 0.3s ease-out forwards; }
    `;
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
    
    // Inject Disposal Modal HTML if not present
    if (!document.getElementById('disposal-modal')) {
        const disposalModal = `
        <div id="disposal-modal" class="modal">
            <div class="glass-panel modal-content bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative mx-4">
                <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2" onclick="closeModal('disposal-modal')"><i class="fas fa-times text-xl"></i></button>
                <h2 class="text-xl font-bold dark:text-white mb-2 text-red-600"><i class="fas fa-trash-alt mr-2"></i>Dispose Item</h2>
                <div class="disposal-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>This action will permanently remove stock and cannot be undone.</span>
                </div>
                <form id="form-disposal" class="space-y-4">
                    <input type="hidden" id="dispose-id">
                    <input type="hidden" id="dispose-name">
                    <div>
                        <label class="text-xs font-bold uppercase text-slate-500 mb-1">Quantity to Dispose</label>
                        <input type="number" id="dispose-qty" required min="1" class="w-full border dark:border-slate-600 rounded-lg p-3 text-sm dark:bg-slate-700 dark:text-white">
                    </div>
                    <div>
                        <label class="text-xs font-bold uppercase text-slate-500 mb-1">Reason for Disposal</label>
                        <select id="dispose-reason" class="w-full border dark:border-slate-600 rounded-lg p-3 text-sm dark:bg-slate-700 dark:text-white">
                            <option value="Damaged">Damaged / Broken</option>
                            <option value="Expired">Expired</option>
                            <option value="Obsolete">Obsolete</option>
                            <option value="Lost">Lost / Missing</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold uppercase text-slate-500 mb-1">Attachment Evidence (URL)</label>
                        <input type="url" id="dispose-link" placeholder="Google Drive / Image Link" class="w-full border dark:border-slate-600 rounded-lg p-3 text-sm dark:bg-slate-700 dark:text-white">
                    </div>
                    <button type="submit" class="w-full bg-red-600 text-white py-3 rounded-xl font-bold mt-2 shadow-lg hover:bg-red-700 transition">Confirm Disposal</button>
                </form>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', disposalModal);
        
        // Bind Disposal Submit
        document.getElementById('form-disposal').addEventListener('submit', extensionSubmitDisposal);
    }
}

/* =========================================
   2. GOOGLE DRIVE LINK CONVERTER
   ========================================= */
function convertToDirectLink(url) {
    if (!url) return null;
    // Regex for Google Drive ID
    const driveRegex = /\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);
    
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    // If it's already a direct image link or another host, return as is
    return url;
}

/* =========================================
   3. INVENTORY OVERRIDE (Adds Disposal & Image Logic)
   ========================================= */
async function extensionRenderInventory() {
    const items = await db('inventory', 'get');
    const term = document.getElementById('inv-search').value.toLowerCase();
    const tb = document.getElementById('inventory-body'); 
    tb.innerHTML = '';
    
    // Filter Logic using global activeInvTab
    let filtered = items.filter(i => i.name.toLowerCase().includes(term) || i.code.toLowerCase().includes(term));
    
    if (typeof activeInvTab !== 'undefined') {
        if(activeInvTab === 'low') filtered = filtered.filter(i => i.stock <= 5);
        else if(activeInvTab === 'high') filtered = filtered.filter(i => i.stock > 5);
        else if(activeInvTab !== 'all') filtered = filtered.filter(i => i.category === activeInvTab);
    }

    // Chart Update Logic
    const chartCont = document.getElementById('category-trends-container');
    if (chartCont) {
        const isCategoryTab = activeInvTab !== 'all' && activeInvTab !== 'low' && activeInvTab !== 'high';
        if(isCategoryTab) {
            chartCont.classList.remove('hidden');
            document.getElementById('trends-title').innerText = `${activeInvTab} Stock Trends`;
            if (typeof renderCategoryChart === 'function') renderCategoryChart(filtered);
        } else {
            chartCont.classList.add('hidden');
        }
    }

    if(filtered.length === 0) { 
        document.getElementById('inv-empty').classList.remove('hidden'); 
        return; 
    }
    document.getElementById('inv-empty').classList.add('hidden');

    filtered.forEach(i => {
        const isLow = i.stock <= 5;
        // Enhanced Row with Disposal Button
        const row = `
        <tr class="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition animate-slide-up">
            <td class="px-4 py-3" data-label="Details">
                <div class="font-bold dark:text-white text-base">${i.name}</div>
                <div class="flex gap-2 mt-1">
                    <span class="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-mono">${i.code}</span>
                    ${i.image_link ? '<span class="text-blue-500 text-[10px]"><i class="fas fa-image"></i></span>' : ''}
                </div>
            </td>
            <td class="px-4 py-3 text-sm dark:text-slate-300" data-label="Category">${i.category}</td>
            <td class="px-4 py-3" data-label="Stock">
                <span class="font-bold ${isLow ? 'text-red-500' : 'text-emerald-600'} text-base">${i.stock}</span> 
                <span class="text-xs text-slate-400">${i.unit}</span>
                ${isLow ? '<i class="fas fa-exclamation-circle text-red-500 ml-1 animate-pulse"></i>' : ''}
            </td>
            <td class="px-4 py-3 text-sm dark:text-slate-300" data-label="Location">${i.location||'-'}</td>
            <td class="px-4 py-3 text-right" data-label="Action">
                <div class="flex justify-end gap-2">
                    <button onclick="extensionViewItemDetails(${i.id})" class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition" title="View/SDS/Image"><i class="fas fa-eye"></i></button>
                    <button onclick="editItem(${i.id})" class="p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 transition" title="Edit"><i class="fas fa-pen"></i></button>
                    <button onclick="extensionOpenDisposal(${i.id})" class="p-2 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-500 transition" title="Dispose Item"><i class="fas fa-box-open"></i></button>
                    <button onclick="deleteItem(${i.id})" class="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
        tb.innerHTML += row;
    });
}

/* =========================================
   4. ITEM DETAILS WITH IMAGE PREVIEW
   ========================================= */
async function extensionViewItemDetails(id) {
    setLoading(true);
    const i = await db('inventory', 'getOne', id);
    setLoading(false);

    // Convert Image Link
    const directImgLink = convertToDirectLink(i.image_link);
    
    let imgHtml = '';
    if (directImgLink) {
        imgHtml = `
        <div class="img-preview-container">
            <img src="${directImgLink}" alt="${i.name}" class="img-preview-content" onerror="this.parentElement.innerHTML='<span class=\\'text-xs text-slate-400\\'>Image Load Failed</span>'">
        </div>`;
    } else {
        imgHtml = `
        <div class="img-preview-container">
            <span class="text-slate-400 text-xs flex flex-col items-center gap-2"><i class="fas fa-image text-2xl"></i>No Image Available</span>
        </div>`;
    }

    document.getElementById('view-item-content').innerHTML = `
        ${imgHtml}
        <div class="grid grid-cols-2 gap-2 text-sm dark:text-slate-300">
            <div><span class="font-bold text-slate-500">Name:</span> <br>${i.name}</div>
            <div><span class="font-bold text-slate-500">Code:</span> <br><span class="font-mono">${i.code}</span></div>
            <div><span class="font-bold text-slate-500">Stock:</span> <br>${i.stock} ${i.unit}</div>
            <div><span class="font-bold text-slate-500">Location:</span> <br>${i.location || 'N/A'}</div>
        </div>
    `;
    
    // Update Action Buttons
    const btnImg = document.getElementById('btn-view-image');
    const btnSds = document.getElementById('btn-view-sds');
    
    if(i.image_link) { btnImg.href = i.image_link; btnImg.classList.remove('hidden'); } 
    else { btnImg.classList.add('hidden'); }

    if(i.sds_link) { btnSds.href = i.sds_link; btnSds.classList.remove('hidden'); } 
    else { btnSds.classList.add('hidden'); }

    document.getElementById('view-item-modal').classList.add('open');
}

/* =========================================
   5. MASTER DATA FUNCTIONALITY
   ========================================= */
function extensionRenderMasterLists() {
    ['categories', 'units', 'departments'].forEach(key => {
        const container = document.getElementById(`master-${key}-list`);
        if (!container) return; // Guard clause
        
        if (!window.master[key] || window.master[key].length === 0) {
            container.innerHTML = `<div class="text-center text-xs text-slate-400 p-4">No ${key} added.</div>`;
            return;
        }

        container.innerHTML = window.master[key].map(item => `
            <div class="master-tag animate-slide-up">
                <span class="text-sm font-medium dark:text-slate-700">${item}</span>
                <i onclick="deleteMasterItem('${key}', '${item}')" class="fas fa-times delete-icon" title="Remove"></i>
            </div>
        `).join('');
    });
}

async function extensionAddMasterItem(key) {
    const inputId = `add-master-${key}`;
    const input = document.getElementById(inputId);
    const val = input.value.trim();
    
    if(!val) return showToast('Please enter a value');
    
    setLoading(true);
    if (!window.master[key]) window.master[key] = [];
    
    if(!window.master[key].includes(val)) {
        window.master[key].push(val);
        await supabase.from('master_data').update({data: window.master}).eq('key','config');
        input.value = '';
        await loadMasterData(); // Refresh dropdowns & lists
        showToast(`Added ${val} to ${key}`);
    } else {
        showToast('Value already exists');
    }
    setLoading(false);
}

async function extensionDeleteMasterItem(key, val) {
    if(!confirm(`Delete "${val}" from ${key}?`)) return;
    
    setLoading(true);
    window.master[key] = window.master[key].filter(i => i !== val);
    await supabase.from('master_data').update({data: window.master}).eq('key','config');
    await loadMasterData();
    setLoading(false);
    showToast('Deleted ' + val);
}

/* =========================================
   6. PURCHASE REQUEST (PR) LIST
   ========================================= */
async function extensionRenderPRs() {
    const prs = await db('pr_requests', 'get');
    const tb = document.getElementById('pr-requests-body'); 
    tb.innerHTML = '';
    const empty = document.getElementById('pr-empty');
    
    if(prs.length === 0) { 
        if(empty) empty.classList.remove('hidden'); 
        return; 
    } 
    if(empty) empty.classList.add('hidden');

    prs.sort((a,b) => b.id - a.id).forEach(p => {
        // Status Badge Logic
        let badgeColor = 'bg-slate-100 text-slate-600';
        if(p.status === 'Pending') badgeColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
        if(p.status === 'Ordered') badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
        if(p.status === 'Received') badgeColor = 'bg-green-100 text-green-800 border-green-200';

        tb.innerHTML += `
        <tr class="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition animate-slide-up">
            <td class="px-4 py-3" data-label="Item">
                <div class="font-bold dark:text-white text-sm">${p.materialDescription}</div>
                <div class="text-xs font-mono text-slate-500">${p.materialCode || '-'}</div>
            </td>
            <td class="px-4 py-3" data-label="Qty">
                <span class="font-bold text-slate-700 dark:text-slate-300">${p.quantity}</span> 
                <span class="text-xs text-slate-400">${p.unit}</span>
            </td>
            <td class="px-4 py-3" data-label="Status">
                <span class="text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${badgeColor}">${p.status}</span>
            </td>
            <td class="px-4 py-3 text-right" data-label="Actions">
                <button onclick="editPR(${p.id})" class="text-brand-500 hover:text-brand-700 mr-2 transition"><i class="fas fa-edit"></i></button>
                <button onclick="db('pr_requests','delete',${p.id}).then(renderPRs)" class="text-red-400 hover:text-red-600 transition"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
}

/* =========================================
   7. DISPOSAL LOGIC
   ========================================= */
async function extensionOpenDisposal(id) {
    setLoading(true);
    const i = await db('inventory', 'getOne', id);
    setLoading(false);
    
    document.getElementById('dispose-id').value = i.id;
    document.getElementById('dispose-name').value = i.name;
    document.getElementById('dispose-qty').max = i.stock;
    document.getElementById('dispose-qty').value = '';
    document.getElementById('dispose-link').value = '';
    
    document.getElementById('disposal-modal').classList.add('open');
}

async function extensionSubmitDisposal(e) {
    e.preventDefault();
    const id = document.getElementById('dispose-id').value;
    const name = document.getElementById('dispose-name').value;
    const qty = parseInt(document.getElementById('dispose-qty').value);
    const reason = document.getElementById('dispose-reason').value;
    const link = document.getElementById('dispose-link').value;

    setLoading(true);
    
    // 1. Get current item to check stock
    const item = await db('inventory', 'getOne', id);
    
    if (qty > item.stock) {
        setLoading(false);
        showToast('Error: Quantity exceeds stock');
        return;
    }

    // 2. Update Inventory
    item.stock -= qty;
    await db('inventory', 'update', item);

    // 3. Log the Disposal (Using existing logs table or a new one)
    const logDetails = `Disposed ${qty} ${item.unit} of ${name}. Reason: ${reason}. Evidence: ${link || 'None'}`;
    await db('logs', 'add', {
        timestamp: new Date().toLocaleString(),
        action: 'DISPOSAL',
        details: logDetails
    });

    setLoading(false);
    closeModal('disposal-modal');
    renderInventory();
    showToast('Item Disposed Successfully');
}
