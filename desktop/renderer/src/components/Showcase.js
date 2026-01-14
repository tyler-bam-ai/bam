/**
 * Showcase - Interactive Tour That Navigates Between Pages
 * Highlights the new Content Engine and Social Media features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDemoMode } from '../contexts/DemoModeContext';
import {
    ChevronRight,
    ChevronLeft,
    X,
    LayoutDashboard,
    Video,
    Calendar,
    Upload,
    MessageSquare,
    Building2,
    Sparkles,
    CheckCircle,
    MessageCircle,
    TrendingUp,
    Inbox,
    BarChart3,
    ClipboardList
} from 'lucide-react';
import './Showcase.css';

// Showcase steps - each navigates to a page and highlights something ON that page
const SHOWCASE_STEPS = [
    {
        id: 'welcome',
        title: '✨ Welcome to BAM.ai!',
        description: 'Your AI-powered Business Brain. Let me show you the latest features including our new Content Engine and Social Media hub!',
        position: 'center',
        route: '/dashboard',
        icon: Sparkles
    },
    {
        id: 'dashboard-metrics',
        title: '📊 Dashboard Overview',
        description: 'See your ROI at a glance: hours saved by AI, questions answered, and estimated dollar value generated for your business.',
        target: '.value-metrics, .dashboard-stats, .stats-section',
        position: 'bottom',
        route: '/dashboard',
        icon: LayoutDashboard,
        spotlight: true
    },
    // Content Engine - NEW FEATURES
    {
        id: 'content-intro',
        title: '🎬 NEW: AI Content Engine',
        description: 'Our powerful AI video clipping platform! Upload long-form videos and AI automatically finds the viral-worthy moments.',
        target: '.ce-header, .content-engine-v2 h1',
        position: 'bottom',
        route: '/content',
        icon: Video,
        spotlight: true
    },
    {
        id: 'content-clips',
        title: '🔥 AI-Generated Clips',
        description: 'Each clip gets a Virality Score (0-99) predicting its viral potential, plus AI-generated titles and descriptions.',
        target: '.clips-container, .clips-view',
        position: 'left',
        route: '/content',
        icon: TrendingUp,
        spotlight: true
    },
    {
        id: 'content-editor',
        title: '✂️ Built-in Clip Editor',
        description: 'Edit clips right in the app! Trim, add captions with different styles, and choose aspect ratios for each platform.',
        target: '.ce-tabs, .editor-tabs',
        position: 'bottom',
        route: '/content',
        icon: Video,
        spotlight: true
    },
    // Social Media - NEW FEATURES
    {
        id: 'social-intro',
        title: '📱 NEW: Social Media Hub',
        description: 'Complete social media management! Smart Inbox, publishing calendar, analytics - all in one place.',
        target: '.sd-header, .social-dashboard-v2 h1',
        position: 'bottom',
        route: '/social',
        icon: Calendar,
        spotlight: true
    },
    {
        id: 'social-inbox',
        title: '📬 Smart Inbox',
        description: 'All your DMs, comments, and mentions from every platform in one unified inbox. Tag, filter, and reply with AI assistance.',
        target: '.smart-inbox, .message-list, .inbox-sidebar',
        position: 'right',
        route: '/social',
        icon: Inbox,
        spotlight: true
    },
    {
        id: 'social-calendar',
        title: '📅 Publishing Calendar',
        description: 'Schedule posts across all platforms. See your content calendar at a glance and never miss a posting time.',
        target: '.sd-tabs, .publishing-calendar',
        position: 'bottom',
        route: '/social',
        icon: Calendar,
        spotlight: true
    },
    {
        id: 'social-analytics',
        title: '📈 Analytics Dashboard',
        description: 'Track followers, engagement, and reach across all platforms. See what content performs best.',
        target: '.analytics-overview, .stat-card',
        position: 'bottom',
        route: '/social',
        icon: BarChart3,
        spotlight: true
    },
    // Knowledge System
    {
        id: 'provider-upload',
        title: '🧠 Knowledge Capture',
        description: 'Train your AI with your business knowledge! Upload documents, PDFs, or record screen walkthroughs.',
        target: '.upload-section, .knowledge-upload, .dropzone',
        position: 'bottom',
        route: '/provider',
        icon: Upload,
        spotlight: true
    },
    {
        id: 'consumer-chat',
        title: '💬 AI Chat Assistant',
        description: 'Three specialized AI brains: Operations, Employee, and Branding. Each pre-trained for specific tasks.',
        target: '.brain-tabs, .chat-container, .chat-interface',
        position: 'top',
        route: '/consumer',
        icon: MessageSquare,
        spotlight: true
    },
    // Admin
    {
        id: 'admin-panel',
        title: '👥 Admin & Clients',
        description: 'Manage all your clients in one place. Track usage, toggle API access, and monitor satisfaction.',
        target: '.admin-stats, .clients-table',
        position: 'bottom',
        route: '/admin',
        icon: Building2,
        spotlight: true
    },
    {
        id: 'onboarding',
        title: '📋 Client Onboarding',
        description: 'New! Comprehensive onboarding wizard with audio recording and transcript upload for capturing client knowledge.',
        target: '.onboarding-wizard, .onboarding-header',
        position: 'bottom',
        route: '/onboarding',
        icon: ClipboardList,
        spotlight: true
    },
    {
        id: 'complete',
        title: '🚀 You\'re Ready!',
        description: 'Toggle Demo Mode to see sample data in action. Start with the Content Engine to create viral clips, or manage your social presence in the Social Hub!',
        position: 'center',
        route: '/dashboard',
        icon: CheckCircle
    }
];

function Showcase({ onClose }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDemoMode, toggleDemoMode } = useDemoMode();
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const tooltipRef = useRef(null);

    const step = SHOWCASE_STEPS[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === SHOWCASE_STEPS.length - 1;

    // Enable demo mode when showcase starts
    useEffect(() => {
        if (!isDemoMode) {
            toggleDemoMode();
        }
    }, []);

    // Navigate to the step's route
    useEffect(() => {
        if (step.route && location.pathname !== step.route) {
            setIsNavigating(true);
            navigate(step.route);
            // Wait for navigation to complete
            setTimeout(() => setIsNavigating(false), 500);
        } else {
            setIsNavigating(false);
        }
    }, [currentStep, step.route, navigate, location.pathname]);

    // Find and highlight target element with retry logic
    useEffect(() => {
        const findTarget = () => {
            if (!step.target || isNavigating) {
                setTargetRect(null);
                return;
            }

            // Try multiple selectors (comma-separated)
            const selectors = step.target.split(',').map(s => s.trim());
            let targetEl = null;

            for (const selector of selectors) {
                targetEl = document.querySelector(selector);
                if (targetEl) break;
            }

            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                // Only set if element is visible
                if (rect.width > 0 && rect.height > 0) {
                    setTargetRect({
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    });
                    return;
                }
            }

            setTargetRect(null);
        };

        // Try multiple times as page may still be rendering
        findTarget();
        const timer1 = setTimeout(findTarget, 300);
        const timer2 = setTimeout(findTarget, 600);
        const timer3 = setTimeout(findTarget, 1000);

        window.addEventListener('resize', findTarget);
        return () => {
            window.removeEventListener('resize', findTarget);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [currentStep, step.target, isNavigating, location.pathname]);

    // Calculate tooltip position
    const getTooltipStyle = () => {
        if (step.position === 'center' || !targetRect) {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
            };
        }

        const padding = 24;
        const tooltipWidth = 380;
        const tooltipHeight = 220;

        let top, left;

        switch (step.position) {
            case 'right':
                top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
                left = targetRect.left + targetRect.width + padding;
                break;
            case 'left':
                top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
                left = targetRect.left - tooltipWidth - padding;
                break;
            case 'bottom':
                top = targetRect.top + targetRect.height + padding;
                left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
                break;
            case 'top':
                top = targetRect.top - tooltipHeight - padding;
                left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
                break;
            default:
                top = targetRect.top + targetRect.height + padding;
                left = targetRect.left;
        }

        // Keep in viewport
        top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

        return {
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${tooltipWidth}px`
        };
    };

    const handleNext = useCallback(() => {
        if (!isLastStep) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleClose();
        }
    }, [isLastStep]);

    const handlePrev = useCallback(() => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    }, [isFirstStep]);

    const handleClose = useCallback(() => {
        navigate('/dashboard');
        if (onClose) onClose();
    }, [onClose, navigate]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'Escape') handleClose();
    }, [handleNext, handlePrev, handleClose]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const StepIcon = step.icon;

    // Get current page name for display
    const getPageName = () => {
        const path = step.route || location.pathname;
        const pages = {
            '/dashboard': 'Dashboard',
            '/content': 'Content Engine',
            '/social': 'Social Hub',
            '/provider': 'Knowledge Capture',
            '/consumer': 'AI Brains',
            '/widget': 'Chat Widget',
            '/settings': 'Settings',
            '/admin': 'Admin & Clients',
            '/onboarding': 'Onboarding'
        };
        return pages[path] || 'BAM.ai';
    };

    return (
        <div className="showcase-container">
            {/* Dark overlay with spotlight cutout */}
            <svg className="showcase-overlay-svg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && step.spotlight && (
                            <rect
                                x={targetRect.left - 12}
                                y={targetRect.top - 12}
                                width={targetRect.width + 24}
                                height={targetRect.height + 24}
                                rx="12"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.8)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Highlight ring around target */}
            {targetRect && step.spotlight && (
                <div
                    className="showcase-spotlight-ring"
                    style={{
                        top: targetRect.top - 12,
                        left: targetRect.left - 12,
                        width: targetRect.width + 24,
                        height: targetRect.height + 24
                    }}
                />
            )}

            {/* Tooltip */}
            <div className="showcase-tooltip" style={getTooltipStyle()} ref={tooltipRef}>
                {/* Close button */}
                <button className="showcase-close" onClick={handleClose} title="Exit Tour (Esc)">
                    <X size={18} />
                </button>

                {/* Page indicator */}
                <div className="showcase-page-badge">
                    📍 {getPageName()} — Step {currentStep + 1}/{SHOWCASE_STEPS.length}
                </div>

                {/* Content */}
                <div className="showcase-tooltip-content">
                    <div className="showcase-tooltip-icon">
                        <StepIcon size={32} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                </div>

                {/* Navigation */}
                <div className="showcase-tooltip-nav">
                    <div className="showcase-dots">
                        {SHOWCASE_STEPS.map((_, index) => (
                            <button
                                key={index}
                                className={`showcase-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                                onClick={() => setCurrentStep(index)}
                                aria-label={`Go to step ${index + 1}`}
                            />
                        ))}
                    </div>

                    <div className="showcase-buttons">
                        {!isFirstStep && (
                            <button className="btn btn-ghost" onClick={handlePrev}>
                                <ChevronLeft size={18} />
                                Back
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={handleNext}>
                            {isLastStep ? 'Get Started!' : 'Next'}
                            {!isLastStep && <ChevronRight size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Showcase;
