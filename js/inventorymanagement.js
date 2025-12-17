// --- START OF FILE inventorymanagement.js ---

document.addEventListener('DOMContentLoaded', () => {
    // Attach form handlers safely
    const addItemForm = document.getElementById('form-add-item');
    if (addItemForm) addItemForm.onsubmit = submitAddItemForm;

    const editInvForm = document.getElementById('form-inv-edit');
    if (editInvForm) editInvForm.onsubmit = submitInvEdit;
    
    const adjustForm = document.getElementById('form-stock-adjust');
    if (adjustForm) adjustForm.onsubmit = submitStockAdjustment;

    // Attach Export Button Listener
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) exportBtn.onclick = downloadInventoryCSV;
});

// --- STATE MANAGEMENT ---

/**
 * Sets the active category filter for inventory rendering.
 * @param {string} cat - The category name or 'All'.
 */
function filterCat(cat) { 
    window.activeCategory = cat; 
    renderInventory(); 
}

/**
 * Filters inventory to show items and navigates to the view.
 * Called from Dashboard "Low Stock" widget.
 */
function filterInventoryByLowStock() { 
    // Reset search
    const searchInput = document.getElementById('inv-search');
    if(searchInput) searchInput.value = ""; 
    
    // Set Category to All to ensure we scan everything
    window.activeCategory = 'All';
    
    // Set Global Filter Flag (This variable is assumed to be in main scope)
    window.activeInventoryFilter = 'LowStock';

    // Navigate to view
    if(typeof navTo === 'function') navTo('view-inventory'); 
    
    // Render with new filter
    renderInventory();
    
    if(typeof showToast === 'function') showToast("Filtered by Low Stock Items", "info");
}

/**
 * Clears specific filters like 'LowStock' and resets to default view.
 */
function clearInventoryFilter() {
    window.activeInventoryFilter = 'All';
    const searchInput = document.getElementById('inv-search');
    if(searchInput) searchInput.value = ""; 
    renderInventory();
}

// --- RENDERING ---

/**
 * Fetches, filters, and renders the inventory table and category filters.
 */
async function renderInventory() {
    // Fetch Data
    const items = await dbAction('inventory', 'readonly', store => store.getAll());
    const tbody = document.getElementById('inventory-body');
    const searchInput = document.getElementById('inv-search');
    const filter = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // Update Category Buttons UI
    renderCategoryButtons();

    // Toggle Filter Badge UI if it exists in HTML
    const filterBadge = document.getElementById('active-filter-badge');
    if(filterBadge) {
        if(window.activeInventoryFilter === 'LowStock') filterBadge.classList.remove('hidden');
        else filterBadge.classList.add('hidden');
    }

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
        const isLow = item.stock <= (item.threshold || 5);
        
        // 1. Search Filter
        const matchesSearch = code.includes(filter) || name.includes(filter);
        
        // 2. Category Filter
        const matchesCat = (window.activeCategory || 'All') === 'All' || item.category === window.activeCategory;

        // 3. Global State Filter (e.g., from Dashboard)
        let passesGlobalFilter = true;
        if (window.activeInventoryFilter === 'LowStock' && !isLow) {
            passesGlobalFilter = false;
        }

        if (matchesSearch && matchesCat && passesGlobalFilter) {
            fragment.appendChild(createInventoryRow(item, isLow));
            count++;
        }
    });
    
    tbody.appendChild(fragment);

    // Reset Scroll Position
    const scrollContainer = tbody.closest('.table-scroll-container') || tbody.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = 0;
    
    const emptyMsg = document.getElementById('inventory-empty');
    if(emptyMsg) emptyMsg.classList.toggle('hidden', count > 0);
}

/**
 * Helper: Renders the Category Filter Buttons
 */
function renderCategoryButtons() {
    const catContainer = document.getElementById('inventory-categories');
    if (!catContainer) return;

    // Ensure masterData exists
    const cats = window.masterData?.categories || ['Spare Parts', 'Tools', 'Fluids'];
    const categories = ['All', ...cats];
    
    const baseClass = "px-3 py-1 rounded-full text-xs font-bold border transition whitespace-nowrap cursor-pointer select-none";
    const activeClass = "bg-brand-600 text-white border-brand-600 shadow-md";
    const inactiveClass = "bg-white dark:bg-slate-700 dark:text-white dark:border-slate-500 text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400";

    catContainer.innerHTML = categories.map(c => {
        const isActive = (window.activeCategory || 'All') === c;
        return `<button onclick="filterCat('${c}')" class="${baseClass} ${isActive ? activeClass : inactiveClass}">${c}</button>`;
    }).join('');
}

/**
 * Helper: Creates a TR element for the inventory table.
 */
function createInventoryRow(item, isLow) {
    const tr = document.createElement('tr');
    const code = item.code || `ID-${item.id}`;
    
    // Row Styling
    tr.className = `hover:bg-slate-50 dark:hover:bg-slate-800 transition border-b border-slate-100 dark:border-slate-700 ${isLow ? 'bg-red-50 dark:bg-red-900/10' : ''}`;

    // Optional Image Logic (if image exists in DB)
    const imgHtml = item.image 
        ? `<img src="${item.image}" alt="Img" class="w-8 h-8 rounded object-cover border border-slate-200 dark:border-slate-600 mr-2 inline-block bg-white shrink-0">` 
        : ``;

    tr.innerHTML = `
        <td class="px-6 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">${code}</td>
        <td class="px-6 py-3 text-slate-800 dark:text-white flex items-center min-w-[200px]">
            ${imgHtml}
            <div class="flex flex-col overflow-hidden">
                <span class="font-medium leading-tight truncate" title="${item.name}">${item.name}</span>
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
                <button onclick="openStockAdjustment(${item.id}, 'In')" class="p-1.5 rounded text-green-600 hover:bg-green-100 dark:hover:bg-green-900" title="Stock In"><i class="fas fa-arrow-up"></i></button>
                <button onclick="openStockAdjustment(${item.id}, 'Out')" class="p-1.5 rounded text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900" title="Stock Out"><i class="fas fa-arrow-down"></i></button>
                <button onclick="viewInventory(${item.id})" class="p-1.5 rounded text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900" title="View Details"><i class="fas fa-eye"></i></button>
                <button onclick="editInventory(${item.id})" class="p-1.5 rounded text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900" title="Edit Metadata"><i class="fas fa-pencil-alt"></i></button>
                <button onclick="deleteItem(${item.id})" class="p-1.5 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900" title="Delete Item"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;
    return tr;
}

// --- CRUD & FORM SUBMISSIONS ---

/**
 * Uploads a file to Supabase Storage and returns the Public URL.
 * Requires a bucket named 'inventory-images' to exist in Supabase.
 */
async function uploadImageToSupabase(file) {
    if (!file) return null;
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error } = await supabase.storage.from('inventory-images').upload(filePath, file);

        if (error) {
            console.warn('Supabase Upload Error (Bucket might not exist):', error);
            return null; // Fail gracefully
        }

        const { data: urlData } = supabase.storage.from('inventory-images').getPublicUrl(filePath);
        return urlData.publicUrl;
    } catch (err) {
        console.error("Upload process failed:", err);
        return null;
    }
}

/**
 * Handles the submission of the Add New Item form.
 */
async function submitAddItemForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if(btn) btn.disabled = true;

    try {
        let imageUrl = '';
        // Check if file input exists in HTML (optional feature)
        const fileInput = document.getElementById('add-image-file');
        const urlInput = document.getElementById('add-image-url');

        if (fileInput && fileInput.files && fileInput.files[0]) {
            showToast('Uploading image...', 'info');
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

        // Duplicate Check
        const allItems = await dbAction('inventory', 'readonly', store => store.getAll());
        const isDuplicate = allItems.some(i => i.code.toLowerCase() === newItem.code.toLowerCase());

        if (isDuplicate) throw new Error(`Material Code "${newItem.code}" already exists.`);

        // DB Insert
        await dbAction('inventory', 'readwrite', store => store.add(newItem));
        await logAction('ADD_ITEM', `Added new material: ${newItem.code} - ${newItem.name}`);
        
        showToast('Item Added Successfully', 'success'); 
        e.target.reset(); 
        
        renderInventory();
        if(typeof renderDashboard === 'function') renderDashboard();
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
    
    const stockInput = document.getElementById('inv-edit-stock');
    if(stockInput) {
        stockInput.value = item.stock; 
        // We usually don't allow direct stock edit in metadata to enforce audit trails
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
 * Handles submission of Inventory Metadata Updates.
 */
async function submitInvEdit(e) {
    e.preventDefault(); 
    const id = parseInt(document.getElementById('inv-edit-id').value);
    
    try {
        const item = await dbAction('inventory', 'readonly', store => store.get(id));
        if(!item) throw new Error("Item no longer exists");

        const oldName = item.name;
        item.name = document.getElementById('inv-edit-name').value.trim(); 
        
        const locInput = document.getElementById('inv-edit-loc');
        if(locInput) item.location = locInput.value.trim();

        await dbAction('inventory', 'readwrite', store => store.put(item));
        await logAction('UPDATE_META', `Updated metadata for ${item.code}. Old Name: ${oldName}`);
        
        showToast('Inventory Updated', 'success'); 
        if(typeof closeModal === 'function') closeModal('inv-edit-modal'); 
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
    
    const imgSrc = item.image && item.image.length > 5 
        ? item.image 
        : 'https://placehold.co/400x400/e2e8f0/475569?text=No+Image';

    const contentDiv = document.getElementById('inv-view-content');
    if(!contentDiv) return;

    // View Template
    contentDiv.innerHTML = `
        <div class="flex flex-col md:flex-row gap-6">
            <div class="w-full md:w-auto flex flex-col items-center justify-start shrink-0">
                <div class="w-40 h-40 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm relative group">
                    <img src="${imgSrc}" alt="${item.name}" class="max-w-full max-h-full object-contain">
                </div>
                <div class="mt-2 text-center w-40">
                    <span class="text-xs font-mono text-slate-400 cursor-pointer" onclick="navigator.clipboard.writeText('${item.code}')">
                        ${item.code || 'ID-'+item.id} <i class="fas fa-copy ml-1"></i>
                    </span>
                </div>
            </div>

            <div class="w-full md:flex-1 min-w-0">
                <div class="border-b border-slate-100 dark:border-slate-700 pb-3 mb-3">
                    <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Description</label>
                    <div class="text-xl font-bold text-slate-800 dark:text-white leading-tight">${item.name}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Category</label>
                        <span class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-sm font-bold">${item.category}</span>
                    </div>
                    <div>
                         <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Location</label>
                         <div class="text-sm font-medium text-slate-700 dark:text-slate-300"><i class="fas fa-map-marker-alt text-slate-400 mr-1"></i> ${item.location || 'N/A'}</div>
                    </div>
                </div>

                <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 mt-4">
                    <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Current Stock</label>
                    <div class="text-2xl font-bold ${stockColor} dark:text-opacity-90">
                        ${item.stock} <span class="text-sm font-normal text-slate-500">${item.unit}</span>
                    </div>
                    ${isLow ? `<div class="mt-1 text-xs font-bold text-red-500"><i class="fas fa-exclamation-triangle"></i> Low Stock Warning</div>` : ''}
                </div>
                
                <div class="mt-4">
                    <label class="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Safety Data Sheet</label>
                    ${item.sds ? `<a href="${item.sds}" target="_blank" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"><i class="fas fa-file-pdf"></i> View PDF</a>` : '<span class="text-sm text-slate-400 italic">No SDS</span>'}
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
            showToast('Item Deleted', 'success');
            if(typeof renderDashboard === 'function') renderDashboard();
        }
    } catch(err) {
        console.error(err);
        showToast('Failed to delete item', 'error');
    }
}

// --- Stock Adjustment Logic (Requires Extra Modal in HTML) ---

let currentInventoryItem = null;

async function openStockAdjustment(id, type) {
    currentInventoryItem = await dbAction('inventory', 'readonly', store => store.get(id));
    if (!currentInventoryItem) return showToast('Item not found.', 'error');

    // Check if the modal exists in the HTML, if not warn the developer
    const modal = document.getElementById('stock-adjust-modal');
    if(!modal) {
        console.error("Missing HTML Element: #stock-adjust-modal");
        alert("Stock Adjustment Modal not found in HTML.");
        return;
    }

    const title = type === 'In' ? 'Stock In (Receive)' : 'Stock Out (Deduct)';
    const btnSubmit = document.getElementById('btn-adjust-submit');
    
    // Set Modal Values
    document.getElementById('adjust-modal-title').innerText = title;
    document.getElementById('adjust-type').value = type;
    document.getElementById('adjust-item-id').value = id;
    
    const nameDisplay = document.getElementById('adjust-item-name-display');
    if(nameDisplay) nameDisplay.innerText = currentInventoryItem.name;
    
    const stockDisplay = document.getElementById('adjust-current-stock');
    if(stockDisplay) stockDisplay.innerText = `${currentInventoryItem.stock} ${currentInventoryItem.unit}`;
    
    const qtyInput = document.getElementById('adjust-qty');
    qtyInput.value = '';
    document.getElementById('adjust-reason').value = '';
    
    // Dynamic UI based on type
    if (type === 'Out') {
        qtyInput.max = currentInventoryItem.stock;
        qtyInput.placeholder = `Max: ${currentInventoryItem.stock}`;
        if(btnSubmit) {
            btnSubmit.innerText = 'Confirm Deduction';
            btnSubmit.className = "px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold transition shadow-lg w-full sm:w-auto";
        }
    } else {
         qtyInput.removeAttribute('max');
         qtyInput.placeholder = `Qty to add`;
         if(btnSubmit) {
             btnSubmit.innerText = 'Confirm Addition';
             btnSubmit.className = "px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold transition shadow-lg w-full sm:w-auto";
         }
    }

    modal.classList.add('open');
    setTimeout(() => qtyInput.focus(), 100);
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
        if(typeof closeModal === 'function') closeModal('stock-adjust-modal');
        renderInventory();
        if(typeof renderDashboard === 'function') renderDashboard();
    } catch (error) {
        console.error("Stock adjust error:", error);
        showToast('System Error during adjustment.', 'error');
    }
}

// --- Export to CSV ---

async function downloadInventoryCSV() {
    try {
        const items = await dbAction('inventory', 'readonly', store => store.getAll());
        if(!items || items.length === 0) return showToast("No data to export", "info");

        // Define Headers
        const headers = ["ID", "Code", "Name", "Category", "Stock", "Unit", "Location"];
        
        // Convert Items to CSV rows
        const csvRows = [headers.join(',')];
        
        items.forEach(item => {
            const row = [
                item.id,
                `"${(item.code || '').replace(/"/g, '""')}"`,
                `"${(item.name || '').replace(/"/g, '""')}"`,
                `"${(item.category || '')}"`,
                item.stock,
                item.unit,
                `"${(item.location || '')}"`
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
