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

    // Load user from Electron store on mount
    useEffect(() => {
        async function loadUser() {
            try {
                if (window.electronAPI) {
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
    }, []);

    const login = useCallback(async (email, password) => {
        setError(null);
        setLoading(true);

        try {
            // Mock authentication for development
            const mockUser = MOCK_USERS[email.toLowerCase()];

            if (mockUser && password === 'demo123') {
                setUser(mockUser);

                if (window.electronAPI) {
                    await window.electronAPI.auth.setUser(mockUser);
                    await window.electronAPI.auth.setToken('mock-jwt-token');
                }

                return { success: true, user: mockUser };
            }

            setError('Invalid email or password');
            return { success: false, error: 'Invalid email or password' };
        } catch (err) {
            const errorMessage = err.message || 'Login failed';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            if (window.electronAPI) {
                await window.electronAPI.auth.logout();
            }
            setUser(null);
        } catch (err) {
            console.error('Logout error:', err);
        }
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
        logout,
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
