/**
 * Knowledge Base Page
 * 
 * Full view of all knowledge items for the selected client.
 * Features: list, filter, sort, view content, delete items.
 */

import React, { useState, useEffect } from 'react';
import {
    Database,
    FileText,
    Mic,
    Video,
    MessageSquare,
    Search,
    Filter,
    SortAsc,
    SortDesc,
    Trash2,
    Eye,
    X,
    Calendar,
    Loader2,
    RefreshCw,
    AlertCircle,
    Lock,
    User,
    Users,
    ThumbsUp,
    Share2,
    Shield,
    ChevronUp
} from 'lucide-react';
import { useClientContext } from '../contexts/ClientContext';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import './KnowledgeBase.css';

// Type icons
const TYPE_ICONS = {
    document: FileText,
    voice_memo: Mic,
    transcript: MessageSquare,
    video: Video,
    text: FileText,
    default: Database
};

const TYPE_LABELS = {
    document: 'Document',
    voice_memo: 'Voice Memo',
    transcript: 'Transcript',
    video: 'Video',
    text: 'Text'
};

const TYPE_COLORS = {
    document: '#3b82f6',
    voice_memo: '#22c55e',
    transcript: '#f59e0b',
    video: '#ec4899',
    text: '#8b5cf6'
};

function KnowledgeBase({ layer = 'personal' }) {
    const { selectedClient } = useClientContext();
    const { user } = useAuth();

    // Get effective clientId
    const clientId = selectedClient?.id || user?.companyId || null;
    const clientName = selectedClient?.companyName || user?.companyName || 'Your Company';
    const userId = user?.id;

    // Check if user is admin (can edit vault)
    const isAdmin = user?.role === 'bam_admin' || user?.role === 'client_admin';

    // Layer-specific config
    const LAYER_CONFIG = {
        personal: {
            title: 'My Stuff',
            subtitle: 'Your personal uploads that enhance your Brain',
            icon: User,
            canDelete: true,
            canShare: true,  // Can share to library
            canSave: false   // Already yours
        },
        library: {
            title: 'Library',
            subtitle: 'Shared knowledge from your team. Upvote the best!',
            icon: Users,
            canDelete: false,  // Can't delete others' shared items
            canShare: false,
            canSave: true,     // Can save to personal
            canPromote: isAdmin  // Admins can promote to Knowledge Base
        },
        vault: {
            title: 'Knowledge Base',
            subtitle: 'Company-wide knowledge. ' + (isAdmin ? 'Admin access granted.' : 'View only.'),
            icon: Lock,
            canDelete: isAdmin,
            canShare: false,
            canSave: true      // Can copy to personal
        },
        admin_vault: {
            title: 'Vault',
            subtitle: 'Sensitive company documents. Admin access only.',
            icon: Shield,
            canDelete: true,   // Admins can delete
            canShare: false,   // No sharing to library
            canSave: false,    // Stays in vault
            isAdminOnly: true  // Used for filtering in brain queries
        }
    };

    const config = LAYER_CONFIG[layer] || LAYER_CONFIG.personal;
    const LayerIcon = config.icon;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters and sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortBy, setSortBy] = useState(layer === 'library' ? 'upvotes' : 'created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    // Modal for viewing item content
    const [viewingItem, setViewingItem] = useState(null);

    // Delete confirmation
    const [deletingItem, setDeletingItem] = useState(null);

    // Fetch knowledge items
    const fetchItems = async () => {
        if (!clientId) {
            setItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/knowledge/${clientId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (response.ok) {
                const data = await response.json();
                setItems(data.items || []);
                console.log(`[KNOWLEDGE BASE] Loaded ${data.items?.length || 0} items for client ${clientId}`);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to load knowledge items');
            }
        } catch (err) {
            console.error('[KNOWLEDGE BASE] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [clientId]);

    // Delete item
    const handleDelete = async (itemId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/knowledge/item/${itemId}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (response.ok) {
                setItems(prev => prev.filter(item => item.id !== itemId));
                setDeletingItem(null);
            } else {
                const errorData = await response.json();
                alert(`Failed to delete: ${errorData.error}`);
            }
        } catch (err) {
            console.error('[KNOWLEDGE BASE] Delete error:', err);
            alert(`Delete error: ${err.message}`);
        }
    };

    // Upvote library item
    const handleUpvote = async (itemId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/knowledge/library/${itemId}/upvote`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (response.ok) {
                const data = await response.json();
                // Update local state with new upvote count
                setItems(prev => prev.map(item =>
                    item.id === itemId ? { ...item, upvotes: data.upvotes } : item
                ));
            }
        } catch (err) {
            console.error('[KNOWLEDGE BASE] Upvote error:', err);
        }
    };

    // Share personal item to library
    const handleShareToLibrary = async (itemId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/knowledge/item/${itemId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (response.ok) {
                alert('Shared to Library successfully!');
                fetchItems(); // Refresh to show new library item
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to share');
            }
        } catch (err) {
            console.error('[KNOWLEDGE BASE] Share error:', err);
            alert('Failed to share: ' + err.message);
        }
    };

    // Save item to personal knowledge or vault
    const handleSaveTo = async (itemId, targetLayer) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/knowledge/item/${itemId}/copy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ targetLayer })
            });

            if (response.ok) {
                const layerName = targetLayer === 'vault' ? 'Knowledge Base' : 'My Stuff';
                alert(`Saved to ${layerName} successfully!`);
                fetchItems(); // Refresh
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to save');
            }
        } catch (err) {
            console.error('[KNOWLEDGE BASE] Save error:', err);
            alert('Failed to save: ' + err.message);
        }
    };

    // Filter and sort items
    const filteredItems = items
        .filter(item => {
            // Filter by this page's layer
            if (item.layer !== layer && layer !== 'admin_vault') return false;
            if (layer === 'admin_vault' && item.layer !== 'admin_vault') return false;

            // For personal layer, only show items belonging to the current user
            if (layer === 'personal' && item.userId && userId && item.userId !== userId) {
                return false;
            }

            // Type filter
            if (typeFilter !== 'all' && item.type !== typeFilter) return false;

            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return (
                    item.title?.toLowerCase().includes(search) ||
                    item.preview?.toLowerCase().includes(search) ||
                    item.type?.toLowerCase().includes(search)
                );
            }
            return true;
        })
        .sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'created_at') {
                comparison = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
            } else if (sortBy === 'title') {
                comparison = (a.title || '').localeCompare(b.title || '');
            } else if (sortBy === 'type') {
                comparison = (a.type || '').localeCompare(b.type || '');
            } else if (sortBy === 'wordCount') {
                comparison = (a.wordCount || 0) - (b.wordCount || 0);
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

    // Get unique types for filter dropdown
    const uniqueTypes = [...new Set(items.map(item => item.type))];

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get icon for type
    const getTypeIcon = (type) => {
        const IconComponent = TYPE_ICONS[type] || TYPE_ICONS.default;
        return IconComponent;
    };

    if (!clientId) {
        return (
            <div className="knowledge-base-page">
                <div className="kb-empty-state">
                    <AlertCircle size={48} />
                    <h2>No Client Selected</h2>
                    <p>Select a client in the Admin panel to view their knowledge base, or log in as a client user.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="knowledge-base-page">
            {/* Header */}
            <div className="kb-header">
                <div className="kb-header-left">
                    <LayerIcon size={28} />
                    <div>
                        <h1>{config.title}</h1>
                        <p className="kb-subtitle">{config.subtitle}</p>
                    </div>
                </div>
                <div className="kb-header-right">
                    <span className="kb-item-count">{filteredItems.length} items</span>
                    <button className="btn btn-secondary" onClick={fetchItems} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="kb-filters">
                <div className="kb-search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search knowledge items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="kb-filter-group">
                    <Filter size={16} />
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="all">All Types</option>
                        {uniqueTypes.map(type => (
                            <option key={type} value={type}>{TYPE_LABELS[type] || type}</option>
                        ))}
                    </select>
                </div>

                <div className="kb-filter-group">
                    {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="created_at">Date</option>
                        <option value="title">Title</option>
                        <option value="type">Type</option>
                        <option value="wordCount">Word Count</option>
                    </select>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                    >
                        {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="kb-loading">
                    <Loader2 size={32} className="spin" />
                    <p>Loading knowledge items...</p>
                </div>
            ) : error ? (
                <div className="kb-error">
                    <AlertCircle size={32} />
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchItems}>Retry</button>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="kb-empty-state">
                    <Database size={48} />
                    <h2>No Knowledge Items</h2>
                    <p>
                        {searchTerm || typeFilter !== 'all'
                            ? 'No items match your filters. Try adjusting your search.'
                            : 'Add documents, voice memos, or transcripts in Brain Training to populate the knowledge base.'
                        }
                    </p>
                </div>
            ) : (
                <div className="kb-items-grid">
                    {filteredItems.map((item) => {
                        const TypeIcon = getTypeIcon(item.type);
                        const typeColor = TYPE_COLORS[item.type] || '#6b7280';

                        return (
                            <div key={item.id} className="kb-item-card">
                                <div className="kb-item-header">
                                    <div className="kb-item-badges">
                                        <div
                                            className="kb-item-type-badge"
                                            style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
                                        >
                                            <TypeIcon size={14} />
                                            {TYPE_LABELS[item.type] || item.type}
                                        </div>
                                        {/* Layer badge */}
                                        {item.layer && (
                                            <span className={`kb-item-layer-badge ${item.layer}`}>
                                                {item.layer === 'vault' && <Lock size={10} />}
                                                {item.layer === 'personal' && <User size={10} />}
                                                {item.layer === 'library' && <Users size={10} />}
                                                {item.layer}
                                            </span>
                                        )}
                                    </div>
                                    <div className="kb-item-actions">
                                        {/* Upvote button for library items */}
                                        {layer === 'library' && (
                                            <button
                                                className="kb-item-upvote"
                                                onClick={() => handleUpvote(item.id)}
                                                title="Upvote"
                                            >
                                                <ThumbsUp size={14} />
                                                {item.upvotes || 0}
                                            </button>
                                        )}

                                        {/* Share to Library (from personal) */}
                                        {config.canShare && (
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                onClick={() => handleShareToLibrary(item.id)}
                                                title="Share to Library"
                                            >
                                                <Share2 size={16} />
                                            </button>
                                        )}

                                        {/* Save to personal (from library/vault) */}
                                        {config.canSave && (
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                onClick={() => handleSaveTo(item.id, 'personal')}
                                                title="Save to My Stuff"
                                            >
                                                <User size={16} />
                                            </button>
                                        )}

                                        {/* Promote to Knowledge Base (admin from library) */}
                                        {config.canPromote && (
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                onClick={() => handleSaveTo(item.id, 'vault')}
                                                title="Add to Knowledge Base"
                                            >
                                                <Lock size={16} />
                                            </button>
                                        )}

                                        <button
                                            className="btn btn-ghost btn-icon btn-sm"
                                            onClick={() => setViewingItem(item)}
                                            title="View"
                                        >
                                            <Eye size={16} />
                                        </button>

                                        {/* Delete based on config */}
                                        {config.canDelete && (
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm btn-danger"
                                                onClick={() => setDeletingItem(item)}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <h3 className="kb-item-title">{item.title}</h3>

                                <p className="kb-item-preview">{item.preview || 'No preview available'}</p>

                                <div className="kb-item-meta">
                                    <span className="kb-item-date">
                                        <Calendar size={12} />
                                        {formatDate(item.createdAt)}
                                    </span>
                                    {item.wordCount > 0 && (
                                        <span className="kb-item-words">{item.wordCount} words</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* View Modal */}
            {viewingItem && (
                <div className="kb-modal-overlay" onClick={() => setViewingItem(null)}>
                    <div className="kb-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="kb-modal-header">
                            <h2>{viewingItem.title}</h2>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setViewingItem(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="kb-modal-content">
                            <div className="kb-modal-meta">
                                <span className="kb-item-type-badge" style={{
                                    backgroundColor: `${TYPE_COLORS[viewingItem.type] || '#6b7280'}20`,
                                    color: TYPE_COLORS[viewingItem.type] || '#6b7280'
                                }}>
                                    {TYPE_LABELS[viewingItem.type] || viewingItem.type}
                                </span>
                                <span>{formatDate(viewingItem.createdAt)}</span>
                                {viewingItem.wordCount > 0 && (
                                    <span>{viewingItem.wordCount} words</span>
                                )}
                            </div>
                            <div className="kb-modal-text">
                                {viewingItem.content || viewingItem.preview || 'No content available'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingItem && (
                <div className="kb-modal-overlay" onClick={() => setDeletingItem(null)}>
                    <div className="kb-modal kb-modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="kb-modal-header">
                            <h2>Delete Item?</h2>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setDeletingItem(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="kb-modal-content">
                            <p>Are you sure you want to delete "{deletingItem.title}"?</p>
                            <p className="text-secondary">This action cannot be undone.</p>
                        </div>
                        <div className="kb-modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setDeletingItem(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleDelete(deletingItem.id)}
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default KnowledgeBase;
