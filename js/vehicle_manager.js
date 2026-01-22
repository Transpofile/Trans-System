/** 
 * VEHICLE MANAGER - FAST LOAD VERSION
 * Prioritizes showing the vehicle list immediately.
 */

const SUPABASE_URL = 'https://hbkitssxgajgncavxqng.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia2l0c3N4Z2FqZ25jYXZ4cW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjE0OTksImV4cCI6MjA4MDQzNzQ5OX0.qLoTUj8nqQuE0W-6g5DBdEiRhjDb1KfzBd2zEHPaJbE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let vehicleData = [];
let maintenanceData = []; 
const modal = new bootstrap.Modal(document.getElementById('vehicleMasterModal'));
let costChartInstance = null;
let typeChartInstance = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Force remove loader after 2 seconds (Fail-safe)
    setTimeout(hideLoader, 2000);
    
    // 2. Start Loading Data
    initData();
});

function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 300);
    }
}

async function initData() {
    // Step 1: Get Vehicles (Critical) - Render immediately
    await fetchVehicles();
    
    // Step 2: Get Costs (Optional) - Load in background
    fetchCostsBackground();
}

// --- FETCH VEHICLES (CRITICAL) ---
async function fetchVehicles() {
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .order('name');
        
        if (error) {
            console.error("Vehicle Fetch Error:", error.message);
            Swal.fire('Error', 'Could not load vehicle list.', 'error');
        }

        vehicleData = data || [];
        renderVehicleList(); // Render basic list (without costs yet)
        updateDashboardCountsOnly(); // Show simple counts

    } catch (err) {
        console.error(err);
    } finally {
        hideLoader(); // Remove loading screen now!
    }
}

// --- FETCH COSTS (BACKGROUND) ---
async function fetchCostsBackground() {
    try {
        const { data, error } = await supabase
            .from('maintenance_orders')
            .select('plate_number, amount, status');

        if (!error && data) {
            maintenanceData = data;
            // Now re-process everything with cost data included
            processVehicleCosts(); 
            updateDashboardFull();
            renderCharts();
            renderVehicleList(); // Re-render table with prices
        }
    } catch (err) {
        console.warn("Cost data could not be loaded (Ignored)", err);
    }
}

// --- DATA PROCESSING ---
function processVehicleCosts() {
    vehicleData.forEach(v => {
        // Match plates to calculate total spend per vehicle
        const total = maintenanceData
            .filter(o => o.plate_number && v.plate && o.plate_number.toUpperCase() === v.plate.toUpperCase())
            .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        v.total_spend = total;
    });
}

// --- RENDER TABLE ---
function renderVehicleList() {
    const tbody = document.getElementById('vehicleTableBody');
    const search = document.getElementById('vehicleSearch').value.toLowerCase();
    tbody.innerHTML = '';

    const filtered = vehicleData.filter(v => 
        (v.name + v.plate + (v.or_number||'') + (v.type||'')).toLowerCase().includes(search)
    );

    filtered.forEach(v => {
        // Expiry Status
        let regBadge = '<span class="badge bg-light text-muted border">-</span>';
        if (v.registration_expiry) {
            const today = new Date();
            const expiry = new Date(v.registration_expiry);
            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24)); 
            
            if (diffDays < 0) regBadge = `<span class="badge bg-soft-danger">Expired</span>`;
            else if (diffDays < 30) regBadge = `<span class="badge bg-soft-warning">Expiring Soon</span>`;
            else regBadge = `<span class="badge bg-soft-success">Active</span>`;
        }

        const imgData = v.image_data || 'https://via.placeholder.com/60?text=Car';
        // Check if total_spend exists yet, if not show 0
        const spend = v.total_spend ? formatCurrency(v.total_spend) : '₱0.00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="d-flex align-items-center gap-3">
                    <img src="${imgData}" class="vehicle-img-thumb" alt="Car">
                    <div class="fw-bold text-dark">${v.name}</div>
                </div>
            </td>
            <td><span class="badge bg-light text-dark border fs-6 fw-bold">${v.plate}</span></td>
            <td>${v.type || '-'}</td>
            <td>
                <div class="fw-bold text-primary">${parseInt(v.current_odometer || 0).toLocaleString()} km</div>
            </td>
            <td>${regBadge}</td>
            <td class="text-end fw-bold text-secondary">${spend}</td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary border-0 me-1" onclick="editVehicle('${v.id}')"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteVehicle('${v.id}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">No vehicles found.</td></tr>`;
    }
}

// --- DASHBOARD UPDATES ---
function updateDashboardCountsOnly() {
    document.getElementById('dashTotalVehicles').textContent = vehicleData.length;
}

function updateDashboardFull() {
    // Expiring
    const today = new Date();
    const expiringCount = vehicleData.filter(v => {
        if (!v.registration_expiry) return false;
        const diffDays = Math.ceil((new Date(v.registration_expiry) - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
    }).length;
    document.getElementById('dashExpiring').textContent = expiringCount;

    // Active Orders
    const activeOrders = maintenanceData.filter(o => o.status === 'Pending' || o.status === 'Ongoing').length;
    document.getElementById('dashActiveOrders').textContent = activeOrders;

    // Total Spend
    const totalSpend = maintenanceData.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
    document.getElementById('dashTotalSpend').textContent = formatCurrency(totalSpend);
}

// --- CHARTS ---
function renderCharts() {
    const ctxCost = document.getElementById('costChart');
    const ctxType = document.getElementById('typeChart');
    
    if (!ctxCost || !ctxType) return; // Charts might not exist in DOM

    // Chart 1: Costs
    const sortedByCost = [...vehicleData].sort((a, b) => (b.total_spend||0) - (a.total_spend||0)).slice(0, 5);
    
    if (costChartInstance) costChartInstance.destroy();
    costChartInstance = new Chart(ctxCost.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedByCost.map(v => v.name),
            datasets: [{
                label: 'Cost (₱)',
                data: sortedByCost.map(v => v.total_spend || 0),
                backgroundColor: '#4361ee',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Chart 2: Types
    const typeCounts = {};
    vehicleData.forEach(v => { typeCounts[v.type || 'Other'] = (typeCounts[v.type || 'Other'] || 0) + 1; });

    if (typeChartInstance) typeChartInstance.destroy();
    typeChartInstance = new Chart(ctxType.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{
                data: Object.values(typeCounts),
                backgroundColor: ['#4361ee', '#3f37c9', '#4cc9f0', '#f72585', '#06d6a0', '#ffb703']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } }
        }
    });
}

// --- CRUD OPERATIONS ---
function openVehicleModal() {
    document.getElementById('vehicleForm').reset();
    document.getElementById('v_id').value = '';
    document.getElementById('imgPreview').src = 'https://via.placeholder.com/300x200?text=Upload+Image';
    document.getElementById('vmTitle').textContent = 'Add New Vehicle';
    modal.show();
}

function editVehicle(id) {
    const v = vehicleData.find(x => x.id == id);
    if (!v) return;

    document.getElementById('v_id').value = v.id;
    document.getElementById('v_name').value = v.name;
    document.getElementById('v_plate').value = v.plate;
    document.getElementById('v_type').value = v.type || 'Van';
    document.getElementById('v_odometer').value = v.current_odometer || 0;
    document.getElementById('v_odo_date').value = v.odometer_last_updated || '';
    document.getElementById('v_or').value = v.or_number || '';
    document.getElementById('v_cr').value = v.cr_number || '';
    document.getElementById('v_expiry').value = v.registration_expiry || '';
    document.getElementById('imgPreview').src = v.image_data || 'https://via.placeholder.com/300x200?text=Upload+Image';
    document.getElementById('vmTitle').textContent = 'Edit Vehicle';
    modal.show();
}

async function saveVehicleMaster() {
    const id = document.getElementById('v_id').value;
    const imgSrc = document.getElementById('imgPreview').src;
    const finalImg = imgSrc.includes('via.placeholder') ? null : imgSrc;

    const data = {
        name: document.getElementById('v_name').value,
        plate: document.getElementById('v_plate').value,
        type: document.getElementById('v_type').value,
        current_odometer: document.getElementById('v_odometer').value || 0,
        odometer_last_updated: document.getElementById('v_odo_date').value || null,
        or_number: document.getElementById('v_or').value,
        cr_number: document.getElementById('v_cr').value,
        registration_expiry: document.getElementById('v_expiry').value || null,
        image_data: finalImg
    };

    if (!data.name || !data.plate) {
        Swal.fire('Error', 'Name and Plate are required', 'warning');
        return;
    }

    Swal.fire({title: 'Saving...', didOpen: () => Swal.showLoading()});
    let error;

    if (id) ({ error } = await supabase.from('vehicles').update(data).eq('id', id));
    else ({ error } = await supabase.from('vehicles').insert([data]));

    if (error) Swal.fire('Error', error.message, 'error');
    else {
        Swal.fire({ icon: 'success', title: 'Saved!', timer: 1000, showConfirmButton: false });
        modal.hide();
        fetchVehicles(); // Reload list
    }
}

async function deleteVehicle(id) {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (!error) fetchVehicles();
    else Swal.fire('Error', error.message, 'error');
}

// --- UTILS ---
function updateOdoDate() { document.getElementById('v_odo_date').valueAsDate = new Date(); }
function formatCurrency(val) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0); }
function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 1000000) { Swal.fire('Too Large', 'Max 1MB', 'warning'); return; }
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('imgPreview').src = e.target.result;
        reader.readAsDataURL(file);
    }
}

// --- EXPORT (Keep existing functions) ---
function exportVehiclesExcel() { /* Same as before */ }
function exportVehiclesPDF() { /* Same as before */ }