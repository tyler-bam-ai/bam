import React, { createContext, useContext, useState, useCallback } from 'react';

// Demo Mode Context for BAM.ai
// Provides global toggle for showcase/demo mode with realistic mock data

const DemoModeContext = createContext(null);

// ============== MOCK DATA GENERATORS ==============

const MOCK_CLIENTS = [
    {
        id: 'demo-client-1',
        companyName: 'Evergreen Wellness Spa',
        contactName: 'Sarah Mitchell',
        contactEmail: 'sarah@evergreenwellness.com',
        industry: 'Healthcare',
        plan: 'professional',
        seats: 8,
        status: 'active',
        createdAt: '2024-11-15T10:00:00Z',
        completionScore: 92,
        brains: { operations: true, employee: true, branding: true }
    },
    {
        id: 'demo-client-2',
        companyName: 'Summit Construction Co.',
        contactName: 'Mike Rodriguez',
        contactEmail: 'mike@summitconstruction.com',
        industry: 'Construction',
        plan: 'enterprise',
        seats: 25,
        status: 'active',
        createdAt: '2024-10-22T14:30:00Z',
        completionScore: 88,
        brains: { operations: true, employee: true, branding: true }
    },
    {
        id: 'demo-client-3',
        companyName: 'Bright Dental Group',
        contactName: 'Dr. Jennifer Park',
        contactEmail: 'jpark@brightdental.com',
        industry: 'Healthcare',
        plan: 'professional',
        seats: 12,
        status: 'active',
        createdAt: '2024-12-01T09:15:00Z',
        completionScore: 95,
        brains: { operations: true, employee: true, branding: true }
    },
    {
        id: 'demo-client-4',
        companyName: 'Apex Marketing Agency',
        contactName: 'David Chen',
        contactEmail: 'david@apexmarketing.io',
        industry: 'Professional Services',
        plan: 'starter',
        seats: 5,
        status: 'onboarding',
        createdAt: '2024-12-20T11:00:00Z',
        completionScore: 45,
        brains: { operations: false, employee: false, branding: false }
    }
];

const MOCK_SOCIAL_ACCOUNTS = [
    { id: 'demo-social-1', platform: 'instagram', accountHandle: '@evergreenwellness', accountName: 'Evergreen Wellness', status: 'active', postCount: 47 },
    { id: 'demo-social-2', platform: 'facebook', accountHandle: 'EverGreenWellnessSpa', accountName: 'Evergreen Wellness Spa', status: 'active', postCount: 52 },
    { id: 'demo-social-3', platform: 'tiktok', accountHandle: '@evergreenvibes', accountName: 'Evergreen Vibes', status: 'active', postCount: 23 },
    { id: 'demo-social-4', platform: 'linkedin', accountHandle: 'evergreen-wellness-spa', accountName: 'Evergreen Wellness Spa', status: 'active', postCount: 18 },
    { id: 'demo-social-5', platform: 'youtube', accountHandle: '@EverGreenWellness', accountName: 'Evergreen Wellness', status: 'active', postCount: 8 }
];

const MOCK_CAMPAIGNS = [
    {
        id: 'demo-campaign-1',
        name: 'Valentine\'s Wellness 2025',
        description: 'Promoting self-care packages for Valentine\'s season',
        status: 'active',
        targetPlatforms: ['instagram', 'facebook', 'tiktok'],
        color: '#ec4899',
        videoCount: 3,
        clipCount: 12,
        startDate: '2025-01-20',
        endDate: '2025-02-14',
        createdAt: '2024-12-15T10:00:00Z'
    },
    {
        id: 'demo-campaign-2',
        name: 'New Year Transformation',
        description: 'January wellness resolutions campaign',
        status: 'completed',
        targetPlatforms: ['instagram', 'youtube'],
        color: '#8b5cf6',
        videoCount: 2,
        clipCount: 8,
        startDate: '2024-12-26',
        endDate: '2025-01-15',
        createdAt: '2024-12-10T14:00:00Z'
    },
    {
        id: 'demo-campaign-3',
        name: 'Weekly Tips',
        description: 'Ongoing wellness tips and advice',
        status: 'active',
        targetPlatforms: ['instagram', 'tiktok', 'linkedin'],
        color: '#10b981',
        videoCount: 8,
        clipCount: 32,
        startDate: '2024-11-01',
        endDate: '2025-12-31',
        createdAt: '2024-10-28T09:00:00Z'
    }
];

const MOCK_CLIPS = [
    { id: 'demo-clip-1', videoId: 'demo-video-1', viralityScore: 0.94, status: 'approved', suggestedCaption: '🔥 The secret to glowing skin starts with these 3 steps...', duration: 28 },
    { id: 'demo-clip-2', videoId: 'demo-video-1', viralityScore: 0.89, status: 'approved', suggestedCaption: '💆‍♀️ Self-care Sunday starts NOW', duration: 45 },
    { id: 'demo-clip-3', videoId: 'demo-video-2', viralityScore: 0.91, status: 'approved', suggestedCaption: '✨ Transform your morning routine in 60 seconds', duration: 58 },
    { id: 'demo-clip-4', videoId: 'demo-video-2', viralityScore: 0.87, status: 'pending_review', suggestedCaption: 'Your wellness journey starts with one decision...', duration: 35 },
    { id: 'demo-clip-5', videoId: 'demo-video-3', viralityScore: 0.92, status: 'approved', suggestedCaption: '🧘 5 minutes to inner peace', duration: 42 }
];

const MOCK_SCHEDULED_POSTS = generateScheduledPosts();

function generateScheduledPosts() {
    const posts = [];
    const now = new Date();
    const captions = [
        '🌸 Valentine\'s special: Couples massage + aromatherapy 💕',
        '✨ New year, new glow! Book your facial today',
        '💆‍♀️ Self-care tip: Start your morning with 5 minutes of meditation',
        '🔥 Limited spots left for our detox package!',
        '🧘 Wellness Wednesday: Why hydration matters more than you think',
        '💫 Transform your stress into serenity',
        '❤️ Treat yourself this Valentine\'s - you deserve it!',
        '🌿 Natural beauty starts from within'
    ];
    const platforms = ['instagram', 'facebook', 'tiktok'];

    for (let i = 0; i < 15; i++) {
        const postDate = new Date(now);
        postDate.setDate(postDate.getDate() + Math.floor(i / 2));
        postDate.setHours(i % 2 === 0 ? 10 : 18, 0, 0, 0);

        posts.push({
            id: `demo-post-${i + 1}`,
            clipId: MOCK_CLIPS[i % MOCK_CLIPS.length].id,
            campaignId: i < 8 ? 'demo-campaign-1' : 'demo-campaign-3',
            platform: platforms[i % platforms.length],
            caption: captions[i % captions.length],
            scheduledAt: postDate.toISOString(),
            status: i < 3 ? 'published' : 'scheduled'
        });
    }
    return posts;
}

const MOCK_DASHBOARD_METRICS = {
    hoursSaved: 42.5,
    hoursSavedDelta: 12.3,
    questionsAnswered: 1247,
    questionsAnsweredDelta: 156,
    callsRecovered: 89,
    callsRecoveredPercent: 89,
    estimatedValue: 12500,
    estimatedValueDelta: 2300,
    weeklyActivity: [
        { day: 'Mon', questions: 45, content: 3 },
        { day: 'Tue', questions: 62, content: 2 },
        { day: 'Wed', questions: 58, content: 4 },
        { day: 'Thu', questions: 71, content: 2 },
        { day: 'Fri', questions: 55, content: 3 },
        { day: 'Sat', questions: 23, content: 1 },
        { day: 'Sun', questions: 18, content: 0 }
    ],
    topQuestions: [
        { question: 'What are your business hours?', count: 47 },
        { question: 'How do I book an appointment?', count: 38 },
        { question: 'What services do you offer?', count: 31 },
        { question: 'What is your cancellation policy?', count: 24 },
        { question: 'Do you offer gift cards?', count: 19 }
    ],
    contentPerformance: [
        { title: 'Valentine\'s Self-Care Post', views: 2400, engagement: 8.5 },
        { title: 'Morning Routine Tips', views: 1800, engagement: 7.2 },
        { title: 'Wednesday Wellness', views: 1200, engagement: 6.8 }
    ]
};

const MOCK_KNOWLEDGE_DOCS = [
    { id: 'demo-doc-1', filename: 'Employee Handbook 2024.pdf', type: 'policy', uploadedAt: '2024-11-01T10:00:00Z', pages: 45 },
    { id: 'demo-doc-2', filename: 'Service Menu & Pricing.pdf', type: 'sales', uploadedAt: '2024-11-05T14:30:00Z', pages: 12 },
    { id: 'demo-doc-3', filename: 'FAQ Responses.docx', type: 'customer_service', uploadedAt: '2024-11-10T09:00:00Z', pages: 8 },
    { id: 'demo-doc-4', filename: 'Brand Guidelines.pdf', type: 'branding', uploadedAt: '2024-11-15T11:00:00Z', pages: 24 },
    { id: 'demo-doc-5', filename: 'Onboarding Interview Recording.mp3', type: 'recording', uploadedAt: '2024-11-20T15:00:00Z', duration: '47:32' }
];

const MOCK_CHAT_MESSAGES = [
    { role: 'user', content: 'What is our refund policy for spa packages?' },
    { role: 'assistant', content: '[FACT] Based on your Employee Handbook, your refund policy states: "Full refunds are available up to 24 hours before the scheduled appointment. Cancellations within 24 hours receive 50% credit toward future services. No-shows forfeit the full amount." This applies to all spa packages and gift certificates.', confidence: 'HIGH', sources: ['Employee Handbook 2024.pdf'] },
    { role: 'user', content: 'How should I handle a customer complaint about a facial treatment?' },
    { role: 'assistant', content: '[FACT] According to your customer service protocols:\n\n1. **Listen actively** and acknowledge their concern\n2. **Apologize** for their experience (without admitting fault)\n3. **Offer solutions**: complimentary redo, partial refund, or product samples\n4. **Document** the incident in the client notes\n5. **Follow up** within 48 hours\n\nFor treatments that caused skin reactions, always recommend they consult their dermatologist and offer a full refund.', confidence: 'HIGH', sources: ['FAQ Responses.docx', 'Employee Handbook 2024.pdf'] }
];

// ============== CONTEXT PROVIDER ==============

export function DemoModeProvider({ children }) {
    const [isDemoMode, setIsDemoMode] = useState(false);

    const toggleDemoMode = useCallback(() => {
        setIsDemoMode(prev => !prev);
    }, []);

    const getMockData = useCallback((dataType) => {
        if (!isDemoMode) return null;

        switch (dataType) {
            case 'clients':
                return MOCK_CLIENTS;
            case 'socialAccounts':
                return MOCK_SOCIAL_ACCOUNTS;
            case 'campaigns':
                return MOCK_CAMPAIGNS;
            case 'clips':
                return MOCK_CLIPS;
            case 'scheduledPosts':
                return MOCK_SCHEDULED_POSTS;
            case 'dashboardMetrics':
                return MOCK_DASHBOARD_METRICS;
            case 'knowledgeDocs':
                return MOCK_KNOWLEDGE_DOCS;
            case 'chatMessages':
                return MOCK_CHAT_MESSAGES;
            default:
                return null;
        }
    }, [isDemoMode]);

    const value = {
        isDemoMode,
        toggleDemoMode,
        getMockData,
        mockClients: isDemoMode ? MOCK_CLIENTS : [],
        mockSocialAccounts: isDemoMode ? MOCK_SOCIAL_ACCOUNTS : [],
        mockCampaigns: isDemoMode ? MOCK_CAMPAIGNS : [],
        mockClips: isDemoMode ? MOCK_CLIPS : [],
        mockScheduledPosts: isDemoMode ? MOCK_SCHEDULED_POSTS : [],
        mockDashboardMetrics: isDemoMode ? MOCK_DASHBOARD_METRICS : null,
        mockKnowledgeDocs: isDemoMode ? MOCK_KNOWLEDGE_DOCS : [],
        mockChatMessages: isDemoMode ? MOCK_CHAT_MESSAGES : []
    };

    return (
        <DemoModeContext.Provider value={value}>
            {children}
        </DemoModeContext.Provider>
    );
}

export function useDemoMode() {
    const context = useContext(DemoModeContext);
    if (!context) {
        throw new Error('useDemoMode must be used within a DemoModeProvider');
    }
    return context;
}

export default DemoModeContext;
