/**
 * CampaignChatModal
 * AI-guided campaign creation wizard with chat interface
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    Send,
    Loader2,
    Sparkles,
    Check,
    ChevronRight,
    Calendar,
    Target,
    MessageSquare,
    Rocket
} from 'lucide-react';
import './CampaignChatModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function CampaignChatModal({ isOpen, onClose, onCampaignCreated }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [currentStep, setCurrentStep] = useState('name');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [currentOptions, setCurrentOptions] = useState(null);
    const [isMultiSelect, setIsMultiSelect] = useState(false);
    const [campaignSummary, setCampaignSummary] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize conversation on open
    useEffect(() => {
        if (isOpen) {
            startConversation();
        } else {
            // Reset state when closed
            setMessages([]);
            setSessionId(null);
            setCurrentStep('name');
            setSelectedOptions([]);
            setCurrentOptions(null);
            setCampaignSummary(null);
        }
    }, [isOpen]);

    const startConversation = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/content/campaigns/ai-guide`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const data = await response.json();

            if (data.success) {
                setSessionId(data.sessionId);
                setCurrentStep(data.step);
                addAIMessage(data.message, data.question, data.options, data.placeholder);
                if (data.options) {
                    setCurrentOptions(data.options);
                    setIsMultiSelect(data.multiSelect || false);
                }
            }
        } catch (error) {
            console.error('Start conversation error:', error);
            addAIMessage('Sorry, something went wrong. Please try again.', null, null, null);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const addAIMessage = (message, question, options, placeholder) => {
        setMessages(prev => [...prev, {
            role: 'ai',
            content: message,
            question,
            options,
            placeholder,
            timestamp: new Date()
        }]);
    };

    const addUserMessage = (content) => {
        setMessages(prev => [...prev, {
            role: 'user',
            content,
            timestamp: new Date()
        }]);
    };

    const sendMessage = async (userResponse) => {
        const responseText = userResponse || input.trim();
        if (!responseText && selectedOptions.length === 0) return;

        const finalResponse = selectedOptions.length > 0 ? selectedOptions : responseText;

        if (typeof finalResponse === 'string') {
            addUserMessage(finalResponse);
        } else {
            addUserMessage(finalResponse.join(', '));
        }

        setInput('');
        setSelectedOptions([]);
        setCurrentOptions(null);
        setIsLoading(true);

        try {
            const token = localStorage.getItem('bam_token');
            const response = await fetch(`${API_URL}/api/content/campaigns/ai-guide`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId,
                    userResponse: finalResponse
                })
            });

            const data = await response.json();

            if (data.success) {
                setCurrentStep(data.step);

                if (data.step === 'complete') {
                    setCampaignSummary(data.summary);
                    addAIMessage(data.message, null, null, null);

                    // Notify parent after a brief delay
                    setTimeout(() => {
                        if (onCampaignCreated && data.campaignId) {
                            onCampaignCreated(data.campaignId, data.summary);
                        }
                    }, 2000);
                } else {
                    addAIMessage(data.message, data.question, data.options, data.placeholder);
                    if (data.options) {
                        setCurrentOptions(data.options);
                        setIsMultiSelect(data.multiSelect || false);
                    }
                    if (data.topics) {
                        setCurrentOptions(data.topics);
                        setIsMultiSelect(true);
                    }
                }
            }
        } catch (error) {
            console.error('Send message error:', error);
            addAIMessage('Sorry, something went wrong. Please try again.', null, null, null);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleOptionClick = (option) => {
        const optionValue = typeof option === 'object' ? option.id : option;

        if (isMultiSelect) {
            setSelectedOptions(prev => {
                if (prev.includes(optionValue)) {
                    return prev.filter(o => o !== optionValue);
                }
                return [...prev, optionValue];
            });
        } else {
            sendMessage(optionValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (selectedOptions.length > 0) {
                sendMessage(null);
            } else if (input.trim()) {
                sendMessage(input.trim());
            }
        }
    };

    const getStepIcon = (step) => {
        switch (step) {
            case 'name': return <Sparkles size={16} />;
            case 'duration': return <Calendar size={16} />;
            case 'frequency': return <Target size={16} />;
            case 'promotions': return <MessageSquare size={16} />;
            case 'topics': return <MessageSquare size={16} />;
            case 'platforms': return <Target size={16} />;
            case 'complete': return <Rocket size={16} />;
            default: return <Sparkles size={16} />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="campaign-chat-overlay">
            <div className="campaign-chat-modal">
                {/* Header */}
                <header className="chat-header">
                    <div className="chat-header-title">
                        <Sparkles size={24} />
                        <div>
                            <h2>Create Campaign</h2>
                            <span className="step-indicator">
                                {getStepIcon(currentStep)}
                                Step: {currentStep}
                            </span>
                        </div>
                    </div>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </header>

                {/* Messages */}
                <div className="chat-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            {msg.role === 'ai' ? (
                                <div className="ai-avatar">
                                    <Sparkles size={16} />
                                </div>
                            ) : null}
                            <div className="message-content">
                                <p>{msg.content}</p>
                                {msg.question && (
                                    <p className="message-question">{msg.question}</p>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Options */}
                    {currentOptions && (
                        <div className={`chat-options ${isMultiSelect ? 'multi-select' : ''}`}>
                            {currentOptions.map((option, index) => {
                                const optionValue = typeof option === 'object' ? option.id : option;
                                const optionLabel = typeof option === 'object' ? option.label : option;
                                const isRecommended = typeof option === 'object' && option.recommended;
                                const isSelected = selectedOptions.includes(optionValue);

                                return (
                                    <button
                                        key={index}
                                        className={`option-btn ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
                                        onClick={() => handleOptionClick(option)}
                                    >
                                        {isMultiSelect && (
                                            <span className="checkbox">
                                                {isSelected && <Check size={12} />}
                                            </span>
                                        )}
                                        {optionLabel}
                                        {isRecommended && <span className="recommended-badge">Recommended</span>}
                                    </button>
                                );
                            })}

                            {isMultiSelect && selectedOptions.length > 0 && (
                                <button
                                    className="btn-confirm-selection"
                                    onClick={() => sendMessage(null)}
                                >
                                    Confirm Selection ({selectedOptions.length})
                                    <ChevronRight size={16} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Campaign Summary */}
                    {campaignSummary && (
                        <div className="campaign-summary">
                            <h3>🎉 Campaign Created!</h3>
                            <div className="summary-grid">
                                <div className="summary-item">
                                    <span className="label">Name</span>
                                    <span className="value">{campaignSummary.name}</span>
                                </div>
                                <div className="summary-item">
                                    <span className="label">Duration</span>
                                    <span className="value">{campaignSummary.duration}</span>
                                </div>
                                <div className="summary-item">
                                    <span className="label">Frequency</span>
                                    <span className="value">{campaignSummary.frequency}</span>
                                </div>
                                <div className="summary-item">
                                    <span className="label">Clips Needed</span>
                                    <span className="value">{campaignSummary.clipsNeeded}</span>
                                </div>
                                <div className="summary-item full-width">
                                    <span className="label">Platforms</span>
                                    <span className="value">{campaignSummary.platforms?.join(', ')}</span>
                                </div>
                            </div>
                            <button className="btn-start-creating" onClick={onClose}>
                                <Rocket size={16} />
                                Start Creating Content
                            </button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="chat-message ai loading">
                            <div className="ai-avatar">
                                <Sparkles size={16} />
                            </div>
                            <div className="message-content">
                                <Loader2 className="spinning" size={20} />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {currentStep !== 'complete' && !currentOptions && (
                    <div className="chat-input">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={messages[messages.length - 1]?.placeholder || "Type your response..."}
                            disabled={isLoading}
                        />
                        <button
                            className="btn-send"
                            onClick={() => sendMessage(input.trim())}
                            disabled={!input.trim() || isLoading}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                )}

                {/* Skip/Optional indicator */}
                {currentStep === 'promotions' && (
                    <div className="skip-option">
                        <button onClick={() => sendMessage('')}>
                            Skip this step
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CampaignChatModal;
