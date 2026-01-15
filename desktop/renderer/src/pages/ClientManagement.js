/**
 * ClientManagement Page
 * Admin page for managing clients and their API key configurations
 */

import React, { useState, useEffect } from 'react';
import {
    Building2,
    Key,
    Plus,
    Edit2,
    Trash2,
    BarChart3,
    Settings,
    CheckCircle,
    XCircle,
    Loader2,
    Search,
    Filter,
    ChevronDown,
    DollarSign,
    Activity,
    Users,
    AlertCircle,
    Eye,
    EyeOff
} from 'lucide-react';
import { useDemoMode } from '../contexts/DemoModeContext';
import { useClientContext } from '../contexts/ClientContext';
import './ClientManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Demo clients - same as AdminPanel
const DEMO_CLIENTS = [
    {
        id: '1',
        companyName: 'Acme Corp',
        industry: 'Technology',
        contactEmail: 'admin@acme.com',
        contactName: 'John Doe',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: true } },
        createdAt: '2024-01-15T00:00:00Z',
        status: 'active',
        knowledgeItems: 24,
        monthlyQuestions: 1250,
        satisfaction: 94
    },
    {
        id: '2',
        companyName: 'TechStart Inc',
        industry: 'SaaS',
        contactEmail: 'hello@techstart.io',
        contactName: 'Sarah Chen',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: true } },
        createdAt: '2024-02-10T00:00:00Z',
        status: 'active',
        knowledgeItems: 18,
        monthlyQuestions: 890,
        satisfaction: 97
    },
    {
        id: '3',
        companyName: 'BuildRight Construction',
        industry: 'Construction',
        contactEmail: 'info@buildright.com',
        contactName: 'Mike Johnson',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: false } },
        createdAt: '2024-02-20T00:00:00Z',
        status: 'active',
        knowledgeItems: 12,
        monthlyQuestions: 450,
        satisfaction: 91
    },
    {
        id: '4',
        companyName: 'HealthFirst Clinic',
        industry: 'Healthcare',
        contactEmail: 'contact@healthfirst.med',
        contactName: 'Dr. Williams',
        apiKeys: { openrouter: { enabled: true }, elevenlabs: { enabled: true } },
        createdAt: '2024-03-10T00:00:00Z',
        status: 'active',
        knowledgeItems: 31,
        monthlyQuestions: 2100,
        satisfaction: 96
    }
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

function ClientManagement() {
    const { isDemoMode } = useDemoMode();
    const { selectedClient: globalSelectedClient, clearClient: clearGlobalClient } = useClientContext();

    // State
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [showClientModal, setShowClientModal] = useState(false);
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [clientForm, setClientForm] = useState({
        companyName: '',
        industry: '',
        contactEmail: '',
        contactName: ''
    });
    const [editMode, setEditMode] = useState(false);
    const [usageData, setUsageData] = useState(null);

    // Load demo data when demo mode changes
    useEffect(() => {
        if (isDemoMode) {
            setClients(DEMO_CLIENTS);
            setLoading(false);
        } else {
            setClients([]);
            fetchClients();
        }
    }, [isDemoMode]);

    const fetchClients = async () => {
        if (isDemoMode) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/clients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setClients(Array.isArray(data) ? data : []);
            } else {
                setClients([]);
            }
        } catch (err) {
            console.error('Fetch clients error:', err);
            setError('Failed to load clients');
        } finally {
            setLoading(false);
        }
    };

    const fetchClientUsage = async (clientId) => {
        if (isDemoMode) {
            setUsageData(DEMO_USAGE);
            setShowUsageModal(true);
            return;
        }

        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/clients/${clientId}/usage`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setUsageData(data);
            } else {
                // Mock usage data
                setUsageData({
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
                });
            }
            setShowUsageModal(true);
        } catch (err) {
            console.error('Fetch usage error:', err);
        }
    };

    const createClient = async () => {
        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/clients`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientForm)
            });

            if (response.ok) {
                const data = await response.json();
                setClients(prev => [...prev, data.client]);
                closeClientModal();
            } else {
                setError('Failed to create client');
            }
        } catch (err) {
            console.error('Create client error:', err);
            setError('Failed to create client');
        }
    };

    const updateClient = async () => {
        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/clients/${selectedClient.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientForm)
            });

            if (response.ok) {
                const data = await response.json();
                setClients(prev => prev.map(c => c.id === selectedClient.id ? data.client : c));
                closeClientModal();
            } else {
                setError('Failed to update client');
            }
        } catch (err) {
            console.error('Update client error:', err);
            setError('Failed to update client');
        }
    };

    const deleteClient = async (clientId) => {
        if (!window.confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('bam_token');
            await fetch(`${API_URL}/api/clients/${clientId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setClients(prev => prev.filter(c => c.id !== clientId));

            // If the deleted client was the globally selected one, clear it
            if (globalSelectedClient?.id === clientId) {
                console.log('[ClientManagement] Deleted selected client, clearing global selection');
                clearGlobalClient();
            }
        } catch (err) {
            console.error('Delete client error:', err);
        }
    };

    const toggleApiKey = async (clientId, service, enabled) => {
        try {
            const token = localStorage.getItem('bam_token');
            await fetch(`${API_URL}/api/clients/${clientId}/api-keys/${service}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });

            setClients(prev => prev.map(c => {
                if (c.id === clientId) {
                    return {
                        ...c,
                        apiKeys: {
                            ...c.apiKeys,
                            [service]: { ...c.apiKeys[service], enabled }
                        }
                    };
                }
                return c;
            }));
        } catch (err) {
            console.error('Toggle API key error:', err);
        }
    };

    const openEditModal = (client) => {
        setSelectedClient(client);
        setClientForm({
            companyName: client.companyName,
            industry: client.industry || '',
            contactEmail: client.contactEmail || '',
            contactName: client.contactName || ''
        });
        setEditMode(true);
        setShowClientModal(true);
    };

    const openCreateModal = () => {
        setSelectedClient(null);
        setClientForm({
            companyName: '',
            industry: '',
            contactEmail: '',
            contactName: ''
        });
        setEditMode(false);
        setShowClientModal(true);
    };

    const closeClientModal = () => {
        setShowClientModal(false);
        setSelectedClient(null);
        setClientForm({ companyName: '', industry: '', contactEmail: '', contactName: '' });
        setEditMode(false);
        setError(null);
    };

    const filteredClients = clients.filter(client =>
        client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="client-management">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <Building2 className="header-icon" />
                    <div>
                        <h1>Client Management</h1>
                        <p>Manage clients, API keys, and usage tracking</p>
                    </div>
                </div>
                <button className="btn-primary" onClick={openCreateModal}>
                    <Plus size={18} />
                    Add Client
                </button>
            </header>

            {/* Stats Overview */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{clients.length}</span>
                        <span className="stat-label">Total Clients</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon active">
                        <Activity size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{clients.filter(c => c.status === 'active').length}</span>
                        <span className="stat-label">Active</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon keys">
                        <Key size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">
                            {clients.reduce((sum, c) => sum + (c.apiKeys?.openrouter?.enabled ? 1 : 0) + (c.apiKeys?.elevenlabs?.enabled ? 1 : 0), 0)}
                        </span>
                        <span className="stat-label">Active API Keys</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon cost">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">$0.00</span>
                        <span className="stat-label">MTD Usage Cost</span>
                    </div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="search-bar">
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Search clients by name, industry, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Clients Table */}
            <div className="clients-table-container">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spinning" size={32} />
                        <p>Loading clients...</p>
                    </div>
                ) : filteredClients.length === 0 ? (
                    <div className="empty-state">
                        <Building2 size={48} />
                        <h3>No clients found</h3>
                        <p>Create your first client to get started</p>
                        <button className="btn-primary" onClick={openCreateModal}>
                            <Plus size={18} />
                            Add Client
                        </button>
                    </div>
                ) : (
                    <table className="clients-table">
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Industry</th>
                                <th>API Keys</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map(client => (
                                <tr key={client.id}>
                                    <td>
                                        <div className="client-info">
                                            <span className="client-name">{client.companyName}</span>
                                            <span className="client-email">{client.contactEmail}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="industry-badge">{client.industry || 'N/A'}</span>
                                    </td>
                                    <td>
                                        <div className="api-keys-status">
                                            <button
                                                className={`key-toggle ${client.apiKeys?.openrouter?.enabled ? 'enabled' : 'disabled'}`}
                                                onClick={() => toggleApiKey(client.id, 'openrouter', !client.apiKeys?.openrouter?.enabled)}
                                                title="OpenRouter API"
                                            >
                                                OR
                                            </button>
                                            <button
                                                className={`key-toggle ${client.apiKeys?.elevenlabs?.enabled ? 'enabled' : 'disabled'}`}
                                                onClick={() => toggleApiKey(client.id, 'elevenlabs', !client.apiKeys?.elevenlabs?.enabled)}
                                                title="ElevenLabs API"
                                            >
                                                EL
                                            </button>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${client.status}`}>
                                            {client.status === 'active' ? (
                                                <><CheckCircle size={14} /> Active</>
                                            ) : (
                                                <><XCircle size={14} />Inactive</>
                                            )}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="date">
                                            {new Date(client.createdAt).toLocaleDateString()}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="actions">
                                            <button
                                                className="action-btn"
                                                onClick={() => fetchClientUsage(client.id)}
                                                title="View Usage"
                                            >
                                                <BarChart3 size={16} />
                                            </button>
                                            <button
                                                className="action-btn"
                                                onClick={() => openEditModal(client)}
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => deleteClient(client.id)}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Client Modal */}
            {showClientModal && (
                <div className="modal-overlay" onClick={closeClientModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>{editMode ? 'Edit Client' : 'Add New Client'}</h3>

                        {error && (
                            <div className="modal-error">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Company Name *</label>
                            <input
                                type="text"
                                value={clientForm.companyName}
                                onChange={e => setClientForm(prev => ({ ...prev, companyName: e.target.value }))}
                                placeholder="Enter company name"
                            />
                        </div>

                        <div className="form-group">
                            <label>Industry</label>
                            <select
                                value={clientForm.industry}
                                onChange={e => setClientForm(prev => ({ ...prev, industry: e.target.value }))}
                            >
                                <option value="">Select industry</option>
                                <option value="Technology">Technology</option>
                                <option value="Healthcare">Healthcare</option>
                                <option value="Construction">Construction</option>
                                <option value="Retail">Retail</option>
                                <option value="Financial Services">Financial Services</option>
                                <option value="Professional Services">Professional Services</option>
                                <option value="Manufacturing">Manufacturing</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Contact Name</label>
                                <input
                                    type="text"
                                    value={clientForm.contactName}
                                    onChange={e => setClientForm(prev => ({ ...prev, contactName: e.target.value }))}
                                    placeholder="Primary contact"
                                />
                            </div>
                            <div className="form-group">
                                <label>Contact Email</label>
                                <input
                                    type="email"
                                    value={clientForm.contactEmail}
                                    onChange={e => setClientForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                                    placeholder="email@company.com"
                                />
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={closeClientModal}>
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={editMode ? updateClient : createClient}
                                disabled={!clientForm.companyName}
                            >
                                {editMode ? 'Save Changes' : 'Create Client'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Usage Modal */}
            {showUsageModal && usageData && (
                <div className="modal-overlay" onClick={() => setShowUsageModal(false)}>
                    <div className="modal usage-modal" onClick={e => e.stopPropagation()}>
                        <h3>
                            <BarChart3 size={20} />
                            Usage Analytics
                        </h3>

                        <div className="usage-summary">
                            <div className="usage-stat">
                                <span className="usage-value">{formatNumber(usageData.totalTokens)}</span>
                                <span className="usage-label">Total Tokens</span>
                            </div>
                            <div className="usage-stat">
                                <span className="usage-value">${usageData.totalCost.toFixed(2)}</span>
                                <span className="usage-label">Total Cost</span>
                            </div>
                        </div>

                        <div className="usage-breakdown">
                            <h4>Breakdown by Service</h4>
                            <div className="service-bars">
                                {Object.entries(usageData.byService).map(([service, data]) => (
                                    <div key={service} className="service-bar">
                                        <div className="service-info">
                                            <span className="service-name">{service}</span>
                                            <span className="service-cost">${data.cost.toFixed(2)}</span>
                                        </div>
                                        <div className="bar-container">
                                            <div
                                                className="bar-fill"
                                                style={{
                                                    width: `${(data.tokens / usageData.totalTokens) * 100}%`
                                                }}
                                            />
                                        </div>
                                        <span className="service-tokens">{formatNumber(data.tokens)} tokens</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="usage-chart">
                            <h4>Last 7 Days</h4>
                            <div className="chart-bars">
                                {usageData.dailyUsage.map((day, i) => (
                                    <div key={i} className="day-bar">
                                        <div
                                            className="day-fill"
                                            style={{
                                                height: `${(day.tokens / Math.max(...usageData.dailyUsage.map(d => d.tokens))) * 100}%`
                                            }}
                                            title={`${formatNumber(day.tokens)} tokens ($${day.cost.toFixed(2)})`}
                                        />
                                        <span className="day-label">
                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowUsageModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClientManagement;
