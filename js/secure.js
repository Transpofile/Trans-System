/**
 * secure.js
 * Security & Authentication Overlay
 * 
 * Features:
 * 1. Blocks UI until logged in.
 * 2. Auto-fills Name/Dept from Supabase metadata.
 * 3. Handles Login/Register with auto-reload.
 * 4. Only locks Name field; Department remains unlocked but auto-selected.
 */

class AuthExtension {
    constructor() {
        this.state = {
            user: null,
            view: 'LOGIN', // Options: LOGIN, REGISTER, LOADING
            error: null
        };

        // Bind context
        this.init = this.init.bind(this);
        this.render = this.render.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
    }

    async init() {
        this.injectStyles();
        
        // 1. Check for existing session on load
        const { data: { session } } = await sb.auth.getSession();
        
        if (session) {
            this.handleSessionSuccess(session.user);
        } else {
            this.lockInterface();
            this.render();
        }

        // 2. Listen for auth changes (Login/Logout events)
        sb.auth.onAuthStateChange(async (_event, session) => {
            if (session) {
                this.handleSessionSuccess(session.user);
            } else {
                this.state.user = null;
                this.lockInterface();
                this.setState({ view: 'LOGIN', error: null });
            }
        });
    }

    // Process a successful login/session
    async handleSessionSuccess(user) {
        this.state.user = user;
        
        // Use metadata stored in Supabase Auth (reliable & instant)
        const meta = user.user_metadata || {};
        
        // Auto-fill the HTML inputs in withdrawal-request.html
        this.fillFormFields(meta.full_name, meta.department);
        
        this.unlockInterface();
    }

    fillFormFields(name, department) {
        // Target specific IDs from withdrawal-request.html
        const nameInput = $('#w-name');
        const deptSelect = $('#w-dept');

        // --- HANDLE NAME (Keep Locked) ---
        if (name) {
            nameInput.val(name);
            // Lock name only if we have a value
            nameInput.prop('readonly', true).addClass('bg-slate-200 text-slate-500 cursor-not-allowed focus:ring-0 focus:border-slate-300');
        } else {
            // Ensure it is editable if no name is found
            nameInput.prop('readonly', false).removeClass('bg-slate-200 text-slate-500 cursor-not-allowed focus:ring-0 focus:border-slate-300');
        }

        // --- HANDLE DEPARTMENT (Unlocked) ---
        // We still auto-select it if available, but we DO NOT lock it.
        if (department) {
            // 1. Try to set the value immediately
            deptSelect.val(department);

            // 2. RETRY LOGIC: 
            // Because the options load asynchronously in your main HTML (loadData function),
            // the <option> tags might not exist yet. We poll briefly to ensure the value is selected.
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                // Check if options have loaded (more than just the default "Loading...")
                if (deptSelect.find('option').length > 1) {
                    deptSelect.val(department); // Re-apply value now that options exist
                    clearInterval(interval);
                }
                // Stop checking after 5 seconds to save resources
                if (attempts > 50) clearInterval(interval);
            }, 100);
        }

        // ALWAYS ensure Department is ENABLED and clean of disabled styles
        deptSelect.prop('disabled', false).removeClass('bg-slate-200 text-slate-500 cursor-not-allowed');
    }

    // --- LOGIC METHODS ---

    async handleLogin(e) {
        e.preventDefault();
        
        // 1. Capture values BEFORE changing state (critical for jQuery)
        const email = $('#auth-email').val();
        const password = $('#auth-pass').val();

        if(!email || !password) {
            this.setState({ view: 'LOGIN', error: "Please enter email and password" });
            return;
        }

        // 2. Show Loader
        this.setState({ view: 'LOADING' });
        
        const { data, error } = await sb.auth.signInWithPassword({ email, password });

        if (error) {
            this.setState({ view: 'LOGIN', error: error.message });
        }
        // If success, onAuthStateChange triggers automatically
    }

    async handleRegister(e) {
        e.preventDefault();

        // 1. Capture values BEFORE changing state
        const email = $('#reg-email').val();
        const password = $('#reg-pass').val();
        const fullName = $('#reg-name').val();
        const department = $('#reg-dept').val();

        // 2. Validate
        if(!email || !password || !fullName || !department) {
             this.setState({ view: 'REGISTER', error: "All fields are required" });
             return;
        }

        if(password.length < 6) {
            this.setState({ view: 'REGISTER', error: "Password must be at least 6 characters" });
            return;
        }

        // 3. Show Loader
        this.setState({ view: 'LOADING' });

        // 4. Send to Supabase
        const { data, error } = await sb.auth.signUp({
            email,
            password,
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
            // SUCCESS
            // We force a reload here to ensure the session is picked up cleanly
            Swal.fire({
                title: 'Registration Successful!',
                text: 'Account created. Logging you in...',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                location.reload(); 
            });
        }
    }

    async handleLogout() {
        await sb.auth.signOut();
        location.reload(); 
    }

    // --- UI STATE MANAGEMENT ---

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #auth-overlay {
                position: fixed; 
                inset: 0; 
                z-index: 1000;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(8px);
                display: flex; 
                justify-content: center; 
                align-items: center;
                padding: 1rem;
            }
            .auth-card {
                background: white; 
                width: 100%; 
                max-width: 420px;
                padding: 2.5rem; 
                border-radius: 1.5rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                border: 1px solid #f1f5f9;
                animation: modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes modalSlideUp { 
                from { opacity: 0; transform: translateY(30px) scale(0.95); } 
                to { opacity: 1; transform: translateY(0) scale(1); } 
            }
            body.auth-locked {
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(style);
    }

    lockInterface() {
        $('body').addClass('auth-locked');
        if ($('#auth-root').length === 0) {
            $('body').append('<div id="auth-root"></div>');
        }
    }

    unlockInterface() {
        $('#auth-root').remove();
        $('body').removeClass('auth-locked');
        
        // Inject Logout Button
        const navContainer = $('.bg-white nav, nav .flex.items-center.gap-4').last();
        
        if($('#logout-btn').length === 0) {
            navContainer.prepend(`
                <button id="logout-btn" class="hidden md:flex items-center gap-2 mr-4 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors text-[10px] font-bold uppercase tracking-wider">
                    <span>Logout</span>
                    <i class="fas fa-sign-out-alt"></i>
                </button>
                <button id="logout-btn-mobile" class="md:hidden mr-3 text-red-500 hover:text-red-700">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            `);
            
            $('#logout-btn, #logout-btn-mobile').on('click', this.handleLogout);
        }
    }

    // --- RENDERER ---
    render() {
        const { view, error } = this.state;
        const root = $('#auth-root');
        
        if (!root.length) return;

        root.empty();

        const Header = `
            <div class="text-center mb-6">
                <div class="inline-flex items-center justify-center w-14 h-14 bg-brand-50 rounded-2xl mb-4">
                    <i class="fas fa-lock text-brand-600 text-2xl"></i>
                </div>
                <h1 class="text-2xl font-black text-slate-900 tracking-tight">System Access</h1>
                <p class="text-slate-500 text-sm mt-1 font-medium">Transportation Record System</p>
            </div>
        `;

        const ErrorAlert = error ? `
            <div class="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-5 rounded-r text-xs font-bold flex items-center shadow-sm">
                <i class="fas fa-exclamation-triangle mr-2"></i> ${error}
            </div>
        ` : '';

        let formContent = '';

        if (view === 'LOADING') {
            formContent = `
                <div class="flex flex-col items-center justify-center py-8">
                    <i class="fas fa-circle-notch fa-spin text-4xl text-brand-600 mb-4"></i>
                    <p class="text-sm font-bold text-slate-600">Verifying Credentials...</p>
                </div>
            `;
        } else if (view === 'LOGIN') {
            formContent = `
                <form id="login-form" class="space-y-4">
                    <div class="space-y-1">
                        <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                        <div class="relative">
                            <i class="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input type="email" id="auth-email" class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder-slate-300" placeholder="user@transystem.com" required>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                        <div class="relative">
                            <i class="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input type="password" id="auth-pass" class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder-slate-300" placeholder="••••••••" required>
                        </div>
                    </div>
                    
                    <button type="submit" class="w-full bg-slate-900 hover:bg-brand-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 hover:shadow-brand-500/40 transition-all transform active:scale-[0.98] mt-2 flex items-center justify-center gap-2">
                        <span>Secure Sign In</span>
                        <i class="fas fa-arrow-right"></i>
                    </button>

                    <div class="text-center pt-4 border-t border-slate-100 mt-4">
                        <p class="text-xs text-slate-400 font-medium">New personnel?</p>
                        <button id="to-register" class="text-sm font-bold text-brand-600 hover:text-brand-700 mt-1 transition-colors">Create an Account</button>
                    </div>
                </form>
            `;
        } else if (view === 'REGISTER') {
            formContent = `
                <form id="register-form" class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase ml-1">Full Name</label>
                            <input type="text" id="reg-name" class="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:border-brand-500 focus:outline-none" placeholder="John Doe" required>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase ml-1">Department</label>
                            <select id="reg-dept" class="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-brand-500 focus:outline-none" required>
                                <option value="" disabled selected>Select...</option>
                                <option value="Logistics">Logistics</option>
                                <option value="Warehouse">Warehouse</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Operations">Operations</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase ml-1">Email Address</label>
                        <input type="email" id="reg-email" class="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:border-brand-500 focus:outline-none" placeholder="email@transystem.com" required>
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase ml-1">Create Password</label>
                        <input type="password" id="reg-pass" class="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:border-brand-500 focus:outline-none" placeholder="Min. 6 characters" required>
                    </div>

                    <button type="submit" class="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-500/30 transition-all mt-4">
                        Register Access
                    </button>

                    <div class="text-center pt-3">
                        <button id="to-login" class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel & Return to Login</button>
                    </div>
                </form>
            `;
        }

        root.html(`
            <div id="auth-overlay">
                <div class="auth-card">
                    ${Header}
                    ${ErrorAlert}
                    ${formContent}
                </div>
            </div>
        `);

        // Attach Events
        $('#login-form').on('submit', this.handleLogin);
        $('#register-form').on('submit', this.handleRegister);
        $('#to-register').on('click', (e) => { e.preventDefault(); this.setState({ view: 'REGISTER', error: null }); });
        $('#to-login').on('click', (e) => { e.preventDefault(); this.setState({ view: 'LOGIN', error: null }); });
    }
}

// Initialization
$(document).ready(() => {
    window.authExtension = new AuthExtension();
    window.authExtension.init();
});
