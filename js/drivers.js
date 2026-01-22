/**
 * DRIVERS CONTROLLER V7.0
 * Features: Search, NCII, Notifications, 3-State Employment Status, 10-Year Assessment Logic
 */

const DriverManager = {
    drivers: [],
    vehicles: [],
    modals: {},
    filterState: 'Employed', // Default filter

    // --- 1. INIT ---
    init: async () => {
        DriverUI.injectStyles();
        DriverUI.injectModals();
        DriverManager.injectNavbarItem();

        // Initialize Modals
        const safeModal = (id) => {
            const el = document.getElementById(id);
            return el ? new bootstrap.Modal(el) : null;
        };

        DriverManager.modals.main = safeModal('drvMainModal');
        DriverManager.modals.form = safeModal('drvFormModal');
        DriverManager.modals.view = safeModal('drvViewModal');

        if(DriverManager.modals.main) await DriverManager.fetchData();
    },

    injectNavbarItem: () => {
        const nav = document.querySelector('#navbarContent .navbar-nav');
        if (nav && !document.getElementById('nav-item-drivers')) {
            const li = document.createElement('li');
            li.id = 'nav-item-drivers';
            li.className = 'nav-item';
            li.innerHTML = `<a class="nav-link" href="#" onclick="DriverManager.openMain()"><i class="bi bi-person-badge"></i> Drivers</a>`;
            // Insert after Dashboard (index 0)
            if (nav.children[1]) nav.insertBefore(li, nav.children[1]);
            else nav.appendChild(li);
        }
    },

    // --- 2. DATA ---
    fetchData: async () => {
        try {
            if (typeof supabaseClient === 'undefined') {
                console.error("Supabase client not found.");
                return;
            }

            // Fetch drivers with vehicle details
            const { data: dData, error: dError } = await supabaseClient
                .from('drivers')
                .select('*, vehicles(id, name, plate)')
                .order('name');
            
            const { data: vData, error: vError } = await supabaseClient
                .from('vehicles')
                .select('id, name, plate')
                .order('name');

            if (dError) throw dError;
            if (vError) throw vError;

            DriverManager.drivers = dData || [];
            DriverManager.vehicles = vData || [];
            DriverManager.updateStats();

        } catch (err) { 
            console.error("Driver Data Error:", err); 
            Swal.fire('Error', 'Failed to load driver data.', 'error');
        }
    },

    updateStats: () => {
        const allDrivers = DriverManager.drivers;
        
        // Count specific statuses
        const employed = allDrivers.filter(d => (d.employment_status || 'Employed') === 'Employed');
        const resigned = allDrivers.filter(d => d.employment_status === 'Resigned');
        const notEmployed = allDrivers.filter(d => d.employment_status === 'Not Employed');
        const passed = employed.filter(d => d.assessment_status === 'Pass').length; // Only count passed if employed

        // Calculate Expired Licenses (ONLY for Employed drivers)
        const expired = employed.filter(d => {
            if(!d.license_expiry) return false;
            return new Date(d.license_expiry) < new Date();
        }).length;

        // Update UI Counters
        if(document.getElementById('uiStatEmployed')) document.getElementById('uiStatEmployed').textContent = employed.length;
        if(document.getElementById('uiStatPassed')) document.getElementById('uiStatPassed').textContent = passed;
        if(document.getElementById('uiStatExpired')) document.getElementById('uiStatExpired').textContent = expired;
        
        // Notifications
        const notifyArea = document.getElementById('drvNotificationArea');
        const notifyMsg = document.getElementById('drvNotifyMsg');
        
        if (expired > 0 && notifyArea) {
            notifyArea.classList.remove('d-none');
            notifyMsg.textContent = `Action Required: ${expired} active employed driver(s) have expired licenses.`;
        } else if (notifyArea) {
            notifyArea.classList.add('d-none');
        }
    },

    setFilter: (status) => {
        DriverManager.filterState = status;
        
        // Update button active states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const isSelected = btn.dataset.filter === status;
            btn.classList.toggle('btn-primary', isSelected);
            btn.classList.toggle('btn-outline-secondary', !isSelected);
            
            // Handle specific colors for filter buttons if needed
            if (isSelected) {
                btn.classList.remove('text-dark');
            }
        });
        DriverManager.render();
    },

    render: () => {
        const tbody = document.getElementById('drvTableBody');
        if (!tbody) return;
        
        const search = document.getElementById('drvSearchInput').value.toLowerCase();
        tbody.innerHTML = '';

        // Filter Logic
        const filtered = DriverManager.drivers.filter(d => {
            // 1. Text Search
            const matchesSearch = (d.name || '').toLowerCase().includes(search) ||
                                  (d.license_number || '').toLowerCase().includes(search) ||
                                  (d.ncii_number || '').toLowerCase().includes(search);
            
            // 2. Status Filter
            const empStatus = d.employment_status || 'Employed';
            let matchesFilter = false;

            if (DriverManager.filterState === 'All') matchesFilter = true;
            else matchesFilter = empStatus === DriverManager.filterState;

            return matchesSearch && matchesFilter;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">No records found for: <strong>${DriverManager.filterState}</strong></td></tr>`;
        } else {
            filtered.forEach(d => tbody.innerHTML += DriverUI.generateRow(d));
        }
    },

    // --- 3. ACTIONS ---
    openMain: async () => {
        if(!DriverManager.modals.main) DriverManager.init();
        
        // Show loading spinner while fetching
        Swal.fire({ 
            title: 'Loading Drivers...', 
            didOpen: () => Swal.showLoading(), 
            background: 'transparent', 
            backdrop: 'rgba(0,0,0,0.5)', 
            timer: 500,
            allowOutsideClick: false
        });

        await DriverManager.fetchData();
        DriverManager.setFilter('Employed'); // Reset to Employed on open
        Swal.close();
        DriverManager.modals.main.show();
    },

    openForm: () => {
        const form = document.getElementById('drvForm');
        form.reset();
        form.classList.remove('was-validated');
        
        document.getElementById('f_id').value = '';
        document.getElementById('drvFormTitle').textContent = 'Register New Driver';
        
        // Reset Feedback
        document.getElementById('f_expiry_feedback').innerHTML = '';
        document.getElementById('f_assessment_feedback').innerHTML = '';
        document.getElementById('f_preview_img').classList.add('d-none');
        document.getElementById('f_preview_placeholder').classList.remove('d-none');

        // Defaults
        document.getElementById('f_emp_status').value = 'Employed'; 
        document.getElementById('f_status').value = 'Pending';

        // Populate Vehicles
        const sel = document.getElementById('f_vehicle');
        sel.innerHTML = '<option value="">-- Unassigned --</option>';
        DriverManager.vehicles.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.text = `${v.name} [${v.plate}]`;
            sel.appendChild(opt);
        });

        DriverManager.modals.form.show();
    },

    view: (id) => {
        const d = DriverManager.drivers.find(x => x.id == id);
        if (!d) return;

        // Populate View Modal
        document.getElementById('v_id_hidden').value = d.id;
        document.getElementById('v_name').textContent = d.name;
        document.getElementById('v_avatar_container').innerHTML = DriverUI.getAvatarHTML(d.name, d.photo_url, true);
        
        // Status Badges
        let assessHtml = `<span class="badge bg-secondary me-1">Pending</span>`;
        if(d.assessment_status === 'Pass') assessHtml = `<span class="badge bg-success me-1">PASS</span>`;
        if(d.assessment_status === 'Fail') assessHtml = `<span class="badge bg-danger me-1">FAIL</span>`;
        
        const empStatus = d.employment_status || 'Employed';
        let empHtml = '';
        if(empStatus === 'Employed') empHtml = `<span class="badge bg-primary">Employed</span>`;
        else if(empStatus === 'Resigned') empHtml = `<span class="badge bg-warning text-dark">Resigned</span>`;
        else empHtml = `<span class="badge bg-dark">Not Employed</span>`;

        document.getElementById('v_status_badge').innerHTML = assessHtml + empHtml;

        // Vehicle
        document.getElementById('v_vehicle_display').innerHTML = d.vehicles 
            ? `<span class="text-primary fw-bold"><i class="bi bi-car-front-fill"></i> ${d.vehicles.name}</span> <span class="text-muted small">(${d.vehicles.plate})</span>` 
            : '<span class="text-muted">No vehicle assigned</span>';

        // Data fields
        const safeTxt = (val) => val || '-';
        document.getElementById('v_license').textContent = safeTxt(d.license_number);
        document.getElementById('v_ncii').textContent = safeTxt(d.ncii_number);
        document.getElementById('v_contact').textContent = safeTxt(d.contact_number);
        document.getElementById('v_issued').textContent = safeTxt(d.license_date_issued);
        document.getElementById('v_address').textContent = safeTxt(d.address);
        document.getElementById('v_assess_date').textContent = safeTxt(d.assessment_date);
        document.getElementById('v_notes').textContent = d.notes || 'No notes.';
        document.getElementById('v_expiry').textContent = safeTxt(d.license_expiry);

        // Logic
        const licValidity = DriverUI.calculateDuration(d.license_expiry);
        document.getElementById('v_validity_text').innerHTML = `<span class="${licValidity.isExpired ? 'text-danger fw-bold' : 'text-success fw-bold'}">${licValidity.text}</span>`;

        const tenYearValidity = DriverUI.calculateTenureRemaining(d.assessment_date);
        document.getElementById('v_tenure_text').innerHTML = tenYearValidity;

        DriverManager.modals.view.show();
    },

    editFromView: () => {
        const id = document.getElementById('v_id_hidden').value;
        DriverManager.modals.view.hide();
        DriverManager.edit(id);
    },

    edit: (id) => {
        const d = DriverManager.drivers.find(x => x.id == id);
        if (!d) return;

        DriverManager.openForm();
        document.getElementById('drvFormTitle').textContent = 'Edit Driver Details';
        document.getElementById('f_id').value = d.id;
        document.getElementById('f_name').value = d.name;
        document.getElementById('f_emp_status').value = d.employment_status || 'Employed';
        document.getElementById('f_status').value = d.assessment_status || 'Pending';
        document.getElementById('f_license').value = d.license_number;
        document.getElementById('f_ncii').value = d.ncii_number || '';
        document.getElementById('f_date_issued').value = d.license_date_issued || '';
        document.getElementById('f_expiry').value = d.license_expiry || '';
        document.getElementById('f_assessment').value = d.assessment_date || '';
        document.getElementById('f_contact').value = d.contact_number || '';
        document.getElementById('f_address').value = d.address || '';
        document.getElementById('f_vehicle').value = d.assigned_vehicle_id || '';
        document.getElementById('f_photo').value = d.photo_url || '';
        document.getElementById('f_notes').value = d.notes || '';

        DriverUI.updateFormPreview(d.photo_url);
        DriverUI.calcFormExpiry();
        DriverUI.calcFormTenure();
    },

    save: async () => {
        const form = document.getElementById('drvForm');
        if (!form.checkValidity()) { 
            form.classList.add('was-validated'); 
            return; 
        }

        const id = document.getElementById('f_id').value;
        const data = {
            name: document.getElementById('f_name').value.trim(),
            employment_status: document.getElementById('f_emp_status').value, 
            assessment_status: document.getElementById('f_status').value,
            license_number: document.getElementById('f_license').value.trim().toUpperCase(),
            ncii_number: document.getElementById('f_ncii').value.trim().toUpperCase(),
            license_date_issued: document.getElementById('f_date_issued').value || null,
            license_expiry: document.getElementById('f_expiry').value || null,
            assessment_date: document.getElementById('f_assessment').value || null,
            contact_number: document.getElementById('f_contact').value.trim(),
            address: document.getElementById('f_address').value.trim(),
            assigned_vehicle_id: document.getElementById('f_vehicle').value || null,
            photo_url: document.getElementById('f_photo').value.trim(),
            notes: document.getElementById('f_notes').value.trim()
        };

        const btn = document.querySelector('#drvFormModal .btn-primary');
        const oldText = btn.innerHTML;
        btn.disabled = true; 
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            // Check for License duplicate if new
            if (!id) {
                const existing = DriverManager.drivers.find(d => d.license_number === data.license_number);
                if (existing) throw new Error(`License Number ${data.license_number} already exists.`);
            }

            const { error } = id 
                ? await supabaseClient.from('drivers').update(data).eq('id', id)
                : await supabaseClient.from('drivers').insert([data]);

            if (error) throw error;
            
            DriverManager.modals.form.hide();
            Swal.fire({ 
                icon: 'success', 
                title: 'Saved Successfully', 
                toast: true, 
                position: 'top-end', 
                showConfirmButton: false, 
                timer: 1500 
            });
            await DriverManager.fetchData();
            // If we changed status, the current filter might hide the row, so render updates
            DriverManager.render();
        } catch (err) { 
            Swal.fire('Save Failed', err.message, 'error'); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = oldText; 
        }
    },

    delete: async (id) => {
        const d = DriverManager.drivers.find(x => x.id == id);
        const res = await Swal.fire({ 
            title: `Delete ${d.name}?`, 
            text: "This cannot be undone.", 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });
        
        if (res.isConfirmed) {
            const { error } = await supabaseClient.from('drivers').delete().eq('id', id);
            if (!error) { 
                await DriverManager.fetchData(); 
                DriverManager.render(); 
                Swal.fire('Deleted', 'Driver has been removed.', 'success'); 
            } else {
                Swal.fire('Error', error.message, 'error');
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { 
    // Delay slightly to ensure Supabase and Main JobOrder logic is ready
    setTimeout(() => DriverManager.init(), 500); 
});