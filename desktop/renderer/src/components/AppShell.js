import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDemoMode } from '../contexts/DemoModeContext';
import { useClientContext } from '../contexts/ClientContext';
import Showcase from './Showcase';
import Onboarding from '../pages/Onboarding';
import {
    LayoutDashboard,
    Upload,
    MessageSquare,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Users,
    Sparkles,
    Menu,
    Video,
    Calendar,
    Building2,
    Play,
    Pause,
    Presentation,
    ClipboardList,
    X
} from 'lucide-react';
import './AppShell.css';

// BAM.ai Logo imports
import bamLogoGradient from '../assets/bam-icon-gradient.png';
import bamLogoWhite from '../assets/bam-icon-white.png';

const NAV_ITEMS = {
    bam_admin: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/content', icon: Video, label: 'Content Engine' },
        { path: '/provider', icon: Upload, label: 'Brain Training' },
        { path: '/consumer', icon: MessageSquare, label: 'BAM Brains' },
        { path: '/admin', icon: Building2, label: 'Admin & Clients' },
        { path: '/onboarding', icon: ClipboardList, label: 'Onboarding' },
        { path: '/settings', icon: Settings, label: 'Settings' }
    ],
    client_admin: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/content', icon: Video, label: 'Content Engine' },
        { path: '/provider', icon: Upload, label: 'Brain Training' },
        { path: '/consumer', icon: MessageSquare, label: 'BAM Brains' },
        { path: '/settings', icon: Settings, label: 'Settings' }
    ],
    knowledge_provider: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/provider', icon: Upload, label: 'Brain Training' },
        { path: '/settings', icon: Settings, label: 'Settings' }
    ],
    knowledge_consumer: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/consumer', icon: MessageSquare, label: 'Ask AI' },
        { path: '/settings', icon: Settings, label: 'Settings' }
    ]
};


function AppShell() {
    const { user, logout } = useAuth();
    const { isDemoMode, toggleDemoMode } = useDemoMode();
    const { selectedClient, clearClient, isClientSelected } = useClientContext();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [showShowcase, setShowShowcase] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(null); // { status: 'downloading', percent: 50 }
    const [adminMode, setAdminMode] = useState(() => {
        const stored = localStorage.getItem('bam_admin_mode');
        return stored !== 'false'; // Default to true (admin mode ON)
    });

    // Toggle admin mode and persist
    const toggleAdminMode = () => {
        const newValue = !adminMode;
        setAdminMode(newValue);
        localStorage.setItem('bam_admin_mode', newValue.toString());
    };

    // Listen for update progress from main process
    useEffect(() => {
        const handleUpdateStatus = (event, data) => {
            console.log('[UPDATE] Status:', data);
            if (data.status === 'downloading') {
                setUpdateProgress(data);
            } else {
                setUpdateProgress(null);
            }
        };

        if (window.electronAPI?.onUpdateStatus) {
            window.electronAPI.onUpdateStatus(handleUpdateStatus);
        }

        return () => {
            // Cleanup listener if needed
        };
    }, []);

    // Get nav items and filter based on admin mode
    const baseNavItems = NAV_ITEMS[user?.role] || NAV_ITEMS.knowledge_consumer;
    // When admin mode is OFF, hide Content Engine, Admin & Clients, and Onboarding
    const navItems = adminMode
        ? baseNavItems
        : baseNavItems.filter(item =>
            item.path !== '/content' &&
            item.path !== '/admin' &&
            item.path !== '/onboarding'
        );

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    const toggleMobileSidebar = () => {
        setMobileSidebarOpen(!mobileSidebarOpen);
    };

    const closeMobileSidebar = () => {
        setMobileSidebarOpen(false);
    };

    // Get current page title
    const getCurrentPageTitle = () => {
        const currentItem = navItems.find(item =>
            location.pathname.startsWith(item.path)
        );
        return currentItem?.label || 'BAM.ai';
    };

    return (
        <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isDemoMode ? 'demo-mode-active' : ''}`}>
            {/* Showcase Walkthrough */}
            {showShowcase && <Showcase onClose={() => setShowShowcase(false)} />}

            {/* Demo Mode Indicator Banner */}
            {isDemoMode && (
                <div className="demo-mode-banner">
                    <Sparkles size={16} />
                    <span>Demo Mode Active — Showing sample data</span>
                </div>
            )}

            {/* Update Download Progress Bar */}
            {updateProgress && updateProgress.status === 'downloading' && (
                <div className="update-progress-banner">
                    <span>⬇️ Downloading update: {updateProgress.percent}%</span>
                    <div className="update-progress-bar">
                        <div
                            className="update-progress-fill"
                            style={{ width: `${updateProgress.percent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Selected Client Context Banner - Only on Content Engine, Brain Training, BAM Brains, Settings */}
            {isClientSelected && (
                ['/content', '/provider', '/consumer', '/settings'].some(p => location.pathname.startsWith(p))
            ) && (
                    <div className="client-context-banner">
                        <Building2 size={16} />
                        <span>Viewing as: <strong>{selectedClient?.companyName || 'Unknown Client'}</strong></span>
                        <button
                            className="client-dismiss-btn"
                            onClick={clearClient}
                            title="Clear client selection"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

            {/* Mobile sidebar overlay */}
            <div
                className={`sidebar-overlay ${mobileSidebarOpen ? 'active' : ''}`}
                onClick={closeMobileSidebar}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <img
                            src={bamLogoGradient}
                            alt="BAM.ai"
                            className="logo-icon"
                        />
                        {!sidebarCollapsed && <span className="logo-text">BAM.ai</span>}
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm collapse-btn" onClick={toggleSidebar}>
                        {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''}`
                            }
                            title={sidebarCollapsed ? item.label : undefined}
                            onClick={closeMobileSidebar}
                        >
                            <item.icon size={20} className="nav-icon" />
                            {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    {!sidebarCollapsed && (
                        <div className="user-info-row">
                            <div className="user-avatar">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="user-details">
                                <span className="user-name">{user?.name}</span>
                                <span className="user-role">{user?.role?.replace('_', ' ')}</span>
                            </div>
                        </div>
                    )}
                    {/* Bottom row: Admin toggle moved to right side */}
                    <div className="sidebar-footer-row">
                        {!sidebarCollapsed && (
                            <label className="admin-mode-toggle" title="Admin Mode: Shows all features including unfinished ones">
                                <input
                                    type="checkbox"
                                    checked={adminMode}
                                    onChange={toggleAdminMode}
                                />
                                <span className="admin-mode-label">Admin</span>
                            </label>
                        )}
                        <button
                            className="btn btn-ghost btn-icon logout-btn"
                            onClick={handleLogout}
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="content-header">
                    <button
                        className="btn btn-ghost btn-icon mobile-menu-btn"
                        onClick={toggleMobileSidebar}
                    >
                        <Menu size={20} />
                    </button>
                    <h1 className="page-title">{getCurrentPageTitle()}</h1>
                    <div className="header-actions">
                        {/* Showcase Button */}
                        {(user?.role === 'bam_admin' || user?.role === 'client_admin') && (
                            <button
                                className="btn btn-sm showcase-btn"
                                onClick={() => setShowShowcase(true)}
                                title="Start Product Showcase"
                            >
                                <Presentation size={16} />
                                <span className="btn-text">Showcase</span>
                            </button>
                        )}

                        {/* Demo Mode Toggle */}
                        {(user?.role === 'bam_admin' || user?.role === 'client_admin') && (
                            <button
                                className={`btn btn-sm demo-mode-toggle ${isDemoMode ? 'active' : ''}`}
                                onClick={toggleDemoMode}
                                title={isDemoMode ? 'Exit Demo Mode' : 'Enter Demo Mode'}
                            >
                                {isDemoMode ? <Pause size={16} /> : <Play size={16} />}
                                <span className="btn-text">{isDemoMode ? 'Exit Demo' : 'Demo Mode'}</span>
                            </button>
                        )}
                    </div>
                </header>

                <div className="content-body">
                    {/* Onboarding is ALWAYS mounted to preserve audio recording state */}
                    {user?.role === 'bam_admin' && (
                        <div style={{ display: location.pathname.startsWith('/onboarding') ? 'block' : 'none' }}>
                            <Onboarding />
                        </div>
                    )}
                    {/* Other routes use Outlet, hidden when on Onboarding */}
                    <div style={{ display: location.pathname.startsWith('/onboarding') ? 'none' : 'block' }}>
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default AppShell;
