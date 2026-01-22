/**
 * Client Context
 * 
 * Global React context for the currently selected client.
 * Persists across tabs and allows admin users to simulate viewing
 * the app from a specific client's perspective.
 * 
 * For non-BAM users (client_admin, knowledge_provider, knowledge_consumer),
 * automatically sets their company as the selected client.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const ClientContext = createContext(null);

const STORAGE_KEY = 'bam_selected_client';

export function ClientProvider({ children }) {
    const { user, loading: authLoading } = useAuth();
    const [selectedClient, setSelectedClient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load selected client from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const client = JSON.parse(stored);
                setSelectedClient(client);
            }
        } catch (err) {
            console.error('[ClientContext] Failed to load stored client:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // AUTO-SELECT CLIENT FOR NON-BAM USERS
    // Non-BAM users should always have their own company selected
    // This enables all features (Brain, My Stuff, etc.) without admin configuration
    useEffect(() => {
        if (authLoading) return; // Wait for auth to load

        if (user && user.role !== 'bam_admin') {
            // Non-BAM user - auto-select their company
            if (!selectedClient || selectedClient.id !== user.companyId) {
                const autoClient = {
                    id: user.companyId,
                    companyName: user.companyName || 'My Company',
                    // Add any other fields that might be needed
                };
                console.log('[ClientContext] Auto-selecting client for non-BAM user:', autoClient.companyName);
                setSelectedClient(autoClient);
            }
        }
    }, [user, authLoading, selectedClient]);

    // Persist selected client to localStorage
    useEffect(() => {
        if (selectedClient) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedClient));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [selectedClient]);

    const selectClient = (client) => {
        console.log('[ClientContext] Selecting client:', client?.companyName || 'none');
        setSelectedClient(client);
    };

    const clearClient = () => {
        console.log('[ClientContext] Clearing selected client');
        // For non-BAM users, don't allow clearing - it will auto-reselect anyway
        if (user?.role === 'bam_admin') {
            setSelectedClient(null);
        }
    };

    const value = {
        selectedClient,
        selectClient,
        clearClient,
        isClientSelected: !!selectedClient,
        isLoading: isLoading || authLoading
    };

    return (
        <ClientContext.Provider value={value}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClientContext() {
    const context = useContext(ClientContext);
    if (!context) {
        throw new Error('useClientContext must be used within a ClientProvider');
    }
    return context;
}

export default ClientContext;

