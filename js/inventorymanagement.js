// inventorymanagement.js

// Ensure necessary globals are accessible
/*
 * Globals assumed available:
 * - supabase, dbAction, showToast, logAction, masterData, activeCategory,
 * - renderDashboard, closeModal, navTo
 */

document.addEventListener('DOMContentLoaded', () => {
    // Attach form handlers
    const addItemForm = document.getElementById('form-add-item');
    if (addItemForm) addItemForm.onsubmit = submitAddItemForm;

    const editInvForm = document.getElementById('form-inv-edit');
    if (editInvForm) editInvForm.onsubmit = submitInvEdit;
    
    const adjustForm = document.getElementById('form-stock-adjust');
    if (adjustForm) adjustForm.onsubmit = submitStockAdjustment;

    // Attach Export Button Listener (if element exists)
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) exportBtn.onclick = downloadInventoryCSV;
});


/**
 * Sets the active category filter for inventory rendering.
 * @param {string} cat - The category name or 'All'.
 */
function filterCat(cat) { 
    window.activeCategory = cat; 
    renderInventory(); 
}

/**
 * Filters inventory to show all items and navigates to the view.
 */
function filterInventoryByLowStock() { 
    const searchInput = document.getElementById('inv-search');
    if(searchInput) searchInput.value = ""; 
    
    // Note: The actual filtering logic for "Low Stock" logic usually implies
    // showing only low items, but the original code just reset to 'All'.
    // Preserving original behavior but ensuring view update.
    filterCat('All'); 
    navTo('view-inventory'); 
}

/**
 * Fetches, filters, and renders the inventory table and category filters.
 * optimized with DocumentFragments for performance.
 */
async function renderInventory() {
    const items = await dbAction('inventory', 'readonly', store => store.getAll());
    const tbody = document.getElementById('inventory-body');
    const searchInput = document.getElementById('inv-search');
    const filter = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    renderCategoryButtons();

    if(!tbody) return;
    tbody.innerHTML = ''; 

    // Use Fragment to minimize reflows
    const fragment = document.createDocumentFragment();
    let count = 0;

    // Sort: ID Descending (Newest first)
    items.sort((a, b) => b.id - a.id);

    items.forEach(item => {
        const code = (item.code || `ID-${item.id}`).toLowerCase();
        const name = item.name.toLowerCase();
        
        const matchesSearch = code.includes(filter) || name.includes(filter);
        const matchesCat = window.activeCategory === 'All' || item.category === window.activeCategory;

        if (matchesSearch && matchesCat) {
            fragment.appendChild(createInventoryRow(item));
            count++;
        }
    });
    
    tbody.appendChild(fragment);
    
    const emptyMsg = document.getElementById('inventory-empty');
    if(emptyMsg) emptyMsg.classList.toggle('hidden', count > 0);
}

/**
 * Helper: Renders the Category Filter Buttons
 */
function renderCategoryButtons() {
    const catContainer = document.getElementById('inventory-categories');
    if (!catContainer) return;

    const baseClass = "px-3 py-1 rounded-full text-xs font-bold border transition whitespace-nowrap cursor-pointer select-none";
    const activeClass = "bg-brand-600 text-white border-brand-600 shadow-md";
    const inactiveClass = "bg-white dark:bg-slate-700 dark:text-white dark:border-slate-500 text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400";

    const categories = ['All', ...(masterData?.categories || [])];
    
    catContainer.innerHTML = categories.map(c => {
        const isActive = (window.activeCategory || 'All') === c;
        return `<button onclick="filterCat('${c}')" class="${baseClass} ${isActive ? activeClass : inactiveClass}">${c}</button>`;
    }).join('');
}

/**
 * Helper: Creates a TR element for the inventory table.
 */
function createInventoryRow(item) {
    const tr = document.createElement('tr');
    const isLow = item.stock <= (item.threshold || 5);
    const code = item.code || `ID-${item.id}`;
    
    // Classes
    tr.className = `hover:bg-slate-50 dark:hover:bg-slate-800 transition border-b border-slate-100 dark:border-slate-700 ${isLow ? 'bg-red-50 dark:bg-red-900/10' : ''}`;

    // Image logic with fallback
    const imgHtml = item.image 
        ? `<img src="${item.image}" alt="Img" 
                class="w-8 h-8 rounded object-cover border border-slate-200 dark:border-slate-600 mr-2 inline-block bg-white"
                onerror="this.onerror=null;this.src='https://placehold.co/100?text=X';">` 
        : ``;

    tr.innerHTML = `
        <td class="px-6 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">${code}</td>
        <td class="px-6 py-3 text-slate-800 dark:text-white flex items-center min-w-[200px]">
            ${imgHtml}
            <div class="flex flex-col">
                <span class="font-medium leading-tight">${item.name}</span>
                ${isLow ? '<span class="text-[10px] text-red-600 dark:text-red-400 font-bold mt-0.5">⚠️ LOW STOCK</span>' : ''}
            </div>
        </td>
        <td class="px-6 py-3">
            <span class="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">${item.category}</span>
        </td>
        <td class="px-6 py-3 text-center">
            <div class="font-bold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}">${item.stock}</div>
            <div class="text-[10px] text-slate-500 uppercase">${item.unit}</div>
        </td>
        <td class="px-6 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">${item.location || '-'}</td>
        <td class="px-6 py-3 text-right">
            <div class="flex justify-end gap-2">
                <button onclick="openStockAdjustment(${item.id}, 'In')" class="action-btn text-green-600 hover:bg-green-100 dark:hover:bg-green-900" title="Stock In"><i class="fas fa-arrow-up"></i></button>
                <button onclick="openStockAdjustment(${item.id}, 'Out')" class="action-btn text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900" title="Stock Out"><i class="fas fa-arrow-down"></i></button>
                <button onclick="viewInventory(${item.id})" class="action-btn text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900" title="View Details"><i class="fas fa-eye"></i></button>
                <button onclick="editInventory(${item.id})" class="action-btn text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900" title="Edit Metadata"><i class="fas fa-pencil-alt"></i></button>
                <button onclick="deleteItem(${item.id})" class="action-btn text-red-500 hover:bg-red-100 dark:hover:bg-red-900" title="Delete Item"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;
    return tr;
}

// --- CRUD & Metadata Editing ---

/**
 * Uploads a file to Supabase Storage and returns the Public URL.
 */
async function uploadImageToSupabase(file) {
    if (!file) return null;

    try {
        // Create a unique file name (timestamp + random string + ext)
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. Upload to 'inventory-images' bucket
        const { data, error } = await supabase
            .storage
            .from('inventory-images')
            .upload(filePath, file);

        if (error) {
            console.error('Supabase Upload Error:', error);
            throw new Error('Failed to upload image to storage.');
        }

        // 2. Get Public URL
        const { data: urlData } = supabase
            .storage
            .from('inventory-images')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    } catch (err) {
        console.error("Upload process failed:", err);
        throw err;
    }
}

/**
 * Handles the submission of the Add New Item form.
 */
async function submitAddItemForm(e) {
    e.preventDefault();
    
    // UI Feedback: Disable button
    const btn = e.target.querySelector('button[type="submit"]');
    if(btn) btn.disabled = true;

    try {
        let imageUrl = '';
        const fileInput = document.getElementById('add-image-file');
        const urlInput = document.getElementById('add-image');

        // Logic: Check File Input first, then fallback to URL text input
        if (fileInput && fileInput.files && fileInput.files[0]) {
            showToast('Uploading image...', 'info'); // Give user feedback
            imageUrl = await uploadImageToSupabase(fileInput.files[0]);
        } else if (urlInput && urlInput.value.trim()) {
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
            image: imageUrl || '' 
        };
        
        if (!newItem.code || !newItem.name) {
            throw new Error('Material Code and Description are required.');
        }

        // Check for duplicate material code (Optimized)
        const allItems = await dbAction('inventory', 'readonly', store => store.getAll());
        const isDuplicate = allItems.some(i => i.code.toLowerCase() === newItem.code.toLowerCase());

        if (isDuplicate) {
            throw new Error(`Material Code "${newItem.code}" already exists.`);
        }

        await dbAction('inventory', 'readwrite', store => store.add(newItem));
        await logAction('ADD_ITEM', `Added new material: ${newItem.code} - ${newItem.name}`);
        
        showToast('Item Added Successfully', 'success'); 
        e.target.reset(); 
        renderDashboard();
    } catch (error) {
        console.error("Error adding item:", error);
        showToast(error.message || 'Error adding item.', 'error');
    } finally {
        if(btn) btn.disabled = false;
    }
}

/**
 * Opens the Inventory Metadata Edit Modal.
 */
async function editInventory(id) {
    const item = await dbAction('inventory', 'readonly', store => store.get(id));
    if(!item) return showToast("Item not found", "error");

    setVal('inv-edit-id', item.id);
    setVal('inv-edit-code', item.code || `ID-${item.id}`);
    setVal('inv-edit-name', item.name);
    setVal('inv-edit-loc', item.location || '');
    
    // Set existing image URL in the edit field
    setVal('inv-edit-image', item.image || '');

    // Stock is Read-Only here
    const stockInput = document.getElementById('inv-edit-stock');
    if(stockInput) {
        stockInput.value = item.stock; 
        stockInput.setAttribute('readonly', true); 
        stockInput.classList.add('bg-slate-200', 'cursor-not-allowed');
    }

    document.getElementById('inv-edit-modal').classList.add('open');
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if(el) el.value = val;
}

/**
 * Handles submission of Inventory Metadata (non-stock related fields).
 */
async function submitInvEdit(e) {
    e.preventDefault(); 
    const id = parseInt(document.getElementById('inv-edit-id').value);
    
    try {
        const item = await dbAction('inventory', 'readonly', store => store.get(id));
        if(!item) throw new Error("Item no longer exists");

        const oldName = item.name;

        // Update fields
        item.name = document.getElementById('inv-edit-name').value.trim(); 
        item.location = document.getElementById('inv-edit-loc').value.trim();
        
        // Save Image URL (User might have pasted a new URL)
        const imgInput = document.getElementById('inv-edit-image');
        if (imgInput) item.image = imgInput.value.trim();

        await dbAction('inventory', 'readwrite', store => store.put(item));
        await logAction('UPDATE_META', `Updated metadata for ${item.code}. Old Name: ${oldName}`);
        
        showToast('Inventory Metadata Updated', 'success'); 
        closeModal('inv-edit-modal'); 
        renderInventory();
    } catch (error) {
        console.error("Error updating inventory:", error);
        showToast(error.message, 'error');
    }
}

/**
 * Views detailed information about an inventory item.
 */
async function viewInventory(id) {
    const item = await dbAction('inventory', 'readonly', store => store.get(id));
    if (!item) return;

    const isLow = item.stock <= (item.threshold || 5);
    const stockColor = (item.stock === 0) ? 'text-red-800' : (isLow ? 'text-red-600' : 'text-green-600');
    
    // Robust Image Handling
    const imgSrc = item.image && item.image.length > 5 
        ? item.image 
        : 'https://placehold.co/400x400/e2e8f0/475569?text=No+Image';

    const contentDiv = document.getElementById('inv-view-content');

    contentDiv.innerHTML = `
        <div class="flex flex-col md:flex-row gap-6">
            <!-- Left: Image -->
            <div class="w-full md:w-1/3 flex flex-col items-center">
                <div class="w-full aspect-square bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm relative group">
                    <img src="${imgSrc}" alt="${item.name}" 
                         class="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105"
                         onerror="this.src='https://placehold.co/400?text=Image+Error';">
                </div>
                <div class="mt-2 text-center">
                    <span class="text-xs font-mono text-slate-400 copy-btn cursor-pointer" title="Click to copy" onclick="navigator.clipboard.writeText('${item.code}')">${item.code || 'ID-'+item.id} <i class="fas fa-copy ml-1"></i></span>
                </div>
            </div>

            <!-- Right: Details -->
            <div class="w-full md:w-2/3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div class="col-span-1 sm:col-span-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-1">
                        <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Item Description</label>
                        <div class="text-xl font-bold text-slate-800 dark:text-white leading-tight">${item.name}</div>
                    </div>

                    <div class="info-block">
                        <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Category</label>
                        <span class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-sm font-bold">${item.category}</span>
                    </div>

                    <div class="info-block">
                        <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Location</label>
                        <div class="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <i class="fas fa-map-marker-alt text-slate-400"></i> ${item.location || 'Not Assigned'}
                        </div>
                    </div>

                    <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                        <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Current Stock</label>
                        <div class="text-2xl font-bold ${stockColor} dark:text-opacity-90">
                            ${item.stock} <span class="text-sm font-normal text-slate-500">${item.unit}</span>
                        </div>
                        ${isLow ? `<div class="mt-1 text-xs font-bold text-red-500 flex items-center gap-1"><i class="fas fa-exclamation-triangle"></i> Low Stock</div>` : ''}
                    </div>

                    <div class="flex flex-col justify-between p-2">
                        <div class="mb-3">
                            <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Min Threshold</label>
                            <span class="font-mono font-bold text-slate-600 dark:text-slate-400">${item.threshold || 5} ${item.unit}</span>
                        </div>
                        <div>
                            <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Safety Data Sheet</label>
                            ${item.sds 
                                ? `<a href="${item.sds}" target="_blank" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition"><i class="fas fa-file-pdf"></i> View PDF</a>` 
                                : '<span class="text-sm text-slate-400 italic">No SDS</span>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('inv-view-modal').classList.add('open');
}

/**
 * Deletes an inventory item.
 */
async function deleteItem(id) { 
    if(!confirm('Are you sure you want to permanently delete this item?')) return;
    
    try {
        const item = await dbAction('inventory', 'readonly', s=>s.get(id));
        if (item) {
            await dbAction('inventory', 'readwrite', store => store.delete(id)); 
            await logAction('DELETE_ITEM', `Permanently deleted: ${item.code} (${item.name})`);
            
            renderInventory(); 
            showToast('Item Deleted', 'success'); // Changed to success (green) vs error (red) for feedback
            renderDashboard(); 
        }
    } catch(err) {
        console.error(err);
        showToast('Failed to delete item', 'error');
    }
}


// --- Stock Adjustment Logic ---

let currentInventoryItem = null;

async function openStockAdjustment(id, type) {
    currentInventoryItem = await dbAction('inventory', 'readonly', store => store.get(id));
    if (!currentInventoryItem) return showToast('Item not found.', 'error');

    const title = type === 'In' ? 'Stock In (Receive)' : 'Stock Out (Deduct)';
    const btnSubmit = document.getElementById('btn-adjust-submit');
    
    // Set Modal Values
    document.getElementById('adjust-modal-title').innerText = title;
    document.getElementById('adjust-type').value = type;
    document.getElementById('adjust-item-id').value = id;
    document.getElementById('adjust-item-name-display').innerText = currentInventoryItem.name;
    document.getElementById('adjust-current-stock').innerText = `${currentInventoryItem.stock} ${currentInventoryItem.unit}`;
    
    const qtyInput = document.getElementById('adjust-qty');
    qtyInput.value = '';
    document.getElementById('adjust-reason').value = '';
    
    // Dynamic UI based on type
    if (type === 'Out') {
        qtyInput.max = currentInventoryItem.stock;
        qtyInput.placeholder = `Max: ${currentInventoryItem.stock}`;
        btnSubmit.innerText = 'Confirm Deduction';
        btnSubmit.className = "px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold transition shadow-lg w-full sm:w-auto";
    } else {
         qtyInput.removeAttribute('max');
         qtyInput.placeholder = `Qty to add`;
         btnSubmit.innerText = 'Confirm Addition';
         btnSubmit.className = "px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold transition shadow-lg w-full sm:w-auto";
    }

    document.getElementById('stock-adjust-modal').classList.add('open');
    setTimeout(() => qtyInput.focus(), 100); // User convenience
}

async function submitStockAdjustment(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('adjust-item-id').value);
    const type = document.getElementById('adjust-type').value;
    const qty = parseInt(document.getElementById('adjust-qty').value);
    const reason = document.getElementById('adjust-reason').value.trim();

    if (isNaN(qty) || qty <= 0) return showToast('Invalid quantity.', 'error');
    if (!reason) return showToast('Reason is required.', 'error');

    try {
        let item = await dbAction('inventory', 'readonly', store => store.get(id));
        let newStock = item.stock;
        
        if (type === 'Out') {
            if (newStock < qty) return showToast('Insufficient stock.', 'error');
            newStock -= qty;
        } else {
            newStock += qty;
        }

        item.stock = newStock;
        await dbAction('inventory', 'readwrite', store => store.put(item));
        
        const actionStr = type === 'In' ? 'STOCK_IN' : 'STOCK_OUT';
        const msg = `${type.toUpperCase()} ${qty} ${item.unit}. Ref: ${reason}. Bal: ${newStock}`;
        await logAction(actionStr, `${item.code}: ${msg}`);
        
        showToast('Stock Adjusted.', 'success');
        closeModal('stock-adjust-modal');
        renderInventory();
        renderDashboard(); 
    } catch (error) {
        console.error("Stock adjust error:", error);
        showToast('System Error during adjustment.', 'error');
    }
}

// --- NEW FEATURE: Export to CSV ---

async function downloadInventoryCSV() {
    try {
        const items = await dbAction('inventory', 'readonly', store => store.getAll());
        if(!items || items.length === 0) return showToast("No data to export", "info");

        // Define Headers
        const headers = ["ID", "Code", "Name", "Category", "Stock", "Unit", "Location", "Value (est)"];
        
        // Convert Items to CSV rows
        const csvRows = [headers.join(',')];
        
        items.forEach(item => {
            const row = [
                item.id,
                `"${(item.code || '').replace(/"/g, '""')}"`, // Escape quotes
                `"${(item.name || '').replace(/"/g, '""')}"`,
                `"${(item.category || '')}"`,
                item.stock,
                item.unit,
                `"${(item.location || '')}"`,
                // Assuming no price field exists yet, leaving blank or calculating if added later
                "" 
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const dateStr = new Date().toISOString().split('T')[0];
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `inventory_export_${dateStr}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showToast("Inventory Exported", "success");
    } catch (e) {
        console.error("Export failed", e);
        showToast("Failed to export data", "error");
    }
}
