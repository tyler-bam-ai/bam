import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Layout
import AppShell from './components/AppShell';

// Pages
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import KnowledgeProvider from './pages/KnowledgeProvider';
import KnowledgeConsumer from './pages/KnowledgeConsumer';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import ContentEngine from './pages/ContentEngine';
import SocialMediaDashboard from './pages/SocialMediaDashboard';
import Onboarding from './pages/Onboarding';
import WidgetManagement from './pages/WidgetManagement';

function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

function App() {
    const { user } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/" element={
                <ProtectedRoute>
                    <AppShell />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                <Route path="provider/*" element={
                    <ProtectedRoute allowedRoles={['knowledge_provider', 'client_admin', 'bam_admin']}>
                        <KnowledgeProvider />
                    </ProtectedRoute>
                } />

                <Route path="consumer/*" element={
                    <ProtectedRoute allowedRoles={['knowledge_consumer', 'client_admin', 'bam_admin']}>
                        <KnowledgeConsumer />
                    </ProtectedRoute>
                } />

                {/* Combined Admin Panel (includes Client Management) */}
                <Route path="admin/*" element={
                    <ProtectedRoute allowedRoles={['bam_admin']}>
                        <AdminPanel />
                    </ProtectedRoute>
                } />

                {/* Onboarding as standalone page */}
                <Route path="onboarding/*" element={
                    <ProtectedRoute allowedRoles={['bam_admin']}>
                        <Onboarding />
                    </ProtectedRoute>
                } />

                <Route path="content/*" element={
                    <ProtectedRoute allowedRoles={['client_admin', 'bam_admin']}>
                        <ContentEngine />
                    </ProtectedRoute>
                } />

                <Route path="social/*" element={
                    <ProtectedRoute allowedRoles={['client_admin', 'bam_admin']}>
                        <SocialMediaDashboard />
                    </ProtectedRoute>
                } />

                <Route path="widget/*" element={
                    <ProtectedRoute allowedRoles={['client_admin', 'bam_admin']}>
                        <WidgetManagement />
                    </ProtectedRoute>
                } />

                <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
