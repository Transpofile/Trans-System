/**
 * EXTENSION.JS
 * Add-on features for Vehicle Maintenance System
 * Feature: Advanced Duplicate Job Order Detection & Validation
 */

document.addEventListener('DOMContentLoaded', () => {
    initDuplicateCheck();
    hookModalEvents();
});

let debounceTimer;

/**
 * Initializes the input listener with Debouncing
 * Prevents validation from firing on every single keystroke rapidly
 */
function initDuplicateCheck() {
    const orderInput = document.getElementById('orderNumber');
    const orderIdInput = document.getElementById('orderId');

    if (orderInput) {
        // Remove old listeners if any (clean slate) and add new ones
        orderInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            // Wait 300ms after user stops typing to validate
            debounceTimer = setTimeout(() => {
                validateOrderNumber(this.value, orderIdInput.value);
            }, 300);
        });

        // Validate immediately on blur (when clicking away)
        orderInput.addEventListener('blur', function() {
            validateOrderNumber(this.value, orderIdInput.value);
        });
    }
}

/**
 * Checks order number against global allOrders
 * Provides detailed feedback about the conflicting order
 */
function validateOrderNumber(orderNum, currentId) {
    const input = document.getElementById('orderNumber');
    const saveBtn = document.getElementById('btnSave');
    
    // 1. Create or Find Feedback Div
    let feedbackDiv = input.nextElementSibling;
    if (!feedbackDiv || !feedbackDiv.classList.contains('invalid-feedback')) {
        feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'invalid-feedback fw-bold';
        input.parentNode.appendChild(feedbackDiv);
    }

    // 2. Basic Empty Check
    if (!orderNum || orderNum.trim() === "") {
        resetInputState(input, feedbackDiv, saveBtn);
        return;
    }

    // Ensure allOrders exists (from joborders.js)
    if (typeof allOrders === 'undefined') return;

    // 3. Find Duplicate
    // We search for the specific object to get details about it
    const existingOrder = allOrders.find(order => 
        order.order_number.trim().toLowerCase() === orderNum.trim().toLowerCase() && 
        order.id != currentId // Loose equality check for ID
    );

    if (existingOrder) {
        // --- DUPLICATE FOUND ---
        
        // HTML5 Validation (Blocks Submit)
        input.setCustomValidity("Duplicate detected");
        
        // Visual Styling
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        
        // Detailed Error Message
        const dateStr = new Date(existingOrder.date_created).toLocaleDateString();
        feedbackDiv.innerHTML = `
            <i class="bi bi-exclamation-triangle-fill"></i> Duplicate Found!<br>
            Order <strong>${existingOrder.order_number}</strong> is already assigned to:<br>
            <span class="text-dark">${existingOrder.vehicle_name}</span> (${dateStr})
        `;
        feedbackDiv.style.display = 'block';

        // Disable Save Button
        if (saveBtn) saveBtn.disabled = true;

    } else {
        // --- NO DUPLICATE (VALID) ---
        
        // Clear HTML5 Validation
        input.setCustomValidity("");
        
        // Visual Styling
        input.classList.remove('is-invalid');
        input.classList.add('is-valid'); // Adds green border
        
        feedbackDiv.style.display = 'none';

        // Re-enable Save Button
        if (saveBtn) saveBtn.disabled = false;
    }
}

/**
 * Helper to clean up UI states
 */
function resetInputState(input, feedbackDiv, saveBtn) {
    input.setCustomValidity("");
    input.classList.remove('is-invalid');
    input.classList.remove('is-valid');
    if (feedbackDiv) feedbackDiv.style.display = 'none';
    if (saveBtn) saveBtn.disabled = false;
}

/**
 * Hooks into the existing global functions to reset validation 
 * when opening the modal for "New Order" or "Edit"
 */
function hookModalEvents() {
    // 1. Hook into openModal (New Order)
    if (typeof window.openModal === 'function') {
        const originalOpenModal = window.openModal;
        window.openModal = function() {
            originalOpenModal(); // Run original code
            resetValidationUI();
        };
    }

    // 2. Hook into editOrder (Edit Existing)
    if (typeof window.editOrder === 'function') {
        const originalEditOrder = window.editOrder;
        window.editOrder = function(id) {
            originalEditOrder(id); // Run original code
            
            // Wait slightly for the modal values to populate
            setTimeout(() => {
                const orderNum = document.getElementById('orderNumber').value;
                const orderId = document.getElementById('orderId').value;
                // We validate immediately to ensure visual state is correct,
                // but usually, it will show as 'valid' because it ignores itself.
                validateOrderNumber(orderNum, orderId);
            }, 50);
        };
    }
}

/**
 * Global reset for the UI (used when opening New Order)
 */
function resetValidationUI() {
    const input = document.getElementById('orderNumber');
    const saveBtn = document.getElementById('btnSave');
    
    if (input) {
        input.setCustomValidity("");
        input.classList.remove('is-invalid');
        input.classList.remove('is-valid');
        
        const feedbackDiv = input.nextElementSibling;
        if (feedbackDiv && feedbackDiv.classList.contains('invalid-feedback')) {
            feedbackDiv.style.display = 'none';
        }
    }
    
    if (saveBtn) saveBtn.disabled = false;
}