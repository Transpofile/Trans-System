/**
 * --- assistant.js ---
 * Enhanced System Assistant & Onboarding Bot
 * Features: Smart Navigation, Live Data Reading, Actionable Buttons, and Modern UI.
 */

$(document).ready(() => {
    // Initialize after a short delay to ensure DOM and Tailwind are ready
    setTimeout(() => new SystemAssistant(), 1000);
});

class SystemAssistant {
    constructor() {
        this.isOpen = false;
        this.knowledgeBase = this.loadKnowledgeBase();
        this.init();
    }

    init() {
        this.injectStyles();
        this.renderUI();
        this.attachListeners();
        
        // Context-aware welcome message
        const currentPage = $('.page-section:not(.hidden)').attr('id') || 'dashboard';
        this.sendWelcomeMessage(currentPage);
    }

    // --- 1. DATA & LOGIC ---

    loadKnowledgeBase() {
        return [
            {
                keywords: ['add item', 'new item', 'create item', 'stock entry'],
                answer: "To add a new item, navigate to Inventory Control. I can open the form for you.",
                action: { text: "Open Add Item Form", func: "openInventoryModal('add', '')" }
            },
            {
                keywords: ['pr', 'purchase request', 'stock in', 'buy'],
                answer: "Purchase Requests (PR) are for restocking. You can create a new request here.",
                action: { text: "Create PR", func: "openModal('m-create-pr')" }
            },
            {
                keywords: ['wr', 'withdrawal', 'stock out', 'release'],
                answer: "Use Withdrawal Requests (WR) to issue items to departments. Ensure stock is available first.",
                action: { text: "Create WR", func: "openModal('m-create-wr')" }
            },
            {
                keywords: ['disposal', 'waste', 'dispose'],
                answer: "Disposal logs require a source WR. You must withdraw the item first, then log it as waste.",
                action: { text: "Go to Disposal Log", func: "nav('disposal')" }
            },
            {
                keywords: ['export', 'report', 'print', 'pdf'],
                answer: "Advanced reporting and exporting (Excel/PDF) are handled in the Data Studio.",
                action: { text: "Open Material Exit Logs", func: "nav('material-exit-logs')" } // Example linking
            },
            {
                keywords: ['low stock', 'alert', 'running out'],
                answer: "Low stock items are highlighted in red on the Dashboard and Inventory list based on the limit set per item."
            },
            {
                keywords: ['job', 'maintenance', 'order'],
                answer: "Maintenance Job Orders track repairs. You can manage them in the Administration section.",
                action: { text: "View Job Orders", func: "window.location.href='joborders.html'" }
            }
        ];
    }

    // --- 2. UI RENDERING & STYLES ---

    injectStyles() {
        const style = `
            <style>
                /* Widget Container */
                #assistant-widget { position: fixed; bottom: 25px; right: 25px; z-index: 10000; font-family: 'Roboto', sans-serif; }
                
                /* Toggle Button */
                #assistant-btn { 
                    width: 60px; height: 60px; border-radius: 50%; 
                    background: linear-gradient(135deg, #2563eb, #1e3a8a); 
                    color: white; box-shadow: 0 8px 20px rgba(30, 58, 138, 0.4);
                    border: 2px solid white; cursor: pointer; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    display: flex; align-items: center; justify-content: center; font-size: 26px;
                }
                #assistant-btn:hover { transform: scale(1.05) translateY(-2px); box-shadow: 0 12px 25px rgba(30, 58, 138, 0.5); }
                #assistant-btn.active { transform: rotate(45deg); background: #334155; }
                
                /* Chat Window */
                #assistant-window {
                    position: absolute; bottom: 80px; right: 0; width: 360px; height: 550px;
                    background: #ffffff; border-radius: 20px; 
                    box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
                    display: flex; flex-direction: column; overflow: hidden;
                    transform-origin: bottom right; transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                    opacity: 0; pointer-events: none; transform: scale(0.8) translateY(20px);
                }
                #assistant-window.open { opacity: 1; pointer-events: all; transform: scale(1) translateY(0); }

                /* Header */
                .ast-header { 
                    background: linear-gradient(to right, #1e293b, #0f172a); 
                    color: white; padding: 18px; display: flex; align-items: center; justify-content: space-between; 
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }

                /* Body */
                .ast-body { flex: 1; overflow-y: auto; padding: 16px; background: #f1f5f9; display: flex; flex-direction: column; gap: 14px; }
                
                /* Messages */
                .msg { max-width: 85%; padding: 12px 16px; border-radius: 16px; font-size: 13.5px; line-height: 1.5; position: relative; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .msg-bot { background: white; border-bottom-left-radius: 4px; color: #334155; align-self: flex-start; border: 1px solid #e2e8f0; }
                .msg-user { background: #2563eb; color: white; border-bottom-right-radius: 4px; align-self: flex-end; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); }
                
                /* Action Button inside Chat */
                .msg-action-btn {
                    display: block; margin-top: 8px; padding: 8px 12px; 
                    background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;
                    border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
                    text-align: center; transition: all 0.2s;
                }
                .msg-action-btn:hover { background: #2563eb; color: white; border-color: #2563eb; }

                /* Typing Indicator */
                .typing-indicator { display: flex; gap: 4px; padding: 12px 16px; background: white; width: fit-content; border-radius: 16px; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; }
                .typing-dot { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }
                
                @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
                @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .anim-entry { animation: slideIn 0.3s ease-out forwards; }

                /* Footer */
                .ast-footer { padding: 12px; background: white; border-top: 1px solid #e2e8f0; }
                .ast-input-wrapper { display: flex; gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 24px; padding: 4px 6px 4px 16px; transition: border 0.2s; }
                .ast-input-wrapper:focus-within { border-color: #2563eb; background: white; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
                #ast-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; color: #334155; }
                
                /* Chips */
                .quick-chips-container { padding: 10px 16px 4px; background: #f8fafc; overflow-x: auto; white-space: nowrap; -ms-overflow-style: none; scrollbar-width: none; border-bottom: 1px solid #e2e8f0; }
                .quick-chips-container::-webkit-scrollbar { display: none; }
                .quick-chip { 
                    display: inline-block; font-size: 11px; font-weight: 500; padding: 6px 12px; 
                    background: white; border: 1px solid #cbd5e1; border-radius: 20px; color: #475569; 
                    cursor: pointer; margin-right: 6px; transition: all 0.2s;
                }
                .quick-chip:hover { border-color: #2563eb; color: #2563eb; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            </style>
        `;
        $('head').append(style);
    }

    renderUI() {
        const html = `
            <div id="assistant-widget">
                <div id="assistant-window">
                    <!-- Header -->
                    <div class="ast-header">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg border border-white/20">
                                <i class="fas fa-robot text-white text-sm"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-sm tracking-wide">System Assistant</h4>
                                <span class="text-[10px] text-emerald-300 font-medium flex items-center gap-1.5">
                                    <span class="relative flex h-2 w-2">
                                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Online
                                </span>
                            </div>
                        </div>
                        <button id="ast-reset" title="Clear Chat" class="text-slate-400 hover:text-white transition mr-2"><i class="fas fa-eraser"></i></button>
                    </div>

                    <!-- Messages Area -->
                    <div id="ast-messages" class="ast-body"></div>

                    <!-- Quick Suggestions -->
                    <div class="quick-chips-container" id="ast-chips"></div>

                    <!-- Input Area -->
                    <form id="ast-form" class="ast-footer">
                        <div class="ast-input-wrapper">
                            <input type="text" id="ast-input" placeholder="Type your question..." autocomplete="off">
                            <button type="submit" class="w-8 h-8 rounded-full bg-royal-600 text-white flex items-center justify-center hover:bg-royal-700 transition transform hover:scale-110">
                                <i class="fas fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Floating Trigger Button -->
                <button id="assistant-btn">
                    <i class="fas fa-comment-dots"></i>
                </button>
            </div>
        `;
        $('body').append(html);
    }

    // --- 3. EVENT HANDLING ---

    attachListeners() {
        // Toggle Open/Close
        $('#assistant-btn').on('click', () => this.toggleWindow());
        
        // Reset Chat
        $('#ast-reset').on('click', () => {
            $('#ast-messages').empty();
            const page = $('.page-section:not(.hidden)').attr('id');
            this.addMessage('bot', 'Chat history cleared.');
            setTimeout(() => this.sendWelcomeMessage(page), 500);
        });

        // Submit Question
        $('#ast-form').on('submit', (e) => {
            e.preventDefault();
            const input = $('#ast-input');
            const val = input.val().trim();
            if(val) {
                this.handleUserQuery(val);
                input.val('');
            }
        });

        // Handle Chip Clicks (Delegation)
        $(document).on('click', '.quick-chip', (e) => {
            const text = $(e.target).text();
            this.handleUserQuery(text);
        });
    }

    toggleWindow() {
        this.isOpen = !this.isOpen;
        const win = $('#assistant-window');
        const btn = $('#assistant-btn');
        const icon = $('#assistant-btn i');
        
        if(this.isOpen) {
            win.addClass('open');
            btn.addClass('active');
            icon.removeClass('fa-comment-dots').addClass('fa-times');
            setTimeout(() => $('#ast-input').focus(), 300);
            
            // Refresh stats in case they changed while closed
            this.refreshSuggestions();
        } else {
            win.removeClass('open');
            btn.removeClass('active');
            icon.removeClass('fa-times').addClass('fa-comment-dots');
        }
    }

    // --- 4. MESSAGING LOGIC ---

    sendWelcomeMessage(pageId) {
        let msg = "Hello! I'm here to assist you.";
        let suggestions = ['How to Create PR', 'Export Data', 'Show Low Stock'];

        // Contextual Greeting
        if (pageId === 'dashboard') {
            msg = "Welcome to the <b>Dashboard</b>. I can help you analyze trends or check alerts.";
            suggestions = ['Total Value?', 'Low Stock Items?', 'Go to Inventory'];
        } else if (pageId === 'inventory') {
            msg = "You are in <b>Inventory Control</b>. Need to add an item or search?";
            suggestions = ['Add New Item', 'How to Search?', 'Show Archived'];
        } else if (pageId === 'purchase') {
            msg = "Working on <b>Stock In (PR)</b>? I can guide you through the process.";
            suggestions = ['Create PR', 'PR Status meanings', 'Dashboard'];
        } else if (pageId === 'withdrawal') {
            msg = "Managing <b>Stock Out (WR)</b>. Remember to check stock levels first.";
            suggestions = ['Create Withdrawal', 'Check Stock', 'Disposal Log'];
        }

        this.addMessage('bot', msg);
        this.renderChips(suggestions);
    }

    refreshSuggestions() {
        const pageId = $('.page-section:not(.hidden)').attr('id');
        // Simple refresh of logic if needed when opening window
        if($('#ast-messages').children().length === 0) {
            this.sendWelcomeMessage(pageId);
        }
    }

    renderChips(chips) {
        const container = $('#ast-chips');
        container.empty();
        chips.forEach(text => {
            container.append(`<span class="quick-chip">${text}</span>`);
        });
    }

    addMessage(sender, text, action = null) {
        const container = $('#ast-messages');
        let content = text;
        
        // Add Action Button if provided
        if (action) {
            // We encode the function call safely
            content += `<button onclick="${action.func}" class="msg-action-btn"><i class="fas fa-external-link-alt mr-1"></i> ${action.text}</button>`;
        }

        const msgDiv = $(`<div class="msg msg-${sender} anim-entry">${content}</div>`);
        container.append(msgDiv);
        container.scrollTop(container[0].scrollHeight);
    }

    // --- 5. INTELLIGENCE & PROCESSING ---

    handleUserQuery(query) {
        this.addMessage('user', query);
        this.showTyping();

        // Simulate network/processing delay
        setTimeout(() => {
            this.removeTyping();
            const response = this.determineResponse(query);
            this.addMessage('bot', response.text, response.action);
        }, 700);
    }

    showTyping() {
        const container = $('#ast-messages');
        const typing = `
            <div class="typing-indicator" id="ast-typing">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        container.append(typing);
        container.scrollTop(container[0].scrollHeight);
    }

    removeTyping() {
        $('#ast-typing').remove();
    }

    determineResponse(query) {
        const q = query.toLowerCase();

        // 1. LIVE DATA QUERIES (Reading the DOM)
        if (q.includes('total items') || q.includes('how many items')) {
            const val = $('#d-items').text();
            return { text: `According to the dashboard, there are currently <b>${val}</b> unique items in the system.` };
        }
        
        if (q.includes('low stock') || q.includes('alert')) {
            const val = $('#d-low').text();
            const num = parseInt(val) || 0;
            if (num > 0) {
                return { 
                    text: `⚠️ Attention: You have <b>${val}</b> items with low stock alerts!`,
                    action: { text: "Check Dashboard", func: "nav('dashboard')" }
                };
            } else {
                return { text: "Good news! There are currently no low stock alerts." };
            }
        }

        if (q.includes('value') || q.includes('cost') || q.includes('worth')) {
             const val = $('#pr-total-value').text();
             return { text: `The total Year-To-Date (YTD) value of Purchase Requests is <b>${val}</b>.` };
        }

        // 2. NAVIGATION COMMANDS
        if (q.includes('go to') || q.includes('open') || q.includes('show')) {
            if (q.includes('dashboard')) return { text: "Navigating to Dashboard...", action: { text: "Go Now", func: "nav('dashboard')" }};
            if (q.includes('inventory')) return { text: "Opening Inventory List...", action: { text: "Go Now", func: "nav('inventory')" }};
            if (q.includes('pr') || q.includes('purchase')) return { text: "Opening Purchase Requests...", action: { text: "Go Now", func: "nav('purchase')" }};
            if (q.includes('wr') || q.includes('withdrawal')) return { text: "Opening Withdrawal Requests...", action: { text: "Go Now", func: "nav('withdrawal')" }};
            if (q.includes('setting') || q.includes('master')) return { text: "Opening Settings...", action: { text: "Go Now", func: "nav('settings')" }};
        }

        // 3. KNOWLEDGE BASE MATCHING
        for (const entry of this.knowledgeBase) {
            if (entry.keywords.some(k => q.includes(k))) {
                return { text: entry.answer, action: entry.action };
            }
        }

        // 4. FALLBACK
        return { 
            text: "I'm not sure about that. Try asking about 'Inventory', 'Creating PR', 'Disposal', or 'System Stats'.",
            action: null 
        };
    }
}