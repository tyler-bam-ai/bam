/**
 * Team Management Component
 * 
 * Allows client admins to manage their team:
 * - View users
 * - Invite new users
 * - Change roles
 * - Delete users
 */

import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Shield,
    Trash2,
    Mail,
    Crown,
    User,
    Loader2,
    Check,
    X,
    AlertCircle
} from 'lucide-react';
import { useClientContext } from '../contexts/ClientContext';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import './TeamManagement.css';

function TeamManagement() {
    const { selectedClient } = useClientContext();
    const { user } = useAuth();

    // Get clientId from selected client or user's company
    const clientId = selectedClient?.id || user?.companyId;
    const clientName = selectedClient?.companyName || user?.companyName || 'Your Company';

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviting, setInviting] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState('knowledge_consumer');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Fetch users
    const fetchUsers = async () => {
        if (!clientId) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/clients/${clientId}/users`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (err) {
            console.error('[TEAM] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [clientId]);

    // Invite user
    const handleInvite = async (e) => {
        e.preventDefault();
        if (!newUserEmail.trim()) return;

        setError(null);
        setInviting(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/clients/${clientId}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    email: newUserEmail,
                    name: newUserName,
                    role: newUserRole
                })
            });

            const data = await response.json();

            if (response.ok) {
                setUsers(prev => [...prev, data.user]);
                setNewUserEmail('');
                setNewUserName('');
                setNewUserRole('knowledge_consumer');
                setSuccess(`Invited ${data.user.email}. Temporary password: ${data.user.temporaryPassword}`);
                setTimeout(() => setSuccess(null), 10000);
            } else {
                setError(data.error || 'Failed to invite user');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setInviting(false);
        }
    };

    // Update role
    const handleRoleChange = async (userId, newRole) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/api/clients/${clientId}/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ role: newRole })
            });

            setUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, role: newRole } : u
            ));
        } catch (err) {
            console.error('[TEAM] Role update error:', err);
        }
    };

    // Delete user
    const handleDelete = async (userId, userEmail) => {
        if (!window.confirm(`Remove ${userEmail} from the team?`)) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/clients/${clientId}/users/${userId}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            const data = await response.json();

            if (response.ok) {
                setUsers(prev => prev.filter(u => u.id !== userId));
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const getRoleBadge = (role) => {
        if (role === 'client_admin') {
            return <span className="role-badge admin"><Crown size={12} /> Admin</span>;
        }
        return <span className="role-badge user"><User size={12} /> User</span>;
    };

    return (
        <div className="team-management">
            <div className="tm-header">
                <div className="tm-header-left">
                    <Users size={24} />
                    <div>
                        <h2>Team Management</h2>
                        <p>{clientName} • {users.length} member{users.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="tm-alert success">
                    <Check size={16} />
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)}><X size={14} /></button>
                </div>
            )}
            {error && (
                <div className="tm-alert error">
                    <X size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}><X size={14} /></button>
                </div>
            )}

            {/* Invite Form */}
            <div className="tm-invite-section">
                <h3><UserPlus size={18} /> Invite New Team Member</h3>
                <form onSubmit={handleInvite} className="tm-invite-form">
                    <div className="tm-form-row">
                        <input
                            type="email"
                            placeholder="Email address"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Name (optional)"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                        />
                        <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value)}
                        >
                            <option value="knowledge_consumer">User</option>
                            <option value="client_admin">Admin</option>
                        </select>
                        <button type="submit" disabled={inviting} className="btn btn-primary">
                            {inviting ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                            Invite
                        </button>
                    </div>
                </form>
            </div>

            {/* Users List */}
            <div className="tm-users-list">
                {loading ? (
                    <div className="tm-loading">
                        <Loader2 size={24} className="spin" />
                        <span>Loading team...</span>
                    </div>
                ) : users.length === 0 ? (
                    <div className="tm-empty">
                        <Users size={48} />
                        <p>No team members yet. Invite your first user above!</p>
                    </div>
                ) : (
                    users.map((user, index) => (
                        <div key={user.id} className="tm-user-card">
                            <div className="tm-user-avatar">
                                {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="tm-user-info">
                                <div className="tm-user-name">
                                    {user.name || user.email.split('@')[0]}
                                    {index === 0 && <span className="first-badge">Owner</span>}
                                </div>
                                <div className="tm-user-email">
                                    <Mail size={12} />
                                    {user.email}
                                </div>
                            </div>
                            <div className="tm-user-role">
                                <select
                                    value={user.role}
                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                    disabled={index === 0} // Can't change owner role
                                >
                                    <option value="knowledge_consumer">User</option>
                                    <option value="client_admin">Admin</option>
                                </select>
                            </div>
                            <div className="tm-user-actions">
                                {getRoleBadge(user.role)}
                                {index !== 0 && (
                                    <button
                                        className="btn btn-ghost btn-icon btn-sm btn-danger"
                                        onClick={() => handleDelete(user.id, user.email)}
                                        title="Remove user"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default TeamManagement;
