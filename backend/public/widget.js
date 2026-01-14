/**
 * BAM.ai Embeddable Chat Widget
 * This script creates a floating chat widget that can be embedded on any website
 * 
 * Usage: 
 * <script src="https://app.bam.ai/widget.js" data-widget-id="YOUR_WIDGET_ID"></script>
 */

(function () {
    'use strict';

    // Configuration
    const API_BASE = window.BAM_API_URL || 'http://localhost:3001';
    const WIDGET_ID = document.currentScript?.getAttribute('data-widget-id') || 'demo-widget';

    // State
    let sessionId = null;
    let isOpen = false;
    let isLoading = false;
    let config = null;

    // Create widget container
    function createWidget() {
        const container = document.createElement('div');
        container.id = 'bam-widget-container';
        container.innerHTML = `
            <style>
                #bam-widget-container {
                    --bam-primary: #8b5cf6;
                    --bam-text: #1f2937;
                    --bam-bg: #ffffff;
                    --bam-border: #e5e7eb;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    position: fixed;
                    z-index: 999999;
                }
                
                #bam-widget-button {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: var(--bam-primary);
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }
                
                #bam-widget-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 25px rgba(139, 92, 246, 0.5);
                }
                
                #bam-widget-button svg {
                    width: 28px;
                    height: 28px;
                    fill: white;
                }
                
                #bam-widget-button.open svg.chat-icon { display: none; }
                #bam-widget-button:not(.open) svg.close-icon { display: none; }
                
                #bam-chat-window {
                    position: fixed;
                    bottom: 100px;
                    right: 24px;
                    width: 380px;
                    max-width: calc(100vw - 48px);
                    height: 520px;
                    max-height: calc(100vh - 140px);
                    background: var(--bam-bg);
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid var(--bam-border);
                }
                
                #bam-chat-window.open {
                    display: flex;
                    animation: bam-slide-up 0.3s ease;
                }
                
                @keyframes bam-slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                #bam-chat-header {
                    padding: 16px 20px;
                    background: var(--bam-primary);
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                #bam-chat-header .avatar {
                    width: 40px;
                    height: 40px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                }
                
                #bam-chat-header .info h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }
                
                #bam-chat-header .info p {
                    margin: 2px 0 0;
                    font-size: 12px;
                    opacity: 0.8;
                }
                
                #bam-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .bam-message {
                    max-width: 85%;
                    padding: 12px 16px;
                    border-radius: 16px;
                    line-height: 1.5;
                    font-size: 14px;
                }
                
                .bam-message.assistant {
                    background: #f3f4f6;
                    color: var(--bam-text);
                    align-self: flex-start;
                    border-bottom-left-radius: 4px;
                }
                
                .bam-message.user {
                    background: var(--bam-primary);
                    color: white;
                    align-self: flex-end;
                    border-bottom-right-radius: 4px;
                }
                
                .bam-message.system {
                    background: #fef3c7;
                    color: #92400e;
                    align-self: center;
                    font-size: 13px;
                    text-align: center;
                }
                
                .bam-suggested-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 8px;
                }
                
                .bam-suggested-actions button {
                    padding: 6px 12px;
                    background: white;
                    border: 1px solid var(--bam-primary);
                    color: var(--bam-primary);
                    border-radius: 16px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .bam-suggested-actions button:hover {
                    background: var(--bam-primary);
                    color: white;
                }
                
                #bam-typing {
                    display: none;
                    align-items: center;
                    gap: 4px;
                    padding: 12px 16px;
                    max-width: 60px;
                    background: #f3f4f6;
                    border-radius: 16px;
                    border-bottom-left-radius: 4px;
                }
                
                #bam-typing.show { display: flex; }
                
                #bam-typing span {
                    width: 8px;
                    height: 8px;
                    background: #9ca3af;
                    border-radius: 50%;
                    animation: bam-typing 1s infinite;
                }
                
                #bam-typing span:nth-child(2) { animation-delay: 0.2s; }
                #bam-typing span:nth-child(3) { animation-delay: 0.4s; }
                
                @keyframes bam-typing {
                    0%, 100% { opacity: 0.4; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1); }
                }
                
                #bam-input-container {
                    padding: 12px 16px;
                    border-top: 1px solid var(--bam-border);
                    display: flex;
                    gap: 12px;
                }
                
                #bam-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid var(--bam-border);
                    border-radius: 24px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                
                #bam-input:focus {
                    border-color: var(--bam-primary);
                }
                
                #bam-send {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: var(--bam-primary);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                
                #bam-send:hover {
                    background: #7c3aed;
                }
                
                #bam-send:disabled {
                    background: #d1d5db;
                    cursor: not-allowed;
                }
                
                #bam-send svg {
                    width: 20px;
                    height: 20px;
                    fill: white;
                }
                
                #bam-footer {
                    padding: 8px 16px;
                    text-align: center;
                    font-size: 11px;
                    color: #9ca3af;
                    border-top: 1px solid var(--bam-border);
                }
                
                #bam-footer a {
                    color: var(--bam-primary);
                    text-decoration: none;
                }
            </style>
            
            <button id="bam-widget-button" aria-label="Open chat">
                <svg class="chat-icon" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <svg class="close-icon" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
            
            <div id="bam-chat-window">
                <div id="bam-chat-header">
                    <div class="avatar">✨</div>
                    <div class="info">
                        <h3 id="bam-agent-name">BAM Assistant</h3>
                        <p>Online • Usually replies instantly</p>
                    </div>
                </div>
                
                <div id="bam-messages"></div>
                
                <div id="bam-input-container">
                    <input type="text" id="bam-input" placeholder="Type your message..." />
                    <button id="bam-send" disabled>
                        <svg viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
                
                <div id="bam-footer">
                    Powered by <a href="https://bam.ai" target="_blank">BAM.ai</a>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Get elements
        const button = document.getElementById('bam-widget-button');
        const chatWindow = document.getElementById('bam-chat-window');
        const messagesDiv = document.getElementById('bam-messages');
        const input = document.getElementById('bam-input');
        const sendBtn = document.getElementById('bam-send');

        // Event listeners
        button.addEventListener('click', toggleWidget);
        input.addEventListener('input', () => {
            sendBtn.disabled = !input.value.trim();
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                sendMessage(input.value.trim());
            }
        });
        sendBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                sendMessage(input.value.trim());
            }
        });
    }

    // Toggle widget open/close
    async function toggleWidget() {
        const button = document.getElementById('bam-widget-button');
        const chatWindow = document.getElementById('bam-chat-window');

        isOpen = !isOpen;
        button.classList.toggle('open', isOpen);
        chatWindow.classList.toggle('open', isOpen);

        if (isOpen && !sessionId) {
            await startSession();
        }

        if (isOpen) {
            document.getElementById('bam-input').focus();
        }
    }

    // Fetch widget config
    async function fetchConfig() {
        try {
            const response = await fetch(`${API_BASE}/api/widget/${WIDGET_ID}/config`);
            const data = await response.json();
            if (data.success) {
                config = data.config;
                applyConfig(config);
            }
        } catch (error) {
            console.error('BAM Widget: Failed to fetch config', error);
        }
    }

    // Apply config to widget
    function applyConfig(cfg) {
        const container = document.getElementById('bam-widget-container');
        if (cfg.primaryColor) {
            container.style.setProperty('--bam-primary', cfg.primaryColor);
        }
        if (cfg.agentName) {
            document.getElementById('bam-agent-name').textContent = cfg.agentName;
        }
        if (cfg.placeholderText) {
            document.getElementById('bam-input').placeholder = cfg.placeholderText;
        }
    }

    // Start chat session
    async function startSession() {
        try {
            const response = await fetch(`${API_BASE}/api/widget/${WIDGET_ID}/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (data.success) {
                sessionId = data.sessionId;
                addMessage('assistant', data.greeting);
            }
        } catch (error) {
            console.error('BAM Widget: Failed to start session', error);
            addMessage('system', 'Unable to connect. Please try again later.');
        }
    }

    // Send message
    async function sendMessage(text) {
        if (isLoading || !sessionId) return;

        const input = document.getElementById('bam-input');
        const sendBtn = document.getElementById('bam-send');

        input.value = '';
        sendBtn.disabled = true;

        addMessage('user', text);
        showTyping(true);
        isLoading = true;

        try {
            const response = await fetch(`${API_BASE}/api/widget/${WIDGET_ID}/session/${sessionId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();

            showTyping(false);

            if (data.success) {
                addMessage('assistant', data.message.content, data.message.suggestedActions);
            } else {
                addMessage('system', 'Sorry, something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('BAM Widget: Failed to send message', error);
            showTyping(false);
            addMessage('system', 'Unable to send message. Please try again.');
        } finally {
            isLoading = false;
        }
    }

    // Add message to chat
    function addMessage(role, content, suggestedActions) {
        const messagesDiv = document.getElementById('bam-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `bam-message ${role}`;
        messageDiv.textContent = content;

        if (suggestedActions && suggestedActions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'bam-suggested-actions';
            suggestedActions.forEach(action => {
                const btn = document.createElement('button');
                btn.textContent = action;
                btn.addEventListener('click', () => sendMessage(action));
                actionsDiv.appendChild(btn);
            });
            messageDiv.appendChild(actionsDiv);
        }

        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Show/hide typing indicator
    function showTyping(show) {
        let typing = document.getElementById('bam-typing');
        if (!typing && show) {
            typing = document.createElement('div');
            typing.id = 'bam-typing';
            typing.innerHTML = '<span></span><span></span><span></span>';
            document.getElementById('bam-messages').appendChild(typing);
        }
        if (typing) {
            typing.classList.toggle('show', show);
            if (show) {
                typing.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    // Initialize
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                createWidget();
                fetchConfig();
            });
        } else {
            createWidget();
            fetchConfig();
        }
    }

    init();
})();
