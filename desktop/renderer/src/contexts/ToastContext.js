/**
 * Toast Notification Context
 * 
 * Provides app-wide toast notifications for success, error, warning, and info messages.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import './ToastContext.css';

const ToastContext = createContext(null);

// Toast types with icons and colors
const TOAST_CONFIG = {
    success: { icon: CheckCircle, className: 'toast-success' },
    error: { icon: XCircle, className: 'toast-error' },
    warning: { icon: AlertTriangle, className: 'toast-warning' },
    info: { icon: Info, className: 'toast-info' },
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type };

        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Convenience methods
    const toast = {
        success: (message, duration) => addToast(message, 'success', duration),
        error: (message, duration) => addToast(message, 'error', duration ?? 6000),
        warning: (message, duration) => addToast(message, 'warning', duration),
        info: (message, duration) => addToast(message, 'info', duration),
    };

    return (
        <ToastContext.Provider value={{ toast, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts, onRemove }) {
    return (
        <div className="toast-container">
            {toasts.map(toast => {
                const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
                const Icon = config.icon;

                return (
                    <div key={toast.id} className={`toast ${config.className}`}>
                        <Icon size={18} className="toast-icon" />
                        <span className="toast-message">{toast.message}</span>
                        <button
                            className="toast-close"
                            onClick={() => onRemove(toast.id)}
                        >
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export default ToastContext;
