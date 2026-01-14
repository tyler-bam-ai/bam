/**
 * Widget Management Page
 * Configure and manage customer chat widgets
 */

import React, { useState, useEffect } from 'react';
import {
    MessageSquare,
    Plus,
    Copy,
    Check,
    Trash2,
    Edit3,
    Palette,
    Settings,
    BarChart3,
    Code,
    RefreshCw,
    Loader2,
    ExternalLink
} from 'lucide-react';
import { useDemoMode } from '../contexts/DemoModeContext';
import './WidgetManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Demo mock data for Widget Management
const DEMO_WIDGETS = [
    { id: 'widget-demo-1', name: 'Website Chat', primaryColor: '#8b5cf6', agentName: 'BAM Assistant', greeting: 'Hi! How can I help you today?', position: 'bottom-right', placeholderText: 'Type your message...', showAgentName: true, allowFileUpload: false },
    { id: 'widget-demo-2', name: 'Support Portal', primaryColor: '#10b981', agentName: 'Support Bot', greeting: 'Welcome! I\'m here to help with any questions.', position: 'bottom-right', placeholderText: 'Ask a question...', showAgentName: true, allowFileUpload: true },
    { id: 'widget-demo-3', name: 'Sales Assistant', primaryColor: '#f59e0b', agentName: 'Sales AI', greeting: 'Hello! Looking for information about our products?', position: 'bottom-left', placeholderText: 'How can I help?', showAgentName: true, allowFileUpload: false },
];

const DEMO_ANALYTICS = {
    totalSessions: 1847,
    totalMessages: 4523,
    handoverRate: 12,
    avgRating: 4.7
};

function WidgetManagement() {
    const { isDemoMode } = useDemoMode();

    const [widgets, setWidgets] = useState([]);
    const [selectedWidget, setSelectedWidget] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [analytics, setAnalytics] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        greeting: 'Hi! How can I help you today?',
        agentName: 'BAM Assistant',
        primaryColor: '#8b5cf6',
        placeholderText: 'Type your message...',
        offlineMessage: "We'll get back to you soon!",
        position: 'bottom-right',
        showAgentName: true,
        allowFileUpload: false
    });

    // Load demo data when demo mode is enabled
    useEffect(() => {
        if (isDemoMode) {
            const demoWidget = DEMO_WIDGETS[0];
            setWidgets(DEMO_WIDGETS);
            setSelectedWidget(demoWidget);
            setAnalytics(DEMO_ANALYTICS);
            // Inline form loading
            setFormData({
                name: demoWidget.name || '',
                greeting: demoWidget.greeting || 'Hi! How can I help you today?',
                agentName: demoWidget.agentName || 'BAM Assistant',
                primaryColor: demoWidget.primaryColor || '#8b5cf6',
                placeholderText: demoWidget.placeholderText || 'Type your message...',
                offlineMessage: demoWidget.offlineMessage || "We'll get back to you soon!",
                position: demoWidget.position || 'bottom-right',
                showAgentName: demoWidget.showAgentName !== false,
                allowFileUpload: demoWidget.allowFileUpload || false
            });
            setIsLoading(false);
        } else {
            setWidgets([]);
            setSelectedWidget(null);
            setAnalytics(null);
            setIsLoading(false);
        }
    }, [isDemoMode]);

    useEffect(() => {
        if (!isDemoMode) {
            fetchWidgets();
        }
    }, [isDemoMode]);

    useEffect(() => {
        if (selectedWidget && !isDemoMode) {
            fetchAnalytics(selectedWidget.id);
        } else if (selectedWidget && isDemoMode) {
            setAnalytics(DEMO_ANALYTICS);
        }
    }, [selectedWidget, isDemoMode]);

    const fetchWidgets = async () => {
        if (isDemoMode) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/widget/manage/list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setWidgets(data.widgets);
                if (data.widgets.length > 0 && !selectedWidget) {
                    setSelectedWidget(data.widgets[0]);
                }
            }
        } catch (err) {
            console.error('Fetch widgets error:', err);
            setError('Failed to load widgets');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAnalytics = async (widgetId) => {
        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/widget/manage/${widgetId}/analytics`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setAnalytics(data.analytics);
            }
        } catch (err) {
            console.error('Fetch analytics error:', err);
        }
    };

    const createWidget = async () => {
        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/widget/manage`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                setWidgets(prev => [...prev, data.widget]);
                setSelectedWidget(data.widget);
                setShowCreateForm(false);
                resetForm();
            } else {
                setError(data.error);
            }
        } catch (err) {
            console.error('Create widget error:', err);
            setError('Failed to create widget');
        }
    };

    const updateWidget = async () => {
        if (!selectedWidget) return;

        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/widget/manage/${selectedWidget.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                setWidgets(prev => prev.map(w => w.id === data.widget.id ? data.widget : w));
                setSelectedWidget(data.widget);
            }
        } catch (err) {
            console.error('Update widget error:', err);
            setError('Failed to update widget');
        }
    };

    const deleteWidget = async (widgetId) => {
        if (!window.confirm('Are you sure you want to delete this widget?')) return;

        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/widget/manage/${widgetId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setWidgets(prev => prev.filter(w => w.id !== widgetId));
                if (selectedWidget?.id === widgetId) {
                    setSelectedWidget(widgets.filter(w => w.id !== widgetId)[0] || null);
                }
            }
        } catch (err) {
            console.error('Delete widget error:', err);
            setError('Failed to delete widget');
        }
    };

    const copyEmbedCode = () => {
        if (!selectedWidget) return;
        const embedCode = `<script src="${API_URL}/widget.js" data-widget-id="${selectedWidget.id}"></script>`;
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            greeting: 'Hi! How can I help you today?',
            agentName: 'BAM Assistant',
            primaryColor: '#8b5cf6',
            placeholderText: 'Type your message...',
            offlineMessage: "We'll get back to you soon!",
            position: 'bottom-right',
            showAgentName: true,
            allowFileUpload: false
        });
    };

    const loadWidgetForEdit = (widget) => {
        setFormData({
            name: widget.name || '',
            greeting: widget.greeting || 'Hi! How can I help you today?',
            agentName: widget.agentName || 'BAM Assistant',
            primaryColor: widget.primaryColor || '#8b5cf6',
            placeholderText: widget.placeholderText || 'Type your message...',
            offlineMessage: widget.offlineMessage || "We'll get back to you soon!",
            position: widget.position || 'bottom-right',
            showAgentName: widget.showAgentName !== false,
            allowFileUpload: widget.allowFileUpload || false
        });
    };

    return (
        <div className="widget-management">
            <header className="widget-header">
                <div className="header-title">
                    <MessageSquare size={28} />
                    <div>
                        <h1>Customer Chat Widget</h1>
                        <p>Configure and embed AI chat on your website</p>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => { setShowCreateForm(true); resetForm(); }}>
                    <Plus size={18} />
                    Create Widget
                </button>
            </header>

            <div className="widget-layout">
                {/* Widget List */}
                <aside className="widget-list">
                    <h3>Your Widgets</h3>
                    {isLoading ? (
                        <div className="loading-state">
                            <Loader2 className="spinning" size={24} />
                        </div>
                    ) : widgets.length === 0 ? (
                        <div className="empty-list">
                            <MessageSquare size={32} />
                            <p>No widgets yet</p>
                            <button onClick={() => setShowCreateForm(true)}>Create your first widget</button>
                        </div>
                    ) : (
                        <div className="widgets">
                            {widgets.map(widget => (
                                <div
                                    key={widget.id}
                                    className={`widget-item ${selectedWidget?.id === widget.id ? 'active' : ''}`}
                                    onClick={() => { setSelectedWidget(widget); loadWidgetForEdit(widget); }}
                                >
                                    <div
                                        className="widget-color"
                                        style={{ background: widget.primaryColor || '#8b5cf6' }}
                                    />
                                    <div className="widget-info">
                                        <span className="widget-name">{widget.name}</span>
                                        <span className="widget-id">{widget.id}</span>
                                    </div>
                                    <button
                                        className="btn-delete"
                                        onClick={(e) => { e.stopPropagation(); deleteWidget(widget.id); }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* Widget Details */}
                <main className="widget-details">
                    {showCreateForm ? (
                        <div className="widget-form-section">
                            <h2><Plus size={20} /> Create New Widget</h2>
                            <WidgetForm
                                formData={formData}
                                setFormData={setFormData}
                                onSubmit={createWidget}
                                onCancel={() => setShowCreateForm(false)}
                                submitLabel="Create Widget"
                            />
                        </div>
                    ) : selectedWidget ? (
                        <>
                            {/* Embed Code */}
                            <section className="embed-section">
                                <h3><Code size={18} /> Embed Code</h3>
                                <p>Add this code to your website to display the chat widget.</p>
                                <div className="embed-code">
                                    <code>{`<script src="${API_URL}/widget.js" data-widget-id="${selectedWidget.id}"></script>`}</code>
                                    <button onClick={copyEmbedCode}>
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </section>

                            {/* Analytics */}
                            {analytics && (
                                <section className="analytics-section">
                                    <h3><BarChart3 size={18} /> Analytics</h3>
                                    <div className="analytics-grid">
                                        <div className="analytics-card">
                                            <span className="analytics-value">{analytics.totalSessions}</span>
                                            <span className="analytics-label">Total Sessions</span>
                                        </div>
                                        <div className="analytics-card">
                                            <span className="analytics-value">{analytics.totalMessages}</span>
                                            <span className="analytics-label">Messages</span>
                                        </div>
                                        <div className="analytics-card">
                                            <span className="analytics-value">{analytics.handoverRate}%</span>
                                            <span className="analytics-label">Handover Rate</span>
                                        </div>
                                        <div className="analytics-card">
                                            <span className="analytics-value">{analytics.avgRating || 'N/A'}</span>
                                            <span className="analytics-label">Avg Rating</span>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Configuration */}
                            <section className="config-section">
                                <h3><Settings size={18} /> Configuration</h3>
                                <WidgetForm
                                    formData={formData}
                                    setFormData={setFormData}
                                    onSubmit={updateWidget}
                                    submitLabel="Save Changes"
                                />
                            </section>

                            {/* Preview */}
                            <section className="preview-section">
                                <h3><ExternalLink size={18} /> Preview</h3>
                                <div className="preview-container">
                                    <div
                                        className="preview-widget"
                                        style={{ '--preview-color': formData.primaryColor }}
                                    >
                                        <div className="preview-header">
                                            <span className="preview-avatar">✨</span>
                                            <div>
                                                <strong>{formData.agentName}</strong>
                                                <span>Online</span>
                                            </div>
                                        </div>
                                        <div className="preview-messages">
                                            <div className="preview-message assistant">
                                                {formData.greeting}
                                            </div>
                                        </div>
                                        <div className="preview-input">
                                            <input
                                                type="text"
                                                placeholder={formData.placeholderText}
                                                disabled
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </>
                    ) : (
                        <div className="no-selection">
                            <MessageSquare size={48} />
                            <h3>Select a widget</h3>
                            <p>Choose a widget from the list or create a new one.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

// Widget Form Component
function WidgetForm({ formData, setFormData, onSubmit, onCancel, submitLabel }) {
    return (
        <div className="widget-form">
            <div className="form-group">
                <label>Widget Name</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Website Chat"
                />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Agent Name</label>
                    <input
                        type="text"
                        value={formData.agentName}
                        onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label><Palette size={14} /> Primary Color</label>
                    <div className="color-input">
                        <input
                            type="color"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        />
                        <input
                            type="text"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="form-group">
                <label>Greeting Message</label>
                <textarea
                    value={formData.greeting}
                    onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                    rows={2}
                />
            </div>

            <div className="form-group">
                <label>Input Placeholder</label>
                <input
                    type="text"
                    value={formData.placeholderText}
                    onChange={(e) => setFormData({ ...formData, placeholderText: e.target.value })}
                />
            </div>

            <div className="form-group">
                <label>Position</label>
                <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                </select>
            </div>

            <div className="form-actions">
                {onCancel && (
                    <button type="button" className="btn btn-secondary" onClick={onCancel}>
                        Cancel
                    </button>
                )}
                <button type="button" className="btn btn-primary" onClick={onSubmit}>
                    {submitLabel}
                </button>
            </div>
        </div>
    );
}

export default WidgetManagement;
