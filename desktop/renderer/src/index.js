import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ClientProvider } from './contexts/ClientContext';
import './styles/index.css';

// Use HashRouter for Electron (file:// protocol compatibility)
const Router = window.electronAPI ? HashRouter : BrowserRouter;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <Router>
            <AuthProvider>
                <DemoModeProvider>
                    <ClientProvider>
                        <ToastProvider>
                            <App />
                        </ToastProvider>
                    </ClientProvider>
                </DemoModeProvider>
            </AuthProvider>
        </Router>
    </React.StrictMode>
);
