/**
 * Email Service using Resend
 * Handles sending welcome emails, password reset emails, etc.
 */

const { Resend } = require('resend');

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

// Default from address - uses Resend's onboarding domain if no custom domain
const FROM_EMAIL = process.env.EMAIL_FROM || 'BAM.ai <onboarding@resend.dev>';

/**
 * Generate a random temporary password
 * @param {number} length - Password length (default 12)
 * @returns {string} - Random alphanumeric password
 */
function generateTemporaryPassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * Send welcome email with temporary password
 * @param {string} email - Recipient email
 * @param {string} temporaryPassword - The temporary password
 * @param {string} companyName - Company name for personalization
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendWelcomeEmail(email, temporaryPassword, companyName) {
    if (!resend) {
        console.warn('[EMAIL] Resend not configured - RESEND_API_KEY missing');
        console.log('[EMAIL] Would send welcome email to:', email);
        console.log('[EMAIL] Temporary password:', temporaryPassword);
        return { success: true, simulated: true };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `Welcome to BAM.ai - Your Login Credentials`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to BAM.ai</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI-Powered Employee Knowledge Cloning</p>
        </div>
        
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hi there! 👋
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Your BAM.ai account for <strong>${companyName}</strong> is ready! Here are your login credentials:
            </p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">Email Address</p>
                <p style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">${email}</p>
                
                <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">Temporary Password</p>
                <p style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600; font-family: monospace; background: #fef3c7; padding: 8px 12px; border-radius: 6px; display: inline-block;">${temporaryPassword}</p>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>Important:</strong> You'll be asked to change your password when you first log in.
                </p>
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                With BAM.ai, you can:
            </p>
            <ul style="color: #374151; font-size: 14px; line-height: 1.8;">
                <li>💬 Ask questions about your company using <strong>BAM Brains</strong></li>
                <li>📚 Add training materials with <strong>Brain Training</strong></li>
                <li>🎬 Create content with the <strong>Content Engine</strong></li>
            </ul>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                If you have any questions, just reply to this email!
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
                — The BAM.ai Team
            </p>
        </div>
        
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
            © 2026 BAM.ai. All rights reserved.
        </p>
    </div>
</body>
</html>
            `
        });

        if (error) {
            console.error('[EMAIL] Resend error:', error);
            return { success: false, error: error.message };
        }

        console.log('[EMAIL] Welcome email sent successfully to:', email, 'ID:', data?.id);
        return { success: true, messageId: data?.id };
    } catch (error) {
        console.error('[EMAIL] Failed to send welcome email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - The password reset token
 * @param {string} resetUrl - Full URL to reset password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendPasswordResetEmail(email, resetToken, resetUrl) {
    if (!resend) {
        console.warn('[EMAIL] Resend not configured - RESEND_API_KEY missing');
        console.log('[EMAIL] Would send password reset email to:', email);
        return { success: true, simulated: true };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Reset Your BAM.ai Password',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
        </div>
        
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                    Reset Password
                </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
                If you didn't request this, you can safely ignore this email.
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
                This link expires in 1 hour.
            </p>
        </div>
    </div>
</body>
</html>
            `
        });

        if (error) {
            console.error('[EMAIL] Resend error:', error);
            return { success: false, error: error.message };
        }

        console.log('[EMAIL] Password reset email sent to:', email);
        return { success: true, messageId: data?.id };
    } catch (error) {
        console.error('[EMAIL] Failed to send password reset email:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    generateTemporaryPassword,
    sendWelcomeEmail,
    sendPasswordResetEmail
};
