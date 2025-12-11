/**
 * CHAT.JS - Realtime Chat Extension
 * Technology: Vanilla JS (Client), Socket.io (Protocol)
 * Compatibility: Designed for NestJS Backend
 * Style: Facebook Messenger Clone
 */

(function () {
    // --- CONFIGURATION ---
    const BACKEND_URL = 'http://localhost:3000'; // Change this to your NestJS Port
    const THEME_COLOR = '#4f46e5'; // Matches your System Brand Color (Indigo-600)
    
    // --- LIBRARY INJECTION ---
    // We inject Socket.io client dynamically so you don't need to add it to HTML manually
    function loadScript(src, callback) {
        if (document.querySelector(`script[src="${src}"]`)) {
            if (callback) callback();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        document.head.appendChild(script);
    }

    // --- STYLES ---
    const styles = `
        #chat-widget-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .chat-toggle-btn {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${THEME_COLOR}, #312e81);
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .chat-toggle-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }
        .chat-toggle-btn i {
            color: white;
            font-size: 28px;
        }
        .chat-window {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 350px;
            height: 450px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid #e2e8f0;
        }
        .dark .chat-window {
            background: #1e293b;
            border-color: #334155;
        }
        .chat-window.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }
        .chat-header {
            background: ${THEME_COLOR};
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chat-body {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            background-color: #f8fafc;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .dark .chat-body {
            background-color: #0f172a;
        }
        .message {
            max-width: 80%;
            padding: 8px 12px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
            animation: fadeIn 0.2s ease-out;
        }
        .message.received {
            align-self: flex-start;
            background-color: #e2e8f0;
            color: #1e293b;
            border-bottom-left-radius: 4px;
        }
        .dark .message.received {
            background-color: #334155;
            color: #f1f5f9;
        }
        .message.sent {
            align-self: flex-end;
            background-color: ${THEME_COLOR};
            color: white;
            border-bottom-right-radius: 4px;
        }
        .chat-footer {
            padding: 12px;
            background: white;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .dark .chat-footer {
            background: #1e293b;
            border-color: #334155;
        }
        .chat-input {
            flex: 1;
            border: none;
            background: #f1f5f9;
            padding: 10px 15px;
            border-radius: 20px;
            outline: none;
            font-size: 14px;
        }
        .dark .chat-input {
            background: #334155;
            color: white;
        }
        .send-btn {
            background: transparent;
            border: none;
            color: ${THEME_COLOR};
            font-size: 18px;
            cursor: pointer;
            padding: 5px;
            transition: color 0.2s;
        }
        .send-btn:hover {
            color: #312e81;
        }
        .typing-indicator {
            font-size: 11px;
            color: #94a3b8;
            margin-left: 10px;
            margin-bottom: 5px;
            height: 15px;
            opacity: 0;
            transition: opacity 0.2s;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    `;

    // --- MAIN CLASS (REACT-LIKE STRUCTURE) ---
    class ChatWidget {
        constructor() {
            this.socket = null;
            this.isOpen = false;
            this.messages = [];
            this.user = { 
                id: 'user_' + Math.floor(Math.random() * 1000), 
                name: 'Logistics User' 
            };
            
            this.init();
        }

        init() {
            // 1. Inject Styles
            const styleSheet = document.createElement("style");
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);

            // 2. Load Socket.io then Render
            loadScript("https://cdn.socket.io/4.7.2/socket.io.min.js", () => {
                this.connectSocket();
                this.render();
                this.addEventListeners();
            });
        }

        connectSocket() {
            // Connect to NestJS Gateway
            try {
                this.socket = io(BACKEND_URL, { 
                    transports: ['websocket'],
                    autoConnect: true 
                });

                this.socket.on('connect', () => {
                    this.addSystemMessage('Connected to Transport Support.');
                });

                this.socket.on('disconnect', () => {
                    this.addSystemMessage('Disconnected. Reconnecting...');
                });

                // Listen for messages from Server
                this.socket.on('messageToClient', (payload) => {
                    // Avoid duplicating own messages if server broadcasts back to sender
                    if (payload.senderId !== this.user.id) {
                        this.addMessage(payload.text, 'received');
                    }
                });

            } catch (e) {
                console.warn("Chat Socket Server not found. Running in offline UI mode.");
                this.addSystemMessage("Offline Mode (Server unreachable)");
            }
        }

        toggleChat() {
            this.isOpen = !this.isOpen;
            const windowEl = document.getElementById('chat-window');
            const iconEl = document.getElementById('chat-icon');
            
            if (this.isOpen) {
                windowEl.classList.add('active');
                iconEl.classList.remove('fa-comment-dots');
                iconEl.classList.add('fa-chevron-down');
                // Focus input
                setTimeout(() => document.getElementById('chat-input-field').focus(), 300);
            } else {
                windowEl.classList.remove('active');
                iconEl.classList.remove('fa-chevron-down');
                iconEl.classList.add('fa-comment-dots');
            }
        }

        sendMessage() {
            const inputEl = document.getElementById('chat-input-field');
            const text = inputEl.value.trim();
            
            if (!text) return;

            // 1. Add to UI immediately (Optimistic UI)
            this.addMessage(text, 'sent');
            inputEl.value = '';

            // 2. Emit to NestJS Server
            if (this.socket && this.socket.connected) {
                this.socket.emit('messageToServer', {
                    senderId: this.user.id,
                    senderName: this.user.name,
                    text: text,
                    timestamp: new Date()
                });
            } else {
                // Simulate reply for demo if no server
                setTimeout(() => {
                    this.addMessage("Echo: " + text + " (Server Offline)", 'received');
                }, 1000);
            }
        }

        addMessage(text, type) {
            const body = document.getElementById('chat-body');
            const div = document.createElement('div');
            div.className = `message ${type}`;
            div.innerText = text;
            body.appendChild(div);
            this.scrollToBottom();
        }

        addSystemMessage(text) {
            const body = document.getElementById('chat-body');
            const div = document.createElement('div');
            div.style.cssText = "text-align: center; font-size: 10px; color: #94a3b8; margin: 5px 0;";
            div.innerText = text;
            body.appendChild(div);
            this.scrollToBottom();
        }

        scrollToBottom() {
            const body = document.getElementById('chat-body');
            body.scrollTop = body.scrollHeight;
        }

        render() {
            const container = document.createElement('div');
            container.id = 'chat-widget-container';
            
            container.innerHTML = `
                <!-- Chat Window -->
                <div id="chat-window" class="chat-window">
                    <div class="chat-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div>
                                <h4 style="font-weight: bold; margin: 0; font-size: 14px;">TRANS-SYSTEM Support</h4>
                                <p style="margin: 0; font-size: 11px; opacity: 0.8;">Active Now</p>
                            </div>
                        </div>
                        <button id="close-chat-btn" style="background:none; border:none; color:white; cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    
                    <div id="chat-body" class="chat-body">
                        <div style="text-align: center; margin-top: 20px; margin-bottom: 20px; opacity: 0.6;">
                            <i class="fas fa-truck-fast" style="font-size: 30px; color: #cbd5e1;"></i>
                            <p style="font-size: 12px; margin-top: 5px;">Welcome to Transportation Monitoring Chat</p>
                        </div>
                    </div>

                    <div id="typing-indicator" class="typing-indicator">Support is typing...</div>

                    <div class="chat-footer">
                        <input type="text" id="chat-input-field" class="chat-input" placeholder="Type a message..." autocomplete="off">
                        <button id="chat-send-btn" class="send-btn"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>

                <!-- Toggle Button -->
                <div id="chat-toggle-btn" class="chat-toggle-btn">
                    <i id="chat-icon" class="fas fa-comment-dots"></i>
                    <!-- Notification Badge -->
                    <span style="position: absolute; top: 0; right: 0; background: #ef4444; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; display: none;"></span>
                </div>
            `;

            document.body.appendChild(container);
        }

        addEventListeners() {
            // Toggle Chat
            document.getElementById('chat-toggle-btn').addEventListener('click', () => this.toggleChat());
            document.getElementById('close-chat-btn').addEventListener('click', () => this.toggleChat());

            // Send Message
            document.getElementById('chat-send-btn').addEventListener('click', () => this.sendMessage());

            // Input Enter Key
            document.getElementById('chat-input-field').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
    }

    // --- INITIALIZE ---
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new ChatWidget());
    } else {
        new ChatWidget();
    }

})();

/**
 * --- SERVER SIDE SETUP (NestJS) ---
 * 
 * To make this work with a NestJS Backend, install:
 * npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
 * 
 * Create a Gateway (chat.gateway.ts):
 * 
 * @WebSocketGateway({ cors: true })
 * export class ChatGateway {
 *   @WebSocketServer() server: Server;
 * 
 *   @SubscribeMessage('messageToServer')
 *   handleMessage(@MessageBody() payload: any): void {
 *     // Broadcast to everyone (or specific rooms)
 *     this.server.emit('messageToClient', payload);
 *   }
 * }
 */