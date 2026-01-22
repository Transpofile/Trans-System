/**
 * DRIVERS EXTENSION V7.0
 * Handles UI Injection, CSS, 3-State Employment Badges, and Date Math
 */

const DriverUI = {
    // --- 1. CSS INJECTION ---
    injectStyles: () => {
        if (document.getElementById('drv-custom-styles')) return;
        const style = document.createElement('style');
        style.id = 'drv-custom-styles';
        style.innerHTML = `
            :root {
                --drv-primary: #4361ee;
                --drv-success: #06d6a0;
                --drv-warning: #ffb703;
                --drv-danger: #ef233c;
                --drv-dark: #2b2d42;
                --drv-gray: #6c757d;
            }
            .z-high { z-index: 1060; }
            
            /* Modal Headers */
            .drv-modal-header { background: linear-gradient(135deg, var(--drv-primary) 0%, #3f37c9 100%); color: white; }
            
            /* Avatars */
            .drv-avatar { 
                width: 45px; height: 45px; border-radius: 12px; object-fit: cover; 
                display: flex; align-items: center; justify-content: center; 
                font-weight: 700; color: white; font-size: 16px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .drv-avatar-lg { 
                width: 100px; height: 100px; font-size: 35px; 
                border-radius: 50%; border: 4px solid #f8f9fa; 
                object-fit: cover;
                box-shadow: 0 5px 15px rgba(0,0,0,0.15); 
                display: flex; align-items: center; justify-content: center;
                color: white; font-weight: bold;
            }

            /* Row States */
            .row-resigned { background-color: #fff8e1 !important; }
            .row-resigned td { color: #856404; opacity: 0.85; }
            
            .row-not-employed { background-color: #f3f4f6 !important; opacity: 0.75; }
            .row-not-employed td { color: #6c757d; }
            .row-not-employed img { filter: grayscale(100%); }

            /* View Profile Layout */
            .view-row { border-bottom: 1px dashed #e9ecef; padding: 8px 0; font-size: 0.95rem; }
            .view-label { font-size: 0.75rem; color: #6c757d; font-weight: 600; text-transform: uppercase; width: 130px; display: inline-block; }
            .view-val { color: #212529; font-weight: 500; }

            /* Table Styling */
            .drv-row { transition: all 0.2s; font-size: 0.9rem; }
            .drv-row:hover { transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.05); z-index: 1; position: relative; }
            
            .font-mono { font-family: 'SFMono-Regular', Consolas, monospace; letter-spacing: 0.5px; }
            .text-label { font-size: 0.65rem; text-transform: uppercase; font-weight: 700; color: #adb5bd; margin-right: 5px; }

            /* Badges */
            .badge-status { padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; border: 1px solid transparent; }
            
            .badge-pass { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
            .badge-fail { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
            
            .badge-emp { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
            .badge-resigned { background: #ffedd5; color: #9a3412; border-color: #fed7aa; }
            .badge-not-employed { background: #e5e7eb; color: #374151; border-color: #d1d5db; }
        `;
        document.head.appendChild(style);
    },

    // --- 2. HTML MODAL INJECTION ---
    injectModals: () => {
        if (document.getElementById('drvMainModal')) return;
        
        const html = `
        <!-- 1. MAIN MANAGEMENT MODAL -->
        <div class="modal fade z-high" id="drvMainModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style="max-width: 95%;">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header drv-modal-header border-0 py-2">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-person-vcard-fill fs-5 me-2"></i>
                            <h5 class="modal-title fw-bold fs-6">Driver Management</h5>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-light btn-sm text-primary fw-bold shadow-sm" onclick="DriverManager.openForm()"><i class="bi bi-plus-lg"></i> Register New</button>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    
                    <div class="modal-body p-0 bg-white">
                        <div id="drvNotificationArea" class="d-none alert alert-danger border-0 rounded-0 mb-0 py-2 text-center small fw-bold">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i> <span id="drvNotifyMsg"></span>
                        </div>

                        <!-- Toolbar -->
                        <div class="p-3 border-bottom sticky-top bg-light">
                            <div class="row g-2 align-items-center">
                                <div class="col-lg-6 d-flex flex-wrap gap-2">
                                    <div class="btn-group btn-group-sm shadow-sm" role="group">
                                        <button class="btn btn-primary filter-btn" data-filter="Employed" onclick="DriverManager.setFilter('Employed')">Employed</button>
                                        <button class="btn btn-outline-secondary filter-btn" data-filter="Resigned" onclick="DriverManager.setFilter('Resigned')">Resigned</button>
                                        <button class="btn btn-outline-secondary filter-btn" data-filter="Not Employed" onclick="DriverManager.setFilter('Not Employed')">Not Employed</button>
                                        <button class="btn btn-outline-secondary filter-btn" data-filter="All" onclick="DriverManager.setFilter('All')">All</button>
                                    </div>
                                </div>
                                <div class="col-lg-6">
                                    <div class="d-flex gap-2 justify-content-lg-end align-items-center">
                                        <div class="input-group input-group-sm" style="max-width: 250px;">
                                            <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                                            <input type="text" id="drvSearchInput" class="form-control" placeholder="Search..." onkeyup="DriverManager.render()">
                                        </div>
                                        <div class="vr mx-2"></div>
                                        <div class="small text-muted d-flex gap-3">
                                            <span>Employed: <strong id="uiStatEmployed" class="text-primary">0</strong></span>
                                            <span>Passed: <strong id="uiStatPassed" class="text-success">0</strong></span>
                                            <span title="For employed drivers only">Exp. Lic: <strong id="uiStatExpired" class="text-danger">0</strong></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Table -->
                        <div class="table-responsive">
                            <table class="table align-middle mb-0 table-hover">
                                <thead class="bg-light text-muted small text-uppercase">
                                    <tr>
                                        <th class="ps-4 py-3" style="width: 300px;">Driver Profile</th>
                                        <th style="width: 200px;">License & NCII</th>
                                        <th style="width: 200px;">Contact / Address</th>
                                        <th style="width: 250px;">Status & Validity</th>
                                        <th class="text-end pe-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="drvTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. COMPACT VIEW DETAILS MODAL -->
        <div class="modal fade z-high" id="drvViewModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header py-2 bg-light border-bottom">
                        <small class="fw-bold text-uppercase text-muted"><i class="bi bi-person-badge"></i> Driver Profile</small>
                        <button type="button" class="btn-close btn-sm" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="row">
                            <!-- Left: Avatar -->
                            <div class="col-md-4 text-center border-end">
                                <div class="d-flex justify-content-center mb-3 pt-2" id="v_avatar_container"></div>
                                <h5 class="fw-bold mb-1" id="v_name">--</h5>
                                <div class="mb-3" id="v_status_badge"></div>
                                
                                <div class="card bg-light border-0 mb-3 text-start shadow-sm">
                                    <div class="card-body p-3 small">
                                        <div class="text-muted text-uppercase fw-bold" style="font-size:0.7rem;">Assigned Vehicle</div>
                                        <div id="v_vehicle_display" class="mt-1">--</div>
                                    </div>
                                </div>
                                <button class="btn btn-outline-primary btn-sm w-100" onclick="DriverManager.editFromView()">
                                    <i class="bi bi-pencil-square"></i> Edit Details
                                </button>
                                <input type="hidden" id="v_id_hidden">
                            </div>

                            <!-- Right: Details -->
                            <div class="col-md-8 ps-md-4">
                                <h6 class="text-primary fw-bold border-bottom pb-2 mb-3">License & Qualifications</h6>
                                <div class="view-row"><span class="view-label">License No.</span> <span class="view-val font-mono" id="v_license">--</span></div>
                                <div class="view-row"><span class="view-label">NCII Cert.</span> <span class="view-val font-mono" id="v_ncii">--</span></div>
                                <div class="view-row"><span class="view-label">Date Issued</span> <span class="view-val" id="v_issued">--</span></div>
                                <div class="view-row"><span class="view-label">License Expiry</span> <span class="view-val" id="v_expiry">--</span></div>
                                <div class="view-row bg-light ps-2 rounded mb-2"><span class="view-label">Lic. Validity</span> <span id="v_validity_text">--</span></div>

                                <div class="view-row"><span class="view-label">Assess. Date</span> <span class="view-val" id="v_assess_date">--</span></div>
                                <div class="view-row bg-light ps-2 rounded"><span class="view-label">10y Tenure Rem.</span> <span id="v_tenure_text">--</span></div>

                                <h6 class="text-primary fw-bold border-bottom pb-2 mb-3 mt-4">Personal Information</h6>
                                <div class="view-row"><span class="view-label">Contact</span> <span class="view-val" id="v_contact">--</span></div>
                                <div class="view-row"><span class="view-label">Address</span> <span class="view-val" id="v_address">--</span></div>
                                <div class="view-row border-0"><span class="view-label">Notes</span> <span class="view-val fst-italic text-muted" id="v_notes">--</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 3. ADD/EDIT FORM MODAL -->
        <div class="modal fade z-high" id="drvFormModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-light py-2">
                        <h6 class="modal-title fw-bold" id="drvFormTitle">New Driver</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="drvForm" class="needs-validation" novalidate>
                            <input type="hidden" id="f_id">
                            <div class="row g-3">
                                <!-- Photo -->
                                <div class="col-md-3 text-center">
                                    <div class="mb-2">
                                        <img src="" id="f_preview_img" class="drv-avatar-lg d-none mx-auto">
                                        <div id="f_preview_placeholder" class="drv-avatar-lg bg-light text-muted d-flex align-items-center justify-content-center mx-auto">
                                            <i class="bi bi-camera fs-4"></i>
                                        </div>
                                    </div>
                                    <input type="url" class="form-control form-control-sm" id="f_photo" placeholder="Photo URL..." oninput="DriverUI.updateFormPreview(this.value)">
                                </div>
                                <!-- Main Fields -->
                                <div class="col-md-9">
                                    <div class="row g-2">
                                        <div class="col-6">
                                            <label class="small fw-bold">Full Name *</label>
                                            <input type="text" class="form-control form-control-sm" id="f_name" required placeholder="Last Name, First Name">
                                        </div>
                                        <div class="col-3">
                                            <label class="small fw-bold">Employment</label>
                                            <select class="form-select form-select-sm fw-bold" id="f_emp_status">
                                                <option value="Employed">Employed</option>
                                                <option value="Resigned" class="text-warning">Resigned</option>
                                                <option value="Not Employed" class="text-secondary">Not Employed</option>
                                            </select>
                                        </div>
                                        <div class="col-3">
                                            <label class="small fw-bold">Assess Status</label>
                                            <select class="form-select form-select-sm fw-bold" id="f_status">
                                                <option value="Pending">Pending</option>
                                                <option value="Pass" class="text-success">PASS</option>
                                                <option value="Fail" class="text-danger">FAIL</option>
                                            </select>
                                        </div>
                                        <div class="col-6">
                                            <label class="small fw-bold">License No. *</label>
                                            <input type="text" class="form-control form-control-sm font-mono text-uppercase" id="f_license" required>
                                        </div>
                                        <div class="col-6">
                                            <label class="small fw-bold">NCII Number</label>
                                            <input type="text" class="form-control form-control-sm font-mono text-uppercase" id="f_ncii">
                                        </div>
                                        
                                        <!-- DATES -->
                                        <div class="col-4">
                                            <label class="small fw-bold">Issued</label>
                                            <input type="date" class="form-control form-control-sm" id="f_date_issued">
                                        </div>
                                        <div class="col-4">
                                            <label class="small fw-bold text-danger">Lic. Expiry *</label>
                                            <input type="date" class="form-control form-control-sm" id="f_expiry" required onchange="DriverUI.calcFormExpiry()">
                                        </div>
                                        <div class="col-4">
                                            <label class="small fw-bold">Assess. Date</label>
                                            <input type="date" class="form-control form-control-sm" id="f_assessment" onchange="DriverUI.calcFormTenure()">
                                        </div>
                                        
                                        <!-- DATE FEEDBACK -->
                                        <div class="col-12 d-flex gap-3">
                                            <div id="f_expiry_feedback" class="small flex-grow-1"></div>
                                            <div id="f_assessment_feedback" class="small flex-grow-1 text-end"></div>
                                        </div>
                                        
                                        <div class="col-6">
                                            <label class="small fw-bold">Contact Number</label>
                                            <input type="text" class="form-control form-control-sm" id="f_contact">
                                        </div>
                                        <div class="col-6">
                                            <label class="small fw-bold">Assigned Vehicle</label>
                                            <select class="form-select form-select-sm" id="f_vehicle"><option value="">-- Unassigned --</option></select>
                                        </div>
                                        <div class="col-12">
                                            <label class="small fw-bold">Address</label>
                                            <input type="text" class="form-control form-control-sm" id="f_address">
                                        </div>
                                        <div class="col-12">
                                            <label class="small fw-bold">Notes</label>
                                            <input type="text" class="form-control form-control-sm" id="f_notes" placeholder="Additional remarks...">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer bg-light py-2 border-0">
                        <button class="btn btn-sm btn-link text-muted text-decoration-none" data-bs-dismiss="modal">Cancel</button>
                        <button class="btn btn-sm btn-primary px-4 rounded-pill" onclick="DriverManager.save()">Save Driver</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    },

    // --- 3. GENERATE ROW ---
    generateRow: (d) => {
        // Calculations
        const licValidity = DriverUI.calculateDuration(d.license_expiry);
        const assessValidity = DriverUI.calculateTenureRemaining(d.assessment_date);
        
        const status = d.employment_status || 'Employed';
        let rowClass = 'bg-white';
        let empBadge = '';

        // Status Badge & Row Styling Logic
        if (status === 'Resigned') {
            rowClass = 'row-resigned';
            empBadge = `<span class="badge-status badge-resigned ms-1">RESIGNED</span>`;
        } else if (status === 'Not Employed') {
            rowClass = 'row-not-employed';
            empBadge = `<span class="badge-status badge-not-employed ms-1">NOT EMPLOYED</span>`;
        } else {
            // Employed
            empBadge = `<span class="badge-status badge-emp ms-1">EMPLOYED</span>`;
        }

        const avatar = DriverUI.getAvatarHTML(d.name, d.photo_url);
        
        // Assessment Badge
        let statusBadge = `<span class="badge bg-secondary text-light" style="font-size:0.7rem">Pending</span>`;
        if(d.assessment_status === 'Pass') statusBadge = `<span class="badge-status badge-pass">PASS</span>`;
        if(d.assessment_status === 'Fail') statusBadge = `<span class="badge-status badge-fail">FAIL</span>`;
        
        return `
            <tr class="drv-row border-bottom ${rowClass}">
                <td class="ps-4 py-2">
                    <div class="d-flex align-items-center">
                        ${avatar}
                        <div class="ms-3">
                            <div class="fw-bold text-dark text-truncate" style="max-width: 180px;">${d.name}</div>
                            <div class="mt-1">${statusBadge} ${empBadge}</div>
                            <div class="small text-muted mt-1" style="font-size: 0.75rem;">
                                ${d.vehicles ? `<i class="bi bi-car-front-fill text-primary"></i> ${d.vehicles.name}` : 'Unassigned'}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="d-flex flex-column">
                        <div class="mb-1"><span class="text-label">LIC:</span> <span class="font-mono fw-bold text-dark">${d.license_number}</span></div>
                        <div><span class="text-label">NCII:</span> <span class="font-mono text-secondary">${d.ncii_number || '--'}</span></div>
                    </div>
                </td>
                <td>
                    <div class="small mb-1"><i class="bi bi-phone me-1 text-muted"></i>${d.contact_number || '-'}</div>
                    <div class="small text-muted text-truncate" style="max-width: 150px;" title="${d.address}"><i class="bi bi-geo-alt me-1 text-danger"></i>${d.address || '-'}</div>
                </td>
                <td>
                    <!-- License Validity -->
                    <div class="mb-1 small">
                        <span class="text-label">LIC EXP:</span> 
                        <span class="${licValidity.isExpired && status === 'Employed' ? 'text-danger fw-bold' : (status !== 'Employed' ? 'text-muted' : 'text-success')}">${licValidity.text}</span>
                    </div>
                    <!-- 10 Year Assessment Validity -->
                    <div class="small">
                        <span class="text-label">10Y REM:</span> 
                        <span>${assessValidity}</span>
                    </div>
                </td>
                <td class="text-end pe-4">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-link text-dark p-1" onclick="DriverManager.view('${d.id}')" title="View Details"><i class="bi bi-eye"></i></button>
                        <button class="btn btn-sm btn-link text-primary p-1" onclick="DriverManager.edit('${d.id}')" title="Edit"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-sm btn-link text-danger p-1" onclick="DriverManager.delete('${d.id}')" title="Delete"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    },

    // --- 4. UTILS ---
    
    // Standard Date Diff (for License Expiry)
    calculateDuration: (dateStr) => {
        if (!dateStr) return { text: 'No Data', badgeClass: 'text-muted', isExpired: false };
        
        const today = new Date();
        today.setHours(0,0,0,0);
        const expiry = new Date(dateStr);
        const diff = expiry - today; 
        const isExpired = diff < 0;
        
        const days = Math.ceil(Math.abs(diff) / (1000 * 60 * 60 * 24));
        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);
        
        let text = "";
        if (isExpired) text = `Expired ${years>0?years+'y':days+'d'} ago`;
        else text = `${years>0?years+'y '+months+'m':days+'d'} left`;

        return { text, isExpired };
    },

    // 10-Year Assessment Logic: (Assessment Date + 10 Years) - Today
    calculateTenureRemaining: (assessmentDateStr) => {
        if (!assessmentDateStr) return `<span class="text-muted fst-italic">No Assessment</span>`;

        const assessDate = new Date(assessmentDateStr);
        // Add 10 Years
        const validityEndDate = new Date(assessDate);
        validityEndDate.setFullYear(validityEndDate.getFullYear() + 10);

        const today = new Date();
        today.setHours(0,0,0,0);
        const diff = validityEndDate - today;
        const isExpired = diff < 0;

        const days = Math.ceil(Math.abs(diff) / (1000 * 60 * 60 * 24));
        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);

        if (isExpired) {
            return `<span class="text-danger fw-bold">Overdue by ${years}y ${months}m</span>`;
        } else {
            return `<span class="text-primary fw-bold">${years}y ${months}m remaining</span>`;
        }
    },

    getAvatarHTML: (name, url, isLarge = false) => {
        const cls = isLarge ? 'drv-avatar-lg' : 'drv-avatar';
        const initials = (name || '?').substring(0,2).toUpperCase();
        // Generate consistent color from name
        let hash = 0;
        const str = name || '';
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        const color = "#" + "00000".substring(0, 6 - c.length) + c;
        
        if (url && url.length > 5) {
            return `<img src="${url}" class="${cls}" onerror="this.parentNode.innerHTML='<div class=\\'${cls}\\' style=\\'background-color:${color}\\'>${initials}</div>'">`;
        }
        return `<div class="${cls}" style="background-color:${color}">${initials}</div>`;
    },

    updateFormPreview: (url) => {
        const img = document.getElementById('f_preview_img');
        const hold = document.getElementById('f_preview_placeholder');
        if(url && url.length > 5){ 
            img.src = url; 
            img.classList.remove('d-none'); 
            hold.classList.add('d-none'); 
        } else { 
            img.classList.add('d-none'); 
            hold.classList.remove('d-none'); 
        }
    },

    calcFormExpiry: () => {
        const val = document.getElementById('f_expiry').value;
        const res = DriverUI.calculateDuration(val);
        const status = document.getElementById('f_emp_status').value;
        // Only warn heavily if employed
        const color = res.isExpired ? 'text-danger' : 'text-success';
        document.getElementById('f_expiry_feedback').innerHTML = `<div class="${color} fw-bold mt-1 small"><i class="bi bi-info-circle"></i> ${res.text}</div>`;
    },

    calcFormTenure: () => {
        const val = document.getElementById('f_assessment').value;
        const html = DriverUI.calculateTenureRemaining(val);
        document.getElementById('f_assessment_feedback').innerHTML = `<div class="mt-1 small">${html}</div>`;
    }
};