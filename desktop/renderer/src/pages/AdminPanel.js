/**
 * AdminPanel - Merged Admin & Client Management
 * 
 * Combined panel for managing platform stats, clients, API keys, and activity.
 * Replaces the separate AdminPanel and ClientManagement components.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Building2,
    Activity,
    Plus,
    Search,
    MoreVertical,
    TrendingUp,
    TrendingDown,
    FileText,
    Video,
    MessageSquare,
    AlertCircle,
    CheckCircle,
    Clock,
    Key,
    Edit2,
    Trash2,
    BarChart3,
    Settings,
    Eye,
    EyeOff,
    X,
    Save,
    RefreshCw,
    MousePointer2,
    XCircle
} from 'lucide-react';
import { useDemoMode } from '../contexts/DemoModeContext';
import { useClientContext } from '../contexts/ClientContext';
import { API_URL } from '../config';
import './AdminPanel.css';

// Demo Data - Only shown when Demo Mode is ON
const DEMO_CLIENTS = [
    {
        id: '1',
        companyName: 'Acme Corp',
        industry: 'Technology',
        contactEmail: 'admin@acme.com',
        contactName: 'John Doe',
        plan: 'Professional',
        status: 'active',
        knowledgeScore: 85,
        users: 5,
        knowledgeItems: 45,
        monthlyQuestions: 1250,
        satisfaction: 94,
        lastActive: '2 hours ago',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: true } },
        createdAt: '2024-01-15T00:00:00Z'
    },
    {
        id: '2',
        companyName: 'TechStart Inc',
        industry: 'SaaS',
        contactEmail: 'hello@techstart.io',
        contactName: 'Jane Smith',
        plan: 'Startup',
        status: 'active',
        knowledgeScore: 62,
        users: 2,
        knowledgeItems: 18,
        monthlyQuestions: 320,
        satisfaction: 88,
        lastActive: '1 day ago',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: false } },
        createdAt: '2024-02-01T00:00:00Z'
    },
    {
        id: '3',
        companyName: 'Global Services',
        industry: 'Consulting',
        contactEmail: 'admin@globalservices.com',
        contactName: 'Mike Wilson',
        plan: 'Executive',
        status: 'onboarding',
        knowledgeScore: 25,
        users: 12,
        knowledgeItems: 8,
        monthlyQuestions: 45,
        satisfaction: null,
        lastActive: '5 hours ago',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: true } },
        createdAt: '2024-03-01T00:00:00Z'
    },
    {
        id: '4',
        companyName: 'HealthFirst Clinic',
        industry: 'Healthcare',
        contactEmail: 'contact@healthfirst.med',
        contactName: 'Dr. Williams',
        plan: 'Professional',
        status: 'active',
        knowledgeScore: 78,
        users: 8,
        knowledgeItems: 31,
        monthlyQuestions: 2100,
        satisfaction: 96,
        lastActive: '30 min ago',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: true } },
        createdAt: '2024-02-15T00:00:00Z'
    },
    {
        id: '5',
        companyName: 'Smith & Associates',
        industry: 'Legal',
        contactEmail: 'info@smithassoc.com',
        contactName: 'Robert Smith',
        plan: 'Professional',
        status: 'inactive',
        knowledgeScore: 45,
        users: 3,
        knowledgeItems: 22,
        monthlyQuestions: 0,
        satisfaction: 82,
        lastActive: '2 weeks ago',
        apiKeys: { openrouter: { enabled: false }, elevenlabs: { enabled: false } },
        createdAt: '2023-12-01T00:00:00Z'
    },
];

const DEMO_ACTIVITY = [
    { type: 'upload', client: 'Acme Corp', description: 'Uploaded 5 new documents', time: '10 min ago' },
    { type: 'recording', client: 'TechStart Inc', description: 'Created screen recording', time: '1 hour ago' },
    { type: 'question', client: 'HealthFirst Clinic', description: 'Asked 12 questions via brain', time: '2 hours ago' },
    { type: 'onboard', client: 'Global Services', description: 'Started onboarding process', time: '5 hours ago' },
    { type: 'upload', client: 'Acme Corp', description: 'Uploaded product manual PDF', time: 'Yesterday' },
    { type: 'question', client: 'TechStart Inc', description: 'Asked 8 questions via brain', time: 'Yesterday' },
];

const DEMO_USAGE = {
    totalTokens: 1250000,
    totalCost: 42.50,
    byService: {
        openrouter: { tokens: 1000000, cost: 35.00 },
        elevenlabs: { tokens: 250000, cost: 7.50 }
    },
    dailyUsage: [
        { date: '2024-12-22', tokens: 45000, cost: 1.50 },
        { date: '2024-12-23', tokens: 52000, cost: 1.75 },
        { date: '2024-12-24', tokens: 38000, cost: 1.25 },
        { date: '2024-12-25', tokens: 15000, cost: 0.50 },
        { date: '2024-12-26', tokens: 48000, cost: 1.60 },
        { date: '2024-12-27', tokens: 55000, cost: 1.85 },
        { date: '2024-12-28', tokens: 42000, cost: 1.40 }
    ]
};

function AdminPanel() {
    const { isDemoMode } = useDemoMode();
    const { selectClient: setGlobalClient, selectedClient: globalSelectedClient } = useClientContext();
    const navigate = useNavigate();

    // State
    const [activeTab, setActiveTab] = useState('clients');
    const [searchQuery, setSearchQuery] = useState('');
    const [clients, setClients] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal state
    const [showClientModal, setShowClientModal] = useState(false);
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [showClientProfile, setShowClientProfile] = useState(false);
    const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
    const [knowledgeItems, setKnowledgeItems] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [usageData, setUsageData] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [clientForm, setClientForm] = useState({
        companyName: '',
        industry: '',
        contactEmail: '',
        contactName: '',
        companyAddress: '',
        seatCount: 1,
        plan: 'Startup'
    });

    // Load data based on demo mode
    useEffect(() => {
        if (isDemoMode) {
            setClients(DEMO_CLIENTS);
            setActivity(DEMO_ACTIVITY);
            setLoading(false);
        } else {
            // Fetch real clients from API
            const fetchClients = async () => {
                setLoading(true);
                try {
                    const response = await fetch(`${API_URL}/api/clients`);
                    if (response.ok) {
                        const data = await response.json();
                        console.log('[ADMIN] Loaded clients:', data);
                        setClients(data.clients || []);
                    } else {
                        console.error('[ADMIN] Failed to fetch clients:', response.status);
                        setClients([]);
                    }
                } catch (error) {
                    console.error('[ADMIN] Error fetching clients:', error);
                    setClients([]);
                }
                setActivity([]); // No activity tracking yet
                setLoading(false);
            };
            fetchClients();
        }
    }, [isDemoMode]);

    // Calculate stats
    const stats = isDemoMode ? [
        {
            label: 'Total Clients',
            value: clients.length.toString(),
            change: '+3 this month',
            positive: true,
            icon: Building2
        },
        {
            label: 'Active Users',
            value: clients.reduce((sum, c) => sum + (c.users || 0), 0).toString(),
            change: '+12 this week',
            positive: true,
            icon: Users
        },
        {
            label: 'Knowledge Items',
            value: clients.reduce((sum, c) => sum + (c.knowledgeItems || 0), 0).toString(),
            change: '+28 this week',
            positive: true,
            icon: FileText
        },
        {
            label: 'Avg. Satisfaction',
            value: Math.round(clients.filter(c => c.satisfaction).reduce((sum, c) => sum + c.satisfaction, 0) / clients.filter(c => c.satisfaction).length || 0) + '%',
            change: '+2%',
            positive: true,
            icon: Activity
        },
    ] : [
        { label: 'Total Clients', value: '0', change: '—', positive: true, icon: Building2 },
        { label: 'Active Users', value: '0', change: '—', positive: true, icon: Users },
        { label: 'Knowledge Items', value: '0', change: '—', positive: true, icon: FileText },
        { label: 'Avg. Satisfaction', value: '0%', change: '—', positive: true, icon: Activity },
    ];

    // Filter clients
    const filteredClients = clients.filter(client =>
        client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Modal handlers
    const openCreateModal = () => {
        setSelectedClient(null);
        setClientForm({ companyName: '', industry: '', contactEmail: '', contactName: '', companyAddress: '', seatCount: 1, plan: 'Startup' });
        setEditMode(false);
        setShowClientModal(true);
    };

    const openEditModal = (client) => {
        setSelectedClient(client);
        setClientForm({
            companyName: client.companyName,
            industry: client.industry || '',
            contactEmail: client.contactEmail || '',
            contactName: client.contactName || '',
            companyAddress: client.companyAddress || '',
            seatCount: client.seatCount || 1,
            plan: client.plan || 'Startup'
        });
        setEditMode(true);
        setShowClientModal(true);
    };

    const closeClientModal = () => {
        setShowClientModal(false);
        setSelectedClient(null);
        setClientForm({ companyName: '', industry: '', contactEmail: '', contactName: '', companyAddress: '', seatCount: 1, plan: 'Startup' });
        setEditMode(false);
    };

    const openUsageModal = (client) => {
        setSelectedClient(client);
        setUsageData(DEMO_USAGE);
        setShowUsageModal(true);
    };

    const openClientProfile = (client) => {
        setSelectedClient(client);
        setShowClientProfile(true);
    };

    const closeClientProfile = () => {
        setShowClientProfile(false);
        setSelectedClient(null);
    };

    const viewKnowledgeItems = async (client) => {
        setSelectedClient(client);
        setKnowledgeItems([]);
        setShowKnowledgeModal(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/knowledge/${client.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setKnowledgeItems(data.items || []);
            } else {
                console.error('Failed to fetch knowledge items');
                setKnowledgeItems([]);
            }
        } catch (err) {
            console.error('Error fetching knowledge items:', err);
            setKnowledgeItems([]);
        }
    };

    const closeKnowledgeModal = () => {
        setShowKnowledgeModal(false);
        setSelectedClient(null);
        setKnowledgeItems([]);
    };

    const handleTestBrain = (client) => {
        // In real implementation, this would trigger brain testing
        console.log('Testing brain for', client.companyName);
        alert(`Testing brain for ${client.companyName}. This will verify AI responses are accurate.`);
    };

    const handleDeliverBrain = (client) => {
        // In real implementation, this would mark client as delivered/active
        console.log('Delivering brain for', client.companyName);
        setClients(prev => prev.map(c =>
            c.id === client.id ? { ...c, status: 'active' } : c
        ));
        setSelectedClient(prev => prev ? { ...prev, status: 'active' } : null);
        alert(`Brain delivered to ${client.companyName}! Client is now active.`);
    };

    // Select client for global context - allows simulating client view across tabs
    const handleSelectClient = (client) => {
        console.log('[AdminPanel] Selecting client for global context:', client.companyName);
        setGlobalClient(client);
        closeClientProfile();
        // Navigate to BAM Brains to test the client context
        navigate('/consumer');
    };

    const handleSaveClient = () => {
        if (editMode && selectedClient) {
            setClients(prev => prev.map(c =>
                c.id === selectedClient.id ? { ...c, ...clientForm } : c
            ));
        } else {
            const newClient = {
                id: Date.now().toString(),
                ...clientForm,
                status: 'onboarding',
                knowledgeScore: 0,
                users: 1,
                knowledgeItems: 0,
                monthlyQuestions: 0,
                satisfaction: null,
                lastActive: 'Just now',
                apiKeys: { openrouter: { enabled: false }, elevenlabs: { enabled: false } },
                createdAt: new Date().toISOString()
            };
            setClients(prev => [newClient, ...prev]);
        }
        closeClientModal();
    };

    const handleDeleteClient = async (clientId) => {
        if (window.confirm('Are you sure you want to delete this client? This cannot be undone.')) {
            try {
                const response = await fetch(`${API_URL}/api/clients/${clientId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    setClients(prev => prev.filter(c => c.id !== clientId));
                    console.log('[ADMIN] Client deleted:', clientId);
                } else {
                    const data = await response.json();
                    alert('Failed to delete client: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Delete client error:', error);
                alert('Failed to delete client: ' + error.message);
            }
        }
    };

    // View client onboarding profile document
    const viewClientProfile = async (client) => {
        try {
            // Fetch full onboarding data from API
            const response = await fetch(`${API_URL}/api/clients/${client.id}/onboarding`);
            const data = response.ok ? await response.json() : {};

            const onboardingData = data.onboardingData || {};
            const responses = data.responses || onboardingData.responses || {};

            // Build HTML profile document
            let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Client Profile: ${client.companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 30px; }
        h2 { color: #1e40af; margin-top: 35px; font-size: 1.3rem; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; }
        .info-item { background: #f8fafc; padding: 18px; border-radius: 10px; border: 1px solid #e2e8f0; }
        .info-label { font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 18px; margin-top: 8px; color: #1e293b; }
        .response { margin: 20px 0; padding: 20px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 0 10px 10px 0; }
        .response-question { font-weight: 600; color: #1e40af; margin-bottom: 10px; font-size: 15px; }
        .response-answer { color: #334155; line-height: 1.6; white-space: pre-wrap; }
        .footer { margin-top: 50px; padding-top: 25px; border-top: 2px solid #e2e8f0; color: #94a3b8; font-size: 13px; text-align: center; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .badge-active { background: #dcfce7; color: #166534; }
        .badge-plan { background: #dbeafe; color: #1e40af; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏢 ${client.companyName}</h1>
        <p>
            <span class="badge badge-active">${client.status || 'Active'}</span>
            <span class="badge badge-plan">${client.plan || 'Standard'} Plan</span>
        </p>
        
        <h2>📋 Company Information</h2>
        <div class="info-grid">
            <div class="info-item"><div class="info-label">Company Name</div><div class="info-value">${data.companyName || client.companyName || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Industry</div><div class="info-value">${data.industry || client.industry || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Contact Name</div><div class="info-value">${data.contactName || client.contactName || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Contact Email</div><div class="info-value">${data.contactEmail || client.contactEmail || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Phone</div><div class="info-value">${data.contactPhone || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Website</div><div class="info-value">${data.website || 'N/A'}</div></div>
        </div>
        
        <h2>📝 Onboarding Responses</h2>
`;

            // Add all responses
            const responseEntries = Object.entries(responses);
            if (responseEntries.length > 0) {
                responseEntries.forEach(([questionId, answer]) => {
                    if (answer && answer.trim()) {
                        // Format question ID as readable label
                        const label = questionId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        html += `
        <div class="response">
            <div class="response-question">${label}</div>
            <div class="response-answer">${answer}</div>
        </div>`;
                    }
                });
            } else {
                html += `<p style="color: #94a3b8; font-style: italic;">No onboarding responses recorded yet.</p>`;
            }

            // Add transcript section if available
            if (data.transcript) {
                html += `
        <h2>🎙️ Interview Transcript</h2>
        <div class="response" style="background: #f0fdf4; border-left-color: #22c55e;">
            <div class="response-question">Full Interview Recording Transcript</div>
            <div class="response-answer" style="max-height: 500px; overflow-y: auto;">${data.transcript.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>`;
            }

            html += `
        <div class="footer">
            <p>Generated by BAM.ai • ${new Date().toLocaleString()}</p>
            <p>Client ID: ${client.id}</p>
        </div>
    </div>
</body>
</html>`;

            // Open in new window
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');

            // Also offer download
            const a = document.createElement('a');
            a.href = url;
            a.download = `${client.companyName.replace(/[^a-z0-9]/gi, '_')}_Profile.html`;
            // Don't auto-download, user can save from the window if they want

        } catch (error) {
            console.error('View profile error:', error);
            alert('Failed to load client profile: ' + error.message);
        }
    };

    const toggleApiKey = (clientId, service) => {
        setClients(prev => prev.map(c => {
            if (c.id === clientId) {
                return {
                    ...c,
                    apiKeys: {
                        ...c.apiKeys,
                        [service]: { enabled: !c.apiKeys[service]?.enabled }
                    }
                };
            }
            return c;
        }));
    };

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num?.toString() || '0';
    };

    // Price calculator for seat count
    const getPriceEstimate = (plan, seats) => {
        const basePrices = {
            'Startup': 49,      // per seat per month
            'Professional': 99,
            'Executive': 199
        };
        const basePrice = basePrices[plan] || 49;
        // Volume discount: 10% off for 5+, 20% off for 10+
        let discount = 1;
        if (seats >= 10) discount = 0.8;
        else if (seats >= 5) discount = 0.9;

        const total = Math.round(basePrice * seats * discount);
        return total.toLocaleString();
    };

    return (
        <div className="admin-panel">
            {/* Stats Grid */}
            <section className="admin-stats animate-slideUp">
                {stats.map((stat, index) => (
                    <div key={index} className="admin-stat-card">
                        <div className="stat-icon-wrapper">
                            <stat.icon size={22} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-label">{stat.label}</span>
                        </div>
                        <div className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                            {stat.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {stat.change}
                        </div>
                    </div>
                ))}
            </section>

            {/* Main Content */}
            <div className="admin-content animate-slideUp" style={{ animationDelay: '0.1s' }}>
                {/* Tabs */}
                <div className="admin-tabs">
                    <button
                        className={`admin-tab ${activeTab === 'clients' ? 'active' : ''}`}
                        onClick={() => setActiveTab('clients')}
                    >
                        <Building2 size={18} />
                        Client Accounts
                    </button>
                    <button
                        className={`admin-tab ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => setActiveTab('activity')}
                    >
                        <Activity size={18} />
                        Recent Activity
                    </button>
                    <div className="tab-spacer"></div>
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Add Client
                    </button>
                </div>

                {activeTab === 'clients' && (
                    <div className="clients-section">
                        {/* Search */}
                        <div className="clients-toolbar">
                            <div className="search-wrapper">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search clients..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Clients Table */}
                        {filteredClients.length > 0 ? (
                            <div className="clients-table">
                                <div className="table-header">
                                    <span className="col-name">Client</span>
                                    <span className="col-plan">Plan</span>
                                    <span className="col-status">Status</span>
                                    <span className="col-score">Knowledge Score</span>
                                    <span className="col-usage">Monthly Usage</span>
                                    <span className="col-api">API Keys</span>
                                    <span className="col-actions"></span>
                                </div>

                                {filteredClients.map((client) => (
                                    <div key={client.id} className="table-row">
                                        <div
                                            className="col-name clickable"
                                            onClick={() => openClientProfile(client)}
                                            title="Click to view client profile"
                                        >
                                            <div className="client-avatar">
                                                {client.companyName.charAt(0)}
                                            </div>
                                            <div className="client-info">
                                                <span className="client-name">{client.companyName}</span>
                                                <span className="client-email">{client.contactEmail}</span>
                                            </div>
                                        </div>
                                        <span className="col-plan">
                                            <span className={`plan-badge plan-${client.plan?.toLowerCase()}`}>
                                                {client.plan}
                                            </span>
                                        </span>
                                        <span className="col-status">
                                            <span className={`status-badge status-${client.status}`}>
                                                {client.status === 'active' && <CheckCircle size={12} />}
                                                {client.status === 'onboarding' && <Clock size={12} />}
                                                {client.status === 'inactive' && <AlertCircle size={12} />}
                                                {client.status}
                                            </span>
                                        </span>
                                        <div className="col-score">
                                            <div className="score-bar">
                                                <div
                                                    className="score-fill"
                                                    style={{ width: `${client.knowledgeScore}%` }}
                                                ></div>
                                            </div>
                                            <span className="score-text">{client.knowledgeScore}%</span>
                                        </div>
                                        <div className="col-usage">
                                            <span className="usage-value">{formatNumber(client.monthlyQuestions)}</span>
                                            <span className="usage-label">questions</span>
                                        </div>
                                        <div className="col-api">
                                            <button
                                                className={`api-toggle ${client.apiKeys?.openrouter?.enabled ? 'enabled' : ''}`}
                                                onClick={() => toggleApiKey(client.id, 'openrouter')}
                                                title="OpenRouter"
                                            >
                                                OR
                                            </button>
                                            <button
                                                className={`api-toggle ${client.apiKeys?.elevenlabs?.enabled ? 'enabled' : ''}`}
                                                onClick={() => toggleApiKey(client.id, 'elevenlabs')}
                                                title="ElevenLabs"
                                            >
                                                EL
                                            </button>
                                        </div>
                                        <div className="col-actions">
                                            <button
                                                className={`btn btn-sm ${globalSelectedClient?.id === client.id ? 'btn-secondary' : 'btn-primary'}`}
                                                onClick={() => handleSelectClient(client)}
                                                title={globalSelectedClient?.id === client.id ? 'Currently Selected' : 'Select Client to View As'}
                                            >
                                                <MousePointer2 size={14} />
                                                {globalSelectedClient?.id === client.id ? 'Selected' : 'Select'}
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm btn-icon"
                                                onClick={() => viewKnowledgeItems(client)}
                                                title="View Knowledge Items"
                                            >
                                                <FileText size={16} />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm btn-icon"
                                                onClick={() => openUsageModal(client)}
                                                title="View Usage"
                                            >
                                                <BarChart3 size={16} />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm btn-icon"
                                                onClick={() => openEditModal(client)}
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm btn-icon btn-danger"
                                                onClick={() => handleDeleteClient(client.id)}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <Building2 size={48} />
                                <h3>No clients yet</h3>
                                <p>{isDemoMode ? 'No clients match your search' : 'Enable Demo Mode to see sample clients, or add your first client'}</p>
                                <button className="btn btn-primary" onClick={openCreateModal}>
                                    <Plus size={18} />
                                    Add First Client
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="activity-section">
                        {activity.length > 0 ? (
                            activity.map((item, index) => (
                                <div key={index} className="activity-row">
                                    <div className={`activity-icon-lg type-${item.type}`}>
                                        {item.type === 'upload' && <FileText size={20} />}
                                        {item.type === 'recording' && <Video size={20} />}
                                        {item.type === 'question' && <MessageSquare size={20} />}
                                        {item.type === 'onboard' && <Users size={20} />}
                                    </div>
                                    <div className="activity-details">
                                        <span className="activity-client">{item.client}</span>
                                        <span className="activity-desc">{item.description}</span>
                                    </div>
                                    <span className="activity-time-lg">{item.time}</span>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Activity size={48} />
                                <h3>No activity yet</h3>
                                <p>Enable Demo Mode to see sample activity</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Client Modal */}
            {showClientModal && (
                <div className="modal-overlay" onClick={closeClientModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editMode ? 'Edit Client' : 'Add New Client'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={closeClientModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Company Name</label>
                                <input
                                    type="text"
                                    value={clientForm.companyName}
                                    onChange={e => setClientForm(prev => ({ ...prev, companyName: e.target.value }))}
                                    placeholder="Enter company name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Industry</label>
                                <input
                                    type="text"
                                    value={clientForm.industry}
                                    onChange={e => setClientForm(prev => ({ ...prev, industry: e.target.value }))}
                                    placeholder="e.g., Technology, Healthcare"
                                />
                            </div>
                            <div className="form-group">
                                <label>Contact Name</label>
                                <input
                                    type="text"
                                    value={clientForm.contactName}
                                    onChange={e => setClientForm(prev => ({ ...prev, contactName: e.target.value }))}
                                    placeholder="Primary contact name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Contact Email</label>
                                <input
                                    type="email"
                                    value={clientForm.contactEmail}
                                    onChange={e => setClientForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                                    placeholder="contact@company.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Plan</label>
                                <select
                                    value={clientForm.plan}
                                    onChange={e => setClientForm(prev => ({ ...prev, plan: e.target.value }))}
                                >
                                    <option value="Startup">Startup</option>
                                    <option value="Professional">Professional</option>
                                    <option value="Executive">Executive</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Company Address</label>
                                <input
                                    type="text"
                                    value={clientForm.companyAddress}
                                    onChange={e => setClientForm(prev => ({ ...prev, companyAddress: e.target.value }))}
                                    placeholder="123 Main St, City, State, ZIP"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group form-group-half">
                                    <label>Number of Seats</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={clientForm.seatCount}
                                        onChange={e => setClientForm(prev => ({ ...prev, seatCount: parseInt(e.target.value) || 1 }))}
                                    />
                                </div>
                                <div className="form-group form-group-half">
                                    <label>Estimated Monthly</label>
                                    <div className="price-display">
                                        ${getPriceEstimate(clientForm.plan, clientForm.seatCount)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={closeClientModal}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveClient}>
                                <Save size={16} />
                                {editMode ? 'Save Changes' : 'Add Client'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Usage Modal */}
            {showUsageModal && usageData && (
                <div className="modal-overlay" onClick={() => setShowUsageModal(false)}>
                    <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Usage Analytics - {selectedClient?.companyName}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowUsageModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="usage-overview">
                                <div className="usage-card">
                                    <span className="usage-card-label">Total Tokens</span>
                                    <span className="usage-card-value">{formatNumber(usageData.totalTokens)}</span>
                                </div>
                                <div className="usage-card">
                                    <span className="usage-card-label">Total Cost</span>
                                    <span className="usage-card-value">${usageData.totalCost.toFixed(2)}</span>
                                </div>
                                <div className="usage-card">
                                    <span className="usage-card-label">OpenRouter</span>
                                    <span className="usage-card-value">${usageData.byService.openrouter.cost.toFixed(2)}</span>
                                </div>
                                <div className="usage-card">
                                    <span className="usage-card-label">ElevenLabs</span>
                                    <span className="usage-card-value">${usageData.byService.elevenlabs.cost.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="usage-chart">
                                <h4>Daily Usage (Last 7 Days)</h4>
                                <div className="chart-bars">
                                    {usageData.dailyUsage.map((day, i) => (
                                        <div key={i} className="chart-bar-wrapper">
                                            <div
                                                className="chart-bar"
                                                style={{ height: `${(day.tokens / 60000) * 100}%` }}
                                            ></div>
                                            <span className="chart-label">{day.date.slice(-2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Profile Modal */}
            {showClientProfile && selectedClient && (
                <div className="modal-overlay" onClick={closeClientProfile}>
                    <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Client Profile: {selectedClient.companyName}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={closeClientProfile}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Client Overview */}
                            <div className="profile-overview">
                                <div className="profile-avatar-large">
                                    {selectedClient.companyName.charAt(0)}
                                </div>
                                <div className="profile-info">
                                    <h3>{selectedClient.companyName}</h3>
                                    <p>{selectedClient.industry} • {selectedClient.plan} Plan</p>
                                    <span className={`status-badge status-${selectedClient.status}`}>
                                        {selectedClient.status === 'active' && <CheckCircle size={12} />}
                                        {selectedClient.status === 'onboarding' && <Clock size={12} />}
                                        {selectedClient.status === 'inactive' && <AlertCircle size={12} />}
                                        {selectedClient.status}
                                    </span>
                                </div>
                            </div>

                            {/* Onboarding Progress */}
                            {selectedClient.status === 'onboarding' && (
                                <div className="profile-section">
                                    <h4>Onboarding Progress</h4>
                                    <div className="onboarding-progress">
                                        <div className="progress-item">
                                            <span className="progress-label">Days in Onboarding</span>
                                            <span className="progress-value">
                                                {Math.floor((new Date() - new Date(selectedClient.createdAt)) / (1000 * 60 * 60 * 24))} days
                                            </span>
                                        </div>
                                        <div className="progress-bar-large">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${selectedClient.knowledgeScore}%` }}
                                            ></div>
                                        </div>
                                        <p className="progress-status">
                                            {selectedClient.knowledgeScore < 50
                                                ? 'Client needs more training data before testing'
                                                : 'Ready for brain testing'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Knowledge Score Breakdown */}
                            <div className="profile-section">
                                <h4>Knowledge Score: {selectedClient.knowledgeScore}%</h4>
                                <div className="knowledge-breakdown">
                                    <div className="knowledge-item">
                                        <span className="knowledge-label">Documents</span>
                                        <div className="knowledge-bar">
                                            <div
                                                className="knowledge-fill docs"
                                                style={{ width: `${Math.min(100, (selectedClient.knowledgeItems / 50) * 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="knowledge-value">{selectedClient.knowledgeItems} uploaded</span>
                                    </div>
                                    <div className="knowledge-item">
                                        <span className="knowledge-label">Voice Recordings</span>
                                        <div className="knowledge-bar">
                                            <div
                                                className="knowledge-fill voice"
                                                style={{ width: `${Math.min(100, (selectedClient.knowledgeScore / 2))}%` }}
                                            ></div>
                                        </div>
                                        <span className="knowledge-value">{Math.floor(selectedClient.knowledgeScore / 10)} recorded</span>
                                    </div>
                                    <div className="knowledge-item">
                                        <span className="knowledge-label">API Connections</span>
                                        <div className="knowledge-bar">
                                            <div
                                                className="knowledge-fill api"
                                                style={{ width: `${(selectedClient.apiKeys?.openrouter?.enabled && selectedClient.apiKeys?.elevenlabs?.enabled) ? 100 : selectedClient.apiKeys?.openrouter?.enabled || selectedClient.apiKeys?.elevenlabs?.enabled ? 50 : 0}%` }}
                                            ></div>
                                        </div>
                                        <span className="knowledge-value">
                                            {[selectedClient.apiKeys?.openrouter?.enabled && 'OpenRouter', selectedClient.apiKeys?.elevenlabs?.enabled && 'ElevenLabs'].filter(Boolean).join(', ') || 'None'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Client Details */}
                            <div className="profile-section">
                                <h4>Contact Information</h4>
                                <div className="profile-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Contact</span>
                                        <span className="detail-value">{selectedClient.contactName}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Email</span>
                                        <span className="detail-value">{selectedClient.contactEmail}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Users</span>
                                        <span className="detail-value">{selectedClient.users} active</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Last Active</span>
                                        <span className="detail-value">{selectedClient.lastActive}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Stats */}
                            <div className="profile-section">
                                <h4>Usage Statistics</h4>
                                <div className="usage-stats-grid">
                                    <div className="usage-stat">
                                        <span className="usage-stat-value">{formatNumber(selectedClient.monthlyQuestions)}</span>
                                        <span className="usage-stat-label">Questions/Month</span>
                                    </div>
                                    <div className="usage-stat">
                                        <span className="usage-stat-value">{selectedClient.knowledgeItems}</span>
                                        <span className="usage-stat-label">Knowledge Items</span>
                                    </div>
                                    <div className="usage-stat">
                                        <span className="usage-stat-value">{selectedClient.satisfaction || '—'}%</span>
                                        <span className="usage-stat-label">Satisfaction</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={closeClientProfile}>
                                Close
                            </button>
                            {selectedClient.status === 'onboarding' && (
                                <>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => handleTestBrain(selectedClient)}
                                        disabled={selectedClient.knowledgeScore < 50}
                                        title={selectedClient.knowledgeScore < 50 ? 'Need 50%+ knowledge score to test' : 'Test the brain'}
                                    >
                                        <Eye size={16} />
                                        Test Brain
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleDeliverBrain(selectedClient)}
                                        disabled={selectedClient.knowledgeScore < 50}
                                    >
                                        <CheckCircle size={16} />
                                        Deliver to Client
                                    </button>
                                </>
                            )}
                            {selectedClient.status !== 'onboarding' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => openEditModal(selectedClient)}
                                >
                                    <Edit2 size={16} />
                                    Edit Client
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Knowledge Items Modal */}
            {showKnowledgeModal && selectedClient && (
                <div className="modal-overlay" onClick={closeKnowledgeModal}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                <FileText size={20} />
                                Knowledge Items - {selectedClient.companyName}
                            </h3>
                            <button className="btn btn-ghost btn-icon" onClick={closeKnowledgeModal}>
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {knowledgeItems.length === 0 ? (
                                <div className="empty-state">
                                    <FileText size={48} />
                                    <h3>No Knowledge Items</h3>
                                    <p>This client has no files uploaded to Brain Training yet.</p>
                                </div>
                            ) : (
                                <div className="knowledge-items-list">
                                    {knowledgeItems.map(item => (
                                        <div key={item.id} className="knowledge-item">
                                            <div className="knowledge-item-icon">
                                                <FileText size={24} />
                                            </div>
                                            <div className="knowledge-item-info">
                                                <span className="knowledge-item-title">{item.title}</span>
                                                <span className="knowledge-item-meta">
                                                    {item.type} • {item.wordCount ? `${item.wordCount} words` : ''} • {new Date(item.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <span className={`knowledge-item-status ${item.status}`}>
                                                {item.status === 'ready' ? <CheckCircle size={14} /> : null}
                                                {item.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={closeKnowledgeModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;
