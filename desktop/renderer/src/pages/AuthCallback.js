/**
 * OAuth Callback Handler
 * Handles the redirect from Google OAuth with token in URL
 */

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setToken } = useAuth();

    useEffect(() => {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
            console.error('[AUTH CALLBACK] Error:', error);
            navigate('/login?error=' + error);
            return;
        }

        if (token) {
            console.log('[AUTH CALLBACK] Token received, storing...');
            // Store the token and redirect to dashboard
            localStorage.setItem('bam_token', token);
            localStorage.setItem('token', token); // For compatibility

            // Force page reload to reinitialize auth state
            window.location.href = '/dashboard';
        } else {
            console.error('[AUTH CALLBACK] No token received');
            navigate('/login?error=no_token');
        }
    }, [searchParams, navigate, setToken]);

    return (
        <div className="loading-screen">
            <div className="loading-spinner"></div>
            <p>Signing in with Google...</p>
        </div>
    );
}

export default AuthCallback;
