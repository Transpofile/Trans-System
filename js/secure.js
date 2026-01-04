/**
 * secure.js
 * Enhanced Security Overlay for TRANSYSTEM Live Monitor
 * 
 * Features: 
 * - Content Cloaking (prevents DOM inspection bypass)
 * - MutationObserver for reliable form autofill
 * - Password Reset Flow
 * - Password Visibility Toggles
 * - Supabase Auth Integration
 * 
 * Dependencies: jQuery, SweetAlert2, Supabase Client ('sb')
 */

class AuthExtension {
    constructor() {
        this.state = {
            user: null,
            view: 'LOGIN', // LOGIN, REGISTER, FORGOT, LOADING
            error: null,
            loading: false
        };

        // Bind methods
        this.init = this.init.bind(this);
        this.render = this.render.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.handleForgotPass = this.handleForgotPass.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.togglePasswordVisibility = this.togglePasswordVisibility.bind(this);
    }

    async init() {
        // 0. Immediate Security: Hide everything except the body to prevent content flashing
        this.injectStyles();
        this.cloakContent(); 

        // 1. Check existing session
        const { data: { session } } = await sb.auth.getSession();

        if (session) {
            await this.handleSessionSuccess(session.user);
        } else {
            this.render();
        }

        // 2. Listen for auth state changes (Login, Logout, Token Refresh)
        sb.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this.handleSessionSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.state.user = null;
                this.cloakContent();
                this.setState({ view: 'LOGIN', error: null });
            }
        });
    }

    // --- LOGIC & HELPERS ---

    async handleSessionSuccess(user) {
        this.state.user = user;
        const meta = user.user_metadata || {};

        // Auto-fill fields based on IDs provided in the prompt
        this.fillFormFields(meta.full_name, meta.department);

        this.uncloakContent();
    }

    /**
     * Uses MutationObserver to wait for the Department Select to be populated
     * by the main application script, rather than using setInterval.
     */
    fillFormFields(name, department) {
        const nameInput = $('#inp-name');
        const deptSelect = $('#inp-dept');

        // Lock Name
        if (name) {
            nameInput.val(name)
                .prop('readonly', true)
                .addClass('bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 shadow-none')
                .removeClass('focus:bg-white focus:ring-2 focus:ring-brand-500');
        }

        // Select Department
        if (department) {
            // If options already exist, set immediately
            if (deptSelect.find('option').length > 1) {
                deptSelect.val(department);
            } else {
                // Wait for options to be added by external script
                const observer = new MutationObserver(() => {
                    if (deptSelect.find('option').length > 1) {
                        deptSelect.val(department);
                        observer.disconnect(); // Stop watching once found
                    }
                });
                observer.observe(deptSelect[0], { childList: true, subtree: true });
            }
        }
    }

    cloakContent() {
        $('body').addClass('auth-active');
        // Hide all direct children of body except the auth-root and scripts
        $('body > *:not(#auth-root):not(script):not(style)').addClass('auth-blur-target');
        
        if ($('#auth-root').length === 0) {
            $('body').append('<div id="auth-root"></div>');
        }
    }

    uncloakContent() {
        $('#auth-root').fadeOut(300, function() {
            $(this).remove();
        });
        $('body').removeClass('auth-active');
        $('.auth-blur-target').removeClass('auth-blur-target');

        this.injectLogoutButton();
    }

    injectLogoutButton() {
        if ($('#logout-btn').length > 0) return;

        const navRight = $('nav .flex.items-center.gap-4').last();
        const btnHtml = `
            <button id="logout-btn" class="hidden md:flex items-center gap-2 mr-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all text-xs font-bold shadow-sm">
                <span>Log Out</span>
                <i class="fas fa-sign-out-alt"></i>
            </button>
        `;
        
        navRight.prepend(btnHtml);
        $('#logout-btn').on('click', this.handleLogout);
    }

    // --- ACTIONS ---

    async handleLogin(e) {
        e.preventDefault();
        const email = $('#auth-email').val();
        const password = $('#auth-pass').val();

        if (!email || !password) return this.setState({ error: "Please enter both email and password." });

        this.setState({ loading: true, error: null });

        const { error } = await sb.auth.signInWithPassword({ email, password });
        
        if (error) {
            this.setState({ loading: false, error: error.message });
        }
        // Success is handled by onAuthStateChange
    }

    async handleRegister(e) {
        e.preventDefault();
        const email = $('#reg-email').val();
        const password = $('#reg-pass').val();
        const fullName = $('#reg-name').val();
        const department = $('#reg-dept').val();

        if (!email || !password || !fullName || !department) {
            return this.setState({ error: "All fields are required." });
        }
        if (password.length < 6) {
            return this.setState({ error: "Password must be at least 6 characters." });
        }

        this.setState({ loading: true, error: null });

        const { error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, department: department } }
        });

        if (error) {
            this.setState({ loading: false, error: error.message });
        } else {
            Swal.fire({
                icon: 'success',
                title: 'Welcome!',
                text: 'Account created successfully. Logging you in...',
                timer: 2000,
                showConfirmButton: false
            });
            // Give time for the Swal to show before reload/redirect logic kicks in
        }
    }

    async handleForgotPass(e) {
        e.preventDefault();
        const email = $('#forgot-email').val();

        if (!email) return this.setState({ error: "Please enter your email address." });

        this.setState({ loading: true, error: null });

        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.href, // Redirect back here
        });

        this.setState({ loading: false });

        if (error) {
            this.setState({ error: error.message });
        } else {
            Swal.fire('Check your inbox', 'Password reset link sent.', 'success');
            this.setState({ view: 'LOGIN' });
        }
    }

    async handleLogout() {
        Swal.fire({
            title: 'Logging out...',
            didOpen: () => Swal.showLoading(),
            timer: 800,
            showConfirmButton: false
        }).then(async () => {
            await sb.auth.signOut();
            window.location.reload();
        });
    }

    togglePasswordVisibility(e) {
        const btn = $(e.currentTarget);
        const input = btn.siblings('input');
        const icon = btn.find('i');

        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            input.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
        }
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
                /* Blur the background app when auth is active */
                body.auth-active { overflow: hidden !important; }
                .auth-blur-target { 
                    filter: blur(8px) grayscale(50%); 
                    pointer-events: none; 
                    user-select: none;
                    transition: filter 0.3s ease;
                }

                #auth-root {
                    position: fixed; inset: 0; z-index: 10000;
                    background: rgba(248, 250, 252, 0.85); /* Light overlay */
                    backdrop-filter: blur(10px); /* Heavy blur for overlay itself */
                    display: flex; justify-content: center; align-items: center;
                    padding: 1.5rem;
                }

                .auth-card {
                    background: white; width: 100%; max-width: 420px;
                    padding: 2.5rem; border-radius: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    position: relative;
                    animation: authSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .auth-input-group { position: relative; }
                .auth-input-icon {
                    position: absolute; right: 1rem; top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8; cursor: pointer;
                    transition: color 0.2s;
                }
                .auth-input-icon:hover { color: #475569; }

                @keyframes authSlideUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            </style>
        `);
    }

    render() {
        const { view, error, loading } = this.state;
        const root = $('#auth-root');
        if (!root.length) return;

        // Cleanup events before re-rendering to prevent duplicates
        root.off(); 
        root.empty();

        const logoHTML = `
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-14 h-14 bg-slate-900 rounded-2xl mb-4 shadow-xl shadow-slate-900/20 transform hover:scale-105 transition-transform duration-300">
                    <i class="fas fa-shield-alt text-white text-2xl"></i>
                </div>
                <h1 class="text-2xl font-black text-slate-800 tracking-tight">System Login</h1>
                <p class="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Authorized Access Only</p>
            </div>
        `;

        const errorHTML = error ? `
            <div class="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl mb-5 flex items-start gap-3 animate-pulse">
                <i class="fas fa-exclamation-triangle mt-0.5"></i>
                <span>${error}</span>
            </div>
        ` : '';

        const loaderHTML = loading ? `<i class="fas fa-circle-notch fa-spin ml-2"></i>` : '';
        const btnOpacity = loading ? 'opacity-70 cursor-wait' : 'hover:bg-brand-600 hover:shadow-brand-500/30';

        let content = '';

        // --- VIEW: LOGIN ---
        if (view === 'LOGIN') {
            content = `
                <form id="form-login" class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-slate-500 ml-1 mb-1 block">Email Address</label>
                        <input type="email" id="auth-email" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 transition-all" placeholder="name@company.com" required>
                    </div>
                    <div class="auth-input-group">
                        <label class="text-xs font-bold text-slate-500 ml-1 mb-1 block">Password</label>
                        <input type="password" id="auth-pass" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 transition-all pr-10" placeholder="••••••••" required>
                        <div class="auth-input-icon toggle-pass"><i class="fas fa-eye"></i></div>
                    </div>
                    
                    <div class="flex justify-end">
                        <a href="#" id="go-forgot" class="text-xs font-bold text-brand-600 hover:text-brand-700">Forgot Password?</a>
                    </div>

                    <button type="submit" class="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all ${btnOpacity}" ${loading ? 'disabled' : ''}>
                        Sign In ${loaderHTML}
                    </button>
                    
                    <div class="relative py-2">
                        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200"></div></div>
                        <div class="relative flex justify-center"><span class="bg-white px-4 text-xs font-bold text-slate-400">OR</span></div>
                    </div>

                    <button type="button" id="go-register" class="w-full py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all">
                        Create Account
                    </button>
                </form>
            `;
        } 
        
        // --- VIEW: REGISTER ---
        else if (view === 'REGISTER') {
            content = `
                <form id="form-register" class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-xs font-bold text-slate-500 ml-1">Full Name</label>
                            <input type="text" id="reg-name" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white" required>
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-500 ml-1">Department</label>
                            <select id="reg-dept" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white" required>
                                <option value="" disabled selected>Select</option>
                                <option value="Warehouse">Warehouse</option>
                                <option value="Logistics">Logistics</option>
                                <option value="Operations">Operations</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 ml-1">Email</label>
                        <input type="email" id="reg-email" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white" required>
                    </div>
                    <div class="auth-input-group">
                        <label class="text-xs font-bold text-slate-500 ml-1">Password</label>
                        <input type="password" id="reg-pass" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white pr-10" required>
                        <div class="auth-input-icon toggle-pass"><i class="fas fa-eye"></i></div>
                    </div>
                    
                    <button type="submit" class="w-full mt-2 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all ${btnOpacity}" ${loading ? 'disabled' : ''}>
                        Register Account ${loaderHTML}
                    </button>
                    <div class="text-center mt-3">
                        <a href="#" id="go-login" class="text-xs font-bold text-slate-400 hover:text-slate-600">Back to Login</a>
                    </div>
                </form>
            `;
        }

        // --- VIEW: FORGOT PASSWORD ---
        else if (view === 'FORGOT') {
            content = `
                <form id="form-forgot" class="space-y-4">
                    <p class="text-sm text-slate-500 text-center mb-4">Enter your email and we'll send you a link to reset your password.</p>
                    <div>
                        <input type="email" id="forgot-email" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white" placeholder="Email Address" required>
                    </div>
                    <button type="submit" class="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all ${btnOpacity}" ${loading ? 'disabled' : ''}>
                        Send Reset Link ${loaderHTML}
                    </button>
                    <div class="text-center mt-4">
                        <a href="#" id="go-login" class="text-xs font-bold text-slate-400 hover:text-slate-600">Back to Login</a>
                    </div>
                </form>
            `;
        }

        root.html(`
            <div class="auth-card">
                ${logoHTML}
                ${errorHTML}
                ${content}
            </div>
        `);

        // Event Binding
        $('#form-login').on('submit', this.handleLogin);
        $('#form-register').on('submit', this.handleRegister);
        $('#form-forgot').on('submit', this.handleForgotPass);
        
        // Navigation
        $('#go-register').on('click', (e) => { e.preventDefault(); this.setState({ view: 'REGISTER', error: null }); });
        $('#go-login').on('click', (e) => { e.preventDefault(); this.setState({ view: 'LOGIN', error: null }); });
        $('#go-forgot').on('click', (e) => { e.preventDefault(); this.setState({ view: 'FORGOT', error: null }); });
        
        // Utilities
        $('.toggle-pass').on('click', this.togglePasswordVisibility);
    }
}

// Initialization on Document Ready
$(document).ready(() => {
    if(typeof sb === 'undefined') {
        console.error("CRITICAL: Supabase client 'sb' not found.");
        // Fallback: Lock UI indefinitely or show error
        $('body').html('<div style="padding:50px;text-align:center;font-family:sans-serif;color:red;">Error: Database connection missing.</div>');
        return;
    }
    window.authExtension = new AuthExtension();
    window.authExtension.init();
});
