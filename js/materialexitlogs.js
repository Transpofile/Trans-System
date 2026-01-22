/**
 * extension.js
 * Material Exit Logs Extension with Full CRUD
 * Injects UI, Handles Database Logs, and Print Generation
 */

$(document).ready(() => {
    // Inject the HTML View for Logs when the script loads
    injectMaterialExitView();
    // Hook into the navigation to load data when clicked
    $('a[onclick*="material-exit-logs"]').on('click', () => loadExitLogs());
});

// --- 1. VIEW INJECTION (Dynamic HTML) ---
function injectMaterialExitView() {
    if ($('#material-exit-logs').length) return; // Prevent duplicate injection

    const viewHtml = `
        <div id="material-exit-logs" class="page-section hidden">
            <div class="flex justify-between items-center mb-6">
                <h1 class="page-title">Material Exit Logs</h1>
                <button onclick="loadExitLogs()" class="btn-secondary text-sm">
                    <i class="fas fa-sync-alt mr-2"></i> Refresh
                </button>
            </div>
            
            <div class="card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                            <tr>
                                <th class="p-4">Date Printed</th>
                                <th class="p-4">WR Ref</th>
                                <th class="p-4">Driver / Vehicle</th>
                                <th class="p-4">Carrier / Dept</th>
                                <th class="p-4">Items</th>
                                <th class="p-4">Reason</th>
                                <th class="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tbl-exit-logs" class="divide-y divide-slate-100">
                            <tr><td colspan="7" class="p-4 text-center text-slate-400">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    $('#main-container').append(viewHtml);
}

// --- 2. READ (Load Logs) ---
async function loadExitLogs() {
    const tb = $('#tbl-exit-logs');
    tb.html('<tr><td colspan="7" class="p-4 text-center text-slate-400"><i class="fas fa-circle-notch fa-spin"></i> Loading...</td></tr>');

    try {
        const { data, error } = await supabaseClient
            .from('material_exit_logs')
            .select('*')
            .order('printed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!data || data.length === 0) {
            tb.html('<tr><td colspan="7" class="p-4 text-center text-slate-400 italic">No exit logs found. Print a WR to generate a log.</td></tr>');
            return;
        }

        tb.empty();
        data.forEach(log => {
            const dateStr = new Date(log.printed_at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
            const itemCount = Array.isArray(log.items_json) ? log.items_json.length : 0;

            tb.append(`
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 text-xs text-slate-500 font-mono">${dateStr}</td>
                    <td class="p-3 text-xs font-bold text-royal-700">${escapeHTML(log.wr_number)}</td>
                    <td class="p-3 text-xs">
                        <div class="font-bold text-slate-700"><i class="fas fa-user-tag w-4"></i> ${escapeHTML(log.driver_name)}</div>
                        <div class="text-slate-500"><i class="fas fa-truck w-4"></i> ${escapeHTML(log.vehicle_plate)}</div>
                    </td>
                    <td class="p-3 text-xs">
                        <div>${escapeHTML(log.employee_name)}</div>
                        <div class="text-[10px] text-slate-400 uppercase">${escapeHTML(log.department)}</div>
                    </td>
                    <td class="p-3 text-center"><span class="bg-slate-100 px-2 py-1 rounded text-xs font-bold">${itemCount}</span></td>
                    <td class="p-3 text-xs truncate max-w-[150px]" title="${escapeHTML(log.reason)}">${escapeHTML(log.reason)}</td>
                    <td class="p-3 text-right">
                        <div class="flex justify-end gap-1">
                            <button onclick='reprintLog(${JSON.stringify(log)})' class="p-1.5 text-royal-600 hover:bg-royal-50 rounded" title="Reprint"><i class="fas fa-print"></i></button>
                            <button onclick='editExitLog(${JSON.stringify(log)})' class="p-1.5 text-amber-500 hover:bg-amber-50 rounded" title="Edit Details"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteExitLog(${log.id})" class="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete Log"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `);
        });

    } catch (e) {
        console.error(e);
        tb.html(`<tr><td colspan="7" class="p-4 text-center text-red-400">Error: ${e.message}</td></tr>`);
    }
}

// --- 3. CREATE (Print New Form) ---
// This function is attached to your WR Table buttons via script.js logic or manual call
async function printMaterialExitForm(wrId) {
    const wr = wrCache.find(w => w.wr_id == wrId);
    if (!wr) return Swal.fire('Error', 'WR record not found. Refresh page.', 'error');

    // Prepare Items from Inventory Cache
    const initialItems = (wr.wr_items || []).map(item => {
        const inv = invCache.find(x => x.material_code === item.material_code) || {};
        return {
            description: inv.description || item.material_code,
            unit: inv.uom || 'PCS',
            qty: item.quantity_requested,
            remarks: ''
        };
    });

    const defaults = {
        driver: '', vehicle: '', 
        employee: wr.requester_name, 
        dept: wr.department, 
        req: wr.requester_name, 
        reason: wr.remarks,
        time: new Date().toTimeString().slice(0,5),
        items: initialItems
    };

    openExitModal('Print Material Exit', 'Log & Print', defaults, async (formData) => {
        // Insert to DB
        const { error } = await supabaseClient.from('material_exit_logs').insert([{
            wr_id: wr.wr_id,
            wr_number: wr.wr_number,
            driver_name: formData.driver,
            vehicle_plate: formData.vehicle,
            employee_name: formData.employee,
            department: formData.department,
            reason: formData.reason,
            requester_name: formData.requester,
            gate_pass_time: formData.time,
            items_json: formData.items
        }]);

        if (error) throw error;
        
        Swal.fire({icon: 'success', title: 'Logged', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500});
        generateAndOpenPrint(formData, wr.wr_number);
    });
}

// --- 4. UPDATE (Edit Existing Log) ---
function editExitLog(log) {
    const defaults = {
        driver: log.driver_name,
        vehicle: log.vehicle_plate,
        employee: log.employee_name,
        dept: log.department,
        req: log.requester_name,
        reason: log.reason,
        time: log.gate_pass_time,
        items: log.items_json || []
    };

    openExitModal('Edit Log Details', 'Update Log', defaults, async (formData) => {
        const { error } = await supabaseClient.from('material_exit_logs').update({
            driver_name: formData.driver,
            vehicle_plate: formData.vehicle,
            employee_name: formData.employee,
            department: formData.department,
            reason: formData.reason,
            requester_name: formData.requester,
            gate_pass_time: formData.time,
            items_json: formData.items
        }).eq('id', log.id);

        if (error) throw error;

        await loadExitLogs();
        Swal.fire('Updated', 'Log details updated successfully.', 'success');
    });
}

// --- 5. DELETE ---
async function deleteExitLog(id) {
    const confirm = await Swal.fire({
        title: 'Delete Log?',
        text: "This will remove the print history record.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it'
    });

    if (confirm.isConfirmed) {
        try {
            const { error } = await supabaseClient.from('material_exit_logs').delete().eq('id', id);
            if(error) throw error;
            await loadExitLogs();
            Swal.fire('Deleted', '', 'success');
        } catch(e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
}

// --- 6. REPRINT ---
function reprintLog(log) {
    const data = {
        driver: log.driver_name,
        vehicle: log.vehicle_plate,
        employee: log.employee_name,
        department: log.department,
        requester: log.requester_name,
        reason: log.reason,
        time: log.gate_pass_time,
        items: log.items_json || [],
        status: 'REPRINT'
    };
    generateAndOpenPrint(data, log.wr_number);
}

// --- HELPER: GENERIC MODAL FOR EXIT FORM ---
function openExitModal(title, btnText, defaults, callback) {
    const modalHtml = `
        <div class="text-left space-y-3 text-sm font-sans">
            <div class="grid grid-cols-2 gap-3">
                <div><label class="lbl-xs">Driver Name</label><input id="p-driver" class="inp-swal" value="${escapeHTML(defaults.driver)}"></div>
                <div><label class="lbl-xs">Vehicle / Plate</label><input id="p-vehicle" class="inp-swal" value="${escapeHTML(defaults.vehicle)}"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div><label class="lbl-xs">Employee (Carrier)</label><input id="p-employee" class="inp-swal" value="${escapeHTML(defaults.employee)}"></div>
                <div><label class="lbl-xs">Dept</label><input id="p-dept" class="inp-swal" value="${escapeHTML(defaults.dept)}"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                 <div><label class="lbl-xs">Requester</label><input id="p-req" class="inp-swal" value="${escapeHTML(defaults.req)}"></div>
                <div><label class="lbl-xs">Time Out</label><input id="p-time" type="time" class="inp-swal" value="${defaults.time}"></div>
            </div>
            <div><label class="lbl-xs">Reason</label><input id="p-reason" class="inp-swal" value="${escapeHTML(defaults.reason)}"></div>

            <div class="border-t pt-2 mt-2">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-slate-700 text-xs font-bold uppercase">Items List</label>
                    <button type="button" id="btn-add-row" class="bg-royal-600 text-white text-xs px-2 py-1 rounded shadow"><i class="fas fa-plus"></i></button>
                </div>
                <div class="grid grid-cols-12 gap-1 mb-1 text-[10px] font-bold text-slate-500 uppercase">
                    <div class="col-span-5">Desc</div><div class="col-span-2 text-center">Unit</div><div class="col-span-2 text-center">Qty</div><div class="col-span-2">Rem</div>
                </div>
                <div id="p-items-con" class="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar"></div>
            </div>
        </div>
        <style>.lbl-xs{display:block;color:#64748b;font-size:10px;font-weight:700;margin-bottom:2px}.inp-swal{border:1px solid #cbd5e1;border-radius:4px;padding:5px;width:100%;font-size:12px;outline:none}.inp-swal:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,0.1)}</style>
    `;

    Swal.fire({
        title: title,
        width: '600px',
        html: modalHtml,
        showCancelButton: true,
        confirmButtonText: btnText,
        confirmButtonColor: '#1e40af',
        didOpen: () => {
            const container = document.getElementById('p-items-con');
            const addRow = (d = {description:'', unit:'', qty:'', remarks:''}) => {
                const el = document.createElement('div');
                el.className = 'grid grid-cols-12 gap-1 items-center p-row bg-slate-50 p-1 rounded border border-slate-100';
                el.innerHTML = `
                    <div class="col-span-5"><input class="itm-d inp-swal bg-white" value="${escapeHTML(d.description)}" placeholder="Item"></div>
                    <div class="col-span-2"><input class="itm-u inp-swal bg-white text-center" value="${escapeHTML(d.unit)}" placeholder="Unit"></div>
                    <div class="col-span-2"><input type="number" class="itm-q inp-swal bg-white text-center" value="${d.qty}" placeholder="0"></div>
                    <div class="col-span-2"><input class="itm-r inp-swal bg-white" value="${escapeHTML(d.remarks)}" placeholder="..."></div>
                    <div class="col-span-1 text-center"><button type="button" class="text-red-400 hover:text-red-600 del-row"><i class="fas fa-times"></i></button></div>
                `;
                container.appendChild(el);
                el.querySelector('.del-row').onclick = () => el.remove();
            };
            // Populate items
            if(defaults.items.length) defaults.items.forEach(addRow);
            else addRow(); // Add one empty row
            document.getElementById('btn-add-row').onclick = () => addRow();
        },
        preConfirm: () => {
            const items = [];
            document.querySelectorAll('.p-row').forEach(r => {
                const d = r.querySelector('.itm-d').value;
                if(d) items.push({
                    description: d,
                    unit: r.querySelector('.itm-u').value,
                    qty: r.querySelector('.itm-q').value,
                    remarks: r.querySelector('.itm-r').value
                });
            });
            return {
                driver: document.getElementById('p-driver').value || 'N/A',
                vehicle: document.getElementById('p-vehicle').value || 'N/A',
                employee: document.getElementById('p-employee').value,
                department: document.getElementById('p-dept').value,
                requester: document.getElementById('p-req').value,
                reason: document.getElementById('p-reason').value,
                time: document.getElementById('p-time').value,
                items: items
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            callback(result.value);
        }
    });
}

// --- HELPER: HTML PRINT GENERATOR ---
function generateAndOpenPrint(data, wrNumber) {
    let itemRowsHtml = '';
    const maxRows = 10;
    
    // Generate Item Rows
    data.items.forEach((item, index) => {
        if (index >= maxRows) return;
        itemRowsHtml += `
            <tr>
                <td align="center">${index + 1}</td>
                <td><div style="white-space:nowrap; overflow:hidden;">${escapeHTML(item.description)}</div></td>
                <td align="center">${escapeHTML(item.unit)}</td>
                <td align="center">${item.qty}</td>
                <td>${escapeHTML(item.remarks)}</td>
            </tr>
        `;
    });

    // Fill Empty Rows
    for (let i = data.items.length; i < maxRows; i++) {
        itemRowsHtml += `<tr><td align="center">${i + 1}</td><td></td><td></td><td></td><td></td></tr>`;
    }

    const printContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Exit Pass - ${wrNumber}</title>
        <style>
            @page { size: A4; margin: 0; }
            body { font-family: "Arial", sans-serif; margin: 0; padding: 20px; }
            .container { width: 100%; max-width: 210mm; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            h2 { margin: 5px 0; text-transform: uppercase; font-size: 18px; }
            
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
            th, td { border: 1px solid #000; padding: 5px; }
            th { background: #f0f0f0; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 12px; border: 1px solid #000; padding: 10px; }
            .info-item { display: flex; margin-bottom: 5px; }
            .info-label { font-weight: bold; width: 100px; }
            .info-val { border-bottom: 1px solid #999; flex: 1; padding-left: 5px; }

            .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
            .sig-box { width: 30%; text-align: center; }
            .line { border-top: 1px solid #000; margin-top: 40px; margin-bottom: 5px; }
            
            .watermark { position: fixed; top: 40%; left: 30%; font-size: 60px; color: rgba(0,0,0,0.1); transform: rotate(-45deg); border: 5px solid rgba(0,0,0,0.1); padding: 20px; border-radius: 10px; pointer-events: none; }
        </style>
    </head>
    <body>
        ${data.status === 'REPRINT' ? '<div class="watermark">REPRINT COPY</div>' : ''}
        
        <div class="container">
            <div class="header">
                 <img src="https://via.placeholder.com/150x50?text=LOGO" style="height:40px; float:left">
                 <h2>Material Entry/Exit Pass</h2>
                 <div style="font-size:12px">Reference: <b>${wrNumber}</b></div>
            </div>

            <div class="info-grid">
                <div>
                    <div class="info-item"><span class="info-label">Employee:</span> <span class="info-val">${escapeHTML(data.employee)}</span></div>
                    <div class="info-item"><span class="info-label">Department:</span> <span class="info-val">${escapeHTML(data.department)}</span></div>
                    <div class="info-item"><span class="info-label">Date:</span> <span class="info-val">${new Date().toLocaleDateString()}</span></div>
                </div>
                <div>
                    <div class="info-item"><span class="info-label">Driver:</span> <span class="info-val">${escapeHTML(data.driver)}</span></div>
                    <div class="info-item"><span class="info-label">Vehicle/Plate:</span> <span class="info-val">${escapeHTML(data.vehicle)}</span></div>
                    <div class="info-item"><span class="info-label">Time Out:</span> <span class="info-val">${data.time}</span></div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="5%">No.</th>
                        <th width="50%">Description</th>
                        <th width="10%">Unit</th>
                        <th width="10%">Qty</th>
                        <th width="25%">Remarks</th>
                    </tr>
                </thead>
                <tbody>${itemRowsHtml}</tbody>
            </table>

            <div style="border:1px solid #000; padding:10px; font-size:12px; margin-bottom:20px">
                <b>Reason:</b> ${escapeHTML(data.reason)}
            </div>

            <div class="signatures">
                <div class="sig-box">
                    <div>Requester</div>
                    <div class="line"></div>
                    <b>${escapeHTML(data.requester)}</b>
                </div>
                <div class="sig-box">
                    <div>Authorized By (Dept Head)</div>
                    <div class="line"></div>
                </div>
                <div class="sig-box">
                    <div>Security Guard</div>
                    <div class="line"></div>
                </div>
            </div>

            <div style="margin-top:20px; font-size:10px; color:#666; text-align:center">
                System Generated Form | Trans-System Logistics
            </div>
        </div>
        <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }</script>
    </body>
    </html>`;

    const win = window.open('', '_blank', 'width=900,height=800');
    if(win) { win.document.write(printContent); win.document.close(); }
    else Swal.fire('Error', 'Pop-up blocked.', 'warning');
}