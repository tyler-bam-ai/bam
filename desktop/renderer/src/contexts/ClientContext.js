/**
 * Client Context
 * 
 * Global React context for the currently selected client.
 * Persists across tabs and allows admin users to simulate viewing
 * the app from a specific client's perspective.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ClientContext = createContext(null);

const STORAGE_KEY = 'bam_selected_client';

export function ClientProvider({ children }) {
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
        setSelectedClient(null);
    };

    const value = {
        selectedClient,
        selectClient,
        clearClient,
        isClientSelected: !!selectedClient,
        isLoading
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

// Alias for backward compatibility
export function useClient() {
    const { selectedClient, selectClient, clearClient, isClientSelected } = useClientContext();
    return {
        currentClient: selectedClient,
        selectClient,
        clearClient,
        isClientSelected
    };
}

export default ClientContext;
