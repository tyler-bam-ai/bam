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
