/**
 * materialexit.js
 * Handles the generation, data logging, and printing of the Material Exit Form.
 * Updated with THPAL Specific Format.
 */

// --- 1. NEW PRINT FLOW ---

async function printMaterialExitForm(wrId) {
    if (typeof wrCache === 'undefined' || typeof invCache === 'undefined') {
        Swal.fire('Error', 'System data not loaded. Please refresh.', 'error');
        return;
    }

    const wr = wrCache.find(w => w.wr_id == wrId);
    if (!wr) return Swal.fire('Error', 'WR record not found.', 'error');

    // Prepare Initial Data from DB
    let initialItems = [];
    if (wr.wr_items && wr.wr_items.length > 0) {
        initialItems = wr.wr_items.map(item => {
            const invItem = invCache.find(x => x.material_code === item.material_code) || {};
            return {
                description: invItem.description || item.material_code,
                unit: invItem.uom || 'PCS',
                qty: item.quantity_requested,
                remarks: item.remarks || ''
            };
        });
    }

    // Define Modal HTML for Data Entry (Tailwind styled for the UI interaction)
    const modalHtml = `
        <div class="text-left space-y-3 text-sm font-sans">
            <div class="p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-xs mb-2">
                <i class="fas fa-info-circle"></i> Verify details before generating the THPAL Form.
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div><label class="lbl-xs">Driver Name</label><input id="p-driver" class="inp-swal" placeholder="Name"></div>
                <div><label class="lbl-xs">Vehicle / Plate</label><input id="p-vehicle" class="inp-swal" placeholder="e.g. ABC-123"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div><label class="lbl-xs">Employee Name</label><input id="p-employee" class="inp-swal" value="${escapeHTML(wr.requester_name)}"></div>
                <div><label class="lbl-xs">Department</label><input id="p-dept" class="inp-swal" value="${escapeHTML(wr.department)}"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                 <div><label class="lbl-xs">Requester (Signatory)</label><input id="p-req" class="inp-swal" value="${escapeHTML(wr.requester_name)}"></div>
                <div><label class="lbl-xs">Time Out</label><input id="p-time" type="time" class="inp-swal" value="${new Date().toTimeString().slice(0,5)}"></div>
            </div>
            <div><label class="lbl-xs">Reason for Bringing Out</label><input id="p-reason" class="inp-swal" value="${escapeHTML(wr.remarks || '')}"></div>

            <div class="border-t pt-2 mt-2">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-slate-700 text-xs font-bold uppercase">Items List</label>
                    <button type="button" id="btn-add-row" class="bg-royal-600 text-white text-xs px-2 py-1 rounded"><i class="fas fa-plus"></i></button>
                </div>
                
                <div class="grid grid-cols-12 gap-1 mb-1 text-[10px] font-bold text-slate-500 uppercase">
                    <div class="col-span-5">Desc</div><div class="col-span-2 text-center">Unit</div><div class="col-span-2 text-center">Qty</div><div class="col-span-2">Rem</div>
                </div>
                <div id="p-items-con" class="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar"></div>
            </div>
        </div>
        <style>.lbl-xs{display:block;color:#64748b;font-size:10px;font-weight:700;margin-bottom:2px}.inp-swal{border:1px solid #cbd5e1;border-radius:4px;padding:4px 8px;width:100%;font-size:12px;outline:none}.inp-swal:focus{border-color:#2563eb}</style>
    `;

    const { value: formData } = await Swal.fire({
        title: 'Print Material Exit',
        width: '650px',
        html: modalHtml,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-print"></i> Print & Log',
        confirmButtonColor: '#006837',
        didOpen: () => {
            const container = document.getElementById('p-items-con');
            const addRow = (d = {description:'', unit:'', qty:'', remarks:''}) => {
                const el = document.createElement('div');
                el.className = 'grid grid-cols-12 gap-1 items-center p-row';
                el.innerHTML = `
                    <div class="col-span-5"><input class="itm-d inp-swal" value="${escapeHTML(d.description)}"></div>
                    <div class="col-span-2"><input class="itm-u inp-swal text-center" value="${escapeHTML(d.unit)}"></div>
                    <div class="col-span-2"><input type="number" class="itm-q inp-swal text-center" value="${d.qty}"></div>
                    <div class="col-span-2"><input class="itm-r inp-swal" value="${escapeHTML(d.remarks)}"></div>
                    <div class="col-span-1 text-center"><button type="button" class="text-red-500 hover:text-red-700 del-row"><i class="fas fa-times"></i></button></div>
                `;
                container.appendChild(el);
                el.querySelector('.del-row').onclick = () => el.remove();
            };
            initialItems.length ? initialItems.forEach(addRow) : addRow();
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
                driver: document.getElementById('p-driver').value,
                vehicle: document.getElementById('p-vehicle').value,
                employee: document.getElementById('p-employee').value,
                department: document.getElementById('p-dept').value,
                requester: document.getElementById('p-req').value,
                reason: document.getElementById('p-reason').value,
                time: document.getElementById('p-time').value,
                items: items,
                status: wr.status // Pass current status to determine checks
            };
        }
    });

    if (!formData) return;

    // 1. Log to Database
    try {
        if (typeof supabaseClient !== 'undefined') {
            await supabaseClient.from('material_exit_logs').insert([{
                wr_id: wr.wr_id,
                wr_number: wr.wr_number,
                driver_name: formData.driver,
                vehicle_plate: formData.vehicle,
                employee_name: formData.employee,
                department: formData.department,
                reason: formData.reason,
                requester_name: formData.requester,
                gate_pass_time: formData.time,
                items_json: formData.items,
                printed_at: new Date().toISOString()
            }]);
            Swal.fire({icon: 'success', title: 'Logged', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500});
        }
    } catch (e) { console.error('Logging failed', e); }

    // 2. Generate HTML & Print
    generateAndOpenPrint(formData, wr.wr_number);
}


// --- 2. LOGS & REPRINTING FLOW ---

async function loadExitLogs() {
    $('#tbl-exit-logs').html('<tr><td colspan="7" class="p-4 text-center text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading Logs...</td></tr>');
    
    try {
        const { data, error } = await supabaseClient
            .from('material_exit_logs')
            .select('*')
            .order('printed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const tb = $('#tbl-exit-logs').empty();
        if (!data || data.length === 0) {
            tb.html('<tr><td colspan="7" class="p-4 text-center text-slate-400 italic">No print records found.</td></tr>');
            return;
        }

        data.forEach(log => {
            const dateStr = new Date(log.printed_at).toLocaleString();
            const itemCount = Array.isArray(log.items_json) ? log.items_json.length : 0;
            
            tb.append(`
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td class="p-3 text-xs text-slate-500">${dateStr}</td>
                    <td class="p-3 text-xs font-bold font-mono text-royal-700">${escapeHTML(log.wr_number)}</td>
                    <td class="p-3 text-xs">
                        <div class="font-bold">${escapeHTML(log.driver_name)}</div>
                        <div class="text-[10px] text-slate-400">${escapeHTML(log.vehicle_plate)}</div>
                    </td>
                    <td class="p-3 text-xs truncate max-w-[150px]">${escapeHTML(log.reason)}</td>
                    <td class="p-3 text-xs">${escapeHTML(log.requester_name)}</td>
                    <td class="p-3 text-xs text-center font-bold">${itemCount}</td>
                    <td class="p-3 text-right">
                        <button onclick='reprintLog(${JSON.stringify(log)})' class="btn-secondary text-xs py-1 px-2 text-purple-600 border-purple-200 hover:bg-purple-50">
                            <i class="fas fa-print mr-1"></i> Reprint
                        </button>
                    </td>
                </tr>
            `);
        });

    } catch (e) {
        console.error(e);
        $('#tbl-exit-logs').html(`<tr><td colspan="7" class="p-4 text-center text-red-400">Error loading logs: ${e.message}</td></tr>`);
    }
}

function reprintLog(log) {
    const formData = {
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

    generateAndOpenPrint(formData, log.wr_number);
}


// --- 3. THPAL FORMAT PRINT GENERATOR ---

function generateAndOpenPrint(data, wrNumber) {
    // Generate Item Rows (Exactly 10 rows)
    let itemRowsHtml = '';
    const maxRows = 10;
    
    for (let i = 0; i < maxRows; i++) {
        const item = data.items[i];
        if (item) {
             itemRowsHtml += `
                <tr>
                    <td align="center">${i + 1}</td>
                    <td><input type="text" value="${escapeHTML(item.description)}" readonly></td>
                    <td align="center"><input type="text" value="${escapeHTML(item.unit)}" style="text-align:center" readonly></td>
                    <td align="center"><input type="number" value="${item.qty}" style="text-align:center" readonly></td>
                    <td><input type="text" value="${escapeHTML(item.remarks)}" readonly></td>
                </tr>`;
        } else {
             itemRowsHtml += `
                <tr>
                    <td align="center">${i + 1}</td>
                    <td><input type="text" readonly></td>
                    <td><input type="text" readonly></td>
                    <td><input type="text" readonly></td>
                    <td><input type="text" readonly></td>
                </tr>`;
        }
    }

    // Determine Supervisor Checks
    // Assuming status is either APPROVED, ON-HOLD, DECLINED, CANCELLED
    const s = data.status ? data.status.toUpperCase() : '';
    const chkApp = (s === 'APPROVED' || s === 'REPRINT') ? '✔' : '';
    const chkHold = s === 'ON-HOLD' ? '✔' : '';
    const chkDec = s === 'DECLINED' ? '✔' : '';
    const chkCan = s === 'CANCELLED' ? '✔' : '';
    
    // Dates
    const today = new Date().toISOString().split('T')[0];

    const printContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Material Exit - ${wrNumber}</title>
    <style>
        :root {
            --thpal-green: #006837;
            --border-color: #000;
        }

        body {
            font-family: "Arial", sans-serif;
            background-color: white;
            margin: 0;
            padding: 0;
        }

        .page-container {
            background: white;
            width: 210mm; /* A4 Width */
            min-height: 297mm; /* A4 Height */
            margin: 0 auto;
            padding: 10mm;
            box-sizing: border-box;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 11pt;
            table-layout: fixed;
        }

        th, td {
            border: 1px solid black;
            padding: 4px 6px;
            vertical-align: middle;
        }

        th {
            background-color: #f2f2f2;
            text-align: center;
            font-weight: bold;
        }

        /* Input Styling */
        input[type="text"], 
        input[type="number"], 
        input[type="date"],
        input[type="time"] {
            width: 100%;
            border: none;
            outline: none;
            font-family: inherit;
            font-size: 11pt;
            background: transparent;
            padding: 2px;
            box-sizing: border-box;
        }

        .header-table {
            border: none;
            margin-bottom: 10px;
        }
        .header-table td {
            border: none;
            vertical-align: top;
        }
        .logo-img {
            max-width: 200px;
            height: auto;
        }
        .form-title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            color: var(--thpal-green);
            text-transform: uppercase;
            padding-top: 15px;
        }

        .section-header {
            text-align: left;
            padding: 5px;
            border: 1px solid black;
            border-bottom: none;
            font-weight: bold;
            font-size: 11pt;
        }
        
        .section-header center {
            font-weight: bold;
        }

        .sig-table {
            margin-top: 10px;
            margin-bottom: 5px;
        }
        .sig-table td {
            height: 60px;
            vertical-align: top;
            width: 33.33%;
            border: none;
        }
        .sig-label {
            font-size: 11pt;
            display: block;
            margin-bottom: 20px;
        }
        .sig-line {
            border-top: 1px solid black;
            width: 90%;
            margin: 0 auto;
        }

        .footer {
            margin-top: auto;
            text-align: center;
            font-size: 7pt;
            color: #000;
            padding-top: 10px;
        }
        
        @media print {
            body { 
                margin: 0; 
            }
            .page-container {
                width: 100%;
                margin: 0;
                padding: 5mm;
                min-height: 100vh;
            }
            button { display: none; }
        }
    </style>
</head>
<body>

    <div class="page-container">
        <!-- Logo & Revision -->
        <img src="img/Thpal Official Logo-1.png" alt="THPAL Logo" class="logo-img">
        <span align="right" style="margin-top:-20px;font-size:13px;display:block;"><b>Form 02 EMS-THPAL-SE-301 Rev 01</b></span>

        <!-- Header Title -->
        <div style="text-align:center; margin-bottom: 15px;">
            <b>_______________________________________________________________________________</b><br><br>
            <h2 style="margin:0; color:#006837;">THPAL MATERIAL ENTRY/EXIT FORM</h2>
        </div>

        <!-- AUTHORIZATION DETAILS -->
        <div class="section-header"><center>Authorization Details</center></div>
        <table>
            <colgroup>
                <col style="width: 25%;">
                <col style="width: 35%;">
                <col style="width: 25%;">
                <col style="width: 35%;">
            </colgroup>
            <tr>
                <td><strong>Employee Name:</strong></td>
                <td><input type="text" value="${escapeHTML(data.employee)}" readonly></td>
                <td><strong>Vehicle:</strong></td>
                <td><input type="text" value="${escapeHTML(data.vehicle)}" readonly></td>
            </tr>
            <tr>
                <td><strong>Department:</strong></td>
                <td><input type="text" value="${escapeHTML(data.department)}" readonly></td>
                <td><strong>Driver:</strong></td>
                <td><input type="text" value="${escapeHTML(data.driver)}" readonly></td>
            </tr>
            <tr>
                <td><strong>Date:</strong></td>
                <td><input type="text" value="${today}" readonly></td>
                <td><strong>Time:</strong></td>
                <td><input type="text" value="${data.time}" readonly></td>
            </tr>
        </table>

        <!-- ITEMS TABLE -->
        <table>
            <colgroup>
                <col style="width: 5%;">
                <col style="width: 45%;">
                <col style="width: 10%;">
                <col style="width: 10%;">
                <col style="width: 30%;">
            </colgroup>
            <thead>
                <tr>
                    <th>NO.</th>
                    <th></th>
                    <th>UNIT</th>
                    <th>QTY</th>
                    <th>REMARKS</th>
                </tr>
            </thead>
            <tbody>
                ${itemRowsHtml}
            </tbody>
        </table>

        <!-- REASON SECTION -->
        <table>
            <tr>
               <td>
                 <p><b>Reason for Bringing out:</b></p>
                 <input type="text" style="padding:1%;" value="${escapeHTML(data.reason)}" readonly>
               </td>
            </tr>
        </table>

        <!-- SUPERVISOR'S NOTE -->
        <div class="section-header"><center>Supervisor’s Note (Please check one):</center></div>
        <table style="margin-bottom: 10px;">
            <colgroup>
                <col style="width: 20%;">
                <col style="width: 5%;">
                <col style="width: 20%;">
                <col style="width: 5%;">
                <col style="width: 20%;">
                <col style="width: 5%;">
                <col style="width: 20%;">
                <col style="width: 5%;">
            </colgroup>
             <tbody>
                <tr>
                    <td align="center">Approved</td>
                    <td align="center"><b>${chkApp}</b></td>
                    <td align="center">On-hold</td>
                    <td align="center"><b>${chkHold}</b></td>
                    <td align="center">Declined</td>
                    <td align="center"><b>${chkDec}</b></td>
                    <td align="center">Cancelled</td>
                    <td align="center"><b>${chkCan}</b></td>
                </tr>
            </tbody>
        </table>

        <!-- SIGNATURES -->
        <table class="sig-table">
            <tr>
                <td>
                    <span class="sig-label">Requester:</span>
                    <div style="height: 15px; font-weight:bold; text-align:center; font-family:'Courier New'">${escapeHTML(data.requester)}</div>
                    <div class="sig-line"></div>
                </td>
                <td>
                    <span class="sig-label">Supervisor’s Signature:</span>
                    <div style="height: 15px;"></div>
                    <div class="sig-line"></div>
                </td>
                <td>
                    <span class="sig-label">Authorized Security Signatory:</span>
                    <div style="height: 15px;"></div>
                    <div class="sig-line"></div>
                </td>
            </tr>
        </table>

        <!-- IT NOTE -->
        <div style="font-size: 12pt; margin-bottom: 20px;">
            Note: For IT related items, approved IT Authorization Form shall be attached.
        </div>

        <!-- SECURITY GUARD SECTION -->
        <div style="font-size:14px;">To be filled-out by Security Guard at Main Gate:</div><br>
        <table style="margin-bottom: 10px;">
            <colgroup>
                <col style="width: 20%;">
                <col style="width: 5%;">
                <col style="width: 20%;">
                <col style="width: 5%;">
                <col style="width: 20%;">
                <col style="width: 5%;">
                <col style="width: 20%;">
                <col style="width: 5%;">
            </colgroup>
             <tbody>
                <tr>
                    <td align="center">Name:</td>
                    <td></td>
                    <td align="center">Signature:</td>
                    <td></td>
                    <td align="center">Date:</td>
                    <td></td>
                    <td align="center">Time:</td>
                    <td></td>
                </tr>
            </tbody>
        </table>

        <!-- ADDRESS FOOTER -->
        <div class="footer">
            <div style="display:flex; justify-content: space-between; align-items: flex-end;">
                 <div style="width:45%; text-align:left;">
                    <strong>Taganito Special Economic Zone</strong><br>
                    Brgy. Taganito, Claver, Surigao del Norte 8410, Philippines Tel.: (632) 548-7140 and 548-7141 Fax: (632) 548-
                 </div>
                 <div style="width:45%; text-align:left;">
                    <strong>Mailing address and/or City Contact Numbers:</strong><br>
                    24th Floor, NAC Tower, 32nd Street near corner 9th Ave., Bonifacio Global City, Taguig City 1634, Philippines Tel.: (632) 548-7110, Fax: (632) 856-3930
                 </div>
            </div>
        </div>

    </div>
    <script>
        window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }
    </script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if(win) { 
        win.document.write(printContent); 
        win.document.close(); 
    }
    else Swal.fire('Error', 'Pop-up blocked. Please allow pop-ups.', 'warning');
}

// Auto-inject Print Buttons on WR Table
setInterval(() => {
    $('#tbl-wr tr').each(function() {
        const row = $(this);
        const actionDiv = row.find('td:last-child div.flex');
        if (actionDiv.length > 0 && actionDiv.find('.btn-print-ext').length === 0) {
            const editBtn = actionDiv.find('button[onclick^="editWR"]');
            if (editBtn.length > 0) {
                const wrId = editBtn.attr('onclick').match(/'([^']+)'/)[1];
                actionDiv.prepend(`<button onclick="printMaterialExitForm('${wrId}')" class="btn-print-ext text-purple-600 hover:text-purple-800 p-1" title="Print Material Exit"><i class="fas fa-print"></i></button>`);
            }
        }
    });
}, 1000);