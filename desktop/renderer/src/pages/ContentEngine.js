/**
 * ContentEngine - AI Video Clipping Platform
 * 
 * Full-featured video repurposing workflow:
 * - Import videos (YouTube URL or upload)
 * - AI-powered clip detection with virality scoring
 * - Edit clips (timeline, transcript, reframe)
 * - Add captions with styling
 * - Export and schedule to social
 * 
 * Now includes Social Media Management (merged per Chris feedback)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Upload,
    Video,
    Scissors,
    Calendar,
    CheckCircle,
    XCircle,
    Play,
    Pause,
    Star,
    Clock,
    Folder,
    Plus,
    Loader2,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    FileVideo,
    Trash2,
    Share2,
    Edit3,
    RefreshCw,
    Sparkles,
    Download,
    Copy,
    ExternalLink,
    Type,
    Music,
    Volume2,
    Maximize,
    Grid,
    List,
    Filter,
    Search,
    MoreVertical,
    ThumbsUp,
    ThumbsDown,
    RotateCcw,
    Wand2,
    Layers,
    Image,
    MessageSquare,
    Zap,
    TrendingUp,
    Eye,
    Send,
    Inbox,
    BarChart3,
    Users
} from 'lucide-react';
import { useDemoMode } from '../contexts/DemoModeContext';
import SocialMediaDashboard from './SocialMediaDashboard';
import * as contentApi from '../api/contentApi';
import './ContentEngine.css';


// ============================================
// DEMO DATA - AI-Generated Clips
// ============================================

const DEMO_PROJECTS = [
    {
        id: 'proj-1',
        name: 'Q4 Marketing Campaign',
        videoCount: 3,
        clipCount: 12,
        status: 'active',
        createdAt: '2024-01-15',
        thumbnail: null
    },
    {
        id: 'proj-2',
        name: 'Product Launch Series',
        videoCount: 5,
        clipCount: 24,
        status: 'active',
        createdAt: '2024-01-10',
        thumbnail: null
    },
    {
        id: 'proj-3',
        name: 'Customer Testimonials',
        videoCount: 8,
        clipCount: 32,
        status: 'completed',
        createdAt: '2024-01-05',
        thumbnail: null
    },
];

const DEMO_SOURCE_VIDEOS = [
    {
        id: 'vid-1',
        title: 'CEO Interview - Company Vision 2024',
        duration: 1475, // 24:35
        status: 'processed',
        clipCount: 8,
        uploadedAt: '2024-01-15T10:30:00Z',
        source: 'upload',
        thumbnail: null
    },
    {
        id: 'vid-2',
        title: 'Product Demo Walkthrough',
        duration: 1102, // 18:22
        status: 'processed',
        clipCount: 6,
        uploadedAt: '2024-01-14T14:20:00Z',
        source: 'youtube',
        youtubeUrl: 'https://youtube.com/watch?v=example',
        thumbnail: null
    },
    {
        id: 'vid-3',
        title: 'Team Culture Day Highlights',
        duration: 2710, // 45:10
        status: 'processing',
        clipCount: 0,
        progress: 67,
        uploadedAt: '2024-01-16T09:15:00Z',
        source: 'upload',
        thumbnail: null
    },
];

const DEMO_CLIPS = [
    {
        id: 'clip-1',
        videoId: 'vid-1',
        title: 'Key Insight: The Future of AI in Business',
        description: 'CEO shares powerful vision for how AI will transform business operations in the next 5 years.',
        startTime: 135, // 2:15
        endTime: 165, // 2:45
        duration: 30,
        viralityScore: 94,
        status: 'approved',
        aspectRatio: '9:16',
        captionStyle: 'animated',
        transcript: "The future of business is not about replacing humans with AI. It's about augmenting human capabilities. When we look at the next five years, the companies that succeed will be those that find the perfect balance between artificial intelligence and human intuition.",
        aiTitle: '🚀 The Future is AI + Human, Not AI vs Human',
        aiDescription: 'Our CEO breaks down why the winning formula is augmentation, not replacement. #AI #FutureOfWork #Leadership',
        thumbnail: null
    },
    {
        id: 'clip-2',
        videoId: 'vid-1',
        title: 'Customer Success Story: 10x Productivity',
        description: 'Real example of how one client achieved 10x productivity gains.',
        startTime: 510, // 8:30
        endTime: 555, // 9:15
        duration: 45,
        viralityScore: 87,
        status: 'pending',
        aspectRatio: '9:16',
        captionStyle: 'minimal',
        transcript: "Let me tell you about Acme Corp. They came to us struggling with customer support tickets. Within 30 days of implementing our AI assistant, they went from handling 100 tickets a day to over 1,000. That's not a typo. 10x improvement in just one month.",
        aiTitle: '📈 From 100 to 1,000 Tickets Per Day',
        aiDescription: 'How Acme Corp achieved 10x productivity with AI-powered support. Real results, real impact. #CustomerSuccess #AI',
        thumbnail: null
    },
    {
        id: 'clip-3',
        videoId: 'vid-1',
        title: 'Product Feature Demo: Smart Automation',
        description: 'Quick walkthrough of the automation features.',
        startTime: 720, // 12:00
        endTime: 750, // 12:30
        duration: 30,
        viralityScore: 82,
        status: 'approved',
        aspectRatio: '1:1',
        captionStyle: 'bold',
        transcript: "Watch this. I'm going to set up a complete automation workflow in under 30 seconds. Step one, select the trigger. Step two, choose the action. Step three, test and deploy. That's it. What used to take developers weeks now takes anyone minutes.",
        aiTitle: '⚡ Build Automations in 30 Seconds',
        aiDescription: 'No code required. Watch us build a complete workflow in real-time. #NoCode #Automation #ProductDemo',
        thumbnail: null
    },
    {
        id: 'clip-4',
        videoId: 'vid-1',
        title: 'Behind the Scenes: Our Engineering Culture',
        description: 'Peek into how our engineering team operates.',
        startTime: 945, // 15:45
        endTime: 990, // 16:30
        duration: 45,
        viralityScore: 78,
        status: 'pending',
        aspectRatio: '9:16',
        captionStyle: 'animated',
        transcript: "People ask me what makes our engineering team different. It's simple: we ship fast and we ship often. We deploy to production multiple times a day. Every engineer has the autonomy to make decisions. No bureaucracy, no red tape, just building great products.",
        aiTitle: '🛠️ How We Ship Multiple Times Per Day',
        aiDescription: 'Inside look at our engineering culture. Autonomy, speed, and constant iteration. #Engineering #StartupLife',
        thumbnail: null
    },
    {
        id: 'clip-5',
        videoId: 'vid-1',
        title: 'Founder Quote: Why We Started This',
        description: 'Emotional founding story moment.',
        startTime: 1210, // 20:10
        endTime: 1235, // 20:35
        duration: 25,
        viralityScore: 91,
        status: 'approved',
        aspectRatio: '9:16',
        captionStyle: 'typewriter',
        transcript: "I started this company because I was frustrated. Frustrated watching talented people waste hours on repetitive tasks. Frustrated seeing businesses fail because they couldn't keep up. I knew there had to be a better way. And now, we're building it.",
        aiTitle: '💡 The Frustration That Started It All',
        aiDescription: 'Every great company starts with a problem. Here\'s ours. #FounderStory #Startup #Motivation',
        thumbnail: null
    },
    {
        id: 'clip-6',
        videoId: 'vid-1',
        title: 'Call to Action: Join the Revolution',
        description: 'Strong closing CTA from the interview.',
        startTime: 1430, // 23:50
        endTime: 1460, // 24:20
        duration: 30,
        viralityScore: 85,
        status: 'scheduled',
        scheduledFor: '2024-01-20T14:00:00Z',
        aspectRatio: '9:16',
        captionStyle: 'animated',
        transcript: "If you're still doing things the old way, you're already behind. The tools exist today to transform how you work. The question is: are you going to adapt, or are you going to get left behind? The choice is yours. But I know which one I'd pick.",
        aiTitle: '🔥 Adapt or Get Left Behind',
        aiDescription: 'The future is here. Are you ready? Book a demo and see for yourself. #Transformation #AI',
        thumbnail: null
    },
    {
        id: 'clip-7',
        videoId: 'vid-2',
        title: 'Quick Tip: Keyboard Shortcuts',
        description: 'Power user tip from the product demo.',
        startTime: 180, // 3:00
        endTime: 210, // 3:30
        duration: 30,
        viralityScore: 72,
        status: 'pending',
        aspectRatio: '16:9',
        captionStyle: 'minimal',
        transcript: "Here's a pro tip that'll save you hours. Press Cmd+K to open the command palette. From there, you can do anything without touching your mouse. Navigate, create, edit, delete. It's all right there.",
        aiTitle: '⌨️ The One Shortcut That Changes Everything',
        aiDescription: 'Cmd+K is your new best friend. Here\'s why power users swear by it. #ProductivityTips #Shortcuts',
        thumbnail: null
    },
    {
        id: 'clip-8',
        videoId: 'vid-2',
        title: 'Integration Demo: Connect Everything',
        description: 'Showing off integration capabilities.',
        startTime: 420, // 7:00
        endTime: 465, // 7:45
        duration: 45,
        viralityScore: 79,
        status: 'approved',
        aspectRatio: '9:16',
        captionStyle: 'bold',
        transcript: "We integrate with everything. Slack, Salesforce, HubSpot, Notion, you name it. And setting it up is literally three clicks. Watch: select the integration, authorize, done. Your data now flows automatically between all your tools.",
        aiTitle: '🔗 3 Clicks to Connect Your Entire Stack',
        aiDescription: 'Slack, Salesforce, HubSpot, Notion and more. See how easy integration really is. #SaaS #Integrations',
        thumbnail: null
    },
];

const CAPTION_STYLES = [
    { id: 'animated', name: 'Animated', description: 'Word-by-word highlight animation', preview: '🎬' },
    { id: 'bold', name: 'Bold Impact', description: 'Large, bold text with emphasis', preview: '💪' },
    { id: 'minimal', name: 'Minimal', description: 'Clean, subtle captions', preview: '✨' },
    { id: 'typewriter', name: 'Typewriter', description: 'Character-by-character reveal', preview: '⌨️' },
    { id: 'karaoke', name: 'Karaoke', description: 'Lyrics-style highlighting', preview: '🎤' },
    { id: 'news', name: 'News Ticker', description: 'Professional news-style lower third', preview: '📺' },
];

const ASPECT_RATIOS = [
    { id: '9:16', name: 'Vertical', description: 'TikTok, Reels, Shorts', icon: '📱', width: 9, height: 16 },
    { id: '16:9', name: 'Landscape', description: 'YouTube, LinkedIn', icon: '🖥️', width: 16, height: 9 },
    { id: '1:1', name: 'Square', description: 'Instagram Feed', icon: '📷', width: 1, height: 1 },
    { id: '4:5', name: 'Portrait', description: 'Instagram Portrait', icon: '📱', width: 4, height: 5 },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getViralityColor = (score) => {
    if (score >= 90) return '#22c55e';
    if (score >= 80) return '#84cc16';
    if (score >= 70) return '#eab308';
    if (score >= 60) return '#f97316';
    return '#ef4444';
};

const getViralityLabel = (score) => {
    if (score >= 90) return 'Highly Viral';
    if (score >= 80) return 'Strong Potential';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Moderate';
    return 'Low';
};

// ============================================
// MAIN COMPONENT
// ============================================

function ContentEngine() {
    const { isDemoMode } = useDemoMode();

    // Zone state - Creation Zone vs Social Media (merged per Chris feedback)
    const [activeZone, setActiveZone] = useState('creation'); // 'creation' | 'social'

    // Navigation state (for creation zone)
    const [activeTab, setActiveTab] = useState('clips'); // 'clips' | 'editor' | 'publish'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

    // Data state
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [sourceVideos, setSourceVideos] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [clips, setClips] = useState([]);
    const [selectedClip, setSelectedClip] = useState(null);

    // UI state
    const [showImportModal, setShowImportModal] = useState(false);
    const [showNewProject, setShowNewProject] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('virality'); // 'virality' | 'duration' | 'created'

    // Import state
    const [importType, setImportType] = useState('upload'); // 'upload' | 'youtube'
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    // Loading and error states
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [processingStatus, setProcessingStatus] = useState(''); // For showing transcription/analysis status

    const fileInputRef = useRef(null);

    // Load data - demo or real API
    useEffect(() => {
        if (isDemoMode) {
            // Demo mode: use hardcoded demo data
            setProjects(DEMO_PROJECTS);
            setSelectedProject(DEMO_PROJECTS[0]);
            setSourceVideos(DEMO_SOURCE_VIDEOS);
            setSelectedVideo(DEMO_SOURCE_VIDEOS[0]);
            setClips(DEMO_CLIPS.filter(c => c.videoId === 'vid-1'));
        } else {
            // Real mode: fetch from API
            loadRealData();
        }
    }, [isDemoMode]);

    // Load real data from API
    const loadRealData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Load campaigns as "projects"
            const campaignsData = await contentApi.getCampaigns();
            setProjects(campaignsData.map(c => ({
                id: c.id,
                name: c.name,
                videoCount: c.videoCount || 0,
                clipCount: c.clipCount || 0,
                status: c.status,
                createdAt: c.createdAt
            })));

            // Load videos
            const videosData = await contentApi.getVideos();
            setSourceVideos(videosData.map(v => ({
                id: v.id,
                title: v.title,
                duration: v.duration || 0,
                status: v.status,
                clipCount: v.clipCount || 0,
                uploadedAt: v.createdAt,
                source: v.source,
                youtubeUrl: v.sourceUrl,
                thumbnail: v.thumbnailPath
            })));

            // If we have videos, select the first one and load its clips
            if (videosData.length > 0) {
                const firstVideo = videosData[0];
                setSelectedVideo({
                    id: firstVideo.id,
                    title: firstVideo.title,
                    duration: firstVideo.duration || 0,
                    status: firstVideo.status,
                    clipCount: firstVideo.clipCount || 0,
                    uploadedAt: firstVideo.createdAt,
                    source: firstVideo.source,
                    youtubeUrl: firstVideo.sourceUrl
                });
                await loadClipsForVideo(firstVideo.id);
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Load clips for a specific video
    const loadClipsForVideo = async (videoId) => {
        try {
            const clipsData = await contentApi.getClips(videoId);
            setClips(clipsData.map(c => ({
                id: c.id,
                videoId: c.videoId,
                title: c.title || c.aiTitle || 'Untitled Clip',
                description: c.description || c.aiDescription || '',
                startTime: c.startTime,
                endTime: c.endTime,
                duration: c.duration,
                viralityScore: c.viralityScore,
                viralityBreakdown: c.scores,
                status: c.status,
                aspectRatio: c.aspectRatio || '9:16',
                transcript: c.transcript,
                aiTitle: c.aiTitle,
                aiDescription: c.aiDescription,
                captionStyle: c.captionStyle || 'animated'
            })));
        } catch (err) {
            console.error('Failed to load clips:', err);
        }
    };

    // Filter and sort clips
    const filteredClips = clips
        .filter(clip => {
            if (filterStatus !== 'all' && clip.status !== filterStatus) return false;
            if (searchTerm && !clip.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'virality') return b.viralityScore - a.viralityScore;
            if (sortBy === 'duration') return b.duration - a.duration;
            return 0;
        });

    // Handle video selection
    const handleVideoSelect = async (video) => {
        setSelectedVideo(video);
        setSelectedClip(null);

        if (isDemoMode) {
            setClips(DEMO_CLIPS.filter(c => c.videoId === video.id));
        } else {
            await loadClipsForVideo(video.id);
        }
    };

    // Handle clip actions (approve/reject)
    const handleClipAction = async (clipId, action) => {
        // Update optimistically
        setClips(prev => prev.map(clip =>
            clip.id === clipId ? { ...clip, status: action } : clip
        ));

        // Call API if not in demo mode
        if (!isDemoMode) {
            try {
                await contentApi.updateClip(clipId, { status: action });
            } catch (err) {
                console.error('Failed to update clip:', err);
                // Revert on error
                await loadClipsForVideo(selectedVideo?.id);
            }
        }
    };

    // Handle regenerate clips
    const handleRegenerateClips = async () => {
        if (!selectedVideo || isDemoMode) return;

        setIsProcessing(true);
        setProcessingStatus('Regenerating clips with AI...');
        try {
            await contentApi.regenerateClips(selectedVideo.id);
            await loadClipsForVideo(selectedVideo.id);
        } catch (err) {
            console.error('Failed to regenerate clips:', err);
            setError(err.message);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    // Handle YouTube import
    const handleYoutubeImport = async () => {
        if (!youtubeUrl.trim()) return;

        setIsProcessing(true);
        setProcessingStatus('Importing from YouTube...');

        try {
            if (isDemoMode) {
                // Demo mode: simulate
                await new Promise(resolve => setTimeout(resolve, 2000));
                const newVideo = {
                    id: `vid-${Date.now()}`,
                    title: 'Imported YouTube Video',
                    duration: 1800,
                    status: 'processing',
                    clipCount: 0,
                    progress: 0,
                    uploadedAt: new Date().toISOString(),
                    source: 'youtube',
                    youtubeUrl: youtubeUrl,
                    thumbnail: null
                };
                setSourceVideos(prev => [newVideo, ...prev]);
            } else {
                // Real mode: call API
                const result = await contentApi.importYouTube(youtubeUrl, selectedProject?.id);

                // Add to list with pending status
                const newVideo = {
                    id: result.videoId,
                    title: 'Downloading...',
                    duration: 0,
                    status: 'downloading',
                    clipCount: 0,
                    uploadedAt: new Date().toISOString(),
                    source: 'youtube',
                    youtubeUrl: youtubeUrl
                };
                setSourceVideos(prev => [newVideo, ...prev]);

                // Poll for status updates
                setProcessingStatus('Downloading video...');
                pollVideoAndProcess(result.videoId);
            }

            setShowImportModal(false);
            setYoutubeUrl('');
        } catch (err) {
            console.error('YouTube import failed:', err);
            setError(err.message);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    // Poll video status and trigger transcription/analysis
    const pollVideoAndProcess = async (videoId) => {
        try {
            // Wait for download/processing
            setProcessingStatus('Processing video...');
            await contentApi.pollVideoStatus(videoId, ['ready', 'processed'], 2000, 300000, (status) => {
                setSourceVideos(prev => prev.map(v =>
                    v.id === videoId ? { ...v, status } : v
                ));
            });

            // Transcribe
            setProcessingStatus('Transcribing with AI...');
            await contentApi.transcribeVideo(videoId);
            await contentApi.pollVideoStatus(videoId, ['transcribed'], 2000, 300000);

            // Analyze for clips
            setProcessingStatus('Detecting viral clips...');
            await contentApi.analyzeVideo(videoId);
            await contentApi.pollVideoStatus(videoId, ['analyzed'], 2000, 300000);

            // Refresh video list
            await loadRealData();
            setProcessingStatus('');

        } catch (err) {
            console.error('Video processing failed:', err);
            setError(err.message);
            setProcessingStatus('');
        }
    };

    // Handle file upload
    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setUploadProgress(0);

        try {
            if (isDemoMode) {
                // Demo mode: simulate upload
                const interval = setInterval(() => {
                    setUploadProgress(prev => {
                        if (prev >= 100) {
                            clearInterval(interval);
                            return 100;
                        }
                        return prev + 10;
                    });
                }, 200);

                await new Promise(resolve => setTimeout(resolve, 2500));

                const newVideo = {
                    id: `vid-${Date.now()}`,
                    title: file.name.replace(/\.[^/.]+$/, ''),
                    duration: 600 + Math.random() * 1200,
                    status: 'processing',
                    clipCount: 0,
                    progress: 0,
                    uploadedAt: new Date().toISOString(),
                    source: 'upload',
                    thumbnail: null
                };
                setSourceVideos(prev => [newVideo, ...prev]);
            } else {
                // Real mode: upload via API
                console.log('[ContentEngine] Starting video upload...');
                setProcessingStatus('Uploading video...');
                const result = await contentApi.uploadVideo(
                    file,
                    selectedProject?.id,
                    (percent) => setUploadProgress(percent)
                );

                console.log('[ContentEngine] Upload complete:', result);

                // Reload videos from API to ensure we have the latest data
                const videosData = await contentApi.getVideos();
                setSourceVideos(videosData.map(v => ({
                    id: v.id,
                    title: v.title,
                    duration: v.duration || 0,
                    status: v.status,
                    clipCount: v.clipCount || 0,
                    uploadedAt: v.createdAt,
                    source: v.source,
                    youtubeUrl: v.sourceUrl,
                    thumbnail: v.thumbnailPath
                })));

                // Select the newly uploaded video
                const uploadedVideo = videosData.find(v => v.id === result.video.id);
                if (uploadedVideo) {
                    setSelectedVideo({
                        id: uploadedVideo.id,
                        title: uploadedVideo.title,
                        duration: uploadedVideo.duration || 0,
                        status: uploadedVideo.status,
                        clipCount: uploadedVideo.clipCount || 0,
                        uploadedAt: uploadedVideo.createdAt,
                        source: uploadedVideo.source
                    });
                }

                // Start processing pipeline
                setProcessingStatus('Processing video...');
                pollVideoAndProcess(result.video.id);
            }

            setShowImportModal(false);
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.message);
        } finally {
            setIsProcessing(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="content-engine-v2">
            {/* Header */}
            <header className="ce-header">
                <div className="ce-header-left">
                    <div className="ce-logo">
                        <Scissors size={28} />
                        <div>
                            <h1>Content Engine</h1>
                            <p>Create & Distribute</p>
                        </div>
                    </div>
                    {/* Zone Toggle */}
                    <div className="ce-zone-toggle">
                        <button
                            className={`zone-btn ${activeZone === 'creation' ? 'active' : ''}`}
                            onClick={() => setActiveZone('creation')}
                        >
                            <Sparkles size={16} />
                            Creation Zone
                        </button>
                        <button
                            className={`zone-btn ${activeZone === 'social' ? 'active' : ''}`}
                            onClick={() => setActiveZone('social')}
                        >
                            <Inbox size={16} />
                            Social Media
                        </button>
                    </div>
                </div>
                <div className="ce-header-center">
                    {activeZone === 'creation' && (
                        <div className="ce-tabs">
                            <button
                                className={`ce-tab ${activeTab === 'clips' ? 'active' : ''}`}
                                onClick={() => setActiveTab('clips')}
                            >
                                <Sparkles size={16} />
                                AI Clips
                            </button>
                            <button
                                className={`ce-tab ${activeTab === 'editor' ? 'active' : ''}`}
                                onClick={() => setActiveTab('editor')}
                                disabled={!selectedClip}
                            >
                                <Edit3 size={16} />
                                Editor
                            </button>
                            <button
                                className={`ce-tab ${activeTab === 'publish' ? 'active' : ''}`}
                                onClick={() => setActiveTab('publish')}
                            >
                                <Send size={16} />
                                Publish
                            </button>
                        </div>
                    )}
                </div>
                <div className="ce-header-right">
                    {activeZone === 'creation' && (
                        <button className="btn-import" onClick={() => setShowImportModal(true)}>
                            <Plus size={18} />
                            Import Video
                        </button>
                    )}
                </div>
            </header>

            {/* Conditional Zone Rendering */}
            {activeZone === 'social' ? (
                <SocialMediaDashboard embedded={true} />
            ) : (
                <div className="ce-layout">
                    {/* Left Sidebar - Projects & Videos */}
                    <aside className="ce-sidebar">
                        {/* Projects Section */}
                        <div className="sidebar-section">
                            <div className="section-header">
                                <h3><Folder size={16} /> Projects</h3>
                                <button className="btn-icon-sm" onClick={() => setShowNewProject(true)}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="project-list">
                                {projects.map(project => (
                                    <div
                                        key={project.id}
                                        className={`project-item ${selectedProject?.id === project.id ? 'active' : ''}`}
                                        onClick={() => setSelectedProject(project)}
                                    >
                                        <div className="project-icon">
                                            <Folder size={16} />
                                        </div>
                                        <div className="project-info">
                                            <span className="project-name">{project.name}</span>
                                            <span className="project-meta">{project.clipCount} clips</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Source Videos Section */}
                        <div className="sidebar-section videos-section">
                            <div className="section-header">
                                <h3><Video size={16} /> Source Videos</h3>
                            </div>
                            <div className="video-list">
                                {sourceVideos.map(video => (
                                    <div
                                        key={video.id}
                                        className={`video-item ${selectedVideo?.id === video.id ? 'active' : ''}`}
                                        onClick={() => handleVideoSelect(video)}
                                    >
                                        <div className="video-thumbnail">
                                            <Video size={20} />
                                            {video.status === 'processing' && (
                                                <div className="processing-badge">
                                                    <Loader2 size={12} className="spin" />
                                                    {video.progress}%
                                                </div>
                                            )}
                                        </div>
                                        <div className="video-info">
                                            <span className="video-title">{video.title}</span>
                                            <div className="video-meta">
                                                <span><Clock size={12} /> {formatDuration(video.duration)}</span>
                                                {video.status === 'processed' && (
                                                    <span><Scissors size={12} /> {video.clipCount} clips</span>
                                                )}
                                            </div>
                                        </div>
                                        {video.source === 'youtube' && (
                                            <div className="source-badge youtube">YT</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="ce-main">
                        {activeTab === 'clips' && (
                            <ClipsView
                                clips={filteredClips}
                                selectedClip={selectedClip}
                                onSelectClip={setSelectedClip}
                                onClipAction={handleClipAction}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                filterStatus={filterStatus}
                                setFilterStatus={setFilterStatus}
                                sortBy={sortBy}
                                setSortBy={setSortBy}
                                onEditClip={() => setActiveTab('editor')}
                                selectedVideo={selectedVideo}
                            />
                        )}

                        {activeTab === 'editor' && selectedClip && (
                            <ClipEditor
                                clip={selectedClip}
                                onUpdateClip={(updates) => {
                                    setClips(prev => prev.map(c =>
                                        c.id === selectedClip.id ? { ...c, ...updates } : c
                                    ));
                                    setSelectedClip(prev => ({ ...prev, ...updates }));
                                }}
                                onBack={() => setActiveTab('clips')}
                            />
                        )}

                        {activeTab === 'publish' && (
                            <PublishView
                                clips={clips.filter(c => c.status === 'approved')}
                            />
                        )}
                    </main>

                    {/* Right Sidebar - Clip Details */}
                    {activeTab === 'clips' && selectedClip && (
                        <aside className="ce-details">
                            <ClipDetails
                                clip={selectedClip}
                                onAction={handleClipAction}
                                onEdit={() => setActiveTab('editor')}
                            />
                        </aside>
                    )}
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <ImportModal
                    onClose={() => setShowImportModal(false)}
                    importType={importType}
                    setImportType={setImportType}
                    youtubeUrl={youtubeUrl}
                    setYoutubeUrl={setYoutubeUrl}
                    onYoutubeImport={handleYoutubeImport}
                    onFileUpload={handleFileUpload}
                    fileInputRef={fileInputRef}
                    isProcessing={isProcessing}
                    uploadProgress={uploadProgress}
                />
            )}
        </div>
    );
}

// ============================================
// CLIPS VIEW COMPONENT
// ============================================

function ClipsView({
    clips,
    selectedClip,
    onSelectClip,
    onClipAction,
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
    onEditClip,
    selectedVideo
}) {
    return (
        <div className="clips-view">
            {/* Toolbar */}
            <div className="clips-toolbar">
                <div className="toolbar-left">
                    <div className="search-box">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search clips..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="filter-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending Review</option>
                        <option value="approved">Approved</option>
                        <option value="scheduled">Scheduled</option>
                    </select>
                    <select
                        className="filter-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="virality">Sort by Virality</option>
                        <option value="duration">Sort by Duration</option>
                    </select>
                </div>
                <div className="toolbar-right">
                    <span className="clip-count">{clips.length} clips</span>
                    <div className="view-toggle">
                        <button
                            className={viewMode === 'grid' ? 'active' : ''}
                            onClick={() => setViewMode('grid')}
                        >
                            <Grid size={16} />
                        </button>
                        <button
                            className={viewMode === 'list' ? 'active' : ''}
                            onClick={() => setViewMode('list')}
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Video Info Banner */}
            {selectedVideo && (
                <div className="video-info-banner">
                    <div className="banner-left">
                        <Video size={20} />
                        <div>
                            <h3>{selectedVideo.title}</h3>
                            <span>{formatDuration(selectedVideo.duration)} • {clips.length} AI-generated clips</span>
                        </div>
                    </div>
                    <button className="btn-regenerate">
                        <RefreshCw size={14} />
                        Regenerate Clips
                    </button>
                </div>
            )}

            {/* Clips Grid/List */}
            {clips.length > 0 ? (
                <div className={`clips-container ${viewMode}`}>
                    {clips.map(clip => (
                        <ClipCard
                            key={clip.id}
                            clip={clip}
                            isSelected={selectedClip?.id === clip.id}
                            onClick={() => onSelectClip(clip)}
                            onAction={onClipAction}
                            onEdit={onEditClip}
                            viewMode={viewMode}
                        />
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <Scissors size={48} />
                    <h3>No clips yet</h3>
                    <p>Import a video to automatically generate AI-powered clips</p>
                </div>
            )}
        </div>
    );
}

// ============================================
// CLIP CARD COMPONENT
// ============================================

function ClipCard({ clip, isSelected, onClick, onAction, onEdit, viewMode }) {
    const viralityColor = getViralityColor(clip.viralityScore);

    return (
        <div
            className={`clip-card ${viewMode} ${isSelected ? 'selected' : ''} status-${clip.status}`}
            onClick={onClick}
        >
            {/* Thumbnail */}
            <div className="clip-thumbnail">
                <div className="thumbnail-placeholder">
                    <Play size={24} />
                </div>
                <div className="clip-duration">{formatDuration(clip.duration)}</div>
                <div className="clip-aspect">{clip.aspectRatio}</div>
            </div>

            {/* Info */}
            <div className="clip-info">
                <div className="clip-header">
                    <h4>{clip.title}</h4>
                    <div
                        className="virality-badge"
                        style={{ backgroundColor: `${viralityColor}20`, color: viralityColor }}
                    >
                        <TrendingUp size={12} />
                        {clip.viralityScore}
                    </div>
                </div>

                {viewMode === 'list' && (
                    <p className="clip-description">{clip.description}</p>
                )}

                <div className="clip-meta">
                    <span className="clip-time">
                        {formatTimestamp(clip.startTime)} - {formatTimestamp(clip.endTime)}
                    </span>
                    <span className={`clip-status ${clip.status}`}>
                        {clip.status === 'approved' && <CheckCircle size={12} />}
                        {clip.status === 'pending' && <Clock size={12} />}
                        {clip.status === 'scheduled' && <Calendar size={12} />}
                        {clip.status}
                    </span>
                </div>

                {viewMode === 'list' && (
                    <div className="clip-actions">
                        <button className="btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                            <Edit3 size={14} /> Edit
                        </button>
                        {clip.status === 'pending' && (
                            <>
                                <button
                                    className="btn-sm success"
                                    onClick={(e) => { e.stopPropagation(); onAction(clip.id, 'approved'); }}
                                >
                                    <ThumbsUp size={14} /> Approve
                                </button>
                                <button
                                    className="btn-sm danger"
                                    onClick={(e) => { e.stopPropagation(); onAction(clip.id, 'rejected'); }}
                                >
                                    <ThumbsDown size={14} />
                                </button>
                            </>
                        )}
                        <button className="btn-sm">
                            <Download size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// CLIP DETAILS PANEL
// ============================================

function ClipDetails({ clip, onAction, onEdit }) {
    const viralityColor = getViralityColor(clip.viralityScore);

    return (
        <div className="clip-details-panel">
            <div className="details-header">
                <h3>Clip Details</h3>
                <button className="btn-close" onClick={() => { }}>
                    <XCircle size={16} />
                </button>
            </div>

            {/* Preview */}
            <div className="details-preview">
                <div className="preview-placeholder">
                    <Play size={32} />
                </div>
            </div>

            {/* Virality Score */}
            <div className="virality-section">
                <div className="virality-header">
                    <span>Virality Score</span>
                    <span className="virality-label" style={{ color: viralityColor }}>
                        {getViralityLabel(clip.viralityScore)}
                    </span>
                </div>
                <div className="virality-bar">
                    <div
                        className="virality-fill"
                        style={{
                            width: `${clip.viralityScore}%`,
                            backgroundColor: viralityColor
                        }}
                    />
                </div>
                <span className="virality-score" style={{ color: viralityColor }}>
                    {clip.viralityScore}/100
                </span>
            </div>

            {/* AI Generated Content */}
            <div className="ai-content">
                <div className="ai-section">
                    <label><Sparkles size={12} /> AI Title</label>
                    <div className="ai-text">{clip.aiTitle}</div>
                </div>
                <div className="ai-section">
                    <label><Sparkles size={12} /> AI Description</label>
                    <div className="ai-text">{clip.aiDescription}</div>
                </div>
            </div>

            {/* Clip Info */}
            <div className="clip-info-grid">
                <div className="info-item">
                    <span className="info-label">Duration</span>
                    <span className="info-value">{clip.duration}s</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Aspect Ratio</span>
                    <span className="info-value">{clip.aspectRatio}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Captions</span>
                    <span className="info-value">{clip.captionStyle}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Status</span>
                    <span className={`info-value status-${clip.status}`}>{clip.status}</span>
                </div>
            </div>

            {/* Transcript */}
            <div className="transcript-section">
                <label>Transcript</label>
                <div className="transcript-text">{clip.transcript}</div>
            </div>

            {/* Actions */}
            <div className="details-actions">
                <button className="btn-primary" onClick={onEdit}>
                    <Edit3 size={16} />
                    Edit Clip
                </button>
                <button className="btn-secondary">
                    <Download size={16} />
                    Download
                </button>
                {clip.status === 'pending' && (
                    <button
                        className="btn-success"
                        onClick={() => onAction(clip.id, 'approved')}
                    >
                        <CheckCircle size={16} />
                        Approve
                    </button>
                )}
            </div>
        </div>
    );
}

// ============================================
// CLIP EDITOR COMPONENT
// ============================================

function ClipEditor({ clip, onUpdateClip, onBack }) {
    const [editTab, setEditTab] = useState('trim'); // 'trim' | 'captions' | 'style'
    const [selectedAspect, setSelectedAspect] = useState(clip.aspectRatio);
    const [selectedCaption, setSelectedCaption] = useState(clip.captionStyle);
    const [transcript, setTranscript] = useState(clip.transcript);

    return (
        <div className="clip-editor">
            {/* Editor Header */}
            <div className="editor-header">
                <button className="btn-back" onClick={onBack}>
                    <ChevronLeft size={20} />
                    Back to Clips
                </button>
                <h2>{clip.title}</h2>
                <button className="btn-save">
                    <CheckCircle size={16} />
                    Save Changes
                </button>
            </div>

            <div className="editor-layout">
                {/* Preview Panel */}
                <div className="editor-preview">
                    <div className="preview-container" data-aspect={selectedAspect}>
                        <div className="preview-video">
                            <Play size={48} />
                        </div>
                        {/* Caption Preview */}
                        <div className={`caption-preview style-${selectedCaption}`}>
                            <p>"{transcript.substring(0, 80)}..."</p>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="editor-timeline">
                        <div className="timeline-track">
                            <div className="timeline-clip" style={{ left: '10%', width: '30%' }}>
                                <span>{formatTimestamp(clip.startTime)}</span>
                            </div>
                        </div>
                        <div className="timeline-controls">
                            <button><RotateCcw size={16} /></button>
                            <button className="play-btn"><Play size={20} /></button>
                            <span>{formatTimestamp(clip.startTime)} / {formatTimestamp(clip.endTime)}</span>
                        </div>
                    </div>
                </div>

                {/* Editor Sidebar */}
                <div className="editor-sidebar">
                    {/* Editor Tabs */}
                    <div className="editor-tabs">
                        <button
                            className={editTab === 'trim' ? 'active' : ''}
                            onClick={() => setEditTab('trim')}
                        >
                            <Scissors size={16} />
                            Trim
                        </button>
                        <button
                            className={editTab === 'captions' ? 'active' : ''}
                            onClick={() => setEditTab('captions')}
                        >
                            <Type size={16} />
                            Captions
                        </button>
                        <button
                            className={editTab === 'style' ? 'active' : ''}
                            onClick={() => setEditTab('style')}
                        >
                            <Layers size={16} />
                            Style
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="editor-tab-content">
                        {editTab === 'trim' && (
                            <div className="trim-panel">
                                <h4>Adjust Timing</h4>
                                <div className="timing-inputs">
                                    <div className="timing-input">
                                        <label>Start</label>
                                        <input type="text" value={formatTimestamp(clip.startTime)} readOnly />
                                    </div>
                                    <div className="timing-input">
                                        <label>End</label>
                                        <input type="text" value={formatTimestamp(clip.endTime)} readOnly />
                                    </div>
                                </div>

                                <h4>Transcript Editing</h4>
                                <p className="hint">Edit text to modify the video</p>
                                <textarea
                                    value={transcript}
                                    onChange={(e) => setTranscript(e.target.value)}
                                    rows={6}
                                />
                            </div>
                        )}

                        {editTab === 'captions' && (
                            <div className="captions-panel">
                                <h4>Caption Style</h4>
                                <div className="caption-styles">
                                    {CAPTION_STYLES.map(style => (
                                        <div
                                            key={style.id}
                                            className={`caption-style-option ${selectedCaption === style.id ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedCaption(style.id);
                                                onUpdateClip({ captionStyle: style.id });
                                            }}
                                        >
                                            <span className="style-preview">{style.preview}</span>
                                            <div className="style-info">
                                                <span className="style-name">{style.name}</span>
                                                <span className="style-desc">{style.description}</span>
                                            </div>
                                            {selectedCaption === style.id && <CheckCircle size={16} />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {editTab === 'style' && (
                            <div className="style-panel">
                                <h4>Aspect Ratio</h4>
                                <div className="aspect-options">
                                    {ASPECT_RATIOS.map(ratio => (
                                        <div
                                            key={ratio.id}
                                            className={`aspect-option ${selectedAspect === ratio.id ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedAspect(ratio.id);
                                                onUpdateClip({ aspectRatio: ratio.id });
                                            }}
                                        >
                                            <span className="aspect-icon">{ratio.icon}</span>
                                            <div className="aspect-info">
                                                <span className="aspect-name">{ratio.name}</span>
                                                <span className="aspect-desc">{ratio.description}</span>
                                            </div>
                                            <span className="aspect-ratio">{ratio.id}</span>
                                        </div>
                                    ))}
                                </div>

                                <h4>Branding</h4>
                                <div className="branding-options">
                                    <button className="branding-btn">
                                        <Image size={16} />
                                        Add Logo
                                    </button>
                                    <button className="branding-btn">
                                        <Layers size={16} />
                                        Add Intro
                                    </button>
                                    <button className="branding-btn">
                                        <Music size={16} />
                                        Add Music
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// PUBLISH VIEW COMPONENT
// ============================================

function PublishView({ clips }) {
    return (
        <div className="publish-view">
            <div className="publish-header">
                <h2>Ready to Publish</h2>
                <p>{clips.length} approved clips ready for scheduling</p>
            </div>

            {clips.length > 0 ? (
                <div className="publish-grid">
                    {clips.map(clip => (
                        <div key={clip.id} className="publish-card">
                            <div className="publish-preview">
                                <Play size={24} />
                            </div>
                            <div className="publish-info">
                                <h4>{clip.title}</h4>
                                <p>{clip.aiDescription}</p>
                            </div>
                            <div className="publish-actions">
                                <button className="btn-schedule">
                                    <Calendar size={14} />
                                    Schedule
                                </button>
                                <button className="btn-post-now">
                                    <Send size={14} />
                                    Post Now
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <Calendar size={48} />
                    <h3>No clips ready to publish</h3>
                    <p>Approve some clips first to schedule them for publishing</p>
                </div>
            )}
        </div>
    );
}

// ============================================
// IMPORT MODAL COMPONENT
// ============================================

function ImportModal({
    onClose,
    importType,
    setImportType,
    youtubeUrl,
    setYoutubeUrl,
    onYoutubeImport,
    onFileUpload,
    fileInputRef,
    isProcessing,
    uploadProgress
}) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="import-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Import Video</h2>
                    <button className="btn-close" onClick={onClose}>
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="import-tabs">
                    <button
                        className={importType === 'upload' ? 'active' : ''}
                        onClick={() => setImportType('upload')}
                    >
                        <Upload size={18} />
                        Upload File
                    </button>
                    <button
                        className={importType === 'youtube' ? 'active' : ''}
                        onClick={() => setImportType('youtube')}
                    >
                        <ExternalLink size={18} />
                        YouTube URL
                    </button>
                </div>

                <div className="import-content">
                    {importType === 'upload' && (
                        <div
                            className="upload-zone"
                            onClick={() => {
                                // Use the hidden file input - works in both Electron and browser
                                console.log('[ContentEngine] Opening file picker...');
                                if (fileInputRef.current) {
                                    fileInputRef.current.click();
                                } else {
                                    console.error('[ContentEngine] File input ref not available');
                                }
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={onFileUpload}
                                style={{ display: 'none' }}
                            />
                            {isProcessing ? (
                                <div className="uploading">
                                    <Loader2 size={48} className="spin" />
                                    <p>Uploading... {uploadProgress}%</p>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Upload size={48} />
                                    <p>Drag & drop video or click to browse</p>
                                    <span>MP4, MOV, AVI, WebM • Max 2GB</span>
                                </>
                            )}
                        </div>
                    )}

                    {importType === 'youtube' && (
                        <div className="youtube-import">
                            <label>YouTube Video URL</label>
                            <input
                                type="url"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                            />
                            <p className="hint">
                                Paste any YouTube video URL. We'll download and process it automatically.
                            </p>
                            <button
                                className="btn-import-yt"
                                onClick={onYoutubeImport}
                                disabled={!youtubeUrl.trim() || isProcessing}
                            >
                                {isProcessing ? (
                                    <><Loader2 size={18} className="spin" /> Processing...</>
                                ) : (
                                    <><Download size={18} /> Import Video</>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div className="ai-notice">
                        <Sparkles size={16} />
                        <span>AI will automatically detect viral moments and generate clips</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ContentEngine;
