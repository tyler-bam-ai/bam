import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    MessageSquare,
    Palette,
    CheckCircle,
    Play,
    Send,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Briefcase,
    Heart,
    ArrowLeft,
    Save,
    Loader2,
    Mic,
    Upload,
    FileText,
    Pause,
    Square,
    Wand2,
    Download,
    AlertCircle,
    Target
} from 'lucide-react';
import logger from '../utils/onboardingLogger';
import { API_URL, retryFetch } from '../config';
import { useToast } from '../contexts/ToastContext';
import './Onboarding.css';

// Industry-specific question additions
const INDUSTRY_QUESTIONS = {
    healthcare: [
        { id: 'hipaaCompliance', label: 'How do you currently handle HIPAA compliance?', type: 'textarea' },
        { id: 'patientScheduling', label: 'What patient scheduling system do you use?', type: 'text' },
        { id: 'emrSystem', label: 'What EMR/EHR system do you use?', type: 'text' }
    ],
    dental: [
        { id: 'dentalSoftware', label: 'What dental practice management software do you use? (Dentrix, Eaglesoft, etc.)', type: 'text' },
        { id: 'insuranceProcessing', label: 'How do you handle dental insurance claims processing?', type: 'textarea' },
        { id: 'patientReminders', label: 'What system do you use for patient appointment reminders?', type: 'text' }
    ],
    retail: [
        { id: 'posSystem', label: 'What POS system do you use?', type: 'text' },
        { id: 'inventoryManagement', label: 'How do you manage inventory?', type: 'textarea' },
        { id: 'ecommercePlatform', label: 'Do you have an e-commerce presence? What platform?', type: 'text' }
    ],
    professional_services: [
        { id: 'billingMethod', label: 'How do you bill clients? (Hourly, project-based, retainer)', type: 'text' },
        { id: 'timeTracking', label: 'What time tracking software do you use?', type: 'text' },
        { id: 'clientPortal', label: 'Do you have a client portal? What do you use?', type: 'text' }
    ],
    construction: [
        { id: 'estimatingSoftware', label: 'What estimating/bidding software do you use?', type: 'text' },
        { id: 'projectTracking', label: 'How do you track project progress and milestones?', type: 'textarea' },
        { id: 'subcontractorManagement', label: 'How do you manage subcontractors?', type: 'textarea' }
    ],
    restaurant: [
        { id: 'posSystem', label: 'What POS system do you use? (Toast, Square, etc.)', type: 'text' },
        { id: 'reservationSystem', label: 'What reservation system do you use?', type: 'text' },
        { id: 'deliveryPlatforms', label: 'What delivery platforms are you on? (DoorDash, UberEats, etc.)', type: 'textarea' }
    ],
    beauty_salon: [
        { id: 'bookingSoftware', label: 'What booking/scheduling software do you use?', type: 'text' },
        { id: 'clientManagement', label: 'How do you track client preferences and history?', type: 'textarea' },
        { id: 'productRetail', label: 'Do you sell retail products? How do you manage that?', type: 'textarea' }
    ]
};

const INDUSTRY_OPTIONS = [
    { value: '', label: 'Select industry...' },
    { value: 'healthcare', label: 'Healthcare / Medical' },
    { value: 'dental', label: 'Dental Practice' },
    { value: 'retail', label: 'Retail' },
    { value: 'professional_services', label: 'Professional Services (Law, Accounting, Consulting)' },
    { value: 'construction', label: 'Construction / Trades' },
    { value: 'restaurant', label: 'Restaurant / Food Service' },
    { value: 'beauty_salon', label: 'Beauty Salon / Spa' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'technology', label: 'Technology / SaaS' },
    { value: 'other', label: 'Other' }
];

// AI Brain Discovery Interview Guide
// Purpose: Capture tribal knowledge, processes, FAQs, and decision-making patterns
// Duration: 60–90 minutes (record for transcription)

const INTERVIEW_SECTIONS = {
    businessFundamentals: {
        title: 'Business Fundamentals',
        icon: Building2,
        description: 'Overview, revenue, pricing - 10 minutes',
        duration: '10 min',
        questions: [
            { id: 'businessOverview', label: 'Walk me through your business in 2–3 minutes. What do you do, who are your customers, and what problem do you solve?', type: 'textarea' },
            { id: 'businessEvolution', label: 'How long have you been in business, and how has your business evolved?', type: 'textarea' },
            { id: 'teamStructure', label: 'What\'s your current team structure? (Sales, support, operations, etc.)', type: 'textarea' },
            { id: 'typicalCustomer', label: 'What\'s your typical customer? (Size, industry, use case, decision-maker type)', type: 'textarea' },
            { id: 'customerAcquisition', label: 'How do customers typically find you or become aware of you?', type: 'textarea' },
            { id: 'serviceOfferings', label: 'What are your main service offerings or product lines?', type: 'textarea' },
            { id: 'pricingStructure', label: 'How is your pricing structured? (Per-project, retainer, per-seat, tiered, etc.)', type: 'textarea' },
            { id: 'dealSize', label: 'What\'s the typical deal size and sales cycle?', type: 'text' },
            { id: 'paymentTerms', label: 'What are your most common payment terms and conditions?', type: 'textarea' }
        ]
    },
    customerInteractions: {
        title: 'Customer Interactions & FAQs',
        icon: MessageSquare,
        description: 'Most-asked questions, objections, service delivery - 20 minutes',
        duration: '20 min',
        questions: [
            { id: 'topFAQs', label: 'What are the top 5–10 questions your customers ask most frequently? (Email, phone, chat, demos)', type: 'textarea' },
            { id: 'firstContactQuestions', label: 'When a prospect first contacts you, what do they typically want to know?', type: 'textarea' },
            { id: 'postSignupQuestions', label: 'What questions do customers ask after they\'ve signed on? (Onboarding, integration, best practices)', type: 'textarea' },
            { id: 'returningCustomerQuestions', label: 'What questions do past customers ask when they come back or want to re-engage?', type: 'textarea' },
            { id: 'annoyingQuestions', label: 'Are there any questions that irritate you or your team because you answer them so often?', type: 'textarea' },
            { id: 'topObjections', label: 'What are the top objections you hear from prospects who don\'t buy?', type: 'textarea' },
            { id: 'objectionHandling', label: 'How do you typically overcome each objection? (Pitch or story you use)', type: 'textarea' },
            { id: 'postSignupWorries', label: 'What worries do customers have after they sign up?', type: 'textarea' },
            { id: 'competitorQuestions', label: 'What do prospects always want to know about competitors or how you\'re different?', type: 'textarea' },
            { id: 'commonMisconceptions', label: 'Are there any misconceptions about your service that you constantly have to correct?', type: 'textarea' },
            { id: 'onboardingFlow', label: 'Walk me through your ideal customer onboarding flow. Step by step, what happens?', type: 'textarea' },
            { id: 'cancellationReasons', label: 'What\'s the most common reason a customer becomes unhappy or wants to cancel?', type: 'textarea' },
            { id: 'bestCustomerTraits', label: 'What do your best customers have in common? What makes them successful?', type: 'textarea' },
            { id: 'customerBlockers', label: 'What\'s a typical question a customer asks when they hit a blocker or problem?', type: 'textarea' },
            { id: 'refundHandling', label: 'How do you typically handle a customer asking for a refund or to cancel?', type: 'textarea' }
        ]
    },
    internalProcesses: {
        title: 'Internal Processes & Decision Rules',
        icon: Briefcase,
        description: 'How you think, make decisions, and run operations - 20 minutes',
        duration: '20 min',
        questions: [
            { id: 'decisionFactors', label: 'When you make a major business decision, what factors do you consider? (Cost, timing, impact, etc.)', type: 'textarea' },
            { id: 'businessRules', label: 'Do you have specific "rules" for your business? (E.g., "We always start with X," "We never…")', type: 'textarea' },
            { id: 'customerSelectionCriteria', label: 'How do you decide whether to take on a new project or customer?', type: 'textarea' },
            { id: 'prioritizationQuestions', label: 'What questions do you ask yourself when prioritizing work?', type: 'textarea' },
            { id: 'nonNegotiables', label: 'Are there any non-negotiables in your business? (Service quality, ethics, process, pricing)', type: 'textarea' },
            { id: 'projectFlow', label: 'Walk me through how a typical project/engagement works from start to finish.', type: 'textarea' },
            { id: 'leadQualification', label: 'What\'s your process for qualifying a new lead or prospect? (Do you turn anyone away? Why?)', type: 'textarea' },
            { id: 'scopeCreep', label: 'How do you handle scope creep or customers asking for things outside your service?', type: 'textarea' },
            { id: 'feedbackProcess', label: 'Do you have a specific process for feedback or iterating with customers?', type: 'textarea' },
            { id: 'projectTracking', label: 'How do you track projects, timelines, or customer status? (Tools, spreadsheets, mental note?)', type: 'textarea' },
            { id: 'rushPolicy', label: 'What\'s your policy on rush requests, tight deadlines, or expedited work?', type: 'textarea' },
            { id: 'addOnsUpsells', label: 'Are there any standard "add-ons" or upsells you offer?', type: 'textarea' },
            { id: 'pricingFlexibility', label: 'How flexible is your pricing? Do you negotiate, offer discounts, or have special cases?', type: 'textarea' },
            { id: 'projectSizeLimits', label: 'What\'s the smallest and largest project you\'ll take on?', type: 'text' },
            { id: 'guaranteesRefunds', label: 'Do you offer any guarantees or refund policies? What are the exact terms?', type: 'textarea' },
            { id: 'paymentDisputes', label: 'How do you handle payment disputes or late payments?', type: 'textarea' }
        ]
    },
    salesPositioning: {
        title: 'Sales & Marketing Positioning',
        icon: Palette,
        description: 'How you pitch, position, and build trust - 15 minutes',
        duration: '15 min',
        questions: [
            { id: 'elevatorPitch', label: 'How do you typically pitch or explain what you do to a prospect who\'s never heard of you?', type: 'textarea' },
            { id: 'pitchVariations', label: 'What\'s your "elevator pitch" for different types of customers? (Enterprise vs. small, different industries, etc.)', type: 'textarea' },
            { id: 'differentiation', label: 'What makes you different from competitors or similar services?', type: 'textarea' },
            { id: 'talkingPoints', label: 'Do you have specific "talking points" or angles for different customer types?', type: 'textarea' },
            { id: 'successStory', label: 'What\'s a success story or case study you tell often? (Walk me through it in detail)', type: 'textarea' },
            { id: 'credentials', label: 'What credentials, certifications, or social proof do you lean on? (Awards, testimonials, years in business, etc.)', type: 'textarea' },
            { id: 'redFlags', label: 'Are there any "red flags" in a prospect that tell you they\'re not a good fit?', type: 'textarea' },
            { id: 'trustBuilding', label: 'How do you build trust with a nervous or skeptical prospect?', type: 'textarea' },
            { id: 'concernsToOvercome', label: 'What\'s a concern a prospect might have that you need to overcome before they\'ll commit?', type: 'textarea' },
            { id: 'riskReversal', label: 'Do you have any guarantees, risk-reversal policies, or trial offers?', type: 'textarea' }
        ]
    },
    edgeCases: {
        title: 'Edge Cases & Special Situations',
        icon: AlertCircle,
        description: 'Exceptions, problem-solving, industry nuance - 10 minutes',
        duration: '10 min',
        questions: [
            { id: 'trickySituation', label: 'What\'s a tricky customer situation you\'ve handled? How do you approach it?', type: 'textarea' },
            { id: 'disqualifiers', label: 'Are there any questions or requests that immediately disqualify someone?', type: 'textarea' },
            { id: 'newRequests', label: 'How do you handle a customer asking for something you\'ve never done before?', type: 'textarea' },
            { id: 'unhappyCustomer', label: 'What do you do if a customer is unhappy or complaining?', type: 'textarea' },
            { id: 'complianceGuardrails', label: 'Are there any legal, compliance, or ethical guardrails you need to mention?', type: 'textarea' },
            { id: 'industryJargon', label: 'Are there industry jargon, insider terms, or abbreviations you use that outsiders might not understand? (Define them)', type: 'textarea' },
            { id: 'seasonalPatterns', label: 'Are there any seasonal or timing patterns in your business? (Busy seasons, off-seasons, planning cycles?)', type: 'textarea' },
            { id: 'geographyPreferences', label: 'Do you work with certain geographies, company sizes, or industries you prefer?', type: 'textarea' },
            { id: 'industryChanges', label: 'What\'s changing in your industry right now that customers worry about?', type: 'textarea' }
        ]
    },
    contentKnowledge: {
        title: 'Content & Knowledge Assets',
        icon: FileText,
        description: 'Existing resources, tone, voice - 5 minutes',
        duration: '5 min',
        questions: [
            { id: 'existingDocuments', label: 'Do you have any documents, playbooks, SOPs, or guides you already use internally or share with customers?', type: 'textarea' },
            { id: 'caseStudies', label: 'Have you written case studies, testimonials, or success stories you\'d like included?', type: 'textarea' },
            { id: 'emailTemplates', label: 'Do you have email templates or scripts you use for common scenarios?', type: 'textarea' },
            { id: 'referenceDocuments', label: 'Are there any PDFs, spreadsheets, or contracts you\'d like the Brain to reference?', type: 'textarea' },
            { id: 'communicationStyle', label: 'How would you describe your communication style? (Formal, casual, technical, fun, supportive, etc.)', type: 'textarea' },
            { id: 'brandPhrases', label: 'Are there phrases, jokes, or metaphors you use often that define your brand?', type: 'textarea' },
            { id: 'aiTone', label: 'What tone should the AI Brain use when replying to customers vs. talking to internal staff?', type: 'textarea' },
            { id: 'sensitiveTopics', label: 'Are there any topics that should be handled with particular care or sensitivity?', type: 'textarea' }
        ]
    },
    successMetrics: {
        title: 'Success Metrics & Future',
        icon: Target,
        description: 'Wrap-up, success criteria, final thoughts - 5 minutes',
        duration: '5 min',
        questions: [
            { id: 'brainSuccess', label: 'What would "success" look like for the AI Brain in your business? (Time saved, leads generated, faster responses, etc.)', type: 'textarea' },
            { id: 'topPainPoint', label: 'What\'s the #1 pain point the Brain should help you solve first?', type: 'textarea' },
            { id: 'successIndicators', label: 'How will you know the Brain is working? (What metrics or feedback will tell you?)', type: 'textarea' },
            { id: 'additionalKnowledge', label: 'Is there anything else about your business, your customers, or your decision-making that we haven\'t covered that the Brain should know?', type: 'textarea' }
        ]
    }
};

const STEPS = [
    { id: 'company', label: 'Setup', icon: Building2 },
    { id: 'businessFundamentals', label: 'Fundamentals', icon: Building2 },
    { id: 'customerInteractions', label: 'Customer FAQs', icon: MessageSquare },
    { id: 'internalProcesses', label: 'Processes', icon: Briefcase },
    { id: 'salesPositioning', label: 'Sales & Marketing', icon: Palette },
    { id: 'edgeCases', label: 'Edge Cases', icon: AlertCircle },
    { id: 'contentKnowledge', label: 'Content', icon: FileText },
    { id: 'successMetrics', label: 'Success', icon: Target },
    { id: 'review', label: 'Review', icon: CheckCircle },
    { id: 'deliver', label: 'Deliver', icon: Send }
];

// Auto-save key for localStorage
const AUTOSAVE_KEY = 'bam_onboarding_session';
const AUTOSAVE_INTERVAL = 10000; // 10 seconds

function Onboarding() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [currentStep, setCurrentStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [processingTranscript, setProcessingTranscript] = useState(false);
    const [showTranscriptUpload, setShowTranscriptUpload] = useState(false);
    const [uploadedTranscript, setUploadedTranscript] = useState('');
    const [showExportSuccess, setShowExportSuccess] = useState(false);

    // Real-time transcription state
    const [focusedQuestion, setFocusedQuestion] = useState(null);
    const [transcriptBuffer, setTranscriptBuffer] = useState('');
    const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
    const [transcriptionStatus, setTranscriptionStatus] = useState('idle'); // idle, listening, processing
    const [apiKeyError, setApiKeyError] = useState(false); // Shows missing API key warning
    const [debugMessage, setDebugMessage] = useState(''); // Debug status for troubleshooting
    const [fullTranscript, setFullTranscript] = useState(''); // Complete accumulated transcript for review

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const fileInputRef = useRef(null);
    const autoSaveTimerRef = useRef(null);
    const transcriptionIntervalRef = useRef(null);
    const recordingLoopRef = useRef(null); // For segment-based recording data
    const answerExtractionIntervalRef = useRef(null);
    const pendingAudioChunksRef = useRef([]);
    const isRecordingRef = useRef(false); // Use ref for closure access
    const streamRef = useRef(null); // Store stream for restart
    const fullTranscriptRef = useRef(''); // Ref for closure access to full transcript
    const isTranscribingRef = useRef(false); // Track if transcription is in progress
    const transcriptionPromiseRef = useRef(null); // Promise that resolves when transcription completes

    const [sessionData, setSessionData] = useState({
        // Session metadata
        sessionId: '',
        createdAt: '',
        lastModified: '',
        // Company info
        companyName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        website: '',
        industry: '',
        plan: 'professional',
        seats: 5,
        // Interview responses (keyed by question id)
        responses: {},
        // Status
        status: 'draft',
        brainsCreated: false,
        brainsTested: {
            operations: false,
            employee: false,
            branding: false
        }
    });

    // Load saved session on mount
    useEffect(() => {
        const savedSession = localStorage.getItem(AUTOSAVE_KEY);
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                setSessionData(parsed);
                setLastSaved(new Date(parsed.lastModified));
                // Restore transcript data
                if (parsed.savedTranscript) {
                    setFullTranscript(parsed.savedTranscript);
                    fullTranscriptRef.current = parsed.savedTranscript;
                    setLiveTranscript(parsed.savedTranscript);
                }
                if (parsed.currentStep !== undefined) {
                    setCurrentStep(parsed.currentStep);
                }
                console.log('[RESTORE] Session restored with transcript length:', parsed.savedTranscript?.length || 0);
            } catch (e) {
                console.error('Failed to load saved session:', e);
            }
        } else {
            // Initialize new session
            setSessionData(prev => ({
                ...prev,
                sessionId: `session_${Date.now()}`,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            }));
        }
    }, []);

    // Auto-save effect
    const autoSave = useCallback(() => {
        const dataToSave = {
            ...sessionData,
            savedTranscript: fullTranscriptRef.current || fullTranscript || '',
            currentStep,
            lastModified: new Date().toISOString()
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
        setLastSaved(new Date());
        console.log('Auto-saved at', new Date().toLocaleTimeString(), 'transcript:', (fullTranscriptRef.current || '').substring(0, 30));
    }, [sessionData, fullTranscript, currentStep]);

    useEffect(() => {
        autoSaveTimerRef.current = setInterval(autoSave, AUTOSAVE_INTERVAL);
        return () => clearInterval(autoSaveTimerRef.current);
    }, [autoSave]);

    // Also save on any data change (debounced via the interval)
    useEffect(() => {
        const dataToSave = {
            ...sessionData,
            savedTranscript: fullTranscriptRef.current || fullTranscript || '',
            currentStep,
            lastModified: new Date().toISOString()
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
    }, [sessionData, fullTranscript, currentStep]);

    // Recording timer effect
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording, isPaused]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const updateField = (field, value) => {
        setSessionData(prev => ({ ...prev, [field]: value }));
    };

    const updateResponse = (questionId, value) => {
        setSessionData(prev => ({
            ...prev,
            responses: { ...prev.responses, [questionId]: value }
        }));
    };

    // Get industry-specific questions
    const getIndustryQuestions = () => {
        if (!sessionData.industry || !INDUSTRY_QUESTIONS[sessionData.industry]) {
            return [];
        }
        return INDUSTRY_QUESTIONS[sessionData.industry];
    };

    // Export session data to JSON file
    const exportToJSON = () => {
        const exportData = {
            ...sessionData,
            exportedAt: new Date().toISOString(),
            exportVersion: '1.0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionData.companyName || 'onboarding'}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setShowExportSuccess(true);
        setTimeout(() => setShowExportSuccess(false), 3000);
    };


    // Export client profile to downloadable PDF (HTML-based)
    const exportClientPDF = () => {
        if (!sessionData.companyName) {
            showToast('Please enter a company name first.', 'warning', 3000);
            return;
        }

        // Get all question labels for better formatting
        const getAllQuestionLabels = () => {
            const labels = {};
            Object.values(INTERVIEW_SECTIONS).forEach(section => {
                section.questions.forEach(q => {
                    labels[q.id] = q.label;
                });
            });
            return labels;
        };

        const questionLabels = getAllQuestionLabels();

        // Build HTML content for PDF
        let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Client Profile: ${sessionData.companyName}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
        h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
        h2 { color: #1e40af; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .info-item { background: #f3f4f6; padding: 15px; border-radius: 8px; }
        .info-label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; }
        .info-value { font-size: 16px; margin-top: 5px; }
        .response { margin: 15px 0; padding: 15px; background: #fafafa; border-left: 3px solid #3b82f6; }
        .response-question { font-weight: bold; margin-bottom: 8px; }
        .response-answer { white-space: pre-wrap; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #9ca3af; font-size: 12px; }
    </style>
</head>
<body>
    <h1>🏢 Client Profile: ${sessionData.companyName}</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Company Information</h2>
    <div class="info-grid">
        <div class="info-item">
            <div class="info-label">Company Name</div>
            <div class="info-value">${sessionData.companyName || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Industry</div>
            <div class="info-value">${sessionData.industry || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Contact Name</div>
            <div class="info-value">${sessionData.contactName || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Contact Email</div>
            <div class="info-value">${sessionData.contactEmail || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Phone</div>
            <div class="info-value">${sessionData.contactPhone || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Website</div>
            <div class="info-value">${sessionData.website || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Plan</div>
            <div class="info-value">${sessionData.plan || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Seats</div>
            <div class="info-value">${sessionData.seats || 'N/A'}</div>
        </div>
    </div>
    
    <h2>Onboarding Responses</h2>
`;

        // Add all responses
        Object.entries(sessionData.responses || {}).forEach(([questionId, answer]) => {
            if (answer && answer.trim()) {
                const questionLabel = questionLabels[questionId] || questionId;
                html += `
    <div class="response">
        <div class="response-question">${questionLabel}</div>
        <div class="response-answer">${answer}</div>
    </div>
`;
            }
        });

        html += `
    <div class="footer">
        <p>Generated by BAM.ai Onboarding System</p>
        <p>Session ID: ${sessionData.sessionId}</p>
    </div>
</body>
</html>
`;

        // Create downloadable file
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionData.companyName.replace(/[^a-z0-9]/gi, '_')}_Profile.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setShowExportSuccess(true);
        setTimeout(() => setShowExportSuccess(false), 3000);
    };

    // Save to file system (via Electron if available, otherwise download)
    const saveToFile = async () => {
        setSaving(true);

        // First export as JSON download
        exportToJSON();

        // Also save to backend
        try {
            const response = await fetch(`${API_URL}/api/onboarding/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(sessionData)
            });

            if (response.ok) {
                setLastSaved(new Date());
            }
        } catch (error) {
            console.error('Failed to save to backend:', error);
        }

        setSaving(false);
    };

    // Push to Salesforce
    const pushToSalesforce = async () => {
        setSaving(true);
        try {
            const response = await fetch(`${API_URL}/api/onboarding/push-to-salesforce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    companyName: sessionData.companyName,
                    contactName: sessionData.contactName,
                    contactEmail: sessionData.contactEmail,
                    contactPhone: sessionData.contactPhone,
                    website: sessionData.website,
                    industry: sessionData.industry,
                    plan: sessionData.plan,
                    seats: sessionData.seats
                })
            });

            if (response.ok) {
                showToast('Successfully pushed to Salesforce!', 'success', 3000);
            } else {
                showToast('Salesforce push requires SALESFORCE_API_KEY to be configured in backend.', 'warning', 4000);
            }
        } catch (error) {
            console.error('Salesforce push error:', error);
            showToast('Could not connect to Salesforce. Please check your API configuration.', 'error', 4000);
        }
        setSaving(false);
    };

    // Create client in system after delivery
    const createClient = async () => {
        try {
            const response = await fetch(`${API_URL}/api/onboarding/create-client`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    companyName: sessionData.companyName,
                    contactName: sessionData.contactName,
                    contactEmail: sessionData.contactEmail,
                    contactPhone: sessionData.contactPhone,
                    website: sessionData.website,
                    industry: sessionData.industry,
                    plan: sessionData.plan,
                    seats: sessionData.seats,
                    responses: sessionData.responses
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.clientId;
            }
        } catch (error) {
            console.error('Failed to create client:', error);
        }
        return null;
    };

    // Get OpenAI API key from Settings (electron-store) or localStorage fallback
    const [openaiApiKey, setOpenaiApiKey] = useState('');

    // Function to load API key - made reusable so we can call it when settings change
    const loadApiKey = async () => {
        logger.info('INIT', '=== LOADING API KEY ===');
        let key = null;

        // Try electron-store first (Electron app)
        if (window.electronAPI?.apiKeys?.get) {
            logger.info('INIT', 'Trying electron-store...');
            try {
                key = await window.electronAPI.apiKeys.get('openai');
                logger.info('INIT', 'electron-store result', { found: !!key, prefix: key?.substring(0, 10) });
            } catch (err) {
                logger.error('INIT', 'electron-store error', { error: err.message });
            }
        } else {
            logger.warn('INIT', 'window.electronAPI.apiKeys.get not available');
        }

        // Fallback to localStorage (browser/web mode)
        if (!key) {
            logger.info('INIT', 'Trying localStorage fallback...');
            key = localStorage.getItem('openai_api_key');
            logger.info('INIT', 'localStorage result', { found: !!key });
        }

        if (key) {
            setOpenaiApiKey(key);
            setApiKeyError(false);
            logger.success('INIT', 'OpenAI API key loaded', { prefix: key.substring(0, 10) });
        } else {
            setApiKeyError(true);
            logger.error('INIT', 'NO API KEY FOUND - Transcription will not work!');
        }
    };

    // Load API key on mount
    useEffect(() => {
        loadApiKey();
    }, []);

    // Listen for localStorage changes (when key is saved in Settings)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'openai_api_key') {
                logger.info('INIT', 'API key changed in storage, reloading...');
                loadApiKey();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Reload API key when window gains focus (in case user saved in Settings)
    useEffect(() => {
        const handleFocus = () => {
            logger.info('INIT', 'Window focused, checking for API key changes...');
            loadApiKey();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    // Get ALL questions from all sections for smart routing
    // Includes Setup fields AND interview questions
    const getAllQuestions = () => {
        const allQuestions = [];

        // Add Setup section fields (stored directly in sessionData, not in responses)
        const setupFields = [
            { id: 'companyName', label: 'What is the name of the company/corporation?', existingAnswer: sessionData.companyName || '' },
            { id: 'contactName', label: 'What is the primary contact name?', existingAnswer: sessionData.contactName || '' },
            { id: 'contactEmail', label: 'What is the contact email address?', existingAnswer: sessionData.contactEmail || '' },
            { id: 'contactPhone', label: 'What is the contact phone number?', existingAnswer: sessionData.contactPhone || '' },
            { id: 'website', label: 'What is the company website URL?', existingAnswer: sessionData.website || '' },
            { id: 'industry', label: 'What industry is the company in?', existingAnswer: sessionData.industry || '' },
            { id: 'numberOfSeats', label: 'How many user seats or licenses does the client need?', existingAnswer: sessionData.numberOfSeats || '' },
            { id: 'pricingPlan', label: 'Which pricing plan or subscription tier is the client on?', existingAnswer: sessionData.pricingPlan || '' }
        ];
        setupFields.forEach(field => {
            allQuestions.push({
                id: field.id,
                label: field.label,
                section: 'setup',
                existingAnswer: field.existingAnswer,
                isSetupField: true // Flag to identify these need special handling
            });
        });

        // Add interview section questions
        Object.entries(INTERVIEW_SECTIONS).forEach(([sectionKey, section]) => {
            section.questions.forEach(q => {
                allQuestions.push({
                    id: q.id,
                    label: q.label,
                    section: sectionKey,
                    existingAnswer: sessionData.responses[q.id] || '',
                    isSetupField: false
                });
            });
        });

        // Add industry-specific questions
        const industryQs = getIndustryQuestions();
        industryQs.forEach(q => {
            allQuestions.push({
                id: q.id,
                label: q.label,
                section: 'industry',
                existingAnswer: sessionData.responses[q.id] || '',
                isSetupField: false
            });
        });
        return allQuestions;
    };

    // Get ONLY the questions for the current step/tab (for faster voice fill)
    const getCurrentStepQuestions = () => {
        const currentStepId = STEPS[currentStep]?.id;
        const questions = [];

        // If on Setup page, return setup fields
        if (currentStepId === 'company') {
            const setupFields = [
                { id: 'companyName', label: 'What is the name of the company/corporation?', existingAnswer: sessionData.companyName || '' },
                { id: 'contactName', label: 'What is the primary contact name?', existingAnswer: sessionData.contactName || '' },
                { id: 'contactEmail', label: 'What is the contact email address?', existingAnswer: sessionData.contactEmail || '' },
                { id: 'contactPhone', label: 'What is the contact phone number?', existingAnswer: sessionData.contactPhone || '' },
                { id: 'website', label: 'What is the company website URL?', existingAnswer: sessionData.website || '' },
                { id: 'industry', label: 'What industry is the company in?', existingAnswer: sessionData.industry || '' },
                { id: 'numberOfSeats', label: 'How many user seats or licenses does the client need?', existingAnswer: sessionData.numberOfSeats || '' },
                { id: 'pricingPlan', label: 'Which pricing plan or subscription tier is the client on?', existingAnswer: sessionData.pricingPlan || '' }
            ];
            setupFields.forEach(field => {
                questions.push({ ...field, section: 'setup', isSetupField: true });
            });
            return questions;
        }

        // For interview sections, get only that section's questions
        const sectionConfig = INTERVIEW_SECTIONS[currentStepId];
        if (sectionConfig) {
            sectionConfig.questions.forEach(q => {
                questions.push({
                    id: q.id,
                    label: q.label,
                    section: currentStepId,
                    existingAnswer: sessionData.responses[q.id] || '',
                    isSetupField: false
                });
            });
        }

        // If no matching section, return all questions as fallback
        if (questions.length === 0) {
            return getAllQuestions();
        }

        return questions;
    };

    // Send audio chunk to Whisper API for transcription
    const transcribeAudioChunk = async (audioBlob) => {
        logger.info('WHISPER', 'Sending audio to Whisper API', { blobSize: audioBlob.size, blobType: audioBlob.type });
        try {
            // Determine file extension from blob type
            const typeToExt = {
                'audio/webm': 'webm',
                'audio/webm;codecs=opus': 'webm',
                'audio/mp4': 'm4a',
                'audio/ogg': 'ogg',
                'audio/mpeg': 'mp3'
            };
            const ext = typeToExt[audioBlob.type] || 'webm';
            const filename = `audio.${ext}`;

            const formData = new FormData();
            formData.append('audio', audioBlob, filename);

            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            };
            // PREFER localStorage key (most recently saved) over state (may have old cached key)
            const stateKey = openaiApiKey;
            const localStorageKey = localStorage.getItem('openai_api_key');
            // Use localStorage first - it's always updated when user saves in Settings
            const apiKeyToUse = localStorageKey || stateKey;

            console.log('=== API KEY DEBUG ===');
            console.log('State key present:', !!stateKey, stateKey ? `(${stateKey.substring(0, 10)}...)` : '');
            console.log('localStorage key present:', !!localStorageKey, localStorageKey ? `(${localStorageKey.substring(0, 10)}...)` : '');
            console.log('Using key:', apiKeyToUse ? `${apiKeyToUse.substring(0, 10)}...` : 'NONE');
            console.log('Preferred source: localStorage');
            console.log('=====================');

            if (apiKeyToUse) {
                headers['x-openai-key'] = apiKeyToUse;
                logger.info('WHISPER', 'Using API key from:', stateKey ? 'state' : 'localStorage');
            } else {
                console.error('❌ NO API KEY FOUND - Transcription will fail with 503!');
                logger.warn('WHISPER', 'No API key found in state or localStorage');
            }

            // Add 60-second timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            logger.info('WHISPER', 'Calling local backend for transcription...');
            // Use LOCAL backend for Whisper - it has the OpenAI API key
            const localBackendUrl = 'http://localhost:3001/api/transcription/transcribe';
            const response = await retryFetch(localBackendUrl, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal
            }, 3, 2000); // Retry 3 times with 2-second delay
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                logger.success('WHISPER', 'Transcription received', { text: data.text });
                return data.text || '';
            } else {
                const errorData = await response.json().catch(() => ({}));
                logger.error('WHISPER', 'API returned error', { status: response.status, error: errorData });
                // Show detailed error message
                const detailMsg = errorData.details || errorData.error || `Status ${response.status}`;
                console.error('OpenAI Error Details:', errorData);
                setDebugMessage(`❌ ${detailMsg}`);
                return '';
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WHISPER', 'Transcription timed out after 60 seconds');
                setDebugMessage('❌ Transcription timed out - check backend server');
            } else {
                logger.error('WHISPER', 'Transcription failed', { error: error.message });
                setDebugMessage(`❌ Transcription failed: ${error.message}`);
            }
            console.error('Transcription error:', error);
            return '';
        }
    };

    // Smart answer routing - AI determines which questions each answer belongs to
    const processTranscriptSmartRouting = async (transcript) => {
        if (!transcript.trim()) {
            logger.warn('ROUTING', 'Empty transcript, skipping');
            return;
        }

        logger.info('ROUTING', '=== SMART ROUTING START ===', { transcriptLength: transcript.length });
        logger.info('ROUTING', 'Transcript preview', { text: transcript.substring(0, 100) });
        logger.info('ROUTING', 'API key status', { hasKey: !!openaiApiKey, prefix: openaiApiKey?.substring(0, 10) });

        try {
            setIsProcessingAnswer(true);
            setTranscriptionStatus('processing');

            const allQuestions = getCurrentStepQuestions();
            logger.info('ROUTING', 'Processing against questions', { count: allQuestions.length });

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            };
            if (openaiApiKey) {
                headers['x-openai-key'] = openaiApiKey;
            }

            logger.info('ROUTING', 'Calling /api/transcription/process-transcript...');
            const response = await fetch(`${API_URL}/api/transcription/process-transcript`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    transcript,
                    questions: allQuestions,
                    apiKey: openaiApiKey
                })
            });

            logger.info('ROUTING', 'API response received', { status: response.status, ok: response.ok });

            if (response.ok) {
                const data = await response.json();
                logger.info('ROUTING', 'Response data', { answersCount: Object.keys(data.answers || {}).length });

                if (data.answers && Object.keys(data.answers).length > 0) {
                    // Separate Setup fields from interview responses
                    const setupFieldIds = ['companyName', 'contactName', 'contactEmail', 'contactPhone', 'website', 'industry', 'numberOfSeats', 'pricingPlan'];
                    const setupAnswers = {};
                    const responseAnswers = {};

                    console.log('[VOICE-FILL] Raw answers from backend:', data.answers);

                    Object.entries(data.answers).forEach(([id, value]) => {
                        console.log(`[VOICE-FILL] Processing answer: ${id} = "${value}"`);
                        if (setupFieldIds.includes(id)) {
                            setupAnswers[id] = value;
                            console.log(`[VOICE-FILL] Added to setupAnswers: ${id}`);
                        } else {
                            responseAnswers[id] = value;
                            console.log(`[VOICE-FILL] Added to responseAnswers: ${id}`);
                        }
                    });

                    console.log('[VOICE-FILL] Final setupAnswers:', setupAnswers);
                    console.log('[VOICE-FILL] Final responseAnswers:', responseAnswers);

                    // Update sessionData with both Setup fields and responses
                    setSessionData(prev => {
                        const newData = {
                            ...prev,
                            ...setupAnswers, // Setup fields go directly on sessionData
                            responses: { ...prev.responses, ...responseAnswers } // Interview answers go in responses
                        };
                        console.log('[VOICE-FILL] New sessionData (partial):', {
                            companyName: newData.companyName,
                            contactName: newData.contactName,
                            industry: newData.industry
                        });
                        return newData;
                    });

                    logger.success('ROUTING', '=== ANSWERS FILLED ===', {
                        total: Object.keys(data.answers).length,
                        setupFields: Object.keys(setupAnswers),
                        responseFields: Object.keys(responseAnswers)
                    });
                } else {
                    logger.warn('ROUTING', 'No answers returned from GPT');
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                logger.error('ROUTING', 'API returned error', { status: response.status, error: errorData });
            }
        } catch (error) {
            logger.error('ROUTING', 'Smart routing failed', { error: error.message });
            console.error('Smart routing error:', error);
        } finally {
            setIsProcessingAnswer(false);
            setTranscriptionStatus('listening');
            logger.info('ROUTING', '=== SMART ROUTING END ===');
        }
    };

    // Legacy: Extract answer for single focused question (fallback)
    const extractAnswerFromTranscript = async (transcript, questionId, questionLabel, existingAnswer) => {
        if (!transcript.trim() || !questionId) return null;

        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            };
            if (openaiApiKey) {
                headers['x-openai-key'] = openaiApiKey;
            }

            const response = await fetch(`${API_URL}/api/transcription/extract-answer`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    transcript,
                    question: questionLabel,
                    existingAnswer: existingAnswer || '',
                    apiKey: openaiApiKey
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.hasNewContent && data.answer) {
                    return data.answer;
                }
            }
            return null;
        } catch (error) {
            console.error('Answer extraction error:', error);
            return null;
        }
    };

    // Get question label by ID
    const getQuestionLabel = (questionId) => {
        const allSections = Object.values(INTERVIEW_SECTIONS);
        for (const section of allSections) {
            const question = section.questions.find(q => q.id === questionId);
            if (question) return question.label;
        }
        // Check industry questions
        const industryQs = getIndustryQuestions();
        const industryQ = industryQs.find(q => q.id === questionId);
        if (industryQ) return industryQ.label;
        return '';
    };

    // Start audio recording - SIMPLE CONTINUOUS APPROACH
    // Just records audio continuously. Transcription happens ONLY when stopped.
    const startRecording = async () => {
        setDebugMessage('🎤 Starting audio recording...');
        logger.info('AUDIO', '=== STARTING CONTINUOUS RECORDING ===');

        // Check if API key is configured
        if (!openaiApiKey) {
            setDebugMessage('ERROR: No API key configured!');
            logger.error('AUDIO', 'No OpenAI API key configured!');
            setApiKeyError(true);
            // Use toast instead of confirm - confirm steals focus on Windows
            showToast('OpenAI API key required! Redirecting to Settings...', 'warning', 3000);
            setTimeout(() => navigate('/settings'), 1500);
            return;
        }

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });

            streamRef.current = stream;
            logger.success('AUDIO', 'Microphone access granted');

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus' : 'audio/webm';

            // Simple continuous recording - just collect ALL audio
            const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            // Create a Promise that resolves when recording stops
            let resolveStopPromise;
            const stopPromise = new Promise(resolve => {
                resolveStopPromise = resolve;
            });

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    console.log(`[AUDIO] Chunk received: ${event.data.size} bytes, total chunks: ${audioChunksRef.current.length}`);
                }
            };

            // When recorder stops, resolve the promise
            recorder.onstop = () => {
                console.log(`[AUDIO] Recording stopped. Total chunks: ${audioChunksRef.current.length}`);
                resolveStopPromise();
            };

            // Start recording - collect data every second
            recorder.start(1000);

            // Store mimeType and stopPromise for later use in stopRecording
            recordingLoopRef.current = { mimeType, stopPromise };

            isRecordingRef.current = true;
            fullTranscriptRef.current = '';
            setFullTranscript('');
            setLiveTranscript('');
            setIsRecording(true);
            setTranscriptionStatus('recording');
            setDebugMessage('🎙️ RECORDING - Speak freely. Transcript will be generated when you stop.');
            logger.success('AUDIO', 'Continuous recording started');

        } catch (error) {
            logger.error('AUDIO', 'Failed to start:', error.message);
            setDebugMessage('❌ Error: ' + error.message);
            showToast('Failed to start recording: ' + error.message, 'error', 4000);
        }
    };

    // Reference for speech recognition (kept for compatibility)
    const speechRecognitionRef = useRef(null);

    const pauseRecording = () => {
        // MediaRecorder pause/resume
        if (mediaRecorderRef.current && isRecording) {
            if (isPaused) {
                mediaRecorderRef.current.resume();
                setDebugMessage('🎙️ RESUMED - Keep speaking...');
            } else {
                mediaRecorderRef.current.pause();
                setDebugMessage('⏸️ PAUSED - Click again to resume');
            }
            setIsPaused(!isPaused);
        }
    };

    const stopRecording = async () => {
        if (mediaRecorderRef.current || isRecording) {
            isRecordingRef.current = false;

            // IMMEDIATELY update UI so counter stops and buttons change
            setIsRecording(false);
            setIsPaused(false);

            const { mimeType, stopPromise } = recordingLoopRef.current || {};

            // Stop MediaRecorder - this will trigger onstop event
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }

            setDebugMessage('🔄 Waiting for audio data...');

            // Wait for onstop event to fire (ensures all data is collected)
            if (stopPromise) {
                await stopPromise;
            } else {
                // Fallback if no promise
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            console.log(`[AUDIO] Ready to transcribe. Chunks: ${audioChunksRef.current.length}`);
            setDebugMessage('🔄 Transcribing complete audio...');

            // Transcribe ALL collected audio at once
            if (audioChunksRef.current && audioChunksRef.current.length > 0) {
                const mimeType = recordingLoopRef.current?.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const sizeKB = Math.round(audioBlob.size / 1024);
                const sizeMB = (audioBlob.size / (1024 * 1024)).toFixed(1);

                setDebugMessage(`🔄 Transcribing ${sizeMB}MB of audio...`);
                logger.info('WHISPER', `Transcribing complete recording: ${sizeKB}KB`);

                // Set transcription tracking - so saveClientToDatabase can wait
                isTranscribingRef.current = true;
                let resolveTranscription;
                transcriptionPromiseRef.current = new Promise(resolve => {
                    resolveTranscription = resolve;
                });

                // Retry up to 3 times
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const text = await transcribeAudioChunk(audioBlob);
                        if (text && text.trim()) {
                            const transcriptText = text.trim();
                            console.log('[TRANSCRIBE] === SETTING TRANSCRIPT ===');
                            console.log('[TRANSCRIBE] Text length:', transcriptText.length);
                            console.log('[TRANSCRIBE] Text preview:', transcriptText.substring(0, 100));

                            fullTranscriptRef.current = transcriptText;
                            console.log('[TRANSCRIBE] fullTranscriptRef.current NOW:', fullTranscriptRef.current?.substring(0, 50));

                            setFullTranscript(transcriptText);
                            setLiveTranscript(transcriptText);

                            const wordCount = transcriptText.split(' ').length;
                            setDebugMessage(`✅ Transcribed ${wordCount} words`);
                            logger.success('WHISPER', `Complete transcript: ${wordCount} words`);

                            // Process for smart form filling
                            await processTranscriptSmartRouting(text.trim());
                            break;
                        }
                    } catch (err) {
                        logger.error('WHISPER', `Transcription attempt ${attempt} failed: ${err.message}`);
                        if (attempt < 3) {
                            setDebugMessage(`⚠️ Retry ${attempt + 1}/3...`);
                            await new Promise(r => setTimeout(r, 1500));
                        } else {
                            setDebugMessage(`❌ Transcription failed after 3 attempts`);
                        }
                    }
                }

                audioChunksRef.current = [];

                // Mark transcription as complete
                isTranscribingRef.current = false;
                if (resolveTranscription) resolveTranscription();
            } else {
                setDebugMessage('⚠️ No audio recorded');
            }

            mediaRecorderRef.current = null;
            recordingLoopRef.current = null;

            // Stop audio tracks
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            setIsRecording(false);
            setIsPaused(false);
            setTranscriptionStatus('idle');
        }
    };

    // Re-process the full transcript to catch any missed answers
    const reprocessFullTranscript = async () => {
        if (!fullTranscriptRef.current || fullTranscriptRef.current.trim().length < 10) {
            setDebugMessage('⚠️ No transcript to reprocess');
            return;
        }

        logger.info('REPROCESS', 'Re-processing full transcript', { length: fullTranscriptRef.current.length });
        setDebugMessage('🔄 Re-analyzing full transcript for missed answers...');
        setIsProcessingAnswer(true);

        try {
            await processTranscriptSmartRouting(fullTranscriptRef.current);
            setDebugMessage('✅ Full transcript re-processed! Check for any newly filled answers.');
            logger.success('REPROCESS', 'Full transcript reprocessed successfully');
        } catch (error) {
            setDebugMessage('❌ Error reprocessing: ' + error.message);
            logger.error('REPROCESS', 'Failed to reprocess', { error: error.message });
        } finally {
            setIsProcessingAnswer(false);
        }
    };

    // Save client to database after completing onboarding
    const [isSavingClient, setIsSavingClient] = useState(false);
    const [clientSaved, setClientSaved] = useState(false);

    const saveClientToDatabase = async () => {
        console.log('[SAVE] === SAVE STARTED ===');
        console.log('[SAVE] isRecording state:', isRecording);
        console.log('[SAVE] isRecordingRef.current:', isRecordingRef.current);
        console.log('[SAVE] isTranscribingRef.current:', isTranscribingRef.current);
        console.log('[SAVE] mediaRecorderRef.current:', !!mediaRecorderRef.current);

        setIsSavingClient(true);

        // If recording is in progress (check REF, not state), stop it and wait for final transcription
        if (isRecordingRef.current || isRecording || mediaRecorderRef.current) {
            console.log('[SAVE] Recording detected - stopping and transcribing...');
            setDebugMessage('⏳ Stopping recording and transcribing...');
            try {
                await stopRecording(); // MUST await - stopRecording does transcription
                console.log('[SAVE] stopRecording completed');
            } catch (err) {
                console.error('[SAVE] stopRecording failed:', err);
                setDebugMessage('⚠️ Transcription failed, saving without transcript...');
            }
        }

        // If transcription is in progress (even if recording already stopped), wait for it
        if (isTranscribingRef.current && transcriptionPromiseRef.current) {
            console.log('[SAVE] Transcription in progress - waiting...');
            setDebugMessage('⏳ Waiting for transcription to complete...');
            try {
                await Promise.race([
                    transcriptionPromiseRef.current,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Transcription timeout')), 15000))
                ]);
                console.log('[SAVE] Transcription promise resolved');
            } catch (err) {
                console.log('[SAVE] Transcription wait failed:', err.message);
                setDebugMessage('⚠️ Transcription timed out, saving anyway...');
            }
        }

        // Quick poll for transcript (max 5 seconds instead of 30)
        let waitCount = 0;
        const maxWait = 10; // 10 * 500ms = 5 seconds
        while (!fullTranscriptRef.current && waitCount < maxWait) {
            // Check if there might be transcription happening
            if (isTranscribingRef.current || audioChunksRef.current?.length > 0) {
                console.log(`[SAVE] Waiting for transcript... attempt ${waitCount + 1}`);
                setDebugMessage(`⏳ Transcribing... (${Math.round(waitCount * 0.5)}s)`);
                await new Promise(resolve => setTimeout(resolve, 500));
                waitCount++;
            } else {
                break; // No transcription activity, no point waiting
            }
        }

        // Extra buffer for state updates
        await new Promise(resolve => setTimeout(resolve, 300));

        // Get the final transcript from ref (most up-to-date)
        const finalTranscript = fullTranscriptRef.current || fullTranscript || '';
        console.log('[SAVE] ========== SENDING TO BACKEND ==========');
        console.log('[SAVE] fullTranscriptRef.current:', fullTranscriptRef.current?.substring(0, 50) || 'EMPTY');
        console.log('[SAVE] fullTranscript state:', fullTranscript?.substring(0, 50) || 'EMPTY');
        console.log('[SAVE] finalTranscript to send:', finalTranscript?.substring(0, 50) || 'EMPTY');
        console.log('[SAVE] finalTranscript length:', finalTranscript.length);

        const payload = {
            companyName: sessionData.companyName,
            contactName: sessionData.contactName,
            contactEmail: sessionData.contactEmail,
            contactPhone: sessionData.contactPhone,
            website: sessionData.website,
            industry: sessionData.industry,
            numberOfSeats: sessionData.numberOfSeats,
            pricingPlan: sessionData.pricingPlan,
            responses: sessionData.responses,
            transcript: finalTranscript // Include full interview transcript
        };
        console.log('[SAVE] Payload transcript length:', payload.transcript.length);
        console.log('[SAVE] API_URL:', API_URL);
        console.log('[SAVE] Full URL:', `${API_URL}/api/clients/from-onboarding`);
        console.log('[SAVE] Payload companyName:', payload.companyName);

        try {
            setDebugMessage(`📡 Calling API: ${API_URL}/api/clients/from-onboarding`);
            console.log('[SAVE] Making fetch request...');

            const response = await retryFetch(`${API_URL}/api/clients/from-onboarding`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }, 3, 2000); // Retry 3 times with 2-second delay

            console.log('[SAVE] Response status:', response.status);
            console.log('[SAVE] Response ok:', response.ok);

            const data = await response.json();
            console.log('[SAVE] Response data:', JSON.stringify(data).substring(0, 200));

            if (response.ok && data.success) {
                setClientSaved(true);
                const transcriptMsg = data.hasTranscript ? ' (with transcript)' : '';
                setDebugMessage(`✅ Client "${sessionData.companyName}" saved to database${transcriptMsg}!`);

                // Use toast instead of alert - alert blocks focus on Windows
                showToast(`🎉 Client "${sessionData.companyName}" created successfully!${transcriptMsg}`, 'success', 5000);

                // Clear local autosave since we've saved to DB
                localStorage.removeItem(AUTOSAVE_KEY);
            } else {
                console.error('[SAVE] API returned error:', data);
                throw new Error(data.error || 'Failed to save client');
            }
        } catch (error) {
            console.error('[SAVE] Save client error:', error);
            console.error('[SAVE] Error name:', error.name);
            console.error('[SAVE] Error message:', error.message);
            // Use toast instead of alert - alert blocks focus on Windows
            showToast('Error saving client: ' + error.message, 'error', 5000);
            setDebugMessage('❌ Error saving client: ' + error.message);
        } finally {
            setIsSavingClient(false);

            // CRITICAL: Force focus back to document after save completes
            // This ensures inputs remain clickable on Windows
            setTimeout(() => {
                document.body.focus();
            }, 100);
        }
    };

    // Handle question focus for transcription targeting
    const handleQuestionFocus = (questionId) => {
        setFocusedQuestion(questionId);
        // Process any pending transcript for this question
        if (transcriptBuffer && isRecording) {
            const questionLabel = getQuestionLabel(questionId);
            const existingAnswer = sessionData.responses[questionId] || '';
            extractAnswerFromTranscript(transcriptBuffer, questionId, questionLabel, existingAnswer)
                .then(newAnswer => {
                    if (newAnswer && newAnswer !== existingAnswer) {
                        updateResponse(questionId, newAnswer);
                    }
                    setTranscriptBuffer('');
                });
        }
    };

    // Calculate completion percentage for current section
    const getSectionCompletion = (sectionKey) => {
        const section = INTERVIEW_SECTIONS[sectionKey];
        if (!section) return { filled: 0, total: 0, percent: 0 };

        const total = section.questions.length;
        const filled = section.questions.filter(q =>
            sessionData.responses[q.id] && sessionData.responses[q.id].trim().length > 0
        ).length;

        return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 };
    };

    // Check if current step/section is complete
    const isCurrentSectionComplete = () => {
        const currentStepId = STEPS[currentStep]?.id;
        if (!currentStepId || currentStepId === 'company' || currentStepId === 'review' || currentStepId === 'deliver') {
            return true; // Non-question sections
        }
        const completion = getSectionCompletion(currentStepId);
        return completion.percent === 100;
    };

    // Get total completion across all sections
    const getTotalCompletion = () => {
        let totalFilled = 0;
        let totalQuestions = 0;

        Object.keys(INTERVIEW_SECTIONS).forEach(key => {
            const completion = getSectionCompletion(key);
            totalFilled += completion.filled;
            totalQuestions += completion.total;
        });

        // Add industry-specific questions if applicable
        const industryQs = getIndustryQuestions();
        totalQuestions += industryQs.length;
        totalFilled += industryQs.filter(q =>
            sessionData.responses[q.id] && sessionData.responses[q.id].trim().length > 0
        ).length;

        return {
            filled: totalFilled,
            total: totalQuestions,
            percent: totalQuestions > 0 ? Math.round((totalFilled / totalQuestions) * 100) : 0
        };
    };

    // Handle transcript file upload - APPENDS to existing transcript
    const handleTranscriptUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            setUploadedTranscript(text);

            // APPEND to existing transcript (don't replace)
            const separator = fullTranscriptRef.current ? '\n\n--- Uploaded Transcript ---\n\n' : '';
            const newTranscript = (fullTranscriptRef.current || '') + separator + text;

            fullTranscriptRef.current = newTranscript;
            setFullTranscript(newTranscript);

            console.log('[TRANSCRIPT] Appended uploaded transcript. Total length:', newTranscript.length);
        };
        reader.readAsText(file);
    };

    // Simple add to customer file (no AI processing)
    const addToCustomerFile = async () => {
        if (!uploadedTranscript) {
            showToast('No transcript to add.', 'warning', 3000);
            return;
        }

        // If client hasn't been saved yet, append to fullTranscriptRef (will be saved on Complete & Save)
        if (!sessionData.clientId) {
            // Append to existing transcript
            const separator = fullTranscriptRef.current ? '\n\n--- Uploaded Transcript ---\n\n' : '';
            const newTranscript = (fullTranscriptRef.current || '') + separator + uploadedTranscript;
            fullTranscriptRef.current = newTranscript;
            setFullTranscript(newTranscript);
            setShowTranscriptUpload(false);
            setUploadedTranscript('');
            showToast('✅ Transcript added! It will be saved when you click Complete & Save.', 'success', 3000);
            console.log('[TRANSCRIPT] Appended to pending transcript. Total length:', newTranscript.length);
            return;
        }

        // Client already saved - call API to add transcript to knowledge base
        try {
            const response = await retryFetch(`${API_URL}/api/clients/${sessionData.clientId}/transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: uploadedTranscript,
                    title: `${sessionData.companyName} - Uploaded Transcript`,
                    source: 'onboarding_upload'
                })
            }, 3, 2000);

            const data = await response.json();

            if (response.ok && data.success) {
                // Also append to fullTranscriptRef for display
                const separator = fullTranscriptRef.current ? '\n\n--- Uploaded Transcript ---\n\n' : '';
                fullTranscriptRef.current = (fullTranscriptRef.current || '') + separator + uploadedTranscript;
                setFullTranscript(fullTranscriptRef.current);

                setShowTranscriptUpload(false);
                setUploadedTranscript('');
                showToast(`✅ Transcript added to ${sessionData.companyName}'s knowledge base!`, 'success', 3000);
                console.log('[TRANSCRIPT] Saved to knowledge base. ID:', data.transcriptId);
            } else {
                throw new Error(data.error || 'Failed to save transcript');
            }
        } catch (error) {
            console.error('Add transcript error:', error);
            showToast('Failed to add transcript: ' + error.message, 'error', 4000);
        }
    };

    // Process transcript with AI
    const processTranscriptWithAI = async () => {
        if (!uploadedTranscript && !liveTranscript) {
            showToast('No transcript available to process.', 'warning', 3000);
            return;
        }

        setProcessingTranscript(true);
        const transcript = uploadedTranscript || liveTranscript;

        // Get all questions including industry-specific ones
        const allQuestions = [
            ...Object.values(INTERVIEW_SECTIONS).flatMap(section =>
                section.questions.map(q => ({ id: q.id, label: q.label }))
            ),
            ...getIndustryQuestions().map(q => ({ id: q.id, label: q.label }))
        ];

        try {
            const response = await fetch(`${API_URL}/api/onboarding/parse-transcript`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ transcript, questions: allQuestions })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.answers) {
                    setSessionData(prev => ({
                        ...prev,
                        responses: { ...prev.responses, ...data.answers }
                    }));
                }
                showToast('Transcript processed! Answers auto-filled. Please review.', 'success', 4000);
            } else {
                showToast('Could not process transcript. Please check your API configuration.', 'error', 4000);
            }
        } catch (error) {
            console.error('Error processing transcript:', error);
            showToast('Error processing transcript. Please try again.', 'error', 4000);
        }

        setProcessingTranscript(false);
        setShowTranscriptUpload(false);
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleCreateBrains = async () => {
        setSaving(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        setSessionData(prev => ({ ...prev, brainsCreated: true, status: 'ingested' }));
        setSaving(false);
    };

    const handleTestBrain = (brainType) => {
        setSessionData(prev => ({
            ...prev,
            brainsTested: { ...prev.brainsTested, [brainType]: true }
        }));
    };

    const handleDeliver = async () => {
        setSaving(true);

        // Create the client in the system
        const clientId = await createClient();

        // Try to push to Salesforce
        try {
            await pushToSalesforce();
        } catch (e) {
            console.log('Salesforce push skipped:', e);
        }

        // Clear the autosave since we're done
        localStorage.removeItem(AUTOSAVE_KEY);

        setSessionData(prev => ({
            ...prev,
            status: 'delivered',
            clientId
        }));
        setSaving(false);
    };

    const handleNewSession = () => {
        // REMOVED window.confirm() - it steals focus on Windows and breaks input clicking
        // Just reset the session directly - autosave means nothing is lost anyway
        localStorage.removeItem(AUTOSAVE_KEY);
        setSessionData({
            sessionId: `session_${Date.now()}`,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            companyName: '',
            contactName: '',
            contactEmail: '',
            contactPhone: '',
            website: '',
            industry: '',
            plan: 'professional',
            seats: 5,
            responses: {},
            status: 'draft',
            brainsCreated: false,
            brainsTested: { operations: false, employee: false, branding: false }
        });
        setCurrentStep(0);
        setLastSaved(null);

        // COMPREHENSIVE STATE RESET - ensure all UI is interactive
        setClientSaved(false);
        setIsSavingClient(false);
        setIsProcessingAnswer(false); // Reset this to unblock inputs
        setIsRecording(false);
        setIsPaused(false);
        setTranscriptionStatus('idle');
        setDebugMessage('');
        setFullTranscript('');
        setLiveTranscript('');

        // Clear refs too
        fullTranscriptRef.current = '';
        audioChunksRef.current = [];
        isRecordingRef.current = false;
        isTranscribingRef.current = false;

        // CRITICAL: Force focus back to document after any state changes
        // This ensures inputs are clickable on Windows
        setTimeout(() => {
            document.body.focus();
            // Also try to focus the first input on the page
            const firstInput = document.querySelector('input:not([disabled]), textarea:not([disabled])');
            if (firstInput) {
                firstInput.blur(); // Blur then available to click
            }
        }, 100);

        showToast('🔄 New session started!', 'info', 2000);
    };

    const allBrainsTested = Object.values(sessionData.brainsTested).every(Boolean);

    // Audio controls component
    const renderAudioControls = () => (
        <div className="audio-controls-bar">
            {/* Debug Message Banner */}
            {debugMessage && (
                <div className="debug-message-banner">
                    <span>🔍 DEBUG: {debugMessage}</span>
                </div>
            )}
            {/* API Key Error Banner */}
            {apiKeyError && (
                <div className="api-key-error-banner" onClick={() => navigate('/settings')}>
                    <AlertCircle size={18} />
                    <span>OpenAI API key required for transcription. Click to go to Settings.</span>
                </div>
            )}
            <div className="audio-controls-left">
                {!isRecording ? (
                    <button className="btn btn-record" onClick={startRecording}>
                        <Mic size={18} />
                        Start Capturing Audio
                    </button>
                ) : (
                    <>
                        <button
                            className={`btn ${isPaused ? 'btn-secondary' : 'btn-warning'}`}
                            onClick={pauseRecording}
                        >
                            {isPaused ? <Play size={18} /> : <Pause size={18} />}
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button className="btn btn-error" onClick={stopRecording}>
                            <Square size={18} />
                            Stop
                        </button>
                        {fullTranscript && fullTranscript.length > 20 && (
                            <button
                                className="btn btn-info"
                                onClick={reprocessFullTranscript}
                                disabled={isProcessingAnswer}
                                title="Re-analyze full transcript for missed answers"
                            >
                                🔄 Re-process
                            </button>
                        )}
                        <div className="recording-indicator">
                            <span className={`recording-dot ${isPaused ? 'paused' : ''}`}></span>
                            <span className="recording-time">{formatTime(recordingTime)}</span>
                        </div>
                    </>
                )}
            </div>
            <div className="audio-controls-center">
                {lastSaved && (
                    <span className="autosave-indicator">
                        <CheckCircle size={14} />
                        Auto-saved {lastSaved.toLocaleTimeString()}
                    </span>
                )}
            </div>
            <div className="audio-controls-right">
                <button className="btn btn-ghost" onClick={() => setShowTranscriptUpload(true)}>
                    <Upload size={18} />
                    Upload Transcript
                </button>
                <button className="btn btn-ghost" onClick={exportToJSON}>
                    <Download size={18} />
                    Export JSON
                </button>
                <button
                    className={`btn ${clientSaved ? 'btn-success' : 'btn-primary'}`}
                    onClick={saveClientToDatabase}
                    disabled={isSavingClient || clientSaved}
                    title="Save client to database"
                >
                    {isSavingClient ? (
                        <>Saving...</>
                    ) : clientSaved ? (
                        <>✓ Client Saved</>
                    ) : (
                        <>💾 Complete & Save Client</>
                    )}
                </button>
            </div>
        </div>
    );

    // Transcript upload modal
    const renderTranscriptUploadModal = () => (
        <div className="modal-overlay" onClick={() => setShowTranscriptUpload(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3><FileText size={24} /> Upload Call Transcript</h3>
                <p>Upload a transcript from your Zoom call, Fyxer, Otter.ai, or any other recording service. Our AI will analyze it and auto-fill the answers.</p>

                <div className="upload-area">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".txt,.vtt,.srt,.md"
                        onChange={handleTranscriptUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-secondary btn-lg"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={20} />
                        Choose File
                    </button>
                    <span className="file-types">Supports: .txt, .vtt, .srt, .md</span>
                </div>

                {uploadedTranscript && (
                    <div className="transcript-preview">
                        <h4>Preview:</h4>
                        <pre>{uploadedTranscript.substring(0, 500)}...</pre>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={() => setShowTranscriptUpload(false)}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={addToCustomerFile}
                        disabled={!uploadedTranscript}
                    >
                        📄 Add to Customer File
                    </button>
                </div>
            </div>
        </div>
    );

    const renderCompanySetup = () => (
        <div className="onboarding-section">
            <div className="section-header">
                <Building2 size={24} />
                <div>
                    <h2>Company Setup</h2>
                    <p>Enter the client's basic information and collect necessary credentials</p>
                </div>
            </div>

            <div className="form-grid two-columns">
                <div className="form-group">
                    <label>Company Name *</label>
                    <input
                        type="text"
                        value={sessionData.companyName}
                        onChange={(e) => updateField('companyName', e.target.value)}
                        placeholder="Acme Corporation"
                    />
                </div>

                <div className="form-group">
                    <label>Industry *</label>
                    <select
                        value={sessionData.industry}
                        onChange={(e) => updateField('industry', e.target.value)}
                    >
                        {INDUSTRY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Primary Contact Name *</label>
                    <input
                        type="text"
                        value={sessionData.contactName}
                        onChange={(e) => updateField('contactName', e.target.value)}
                        placeholder="John Smith"
                    />
                </div>

                <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                        type="tel"
                        value={sessionData.contactPhone}
                        onChange={(e) => updateField('contactPhone', e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                </div>

                <div className="form-group">
                    <label>Contact Email *</label>
                    <input
                        type="email"
                        value={sessionData.contactEmail}
                        onChange={(e) => updateField('contactEmail', e.target.value)}
                        placeholder="john@acme.com"
                    />
                </div>

                <div className="form-group">
                    <label>Website</label>
                    <input
                        type="url"
                        value={sessionData.website}
                        onChange={(e) => updateField('website', e.target.value)}
                        placeholder="https://www.acme.com"
                    />
                </div>

                <div className="form-group">
                    <label>Plan</label>
                    <select
                        value={sessionData.plan}
                        onChange={(e) => updateField('plan', e.target.value)}
                    >
                        <option value="starter">Starter - $19.99/seat/mo</option>
                        <option value="professional">Professional - $29.99/seat/mo</option>
                        <option value="enterprise">Enterprise - $49.99/seat/mo</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Number of Seats</label>
                    <input
                        type="number"
                        min="1"
                        max="100"
                        value={sessionData.seats}
                        onChange={(e) => updateField('seats', parseInt(e.target.value))}
                    />
                </div>
            </div>

            {/* Pricing note */}
            <div className="pricing-note">
                <Sparkles size={16} />
                <span>
                    Pricing is per seat per month. Total: ${(sessionData.seats * (sessionData.plan === 'starter' ? 19.99 : sessionData.plan === 'professional' ? 29.99 : 49.99)).toFixed(2)}/mo
                </span>
            </div>

            {/* Industry-specific message */}
            {sessionData.industry && INDUSTRY_QUESTIONS[sessionData.industry] && (
                <div className="industry-notice">
                    <Sparkles size={16} />
                    <span>
                        Great! We've detected {INDUSTRY_OPTIONS.find(o => o.value === sessionData.industry)?.label} industry.
                        We'll ask {INDUSTRY_QUESTIONS[sessionData.industry].length} additional tailored questions in the Technology section.
                    </span>
                </div>
            )}
        </div>
    );

    const renderInterviewSection = (sectionKey) => {
        const section = INTERVIEW_SECTIONS[sectionKey];
        const Icon = section.icon;
        const completion = getSectionCompletion(sectionKey);

        // Add industry-specific questions if in technology section
        let questions = [...section.questions];
        if (sectionKey === 'technology' && sessionData.industry) {
            const industryQs = getIndustryQuestions();
            if (industryQs.length > 0) {
                questions = [...questions, ...industryQs];
            }
        }

        return (
            <div className="onboarding-section">
                <div className="section-header">
                    <Icon size={24} />
                    <div>
                        <h2>{section.title}</h2>
                        <p>{section.description}</p>
                    </div>
                </div>

                {isRecording && (
                    <div className="transcription-status-bar">
                        <div className={`status-indicator ${transcriptionStatus}`}>
                            <span className="status-dot"></span>
                            {transcriptionStatus === 'listening' && 'Listening...'}
                            {transcriptionStatus === 'processing' && 'Processing answer...'}
                            {transcriptionStatus === 'idle' && 'Paused'}
                        </div>
                        {focusedQuestion && (
                            <span className="focused-question-hint">
                                Click a question to target transcription
                            </span>
                        )}
                        {liveTranscript && (
                            <div className="live-transcript-preview">
                                "{liveTranscript.slice(-100)}..."
                            </div>
                        )}
                    </div>
                )}

                <div className="interview-questions">
                    {questions.map((question, index) => (
                        <div
                            key={question.id}
                            className={`question-card ${focusedQuestion === question.id ? 'focused' : ''} ${sessionData.responses[question.id] ? 'answered' : ''}`}
                        >
                            <div className="question-number">
                                {index + 1}
                            </div>
                            <input
                                type="checkbox"
                                className="question-checkbox"
                                checked={!!(sessionData.checkedQuestions?.[question.id] || sessionData.responses[question.id])}
                                onChange={(e) => setSessionData(prev => ({
                                    ...prev,
                                    checkedQuestions: {
                                        ...prev.checkedQuestions,
                                        [question.id]: e.target.checked
                                    }
                                }))}
                                title="Mark as answered"
                            />
                            <div className="question-content">
                                <label>{question.label}</label>
                                {question.type === 'textarea' && (
                                    <div className="textarea-wrapper">
                                        <textarea
                                            value={sessionData.responses[question.id] || ''}
                                            onChange={(e) => updateResponse(question.id, e.target.value)}
                                            onFocus={() => handleQuestionFocus(question.id)}
                                            placeholder="Type here..."
                                            rows={4}
                                            className={focusedQuestion === question.id && isRecording ? 'listening' : ''}
                                        />
                                        {focusedQuestion === question.id && isRecording && isProcessingAnswer && (
                                            <div className="processing-indicator">
                                                <Loader2 size={16} className="spin" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {question.type === 'text' && (
                                    <input
                                        type="text"
                                        value={sessionData.responses[question.id] || ''}
                                        onChange={(e) => updateResponse(question.id, e.target.value)}
                                        onFocus={() => handleQuestionFocus(question.id)}
                                        placeholder={isRecording ? "Speak or type..." : "Enter response..."}
                                        className={focusedQuestion === question.id && isRecording ? 'listening' : ''}
                                    />
                                )}
                                {question.type === 'scale' && (
                                    <div className="scale-input">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                            <button
                                                key={num}
                                                className={`scale-btn ${sessionData.responses[question.id] === num ? 'active' : ''}`}
                                                onClick={() => updateResponse(question.id, num)}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderReview = () => {
        const allQuestions = [
            ...Object.values(INTERVIEW_SECTIONS).flatMap(s => s.questions),
            ...getIndustryQuestions()
        ];
        const totalQuestions = allQuestions.length;
        const answeredQuestions = Object.keys(sessionData.responses).filter(
            key => sessionData.responses[key] && sessionData.responses[key].toString().trim()
        ).length;
        const completionPercent = Math.round((answeredQuestions / totalQuestions) * 100);

        return (
            <div className="onboarding-section">
                <div className="section-header">
                    <CheckCircle size={24} />
                    <div>
                        <h2>Review & Create Brains</h2>
                        <p>Review the collected information and create the three AI brains</p>
                    </div>
                </div>

                <div className="review-summary">
                    <div className="review-card company-review">
                        <h3>Company Information</h3>
                        <div className="review-grid">
                            <div className="review-item">
                                <span>Company:</span>
                                <strong>{sessionData.companyName || 'Not set'}</strong>
                            </div>
                            <div className="review-item">
                                <span>Industry:</span>
                                <strong>{INDUSTRY_OPTIONS.find(o => o.value === sessionData.industry)?.label || 'Not set'}</strong>
                            </div>
                            <div className="review-item">
                                <span>Contact:</span>
                                <strong>{sessionData.contactName || 'Not set'}</strong>
                            </div>
                            <div className="review-item">
                                <span>Email:</span>
                                <strong>{sessionData.contactEmail || 'Not set'}</strong>
                            </div>
                            <div className="review-item">
                                <span>Phone:</span>
                                <strong>{sessionData.contactPhone || 'Not set'}</strong>
                            </div>
                            <div className="review-item">
                                <span>Plan:</span>
                                <strong className="capitalize">{sessionData.plan}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="review-card completion-review">
                        <h3>Interview Completion</h3>
                        <div className="completion-bar">
                            <div className="completion-fill" style={{ width: `${completionPercent}%` }}></div>
                        </div>
                        <p>{answeredQuestions} of {totalQuestions} questions answered ({completionPercent}%)</p>
                    </div>

                    <div className="brains-preview">
                        <h3>Brains to Create</h3>
                        <div className="brain-cards">
                            <div className="brain-card">
                                <Briefcase size={32} />
                                <h4>Operations Brain</h4>
                                <p>Processes, FAQs, workflows</p>
                            </div>
                            <div className="brain-card">
                                <Heart size={32} />
                                <h4>Employee Brain</h4>
                                <p>Hiring, culture, values</p>
                            </div>
                            <div className="brain-card">
                                <Palette size={32} />
                                <h4>Branding Brain</h4>
                                <p>Marketing, sales, voice</p>
                            </div>
                        </div>
                    </div>

                    <div className="review-actions">
                        <button className="btn btn-secondary" onClick={exportToJSON}>
                            <Download size={18} />
                            Export Data as JSON
                        </button>
                        <button className="btn btn-secondary" onClick={saveToFile}>
                            <Save size={18} />
                            Save to File
                        </button>
                    </div>

                    {!sessionData.brainsCreated ? (
                        <button
                            className="btn btn-primary btn-lg create-brains-btn"
                            onClick={handleCreateBrains}
                            disabled={saving || !sessionData.companyName}
                        >
                            {saving ? <Loader2 size={20} className="spin" /> : <Sparkles size={20} />}
                            {saving ? 'Creating Brains...' : 'Create All Three Brains'}
                        </button>
                    ) : (
                        <div className="brains-created-banner">
                            <CheckCircle size={24} />
                            <span>All brains created successfully! Proceed to testing.</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTestDeliver = () => (
        <div className="onboarding-section">
            <div className="section-header">
                <Send size={24} />
                <div>
                    <h2>Test & Deliver</h2>
                    <p>Test each brain to verify it works correctly, then deliver to the client</p>
                </div>
            </div>

            <div className="delivery-status">
                <div className={`status-step ${sessionData.status !== 'draft' ? 'complete' : 'current'}`}>
                    <div className="status-icon">
                        <CheckCircle size={20} />
                    </div>
                    <span>Ingested</span>
                </div>
                <div className="status-line"></div>
                <div className={`status-step ${allBrainsTested ? 'complete' : sessionData.brainsCreated ? 'current' : ''}`}>
                    <div className="status-icon">
                        <Play size={20} />
                    </div>
                    <span>Tested</span>
                </div>
                <div className="status-line"></div>
                <div className={`status-step ${sessionData.status === 'delivered' ? 'complete' : allBrainsTested ? 'current' : ''}`}>
                    <div className="status-icon">
                        <Send size={20} />
                    </div>
                    <span>Delivered</span>
                </div>
            </div>

            <div className="test-brains">
                <h3>Test Each Brain</h3>
                <p>Open each brain and verify it responds correctly with the client's information.</p>

                <div className="test-brain-cards">
                    <div className={`test-brain-card ${sessionData.brainsTested.operations ? 'tested' : ''}`}>
                        <Briefcase size={28} />
                        <h4>Operations Brain</h4>
                        <p>Test with: "How do I process a refund?"</p>
                        <div className="test-actions">
                            <button className="btn btn-secondary btn-sm">
                                <Play size={16} /> Test Brain
                            </button>
                            <button
                                className={`btn btn-sm ${sessionData.brainsTested.operations ? 'btn-success' : 'btn-ghost'}`}
                                onClick={() => handleTestBrain('operations')}
                            >
                                <CheckCircle size={16} />
                                {sessionData.brainsTested.operations ? 'Verified' : 'Mark Tested'}
                            </button>
                        </div>
                    </div>

                    <div className={`test-brain-card ${sessionData.brainsTested.employee ? 'tested' : ''}`}>
                        <Heart size={28} />
                        <h4>Employee Brain</h4>
                        <p>Test with: "What are the core values?"</p>
                        <div className="test-actions">
                            <button className="btn btn-secondary btn-sm">
                                <Play size={16} /> Test Brain
                            </button>
                            <button
                                className={`btn btn-sm ${sessionData.brainsTested.employee ? 'btn-success' : 'btn-ghost'}`}
                                onClick={() => handleTestBrain('employee')}
                            >
                                <CheckCircle size={16} />
                                {sessionData.brainsTested.employee ? 'Verified' : 'Mark Tested'}
                            </button>
                        </div>
                    </div>

                    <div className={`test-brain-card ${sessionData.brainsTested.branding ? 'tested' : ''}`}>
                        <Palette size={28} />
                        <h4>Branding Brain</h4>
                        <p>Test with: "Write a marketing email"</p>
                        <div className="test-actions">
                            <button className="btn btn-secondary btn-sm">
                                <Play size={16} /> Test Brain
                            </button>
                            <button
                                className={`btn btn-sm ${sessionData.brainsTested.branding ? 'btn-success' : 'btn-ghost'}`}
                                onClick={() => handleTestBrain('branding')}
                            >
                                <CheckCircle size={16} />
                                {sessionData.brainsTested.branding ? 'Verified' : 'Mark Tested'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {allBrainsTested && sessionData.status !== 'delivered' && (
                <div className="deliver-section">
                    <h3>Ready to Deliver!</h3>
                    <p>
                        All brains have been tested. Click below to:
                    </p>
                    <ul className="deliver-checklist">
                        <li><CheckCircle size={14} /> Create client account in BAM.ai</li>
                        <li><CheckCircle size={14} /> Add to Salesforce (if configured)</li>
                        <li><CheckCircle size={14} /> Notify {sessionData.contactName || 'the client'} at {sessionData.contactEmail || 'their email'}</li>
                    </ul>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleDeliver}
                        disabled={saving}
                    >
                        {saving ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                        {saving ? 'Delivering...' : 'Deliver to Client'}
                    </button>
                </div>
            )}

            {sessionData.status === 'delivered' && (
                <div className="delivered-banner">
                    <CheckCircle size={32} />
                    <div>
                        <h3>Successfully Delivered! 🎉</h3>
                        <p>
                            {sessionData.companyName} has been added to the client list and can now access their BAM Brains.
                        </p>
                        <div className="delivered-actions">
                            <button className="btn btn-secondary" onClick={exportToJSON}>
                                <Download size={16} /> Export Final Data
                            </button>
                            <button className="btn btn-primary" onClick={handleNewSession}>
                                <Sparkles size={16} /> Start New Onboarding
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderStepContent = () => {
        switch (STEPS[currentStep].id) {
            case 'company':
                return renderCompanySetup();
            case 'businessFundamentals':
                return renderInterviewSection('businessFundamentals');
            case 'customerInteractions':
                return renderInterviewSection('customerInteractions');
            case 'internalProcesses':
                return renderInterviewSection('internalProcesses');
            case 'salesPositioning':
                return renderInterviewSection('salesPositioning');
            case 'edgeCases':
                return renderInterviewSection('edgeCases');
            case 'contentKnowledge':
                return renderInterviewSection('contentKnowledge');
            case 'successMetrics':
                return renderInterviewSection('successMetrics');
            case 'review':
                return renderReview();
            case 'deliver':
                return renderTestDeliver();
            default:
                return null;
        }
    };

    return (
        <div className="onboarding-wizard">
            {/* Header */}
            <div className="onboarding-header">
                <button className="btn btn-ghost" onClick={() => navigate('/admin')}>
                    <ArrowLeft size={18} />
                    Back to Admin
                </button>
                <div className="session-info">
                    {sessionData.companyName && (
                        <span className="company-badge">
                            <Building2 size={16} />
                            {sessionData.companyName}
                        </span>
                    )}
                    <span className={`status-badge status-${sessionData.status}`}>
                        {sessionData.status}
                    </span>
                </div>
                <div className="header-actions">
                    <button className="btn btn-ghost" onClick={handleNewSession}>
                        New Session
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={saveToFile}
                        disabled={saving}
                    >
                        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        Save
                    </button>
                </div>
            </div>

            {/* Audio Controls */}
            {renderAudioControls()}

            {/* Progress Stepper */}
            <div className="progress-stepper">
                {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === currentStep;
                    const isComplete = index < currentStep;

                    return (
                        <React.Fragment key={step.id}>
                            <button
                                className={`step-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                                onClick={() => setCurrentStep(index)}
                            >
                                <div className="step-icon">
                                    {isComplete ? <CheckCircle size={18} /> : <Icon size={18} />}
                                </div>
                                <span className="step-label">{step.label}</span>
                            </button>
                            {index < STEPS.length - 1 && <div className="step-connector"></div>}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Step Content */}
            <div className="step-content">
                {renderStepContent()}
            </div>

            {/* Navigation */}
            <div className="step-navigation">
                <button
                    className="btn btn-ghost"
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                >
                    <ChevronLeft size={18} />
                    Previous
                </button>
                <div className="step-counter-wrapper">
                    <span className="step-counter">
                        Step {currentStep + 1} of {STEPS.length}
                    </span>
                    <div className="total-progress">
                        <span className={`progress-label ${getTotalCompletion().percent === 100 ? 'complete' : ''}`}>
                            {getTotalCompletion().filled}/{getTotalCompletion().total} questions
                        </span>
                        <div className="progress-bar-total">
                            <div
                                className={`progress-fill ${getTotalCompletion().percent === 100 ? 'complete' : ''}`}
                                style={{ width: `${getTotalCompletion().percent}%` }}
                            />
                        </div>
                    </div>
                </div>
                <button
                    className={`btn ${isCurrentSectionComplete() ? 'btn-success' : 'btn-primary'}`}
                    onClick={handleNext}
                    disabled={currentStep === STEPS.length - 1}
                >
                    {isCurrentSectionComplete() && <CheckCircle size={16} />}
                    Next
                    <ChevronRight size={18} />
                </button>

                {/* Save and Export buttons - always visible */}
                {(
                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                        <button
                            className={`btn ${clientSaved ? 'btn-success' : 'btn-primary'}`}
                            onClick={saveClientToDatabase}
                            disabled={isSavingClient}
                            title="Save client to database"
                        >
                            {isSavingClient ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                            {clientSaved ? 'Saved!' : 'Save Client'}
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={exportClientPDF}
                            title="Download client profile as HTML"
                        >
                            <Download size={16} />
                            Export PDF
                        </button>
                    </div>
                )}
            </div>

            {/* Transcript Upload Modal */}
            {showTranscriptUpload && renderTranscriptUploadModal()}

            {/* Export Success Toast */}
            {showExportSuccess && (
                <div className="toast toast-success">
                    <CheckCircle size={18} />
                    Data exported successfully!
                </div>
            )}
        </div>
    );
}

export default Onboarding;
