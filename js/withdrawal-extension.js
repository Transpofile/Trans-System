/**
 * TRANS-SYSTEM: Withdrawal Management Extension
 * Handles: Notifications, Request List, Validation, and Approval Workflow
 */

const WithdrawalSystem = {
    state: {
        filterStatus: 'All', // Options: All, Pending, Approved, Rejected
        searchTerm: '',
        activeRequestId: null,
        requests: [] // Local cache of requests
    },

    // --- INITIALIZATION ---
    async init() {
        console.log("Initializing Withdrawal System...");
        this.setupEventListeners();
        // Initial fetch to set the badge count immediately on load
        await this.refreshData(); 
    },

    setupEventListeners() {
        // Tab Filtering Logic
        document.querySelectorAll('.tab-btn').forEach(btn => {
            // Only attach to buttons inside the specific container to avoid conflicts
            if(btn.closest('#view-requests')) {
                btn.addEventListener('click', (e) => {
                    // Update UI classes
                    const parent = btn.parentElement;
                    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'text-brand-600', 'dark:text-brand-400', 'border-b-2', 'border-brand-600'));
                    e.target.classList.add('active', 'text-brand-600', 'dark:text-brand-400', 'border-b-2', 'border-brand-600');
                    
                    // Update State
                    const text = e.target.innerText;
                    if(text.includes('All')) this.state.filterStatus = 'All';
                    else if(text.includes('Pending')) this.state.filterStatus = 'Pending';
                    else if(text.includes('Approved')) this.state.filterStatus = 'Approved';
                    else if(text.includes('Rejected')) this.state.filterStatus = 'Rejected';
                    
                    this.renderList();
                });
            }
        });
    },

    // --- DATA HANDLING ---
    async refreshData() {
        try {
            // Fetch fresh data from Supabase via the global dbAction bridge
            this.state.requests = await dbAction('requests', 'readonly', store => store.getAll());
            this.updateGlobalBadge();
            this.renderList();
        } catch (error) {
            console.error("Error refreshing withdrawal data:", error);
        }
    },

    updateGlobalBadge() {
        // Calculate pending count from the ENTIRE dataset, regardless of current view filter
        const pendingCount = this.state.requests.filter(r => r.status === 'Pending').length;
        
        // Update Sidebar Badge
        const navBadge = document.getElementById('nav-pending-badge');
        if (navBadge) {
            navBadge.innerText = pendingCount;
            if (pendingCount > 0) {
                navBadge.classList.remove('hidden');
                navBadge.classList.add('inline-block'); // Ensure visibility
            } else {
                navBadge.classList.add('hidden');
            }
        }

        // Update Dashboard Widget if it exists
        const dashBadge = document.getElementById('dash-pending');
        if (dashBadge) dashBadge.innerText = pendingCount;
    },

    // --- LIST RENDERING ---
    renderList() {
        const tbody = document.getElementById('requests-body');
        const emptyState = document.getElementById('requests-empty');
        const searchVal = document.getElementById('req-search') ? document.getElementById('req-search').value.toLowerCase() : '';
        
        if (!tbody) return;

        tbody.innerHTML = '';
        
        // Filter Data
        const filtered = this.state.requests.filter(r => {
            const matchesStatus = this.state.filterStatus === 'All' || r.status === this.state.filterStatus;
            const matchesSearch = (r.requester || '').toLowerCase().includes(searchVal) || 
                                  (r.department || '').toLowerCase().includes(searchVal) || 
                                  r.id.toString().includes(searchVal);
            return matchesStatus && matchesSearch;
        }).sort((a, b) => b.id - a.id); // Newest first

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        } else {
            emptyState.classList.add('hidden');
        }

        // Generate Rows
        filtered.forEach(r => {
            const itemCount = r.items ? r.items.length : 0;
            
            // Determine Badge Color
            let badgeClass = 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
            if(r.status === 'Pending') badgeClass = 'badge-pending';
            else if(r.status === 'Approved') badgeClass = 'badge-approved';
            else if(r.status === 'Rejected') badgeClass = 'badge-rejected';

            // Actions Column
            let actions = `<button onclick="WithdrawalSystem.openDetails(${r.id})" class="text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700 p-1.5 px-3 rounded transition font-bold text-xs border border-brand-200 dark:border-slate-600">Details</button>`;
            
            if(r.status === 'Pending') { 
                actions += `<button onclick="openRequestEditModal(${r.id})" class="text-yellow-600 hover:bg-yellow-50 dark:hover:bg-slate-700 p-1.5 rounded transition ml-2" title="Edit Meta Data"><i class="fas fa-pencil-alt"></i></button>`; 
            }
            // Allow delete mostly for pending/rejected to keep history clean
            if(r.status !== 'Approved') {
                actions += `<button onclick="WithdrawalSystem.deleteRequest(${r.id})" class="text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 p-1.5 rounded transition ml-1" title="Delete"><i class="fas fa-trash"></i></button>`;
            }

            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                    <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">#${r.id}</td>
                    <td class="px-6 py-3 text-xs whitespace-nowrap">${r.date}</td>
                    <td class="px-6 py-3 font-medium text-slate-800 dark:text-white">${r.requester}</td>
                    <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">${r.department}</td>
                    <td class="px-6 py-3 text-center"><span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs font-bold">${itemCount} Items</span></td>
                    <td class="px-6 py-3"><span class="badge ${badgeClass}">${r.status}</span></td>
                    <td class="px-6 py-3 text-right">${actions}</td>
                </tr>`;
            tbody.innerHTML += row;
        });
    },

    // --- FORM LOGIC (Create) ---
    async addRow() {
        const container = document.getElementById('withdrawal-rows');
        const items = await dbAction('inventory', 'readonly', store => store.getAll());
        
        // Sort items alphabetically
        items.sort((a,b) => a.name.localeCompare(b.name));

        let options = '<option value="">-- Select Material --</option>';
        items.forEach(i => {
            const stockDisplay = i.stock <= 0 ? '(Out of Stock)' : `(${i.stock} ${i.unit})`;
            const disabled = i.stock <= 0 ? 'disabled style="color:#ccc"' : '';
            const display = `${i.code ? i.code + ' - ' : ''}${i.name} ${stockDisplay}`;
            options += `<option value="${i.id}" data-max="${i.stock}" data-unit="${i.unit}" data-code="${i.code||''}" ${disabled}>${display}</option>`;
        });

        const rowId = 'row-' + Date.now();
        const rowHTML = `
            <div id="${rowId}" class="grid grid-cols-12 gap-4 items-center fade-in bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-600 shadow-sm mb-2">
                <div class="col-span-7">
                    <select class="w-full border p-2 rounded text-sm req-item-select dark:bg-slate-700 dark:text-white dark:border-slate-500 focus:ring-brand-500" onchange="WithdrawalSystem.updateRowDetails(this)" required>
                        ${options}
                    </select>
                </div>
                <div class="col-span-2 text-center text-xs font-bold">
                    <span class="req-item-available text-slate-500 dark:text-slate-400">-</span>
                </div>
                <div class="col-span-2">
                    <input type="number" oninput="WithdrawalSystem.validateRowQty(this)" class="w-full border p-2 rounded text-sm req-item-qty dark:bg-slate-700 dark:text-white dark:border-slate-500 focus:ring-brand-500 text-center" placeholder="0" min="1" required>
                    <div class="text-[10px] text-red-500 hidden qty-error font-bold mt-1">Exceeds Stock</div>
                </div>
                <div class="col-span-1 text-center">
                    <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 p-2 rounded transition"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', rowHTML);
    },

    updateRowDetails(select) {
        const row = select.closest('div[id^="row-"]');
        const opt = select.options[select.selectedIndex];
        const availableSpan = row.querySelector('.req-item-available');
        const qtyInput = row.querySelector('.req-item-qty');
        
        if (select.value) {
            const maxStock = parseInt(opt.dataset.max);
            const unit = opt.dataset.unit;
            availableSpan.innerHTML = `<span class="${maxStock === 0 ? 'text-red-600' : 'text-green-600'}">${maxStock} ${unit}</span>`;
            qtyInput.max = maxStock;
            qtyInput.value = ''; // Reset qty on change
            this.validateRowQty(qtyInput);
        } else {
            availableSpan.innerText = '-';
            qtyInput.removeAttribute('max');
        }
    },

    validateRowQty(input) {
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
            // Re-enable button only if no other errors exist
            if (!document.querySelector('.qty-error:not(.hidden)')) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    },

    async submitForm(e) {
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

        try {
            await dbAction('requests', 'readwrite', store => store.add(reqData));
            showToast('Request Submitted Successfully', 'success'); 
            e.target.reset(); 
            document.getElementById('withdrawal-rows').innerHTML = ''; 
            this.addRow(); 
            navTo('view-requests'); // Auto navigate back
            this.refreshData(); // Refresh list and badge
        } catch (err) {
            showToast('Error submitting request', 'error');
            console.error(err);
        }
    },

    // --- DETAILS & APPROVAL ---
    async openDetails(id) {
        this.state.activeRequestId = id;
        const req = await dbAction('requests', 'readonly', store => store.get(id));
        if(!req) return;

        // Populate Form
        document.getElementById('thpal-emp-name').innerText = req.requester;
        document.getElementById('thpal-dept').innerText = req.department;
        document.getElementById('thpal-date').innerText = req.date;
        document.getElementById('thpal-time').innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById('thpal-reason').innerText = req.reason || '';
        document.getElementById('thpal-sig-req').innerText = req.requester;
        
        const tbody = document.getElementById('thpal-items-body'); 
        tbody.innerHTML = '';
        
        // Fill 15 rows for the form standard layout
        const maxRows = 15;
        const itemCount = req.items ? req.items.length : 0;
        
        for(let i=0; i<maxRows; i++) {
            if (i < itemCount) {
                const item = req.items[i];
                const ser = i + 1;
                const unit = item.unit || '';
                const qty = item.qty || '';
                const desc = `${item.code ? '['+item.code+'] ' : ''}${item.name}`;
                tbody.innerHTML += `<tr><td class="text-center h-5">${ser}</td><td class="text-center">${unit}</td><td class="text-center font-bold">${qty}</td><td class="pl-2">${desc}</td></tr>`;
            } else {
                tbody.innerHTML += `<tr><td class="text-center h-5"></td><td></td><td></td><td></td></tr>`;
            }
        }
        
        // Checkboxes
        document.getElementById('chk-approved').checked = (req.status === 'Approved');
        document.getElementById('chk-onhold').checked = (req.status === 'Pending');
        document.getElementById('chk-declined').checked = (req.status === 'Rejected');
        document.getElementById('chk-cancelled').checked = false;
        
        // Buttons
        const btns = document.getElementById('approval-buttons'); 
        if(req.status === 'Pending') btns.classList.remove('hidden'); else btns.classList.add('hidden');
        
        document.getElementById('request-details-modal').classList.add('open');
    },

    async processDecision(status) {
        if(!confirm(`Are you sure you want to ${status} this request?`)) return;

        const req = await dbAction('requests', 'readonly', store => store.get(this.state.activeRequestId));
        
        if (status === 'Approved') {
            // Strict Inventory Check before Approval
            let insufficient = false;
            let errorDetails = "";

            for (const i of req.items) {
                const inv = await dbAction('inventory', 'readonly', s=>s.get(i.id));
                if (!inv || inv.stock < i.qty) {
                    insufficient = true;
                    errorDetails += `\n- ${i.name} (Need: ${i.qty}, Has: ${inv ? inv.stock : 0})`;
                }
            }

            if (insufficient) {
                alert(`Cannot Approve: Insufficient stock.${errorDetails}`);
                return;
            }

            // Deduct Stock
            for (const i of req.items) {
                const inv = await dbAction('inventory', 'readonly', s=>s.get(i.id));
                inv.stock -= i.qty;
                await dbAction('inventory', 'readwrite', s=>s.put(inv));
            }
            await logAction('APPROVE_REQ', `Approved Req #${req.id} for ${req.requester}`);
            showToast('Request Approved & Stock Deducted', 'success');
        } else {
             await logAction('REJECT_REQ', `Rejected Req #${req.id}`);
             showToast('Request Rejected', 'info');
        }
        
        req.status = status; 
        await dbAction('requests', 'readwrite', s=>s.put(req));
        
        document.getElementById('request-details-modal').classList.remove('open');
        this.refreshData();
        if(typeof renderDashboard === 'function') renderDashboard();
    },

    async deleteRequest(id) {
        if(confirm(`Permanently delete Request #${id}?`)) { 
            await dbAction('requests', 'readwrite', store => store.delete(id)); 
            this.refreshData();
            showToast('Request Deleted', 'success');
        }
    }
};

// Expose to window for HTML onclick attributes
window.WithdrawalSystem = WithdrawalSystem;