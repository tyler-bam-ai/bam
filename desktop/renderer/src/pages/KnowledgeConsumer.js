/**
 * BAM Brains - 3 Specialized AI Brains
 * 
 * 1. Operations Brain - Trained on EOS methodology
 * 2. Employee Brain - Trained on GH Smart methodology  
 * 3. Branding Brain - Trained on Donald Miller, Seth Godin, Alex Hormozi
 */

import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useClientContext } from '../contexts/ClientContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    MessageSquare,
    Mic,
    Briefcase,
    Users,
    Megaphone,
    LifeBuoy,
    Send,
    Paperclip,
    Loader2,
    Bot,
    User,
    Volume2,
    VolumeX,
    Copy,
    Check,
    ThumbsUp,
    ThumbsDown,
    RotateCcw,
    Plus,
    Clock,
    Search,
    Pin,
    Trash2,
    ChevronRight
} from 'lucide-react';
import { useDemoMode } from '../contexts/DemoModeContext';
import './KnowledgeConsumer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Brain configurations with pre-prompts
const BRAIN_CONFIG = {
    operations: {
        id: 'operations',
        name: 'Operations Brain',
        icon: Briefcase,
        color: '#3b82f6',
        description: 'Day-to-day operations, processes, and FAQs',
        trainedOn: 'EOS (Entrepreneurial Operating System)',
        systemPrompt: `You are an Operations AI assistant trained on the EOS (Entrepreneurial Operating System) methodology. 
You help employees understand day-to-day operations, company processes, and answer frequently asked questions about how the business runs.

Your expertise includes:
- Standard operating procedures
- Process workflows
- Inventory management
- Customer service protocols
- Quality control procedures
- Daily/weekly/monthly routines
- Troubleshooting common issues

Always be practical, step-by-step, and reference company-specific processes when available.
If you don't know a specific company procedure, say so and provide general best practices based on EOS principles.`,
        welcomeMessage: `Hello! I'm your **Operations Brain**, trained to help you with day-to-day business processes.

I can help you with:
- 📋 Standard operating procedures
- 🔄 Process workflows and protocols
- ❓ Frequently asked questions
- 🛠️ Troubleshooting common issues

What operational question can I help you with today?`
    },
    employee: {
        id: 'employee',
        name: 'Employee Brain',
        icon: Users,
        color: '#22c55e',
        description: 'Hiring, culture, core values, and HR',
        trainedOn: 'GH Smart methodology',
        systemPrompt: `You are an Employee & Culture AI assistant trained on the GH Smart "Who" methodology for hiring A-players.
You help with hiring decisions, cultural fit assessment, core values, and HR-related questions.

Your expertise includes:
- Creating job scorecards
- Designing interview questions
- Evaluating candidates against core values
- Onboarding new employees
- Performance management
- Culture and team dynamics
- Core values interpretation

Use the A-Method for Hiring principles: Scorecard, Source, Select, Sell.
Always tie recommendations back to company core values when available.`,
        welcomeMessage: `Hello! I'm your **Employee Brain**, trained to help with hiring and culture.

I can help you with:
- 📝 Creating job postings and scorecards
- 🎯 Interview questions for specific roles
- ✅ Evaluating candidates against core values
- 🤝 Onboarding and culture questions

What can I help you with regarding your team?`
    },
    branding: {
        id: 'branding',
        name: 'Branding Brain',
        icon: Megaphone,
        color: '#f59e0b',
        description: 'Marketing, sales, and brand voice',
        trainedOn: 'Donald Miller, Seth Godin, Alex Hormozi',
        systemPrompt: `You are a Branding & Marketing AI assistant trained on the methodologies of Donald Miller (StoryBrand), Seth Godin (Purple Cow, Permission Marketing), and Alex Hormozi ($100M Offers).

Your expertise includes:
- Brand messaging and voice
- StoryBrand framework (hero, problem, guide, plan, call to action)
- Creating compelling offers
- Marketing copy and content
- Sales messaging
- Value proposition development
- Customer journey mapping

Always write in the company's brand voice when known.
Create messages that position the customer as the hero and the company as the guide.
Focus on transformation and outcomes, not just features.`,
        welcomeMessage: `Hello! I'm your **Branding Brain**, trained to help with marketing and brand voice.

I can help you with:
- ✍️ Writing in your brand voice
- 📢 Marketing messages and copy
- 💰 Creating compelling offers
- 🎯 Sales messaging and emails

What marketing or branding task can I help you with?`
    },
    support: {
        id: 'support',
        name: 'BAM Support',
        icon: LifeBuoy,
        color: '#8b5cf6',
        description: 'Help using BAM.ai software',
        trainedOn: 'BAM.ai Documentation',
        systemPrompt: `You are a BAM.ai Support assistant, trained to help users understand and use the BAM.ai software effectively.

Your expertise includes:
- Navigating the BAM.ai interface
- Using Brain Training features (document upload, voice memos, screen recording)
- Understanding the 3 specialized brains (Operations, Employee, Branding)
- Content Engine and social media features
- Admin panel and client management
- Troubleshooting common issues
- Best practices for training your AI

Always be friendly, helpful, and provide step-by-step guidance.
If you don't know something, recommend contacting BAM support.`,
        welcomeMessage: `Hello! I'm **BAM Support**, here to help you get the most out of BAM.ai.

I can help you with:
- 🧭 Navigating the app
- 📚 Training your AI brain
- 💬 Using the BAM brains effectively
- 🔧 Troubleshooting issues
- 💡 Tips and best practices

What can I help you with today?`
    }
};

// Demo conversations for each brain
const DEMO_CONVERSATIONS = {
    operations: [
        {
            id: 'ops-1',
            title: 'Customer Refund Process',
            pinned: true,
            lastMessage: 'To process a refund, first open QuickBooks...',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            messages: [
                { id: 1, role: 'assistant', content: BRAIN_CONFIG.operations.welcomeMessage, timestamp: new Date(Date.now() - 86400000).toISOString() },
                { id: 2, role: 'user', content: 'How do I process a customer refund?', timestamp: new Date(Date.now() - 86300000).toISOString() },
                { id: 3, role: 'assistant', content: `Great question! Here's the step-by-step process for handling customer refunds:\n\n### Refund Process\n\n1. **Open QuickBooks** → Navigate to Customers > Customer Center\n2. **Find the original transaction** → Search by customer name or invoice number\n3. **Click "Create Refund"** from the actions menu\n4. **Enter refund details:**\n   - Amount (full or partial)\n   - Reason code\n   - Payment method\n5. **Submit** → Refund processes in 3-5 business days\n\n> 💡 **Pro tip:** Always document the reason in the notes field for tracking.\n\nIs there anything specific about this process you'd like me to clarify?`, timestamp: new Date(Date.now() - 86200000).toISOString() }
            ]
        },
        {
            id: 'ops-2',
            title: 'Inventory Management',
            pinned: false,
            lastMessage: 'Weekly inventory counts should be done...',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            messages: []
        }
    ],
    employee: [
        {
            id: 'emp-1',
            title: 'Sales Rep Hiring',
            pinned: true,
            lastMessage: 'Key interview questions for sales candidates...',
            timestamp: new Date(Date.now() - 43200000).toISOString(),
            messages: [
                { id: 1, role: 'assistant', content: BRAIN_CONFIG.employee.welcomeMessage, timestamp: new Date(Date.now() - 43200000).toISOString() },
                { id: 2, role: 'user', content: 'What interview questions should I ask for a sales rep position?', timestamp: new Date(Date.now() - 43100000).toISOString() },
                { id: 3, role: 'assistant', content: `Based on the GH Smart methodology, here are the key interview questions for a sales rep:\n\n### Screening Questions\n1. **"Walk me through your career. What are you most proud of?"**\n2. **"Tell me about a time you exceeded quota. What was your approach?"**\n\n### Competency Questions\n| Competency | Question |\n|------------|----------|\n| Persistence | "Describe your longest sales cycle. How did you maintain momentum?" |\n| Relationship Building | "How do you turn a cold lead into a loyal customer?" |\n| Closing | "Walk me through your closing process step by step." |\n\n### Core Values Alignment\n- "Give me an example of when you prioritized customer success over a quick sale."\n- "How do you handle a situation where a product isn't the right fit?"\n\n### Red Flags to Watch For:\n- 🚩 Blames others for missed quotas\n- 🚩 Can't give specific numbers\n- 🚩 Focused only on commission, not customer outcomes\n\nWould you like me to create a full scorecard for this role?`, timestamp: new Date(Date.now() - 43000000).toISOString() }
            ]
        }
    ],
    branding: [
        {
            id: 'brand-1',
            title: 'Service Launch Email',
            pinned: true,
            lastMessage: 'Here\'s an email announcing your new service...',
            timestamp: new Date(Date.now() - 21600000).toISOString(),
            messages: [
                { id: 1, role: 'assistant', content: BRAIN_CONFIG.branding.welcomeMessage, timestamp: new Date(Date.now() - 21600000).toISOString() },
                { id: 2, role: 'user', content: 'Write an email announcing our new consulting service', timestamp: new Date(Date.now() - 21500000).toISOString() },
                { id: 3, role: 'assistant', content: `Here's an email using the StoryBrand framework:\n\n---\n\n**Subject:** Stop guessing. Start growing.\n\n---\n\nHi [First Name],\n\nRunning a business shouldn't feel like solving a puzzle blindfolded.\n\nBut that's exactly how it feels when you're:\n- Making decisions without clear data\n- Watching competitors pass you by\n- Working harder but not seeing results\n\n**There's a better way.**\n\nWe've just launched our **Strategic Growth Consulting** service—designed specifically for business owners who are ready to stop guessing and start scaling.\n\nHere's what you get:\n✅ A clear 90-day growth roadmap\n✅ Weekly accountability calls\n✅ Data-driven decision frameworks\n✅ Access to our proven systems\n\n**The first 5 clients get 20% off.**\n\n[Schedule Your Free Strategy Call →]\n\nLet's turn your hard work into real results.\n\n— The [Company] Team\n\n---\n\nWant me to adjust the tone or add anything specific?`, timestamp: new Date(Date.now() - 21400000).toISOString() }
            ]
        }
    ],
    support: [
        {
            id: 'support-1',
            title: 'How to Train My Brain',
            pinned: true,
            lastMessage: 'To train your AI brain, go to Brain Training...',
            timestamp: new Date(Date.now() - 10800000).toISOString(),
            messages: [
                { id: 1, role: 'assistant', content: BRAIN_CONFIG.support.welcomeMessage, timestamp: new Date(Date.now() - 10800000).toISOString() },
                { id: 2, role: 'user', content: 'How do I train my AI brain?', timestamp: new Date(Date.now() - 10700000).toISOString() },
                { id: 3, role: 'assistant', content: `Great question! Here's how to train your AI brain in BAM.ai:\n\n### 3 Ways to Train Your Brain\n\n1. **📄 Upload Documents**\n   - Go to **Brain Training** → **Documents**\n   - Drag and drop PDFs, Word docs, or text files\n   - The AI extracts knowledge automatically\n\n2. **🎙️ Voice Memos**\n   - Go to **Brain Training** → **Voice Memos**\n   - Click the microphone to record explanations\n   - Perfect for capturing how-to knowledge\n\n3. **🖥️ Screen Recording**\n   - Go to **Brain Training** → **Screen Recording**\n   - Show the AI how you do tasks visually\n   - Great for software workflows\n\n> 💡 **Tip:** Watch your Knowledge Score go up as you add more training data!\n\nWould you like help with any specific training method?`, timestamp: new Date(Date.now() - 10600000).toISOString() }
            ]
        }
    ]
};

// Auto-route to appropriate brain based on message content
const AUTO_ROUTE_KEYWORDS = {
    operations: [
        'process', 'procedure', 'workflow', 'sop', 'operations', 'inventory', 'supply',
        'refund', 'return', 'shipping', 'order', 'customer service', 'troubleshoot',
        'how do we', 'what is the process', 'eos', 'rocks', 'scorecard', 'l10', 'issues',
        'meeting', 'weekly', 'quarterly', 'annual', 'accountability', 'metrics', 'kpi',
        'faq', 'help desk', 'support ticket', 'complaint', 'escalation'
    ],
    employee: [
        'hire', 'hiring', 'recruit', 'recruiting', 'interview', 'candidate', 'job',
        'onboard', 'onboarding', 'training', 'culture', 'core values', 'employee',
        'team', 'staff', 'personnel', 'hr', 'human resources', 'performance review',
        'ghsmart', 'a player', 'scorecard', 'topgrading', 'who method', 'reference check',
        'job description', 'role', 'position', 'salary', 'compensation', 'benefits',
        'fire', 'terminate', 'let go', 'exit', 'offboard'
    ],
    branding: [
        'marketing', 'brand', 'branding', 'logo', 'slogan', 'tagline', 'copy',
        'ad', 'advertisement', 'campaign', 'social media', 'post', 'content',
        'email', 'newsletter', 'sales', 'pitch', 'offer', 'pricing', 'launch',
        'story', 'storytelling', 'message', 'voice', 'tone', 'audience',
        'donald miller', 'storybrand', 'seth godin', 'alex hormozi', 'copywriting',
        'headline', 'cta', 'call to action', 'landing page', 'website copy'
    ]
};

function determineBrainFromMessage(message) {
    if (!message) return null;

    const lowerMessage = message.toLowerCase();
    const scores = { operations: 0, employee: 0, branding: 0 };

    // Score each brain based on keyword matches
    Object.entries(AUTO_ROUTE_KEYWORDS).forEach(([brain, keywords]) => {
        keywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) {
                scores[brain] += keyword.split(' ').length; // Multi-word keywords score higher
            }
        });
    });

    // Find the brain with highest score
    const maxScore = Math.max(scores.operations, scores.employee, scores.branding);
    if (maxScore === 0) return null; // No clear match

    if (scores.operations === maxScore) return 'operations';
    if (scores.employee === maxScore) return 'employee';
    if (scores.branding === maxScore) return 'branding';

    return null;
}

// Single Brain Chat Component
function BrainChat({ brainId }) {
    const { isDemoMode } = useDemoMode();
    const { selectedClient, isClientSelected } = useClientContext();
    const navigate = useNavigate();
    const brain = BRAIN_CONFIG[brainId];

    // Storage key for this brain's conversations
    const storageKey = `bam_brain_${brainId}_conversations`;

    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showVoice, setShowVoice] = useState(false);
    const [autoSwitchBanner, setAutoSwitchBanner] = useState(null);
    const messagesEndRef = useRef(null);
    const hasLoadedRef = useRef(false);

    // Load saved conversations on mount OR demo data
    useEffect(() => {
        if (isDemoMode) {
            const demoConvos = DEMO_CONVERSATIONS[brainId] || [];
            setConversations(demoConvos);
            if (demoConvos.length > 0) {
                setActiveConversation(demoConvos[0]);
                setMessages(demoConvos[0].messages || []);
            } else {
                startNewConversation();
            }
        } else {
            // Load from localStorage
            const saved = localStorage.getItem(storageKey);
            if (saved && !hasLoadedRef.current) {
                try {
                    const parsed = JSON.parse(saved);
                    setConversations(parsed.conversations || []);
                    if (parsed.activeId && parsed.conversations) {
                        const active = parsed.conversations.find(c => c.id === parsed.activeId);
                        if (active) {
                            setActiveConversation(active);
                            setMessages(active.messages || []);
                        } else {
                            startNewConversation();
                        }
                    } else if (parsed.conversations?.length > 0) {
                        setActiveConversation(parsed.conversations[0]);
                        setMessages(parsed.conversations[0].messages || []);
                    } else {
                        startNewConversation();
                    }
                    console.log('[BRAIN] Restored conversations from localStorage:', parsed.conversations?.length || 0);
                } catch (e) {
                    console.error('Failed to load brain conversations:', e);
                    startNewConversation();
                }
            } else if (!hasLoadedRef.current) {
                startNewConversation();
            }
            hasLoadedRef.current = true;
        }
    }, [isDemoMode, brainId]);

    // Save conversations to localStorage whenever they change
    useEffect(() => {
        if (!isDemoMode && conversations.length > 0) {
            const dataToSave = {
                conversations,
                activeId: activeConversation?.id,
                lastModified: new Date().toISOString()
            };
            localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        }
    }, [conversations, activeConversation, isDemoMode, storageKey]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Check for pending message from brain auto-switch
    useEffect(() => {
        const pendingMessage = sessionStorage.getItem('pendingBrainMessage');
        if (pendingMessage) {
            sessionStorage.removeItem('pendingBrainMessage');
            setInput(pendingMessage);
            // Show auto-switch notification
            setAutoSwitchBanner(`Switched to ${brain.name} for this question`);
            setTimeout(() => setAutoSwitchBanner(null), 3000);
        }
    }, [brainId]);

    const startNewConversation = () => {
        const newConvo = {
            id: `${brainId}-${Date.now()}`,
            title: 'New Conversation',
            pinned: false,
            lastMessage: '',
            timestamp: new Date().toISOString(),
            messages: []
        };

        const welcomeMessage = {
            id: 1,
            role: 'assistant',
            content: brain.welcomeMessage,
            timestamp: new Date().toISOString()
        };

        newConvo.messages = [welcomeMessage];
        setConversations(prev => [newConvo, ...prev]);
        setActiveConversation(newConvo);
        setMessages([welcomeMessage]);
    };

    const selectConversation = (convo) => {
        setActiveConversation(convo);
        setMessages(convo.messages || [{ id: 1, role: 'assistant', content: brain.welcomeMessage, timestamp: new Date().toISOString() }]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // Auto-detect and switch to the most appropriate brain
        const suggestedBrain = determineBrainFromMessage(input.trim());
        if (suggestedBrain && suggestedBrain !== brainId) {
            // Show banner and navigate to the appropriate brain
            const targetBrain = BRAIN_CONFIG[suggestedBrain];
            console.log(`[AUTO-SWITCH] Detected ${suggestedBrain} brain is better suited for: "${input.trim().substring(0, 50)}..."`);

            // Store the message in sessionStorage to send after navigation
            sessionStorage.setItem('pendingBrainMessage', input.trim());

            // Navigate to the appropriate brain
            const path = suggestedBrain === 'operations' ? '/consumer' : `/consumer/${suggestedBrain}`;
            navigate(path);
            return; // Message will be sent after navigation
        }

        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Update conversation title if it's the first user message
        if (activeConversation && activeConversation.title === 'New Conversation') {
            const newTitle = input.trim().slice(0, 40) + (input.length > 40 ? '...' : '');
            setActiveConversation(prev => ({ ...prev, title: newTitle }));
            setConversations(prev => prev.map(c =>
                c.id === activeConversation.id ? { ...c, title: newTitle } : c
            ));
        }

        // Call real chat API
        try {
            const token = localStorage.getItem('token');
            // Get OpenAI API key for GPT-4o brain responses
            let openaiKey = localStorage.getItem('openai_api_key');
            if (!openaiKey && window.electronAPI?.apiKeys?.get) {
                openaiKey = await window.electronAPI.apiKeys.get('openai');
            }

            const response = await fetch('http://localhost:3001/api/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...(openaiKey && { 'X-OpenAI-Key': openaiKey })
                },
                body: JSON.stringify({
                    messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: input.trim() }],
                    conversationId: activeConversation?.id,
                    brainType: brainId,
                    clientId: selectedClient?.id || undefined
                })
            });

            if (response.ok) {
                const data = await response.json();
                const assistantMessage = {
                    id: Date.now(),
                    role: 'assistant',
                    content: data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.',
                    timestamp: new Date().toISOString(),
                    metadata: data.metadata
                };

                setMessages(prev => [...prev, assistantMessage]);

                // Update conversation
                setConversations(prev => prev.map(c =>
                    c.id === activeConversation?.id
                        ? { ...c, lastMessage: assistantMessage.content.slice(0, 50), messages: [...(c.messages || []), userMessage, assistantMessage] }
                        : c
                ));
            } else {
                // Fallback to demo response if API fails
                const responses = getBrainResponse(brainId, input);
                const assistantMessage = {
                    id: Date.now(),
                    role: 'assistant',
                    content: responses[Math.floor(Math.random() * responses.length)],
                    timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, assistantMessage]);
                setConversations(prev => prev.map(c =>
                    c.id === activeConversation?.id
                        ? { ...c, lastMessage: assistantMessage.content.slice(0, 50), messages: [...(c.messages || []), userMessage, assistantMessage] }
                        : c
                ));
            }
        } catch (error) {
            console.error('Chat API error:', error);
            // Fallback to demo response
            const responses = getBrainResponse(brainId, input);
            const assistantMessage = {
                id: Date.now(),
                role: 'assistant',
                content: responses[Math.floor(Math.random() * responses.length)],
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setConversations(prev => prev.map(c =>
                c.id === activeConversation?.id
                    ? { ...c, lastMessage: assistantMessage.content.slice(0, 50), messages: [...(c.messages || []), userMessage, assistantMessage] }
                    : c
            ));
        }

        setIsLoading(false);
    };

    const handleCopy = async (content, id) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const togglePin = (convoId) => {
        setConversations(prev => prev.map(c =>
            c.id === convoId ? { ...c, pinned: !c.pinned } : c
        ));
    };

    const deleteConversation = (convoId) => {
        setConversations(prev => prev.filter(c => c.id !== convoId));
        if (activeConversation?.id === convoId) {
            startNewConversation();
        }
    };

    const filteredConversations = conversations.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pinnedConvos = filteredConversations.filter(c => c.pinned);
    const recentConvos = filteredConversations.filter(c => !c.pinned);

    const BrainIcon = brain.icon;

    return (
        <div className="brain-chat-container">
            {/* Conversation Sidebar */}
            <div className="conversation-sidebar">
                <div className="sidebar-header">
                    <button className="new-chat-btn" onClick={startNewConversation}>
                        <Plus size={18} />
                        New Chat
                    </button>
                </div>

                {/* Client Context Indicator - shows which client's data the brain uses */}
                {isClientSelected ? (
                    <div className="client-indicator" style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.1))'
                    }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            Client Context
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--accent-primary)' }}>
                            🏢 {selectedClient?.companyName || 'Unknown'}
                        </div>
                    </div>
                ) : (
                    <div className="client-indicator" style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        background: 'rgba(245, 158, 11, 0.1)'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                            ⚠️ No client selected
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            Select a client in Admin → Clients
                        </div>
                    </div>
                )}

                <div className="sidebar-search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="conversation-list">
                    {pinnedConvos.length > 0 && (
                        <div className="conversation-group">
                            <div className="group-label"><Pin size={12} /> Pinned</div>
                            {pinnedConvos.map(convo => (
                                <div
                                    key={convo.id}
                                    className={`conversation-item ${activeConversation?.id === convo.id ? 'active' : ''}`}
                                    onClick={() => selectConversation(convo)}
                                >
                                    <div className="convo-content">
                                        <span className="convo-title">{convo.title}</span>
                                        <span className="convo-preview">{convo.lastMessage}</span>
                                    </div>
                                    <div className="convo-actions">
                                        <button onClick={(e) => { e.stopPropagation(); togglePin(convo.id); }}>
                                            <Pin size={14} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {recentConvos.length > 0 && (
                        <div className="conversation-group">
                            <div className="group-label"><Clock size={12} /> Recent</div>
                            {recentConvos.map(convo => (
                                <div
                                    key={convo.id}
                                    className={`conversation-item ${activeConversation?.id === convo.id ? 'active' : ''}`}
                                    onClick={() => selectConversation(convo)}
                                >
                                    <div className="convo-content">
                                        <span className="convo-title">{convo.title}</span>
                                        <span className="convo-preview">{convo.lastMessage}</span>
                                    </div>
                                    <div className="convo-actions">
                                        <button onClick={(e) => { e.stopPropagation(); togglePin(convo.id); }}>
                                            <Pin size={14} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {filteredConversations.length === 0 && (
                        <div className="no-conversations">
                            <MessageSquare size={24} />
                            <p>No conversations yet</p>
                            <span>Start a new chat to begin</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="brain-chat-main">
                {/* Auto-switch Banner */}
                {autoSwitchBanner && (
                    <div className="auto-switch-banner" style={{ backgroundColor: brain.color }}>
                        🧠 {autoSwitchBanner}
                    </div>
                )}
                {/* Brain Header */}
                <div className="brain-header" style={{ borderColor: brain.color }}>
                    <div className="brain-info">
                        <div className="brain-icon" style={{ backgroundColor: `${brain.color}20`, color: brain.color }}>
                            <BrainIcon size={24} />
                        </div>
                        <div>
                            <h2>{brain.name}</h2>
                            <p>{brain.description}</p>
                        </div>
                    </div>
                    <div className="brain-trained">
                        <span>Trained on: {brain.trainedOn}</span>
                    </div>
                    <div className="chat-mode-toggle">
                        <button
                            className={`mode-btn ${!showVoice ? 'active' : ''}`}
                            onClick={() => setShowVoice(false)}
                        >
                            <MessageSquare size={16} /> Type
                        </button>
                        <button
                            className={`mode-btn ${showVoice ? 'active' : ''}`}
                            onClick={() => setShowVoice(true)}
                        >
                            <Mic size={16} /> Voice
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chat-messages">
                    {messages.map((message) => (
                        <div key={message.id} className={`message ${message.role}`}>
                            <div className="message-avatar" style={message.role === 'assistant' ? { backgroundColor: `${brain.color}20`, color: brain.color } : {}}>
                                {message.role === 'assistant' ? <BrainIcon size={20} /> : <User size={20} />}
                            </div>
                            <div className="message-content">
                                <div className="message-header">
                                    <span className="message-sender">
                                        {message.role === 'assistant' ? brain.name : 'You'}
                                    </span>
                                    <span className="message-time">
                                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="message-body">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {message.content}
                                    </ReactMarkdown>
                                </div>
                                {message.role === 'assistant' && (
                                    <div className="message-actions">
                                        <button className="action-btn" onClick={() => handleCopy(message.content, message.id)}>
                                            {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                        <button className="action-btn"><ThumbsUp size={14} /></button>
                                        <button className="action-btn"><ThumbsDown size={14} /></button>
                                        <button className="action-btn"><RotateCcw size={14} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="message assistant">
                            <div className="message-avatar" style={{ backgroundColor: `${brain.color}20`, color: brain.color }}>
                                <BrainIcon size={20} />
                            </div>
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                {!showVoice ? (
                    <form className="chat-input-form" onSubmit={handleSubmit}>
                        <div className="chat-input-wrapper">
                            <button type="button" className="btn btn-ghost btn-icon attach-btn">
                                <Paperclip size={18} />
                            </button>
                            <textarea
                                className="chat-input"
                                placeholder={`Ask ${brain.name} anything...`}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                rows={1}
                            />
                            <button type="submit" className="btn btn-primary btn-icon send-btn" disabled={!input.trim() || isLoading}>
                                {isLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                            </button>
                        </div>
                    </form>
                ) : (
                    <VoiceInput brain={brain} onTranscript={(text) => { setInput(text); setShowVoice(false); }} />
                )}
            </div>
        </div>
    );
}

// Voice Input Component
function VoiceInput({ brain, onTranscript }) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');

    const toggleListening = () => {
        if (isListening) {
            // Stop and send transcript
            if (transcript) {
                onTranscript(transcript);
            }
            setIsListening(false);
            setTranscript('');
        } else {
            setIsListening(true);
            // Simulate voice recognition
            setTimeout(() => {
                setTranscript('How do I handle this situation?');
            }, 2000);
        }
    };

    return (
        <div className="voice-input-panel">
            <div className={`voice-orb ${isListening ? 'listening' : ''}`} style={{ '--brain-color': brain.color }}>
                <button onClick={toggleListening}>
                    {isListening ? <VolumeX size={32} /> : <Mic size={32} />}
                </button>
            </div>
            {isListening && (
                <div className="voice-transcript">
                    <p>{transcript || 'Listening...'}</p>
                </div>
            )}
            <p className="voice-hint">
                {isListening ? 'Click to stop and send' : `Click to speak to ${brain.name}`}
            </p>
        </div>
    );
}

// Helper function to get brain-specific responses
function getBrainResponse(brainId, question) {
    const responses = {
        operations: [
            `Based on our standard operating procedures:\n\n### Process Overview\n\n1. **First**, verify the request is valid\n2. **Then**, follow the documented workflow\n3. **Finally**, document the outcome\n\n> 💡 This follows EOS principles of clear accountability and documented processes.\n\nWould you like me to elaborate on any step?`,
            `Great question! According to our operations documentation:\n\n| Step | Action | Owner |\n|------|--------|-------|\n| 1 | Review request | You |\n| 2 | Process in system | Operations |\n| 3 | Confirm completion | Manager |\n\nIs there a specific part of this process you need help with?`
        ],
        employee: [
            `Using the GH Smart methodology, here's my recommendation:\n\n### Candidate Evaluation\n\n**Scorecard Match:** 8/10\n\nStrengths:\n- ✅ Cultural fit aligned with core values\n- ✅ Relevant experience\n\nAreas to probe:\n- 🔍 Ask about specific outcomes at previous role\n- 🔍 Verify references thoroughly\n\nWould you like me to draft specific interview questions?`,
            `Based on our core values and hiring criteria:\n\n### Recommended Approach\n\n1. **Define the scorecard** - What does success look like?\n2. **Source candidates** - Use employee referrals first\n3. **Select rigorously** - 3+ interviews minimum\n4. **Sell the opportunity** - Top candidates have options\n\nWhich step would you like to dive deeper into?`
        ],
        branding: [
            `Using the StoryBrand framework, here's my suggestion:\n\n---\n\n**Hero:** Your customer (not you!)\n**Problem:** [Their specific pain point]\n**Guide:** Your company (with empathy + authority)\n**Plan:** Simple 3-step process\n**Call to Action:** Clear next step\n\n---\n\nWould you like me to write specific copy using this framework?`,
            `Channeling Alex Hormozi's value equation:\n\n### Making Your Offer Irresistible\n\n**Value = (Dream Outcome × Perceived Likelihood) ÷ (Time × Effort)**\n\nTo increase value:\n- 📈 Amplify the dream outcome\n- 🎯 Add guarantees to increase likelihood\n- ⏰ Reduce time to results\n- 🛠️ Make it easier (done-for-you)\n\nWhat specific offer are you working on?`
        ],
        support: [
            `Here's how to do that in BAM.ai:\n\n### Step-by-Step Guide\n\n1. **Navigate** to the relevant section from the sidebar\n2. **Click** on the feature you want to use\n3. **Follow** the on-screen prompts\n\n> 💡 **Pro tip:** Use Demo Mode to explore features with sample data!\n\nWould you like me to walk you through a specific feature?`,
            `I can help with that! Here are some tips:\n\n### Quick Tips\n\n- 📊 **Dashboard** - See your key metrics at a glance\n- 📚 **Brain Training** - Add knowledge to your AI\n- 💬 **BAM Brains** - Use specialized AI assistants\n- 🎬 **Content Engine** - Create and schedule content\n\nWhich area would you like to learn more about?`
        ]
    };
    return responses[brainId] || responses.operations;
}

// Main BAM Brains Component
function KnowledgeConsumer() {
    const location = useLocation();

    // Determine active brain from path
    const getActiveBrain = () => {
        if (location.pathname.includes('/employee')) return 'employee';
        if (location.pathname.includes('/branding')) return 'branding';
        return 'operations';
    };

    return (
        <div className="bam-brains">
            {/* Brain Tabs */}
            <nav className="brain-tabs">
                {Object.values(BRAIN_CONFIG).map(brain => {
                    const BrainIcon = brain.icon;
                    return (
                        <NavLink
                            key={brain.id}
                            to={`/consumer${brain.id === 'operations' ? '' : '/' + brain.id}`}
                            end={brain.id === 'operations'}
                            className={({ isActive }) => `brain-tab ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => isActive ? { borderColor: brain.color, color: brain.color } : {}}
                        >
                            <BrainIcon size={20} />
                            <span>{brain.name}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Brain Content */}
            <div className="brain-content">
                <Routes>
                    <Route index element={<BrainChat brainId="operations" />} />
                    <Route path="employee" element={<BrainChat brainId="employee" />} />
                    <Route path="branding" element={<BrainChat brainId="branding" />} />
                    <Route path="support" element={<BrainChat brainId="support" />} />
                </Routes>
            </div>
        </div>
    );
}

export default KnowledgeConsumer;
