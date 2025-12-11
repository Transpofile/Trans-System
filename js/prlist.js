// --- prlist.js (Enhanced version with bug fixes and robustness) ---

// Global PR List State Management
const PRListState = {
    data: [],
    filter: '', // Search filter (text)
    statusFilter: 'All', // Status filter (Pending, Ordered, Received, etc.)
    sortBy: 'id',
    sortDirection: 'desc'
};

// --- Initialization and Dependencies ---

/**
 * Initializes PR List UI elements and fetches data.
 * This function should be the primary entry point for the PR List view.
 */
async function initializePRListEnhancement() {
    // 1. Setup UI elements (search bar, tabs) and attach listeners (runs only once)
    setupPRListUIAndListeners();
    
    // 2. Fetch and render the data
    await fetchAndRenderPRRequests();
}

/**
 * Sets up event listeners for search, status tabs, and sorting,
 * ensuring the filter UI is only injected once.
 */
function setupPRListUIAndListeners() {
    const mainContainer = document.getElementById('view-pr-requests');
    const filterContainerId = 'pr-list-filter-container';
    
    // Check if UI is already injected
    if (document.getElementById(filterContainerId)) {
        // If UI exists, just ensure sorting headers are set up (if needed)
        setupSortingListeners();
        return; 
    }
    
    if (!mainContainer) return;

    // --- 1. Inject Search and Filter UI ---
    const filterHTML = `
        <div id="${filterContainerId}" class="flex flex-col gap-4 p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="relative w-full md:w-64">
                    <i class="fas fa-search absolute left-3 top-3 text-slate-400"></i>
                    <input type="text" id="pr-search-input" placeholder="Search Code, Description, PR#" class="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                </div>
                <div class="flex-1 text-right text-sm font-bold text-slate-600 dark:text-slate-400 self-center hidden md:block">
                    Total Active PR Value: <span id="pr-list-total-value" class="text-emerald-600 dark:text-emerald-400">₱0.00</span>
                </div>
            </div>
            <div id="pr-status-tabs" class="flex items-center space-x-2 text-sm overflow-x-auto pb-2">
                <button class="pr-tab-btn px-3 py-1 rounded-full text-xs font-bold transition border" data-status="All">All</button>
                <button class="pr-tab-btn px-3 py-1 rounded-full text-xs font-bold transition border" data-status="Pending">Pending</button>
                <button class="pr-tab-btn px-3 py-1 rounded-full text-xs font-bold transition border" data-status="Ordered">Ordered</button>
                <button class="pr-tab-btn px-3 py-1 rounded-full text-xs font-bold transition border" data-status="Received">Received</button>
                <button class="pr-tab-btn px-3 py-1 rounded-full text-xs font-bold transition border" data-status="For Withdrawal">For Withdrawal</button>
                <button class="pr-tab-btn px-3 py-1 rounded-full text-xs font-bold transition border" data-status="Cancelled">Cancelled</button>
            </div>
        </div>
    `;

    // Find the container for the list (the grid wrapper)
    const listWrapper = mainContainer.querySelector('.bg-white.dark\\:bg-slate-800');
    if (listWrapper) {
        listWrapper.insertAdjacentHTML('afterbegin', filterHTML);
    }
    
    // --- 2. Attach Listeners to injected elements ---
    document.getElementById('pr-search-input').addEventListener('keyup', (e) => {
        PRListState.filter = e.target.value;
        sortAndRenderPRRequests();
    });

    document.querySelectorAll('.pr-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pr-tab-btn').forEach(b => b.classList.remove('active-pr-tab', 'bg-brand-600', 'text-white', 'border-brand-600', 'bg-white', 'dark:bg-slate-700', 'dark:text-white', 'dark:border-slate-500', 'text-slate-600', 'border-slate-300', 'hover:bg-slate-50'));
            PRListState.statusFilter = e.target.dataset.status;
            // Apply active styles
            e.target.classList.add('active-pr-tab', 'bg-brand-600', 'text-white', 'border-brand-600');
            sortAndRenderPRRequests();
        });
    });

    // Set initial active tab styles
    const initialActiveButton = document.querySelector(`.pr-tab-btn[data-status="${PRListState.statusFilter}"]`);
    document.querySelectorAll('.pr-tab-btn').forEach(b => b.classList.add('bg-white', 'dark:bg-slate-700', 'dark:text-white', 'dark:border-slate-500', 'text-slate-600', 'border-slate-300', 'hover:bg-slate-50'));
    if (initialActiveButton) {
        initialActiveButton.classList.remove('bg-white', 'dark:bg-slate-700', 'dark:text-white', 'dark:border-slate-500', 'text-slate-600', 'border-slate-300', 'hover:bg-slate-50');
        initialActiveButton.classList.add('active-pr-tab', 'bg-brand-600', 'text-white', 'border-brand-600');
    }
    
    // Setup sorting listeners (must run every time UI is injected)
    setupSortingListeners();
}


/**
 * Sets up the sorting mechanism on the grid headers.
 */
function setupSortingListeners() {
    const headerRow = document.querySelector('#view-pr-requests .pr-list-grid');
    if (!headerRow) return;

    // Define sortable columns (index starts at 0)
    const sortableMap = {
        0: 'id',
        1: 'materialDescription',
        4: 'category',
        5: 'dateProcess',
    };

    Array.from(headerRow.children).forEach((th, index) => {
        const sortKey = sortableMap[index];
        if (sortKey) {
            th.setAttribute('data-sort', sortKey);
            th.classList.add('cursor-pointer', 'hover:text-brand-400');
            
            // Remove previous icon before adding new one (to prevent duplicates if function runs twice unexpectedly)
            const existingIcon = th.querySelector('i.fa-sort, i.fa-sort-up, i.fa-sort-down');
            if(existingIcon) existingIcon.remove();
            
            th.innerHTML += '<i class="ml-1 fas fa-sort text-[8px] opacity-50"></i>';
            
            th.addEventListener('click', () => {
                const newSortBy = th.dataset.sort;
                if (PRListState.sortBy === newSortBy) {
                    PRListState.sortDirection = PRListState.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    PRListState.sortBy = newSortBy;
                    PRListState.sortDirection = 'desc';
                }
                sortAndRenderPRRequests();
            }, { once: false });
        }
    });
}


// --- Data Fetching and Rendering ---

/**
 * Fetches all PR data from Supabase and stores it in the state, then renders.
 */
async function fetchAndRenderPRRequests() {
    const list = document.getElementById('pr-requests-body');
    if (list) list.innerHTML = '<div class="p-8 text-center text-slate-500 dark:text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading Purchase Requests...</div>';
    
    // Ensure dependencies are available
    if (typeof dbAction === 'undefined' || typeof showToast === 'undefined') {
        console.error("Dependency Error: dbAction or showToast is not defined.");
        if (list) list.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle mr-2"></i> System initialization failed. Check console.</div>';
        return;
    }

    try {
        const data = await dbAction('pr_requests', 'readonly', store => store.getAll());
        
        // Ensure data is an array before setting the state
        PRListState.data = Array.isArray(data) ? data : [];
        sortAndRenderPRRequests();
        
    } catch (error) {
        console.error("Supabase PR Fetch Error:", error);
        if (list) list.innerHTML = '<div class="p-8 text-center text-red-500 dark:text-red-400"><i class="fas fa-exclamation-triangle mr-2"></i> Failed to load PR data. Check console for database connection issues.</div>';
        showToast('Failed to load PR data: Check connection or database permissions.', 'error');
    }
}

/**
 * Sorts, filters, and displays the PR data based on current state.
 */
function sortAndRenderPRRequests() {
    const list = document.getElementById('pr-requests-body');
    list.innerHTML = '';
    
    let filteredData = PRListState.data;
    const filterText = PRListState.filter.toLowerCase();
    
    // 1. Apply Status Filter
    if (PRListState.statusFilter !== 'All') {
        filteredData = filteredData.filter(r => r.status === PRListState.statusFilter);
    }

    // 2. Apply Text Filter
    if (filterText) {
        filteredData = filteredData.filter(r =>
            (r.materialCode && r.materialCode.toLowerCase().includes(filterText)) ||
            (r.materialDescription && r.materialDescription.toLowerCase().includes(filterText)) ||
            (r.prNumber && r.prNumber.toLowerCase().includes(filterText)) ||
            r.id.toString().includes(filterText)
        );
    }

    // 3. Apply Sorting
    filteredData.sort((a, b) => {
        let valA = a[PRListState.sortBy] || '';
        let valB = b[PRListState.sortBy] || '';

        // Handle numeric/ID sorting
        if (PRListState.sortBy === 'id' || PRListState.sortBy === 'quantity') {
            valA = parseInt(valA) || 0;
            valB = parseInt(valB) || 0;
        } else if (PRListState.sortBy.includes('date')) {
            // Handle date sorting
            valA = new Date(valA || '1970-01-01');
            valB = new Date(valB || '1970-01-01');
        } else {
            // String comparison
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }
        
        if (valA < valB) return PRListState.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return PRListState.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    if (filteredData.length === 0) {
        list.innerHTML = '<div class="p-8 text-center text-slate-400">No PRs found matching criteria.</div>';
        document.getElementById('pr-list-total-value').innerText = '₱0.00';
        return;
    }

    let totalActiveValue = 0;

    filteredData.forEach(r => {
        const value = r.quantity * (r.unitPrice || 0);
        
        // Only count active (Pending, Ordered, For Withdrawal) PRs in the dashboard total
        if (r.status === 'Pending' || r.status === 'Ordered' || r.status === 'For Withdrawal') {
            totalActiveValue += value;
        }

        const badgeClass = getPRStatusBadge(r.status);
        
        // Check for overdue status (Pending/Ordered status past the expected date)
        const isOverdue = r.expectedDate && (r.status === 'Pending' || r.status === 'Ordered') && new Date(r.expectedDate) < new Date();
        
        const dateDisplay = `
            <span class="text-[10px] text-slate-500 dark:text-slate-400">P: ${r.dateProcess || '-'}</span><br>
            <span class="text-[10px] ${isOverdue ? 'text-red-600 font-bold' : 'text-orange-600 dark:text-orange-400'}">
                E: ${r.expectedDate || 'N/A'} ${isOverdue ? '(OVERDUE)' : ''}
            </span>
        `;
        
        const trackingDisplay = `
            <span class="text-[10px] text-slate-500 dark:text-slate-400">PR: ${r.prNumber || '-'}</span><br>
            <span class="text-[10px] text-slate-500 dark:text-slate-400">PO: ${r.poNumber || '-'}</span>
        `;
        
        // Quick Action Button
        let quickActionButton = '';
        if (r.status === 'Pending' || r.status === 'Ordered') {
            quickActionButton = `<button onclick="quickUpdatePRStatus(${r.id}, 'Received')" class="text-green-600 hover:bg-green-100 dark:hover:bg-slate-700 p-1 rounded-full transition" title="Mark as Received"><i class="fas fa-check-circle"></i></button>`;
        } else if (r.status === 'Received') {
             quickActionButton = `<button onclick="quickUpdatePRStatus(${r.id}, 'For Withdrawal')" class="text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 p-1 rounded-full transition" title="Ready For Withdrawal"><i class="fas fa-dolly"></i></button>`;
        }

        list.innerHTML += `
            <div class="pr-list-grid hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-xs transition ${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''}">
                <div><span class="font-mono text-slate-500 dark:text-slate-400">#${r.id}</span></div>
                <div><span class="font-bold text-slate-700 dark:text-slate-200">${r.materialDescription}</span><br><span class="text-[10px] text-slate-500 dark:text-slate-400">${r.materialCode || '-'}</span></div>
                <div class="text-center font-bold">${r.quantity} <span class="font-normal text-slate-500 dark:text-slate-400">${r.unit}</span></div>
                <div class="font-mono text-green-700 dark:text-green-400">₱${(r.unitPrice || 0).toFixed(2)}</div>
                <div>${r.category}</div>
                <div>${dateDisplay}</div>
                <div>${trackingDisplay}</div>
                <div class="text-right flex flex-col items-end gap-1">
                    <span class="badge ${badgeClass}">${r.status}</span>
                    <div class="flex gap-2 mt-1">
                        ${quickActionButton}
                        <button onclick="openPRViewModal(${r.id})" class="text-brand-600 hover:text-brand-800 dark:text-brand-400 transition" title="View Details"><i class="fas fa-eye"></i></button>
                        <button onclick="openPREditModal(${r.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 transition" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                        <button onclick="deletePR(${r.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 transition" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
    
    document.getElementById('pr-list-total-value').innerText = totalActiveValue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    
    // Update header sort indicators
    document.querySelectorAll('.pr-list-grid i.fa-sort, .pr-list-grid i.fa-sort-up, .pr-list-grid i.fa-sort-down').forEach(icon => {
        icon.classList.remove('fa-sort-up', 'fa-sort-down', 'opacity-100', 'text-brand-600');
        icon.classList.add('fa-sort', 'opacity-50');
    });
    const activeHeader = document.querySelector(`.pr-list-grid [data-sort="${PRListState.sortBy}"] i.fa-sort`);
    if (activeHeader) {
        activeHeader.classList.remove('fa-sort', 'opacity-50');
        activeHeader.classList.add(PRListState.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down', 'opacity-100', 'text-brand-600');
    }
}


// --- Utility Functions ---

/**
 * Helper function to determine the Tailwind badge class based on PR status.
 */
function getPRStatusBadge(status) {
    switch (status) {
        case 'Pending':
            return 'badge-pending';
        case 'Ordered':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
        case 'Received':
            return 'badge-approved';
        case 'For Withdrawal':
            return 'badge-withdrawal';
        case 'Cancelled':
            return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
        default:
            return 'bg-slate-200 dark:bg-slate-600 dark:text-slate-300';
    }
}

/**
 * Updates the status of a PR quickly from the list view.
 */
async function quickUpdatePRStatus(id, newStatus) {
    if (!confirm(`Are you sure you want to change PR #${id} status to "${newStatus}"?`)) return;

    try {
        const pr = PRListState.data.find(r => r.id === id);
        if (!pr) throw new Error("PR not found.");

        pr.status = newStatus;
        
        // Auto-fill received date if marking as Received
        if (newStatus === 'Received' && !pr.receivedDate) {
            pr.receivedDate = new Date().toISOString().split('T')[0];
        }

        await dbAction('pr_requests', 'readwrite', s => s.put(pr));
        await logAction('PR_UPDATE', `Quick updated PR #${id} status to ${newStatus}`);
        
        showToast(`PR #${id} status updated to ${newStatus}`, 'success');
        
        // Re-fetch and render to update the view and state
        await fetchAndRenderPRRequests();

    } catch (error) {
        showToast('Failed to update PR status.', 'error');
        console.error("Quick Update Error:", error);
    }
}

// Overwrite the function from the main script to ensure the enhanced version is used
window.renderPRRequests = initializePRListEnhancement;