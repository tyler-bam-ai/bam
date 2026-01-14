/**
 * SocialMediaDashboard - Full Social Media Management Platform
 * 
 * Complete social operations platform:
 * - Smart Inbox (unified messages from all platforms)
 * - Publishing Calendar with scheduling
 * - Account management and connections
 * - Analytics and reporting
 * - Approval workflows
 */

import React, { useState, useEffect } from 'react';
import {
    Calendar,
    Clock,
    Plus,
    ChevronLeft,
    ChevronRight,
    Link2,
    Unlink,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    Settings,
    RefreshCw,
    Eye,
    Send,
    Inbox,
    MessageSquare,
    ThumbsUp,
    Heart,
    Share2,
    MoreHorizontal,
    Tag,
    Star,
    Archive,
    Trash2,
    Reply,
    Filter,
    Search,
    Users,
    TrendingUp,
    BarChart3,
    PieChart,
    ArrowUp,
    ArrowDown,
    ExternalLink,
    Edit3,
    Copy,
    Bookmark,
    Bell,
    Zap,
    Target,
    Hash,
    AtSign,
    Image,
    Video,
    FileText,
    Sparkles,
    Bot,
    Workflow,
    Edit2
} from 'lucide-react';
import { useDemoMode } from '../contexts/DemoModeContext';
import './SocialMediaDashboard.css';

// ============================================
// DEMO DATA
// ============================================

const DEMO_ACCOUNTS = [
    { id: 'acc-1', platform: 'instagram', username: '@yourbrand', displayName: 'Your Brand', followers: 15420, connected: true, status: 'active', avatar: null },
    { id: 'acc-2', platform: 'tiktok', username: '@yourbrand', displayName: 'Your Brand', followers: 32100, connected: true, status: 'active', avatar: null },
    { id: 'acc-3', platform: 'youtube', username: 'Your Brand Channel', displayName: 'Your Brand', subscribers: 8750, connected: true, status: 'active', avatar: null },
    { id: 'acc-4', platform: 'linkedin', username: 'Your Brand', displayName: 'Your Brand Inc', followers: 4200, connected: true, status: 'active', avatar: null },
    { id: 'acc-5', platform: 'twitter', username: '@yourbrand', displayName: 'Your Brand', followers: 12800, connected: false, status: 'disconnected', avatar: null },
    { id: 'acc-6', platform: 'facebook', username: 'Your Brand Page', displayName: 'Your Brand', followers: 28500, connected: true, status: 'active', avatar: null },
];

const DEMO_INBOX_MESSAGES = [
    {
        id: 'msg-1',
        platform: 'instagram',
        type: 'dm',
        from: { name: 'Sarah Johnson', handle: '@sarahjohnson', avatar: null },
        content: 'Hi! I saw your recent post about AI automation. Can you tell me more about how it works for small businesses?',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
        status: 'unread',
        tags: ['lead', 'sales'],
        sentiment: 'positive',
        thread: []
    },
    {
        id: 'msg-2',
        platform: 'twitter',
        type: 'mention',
        from: { name: 'TechStartup Weekly', handle: '@techstartup', avatar: null },
        content: '@yourbrand Just featured your company in our Top 10 AI Tools list! Great product 🚀',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
        status: 'unread',
        tags: ['pr', 'positive'],
        sentiment: 'positive',
        thread: []
    },
    {
        id: 'msg-3',
        platform: 'facebook',
        type: 'comment',
        from: { name: 'Mike Chen', handle: 'mikechen', avatar: null },
        content: 'This is exactly what I\'ve been looking for! How do I get started?',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
        status: 'read',
        tags: ['lead'],
        sentiment: 'positive',
        postRef: 'Product Demo Video',
        thread: []
    },
    {
        id: 'msg-4',
        platform: 'linkedin',
        type: 'dm',
        from: { name: 'Jennifer Williams', handle: 'jenniferwilliams', avatar: null },
        content: 'Hi team, I\'m the VP of Operations at Acme Corp. We\'re interested in scheduling a demo with your sales team. What times work next week?',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
        status: 'unread',
        tags: ['lead', 'enterprise', 'urgent'],
        sentiment: 'positive',
        thread: []
    },
    {
        id: 'msg-5',
        platform: 'instagram',
        type: 'comment',
        from: { name: 'Alex Rivera', handle: '@alexrivera', avatar: null },
        content: 'Is there a free trial available? Would love to test it out first.',
        timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), // 4 hours ago
        status: 'read',
        tags: ['support'],
        sentiment: 'neutral',
        postRef: 'Feature Announcement',
        thread: []
    },
    {
        id: 'msg-6',
        platform: 'tiktok',
        type: 'comment',
        from: { name: 'Productivity Pro', handle: '@productivitypro', avatar: null },
        content: 'This video is 🔥! Can you make a tutorial on the automation features?',
        timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(), // 5 hours ago
        status: 'read',
        tags: ['content-request'],
        sentiment: 'positive',
        thread: []
    },
];

const DEMO_SCHEDULED_POSTS = [
    {
        id: 'post-1',
        platforms: ['tiktok', 'instagram'],
        content: '🎯 Key Insight: The Future of AI - from our CEO Interview\n\n#AI #BusinessTech #FutureOfWork',
        mediaType: 'video',
        scheduledFor: getDateOffset(0, 14),
        status: 'scheduled',
        approvalStatus: 'approved',
        engagement: null
    },
    {
        id: 'post-2',
        platforms: ['instagram', 'facebook'],
        content: '✨ Customer Success Story\n\nSee how our clients are transforming their business with AI\n\n#CustomerSuccess #AITransformation',
        mediaType: 'video',
        scheduledFor: getDateOffset(1, 10),
        status: 'scheduled',
        approvalStatus: 'approved',
        engagement: null
    },
    {
        id: 'post-3',
        platforms: ['youtube'],
        content: '🎬 Product Feature Demo - See our AI in action!',
        mediaType: 'video',
        scheduledFor: getDateOffset(1, 16),
        status: 'scheduled',
        approvalStatus: 'pending',
        engagement: null
    },
    {
        id: 'post-4',
        platforms: ['linkedin'],
        content: '🚀 Behind the Scenes: Building our latest AI product\n\nOur team has been working hard on something special...',
        mediaType: 'video',
        scheduledFor: getDateOffset(2, 9),
        status: 'scheduled',
        approvalStatus: 'approved',
        engagement: null
    },
    {
        id: 'post-5',
        platforms: ['twitter', 'linkedin'],
        content: '💬 "The future of business is AI-powered knowledge management" - Our Founder\n\n#AI #StartupLife',
        mediaType: 'text',
        scheduledFor: getDateOffset(2, 15),
        status: 'scheduled',
        approvalStatus: 'approved',
        engagement: null
    },
];

const DEMO_ANALYTICS = {
    overview: {
        totalFollowers: 101770,
        followerGrowth: 2340,
        growthPercent: 2.4,
        totalEngagements: 45230,
        engagementRate: 4.2,
        totalReach: 523400,
        reachGrowth: 12.5
    },
    platforms: [
        { platform: 'tiktok', followers: 32100, growth: 8.2, engagementRate: 6.8, posts: 24 },
        { platform: 'facebook', followers: 28500, growth: 1.2, engagementRate: 2.1, posts: 18 },
        { platform: 'instagram', followers: 15420, growth: 3.5, engagementRate: 4.5, posts: 32 },
        { platform: 'twitter', followers: 12800, growth: 2.1, engagementRate: 3.2, posts: 45 },
        { platform: 'youtube', followers: 8750, growth: 5.4, engagementRate: 8.1, posts: 12 },
        { platform: 'linkedin', followers: 4200, growth: 4.8, engagementRate: 5.2, posts: 15 },
    ],
    topPosts: [
        { id: 'tp-1', content: 'AI Automation Demo', platform: 'tiktok', likes: 12400, comments: 890, shares: 2300 },
        { id: 'tp-2', content: 'Customer Success Story', platform: 'instagram', likes: 8900, comments: 456, shares: 1200 },
        { id: 'tp-3', content: 'Product Launch Announcement', platform: 'linkedin', likes: 5600, comments: 234, shares: 890 },
    ]
};

const DEMO_SAVED_REPLIES = [
    { id: 'sr-1', name: 'Demo Request', content: 'Thanks for your interest! You can book a demo at calendar.yourbrand.com. Looking forward to showing you what we can do! 🚀' },
    { id: 'sr-2', name: 'Free Trial', content: 'Great question! Yes, we offer a 14-day free trial. Head to yourbrand.com/trial to get started. No credit card required!' },
    { id: 'sr-3', name: 'Thank You', content: 'Thank you so much for the kind words! We really appreciate your support. 💜' },
    { id: 'sr-4', name: 'Support Redirect', content: 'For detailed support, please reach out to support@yourbrand.com or visit our help center at help.yourbrand.com' },
];

const AVAILABLE_TAGS = [
    { id: 'lead', name: 'Lead', color: '#22c55e' },
    { id: 'support', name: 'Support', color: '#3b82f6' },
    { id: 'sales', name: 'Sales', color: '#8b5cf6' },
    { id: 'urgent', name: 'Urgent', color: '#ef4444' },
    { id: 'pr', name: 'PR', color: '#f59e0b' },
    { id: 'enterprise', name: 'Enterprise', color: '#ec4899' },
    { id: 'positive', name: 'Positive', color: '#10b981' },
    { id: 'content-request', name: 'Content Request', color: '#06b6d4' },
];

function getDateOffset(days, hour) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
}

// Platform icons
const PlatformIcon = ({ platform, size = 20 }) => {
    const icons = {
        instagram: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
            </svg>
        ),
        facebook: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
        ),
        tiktok: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
        ),
        linkedin: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        ),
        twitter: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
        youtube: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
        )
    };
    return icons[platform] || <MessageSquare size={size} />;
};

const PLATFORM_COLORS = {
    instagram: '#E4405F',
    facebook: '#1877F2',
    tiktok: '#000000',
    linkedin: '#0A66C2',
    twitter: '#1DA1F2',
    youtube: '#FF0000'
};

// ============================================
// MAIN COMPONENT
// ============================================

function SocialMediaDashboard({ embedded = false }) {
    const { isDemoMode } = useDemoMode();

    // Navigation state
    const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'calendar' | 'analytics' | 'accounts'

    // Data state
    const [accounts, setAccounts] = useState([]);
    const [inboxMessages, setInboxMessages] = useState([]);
    const [scheduledPosts, setScheduledPosts] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [savedReplies, setSavedReplies] = useState([]);

    // UI state
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [inboxFilter, setInboxFilter] = useState('all'); // 'all' | 'unread' | 'dm' | 'comments' | 'mentions'
    const [inboxSearch, setInboxSearch] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showComposeModal, setShowComposeModal] = useState(false);

    // Load data - try API first, fallback to demo
    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            // Fetch accounts
            try {
                const accountsRes = await fetch('http://localhost:3001/api/social/accounts', { headers });
                if (accountsRes.ok) {
                    const data = await accountsRes.json();
                    setAccounts(data.accounts?.length > 0 ? data.accounts : (isDemoMode ? DEMO_ACCOUNTS : []));
                } else {
                    setAccounts(isDemoMode ? DEMO_ACCOUNTS : []);
                }
            } catch (e) {
                setAccounts(isDemoMode ? DEMO_ACCOUNTS : []);
            }

            // Fetch inbox messages
            try {
                const inboxRes = await fetch('http://localhost:3001/api/social/inbox', { headers });
                if (inboxRes.ok) {
                    const data = await inboxRes.json();
                    setInboxMessages(data.messages?.length > 0 ? data.messages : (isDemoMode ? DEMO_INBOX_MESSAGES : []));
                } else {
                    setInboxMessages(isDemoMode ? DEMO_INBOX_MESSAGES : []);
                }
            } catch (e) {
                setInboxMessages(isDemoMode ? DEMO_INBOX_MESSAGES : []);
            }

            // Fetch scheduled posts
            try {
                const postsRes = await fetch('http://localhost:3001/api/social/posts', { headers });
                if (postsRes.ok) {
                    const data = await postsRes.json();
                    setScheduledPosts(data.posts?.length > 0 ? data.posts : (isDemoMode ? DEMO_SCHEDULED_POSTS : []));
                } else {
                    setScheduledPosts(isDemoMode ? DEMO_SCHEDULED_POSTS : []);
                }
            } catch (e) {
                setScheduledPosts(isDemoMode ? DEMO_SCHEDULED_POSTS : []);
            }

            // Fetch analytics
            try {
                const analyticsRes = await fetch('http://localhost:3001/api/social/analytics', { headers });
                if (analyticsRes.ok) {
                    const data = await analyticsRes.json();
                    setAnalytics(data.analytics || (isDemoMode ? DEMO_ANALYTICS : null));
                } else {
                    setAnalytics(isDemoMode ? DEMO_ANALYTICS : null);
                }
            } catch (e) {
                setAnalytics(isDemoMode ? DEMO_ANALYTICS : null);
            }

            setSavedReplies(DEMO_SAVED_REPLIES); // Always use demo saved replies for now
        };

        fetchData();
    }, [isDemoMode]);

    // Filter inbox messages
    const filteredMessages = inboxMessages.filter(msg => {
        if (inboxFilter === 'unread' && msg.status !== 'unread') return false;
        if (inboxFilter === 'dm' && msg.type !== 'dm') return false;
        if (inboxFilter === 'comments' && msg.type !== 'comment') return false;
        if (inboxFilter === 'mentions' && msg.type !== 'mention') return false;
        if (inboxSearch && !msg.content.toLowerCase().includes(inboxSearch.toLowerCase()) &&
            !msg.from.name.toLowerCase().includes(inboxSearch.toLowerCase())) return false;
        return true;
    });

    const unreadCount = inboxMessages.filter(m => m.status === 'unread').length;

    return (
        <div className={`social-dashboard-v2 ${embedded ? 'embedded' : ''}`}>
            {/* Header - Hidden when embedded in Content Engine */}
            {!embedded && (
                <header className="sd-header">
                    <div className="sd-header-left">
                        <div className="sd-logo">
                            <Inbox size={28} />
                            <div>
                                <h1>Social Hub</h1>
                                <p>Unified Social Media Management</p>
                            </div>
                        </div>
                    </div>
                    <div className="sd-header-center">
                        <div className="sd-tabs">
                            <button
                                className={`sd-tab ${activeTab === 'inbox' ? 'active' : ''}`}
                                onClick={() => setActiveTab('inbox')}
                            >
                                <MessageSquare size={16} />
                                Smart Inbox
                                {unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
                            </button>
                            <button
                                className={`sd-tab ${activeTab === 'calendar' ? 'active' : ''}`}
                                onClick={() => setActiveTab('calendar')}
                            >
                                <Calendar size={16} />
                                Calendar
                            </button>
                            <button
                                className={`sd-tab ${activeTab === 'analytics' ? 'active' : ''}`}
                                onClick={() => setActiveTab('analytics')}
                            >
                                <BarChart3 size={16} />
                                Analytics
                            </button>
                            <button
                                className={`sd-tab ${activeTab === 'accounts' ? 'active' : ''}`}
                                onClick={() => setActiveTab('accounts')}
                            >
                                <Users size={16} />
                                Accounts
                            </button>
                        </div>
                    </div>
                    <div className="sd-header-right">
                        <button className="btn-compose" onClick={() => setShowComposeModal(true)}>
                            <Plus size={18} />
                            Compose
                        </button>
                    </div>
                </header>
            )}

            {/* Embedded Tab Bar - Shown when embedded in Content Engine */}
            {embedded && (
                <div className="sd-embedded-tabs">
                    <button
                        className={`sd-tab ${activeTab === 'inbox' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inbox')}
                    >
                        <MessageSquare size={16} />
                        Smart Inbox
                        {unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
                    </button>
                    <button
                        className={`sd-tab ${activeTab === 'calendar' ? 'active' : ''}`}
                        onClick={() => setActiveTab('calendar')}
                    >
                        <Calendar size={16} />
                        Calendar
                    </button>
                    <button
                        className={`sd-tab ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart3 size={16} />
                        Analytics
                    </button>
                    <button
                        className={`sd-tab ${activeTab === 'accounts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('accounts')}
                    >
                        <Users size={16} />
                        Accounts
                    </button>
                    <div className="tab-spacer"></div>
                    <button className="btn-compose-sm" onClick={() => setShowComposeModal(true)}>
                        <Plus size={16} />
                        Compose
                    </button>
                </div>
            )}

            <div className="sd-layout">
                {/* Main Content */}
                <main className="sd-main">
                    {activeTab === 'inbox' && (
                        <SmartInbox
                            messages={filteredMessages}
                            selectedMessage={selectedMessage}
                            onSelectMessage={setSelectedMessage}
                            filter={inboxFilter}
                            setFilter={setInboxFilter}
                            search={inboxSearch}
                            setSearch={setInboxSearch}
                            savedReplies={savedReplies}
                            onUpdateMessage={(id, updates) => {
                                setInboxMessages(prev => prev.map(m =>
                                    m.id === id ? { ...m, ...updates } : m
                                ));
                            }}
                        />
                    )}

                    {activeTab === 'calendar' && (
                        <PublishingCalendar
                            posts={scheduledPosts}
                            currentMonth={currentMonth}
                            setCurrentMonth={setCurrentMonth}
                            accounts={accounts}
                        />
                    )}

                    {activeTab === 'analytics' && (
                        <AnalyticsDashboard
                            analytics={analytics}
                        />
                    )}

                    {activeTab === 'accounts' && (
                        <AccountsManager
                            accounts={accounts}
                            onConnect={(platform) => console.log('Connect', platform)}
                            onDisconnect={(id) => console.log('Disconnect', id)}
                        />
                    )}
                </main>
            </div>

            {/* Compose Modal */}
            {showComposeModal && (
                <ComposeModal
                    accounts={accounts}
                    onClose={() => setShowComposeModal(false)}
                    onSchedule={(post) => {
                        setScheduledPosts(prev => [post, ...prev]);
                        setShowComposeModal(false);
                    }}
                />
            )}
        </div>
    );
}

// ============================================
// SMART INBOX COMPONENT
// ============================================

function SmartInbox({
    messages,
    selectedMessage,
    onSelectMessage,
    filter,
    setFilter,
    search,
    setSearch,
    savedReplies,
    onUpdateMessage
}) {
    const [replyText, setReplyText] = useState('');
    const [showSavedReplies, setShowSavedReplies] = useState(false);

    const handleSelectMessage = (msg) => {
        onSelectMessage(msg);
        if (msg.status === 'unread') {
            onUpdateMessage(msg.id, { status: 'read' });
        }
    };

    const handleSendReply = () => {
        if (!replyText.trim() || !selectedMessage) return;
        // In real implementation, this would send via API
        console.log('Sending reply:', replyText);
        setReplyText('');
    };

    const handleUseSavedReply = (reply) => {
        setReplyText(reply.content);
        setShowSavedReplies(false);
    };

    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = Math.floor((now - then) / 1000 / 60);
        if (diff < 60) return `${diff}m ago`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
        return `${Math.floor(diff / 1440)}d ago`;
    };

    return (
        <div className="smart-inbox">
            {/* Inbox Sidebar */}
            <div className="inbox-sidebar">
                {/* Toolbar */}
                <div className="inbox-toolbar">
                    <div className="search-box">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="inbox-filters">
                    {['all', 'unread', 'dm', 'comments', 'mentions'].map(f => (
                        <button
                            key={f}
                            className={`filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' && 'All'}
                            {f === 'unread' && 'Unread'}
                            {f === 'dm' && 'DMs'}
                            {f === 'comments' && 'Comments'}
                            {f === 'mentions' && 'Mentions'}
                        </button>
                    ))}
                </div>

                {/* Message List */}
                <div className="message-list">
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`message-item ${selectedMessage?.id === msg.id ? 'selected' : ''} ${msg.status}`}
                            onClick={() => handleSelectMessage(msg)}
                        >
                            <div className="message-avatar">
                                <div className="avatar-placeholder">
                                    {msg.from.name.charAt(0)}
                                </div>
                                <div
                                    className="platform-badge"
                                    style={{ backgroundColor: PLATFORM_COLORS[msg.platform] }}
                                >
                                    <PlatformIcon platform={msg.platform} size={10} />
                                </div>
                            </div>
                            <div className="message-content">
                                <div className="message-header">
                                    <span className="sender-name">{msg.from.name}</span>
                                    <span className="message-time">{formatTimeAgo(msg.timestamp)}</span>
                                </div>
                                <p className="message-preview">{msg.content}</p>
                                {msg.tags.length > 0 && (
                                    <div className="message-tags">
                                        {msg.tags.slice(0, 2).map(tagId => {
                                            const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                                            return tag ? (
                                                <span
                                                    key={tagId}
                                                    className="tag"
                                                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                                >
                                                    {tag.name}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                            {msg.status === 'unread' && <div className="unread-dot" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Message Detail */}
            <div className="message-detail">
                {selectedMessage ? (
                    <>
                        {/* Detail Header */}
                        <div className="detail-header">
                            <div className="sender-info">
                                <div className="avatar-large">
                                    {selectedMessage.from.name.charAt(0)}
                                </div>
                                <div>
                                    <h3>{selectedMessage.from.name}</h3>
                                    <span className="sender-handle">{selectedMessage.from.handle}</span>
                                </div>
                            </div>
                            <div className="detail-actions">
                                <button className="action-btn" title="Archive">
                                    <Archive size={18} />
                                </button>
                                <button className="action-btn" title="Tag">
                                    <Tag size={18} />
                                </button>
                                <button className="action-btn" title="Star">
                                    <Star size={18} />
                                </button>
                                <button className="action-btn danger" title="Delete">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Message Thread */}
                        <div className="message-thread">
                            <div className="thread-message">
                                <div className="thread-meta">
                                    <div
                                        className="platform-label"
                                        style={{ backgroundColor: PLATFORM_COLORS[selectedMessage.platform] }}
                                    >
                                        <PlatformIcon platform={selectedMessage.platform} size={12} />
                                        {selectedMessage.platform}
                                    </div>
                                    <span className="message-type">{selectedMessage.type}</span>
                                    <span className="thread-time">
                                        {new Date(selectedMessage.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                {selectedMessage.postRef && (
                                    <div className="post-reference">
                                        <FileText size={14} />
                                        Commenting on: {selectedMessage.postRef}
                                    </div>
                                )}
                                <p className="thread-content">{selectedMessage.content}</p>
                                <div className="thread-actions">
                                    <button className="thread-action">
                                        <ThumbsUp size={14} /> Like
                                    </button>
                                    <button className="thread-action">
                                        <Share2 size={14} /> Share
                                    </button>
                                    <button className="thread-action">
                                        <ExternalLink size={14} /> View Original
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Reply Box */}
                        <div className="reply-box">
                            <div className="reply-tools">
                                <button
                                    className={`tool-btn ${showSavedReplies ? 'active' : ''}`}
                                    onClick={() => setShowSavedReplies(!showSavedReplies)}
                                >
                                    <Bookmark size={16} />
                                    Saved Replies
                                </button>
                                <button className="tool-btn">
                                    <Sparkles size={16} />
                                    AI Suggest
                                </button>
                            </div>

                            {showSavedReplies && (
                                <div className="saved-replies-dropdown">
                                    {savedReplies.map(reply => (
                                        <button
                                            key={reply.id}
                                            className="saved-reply-item"
                                            onClick={() => handleUseSavedReply(reply)}
                                        >
                                            <span className="reply-name">{reply.name}</span>
                                            <span className="reply-preview">{reply.content.substring(0, 50)}...</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="reply-input-container">
                                <textarea
                                    placeholder="Type your reply..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    rows={3}
                                />
                                <div className="reply-actions">
                                    <div className="reply-meta">
                                        Replying via {selectedMessage.platform}
                                    </div>
                                    <button
                                        className="btn-send"
                                        onClick={handleSendReply}
                                        disabled={!replyText.trim()}
                                    >
                                        <Send size={16} />
                                        Send Reply
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="no-selection">
                        <Inbox size={48} />
                        <h3>Select a message</h3>
                        <p>Choose a message from the inbox to view and reply</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// PUBLISHING CALENDAR COMPONENT
// ============================================

function PublishingCalendar({ posts, currentMonth, setCurrentMonth, accounts }) {
    const [selectedPost, setSelectedPost] = useState(null);

    const navigateMonth = (direction) => {
        setCurrentMonth(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + direction);
            return newDate;
        });
    };

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const days = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Day headers
        dayNames.forEach(day => {
            days.push(
                <div key={`header-${day}`} className="calendar-day-header">
                    {day}
                </div>
            );
        });

        // Empty cells
        for (let i = 0; i < startingDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayPosts = posts.filter(post => {
                const postDate = new Date(post.scheduledFor);
                return postDate.toDateString() === new Date(year, month, day).toDateString();
            });
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            days.push(
                <div
                    key={`day-${day}`}
                    className={`calendar-day ${isToday ? 'today' : ''} ${dayPosts.length > 0 ? 'has-posts' : ''}`}
                >
                    <span className="day-number">{day}</span>
                    {dayPosts.length > 0 && (
                        <div className="day-posts">
                            {dayPosts.slice(0, 3).map((post, i) => (
                                <div
                                    key={i}
                                    className="calendar-post clickable"
                                    onClick={() => setSelectedPost(post)}
                                    title={post.content.substring(0, 50)}
                                >
                                    <div className="post-platforms">
                                        {post.platforms.slice(0, 2).map(p => (
                                            <span
                                                key={p}
                                                className="platform-dot"
                                                style={{ backgroundColor: PLATFORM_COLORS[p] }}
                                            />
                                        ))}
                                    </div>
                                    <span className="post-time">
                                        {new Date(post.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="post-preview">
                                        {post.content.substring(0, 15)}...
                                    </span>
                                </div>
                            ))}
                            {dayPosts.length > 3 && (
                                <span className="more-posts">+{dayPosts.length - 3} more</span>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        return days;
    };

    return (
        <div className="publishing-calendar">
            {/* Calendar Header */}
            <div className="calendar-header">
                <div className="calendar-nav">
                    <button onClick={() => navigateMonth(-1)}>
                        <ChevronLeft size={20} />
                    </button>
                    <h2>
                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={() => navigateMonth(1)}>
                        <ChevronRight size={20} />
                    </button>
                </div>
                <div className="calendar-actions">
                    <button className="btn-today" onClick={() => setCurrentMonth(new Date())}>
                        Today
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="calendar-grid">
                {renderCalendar()}
            </div>

            {/* Upcoming Posts */}
            <div className="upcoming-posts">
                <h3>Upcoming Posts</h3>
                <div className="posts-list">
                    {posts.slice(0, 5).map(post => (
                        <div
                            key={post.id}
                            className="upcoming-post-card clickable"
                            onClick={() => setSelectedPost(post)}
                        >
                            <div className="post-platforms">
                                {post.platforms.map(p => (
                                    <span
                                        key={p}
                                        className="platform-icon"
                                        style={{ color: PLATFORM_COLORS[p] }}
                                    >
                                        <PlatformIcon platform={p} size={16} />
                                    </span>
                                ))}
                            </div>
                            <div className="post-content">
                                <p>{post.content.substring(0, 80)}...</p>
                                <span className="post-schedule">
                                    <Clock size={12} />
                                    {new Date(post.scheduledFor).toLocaleString()}
                                </span>
                            </div>
                            <div className={`approval-badge ${post.approvalStatus}`}>
                                {post.approvalStatus === 'approved' && <CheckCircle size={14} />}
                                {post.approvalStatus === 'pending' && <Clock size={14} />}
                                {post.approvalStatus}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Post Detail Modal */}
            {selectedPost && (
                <div className="modal-overlay" onClick={() => setSelectedPost(null)}>
                    <div className="post-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Scheduled Post</h2>
                            <button className="btn-close" onClick={() => setSelectedPost(null)}>
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="post-detail-content">
                            {/* Platforms */}
                            <div className="detail-section">
                                <label>Platforms</label>
                                <div className="platform-chips">
                                    {selectedPost.platforms.map(p => (
                                        <span
                                            key={p}
                                            className="platform-chip"
                                            style={{ backgroundColor: PLATFORM_COLORS[p] }}
                                        >
                                            <PlatformIcon platform={p} size={14} />
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Schedule */}
                            <div className="detail-section">
                                <label>Scheduled For</label>
                                <p className="schedule-time">
                                    <Calendar size={16} />
                                    {new Date(selectedPost.scheduledFor).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                    <Clock size={16} />
                                    {new Date(selectedPost.scheduledFor).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>

                            {/* Status */}
                            <div className="detail-section">
                                <label>Status</label>
                                <div className="status-row">
                                    <span className={`status-badge ${selectedPost.status}`}>
                                        {selectedPost.status}
                                    </span>
                                    <span className={`approval-badge ${selectedPost.approvalStatus}`}>
                                        {selectedPost.approvalStatus === 'approved' && <CheckCircle size={14} />}
                                        {selectedPost.approvalStatus === 'pending' && <Clock size={14} />}
                                        {selectedPost.approvalStatus}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="detail-section">
                                <label>Content</label>
                                <div className="post-full-content">
                                    {selectedPost.content}
                                </div>
                            </div>

                            {/* Media Type */}
                            <div className="detail-section">
                                <label>Media Type</label>
                                <p className="media-type">
                                    {selectedPost.mediaType === 'video' && <Video size={16} />}
                                    {selectedPost.mediaType === 'image' && <Image size={16} />}
                                    {selectedPost.mediaType === 'text' && <FileText size={16} />}
                                    {selectedPost.mediaType}
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedPost(null)}>
                                Close
                            </button>
                            <button className="btn btn-primary">
                                <Edit2 size={16} />
                                Edit Post
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// ANALYTICS DASHBOARD COMPONENT
// ============================================

function AnalyticsDashboard({ analytics }) {
    const [selectedPlatform, setSelectedPlatform] = useState(null);

    // Demo posts per platform with virality scores
    const platformPosts = {
        instagram: [
            { id: 'ig-1', content: 'Behind the scenes of our latest shoot 📸', likes: 2340, comments: 89, shares: 156, viralityScore: 8.7, date: '2 days ago', aiSynopsis: 'High engagement due to authentic behind-the-scenes content. Users love transparency and human elements.' },
            { id: 'ig-2', content: 'New product reveal coming soon! 👀', likes: 1890, comments: 234, shares: 67, viralityScore: 7.2, date: '5 days ago', aiSynopsis: 'Teaser content creates anticipation. Comment count suggests high curiosity from audience.' },
            { id: 'ig-3', content: 'Customer spotlight: @happycustomer', likes: 1230, comments: 45, shares: 89, viralityScore: 6.1, date: '1 week ago', aiSynopsis: 'User-generated content performs well. Consider featuring more customers.' },
        ],
        tiktok: [
            { id: 'tt-1', content: '🔥 This trick will change your workflow!', likes: 45200, comments: 1230, shares: 8900, viralityScore: 9.4, date: '3 days ago', aiSynopsis: 'Educational content with hook performs extremely well on TikTok. The high share count indicates viral potential.' },
            { id: 'tt-2', content: 'Day in the life at our startup', likes: 12400, comments: 456, shares: 2100, viralityScore: 7.8, date: '6 days ago', aiSynopsis: 'Authentic day-in-life content resonates with younger audience seeking career inspiration.' },
        ],
        linkedin: [
            { id: 'li-1', content: 'Lessons from scaling to 1M users', likes: 5600, comments: 234, shares: 890, viralityScore: 9.1, date: '1 day ago', aiSynopsis: 'Thought leadership content with specific numbers drives high engagement on LinkedIn.' },
            { id: 'li-2', content: 'We are hiring! Join our team', likes: 2340, comments: 67, shares: 345, viralityScore: 6.5, date: '4 days ago', aiSynopsis: 'Job posts perform moderately. Consider adding employee testimonials for better reach.' },
        ],
        twitter: [
            { id: 'tw-1', content: 'The future of AI is here. Thread 🧵', likes: 3400, comments: 189, shares: 567, viralityScore: 8.3, date: '12 hours ago', aiSynopsis: 'Thread format drives engagement. Topic timing aligned with trending conversations.' },
        ],
        facebook: [
            { id: 'fb-1', content: 'Announcing our community event!', likes: 890, comments: 123, shares: 234, viralityScore: 7.0, date: '2 days ago', aiSynopsis: 'Local community content performs well. Event posts drive in-person engagement.' },
        ],
    };

    const getViralityColor = (score) => {
        if (score >= 9) return '#22c55e';
        if (score >= 7) return '#3b82f6';
        if (score >= 5) return '#eab308';
        return '#ef4444';
    };

    if (!analytics) {
        return (
            <div className="analytics-empty">
                <BarChart3 size={48} />
                <h3>No analytics data</h3>
                <p>Connect your social accounts to see analytics</p>
            </div>
        );
    }

    return (
        <div className="analytics-dashboard">
            {/* Overview Cards */}
            <div className="analytics-overview">
                <div className="stat-card">
                    <div className="stat-icon followers">
                        <Users size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total Followers</span>
                        <span className="stat-value">{analytics.overview.totalFollowers.toLocaleString()}</span>
                        <span className="stat-change positive">
                            <ArrowUp size={14} />
                            +{analytics.overview.followerGrowth.toLocaleString()} ({analytics.overview.growthPercent}%)
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon engagements">
                        <Heart size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total Engagements</span>
                        <span className="stat-value">{analytics.overview.totalEngagements.toLocaleString()}</span>
                        <span className="stat-change positive">
                            {analytics.overview.engagementRate}% rate
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon reach">
                        <Eye size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total Reach</span>
                        <span className="stat-value">{analytics.overview.totalReach.toLocaleString()}</span>
                        <span className="stat-change positive">
                            <ArrowUp size={14} />
                            +{analytics.overview.reachGrowth}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Platform Breakdown - Clickable */}
            <div className="analytics-section">
                <h3>Platform Performance <span className="hint">(click to view posts)</span></h3>
                <div className="platform-table">
                    <div className="table-header">
                        <span>Platform</span>
                        <span>Followers</span>
                        <span>Growth</span>
                        <span>Engagement</span>
                        <span>Posts</span>
                    </div>
                    {analytics.platforms.map(platform => (
                        <div
                            key={platform.platform}
                            className={`table-row clickable ${selectedPlatform === platform.platform ? 'selected' : ''}`}
                            onClick={() => setSelectedPlatform(selectedPlatform === platform.platform ? null : platform.platform)}
                        >
                            <div className="platform-cell">
                                <span
                                    className="platform-icon"
                                    style={{ color: PLATFORM_COLORS[platform.platform] }}
                                >
                                    <PlatformIcon platform={platform.platform} size={18} />
                                </span>
                                <span className="platform-name">{platform.platform}</span>
                            </div>
                            <span>{platform.followers.toLocaleString()}</span>
                            <span className={`growth ${platform.growth > 0 ? 'positive' : 'negative'}`}>
                                {platform.growth > 0 ? '+' : ''}{platform.growth}%
                            </span>
                            <span>{platform.engagementRate}%</span>
                            <span>{platform.posts}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Platform Posts Detail View */}
            {selectedPlatform && platformPosts[selectedPlatform] && (
                <div className="analytics-section platform-detail">
                    <div className="section-header">
                        <h3>
                            <PlatformIcon platform={selectedPlatform} size={20} />
                            {selectedPlatform} Posts Performance
                        </h3>
                        <button className="btn-close-section" onClick={() => setSelectedPlatform(null)}>
                            <XCircle size={20} />
                        </button>
                    </div>
                    <div className="posts-detail-list">
                        {platformPosts[selectedPlatform].map(post => (
                            <div key={post.id} className="post-detail-card">
                                <div className="post-detail-header">
                                    <span className="post-date">{post.date}</span>
                                    <div
                                        className="virality-badge"
                                        style={{ backgroundColor: getViralityColor(post.viralityScore) }}
                                    >
                                        <TrendingUp size={14} />
                                        {post.viralityScore}/10
                                    </div>
                                </div>
                                <p className="post-detail-content">{post.content}</p>
                                <div className="post-metrics">
                                    <div className="metric">
                                        <Heart size={16} />
                                        <span>{post.likes.toLocaleString()}</span>
                                    </div>
                                    <div className="metric">
                                        <MessageSquare size={16} />
                                        <span>{post.comments.toLocaleString()}</span>
                                    </div>
                                    <div className="metric">
                                        <Share2 size={16} />
                                        <span>{post.shares.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="ai-synopsis">
                                    <Sparkles size={14} />
                                    <span>{post.aiSynopsis}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Posts - Enhanced with AI Synopsis */}
            <div className="analytics-section">
                <h3>🏆 Top Performing Posts</h3>
                <div className="top-posts-carousel">
                    {analytics.topPosts.map((post, index) => (
                        <div key={post.id} className={`top-post-card featured ${index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze'}`}>
                            <div className="post-rank">{index + 1}</div>
                            <div className="post-header">
                                <span
                                    className="platform-badge"
                                    style={{ backgroundColor: PLATFORM_COLORS[post.platform] }}
                                >
                                    <PlatformIcon platform={post.platform} size={12} />
                                </span>
                                <span className="post-title">{post.content}</span>
                            </div>
                            <div className="post-stats">
                                <div className="stat">
                                    <Heart size={14} />
                                    <span>{post.likes.toLocaleString()}</span>
                                </div>
                                <div className="stat">
                                    <MessageSquare size={14} />
                                    <span>{post.comments.toLocaleString()}</span>
                                </div>
                                <div className="stat">
                                    <Share2 size={14} />
                                    <span>{post.shares.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="ai-synopsis">
                                <Sparkles size={14} />
                                <span>
                                    {index === 0 && 'Exceptional timing and emotional resonance drove viral engagement.'}
                                    {index === 1 && 'Strong visual content with clear call-to-action performed well.'}
                                    {index === 2 && 'Thought leadership content resonated with professional audience.'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ============================================
// ACCOUNTS MANAGER COMPONENT
// ============================================

function AccountsManager({ accounts, onConnect, onDisconnect }) {
    const connectedAccounts = accounts.filter(a => a.connected);
    const availablePlatforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'youtube'];

    return (
        <div className="accounts-manager">
            {/* Connected Accounts */}
            <div className="accounts-section">
                <h3>Connected Accounts</h3>
                <div className="accounts-grid">
                    {connectedAccounts.map(account => (
                        <div key={account.id} className="account-card connected">
                            <div
                                className="account-platform"
                                style={{ backgroundColor: PLATFORM_COLORS[account.platform] }}
                            >
                                <PlatformIcon platform={account.platform} size={24} />
                            </div>
                            <div className="account-info">
                                <h4>{account.displayName}</h4>
                                <span className="account-handle">{account.username}</span>
                                <span className="account-followers">
                                    {account.followers?.toLocaleString() || account.subscribers?.toLocaleString()} followers
                                </span>
                            </div>
                            <div className="account-status">
                                <span className="status-badge active">
                                    <CheckCircle size={14} />
                                    Connected
                                </span>
                                <button
                                    className="btn-disconnect"
                                    onClick={() => onDisconnect(account.id)}
                                >
                                    <Unlink size={14} />
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add New Account */}
            <div className="accounts-section">
                <h3>Add New Account</h3>
                <div className="platforms-grid">
                    {availablePlatforms.map(platform => {
                        const isConnected = accounts.some(a => a.platform === platform && a.connected);
                        return (
                            <button
                                key={platform}
                                className={`platform-connect-btn ${isConnected ? 'connected' : ''}`}
                                onClick={() => !isConnected && onConnect(platform)}
                                disabled={isConnected}
                            >
                                <div
                                    className="platform-icon-wrapper"
                                    style={{ backgroundColor: `${PLATFORM_COLORS[platform]}20`, color: PLATFORM_COLORS[platform] }}
                                >
                                    <PlatformIcon platform={platform} size={24} />
                                </div>
                                <span className="platform-name">{platform}</span>
                                {isConnected ? (
                                    <CheckCircle size={16} className="connected-icon" />
                                ) : (
                                    <Plus size={16} className="connect-icon" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ============================================
// COMPOSE MODAL COMPONENT
// ============================================

function ComposeModal({ accounts, onClose, onSchedule }) {
    const [content, setContent] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState([]);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');

    const togglePlatform = (platform) => {
        setSelectedPlatforms(prev =>
            prev.includes(platform)
                ? prev.filter(p => p !== platform)
                : [...prev, platform]
        );
    };

    const handleSchedule = () => {
        if (!content.trim() || selectedPlatforms.length === 0) return;

        const scheduledFor = scheduleDate && scheduleTime
            ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
            : new Date().toISOString();

        onSchedule({
            id: `post-${Date.now()}`,
            platforms: selectedPlatforms,
            content,
            mediaType: 'text',
            scheduledFor,
            status: 'scheduled',
            approvalStatus: 'pending'
        });
    };

    const connectedAccounts = accounts.filter(a => a.connected);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="compose-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create Post</h2>
                    <button className="btn-close" onClick={onClose}>
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="compose-content">
                    {/* Platform Selection */}
                    <div className="platform-selector">
                        <label>Post to:</label>
                        <div className="platform-options">
                            {connectedAccounts.map(account => (
                                <button
                                    key={account.id}
                                    className={`platform-option ${selectedPlatforms.includes(account.platform) ? 'selected' : ''}`}
                                    onClick={() => togglePlatform(account.platform)}
                                >
                                    <span style={{ color: PLATFORM_COLORS[account.platform] }}>
                                        <PlatformIcon platform={account.platform} size={18} />
                                    </span>
                                    {account.platform}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Editor */}
                    <div className="content-editor">
                        <textarea
                            placeholder="What do you want to share?"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                        />
                        <div className="editor-tools">
                            <button className="tool-btn">
                                <Image size={18} />
                            </button>
                            <button className="tool-btn">
                                <Video size={18} />
                            </button>
                            <button className="tool-btn">
                                <Hash size={18} />
                            </button>
                            <button className="tool-btn">
                                <AtSign size={18} />
                            </button>
                            <button className="tool-btn">
                                <Sparkles size={18} />
                                AI Write
                            </button>
                        </div>
                        <div className="char-count">{content.length} characters</div>
                    </div>

                    {/* Schedule */}
                    <div className="schedule-section">
                        <label>Schedule for:</label>
                        <div className="schedule-inputs">
                            <input
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                            />
                            <input
                                type="time"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                            />
                        </div>
                        <button className="optimal-time-btn">
                            <Zap size={14} />
                            Suggest optimal time
                        </button>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSchedule}
                        disabled={!content.trim() || selectedPlatforms.length === 0}
                    >
                        <Calendar size={16} />
                        Schedule Post
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SocialMediaDashboard;
