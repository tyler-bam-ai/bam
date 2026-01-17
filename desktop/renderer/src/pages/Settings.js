import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
    User,
    Bell,
    Shield,
    Palette,
    Mic,
    Volume2,
    Key,
    Save,
    Check,
    Eye,
    EyeOff,
    Moon,
    Sun,
    Monitor,
    Wrench,
    CheckCircle,
    XCircle,
    Loader2,
    Download
} from 'lucide-react';
import './Settings.css';

function Settings() {
    const { user, updateUser } = useAuth();
    const [activeSection, setActiveSection] = useState('profile');
    const [saved, setSaved] = useState(false);

    // Profile Settings
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');

    // Notification Settings
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        desktop: true,
        sounds: true
    });

    // Appearance Settings
    const [theme, setTheme] = useState('dark');

    // Voice Settings
    const [voiceSettings, setVoiceSettings] = useState({
        voice: 'default',
        speed: 1.0,
        autoPlay: true
    });

    // API Keys
    const [apiKeys, setApiKeys] = useState({
        openai: '',
        openrouter: '',
        elevenlabs: '',
        google: ''
    });
    const [showKeys, setShowKeys] = useState({});

    // Tools status
    const [ffmpegStatus, setFfmpegStatus] = useState({ installed: false, checking: true, installing: false });

    useEffect(() => {
        // Load saved settings from electron store
        loadSettings();
    }, []);

    async function loadSettings() {
        const keyStatus = {};

        if (window.electronAPI) {
            const savedSettings = await window.electronAPI.settings.getAll();
            if (savedSettings.notifications) setNotifications(savedSettings.notifications);
            if (savedSettings.theme) setTheme(savedSettings.theme);
            if (savedSettings.voice) setVoiceSettings(savedSettings.voice);

            // Load API keys (only service names for security)
            const keyServices = await window.electronAPI.apiKeys.list();
            // Don't show actual keys, just indicate they're set
            keyServices.forEach(service => {
                keyStatus[service] = '••••••••••••••••';
            });

            // Check FFmpeg status
            checkFfmpegStatus();
        }

        // Also check localStorage for API keys (fallback for dev mode)
        const services = ['openai', 'anthropic', 'google'];
        services.forEach(service => {
            const key = localStorage.getItem(`${service}_api_key`);
            if (key && !keyStatus[service]) {
                keyStatus[service] = '••••••••••••••••';
            }
        });

        if (Object.keys(keyStatus).length > 0) {
            setApiKeys(prev => ({ ...prev, ...keyStatus }));
        }
    }

    async function checkFfmpegStatus() {
        try {
            const response = await fetch('http://localhost:3001/api/system/ffmpeg-status');
            const data = await response.json();
            setFfmpegStatus({ installed: data.installed, checking: false, installing: false });
        } catch (err) {
            setFfmpegStatus({ installed: false, checking: false, installing: false });
        }
    }

    async function installFfmpeg() {
        setFfmpegStatus(prev => ({ ...prev, installing: true }));
        try {
            const response = await fetch('http://localhost:3001/api/system/install-ffmpeg', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                setFfmpegStatus({ installed: true, checking: false, installing: false });
            } else {
                setFfmpegStatus({ installed: false, checking: false, installing: false });
                alert(`FFmpeg installation failed: ${data.error}`);
            }
        } catch (err) {
            setFfmpegStatus({ installed: false, checking: false, installing: false });
            alert('FFmpeg installation failed. Please install manually.');
        }
    }

    async function saveSettings() {
        if (window.electronAPI) {
            await window.electronAPI.settings.set('notifications', notifications);
            await window.electronAPI.settings.set('theme', theme);
            await window.electronAPI.settings.set('voice', voiceSettings);
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    async function saveApiKey(service, key) {
        console.log(`[SETTINGS] saveApiKey called: service=${service}, keyLength=${key?.length}`);

        if (key && !key.includes('•')) {
            console.log(`[SETTINGS] Saving ${service} key...`);

            // Save to Electron store if available
            if (window.electronAPI?.apiKeys?.set) {
                console.log(`[SETTINGS] Saving to electron-store: apikeys.${service}`);
                try {
                    await window.electronAPI.apiKeys.set(service, key);
                    console.log(`[SETTINGS] electron-store save SUCCESS`);
                } catch (err) {
                    console.error(`[SETTINGS] electron-store save FAILED:`, err);
                }
            } else {
                console.log(`[SETTINGS] electron-store NOT available`);
            }

            // Also save to localStorage as fallback
            console.log(`[SETTINGS] Saving to localStorage: ${service}_api_key`);
            try {
                localStorage.setItem(`${service}_api_key`, key);
                // Verify it was saved
                const verify = localStorage.getItem(`${service}_api_key`);
                console.log(`[SETTINGS] localStorage verify: saved=${!!verify}, length=${verify?.length}`);
            } catch (err) {
                console.error(`[SETTINGS] localStorage save FAILED:`, err);
            }

            // Save to backend API for server-side access
            try {
                console.log(`[SETTINGS] Saving to backend API...`);
                const response = await fetch('http://localhost:3001/api/system/api-keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ service, key })
                });
                console.log(`[SETTINGS] Backend API response: ${response.status}`);
            } catch (err) {
                console.error('[SETTINGS] Failed to save API key to backend:', err);
            }

            setApiKeys(prev => ({
                ...prev,
                [service]: '••••••••••••••••'
            }));

            console.log(`[SETTINGS] ✅ ${service} key save complete`);
        } else {
            console.log(`[SETTINGS] Key not saved (empty or masked)`);
        }
    }

    const sections = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'voice', label: 'Voice Settings', icon: Volume2 },
        { id: 'api', label: 'API Keys', icon: Key },
        { id: 'tools', label: 'Tools & Dependencies', icon: Wrench },
        { id: 'security', label: 'Security', icon: Shield },
    ];

    return (
        <div className="settings-page">
            {/* Sidebar */}
            <aside className="settings-sidebar animate-slideUp">
                <nav className="settings-nav">
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            className={`settings-nav-item ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(section.id)}
                        >
                            <section.icon size={18} />
                            {section.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Content */}
            <main className="settings-content animate-slideUp" style={{ animationDelay: '0.1s' }}>
                {/* Profile Section */}
                {activeSection === 'profile' && (
                    <section className="settings-section">
                        <h2>Profile Settings</h2>
                        <p className="section-description">Manage your personal information</p>

                        <div className="settings-form">
                            <div className="form-row">
                                <div className="input-group">
                                    <label className="input-label">Full Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group">
                                    <label className="input-label">Email Address</label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group">
                                    <label className="input-label">Role</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={user?.role?.replace('_', ' ')}
                                        disabled
                                    />
                                    <span className="input-helper">Contact admin to change your role</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Notifications Section */}
                {activeSection === 'notifications' && (
                    <section className="settings-section">
                        <h2>Notification Preferences</h2>
                        <p className="section-description">Control how you receive notifications</p>

                        <div className="settings-toggles">
                            <div className="toggle-item">
                                <div className="toggle-info">
                                    <span className="toggle-label">Email Notifications</span>
                                    <span className="toggle-description">Receive updates via email</span>
                                </div>
                                <button
                                    className={`toggle-switch ${notifications.email ? 'active' : ''}`}
                                    onClick={() => setNotifications(prev => ({ ...prev, email: !prev.email }))}
                                >
                                    <span className="toggle-knob"></span>
                                </button>
                            </div>

                            <div className="toggle-item">
                                <div className="toggle-info">
                                    <span className="toggle-label">Push Notifications</span>
                                    <span className="toggle-description">Receive push notifications on mobile</span>
                                </div>
                                <button
                                    className={`toggle-switch ${notifications.push ? 'active' : ''}`}
                                    onClick={() => setNotifications(prev => ({ ...prev, push: !prev.push }))}
                                >
                                    <span className="toggle-knob"></span>
                                </button>
                            </div>

                            <div className="toggle-item">
                                <div className="toggle-info">
                                    <span className="toggle-label">Desktop Notifications</span>
                                    <span className="toggle-description">Show notifications on your desktop</span>
                                </div>
                                <button
                                    className={`toggle-switch ${notifications.desktop ? 'active' : ''}`}
                                    onClick={() => setNotifications(prev => ({ ...prev, desktop: !prev.desktop }))}
                                >
                                    <span className="toggle-knob"></span>
                                </button>
                            </div>

                            <div className="toggle-item">
                                <div className="toggle-info">
                                    <span className="toggle-label">Sound Effects</span>
                                    <span className="toggle-description">Play sounds for notifications</span>
                                </div>
                                <button
                                    className={`toggle-switch ${notifications.sounds ? 'active' : ''}`}
                                    onClick={() => setNotifications(prev => ({ ...prev, sounds: !prev.sounds }))}
                                >
                                    <span className="toggle-knob"></span>
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Appearance Section */}
                {activeSection === 'appearance' && (
                    <section className="settings-section">
                        <h2>Appearance</h2>
                        <p className="section-description">Customize the look and feel</p>

                        <div className="theme-selector">
                            <label className="input-label">Theme</label>
                            <div className="theme-options">
                                <button
                                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => setTheme('light')}
                                >
                                    <Sun size={24} />
                                    <span>Light</span>
                                </button>
                                <button
                                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => setTheme('dark')}
                                >
                                    <Moon size={24} />
                                    <span>Dark</span>
                                </button>
                                <button
                                    className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                                    onClick={() => setTheme('system')}
                                >
                                    <Monitor size={24} />
                                    <span>System</span>
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Voice Settings Section */}
                {activeSection === 'voice' && (
                    <section className="settings-section">
                        <h2>Voice Settings</h2>
                        <p className="section-description">Configure voice chat preferences</p>

                        <div className="settings-form">
                            <div className="form-row">
                                <div className="input-group">
                                    <label className="input-label">AI Voice</label>
                                    <select
                                        className="input"
                                        value={voiceSettings.voice}
                                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, voice: e.target.value }))}
                                    >
                                        <option value="default">Default (Rachel)</option>
                                        <option value="adam">Adam (Male)</option>
                                        <option value="bella">Bella (Female)</option>
                                        <option value="sam">Sam (Neutral)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group">
                                    <label className="input-label">Speech Speed: {voiceSettings.speed}x</label>
                                    <input
                                        type="range"
                                        className="range-input"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={voiceSettings.speed}
                                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                                    />
                                </div>
                            </div>

                            <div className="toggle-item">
                                <div className="toggle-info">
                                    <span className="toggle-label">Auto-play Responses</span>
                                    <span className="toggle-description">Automatically play AI voice responses</span>
                                </div>
                                <button
                                    className={`toggle-switch ${voiceSettings.autoPlay ? 'active' : ''}`}
                                    onClick={() => setVoiceSettings(prev => ({ ...prev, autoPlay: !prev.autoPlay }))}
                                >
                                    <span className="toggle-knob"></span>
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* API Keys Section */}
                {activeSection === 'api' && (
                    <section className="settings-section">
                        <h2>API Keys</h2>
                        <p className="section-description">Manage your API integrations. These keys are required for AI features.</p>

                        <div className="api-keys-form">
                            {/* OpenAI - Required for Whisper transcription and GPT clip detection */}
                            <div className="api-key-item">
                                <div className="api-key-header">
                                    <span className="api-key-name">OpenAI API Key <span style={{ color: 'var(--color-error)', fontSize: '0.75rem' }}>(Required)</span></span>
                                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="api-key-link">
                                        Get API Key →
                                    </a>
                                </div>
                                <p className="api-key-description" style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                                    Required for video transcription (Whisper) and AI clip detection (GPT 5.2)
                                </p>
                                <div className="api-key-input-wrapper">
                                    <input
                                        type={showKeys.openai ? 'text' : 'password'}
                                        className="input"
                                        placeholder="sk-..."
                                        value={apiKeys.openai}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                                    />
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
                                    >
                                        {showKeys.openai ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => saveApiKey('openai', apiKeys.openai)}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            <div className="api-key-item">
                                <div className="api-key-header">
                                    <span className="api-key-name">OpenRouter API Key <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>(Video Analysis)</span></span>
                                    <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="api-key-link">
                                        Get API Key →
                                    </a>
                                </div>
                                <p className="api-key-description" style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                                    Required for Brain Training video analysis - Uses Gemini to analyze video content
                                </p>
                                <div className="api-key-input-wrapper">
                                    <input
                                        type={showKeys.openrouter ? 'text' : 'password'}
                                        className="input"
                                        placeholder="sk-or-..."
                                        value={apiKeys.openrouter}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, openrouter: e.target.value }))}
                                    />
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => setShowKeys(prev => ({ ...prev, openrouter: !prev.openrouter }))}
                                    >
                                        {showKeys.openrouter ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => saveApiKey('openrouter', apiKeys.openrouter)}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            <div className="api-key-item">
                                <div className="api-key-header">
                                    <span className="api-key-name">ElevenLabs API Key</span>
                                    <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="api-key-link">
                                        Get API Key →
                                    </a>
                                </div>
                                <div className="api-key-input-wrapper">
                                    <input
                                        type={showKeys.elevenlabs ? 'text' : 'password'}
                                        className="input"
                                        placeholder="Your ElevenLabs API key"
                                        value={apiKeys.elevenlabs}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, elevenlabs: e.target.value }))}
                                    />
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => setShowKeys(prev => ({ ...prev, elevenlabs: !prev.elevenlabs }))}
                                    >
                                        {showKeys.elevenlabs ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => saveApiKey('elevenlabs', apiKeys.elevenlabs)}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            {/* Google/Gemini - Required for Content Engine video analysis */}
                            <div className="api-key-item">
                                <div className="api-key-header">
                                    <span className="api-key-name">Gemini API Key <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>(Content Engine)</span></span>
                                    <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="api-key-link">
                                        Get API Key →
                                    </a>
                                </div>
                                <p className="api-key-description" style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                                    Required for Content Engine video analysis - Gemini actually watches your video to detect viral moments
                                </p>
                                <div className="api-key-input-wrapper">
                                    <input
                                        type={showKeys.google ? 'text' : 'password'}
                                        className="input"
                                        placeholder="AIza..."
                                        value={apiKeys.google}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, google: e.target.value }))}
                                    />
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => setShowKeys(prev => ({ ...prev, google: !prev.google }))}
                                    >
                                        {showKeys.google ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => saveApiKey('google', apiKeys.google)}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Tools & Dependencies Section */}
                {activeSection === 'tools' && (
                    <section className="settings-section">
                        <h2>Tools & Dependencies</h2>
                        <p className="section-description">Required tools for video processing features</p>

                        <div className="settings-form">
                            <div className="security-item">
                                <div className="security-info">
                                    <h4>
                                        FFmpeg
                                        {ffmpegStatus.checking ? (
                                            <Loader2 size={16} className="spin" style={{ marginLeft: '8px' }} />
                                        ) : ffmpegStatus.installed ? (
                                            <CheckCircle size={16} style={{ marginLeft: '8px', color: 'var(--color-success)' }} />
                                        ) : (
                                            <XCircle size={16} style={{ marginLeft: '8px', color: 'var(--color-error)' }} />
                                        )}
                                    </h4>
                                    <p>Required for video transcription and clip export with captions</p>
                                    {!ffmpegStatus.installed && !ffmpegStatus.checking && (
                                        <p style={{ color: 'var(--color-warning)', fontSize: '0.85rem' }}>
                                            FFmpeg is not installed. Click "Install FFmpeg" to automatically install it.
                                        </p>
                                    )}
                                </div>
                                {ffmpegStatus.installed ? (
                                    <span className="btn btn-secondary" style={{ pointerEvents: 'none', opacity: 0.7 }}>
                                        <CheckCircle size={16} /> Installed
                                    </span>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        onClick={installFfmpeg}
                                        disabled={ffmpegStatus.installing}
                                    >
                                        {ffmpegStatus.installing ? (
                                            <>
                                                <Loader2 size={16} className="spin" /> Installing...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={16} /> Install FFmpeg
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Security Section */}
                {activeSection === 'security' && (
                    <section className="settings-section">
                        <h2>Security</h2>
                        <p className="section-description">Manage your account security</p>

                        <div className="settings-form">
                            <div className="security-item">
                                <div className="security-info">
                                    <h4>Change Password</h4>
                                    <p>Update your password regularly for better security</p>
                                </div>
                                <button className="btn btn-secondary">
                                    Change Password
                                </button>
                            </div>

                            <div className="security-item">
                                <div className="security-info">
                                    <h4>Two-Factor Authentication</h4>
                                    <p>Add an extra layer of security to your account</p>
                                </div>
                                <button className="btn btn-secondary">
                                    Enable 2FA
                                </button>
                            </div>

                            <div className="security-item">
                                <div className="security-info">
                                    <h4>Active Sessions</h4>
                                    <p>Manage devices where you're logged in</p>
                                </div>
                                <button className="btn btn-secondary">
                                    View Sessions
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Save Button */}
                <div className="settings-actions">
                    <button
                        className={`btn btn-primary btn-lg ${saved ? 'saved' : ''}`}
                        onClick={saveSettings}
                    >
                        {saved ? (
                            <>
                                <Check size={18} />
                                Saved!
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}

export default Settings;
