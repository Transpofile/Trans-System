/**
 * SIDEBAR EXTENSION (Enhanced)
 * Injects a sidebar menu, handles toggle functionality, state persistence,
 * and manages view switching.
 */

class SidebarManager {
    constructor() {
        this.config = {
            sidebarId: 'mainSidebar',
            toggleBtnId: 'sidebarToggleBtn',
            backdropId: 'sidebarBackdrop',
            width: '260px',
            storageKey: 'active_sidebar_view'
        };
        
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.injectStyles();
        this.injectHTML();
        this.setupEvents();
        this.restoreState();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            :root {
                --sb-width: ${this.config.width};
                --sb-bg: #212529;
                --sb-hover: #343a40;
                --sb-active: #0d6efd; /* Bootstrap Primary */
                --sb-text: rgba(255,255,255,0.8);
                --z-sidebar: 1040;
                --z-backdrop: 1035;
            }

            body {
                transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            body.sidebar-open {
                margin-left: var(--sb-width);
            }

            /* Main Sidebar Container */
            #${this.config.sidebarId} {
                height: 100vh;
                width: var(--sb-width);
                position: fixed;
                top: 0;
                left: calc(var(--sb-width) * -1);
                background-color: var(--sb-bg);
                z-index: var(--z-sidebar);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 4px 0 15px rgba(0,0,0,0.15);
                display: flex;
                flex-direction: column;
                padding-top: 1rem;
            }

            #${this.config.sidebarId}.active {
                transform: translateX(var(--sb-width));
            }

            /* Backdrop for Mobile */
            .sidebar-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                z-index: var(--z-backdrop);
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease;
            }

            .sidebar-backdrop.show {
                opacity: 1;
                visibility: visible;
            }

            /* Links */
            .sidebar-link {
                padding: 12px 20px;
                text-decoration: none;
                color: var(--sb-text);
                display: flex;
                align-items: center;
                gap: 12px;
                transition: all 0.2s ease-in-out;
                border-left: 4px solid transparent;
                font-size: 0.95rem;
                cursor: pointer;
            }

            .sidebar-link:hover {
                background-color: var(--sb-hover);
                color: #fff;
            }

            .sidebar-link.active {
                background-color: var(--sb-hover);
                color: #fff;
                border-left-color: var(--sb-active);
                background: linear-gradient(90deg, rgba(13, 110, 253, 0.1) 0%, transparent 100%);
            }

            .sidebar-brand {
                padding: 0 20px 20px 20px;
                color: #fff;
                font-size: 1.25rem;
                font-weight: 700;
                letter-spacing: 0.5px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            /* Toggle Button Styling */
            #${this.config.toggleBtnId} {
                margin-right: 15px;
                background: none;
                border: none;
                color: inherit; /* Inherit from navbar */
                font-size: 1.5rem;
                cursor: pointer;
                padding: 5px;
                line-height: 1;
                border-radius: 4px;
                transition: background 0.2s;
            }
            #${this.config.toggleBtnId}:hover {
                background: rgba(255,255,255,0.1);
            }

            /* Responsive */
            @media (max-width: 768px) {
                body.sidebar-open { margin-left: 0; }
                /* On mobile, transform brings it in, default is hidden */
                #${this.config.sidebarId} { left: -100%; width: 80%; max-width: 300px; }
                #${this.config.sidebarId}.active { transform: translateX(100%); left: -100%; } 
            }
        `;
        document.head.appendChild(style);
    }

    injectHTML() {
        // 1. Sidebar HTML
        const sidebar = document.createElement('div');
        sidebar.id = this.config.sidebarId;
        sidebar.setAttribute('role', 'navigation');
        sidebar.setAttribute('aria-label', 'Main Sidebar');
        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <i class="bi bi-speedometer2 text-primary"></i> 
                <span>TRANS-SYSTEM</span>
            </div>
            <nav class="nav flex-column flex-grow-1">
                <a class="sidebar-link" data-view="dashboard">
                    <i class="bi bi-grid-1x2"></i> Dashboard
                </a>
                <a class="sidebar-link" data-view="vehicles">
                    <i class="bi bi-car-front"></i> Vehicle Master
                </a>
                <a class="sidebar-link" data-view="drivers">
                    <i class="bi bi-person-badge"></i> Driver Management
                </a>
                <a class="sidebar-link" data-view="logs">
                    <i class="bi bi-terminal"></i> System Logs
                </a>
            </nav>
            <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                <a class="sidebar-link text-danger" id="sidebarLogout" role="button">
                    <i class="bi bi-box-arrow-left"></i> Logout
                </a>
            </div>
        `;
        document.body.prepend(sidebar);

        // 2. Backdrop HTML
        const backdrop = document.createElement('div');
        backdrop.id = this.config.backdropId;
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);

        // 3. Toggle Button Injection
        this.injectToggleButton();
    }

    injectToggleButton() {
        const navBrand = document.querySelector('.navbar-brand');
        if (navBrand) {
            const btn = document.createElement('button');
            btn.id = this.config.toggleBtnId;
            btn.innerHTML = '<i class="bi bi-list"></i>';
            btn.setAttribute('aria-label', 'Toggle Sidebar');
            navBrand.parentNode.insertBefore(btn, navBrand);
        } else {
            console.warn('Navbar brand not found. Toggle button could not be injected.');
        }
    }

    setupEvents() {
        const sidebar = document.getElementById(this.config.sidebarId);
        const toggleBtn = document.getElementById(this.config.toggleBtnId);
        const backdrop = document.getElementById(this.config.backdropId);
        const logoutBtn = document.getElementById('sidebarLogout');

        // Toggle Sidebar
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleSidebar();
            });
        }

        // Close on Backdrop Click
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Navigation Click Delegation
        sidebar.addEventListener('click', (e) => {
            const link = e.target.closest('.sidebar-link[data-view]');
            if (link) {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                this.handleNavigation(link, view);
            }
        });

        // Logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof logout === 'function') logout();
                else window.location.href = 'index.html';
            });
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById(this.config.sidebarId);
        const backdrop = document.getElementById(this.config.backdropId);
        const isActive = sidebar.classList.toggle('active');
        
        document.body.classList.toggle('sidebar-open', isActive);
        
        // Show/Hide backdrop on mobile
        if (window.innerWidth < 768) {
            backdrop.classList.toggle('show', isActive);
        }
    }

    closeSidebar() {
        document.getElementById(this.config.sidebarId).classList.remove('active');
        document.getElementById(this.config.backdropId).classList.remove('show');
        document.body.classList.remove('sidebar-open');
    }

    handleNavigation(element, view) {
        // 1. Update UI Active State
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        element.classList.add('active');

        // 2. Persist State
        localStorage.setItem(this.config.storageKey, view);

        // 3. Auto-close on mobile
        if (window.innerWidth < 768) {
            this.closeSidebar();
        }

        // 4. View Switching Logic
        this.switchView(view);
    }

    switchView(view) {
        console.log(`Switching view to: ${view}`);

        switch(view) {
            case 'drivers':
                if(typeof openDriverManagement === 'function') openDriverManagement();
                break;
            case 'vehicles':
                if(typeof openVehicleMaster === 'function') openVehicleMaster();
                this.resetToDashboard(); // Or specific vehicle logic
                break;
            case 'logs':
                if(typeof showLogs === 'function') showLogs();
                break;
            case 'dashboard':
            default:
                this.resetToDashboard();
                break;
        }
    }

    resetToDashboard() {
        // Hide Driver Module container
        const driverModule = document.getElementById('driverModuleContainer');
        if (driverModule) driverModule.style.display = 'none';
        
        // Show Dashboard rows
        const dashboardRows = document.querySelectorAll('.container-fluid > .row, .container-fluid > .card');
        dashboardRows.forEach(el => el.style.display = '');
    }

    restoreState() {
        const savedView = localStorage.getItem(this.config.storageKey) || 'dashboard';
        const linkToActivate = document.querySelector(`.sidebar-link[data-view="${savedView}"]`);
        
        if (linkToActivate) {
            // Visually activate link
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            linkToActivate.classList.add('active');
            
            // Execute view logic (optional: remove this line if you want to load default page state)
            // this.switchView(savedView); 
        } else {
            // Default to dashboard if nothing saved
            const dashLink = document.querySelector('.sidebar-link[data-view="dashboard"]');
            if(dashLink) dashLink.classList.add('active');
        }
    }
}

// Initialize the extension
new SidebarManager();