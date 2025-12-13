/* --- File: source/html/js/auth.js --- */

const CONFIG = {
    SESSION_KEY: "gwebapps_session",
    // Adjust these paths relative to where your HTML files are located
    PAGES: {
        LOGIN: "Login.html", 
        DASHBOARD: "index.html"
    },
    ROLES: {
        ADMIN: "admin",
        VIEWER: "viewer"
    }
};

const VALID_USERS = [
    { username: "admin", password: "admin", role: "admin" }, // Full Access
    { username: "user",  password: "user", role: "viewer" } // Read Only
];

const Auth = {
    /**
     * CORE LOGIN LOGIC
     */
    validateCredentials: function(username, password) {
        return VALID_USERS.find(u => u.username === username && u.password === password);
    },

    createSession: function(user) {
        const sessionData = {
            username: user.username,
            role: user.role,
            isLoggedIn: true,
            loginTime: new Date().toISOString()
        };
        sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
    },

    /**
     * LOGOUT LOGIC
     */
    logout: function() {
        if (confirm("Are you sure you want to log out?")) {
            sessionStorage.removeItem(CONFIG.SESSION_KEY);
            // Redirect to Login Page
            window.location.href = this.resolvePath(CONFIG.PAGES.LOGIN);
        }
    },

    /**
     * CHECK SESSION (Runs on Dashboard)
     */
    checkSession: function() {
        const sessionJson = sessionStorage.getItem(CONFIG.SESSION_KEY);
        const currentPath = window.location.pathname;
        const filename = currentPath.substring(currentPath.lastIndexOf('/') + 1);

        // If we are on the Login page, do nothing (Login UI handles itself)
        if (filename === CONFIG.PAGES.LOGIN || filename === "Login.html") return;

        // If no session, redirect to Login
        if (!sessionJson) {
            window.location.href = this.resolvePath(CONFIG.PAGES.LOGIN);
            return;
        }

        // Validate Session Data
        const user = JSON.parse(sessionJson);
        this.updateDashboardUI(user);
    },

    /**
     * UPDATE DASHBOARD UI (Hide/Show buttons)
     */
    updateDashboardUI: function(user) {
        // 1. Show Username (if element exists)
        const userDisplay = document.getElementById('currentUser');
        if (userDisplay) {
            userDisplay.textContent = user.username.toUpperCase();
        }

        // 2. Hide Admin Buttons if not Admin
        if (user.role !== CONFIG.ROLES.ADMIN) {
            const protectedElements = document.querySelectorAll('.admin-only');
            protectedElements.forEach(el => {
                el.style.display = 'none'; // Force hide
            });
        }
    },

    /**
     * INITIALIZE LOGIN PAGE FORM
     * This handles the animations and submit event for Login.html
     */
    initLoginForm: function() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return; // Not on login page

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get Elements
            const userIn = document.getElementById('username').value;
            const passIn = document.getElementById('password').value;
            const btn = document.getElementById('submitBtn');
            const btnText = btn.querySelector('span');
            const arrowIcon = document.getElementById('arrowIcon');
            const loadingIcon = document.getElementById('loadingIcon');
            const errorMsg = document.getElementById('errorMsg');
            const card = document.querySelector('.glass');

            // Reset States
            errorMsg.classList.add('hidden');
            card.classList.remove('animate-shake');
            
            // Loading UI
            btn.disabled = true;
            btn.classList.add('cursor-not-allowed', 'opacity-80');
            arrowIcon.classList.add('hidden');
            loadingIcon.classList.remove('hidden');
            btnText.textContent = "Verifying...";

            // Simulate Network Delay (800ms)
            setTimeout(() => {
                const user = this.validateCredentials(userIn, passIn);
                
                if (user) {
                    // SUCCESS
                    this.createSession(user);
                    
                    btnText.textContent = "Success!";
                    btn.classList.remove('from-cyan-600', 'to-blue-600');
                    btn.classList.add('bg-green-500');
                    
                    // Redirect
                    setTimeout(() => {
                        window.location.href = this.resolvePath(CONFIG.PAGES.DASHBOARD);
                    }, 500);
                } else {
                    // FAILURE
                    btn.disabled = false;
                    btn.classList.remove('cursor-not-allowed', 'opacity-80');
                    arrowIcon.classList.remove('hidden');
                    loadingIcon.classList.add('hidden');
                    btnText.textContent = "Login Securely";

                    errorMsg.classList.remove('hidden');
                    errorMsg.style.display = 'block'; // Ensure visibility
                    card.classList.add('animate-shake');
                    setTimeout(() => card.classList.remove('animate-shake'), 500);
                }
            }, 800);
        });
    },

    /**
     * HELPER: Handle File Paths
     * Ensures redirects work whether in /source/html/ or root
     */
    resolvePath: function(destination) {
        // Simple logic: if destination is Login.html and we are deep in folders, adjust.
        // For now, returning destination directly assuming files are in the same folder 
        // or user has adjusted CONFIG.PAGES at the top.
        return destination;
    }
};

// --- AUTO-RUN ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check if we need to secure the page
    Auth.checkSession();

    // 2. Initialize Login Form logic (if on Login page)
    Auth.initLoginForm();

    // 3. Bind Logout Button (if on Dashboard)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    }

});


