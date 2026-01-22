/**
 * Trans-System Extension - Enhanced Withdrawal Requests (WR)
 * Adds View Details, Print Capability, and Department Filtering
 */

$(document).ready(() => {
    // Initialize the extension after main script loads
    setupWRExtension();
});

function setupWRExtension() {
    // 1. Inject Department Filter into the WR Page Header
    const wrHeader = $('#withdrawal .page-title').parent();
    if (wrHeader.find('#wr-dept-filter').length === 0) {
        const filterHtml = `
            <div class="mt-4 md:mt-0 mr-4">
                <select id="wr-dept-filter" onchange="getWRs()" class="form-select text-sm w-40 border-amber-300 focus:border-amber-500 focus:ring-amber-200">
                    <option value="">All Departments</option>
                    <!-- Options populated dynamically -->
                </select>
            </div>
        `;
        wrHeader.after(filterHtml); // Place it near the Create WR button
    }

    // 2. Override the global getWRs function from script.js
    // We do this to inject the "View" button and apply filters without changing the core file
    window.getWRs = async function() {
        // Fetch data if cache is empty, otherwise use cache (or re-fetch if needed)
        // leveraging existing supabaseClient from script.js
        const { data } = await supabaseClient
            .from('withdrawal_requests')
            .select(`*, wr_items(*)`)
            .order('created_at', {ascending: false})
            .limit(50);
            
        wrCache = data || [];
        
        // Populate Filter if empty
        const deptFilter = $('#wr-dept-filter');
        if(deptFilter.children('option').length <= 1) {
            const depts = [...new Set(wrCache.map(w => w.department).filter(d => d))].sort();
            depts.forEach(d => deptFilter.append(`<option value="${d}">${d}</option>`));
        }
        
        const selectedDept = deptFilter.val();

        // Filter Logic
        let valid = wrCache.filter(w => w.department !== 'DISPOSAL' && !w.wr_number.startsWith('DISP'));
        if(selectedDept) {
            valid = valid.filter(w => w.department === selectedDept);
        }

        let wrHtml = '';
        if(!valid.length) {
            wrHtml = '<tr><td colspan="9" class="p-6 text-center text-slate-400 italic bg-slate-50">No withdrawal records found.</td></tr>';
        } else {
            valid.forEach(wr => {
                if(wr.wr_items && wr.wr_items.length > 0) {
                    wr.wr_items.forEach((item, idx) => {
                        const inv = invCache.find(i => i.material_code === item.material_code) || {};
                        const isFirst = idx === 0;
                        
                        // Styling based on row position
                        const borderClass = isFirst ? 'border-t-4 border-slate-100' : 'border-b border-slate-50';
                        const bgClass = isFirst ? 'bg-white' : 'bg-slate-50/50';
                        
                        // Action Buttons
                        const approveBtn = (isFirst && wr.status === 'PENDING') 
                            ? `<button onclick="processWR('${wr.wr_id}')" class="btn-xs bg-royal-600 hover:bg-royal-700 text-white px-2 py-1 rounded shadow-sm mr-1"><i class="fas fa-check mr-1"></i>Approve</button>` 
                            : '';
                        
                        // EXTENSION: View Details Button (Eye Icon)
                        const viewBtn = `<button onclick="viewWRDetails('${wr.wr_id}')" class="text-royal-500 hover:text-royal-700 p-1 hover:bg-royal-50 rounded transition" title="View Slip"><i class="fas fa-eye fa-lg"></i></button>`;

                        wrHtml += `
                        <tr class="${borderClass} ${bgClass} hover:bg-amber-50 transition group">
                            <td class="p-3 w-16">${getItemImage(item.material_code)}</td>
                            
                            <!-- Grouped Data (Only shown on first row of the set) -->
                            <td class="p-3 font-mono font-bold text-royal-700 text-xs align-top">
                                ${isFirst ? `<div class="sticky top-0">${wr.wr_number}</div>` : ''}
                            </td>
                            <td class="p-3 text-xs align-top">
                                ${isFirst ? `
                                    <div class="font-bold text-slate-700">${escapeHTML(wr.requester_name)}</div>
                                    <div class="text-[10px] text-slate-400 uppercase tracking-wide">${escapeHTML(wr.department)}</div>
                                ` : ''}
                            </td>

                            <!-- Item Data -->
                            <td class="p-3 font-mono text-xs font-bold text-slate-600">${escapeHTML(item.material_code || '-')}</td>
                            <td class="p-3 text-xs">
                                <div class="text-slate-800 font-medium">${escapeHTML(inv.description || '-')}</div>
                                ${inv.part_number ? `<div class="text-[10px] text-slate-400">PN: ${inv.part_number}</div>` : ''}
                            </td>
                            <td class="p-3 text-center font-bold text-lg text-slate-700 bg-white/50 rounded">${item.quantity_requested || 0}</td>
                            
                            <!-- Date & Status -->
                            <td class="p-3 text-xs text-slate-400 align-top">${isFirst ? new Date(wr.created_at).toLocaleDateString() : ''}</td>
                            <td class="p-3 text-center align-top">
                                ${isFirst ? `
                                    <span class="px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border 
                                        ${wr.status==='APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}">
                                        ${wr.status}
                                    </span>
                                    <div class="mt-2 flex justify-center">${approveBtn}</div>
                                ` : ''}
                            </td>
                            
                            <!-- Actions -->
                            <td class="p-3 text-right align-top">
                                ${isFirst ? `
                                <div class="flex justify-end items-center gap-2">
                                    ${viewBtn}
                                    <div class="h-4 w-px bg-slate-300 mx-1"></div>
                                    <button onclick="editWR('${wr.wr_id}')" class="text-amber-500 hover:text-amber-700 p-1" title="Edit" ${wr.status!=='PENDING'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-pencil-alt"></i></button>
                                    <button onclick="deleteWR('${wr.wr_id}')" class="text-red-400 hover:text-red-600 p-1" title="Delete" ${wr.status!=='PENDING'?'disabled class="opacity-30 cursor-not-allowed"':''}><i class="fas fa-trash"></i></button>
                                </div>` : ''}
                            </td>
                        </tr>`;
                    });
                }
            });
        }
        $('#tbl-wr').html(wrHtml);
    };

    // Re-run the fetch to apply changes immediately
    if(window.wrCache && window.wrCache.length > 0) window.getWRs();
}

/**
 * Displays a detailed modal for a specific Withdrawal Request
 * Acts as a printable "Withdrawal Slip"
 */
function viewWRDetails(id) {
    const wr = wrCache.find(w => w.wr_id == id);
    if(!wr) return Swal.fire('Error', 'Record missing', 'error');

    const isApproved = wr.status === 'APPROVED';
    const statusColor = isApproved ? 'text-emerald-600 border-emerald-600 bg-emerald-50' : 'text-amber-600 border-amber-600 bg-amber-50';

    // Generate Items Table
    let itemsHtml = '';
    let totalQty = 0;
    
    wr.wr_items.forEach((item, index) => {
        const inv = invCache.find(i => i.material_code === item.material_code) || {};
        totalQty += (item.quantity_requested || 0);
        
        itemsHtml += `
            <tr class="border-b border-slate-200 text-sm">
                <td class="py-3 px-2 text-center text-slate-500">${index + 1}</td>
                <td class="py-3 px-2 font-mono font-bold text-slate-700">${item.material_code}</td>
                <td class="py-3 px-2">
                    <div class="font-bold text-slate-800">${escapeHTML(inv.description || '-')}</div>
                    <div class="text-xs text-slate-500">${escapeHTML(inv.category || '')}</div>
                </td>
                <td class="py-3 px-2 text-center text-slate-600">${inv.uom || 'Unit'}</td>
                <td class="py-3 px-2 text-center font-bold text-lg text-slate-800">${item.quantity_requested}</td>
                <td class="py-3 px-2 border-l border-slate-100"></td> <!-- Checkbox column for physical print -->
            </tr>
        `;
    });

    // Fill empty rows if list is short (for printing aesthetics)
    const minRows = 5;
    if (wr.wr_items.length < minRows) {
        for (let i = 0; i < (minRows - wr.wr_items.length); i++) {
            itemsHtml += `
                <tr class="border-b border-slate-100 h-12">
                    <td colspan="6"></td>
                </tr>
            `;
        }
    }

    const modalContent = `
        <div id="print-area" class="p-2 font-sans text-slate-800">
            <!-- Slip Header -->
            <div class="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
                <div>
                    <h2 class="text-2xl font-bold uppercase tracking-wide text-slate-900">Withdrawal Slip</h2>
                    <p class="text-xs text-slate-500 font-bold uppercase">Internal Logistics Document</p>
                </div>
                <div class="text-right">
                    <div class="text-3xl font-mono font-bold text-royal-700">${wr.wr_number}</div>
                    <div class="inline-block px-3 py-1 rounded border-2 text-xs font-bold uppercase mt-1 ${statusColor}">${wr.status}</div>
                </div>
            </div>

            <!-- Meta Data Grid -->
            <div class="grid grid-cols-3 gap-6 mb-6 bg-slate-50 p-4 rounded border border-slate-200">
                <div>
                    <label class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Requester</label>
                    <div class="font-bold text-lg">${escapeHTML(wr.requester_name)}</div>
                </div>
                <div>
                    <label class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Department / Destination</label>
                    <div class="font-bold text-lg">${escapeHTML(wr.department)}</div>
                </div>
                <div>
                    <label class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Date Requested</label>
                    <div class="font-bold text-lg">${new Date(wr.created_at).toLocaleDateString()}</div>
                </div>
            </div>

            <!-- Items Table -->
            <table class="w-full mb-6 border-collapse">
                <thead>
                    <tr class="bg-slate-800 text-white text-xs uppercase tracking-wider">
                        <th class="py-2 px-2 w-10">#</th>
                        <th class="py-2 px-2 text-left w-32">Code</th>
                        <th class="py-2 px-2 text-left">Description</th>
                        <th class="py-2 px-2 w-16">Unit</th>
                        <th class="py-2 px-2 w-20">Qty</th>
                        <th class="py-2 px-2 w-16 text-center">Chk</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    <tr class="bg-slate-100 border-t-2 border-slate-300">
                        <td colspan="4" class="py-2 px-4 text-right font-bold uppercase text-xs text-slate-500">Total Items</td>
                        <td class="py-2 px-2 text-center font-bold text-xl text-royal-700">${totalQty}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <!-- Remarks -->
            <div class="mb-8">
                <label class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Remarks / Purpose</label>
                <div class="w-full p-2 border border-slate-300 bg-white rounded italic min-h-[50px] text-sm">
                    ${escapeHTML(wr.remarks || 'No remarks provided.')}
                </div>
            </div>

            <!-- Signatures Section -->
            <div class="grid grid-cols-3 gap-8 mt-12 pt-4">
                <div class="text-center">
                    <div class="border-b border-slate-400 h-8 mb-2"></div>
                    <p class="text-xs font-bold uppercase text-slate-500">Requested By</p>
                </div>
                <div class="text-center">
                    <div class="border-b border-slate-400 h-8 mb-2"></div>
                    <p class="text-xs font-bold uppercase text-slate-500">Approved / Issued By</p>
                </div>
                <div class="text-center">
                    <div class="border-b border-slate-400 h-8 mb-2"></div>
                    <p class="text-xs font-bold uppercase text-slate-500">Received By</p>
                </div>
            </div>
            
            <div class="text-center mt-8 text-[10px] text-slate-300">
                Generated by Trans-System | ${new Date().toLocaleString()}
            </div>
        </div>
    `;

    Swal.fire({
        html: modalContent,
        width: '800px',
        showCloseButton: true,
        showConfirmButton: true,
        confirmButtonText: '<i class="fas fa-print mr-2"></i> Print Slip',
        confirmButtonColor: '#334155', // Slate-700
        showCancelButton: true,
        cancelButtonText: 'Close',
        customClass: {
            popup: 'rounded-xl shadow-2xl overflow-hidden'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            printWRContent(modalContent);
        }
    });
}

/**
 * Handles the actual printing of the modal content
 */
function printWRContent(content) {
    const printWindow = window.open('', '', 'height=800,width=900');
    
    // Inject Styles for Print
    const styles = `
        <style>
            @import url('https://cdn.tailwindcss.com');
            @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
            body { font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 20px; }
            .bg-slate-50 { background-color: #f8fafc !important; }
            .bg-slate-800 { background-color: #1e293b !important; color: white !important; }
            .bg-slate-100 { background-color: #f1f5f9 !important; }
            .border-slate-200 { border-color: #e2e8f0 !important; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; }
            @media print {
                @page { margin: 0.5cm; }
                button { display: none; }
            }
        </style>
    `;

    printWindow.document.write('<html><head><title>Print Withdrawal Slip</title>');
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    printWindow.document.write(styles);
    printWindow.document.write('</head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus();
    
    // Slight delay to allow Tailwind CDN to parse classes
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}