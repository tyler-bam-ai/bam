import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Mock users for development
const MOCK_USERS = {
    'admin@bam.ai': {
        id: 'bam-admin-1',
        email: 'admin@bam.ai',
        name: 'BAM Admin',
        role: 'bam_admin',
        companyId: 'bam-internal',
        companyName: 'BAM.ai'
    },
    'provider@demo.com': {
        id: 'provider-1',
        email: 'provider@demo.com',
        name: 'Sarah Johnson',
        role: 'knowledge_provider',
        companyId: 'demo-company-1',
        companyName: 'Demo Company'
    },
    'consumer@demo.com': {
        id: 'consumer-1',
        email: 'consumer@demo.com',
        name: 'Mike Chen',
        role: 'knowledge_consumer',
        companyId: 'demo-company-1',
        companyName: 'Demo Company'
    }
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get API URL from config or default
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // Load user from token on mount
    useEffect(() => {
        async function loadUser() {
            try {
                // Check localStorage for token
                const token = localStorage.getItem('bam_token') || localStorage.getItem('token');

                if (token) {
                    // Verify token with backend
                    const response = await fetch(`${API_URL}/api/auth/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setUser(data.user);

                        // Also store in Electron if available
                        if (window.electronAPI) {
                            await window.electronAPI.auth.setUser(data.user);
                            await window.electronAPI.auth.setToken(token);
                        }
                    } else {
                        // Invalid token, clean up
                        localStorage.removeItem('bam_token');
                        localStorage.removeItem('token');
                    }
                } else if (window.electronAPI) {
                    // Try electron store as fallback
                    const storedUser = await window.electronAPI.auth.getUser();
                    if (storedUser) {
                        setUser(storedUser);
                    }
                }
            } catch (err) {
                console.error('Failed to load user:', err);
            } finally {
                setLoading(false);
            }
        }

        loadUser();
    }, [API_URL]);

    const login = useCallback(async (email, password) => {
        setError(null);
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setUser(data.user);

                // Store token in localStorage
                localStorage.setItem('bam_token', data.token);
                localStorage.setItem('token', data.token);

                if (window.electronAPI) {
                    await window.electronAPI.auth.setUser(data.user);
                    await window.electronAPI.auth.setToken(data.token);
                }

                return { success: true, user: data.user };
            }

            const errorMessage = data.error || 'Invalid email or password';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } catch (err) {
            const errorMessage = err.message || 'Login failed';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    }, [API_URL]);

    const register = useCallback(async (email, password, name, companyName) => {
        setError(null);
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, companyName })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setUser(data.user);

                // Store token in localStorage
                localStorage.setItem('bam_token', data.token);
                localStorage.setItem('token', data.token);

                if (window.electronAPI) {
                    await window.electronAPI.auth.setUser(data.user);
                    await window.electronAPI.auth.setToken(data.token);
                }

                return { success: true, user: data.user };
            }

            const errorMessage = data.error || 'Registration failed';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } catch (err) {
            const errorMessage = err.message || 'Registration failed';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    }, [API_URL]);

    const logout = useCallback(async () => {
        try {
            // Clear localStorage
            localStorage.removeItem('bam_token');
            localStorage.removeItem('token');

            if (window.electronAPI) {
                await window.electronAPI.auth.logout();
            }
            setUser(null);
        } catch (err) {
            console.error('Logout error:', err);
        }
    }, []);

    const setToken = useCallback(async (token) => {
        localStorage.setItem('bam_token', token);
        localStorage.setItem('token', token);
    }, []);

    const updateUser = useCallback(async (updates) => {
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);

        if (window.electronAPI) {
            await window.electronAPI.auth.setUser(updatedUser);
        }
    }, [user]);

    // Role checking helpers
    const hasRole = useCallback((roles) => {
        if (!user) return false;
        if (Array.isArray(roles)) {
            return roles.includes(user.role);
        }
        return user.role === roles;
    }, [user]);

    const isAdmin = useCallback(() => {
        return hasRole('bam_admin');
    }, [hasRole]);

    const isProvider = useCallback(() => {
        return hasRole(['knowledge_provider', 'client_admin', 'bam_admin']);
    }, [hasRole]);

    const isConsumer = useCallback(() => {
        return hasRole(['knowledge_consumer', 'client_admin', 'bam_admin']);
    }, [hasRole]);

    const value = {
        user,
        loading,
        error,
        login,
        register,
        logout,
        setToken,
        updateUser,
        hasRole,
        isAdmin,
        isProvider,
        isConsumer
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
