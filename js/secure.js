/**
 * secure.js
 * Enhanced Security Overlay & Auth Handler
 */

class AuthExtension {
    constructor() {
        this.state = {
            user: null,
            view: 'LOGIN', // LOGIN, REGISTER, LOADING
            error: null
        };

        this.init = this.init.bind(this);
        this.render = this.render.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
    }

    async init() {
        this.injectStyles();
        this.cloakContent();

        // 1. Check existing session
        const { data: { session } } = await sb.auth.getSession();
        
        if (session) {
            this.handleSessionSuccess(session.user);
        } else {
            this.render();
        }

        // 2. Listen for auth changes
        sb.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.handleSessionSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.state.user = null;
                this.cloakContent();
                this.setState({ view: 'LOGIN', error: null });
            }
        });
    }

    async handleSessionSuccess(user) {
        this.state.user = user;
        const meta = user.user_metadata || {};
        
        // Auto-fill Withdrawal Slip Fields based on Registration Data
        this.fillFormFields(meta.full_name, meta.department);
        
        this.uncloakContent();
    }

    fillFormFields(name, department) {
        // IDs from the Main HTML Withdrawal Sidebar
        const nameInput = $('#inp-name');
        const deptSelect = $('#inp-dept');

        // --- 1. NAME: Auto-fill and Lock ---
        if (name) {
            nameInput.val(name)
                .prop('readonly', true)
                .addClass('bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200')
                .removeClass('focus:bg-white focus:border-brand-500');
        }

        // --- 2. DEPARTMENT: Auto-select (Using MutationObserver) ---
        // We must wait for the main app to fetch departments from DB and render <option> tags
        if (department) {
            // Check if options are already loaded (length > 1 means more than just "Select Department")
            if (deptSelect.find('option').length > 1) {
                deptSelect.val(department);
            } else {
                // Observer to watch for when options are added to the select box
                const observer = new MutationObserver(() => {
                    if (deptSelect.find('option').length > 1) {
                        // Try to set the value
                        deptSelect.val(department);
                        // Stop watching
                        observer.disconnect();
                    }
                });
                
                // Start observing the select element for child changes
                if(deptSelect.length) {
                    observer.observe(deptSelect[0], { childList: true });
                }
            }
        }
    }

    // --- ACTIONS ---

    async handleLogin(e) {
        e.preventDefault();
        const email = $('#auth-email').val();
        const password = $('#auth-pass').val();

        if(!email || !password) return this.setState({ error: "Credentials required" });

        this.setState({ view: 'LOADING' });
        
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) this.setState({ view: 'LOGIN', error: error.message });
    }

    async handleRegister(e) {
        e.preventDefault();
        const email = $('#reg-email').val();
        const password = $('#reg-pass').val();
        const fullName = $('#reg-name').val();
        const department = $('#reg-dept').val(); // Capture Department

        if(!email || !password || !fullName || !department) {
             return this.setState({ view: 'REGISTER', error: "All fields including Department are required" });
        }
        if(password.length < 6) {
            return this.setState({ view: 'REGISTER', error: "Password must be 6+ chars" });
        }

        this.setState({ view: 'LOADING' });

        // Save Department and Name to User Metadata
        const { error } = await sb.auth.signUp({
            email, password,
            options: { 
                data: { 
                    full_name: fullName, 
                    department: department 
                } 
            }
        });

        if (error) {
            this.setState({ view: 'REGISTER', error: error.message });
        } else {
            Swal.fire({ icon: 'success', title: 'Account Created', text: 'Logging in...', timer: 1500, showConfirmButton: false });
            // The AuthStateChange listener will handle the redirect/unlock
        }
    }

    async handleLogout() {
        await sb.auth.signOut();
        location.reload(); 
    }

    // --- UI MANAGEMENT ---

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }

    injectStyles() {
        if ($('#auth-styles').length) return;
        $('head').append(`
            <style id="auth-styles">
                body.auth-locked { overflow: hidden !important; height: 100vh; }
                /* Blur content behind auth */
                body.auth-locked > *:not(#auth-root) { filter: blur(5px); pointer-events: none; }
                
                #auth-overlay {
                    position: fixed; inset: 0; z-index: 9999;
                    background: rgba(248, 250, 252, 0.9);
                    backdrop-filter: blur(8px);
                    display: flex; justify-content: center; align-items: center;
                    padding: 1rem;
                }
                .auth-card {
                    background: white; width: 100%; max-width: 400px;
                    padding: 2.5rem; border-radius: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
                    border: 1px solid #e2e8f0;
                    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
            </style>
        `);
    }

    cloakContent() {
        $('body').addClass('auth-locked');
        if ($('#auth-root').length === 0) $('body').append('<div id="auth-root"></div>');
    }

    uncloakContent() {
        $('#auth-root').remove();
        $('body').removeClass('auth-locked');
        
        // Inject Logout Button into Navbar
        const navRight = $('nav .flex.items-center.gap-3').last();
        if($('#logout-btn').length === 0) {
            navRight.prepend(`
                <button id="logout-btn" class="hidden md:flex items-center gap-2 mr-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all text-xs font-bold shadow-sm">
                    <span>Log Out</span>
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            `);
            $('#logout-btn').on('click', this.handleLogout);
        }
    }

    render() {
        const { view, error } = this.state;
        const root = $('#auth-root');
        if (!root.length) return;
        root.empty();

        const logoHTML = `
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-12 h-12 bg-slate-900 rounded-xl mb-3 shadow-lg shadow-slate-500/20">
                    <i class="fas fa-shield-alt text-white text-xl"></i>
                </div>
                <h1 class="text-xl font-black text-slate-800 tracking-tight">System Login</h1>
                <p class="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Authorized Personnel Only</p>
            </div>
        `;

        const errorHTML = error ? `<div class="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl mb-4 flex items-center gap-2"><i class="fas fa-exclamation-circle"></i> ${error}</div>` : '';

        let content = '';

        if (view === 'LOADING') {
            content = `<div class="py-12 text-center"><i class="fas fa-circle-notch fa-spin text-3xl text-brand-600"></i></div>`;
        } 
        else if (view === 'LOGIN') {
            content = `
                <form id="form-login" class="space-y-4">
                    <div>
                        <input type="email" id="auth-email" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white transition-all" placeholder="Email Address" required>
                    </div>
                    <div>
                        <input type="password" id="auth-pass" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white transition-all" placeholder="Password" required>
                    </div>
                    <button type="submit" class="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-500/20 hover:bg-brand-600 hover:shadow-brand-500/30 transition-all">
                        Sign In
                    </button>
                    <div class="text-center mt-4">
                        <a href="#" id="go-register" class="text-xs font-bold text-slate-400 hover:text-brand-600">Create Account</a>
                    </div>
                </form>
            `;
        } 
        else if (view === 'REGISTER') {
            content = `
                <form id="form-register" class="space-y-3">
                    <div class="space-y-3">
                        <input type="text" id="reg-name" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white" placeholder="Full Name" required>
                        
                        <!-- DEPARTMENT SELECTION ADDED HERE -->
                        <div class="relative">
                            <select id="reg-dept" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white appearance-none cursor-pointer" required>
                                <option value="" disabled selected>Select Department</option>
                                <option value="Warehouse">Warehouse</option>
                                <option value="Logistics">Logistics</option>
                                <option value="Operations">Operations</option>
                                <option value="Admin">Admin</option>
                                <option value="Production">Production</option>
                            </select>
                            <i class="fas fa-chevron-down absolute right-3 top-3 text-slate-400 text-[10px] pointer-events-none"></i>
                        </div>
                    </div>

                    <input type="email" id="reg-email" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white" placeholder="Email" required>
                    <input type="password" id="reg-pass" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white" placeholder="Password (Min 6)" required>
                    
                    <button type="submit" class="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-all">
                        Register
                    </button>
                    <div class="text-center mt-3">
                        <a href="#" id="go-login" class="text-xs font-bold text-slate-400 hover:text-slate-600">Back to Login</a>
                    </div>
                </form>
            `;
        }

        root.html(`
            <div id="auth-overlay">
                <div class="auth-card">
                    ${logoHTML}
                    ${errorHTML}
                    ${content}
                </div>
            </div>
        `);

        // Event Binding
        $('#form-login').on('submit', this.handleLogin);
        $('#form-register').on('submit', this.handleRegister);
        $('#go-register').on('click', (e) => { e.preventDefault(); this.setState({ view: 'REGISTER', error: null }); });
        $('#go-login').on('click', (e) => { e.preventDefault(); this.setState({ view: 'LOGIN', error: null }); });
    }
}

// Init on Load
$(document).ready(() => {
    if(typeof sb === 'undefined') {
        console.error("Supabase client 'sb' not found.");
        return;
    }
    window.authExtension = new AuthExtension();
    window.authExtension.init();
});
