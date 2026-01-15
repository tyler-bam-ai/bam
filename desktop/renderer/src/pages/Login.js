import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import bamLogoGradient from '../assets/bam-icon-gradient.png';
import './Login.css';

function Login() {
    const { user, login, loading, error } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');

    // Redirect if already logged in
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');

        if (!email || !password) {
            setLocalError('Please enter both email and password');
            return;
        }

        const result = await login(email, password);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setLocalError(result.error);
        }
    };

    const handleDemoLogin = async (type) => {
        const demoAccounts = {
            admin: { email: 'admin@bam.ai', password: 'demo123' },
            provider: { email: 'provider@demo.com', password: 'demo123' },
            consumer: { email: 'consumer@demo.com', password: 'demo123' }
        };

        const account = demoAccounts[type];
        setEmail(account.email);
        setPassword(account.password);

        const result = await login(account.email, account.password);
        if (result.success) {
            navigate('/dashboard');
        }
    };

    return (
        <div className="login-page">
            {/* Background Effects */}
            <div className="login-bg">
                <div className="bg-gradient"></div>
                <div className="bg-glow bg-glow-1"></div>
                <div className="bg-glow bg-glow-2"></div>
            </div>

            <div className="login-container">
                {/* Logo Section */}
                <div className="login-header">
                    <div className="login-logo">
                        <img src={bamLogoGradient} alt="BAM.ai" className="login-logo-icon" />
                    </div>
                    <h1 className="login-title">Welcome to BAM.ai</h1>
                    <p className="login-subtitle">
                        AI-Powered Employee Knowledge Cloning Platform
                    </p>
                </div>

                {/* Login Form */}
                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label" htmlFor="email">Email</label>
                        <div className="input-with-icon">
                            <Mail className="input-icon" size={18} />
                            <input
                                id="email"
                                type="email"
                                className={`input ${localError || error ? 'input-error' : ''}`}
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label" htmlFor="password">Password</label>
                        <div className="input-with-icon">
                            <Lock className="input-icon" size={18} />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                className={`input ${localError || error ? 'input-error' : ''}`}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {(localError || error) && (
                        <div className="error-message">
                            {localError || error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg login-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading-spinner" style={{ width: 20, height: 20 }}></span>
                        ) : (
                            <>
                                Sign In
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                {/* Google OAuth */}
                <div className="oauth-section">
                    <div className="oauth-divider">
                        <span>or continue with</span>
                    </div>
                    <button
                        className="btn btn-secondary btn-lg google-login-btn"
                        onClick={async () => {
                            try {
                                const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                                const response = await fetch(`${API_URL}/api/auth/google/url`);
                                if (response.ok) {
                                    const { url } = await response.json();
                                    window.location.href = url;
                                } else {
                                    setLocalError('Google login not configured');
                                }
                            } catch (err) {
                                setLocalError('Failed to connect to server');
                            }
                        }}
                        disabled={loading}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Sign in with Google
                    </button>
                </div>

                {/* Demo Accounts */}
                <div className="demo-section">
                    <div className="demo-divider">
                        <span>Quick Demo Access</span>
                    </div>

                    <div className="demo-buttons">
                        <button
                            className="btn btn-secondary demo-btn"
                            onClick={() => handleDemoLogin('admin')}
                            disabled={loading}
                        >
                            <span className="demo-btn-role">BAM Admin</span>
                            <span className="demo-btn-email">admin@bam.ai</span>
                        </button>

                        <button
                            className="btn btn-secondary demo-btn"
                            onClick={() => handleDemoLogin('provider')}
                            disabled={loading}
                        >
                            <span className="demo-btn-role">Knowledge Provider</span>
                            <span className="demo-btn-email">provider@demo.com</span>
                        </button>

                        <button
                            className="btn btn-secondary demo-btn"
                            onClick={() => handleDemoLogin('consumer')}
                            disabled={loading}
                        >
                            <span className="demo-btn-role">Knowledge Consumer</span>
                            <span className="demo-btn-email">consumer@demo.com</span>
                        </button>
                    </div>
                </div>

                <p className="login-footer">
                    By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    );
}

export default Login;
