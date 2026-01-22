/** 
 * CONFIGURATION 
 */
const SUPABASE_URL = 'https://hbkitssxgajgncavxqng.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia2l0c3N4Z2FqZ25jYXZ4cW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjE0OTksImV4cCI6MjA4MDQzNzQ5OX0.qLoTUj8nqQuE0W-6g5DBdEiRhjDb1KfzBd2zEHPaJbE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allOrders = [];
let vehicleList = [];
let currentTab = 'General';
let trendChart = null;

// Initialize Bootstrap Modals globally
const orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
const viewModal = new bootstrap.Modal(document.getElementById('viewModal'));
const vehicleModal = new bootstrap.Modal(document.getElementById('vehicleModal'));
const logsModal = new bootstrap.Modal(document.getElementById('logsModal'));

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    startClock();
    
    // Initial Load
    await fetchVehicles();
    await fetchData();

    // Remove loading screen
    const loader = document.getElementById('loadingOverlay');
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 500);

    // Auto-Calculate Next Odometer
    document.getElementById('odometerCurrent').addEventListener('input', function() {
        const current = parseInt(this.value);
        document.getElementById('odometerNext').value = !isNaN(current) ? current + 5000 : '';
    });
});

// --- CORE DATA FETCHING ---
async function fetchData() {
    try {
        const { data, error } = await supabaseClient
            .from('maintenance_orders')
            .select('*')
            .order('date_created', { ascending: false });
        
        if (error) throw error;
        allOrders = data || [];
        renderTable();
        updateDashboard();
    } catch (err) {
        console.error("Fetch Error:", err);
        Swal.fire('Connection Error', 'Could not load data. Check console.', 'error');
    }
}

async function fetchVehicles() {
    const { data, error } = await supabaseClient.from('vehicles').select('*').order('name');
    if (!error) vehicleList = data || [];
}

// --- TABLE RENDER LOGIC ---
function renderTable() {
    const tbody = document.getElementById('tableBody');
    const search = document.getElementById('searchInput').value.toLowerCase();
    tbody.innerHTML = '';

    const filtered = allOrders.filter(o => o.category === currentTab &&
        (o.vehicle_name + o.plate_number + o.order_number + o.status).toLowerCase().includes(search));

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-1 d-block"></i>No records found</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        let statusBg = 'bg-soft-secondary';
        if (item.status === 'Pending') statusBg = 'bg-soft-warning';
        if (item.status === 'Ongoing') statusBg = 'bg-soft-info';
        if (item.status === 'Completed') statusBg = 'bg-soft-success';

        // Parse JSON for display summary
        let descDisplay = "No details";
        if (item.particulars) {
            if (item.particulars.startsWith("JSON:")) {
                try {
                    const items = JSON.parse(item.particulars.substring(5));
                    const names = items.map(i => `${i.desc} (x${i.qty})`);
                    descDisplay = names.slice(0, 2).join(', ');
                    if (names.length > 2) descDisplay += ` +${names.length - 2} more`;
                } catch (e) { descDisplay = "Data Error"; }
            } else {
                descDisplay = item.particulars; // Legacy plain text
            }
        }

        // Odometer Badge
        if (item.category === 'PMS Change Oil' && item.odometer_current) {
            descDisplay += `<div class="mt-1"><span class="badge bg-light text-primary border">Odo: ${item.odometer_current} km</span></div>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
             <td class="fw-bold text-primary">${item.order_number || 'N/A'}</td>
             <td>${item.date_created || '-'}</td>
             <td>${item.vehicle_name || 'Unknown'}</td>
             <td><span class="badge bg-light text-dark border">${item.plate_number || '-'}</span></td>
             <td style="max-width: 250px;">
                <div class="text-truncate" title="${descDisplay}">${descDisplay}</div>
             </td>
             <td class="text-end fw-bold">${formatCurrency(item.amount)}</td>
             <td class="text-center"><span class="badge ${statusBg}">${item.status}</span></td>
             <td class="text-end no-print">
                 <div class="btn-group shadow-sm" role="group">
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="viewDetails('${item.id}')" title="View">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-warning" onclick="editOrder('${item.id}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteOrder('${item.id}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                 </div>
             </td>`;
        tbody.appendChild(tr);
    });
}

// --- FUNCTIONAL VIEW DETAILS (Fix) ---
function viewDetails(id) {
    // Find item securely
    const item = allOrders.find(o => o.id == id); // Use loose equality == to match string/int types
    if (!item) {
        Swal.fire('Error', 'Order not found in memory. Refresh page.', 'error');
        return;
    }

    document.getElementById('viewAmount').innerText = formatCurrency(item.amount);
    document.getElementById('viewOrderNum').textContent = item.order_number;
    document.getElementById('viewDate').textContent = item.date_created;
    document.getElementById('viewVehicle').textContent = item.vehicle_name;
    document.getElementById('viewPlate').textContent = item.plate_number;

    const odoRow = document.getElementById('viewOdometerRow');
    if (item.category === 'PMS Change Oil' && item.odometer_current) {
        odoRow.classList.remove('d-none');
        odoRow.classList.add('d-flex');
        document.getElementById('viewOdoCurrent').textContent = item.odometer_current + " km";
        document.getElementById('viewOdoNext').textContent = item.odometer_next + " km";
    } else {
        odoRow.classList.add('d-none');
        odoRow.classList.remove('d-flex');
    }

    const badge = document.getElementById('viewStatusBadge');
    badge.className = `badge rounded-pill ${item.status==='Pending'?'bg-warning text-dark':item.status==='Ongoing'?'bg-info':'bg-success'}`;
    badge.innerText = item.status;

    // Items Table
    const tbody = document.getElementById('viewItemsTable');
    tbody.innerHTML = '';

    if (item.particulars && item.particulars.startsWith("JSON:")) {
        try {
            const items = JSON.parse(item.particulars.substring(5));
            items.forEach(i => {
                const sub = (i.qty * i.price);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${i.desc}</td><td class="text-end">${i.qty}</td><td class="text-end">${formatCurrency(i.price)}</td><td class="text-end fw-bold">${formatCurrency(sub)}</td>`;
                tbody.appendChild(tr);
            });
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-danger">Error loading item details</td></tr>';
        }
    } else {
        // Legacy support
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.particulars}</td><td class="text-end">${item.quantity || 1}</td><td class="text-end">-</td><td class="text-end fw-bold">${formatCurrency(item.amount)}</td>`;
        tbody.appendChild(tr);
    }

    viewModal.show();
}

// --- FUNCTIONAL EDIT ORDER (Fix) ---
function editOrder(id) {
    const order = allOrders.find(o => o.id == id);
    if (!order) return;

    document.getElementById('orderId').value = order.id;
    document.getElementById('orderNumber').value = order.order_number;
    document.getElementById('category').value = order.category;
    document.getElementById('dateCreated').value = order.date_created;
    document.getElementById('status').value = order.status;

    // Vehicle Select
    populateVehicleSelect();
    const select = document.getElementById('vehicleSelect');
    // Try match by name or plate if ID is missing (legacy data)
    let match = Array.from(select.options).find(opt => opt.dataset.plate === order.plate_number);
    if (match) select.value = match.value;
    
    document.getElementById('vehicleName').value = order.vehicle_name;
    document.getElementById('plateNumber').value = order.plate_number;

    toggleOdometerFields();
    if (order.category === 'PMS Change Oil') {
        document.getElementById('odometerCurrent').value = order.odometer_current || '';
        document.getElementById('odometerNext').value = order.odometer_next || '';
    }

    // Populate Items
    const tbody = document.getElementById('orderItemsBody');
    tbody.innerHTML = ''; 
    
    if (order.particulars && order.particulars.startsWith("JSON:")) {
        try {
            const items = JSON.parse(order.particulars.substring(5));
            items.forEach(i => addOrderItem(i.desc, i.qty, i.price));
        } catch (e) {
            addOrderItem("Error parsing items", 1, 0);
        }
    } else {
        const total = parseFloat(order.amount) || 0;
        const qty = parseInt(order.quantity) || 1;
        const uPrice = qty > 0 ? (total/qty).toFixed(2) : 0;
        addOrderItem(order.particulars, qty, uPrice);
    }

    document.getElementById('modalTitle').innerText = 'Edit Order';
    document.getElementById('btnSaveText').textContent = 'Update Order';
    calculateModalTotal();
    orderModal.show();
}

// --- SAVE ORDER (Create/Update) ---
async function saveOrder() {
    const form = document.getElementById('orderForm');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const btn = document.getElementById('btnSave');
    const spinner = document.getElementById('btnSaveSpinner');
    btn.disabled = true;
    spinner.classList.remove('d-none');

    // Collect Items
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const desc = row.querySelector('.item-desc').value;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const cost = parseFloat(row.querySelector('.item-cost').value) || 0;
        if (desc) items.push({ desc, qty, price: cost, subtotal: qty * cost });
    });

    const grandTotal = calculateModalTotal();
    const id = document.getElementById('orderId').value;
    const cat = document.getElementById('category').value;
    
    const data = {
        order_number: document.getElementById('orderNumber').value,
        category: cat,
        date_created: document.getElementById('dateCreated').value,
        vehicle_name: document.getElementById('vehicleName').value,
        plate_number: document.getElementById('plateNumber').value,
        particulars: "JSON:" + JSON.stringify(items), 
        quantity: items.length,
        amount: grandTotal, 
        status: document.getElementById('status').value
    };

    if (cat === 'PMS Change Oil') {
        data.odometer_current = document.getElementById('odometerCurrent').value || null;
        data.odometer_next = document.getElementById('odometerNext').value || null;
    } else {
        data.odometer_current = null;
        data.odometer_next = null;
    }

    let error;
    try {
        if (id) {
            ({ error } = await supabaseClient.from('maintenance_orders').update(data).eq('id', id));
        } else {
            ({ error } = await supabaseClient.from('maintenance_orders').insert([data]));
        }

        if (error) throw error;

        orderModal.hide();
        Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
        fetchData();
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('d-none');
    }
}

// --- DELETE ---
async function deleteOrder(id) {
    const res = await Swal.fire({
        title: 'Delete Order?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    });

    if (res.isConfirmed) {
        const { error } = await supabaseClient.from('maintenance_orders').delete().eq('id', id);
        if (!error) {
            Swal.fire('Deleted!', '', 'success');
            fetchData();
        } else {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// --- MODAL HELPERS ---
function openModal() {
    document.getElementById('orderForm').reset();
    document.getElementById('orderForm').classList.remove('was-validated');
    document.getElementById('orderId').value = '';
    document.getElementById('category').value = currentTab;
    document.getElementById('dateCreated').valueAsDate = new Date();
    document.getElementById('modalTitle').innerText = 'Create New Order';
    document.getElementById('btnSaveText').textContent = 'Save Order';
    populateVehicleSelect();
    toggleOdometerFields();
    document.getElementById('orderItemsBody').innerHTML = '';
    addOrderItem(); 
    calculateModalTotal();
    orderModal.show();
}

function addOrderItem(desc = '', qty = 1, cost = '') {
    const tbody = document.getElementById('orderItemsBody');
    const row = document.createElement('tr');
    row.className = 'item-row';
    row.innerHTML = `
         <td><input type="text" class="form-control form-control-sm item-desc" value="${desc}" placeholder="Item name" required></td>
         <td><input type="number" class="form-control form-control-sm item-qty" value="${qty}" min="1" required oninput="calculateModalTotal()"></td>
         <td><input type="number" class="form-control form-control-sm item-cost" value="${cost}" step="0.01" placeholder="0.00" required oninput="calculateModalTotal()"></td>
         <td class="text-end align-middle"><span class="item-subtotal fw-bold">0.00</span></td>
         <td class="text-center align-middle"><button type="button" class="btn btn-link btn-sm text-danger p-0" onclick="removeOrderItem(this)"><i class="bi bi-x-lg"></i></button></td>
     `;
    tbody.appendChild(row);
    calculateModalTotal(); 
}

function removeOrderItem(btn) {
    const tbody = document.getElementById('orderItemsBody');
    if (tbody.children.length > 1) {
        btn.closest('tr').remove();
        calculateModalTotal();
    } else {
        const row = btn.closest('tr');
        row.querySelector('.item-desc').value = '';
        row.querySelector('.item-qty').value = 1;
        row.querySelector('.item-cost').value = '';
        calculateModalTotal();
    }
}

function calculateModalTotal() {
    let grandTotal = 0;
    document.querySelectorAll('.item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const cost = parseFloat(row.querySelector('.item-cost').value) || 0;
        const sub = qty * cost;
        row.querySelector('.item-subtotal').innerText = sub.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        grandTotal += sub;
    });
    document.getElementById('modalGrandTotal').innerText = formatCurrency(grandTotal);
    return grandTotal;
}

// --- UTILS ---
function formatCurrency(val) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);
}
function switchTab(e, tab) {
    e.preventDefault();
    currentTab = tab;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    e.target.classList.add('active');
    renderTable();
}
function toggleOdometerFields() {
    const cat = document.getElementById('category').value;
    document.getElementById('odometerSection').style.display = (cat === 'PMS Change Oil') ? 'block' : 'none';
}
function populateVehicleSelect() {
    const select = document.getElementById('vehicleSelect');
    select.innerHTML = '<option value="">-- Choose Vehicle --</option>';
    vehicleList.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.text = `${v.name} (${v.plate})`;
        opt.dataset.name = v.name;
        opt.dataset.plate = v.plate;
        select.appendChild(opt);
    });
}
function onVehicleSelect() {
    const sel = document.getElementById('vehicleSelect');
    const opt = sel.options[sel.selectedIndex];
    document.getElementById('plateNumber').value = opt.value ? opt.dataset.plate : '';
    document.getElementById('vehicleName').value = opt.value ? opt.dataset.name : '';
}

// --- VEHICLE MASTER ---
function openVehicleMaster() { renderVehicleTable(); vehicleModal.show(); }
function renderVehicleTable() {
    const tbody = document.getElementById('vehicleTableBody');
    tbody.innerHTML = '';
    vehicleList.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><div class="fw-bold">${v.name}</div><small class="text-muted">${v.type||''}</small></td>
             <td><span class="badge bg-light text-dark border">${v.plate}</span></td>
             <td class="text-end"><button class="btn btn-sm btn-link text-primary" onclick='editVehicle(${JSON.stringify(v)})'><i class="bi bi-pencil"></i></button>
             <button class="btn btn-sm btn-link text-danger" onclick="deleteVehicle(${v.id})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(tr);
    });
}
function resetVehicleForm() { document.getElementById('vehicleForm').reset(); document.getElementById('vm_id').value = ''; }
function editVehicle(v) {
    document.getElementById('vm_id').value = v.id;
    document.getElementById('vm_name').value = v.name;
    document.getElementById('vm_type').value = v.type;
    document.getElementById('vm_plate').value = v.plate;
}
async function saveVehicle() {
    const id = document.getElementById('vm_id').value;
    const data = {
        name: document.getElementById('vm_name').value,
        type: document.getElementById('vm_type').value,
        plate: document.getElementById('vm_plate').value
    };
    if (!data.name || !data.plate) { Swal.fire('Error', 'Name/Plate required', 'error'); return; }
    let error;
    if (id) ({ error } = await supabaseClient.from('vehicles').update(data).eq('id', id));
    else ({ error } = await supabaseClient.from('vehicles').insert([data]));
    if (!error) { resetVehicleForm(); await fetchVehicles(); renderVehicleTable(); } 
    else Swal.fire('Error', error.message, 'error');
}
async function deleteVehicle(id) {
    if (!confirm('Delete?')) return;
    const { error } = await supabaseClient.from('vehicles').delete().eq('id', id);
    if (!error) { await fetchVehicles(); renderVehicleTable(); }
}

// --- EXTRAS ---
function startClock() {
    function update() {
        const now = new Date();
        const str = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + " | " + now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
        document.getElementById('headerClock').innerText = str;
        document.getElementById('mobileClock').innerText = str;
    }
    setInterval(update, 1000); update();
}
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    document.getElementById('themeIcon').className = savedTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('themeIcon').className = newTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}
function updateDashboard() {
    document.getElementById('totalCount').innerText = allOrders.length;
    const cy = new Date().getFullYear();
    const yData = allOrders.filter(o => new Date(o.date_created).getFullYear() === cy);
    const calcTotal = (cat) => yData.filter(o => o.category === cat).reduce((s, o) => s + parseFloat(o.amount || 0), 0);
    document.getElementById('totalGeneralYear').innerText = formatCurrency(calcTotal('General'));
    document.getElementById('totalOilYear').innerText = formatCurrency(calcTotal('PMS Change Oil'));
    document.getElementById('totalAirconYear').innerText = formatCurrency(calcTotal('PMS Aircon'));
    renderChart(yData);
}
function renderChart(data) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const dGen = new Array(12).fill(0), dOil = new Array(12).fill(0), dAir = new Array(12).fill(0);
    data.forEach(o => {
        const m = new Date(o.date_created).getMonth();
        const amt = parseFloat(o.amount || 0);
        if (o.category === 'General') dGen[m] += amt;
        else if (o.category === 'PMS Change Oil') dOil[m] += amt;
        else if (o.category === 'PMS Aircon') dAir[m] += amt;
    });
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
                { label: 'General', data: dGen, borderColor: '#4361ee', tension: 0.3 },
                { label: 'Change Oil', data: dOil, borderColor: '#ffb703', tension: 0.3 },
                { label: 'Aircon', data: dAir, borderColor: '#4cc9f0', tension: 0.3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } }
        }
    });
}
function exportExcel() {
    const data = allOrders.filter(o => o.category === currentTab).map(o => {
        let desc = o.particulars;
        if (desc.startsWith("JSON:")) try { desc = JSON.parse(desc.substring(5)).map(i => `${i.desc} (x${i.qty})`).join(', '); } catch (e) {}
        return { "Order No": o.order_number, "Date": o.date_created, "Vehicle": o.vehicle_name, "Plate": o.plate_number, "Particulars": desc, "Amount": parseFloat(o.amount), "Status": o.status };
    });
    if (!data.length) return Swal.fire('Warning', 'No data', 'warning');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${currentTab}_Report.xlsx`);
}
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = allOrders.filter(o => o.category === currentTab).map(o => {
        let desc = o.particulars;
        if (desc.startsWith("JSON:")) try { desc = JSON.parse(desc.substring(5)).map(i => `${i.desc}`).join('\n'); } catch (e) {}
        return [o.order_number, o.date_created, o.vehicle_name, desc, parseFloat(o.amount).toFixed(2), o.status];
    });
    doc.autoTable({ head: [['Order #', 'Date', 'Vehicle', 'Particulars', 'Amount', 'Status']], body: data, startY: 20 });
    doc.save(`${currentTab}_Report.pdf`);
}
function exportWord() { exportExcel(); }
async function showLogs() {
    const { data } = await supabaseClient.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(20);
    const list = document.getElementById('logsList');
    list.innerHTML = '';
    (data || []).forEach(log => {
        list.innerHTML += `<li class="list-group-item"><strong>${log.action}</strong> <small class="text-muted">${new Date(log.timestamp).toLocaleString()}</small><br><small>${log.details}</small></li>`;
    });
    logsModal.show();
}