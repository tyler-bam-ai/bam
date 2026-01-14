import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDemoMode } from '../contexts/DemoModeContext';
import ValueMetricsCards from '../components/ValueMetricsCards';
import {
    Upload,
    MessageSquare,
    TrendingUp,
    CheckCircle2,
    Clock,
    FileText,
    Mic,
    Video,
    ArrowRight,
    DollarSign,
    Phone,
    Sparkles,
    Plus,
    X,
    Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
    const { user, isProvider, isConsumer, isAdmin } = useAuth();
    const { isDemoMode, mockDashboardMetrics } = useDemoMode();
    const [completedTasks, setCompletedTasks] = useState(new Set());
    const [showAllTasks, setShowAllTasks] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [tasks, setTasks] = useState([]);
    const [realStats, setRealStats] = useState(null);

    // Fetch real analytics from backend
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!isDemoMode) {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('http://localhost:3001/api/analytics/dashboard', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setRealStats(data);
                    }
                } catch (error) {
                    console.error('Error fetching dashboard analytics:', error);
                }
            }
        };
        fetchAnalytics();
    }, [isDemoMode]);

    // Use real stats, demo metrics, or zeros
    const stats = realStats || (isDemoMode && mockDashboardMetrics ? {
        documentsUploaded: 47,
        recordingsCreated: 12,
        questionsAnswered: mockDashboardMetrics.questionsAnswered,
        tasksCompleted: 89,
        completionScore: 92,
        hoursSaved: mockDashboardMetrics.hoursSaved,
        callsRecovered: mockDashboardMetrics.callsRecoveredPercent,
        estimatedValue: mockDashboardMetrics.estimatedValue
    } : {
        documentsUploaded: 0,
        recordingsCreated: 0,
        questionsAnswered: 0,
        tasksCompleted: 0,
        completionScore: 0,
        hoursSaved: null,
        callsRecovered: null,
        estimatedValue: null
    });

    // Value metrics for the cards - ONLY in demo mode
    const valueMetrics = isDemoMode && mockDashboardMetrics ? {
        hoursSaved: mockDashboardMetrics.hoursSaved || 42.5,
        hoursSavedDelta: 8.3,
        questionsAnswered: mockDashboardMetrics.questionsAnswered || 347,
        questionsAnsweredDelta: 52,
        estimatedValue: mockDashboardMetrics.estimatedValue || 12450,
        estimatedValueDelta: 2340,
        callsRecovered: mockDashboardMetrics.callsRecoveredPercent || 89,
        contentPosted: 23,
        employeesOnboarded: 4
    } : null;

    // Weekly activity - ONLY in demo mode
    const weeklyActivity = isDemoMode ? [
        { day: 'Sun', questions: 12, content: 2 },
        { day: 'Mon', questions: 45, content: 5 },
        { day: 'Tue', questions: 38, content: 4 },
        { day: 'Wed', questions: 52, content: 6 },
        { day: 'Thu', questions: 41, content: 3 },
        { day: 'Fri', questions: 33, content: 4 },
        { day: 'Sat', questions: 18, content: 1 }
    ] : null;

    // Recent activity - ONLY in demo mode
    const recentActivity = isDemoMode ? [
        { type: 'document', title: 'Employee Handbook 2024.pdf', time: '1 hour ago', icon: FileText },
        { type: 'recording', title: 'New Hire Onboarding Webinar', time: '3 hours ago', icon: Video },
        { type: 'question', title: 'What is our refund policy?', time: '4 hours ago', icon: MessageSquare },
        { type: 'audio', title: 'Customer Service Best Practices', time: 'Yesterday', icon: Mic },
    ] : [];

    // Demo tasks
    const demoTasks = [
        { id: 1, title: 'Process morning email queue', priority: 'high', dueTime: '9:00 AM' },
        { id: 2, title: 'Update inventory spreadsheet', priority: 'medium', dueTime: '12:00 PM' },
        { id: 3, title: 'Send weekly report to clients', priority: 'high', dueTime: '3:00 PM' },
        { id: 4, title: 'Review new employee applications', priority: 'medium', dueTime: '4:00 PM' },
        { id: 5, title: 'Schedule team meeting for next week', priority: 'low', dueTime: '5:00 PM' },
        { id: 6, title: 'Respond to customer support tickets', priority: 'high', dueTime: '10:00 AM' },
        { id: 7, title: 'Update social media content calendar', priority: 'medium', dueTime: '2:00 PM' },
        { id: 8, title: 'Prepare quarterly sales presentation', priority: 'high', dueTime: 'Tomorrow' },
    ];

    // Combine demo tasks with user-created tasks
    const pendingTasks = isDemoMode ? [...tasks, ...demoTasks] : tasks;

    // Toggle task completion
    const toggleTask = (taskId) => {
        setCompletedTasks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    };

    // Voice-to-task recording
    const startVoiceRecording = () => {
        setIsRecording(true);
        setVoiceTranscript('');

        // Simulate voice recognition (in production, use Web Speech API)
        setTimeout(() => {
            const sampleTranscripts = [
                'Call the vendor about the shipment delay',
                'Schedule a meeting with Sarah for project review',
                'Follow up on the client proposal by end of day',
                'Order supplies for the office kitchen',
            ];
            setVoiceTranscript(sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)]);
        }, 1500);
    };

    const stopVoiceRecording = () => {
        setIsRecording(false);
        if (voiceTranscript) {
            addTask(voiceTranscript);
        }
    };

    const cancelVoiceRecording = () => {
        setIsRecording(false);
        setVoiceTranscript('');
    };

    const addTask = (title) => {
        const newTask = {
            id: Date.now(),
            title: title,
            priority: 'medium',
            dueTime: 'Today',
            isNew: true
        };
        setTasks(prev => [newTask, ...prev]);
        setVoiceTranscript('');
    };

    return (
        <div className="dashboard">
            {/* Welcome Section */}
            <section className="welcome-section animate-slideUp">
                <div className="welcome-content">
                    <h2 className="welcome-title">
                        Good {getTimeOfDay()}, {user?.name?.split(' ')[0]}!
                    </h2>
                    <p className="welcome-subtitle">
                        {getWelcomeMessage(user?.role)}
                    </p>
                </div>

                {isProvider() && (
                    <Link to="/provider" className="btn btn-primary btn-lg">
                        <Upload size={20} />
                        Capture Knowledge
                    </Link>
                )}

                {isConsumer() && !isProvider() && (
                    <Link to="/consumer" className="btn btn-primary btn-lg">
                        <MessageSquare size={20} />
                        Ask AI
                    </Link>
                )}
            </section>

            {/* Value Metrics Cards - Show for admins or when in demo mode */}
            {(isAdmin() || isDemoMode) && valueMetrics && (
                <ValueMetricsCards
                    metrics={valueMetrics}
                    weeklyActivity={weeklyActivity}
                    isDemo={isDemoMode}
                />
            )}

            {/* Stats Cards */}

            <section className="stats-section">
                {isProvider() && (
                    <>
                        <div className="stat-card animate-slideUp" style={{ animationDelay: '0.1s' }}>
                            <div className="stat-icon">
                                <FileText size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.documentsUploaded}</span>
                                <span className="stat-label">Documents Uploaded</span>
                            </div>
                        </div>

                        <div className="stat-card animate-slideUp" style={{ animationDelay: '0.15s' }}>
                            <div className="stat-icon">
                                <Video size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.recordingsCreated}</span>
                                <span className="stat-label">Recordings Created</span>
                            </div>
                        </div>
                    </>
                )}

                {isConsumer() && (
                    <>
                        <div className="stat-card animate-slideUp" style={{ animationDelay: '0.2s' }}>
                            <div className="stat-icon">
                                <MessageSquare size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.questionsAnswered}</span>
                                <span className="stat-label">Questions Answered</span>
                            </div>
                        </div>

                        <div className="stat-card animate-slideUp" style={{ animationDelay: '0.25s' }}>
                            <div className="stat-icon">
                                <CheckCircle2 size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.tasksCompleted}</span>
                                <span className="stat-label">Tasks Completed</span>
                            </div>
                        </div>
                    </>
                )}

                <div className="stat-card stat-card-highlight animate-slideUp" style={{ animationDelay: '0.3s' }}>
                    <div className="stat-icon">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.completionScore}%</span>
                        <span className="stat-label">Knowledge Base Score</span>
                    </div>
                    <div className="stat-progress">
                        <div
                            className="stat-progress-bar"
                            style={{ width: `${stats.completionScore}%` }}
                        ></div>
                    </div>
                </div>
            </section>

            {/* Main Content Grid */}
            <div className="dashboard-grid">
                {/* Tasks Panel - For Consumers */}
                {isConsumer() && (
                    <section className={`dashboard-panel tasks-panel animate-slideUp ${showAllTasks ? 'expanded' : ''}`} style={{ animationDelay: '0.35s' }}>
                        <div className="panel-header">
                            <h3 className="panel-title">
                                <Clock size={20} />
                                Today's Tasks
                                {pendingTasks.length > 0 && (
                                    <span className="task-count">
                                        {completedTasks.size}/{pendingTasks.length}
                                    </span>
                                )}
                            </h3>
                            <div className="panel-actions">
                                <button
                                    className={`voice-task-btn ${isRecording ? 'recording' : ''}`}
                                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                                    title={isRecording ? 'Stop recording' : 'Add task by voice'}
                                >
                                    {isRecording ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}
                                </button>
                                {pendingTasks.length > 3 && (
                                    <button
                                        className="panel-link"
                                        onClick={() => setShowAllTasks(!showAllTasks)}
                                    >
                                        {showAllTasks ? 'Show Less' : `View All (${pendingTasks.length})`} <ArrowRight size={16} className={showAllTasks ? 'rotate-down' : ''} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Voice Recording UI */}
                        {isRecording && (
                            <div className="voice-recording-panel">
                                <div className="recording-indicator">
                                    <span className="recording-dot"></span>
                                    <span>Listening...</span>
                                </div>
                                <div className="voice-transcript-preview">
                                    {voiceTranscript || 'Speak your task...'}
                                </div>
                                <div className="recording-actions">
                                    <button className="btn btn-sm btn-ghost" onClick={cancelVoiceRecording}>
                                        <X size={14} /> Cancel
                                    </button>
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={stopVoiceRecording}
                                        disabled={!voiceTranscript}
                                    >
                                        <Plus size={14} /> Add Task
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="panel-content">
                            {pendingTasks.length > 0 ? (
                                (showAllTasks ? pendingTasks : pendingTasks.slice(0, 3)).map((task) => (
                                    <div key={task.id} className={`task-item ${completedTasks.has(task.id) ? 'completed' : ''} ${task.isNew ? 'new-task' : ''}`}>
                                        <input
                                            type="checkbox"
                                            className="task-checkbox"
                                            id={`task-${task.id}`}
                                            checked={completedTasks.has(task.id)}
                                            onChange={() => toggleTask(task.id)}
                                        />
                                        <label htmlFor={`task-${task.id}`} className="task-label">
                                            <span className="task-title">
                                                {task.isNew && <span className="new-badge">NEW</span>}
                                                {task.title}
                                            </span>
                                            <span className="task-meta">
                                                <span className={`task-priority priority-${task.priority}`}>
                                                    {task.priority}
                                                </span>
                                                <span className="task-time">{task.dueTime}</span>
                                            </span>
                                        </label>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <p>No tasks yet. Click the mic to add a task by voice!</p>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Recent Activity */}
                <section className="dashboard-panel activity-panel animate-slideUp" style={{ animationDelay: '0.4s' }}>
                    <div className="panel-header">
                        <h3 className="panel-title">Recent Activity</h3>
                    </div>
                    <div className="panel-content">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((activity, index) => (
                                <div key={index} className="activity-item">
                                    <div className={`activity-icon activity-icon-${activity.type}`}>
                                        <activity.icon size={16} />
                                    </div>
                                    <div className="activity-content">
                                        <span className="activity-title">{activity.title}</span>
                                        <span className="activity-time">{activity.time}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <p>No recent activity. Enable Demo Mode to see sample data.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Quick Actions */}
                <section className="dashboard-panel actions-panel animate-slideUp" style={{ animationDelay: '0.45s' }}>
                    <div className="panel-header">
                        <h3 className="panel-title">Quick Actions</h3>
                    </div>
                    <div className="panel-content quick-actions-grid">
                        {isProvider() && (
                            <>
                                <Link to="/provider/record" className="quick-action">
                                    <Video size={24} />
                                    <span>Record Screen</span>
                                </Link>
                                <Link to="/provider/upload" className="quick-action">
                                    <Upload size={24} />
                                    <span>Upload Files</span>
                                </Link>
                                <Link to="/provider/voice" className="quick-action">
                                    <Mic size={24} />
                                    <span>Voice Memo</span>
                                </Link>
                            </>
                        )}
                        {isConsumer() && (
                            <>
                                <Link to="/consumer/chat" className="quick-action">
                                    <MessageSquare size={24} />
                                    <span>Ask Question</span>
                                </Link>
                                <Link to="/consumer/voice" className="quick-action">
                                    <Mic size={24} />
                                    <span>Voice Chat</span>
                                </Link>
                            </>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

function getWelcomeMessage(role) {
    switch (role) {
        case 'bam_admin':
            return 'Manage client accounts and monitor knowledge base health.';
        case 'knowledge_provider':
            return 'Capture your expertise to help your team succeed.';
        case 'knowledge_consumer':
            return 'Your AI assistant is ready to help you with any questions.';
        default:
            return 'Welcome to BAM.ai';
    }
}

export default Dashboard;
