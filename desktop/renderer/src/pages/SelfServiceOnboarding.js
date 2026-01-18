/**
 * SelfServiceOnboarding Page
 * AI-driven PLG onboarding with voice conversation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Mic,
    MicOff,
    MessageSquare,
    CheckCircle,
    AlertCircle,
    Loader2,
    Volume2,
    VolumeX,
    Phone,
    Send,
    ArrowRight,
    Brain,
    Sparkles,
    User,
    Bot,
    Play,
    Pause
} from 'lucide-react';
import { API_URL } from '../config';
import './SelfServiceOnboarding.css';

// Onboarding stages
const STAGES = [
    { id: 'intro', name: 'Introduction', description: 'Getting to know your business' },
    { id: 'company', name: 'Company Info', description: 'Business details and industry' },
    { id: 'customers', name: 'Customer Focus', description: 'Who you serve and how' },
    { id: 'processes', name: 'Operations', description: 'How your business runs' },
    { id: 'review', name: 'Review', description: 'Confirm your information' }
];

function SelfServiceOnboarding() {
    // Session state
    const [sessionId, setSessionId] = useState(null);
    const [currentStage, setCurrentStage] = useState(0);
    const [messages, setMessages] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    // Voice state
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [transcript, setTranscript] = useState('');

    // Text input state
    const [textInput, setTextInput] = useState('');
    const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'

    // Collected data
    const [collectedData, setCollectedData] = useState({});
    const [completionProgress, setCompletionProgress] = useState(0);

    // Refs
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event) => {
                const results = Array.from(event.results);
                const transcript = results
                    .map(result => result[0].transcript)
                    .join('');
                setTranscript(transcript);

                // Check if final result
                const isFinal = results[results.length - 1]?.isFinal;
                if (isFinal) {
                    handleUserResponse(transcript);
                    setTranscript('');
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsRecording(false);
            };
        }
    }, []);

    // Scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Start session on mount
    useEffect(() => {
        startOnboardingSession();
    }, []);

    const startOnboardingSession = async () => {
        try {
            setIsProcessing(true);
            const response = await fetch(`${API_URL}/api/ai-onboarding/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                setSessionId(data.sessionId);

                // Add welcome message
                addAIMessage(data.message || getWelcomeMessage());

                if (voiceEnabled && data.message) {
                    speakMessage(data.message);
                }
            } else {
                // Fallback welcome
                addAIMessage(getWelcomeMessage());
            }
        } catch (err) {
            console.error('Start session error:', err);
            addAIMessage(getWelcomeMessage());
        } finally {
            setIsProcessing(false);
        }
    };

    const getWelcomeMessage = () => {
        return `Welcome to BAM.ai! 👋

I'm your AI onboarding assistant. I'll help you set up your Business Brain by learning about your company.

This conversation typically takes about 10-15 minutes. You can speak to me using your microphone, or type your responses - whatever feels more comfortable.

**Let's start with the basics:**
What's the name of your company?`;
    };

    const addAIMessage = (content) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'assistant',
            content,
            timestamp: new Date().toISOString()
        }]);
    };

    const addUserMessage = (content) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'user',
            content,
            timestamp: new Date().toISOString()
        }]);
    };

    const handleUserResponse = async (response) => {
        if (!response.trim()) return;

        addUserMessage(response);
        setIsProcessing(true);

        try {
            const fetchResponse = await fetch(`${API_URL}/api/ai-onboarding/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    response,
                    currentStage: STAGES[currentStage].id
                })
            });

            if (fetchResponse.ok) {
                const data = await fetchResponse.json();

                // Update collected data
                if (data.extractedData) {
                    setCollectedData(prev => ({ ...prev, ...data.extractedData }));
                }

                // Update progress
                if (data.progress) {
                    setCompletionProgress(data.progress);
                }

                // Move to next stage if needed
                if (data.nextStage && data.nextStage !== STAGES[currentStage].id) {
                    const nextIndex = STAGES.findIndex(s => s.id === data.nextStage);
                    if (nextIndex !== -1) {
                        setCurrentStage(nextIndex);
                    }
                }

                // Add AI response
                if (data.message) {
                    addAIMessage(data.message);
                    if (voiceEnabled) {
                        speakMessage(data.message);
                    }
                }

                // Check if complete
                if (data.isComplete) {
                    setCurrentStage(STAGES.length - 1);
                }
            } else {
                // Fallback response
                addAIMessage(generateFallbackResponse(response));
            }
        } catch (err) {
            console.error('Response error:', err);
            addAIMessage(generateFallbackResponse(response));
        } finally {
            setIsProcessing(false);
        }
    };

    const generateFallbackResponse = (userInput) => {
        const stage = STAGES[currentStage];

        const responses = {
            intro: `Great, thank you for sharing! Now, what industry does your company operate in? (e.g., technology, healthcare, construction, retail)`,
            company: `Excellent! Understanding your industry helps me tailor the Brain. How many employees work at your company?`,
            customers: `That's helpful context. Can you describe your ideal customer? Who benefits most from your products or services?`,
            processes: `I see. What would you say is the most common question employees ask that you wish they already knew the answer to?`,
            review: `Thank you for all that information! Let me create your Business Brain now...`
        };

        return responses[stage.id] || `Thanks for that! Let's continue with the next question...`;
    };

    const speakMessage = async (text) => {
        if (!voiceEnabled) return;

        try {
            setIsSpeaking(true);

            // Try ElevenLabs first
            const response = await fetch(`${API_URL}/api/voice/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voiceId: 'alloy' })
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audio = new Audio(URL.createObjectURL(audioBlob));
                audio.onended = () => setIsSpeaking(false);
                await audio.play();
            } else {
                // Fallback to browser TTS
                const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').replace(/\n/g, ' '));
                utterance.onend = () => setIsSpeaking(false);
                speechSynthesis.speak(utterance);
            }
        } catch (err) {
            console.error('TTS error:', err);
            setIsSpeaking(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            setTranscript('');
            recognitionRef.current?.start();
            setIsRecording(true);
        }
    };

    const handleTextSubmit = (e) => {
        e.preventDefault();
        if (textInput.trim() && !isProcessing) {
            handleUserResponse(textInput);
            setTextInput('');
        }
    };

    const requestHumanHandoff = async () => {
        addUserMessage("I'd like to speak with a human instead.");
        setIsProcessing(true);

        try {
            const response = await fetch(`${API_URL}/api/ai-onboarding/handoff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            const data = await response.json();
            addAIMessage(data.message || `No problem! A team member will reach out to you shortly. You can also call us at (555) 123-4567 or email support@bam.ai.`);
        } catch (err) {
            addAIMessage(`I'll connect you with a team member. Please email support@bam.ai or call (555) 123-4567.`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="self-service-onboarding">
            {/* Progress Header */}
            <header className="onboarding-header">
                <div className="header-brand">
                    <Brain className="brand-icon" />
                    <span>BAM.ai Onboarding</span>
                </div>
                <div className="progress-container">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${(currentStage / (STAGES.length - 1)) * 100}%` }}
                        />
                    </div>
                    <span className="progress-text">
                        {STAGES[currentStage].name} ({currentStage + 1}/{STAGES.length})
                    </span>
                </div>
                <button
                    className="handoff-btn"
                    onClick={requestHumanHandoff}
                    title="Speak with a human"
                >
                    <Phone size={18} />
                    <span>Talk to Human</span>
                </button>
            </header>

            {/* Stage Indicators */}
            <div className="stage-indicators">
                {STAGES.map((stage, index) => (
                    <div
                        key={stage.id}
                        className={`stage-dot ${index <= currentStage ? 'completed' : ''} ${index === currentStage ? 'active' : ''}`}
                        title={stage.name}
                    >
                        {index < currentStage ? (
                            <CheckCircle size={16} />
                        ) : (
                            <span>{index + 1}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Chat Container */}
            <div className="chat-container">
                <div className="messages-area">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`message ${message.role}`}
                        >
                            <div className="message-avatar">
                                {message.role === 'assistant' ? (
                                    <Bot size={20} />
                                ) : (
                                    <User size={20} />
                                )}
                            </div>
                            <div className="message-content">
                                <div className="message-text" dangerouslySetInnerHTML={{
                                    __html: message.content
                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\n/g, '<br/>')
                                }} />
                                <span className="message-time">
                                    {new Date(message.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="message assistant">
                            <div className="message-avatar">
                                <Bot size={20} />
                            </div>
                            <div className="message-content typing">
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                            </div>
                        </div>
                    )}

                    {transcript && (
                        <div className="transcript-preview">
                            <Mic size={14} />
                            <span>{transcript}</span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="input-area">
                    <div className="input-mode-toggle">
                        <button
                            className={inputMode === 'voice' ? 'active' : ''}
                            onClick={() => setInputMode('voice')}
                        >
                            <Mic size={16} />
                            Voice
                        </button>
                        <button
                            className={inputMode === 'text' ? 'active' : ''}
                            onClick={() => setInputMode('text')}
                        >
                            <MessageSquare size={16} />
                            Text
                        </button>
                    </div>

                    {inputMode === 'voice' ? (
                        <div className="voice-input">
                            <button
                                className={`record-btn ${isRecording ? 'recording' : ''} ${isSpeaking ? 'speaking' : ''}`}
                                onClick={toggleRecording}
                                disabled={isProcessing || isSpeaking}
                            >
                                {isRecording ? (
                                    <>
                                        <MicOff size={24} />
                                        <span>Stop Recording</span>
                                    </>
                                ) : (
                                    <>
                                        <Mic size={24} />
                                        <span>{isSpeaking ? 'AI Speaking...' : 'Hold to Speak'}</span>
                                    </>
                                )}
                            </button>
                            <button
                                className={`voice-toggle ${voiceEnabled ? 'enabled' : ''}`}
                                onClick={() => setVoiceEnabled(!voiceEnabled)}
                                title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
                            >
                                {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                            </button>
                        </div>
                    ) : (
                        <form className="text-input" onSubmit={handleTextSubmit}>
                            <input
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder="Type your response..."
                                disabled={isProcessing}
                            />
                            <button type="submit" disabled={!textInput.trim() || isProcessing}>
                                <Send size={20} />
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Collected Data Preview */}
            {Object.keys(collectedData).length > 0 && (
                <div className="collected-preview">
                    <h4><Sparkles size={16} /> Building Your Brain</h4>
                    <div className="data-chips">
                        {Object.entries(collectedData).slice(0, 5).map(([key, value]) => (
                            <span key={key} className="data-chip">
                                <CheckCircle size={12} />
                                {String(value).substring(0, 30)}...
                            </span>
                        ))}
                    </div>
                    <div className="completion-bar">
                        <div
                            className="completion-fill"
                            style={{ width: `${completionProgress}%` }}
                        />
                    </div>
                    <span className="completion-text">{completionProgress}% complete</span>
                </div>
            )}
        </div>
    );
}

export default SelfServiceOnboarding;
