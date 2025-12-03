// ==========================================================
// TRANS-SYSTEM PRO ENHANCEMENT EXTENSION (gil1.js)
// Enhancing PR and Withdrawal Workflows
// ==========================================================

// Global Utility (Ensure these are defined in the main script or accessible globally)
// Assumes dbAction, logAction, showToast, closeModal, renderRequests, renderDashboard, renderPRRequests are global.

document.addEventListener('DOMContentLoaded', () => {
    // Setup forms for new modals
    const formFulfillment = document.getElementById('form-fulfillment');
    if (formFulfillment) {
        formFulfillment.onsubmit = submitFulfillment;
    }

    const formPRReceive = document.getElementById('form-pr-receive');
    if (formPRReceive) {
        formPRReceive.onsubmit = submitPRReceive;
    }
    
    // Set default date for PR Receive Modal
    const receiveDateInput = document.getElementById('receive-date');
    if (receiveDateInput) {
        receiveDateInput.value = new Date().toISOString().split('T')[0];
    }
});


// ==========================================================
// A. GENERAL UTILITIES AND LOADING EFFECTS
// ==========================================================

/**
 * Handles the "Back to Home" button click with a loading effect.
 */
window.returnToHome = (e) => {
    e.preventDefault();
    const link = e.currentTarget.querySelector('a');
    
    // Prevent multiple clicks
    if (link.dataset.loading) return;

    link.dataset.originalText = link.innerHTML;
    link.dataset.loading = true;
    
    // Apply loading effect
    link.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    link.style.pointerEvents = 'none';
    
    showToast('Redirecting to home...', 'info');
    
    // Redirect after a short delay
    setTimeout(() => {
        window.location.href = link.href;
    }, 1000); 
};


// ==========================================================
// B. ENHANCED WITHDRAWAL LOGIC (Two-Step Approval & Fulfillment)
// ==========================================================

/**
 * OVERRIDE: Modify core processRequest function.
 * Status 'Approved' now only changes the request status (Supervisor Role),
 * it NO LONGER deducts stock immediately.
 */
window.processRequest = async function (status) {
    const req = await dbAction('requests', 'readonly', store => store.get(activeReqId));
    
    if (status === 'Approved') {
        req.status = status;
        await logAction('REQUEST_APPROVED', `Request #${req.id} approved by supervisor (${req.requester}).`);
    } else if (status === 'Rejected') {
        req.status = status;
        await logAction('REQUEST_REJECTED', `Request #${req.id} rejected (${req.requester}).`);
    }
    
    await dbAction('requests', 'readwrite', s => s.put(req));
    closeModal('request-details-modal'); 
    renderRequests(); 
    renderDashboard();
};

/**
 * Stock Keeper opens this modal to physically issue the items.
 */
window.openFulfillmentModal = async function (id) {
    const req = await dbAction('requests', 'readonly', store => store.get(id));
    if (req.status !== 'Approved') {
        return showToast(`Request #${id} must be 'Approved' before fulfillment.`, 'error');
    }

    document.getElementById('fulfill-req-id').value = id;
    document.getElementById('fulfill-req-id-display').innerText = id;
    const tbody = document.getElementById('fulfillment-items-body');
    tbody.innerHTML = '';
    
    document.getElementById('fulfill-name').value = '';

    for (const item of req.items) {
        const inv = await dbAction('inventory', 'readonly', store => store.get(item.id));
        const maxQty = inv ? inv.stock : 0;
        
        const isDisabled = maxQty === 0 ? 'disabled' : '';
        const qtyToFulfill = item.qty; 
        
        // Determine the realistic max based on available stock, but don't exceed requested
        const initialValue = Math.min(maxQty, qtyToFulfill);
        
        tbody.innerHTML += `
            <tr data-item-id="${item.id}" class="border-b dark:border-slate-700">
                <td class="py-2 text-slate-800 dark:text-white">
                    ${item.name} <br>
                    <span class="text-xs text-slate-500">Code: ${item.code || '-'} | Stock: ${maxQty} ${item.unit}</span>
                </td>
                <td><span class="font-bold">${qtyToFulfill} ${item.unit}</span></td>
                <td>
                    <input type="number" 
                           data-item-id="${item.id}"
                           class="w-20 border p-1 rounded text-sm dark:bg-slate-600 issued-qty-input" 
                           value="${initialValue}"
                           max="${qtyToFulfill}" min="0" ${isDisabled}>
                </td>
            </tr>
        `;
    }
    document.getElementById('fulfillment-modal').classList.add('open');
}

/**
 * Processes the stock deduction and finalizes the withdrawal request.
 */
async function submitFulfillment(e) {
    e.preventDefault();
    const reqId = parseInt(document.getElementById('fulfill-req-id').value);
    const fulfillerName = document.getElementById('fulfill-name').value.trim();
    if (!fulfillerName) return showToast('Please enter Fulfiller Name.', 'error');

    const req = await dbAction('requests', 'readonly', store => store.get(reqId));
    const issuedQuantities = [];
    let isPartial = false;
    let anyStockDeducted = false;

    // 1. Validate and collect issued quantities
    const inputs = document.querySelectorAll('#fulfillment-items-body .issued-qty-input');
    for (const input of inputs) {
        const requestedItem = req.items.find(i => i.id === parseInt(input.dataset.itemId));
        const itemId = parseInt(input.dataset.itemId);
        const issuedQty = parseInt(input.value) || 0;
        
        if (issuedQty < 0) return showToast('Issued quantity cannot be negative.', 'error');
        if (issuedQty > requestedItem.qty) return showToast(`Issued quantity for ${requestedItem.name} cannot exceed requested quantity (${requestedItem.qty}).`, 'error');
        
        if (issuedQty > 0) {
             anyStockDeducted = true;
        }

        if (issuedQty < requestedItem.qty && issuedQty > 0) {
            isPartial = true;
        }

        issuedQuantities.push({ itemId, issuedQty, requestedQty: requestedItem.qty, name: requestedItem.name, unit: requestedItem.unit, code: requestedItem.code });
    }
    
    if (!anyStockDeducted) {
         closeModal('fulfillment-modal');
         return showToast(`Fulfillment recorded for Request #${reqId}, no stock was issued. Status remains 'Approved'.`, 'info');
    }

    // 2. Deduct stock from Inventory
    for (const item of issuedQuantities) {
        if (item.issuedQty > 0) {
            const inv = await dbAction('inventory', 'readonly', s => s.get(item.itemId));
            if (inv && inv.stock >= item.issuedQty) {
                inv.stock -= item.issuedQty;
                await dbAction('inventory', 'readwrite', s => s.put(inv));
                await logAction('STOCK_WITHDRAWN', `Deducted ${item.issuedQty} ${inv.unit} of ${inv.name} for Request #${reqId} (Fulfiller: ${fulfillerName}).`);
            } else if (inv) {
                 showToast(`Critical: Stock check failed for ${inv.name}. Stock was not deducted.`, 'error');
                 // If stock fails to deduct due to concurrency, we should flag the request as problematic but proceed with update
            }
        }
    }

    // 3. Update Request status
    if (isPartial) {
        req.status = 'Partially Fulfilled';
    } else {
        req.status = 'Fulfilled';
    }
    
    // Store fulfillment details (who, when, what was actually issued)
    req.fulfillmentDetails = {
        date: new Date().toLocaleString(),
        fulfiller: fulfillerName,
        // Only store items that were actually issued
        issuedItems: issuedQuantities.filter(i => i.issuedQty > 0)
    };
    
    await dbAction('requests', 'readwrite', s => s.put(req));

    showToast(`Request #${reqId} finalized as ${req.status}.`, 'success');
    closeModal('fulfillment-modal');
    renderRequests();
    renderDashboard();
}

/**
 * OVERRIDE: Update openRequestModal to handle the new two-step flow and partial statuses.
 */
window.openRequestModal = async function (id) {
    activeReqId = id; 
    const req = await dbAction('requests', 'readonly', store => store.get(id));
    
    // THPAL form population
    document.getElementById('thpal-emp-name').innerText = req.requester;
    document.getElementById('thpal-dept').innerText = req.department;
    document.getElementById('thpal-date').innerText = req.date;
    document.getElementById('thpal-time').innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); 
    document.getElementById('thpal-reason').innerText = req.reason || '';
    
    // Display Fulfiller if available, otherwise Requester
    const signatureName = (req.fulfillmentDetails && req.fulfillmentDetails.fulfiller) 
                          ? `${req.fulfillmentDetails.fulfiller} (Fulfiller)` 
                          : req.requester;
    document.getElementById('thpal-sig-req').innerText = signatureName;

    // Use issued items for display if fulfilled, otherwise use requested items
    const displayItems = (req.status === 'Fulfilled' || req.status === 'Partially Fulfilled')
                         ? req.fulfillmentDetails.issuedItems || req.items
                         : req.items;
    
    const tbody = document.getElementById('thpal-items-body'); 
    tbody.innerHTML = '';
    
    for(let i=0; i<15; i++) {
        const item = displayItems[i];
        const ser = i + 1;
        
        let unit = '';
        let qty = '';
        let desc = '';
        
        if (item) {
            const statusLabel = (item.issuedQty !== undefined) ? ` (${item.issuedQty < item.requestedQty ? 'Partial' : 'Issued'})` : '';
            const displayQty = item.issuedQty !== undefined ? item.issuedQty : item.qty;
            
            unit = item.unit;
            qty = `${displayQty} ${statusLabel}`;
            desc = `${item.code || ''} - ${item.name}`;
        }
        
        tbody.innerHTML += `
            <tr>
                <td class="text-center h-5">${ser}</td>
                <td class="text-center">${unit}</td>
                <td class="text-center">${qty}</td>
                <td class="pl-2">${desc}</td>
            </tr>
        `;
    }

    // Checkboxes based on status
    document.getElementById('chk-approved').checked = (req.status === 'Approved' || req.status === 'Fulfilled' || req.status === 'Partially Fulfilled');
    document.getElementById('chk-onhold').checked = (req.status === 'Pending');
    document.getElementById('chk-declined').checked = (req.status === 'Rejected');

    // Button Visibility 
    const btns = document.getElementById('approval-buttons'); 
    const btnSupervisorApprove = document.getElementById('btn-supervisor-approve');
    const btnStockFulfill = document.getElementById('btn-stock-fulfill');
    
    btns.classList.remove('hidden'); 
    btnSupervisorApprove.classList.add('hidden');
    btnStockFulfill.classList.add('hidden');
    
    if (req.status === 'Pending') {
        btnSupervisorApprove.classList.remove('hidden');
    } else if (req.status === 'Approved') {
        btnStockFulfill.classList.remove('hidden');
    } else {
        btns.classList.add('hidden'); 
    }
    
    document.getElementById('request-details-modal').classList.add('open');
}

/**
 * OVERRIDE: Update renderRequests to handle new 'Fulfilled' and 'Partially Fulfilled' statuses.
 */
window.renderRequests = async function() {
    const all = await dbAction('requests', 'readonly', store => store.getAll());
    const filter = document.getElementById('req-filter-status').value;
    const tbody = document.getElementById('requests-body'); tbody.innerHTML = '';
    
    // Add new options to filter dropdown if they don't exist (robustness)
    const filterSelect = document.getElementById('req-filter-status');
    if (!filterSelect.querySelector('option[value="Fulfilled"]')) {
        filterSelect.innerHTML += '<option value="Fulfilled">Fulfilled</option>';
        filterSelect.innerHTML += '<option value="Partially Fulfilled">Partial Fulfillment</option>';
    }

    all.sort((a,b) => b.id - a.id).forEach(r => {
        if (filter !== 'All' && r.status !== filter) return;
        
        let badge;
        if (r.status === 'Pending') badge = 'badge-pending';
        else if (r.status === 'Approved') badge = 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300'; // Approved (Waiting fulfillment)
        else if (r.status === 'Fulfilled') badge = 'badge-approved';
        else if (r.status === 'Partially Fulfilled') badge = 'badge-withdrawal'; // Using withdrawal badge color for partial success
        else if (r.status === 'Rejected') badge = 'badge-rejected';
        else badge = 'bg-slate-200 dark:bg-slate-600 dark:text-slate-300';
        
        let actions = `<button onclick="openRequestModal(${r.id})" class="text-blue-600 hover:bg-blue-100 p-1.5 rounded transition font-bold text-xs border border-blue-200 bg-blue-50">View / Action</button>`;
        
        if(r.status === 'Pending') { 
            actions += `<button onclick="openRequestEditModal(${r.id})" class="text-yellow-600 hover:bg-yellow-100 p-1.5 rounded transition ml-2" title="Edit Details"><i class="fas fa-pencil-alt"></i></button>`; 
        }
        
        actions += `<button onclick="deleteRequest(${r.id})" class="text-red-500 hover:bg-red-100 p-1.5 rounded transition ml-1" title="Delete"><i class="fas fa-trash"></i></button>`;
        
        tbody.innerHTML += `<tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"><td class="px-6 py-3 font-mono text-xs">#${r.id}</td><td class="px-6 py-3">${r.date}</td><td class="px-6 py-3 font-medium">${r.requester}</td><td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">${r.department}</td><td class="px-6 py-3 text-xs">${r.items.length} Items</td><td class="px-6 py-3"><span class="badge ${badge}">${r.status}</span></td><td class="px-6 py-3 text-right">${actions}</td></tr>`;
    });
    
    // Update dashboard count
    const pendingCount = all.filter(r => r.status === 'Pending').length;
    document.getElementById('nav-pending-badge').innerText = pendingCount;
    document.getElementById('nav-pending-badge').classList.toggle('hidden', pendingCount === 0);
}

// ==========================================================
// C. ENHANCED PR LOGIC (Procurement Cycle)
// ==========================================================

/**
 * OVERRIDE: Update PR rendering to include the new Receive Stock action and status.
 */
window.renderPRRequests = async function () {
    const list = document.getElementById('pr-requests-body'); list.innerHTML = '';
    const prs = await dbAction('pr_requests', 'readonly', store => store.getAll());
    if(prs.length === 0) { list.innerHTML = '<div class="p-8 text-center text-slate-400">No PRs found</div>'; return; }
    
    prs.sort((a,b) => b.id - a.id).forEach(r => {
        let badge;
        if (r.status === 'Pending') badge = 'badge-pending';
        else if (r.status === 'Received') badge = 'badge-approved';
        else if (r.status === 'Partially Received') badge = 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300';
        else if (r.status === 'Ordered') badge = 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
        else badge = 'bg-slate-200 dark:bg-slate-600 dark:text-slate-300';
        
        const procDate = r.dateProcess || '-';
        const expDate = r.expectedDate || 'N/A';
        const dateDisplay = `<span class="text-[10px] text-slate-500 dark:text-slate-400">P: ${procDate}</span><br><span class="text-[10px] text-orange-600 dark:text-orange-400">E: ${expDate}</span>`;
        
        const trackingDisplay = `<span class="text-[10px] text-slate-500 dark:text-slate-400">PR: ${r.prNumber||'-'}</span><br><span class="text-[10px] text-slate-500 dark:text-slate-400">PO: ${r.poNumber||'-'}</span>`;
        
        const remainingQty = (r.quantity || 0) - (r.totalReceivedQty || 0);
        const qtyDisplay = `${r.quantity} ${r.unit} <span class="text-[10px] text-red-500 dark:text-red-400">(Rem: ${remainingQty})</span>`;


        let actions = `<button onclick="openPRViewModal(${r.id})" class="text-brand-600 hover:text-brand-800 dark:text-brand-400 transition" title="View Details"><i class="fas fa-eye"></i></button>`;
        actions += `<button onclick="openPREditModal(${r.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 transition ml-1" title="Edit"><i class="fas fa-pencil-alt"></i></button>`;
        
        if (r.status !== 'Received' && r.status !== 'Cancelled' && remainingQty > 0) {
             actions += `<button onclick="openPRReceiveModal(${r.id})" class="text-green-600 hover:text-green-800 dark:text-green-400 transition ml-2 font-bold" title="Receive Stock"><i class="fas fa-boxes-stacked"></i></button>`;
        }
        
        actions += `<button onclick="deletePR(${r.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 transition ml-1" title="Delete"><i class="fas fa-trash"></i></button>`;


        list.innerHTML += `<div class="pr-list-grid hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-xs transition">
            <div><span class="font-mono text-slate-500 dark:text-slate-400">#${r.id}</span></div><div><span class="font-bold text-slate-700 dark:text-slate-200">${r.materialDescription}</span><br><span class="text-[10px] text-slate-500 dark:text-slate-400">${r.materialCode||'-'}</span></div><div class="text-center font-bold">${qtyDisplay}</div><div class="font-mono text-green-700 dark:text-green-400">₱${(r.unitPrice||0).toFixed(2)}</div><div>${r.category}</div><div>${dateDisplay}</div><div>${trackingDisplay}</div><div class="text-right flex flex-col items-end gap-1"><span class="badge ${badge}">${r.status}</span><div class="flex gap-2 mt-1">${actions}</div></div></div>`;
    });
}

/**
 * Opens the modal to record stock received against a PR.
 */
window.openPRReceiveModal = async function (id) {
    const pr = await dbAction('pr_requests', 'readonly', s=>s.get(id));
    
    document.getElementById('receive-pr-id').value = pr.id;
    document.getElementById('receive-material-desc').innerText = pr.materialDescription;
    
    // Calculate remaining quantity to receive
    const received = pr.totalReceivedQty || 0;
    const remaining = pr.quantity - received;
    
    document.getElementById('receive-requested-qty').innerText = `${remaining} ${pr.unit}`;
    
    const qtyInput = document.getElementById('receive-quantity');
    qtyInput.value = remaining;
    qtyInput.max = remaining;

    document.getElementById('pr-receive-modal').classList.add('open');
}

/**
 * Submits the stock receipt, updates PR, and adds/updates Inventory.
 */
async function submitPRReceive(e) {
    e.preventDefault();
    const prId = parseInt(document.getElementById('receive-pr-id').value);
    const receivedQty = parseInt(document.getElementById('receive-quantity').value);
    const receivedDate = document.getElementById('receive-date').value;
    const location = document.getElementById('receive-location').value;

    const pr = await dbAction('pr_requests', 'readonly', s=>s.get(prId));
    
    if (receivedQty <= 0) return showToast('Received quantity must be positive.', 'error');
    
    // Initialize tracking properties if not present
    pr.totalReceivedQty = pr.totalReceivedQty || 0;

    const newTotalReceived = pr.totalReceivedQty + receivedQty;
    if (newTotalReceived > pr.quantity) {
        return showToast(`Error: Total received quantity (${newTotalReceived}) exceeds original PR quantity (${pr.quantity}).`, 'error');
    }

    // 1. Update Inventory
    let inventoryItem = null;
    if (pr.materialCode) {
        const allInv = await dbAction('inventory', 'readonly', s=>s.getAll());
        inventoryItem = allInv.find(i => i.code === pr.materialCode);
    }

    if (inventoryItem) {
        inventoryItem.stock += receivedQty;
        inventoryItem.location = location || inventoryItem.location;
        await dbAction('inventory', 'readwrite', s => s.put(inventoryItem));
        await logAction('PR_RECEIPT_UPDATE', `Received ${receivedQty} ${pr.unit} (PR #${prId}). Stock updated for ${inventoryItem.code}.`);
    } else {
        // Create new item
        const newItem = {
            code: pr.materialCode || `PR-${prId}-REC`,
            name: pr.materialDescription,
            category: pr.category,
            stock: receivedQty,
            unit: pr.unit,
            threshold: 5,
            location: location || 'Warehouse',
            sds: pr.imageLink1 || ''
        };
        await dbAction('inventory', 'readwrite', store => store.add(newItem));
        await logAction('PR_RECEIPT_NEW', `Received ${receivedQty} ${pr.unit} (PR #${prId}). Created new inventory item: ${newItem.name}.`);
    }

    // 2. Update PR status and tracking
    pr.totalReceivedQty = newTotalReceived;
    pr.receivedDate = receivedDate;

    if (newTotalReceived === pr.quantity) {
        pr.status = 'Received';
    } else if (newTotalReceived > 0) {
        pr.status = 'Partially Received';
    }
    
    await dbAction('pr_requests', 'readwrite', s=>s.put(pr));
    
    showToast(`Stock received successfully. PR status updated to ${pr.status}.`, 'success');
    closeModal('pr-receive-modal');
    renderPRRequests();
    renderDashboard();
}

/**
 * Recommendation: Enhanced PR View Modal for better tracking.
 */
window.openPRViewModal = async function (id) {
    const pr = await dbAction('pr_requests', 'readonly', s=>s.get(id));
    const container = document.getElementById('pr-view-content');
    const imageContainer = document.getElementById('pr-view-image-container');
    const linksContainer = document.getElementById('pr-view-links');
    const noImage = document.getElementById('pr-view-no-image');

    document.getElementById('pr-view-id-display').innerText = `(#${pr.id})`;
    
    // Image Setup (Existing logic)
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
    if (pr.imageLink1) { linksContainer.innerHTML += `<a href="${pr.imageLink1}" target="_blank" class="mx-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"><i class="fas fa-link mr-1"></i> Link 1</a>`; }
    if (pr.imageLink2) { linksContainer.innerHTML += `<a href="${pr.imageLink2}" target="_blank" class="mx-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"><i class="fas fa-link mr-1"></i> Link 2</a>`; }


    // Details Setup (Enhanced with Total Received tracking)
    const totalValue = (pr.quantity * (pr.unitPrice || 0)).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const statusBadgeClass = pr.status === 'Pending' ? 'badge-pending' : pr.status === 'Received' ? 'badge-approved' : pr.status === 'Partially Received' ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300' : 'bg-slate-200 dark:bg-slate-600 dark:text-slate-300';
    const remarksDisplay = pr.remarks ? `<div class="col-span-2 text-xs italic mt-2 p-2 bg-slate-50 dark:bg-slate-700 rounded border dark:border-slate-600">${pr.remarks}</div>` : '';
    
    const totalReceivedQty = pr.totalReceivedQty || 0;
    const remainingQty = pr.quantity - totalReceivedQty;


    container.innerHTML = `
        <span class="font-bold text-slate-500 dark:text-slate-400">Material Code:</span> <span class="font-mono text-brand-700 dark:text-brand-400">${pr.materialCode || '-'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400 col-span-2">Description:</span> <span class="col-span-2">${pr.materialDescription}</span>
        
        <span class="font-bold text-slate-500 dark:text-slate-400">Requested Qty:</span> <span class="font-bold">${pr.quantity} ${pr.unit}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Received Qty:</span> <span class="font-bold text-green-600 dark:text-green-400">${totalReceivedQty} ${pr.unit}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Remaining Qty:</span> <span class="font-bold text-red-600 dark:text-red-400">${remainingQty} ${pr.unit}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Category:</span> <span>${pr.category}</span>
        
        <span class="font-bold text-slate-500 dark:text-slate-400">Unit Price:</span> <span>₱${(pr.unitPrice||0).toFixed(2)}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Total Value:</span> <span class="font-bold text-lg text-emerald-600 dark:text-emerald-400">${totalValue}</span>

        <hr class="col-span-2 my-2 dark:border-slate-600">

        <span class="font-bold text-slate-500 dark:text-slate-400">Date Processed:</span> <span>${pr.dateProcess}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Expected Date:</span> <span class="font-bold text-orange-600 dark:text-orange-400">${pr.expectedDate || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Received Date:</span> <span class="font-bold text-green-600 dark:text-green-400">${pr.receivedDate || 'N/A'}</span>
        
        <span class="font-bold text-slate-500 dark:text-slate-400">Vendor:</span> <span>${pr.vendorName || 'N/A'}</span>

        <span class="font-bold text-slate-500 dark:text-slate-400">Current Status:</span> 
        <span><span class="badge ${statusBadgeClass}">${pr.status}</span></span>
        
        <hr class="col-span-2 my-2 dark:border-slate-600">

        <span class="font-bold text-slate-500 dark:text-slate-400">PR Number:</span> <span>${pr.prNumber || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">PO Number:</span> <span>${pr.poNumber || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">ARF Number:</span> <span>${pr.arfNumber || 'N/A'}</span>
        <span class="font-bold text-slate-500 dark:text-slate-400">Purchaser:</span> <span>${pr.purchaserAssign || 'N/A'}</span>
        
        <div class="col-span-2"><span class="font-bold text-slate-500 dark:text-slate-400">Remarks:</span></div>
        ${remarksDisplay}
    `;

    document.getElementById('pr-view-modal').classList.add('open');
}