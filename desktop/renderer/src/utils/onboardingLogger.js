/**
 * Onboarding Logger
 * Logs all transcription activity to a file and console for debugging
 */

const LOG_KEY = 'onboarding_transcription_log';
const MAX_LOG_ENTRIES = 500;

class OnboardingLogger {
    constructor() {
        this.logs = [];
        this.loadLogs();
    }

    loadLogs() {
        try {
            const saved = localStorage.getItem(LOG_KEY);
            if (saved) {
                this.logs = JSON.parse(saved);
            }
        } catch (e) {
            this.logs = [];
        }
    }

    saveLogs() {
        try {
            // Keep only last MAX_LOG_ENTRIES
            if (this.logs.length > MAX_LOG_ENTRIES) {
                this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
            }
            localStorage.setItem(LOG_KEY, JSON.stringify(this.logs));
        } catch (e) {
            console.error('Failed to save logs:', e);
        }
    }

    log(level, component, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            component,
            message,
            data: data ? JSON.stringify(data).substring(0, 500) : null
        };

        this.logs.push(entry);
        this.saveLogs();

        // Also log to console with color coding
        const color = level === 'ERROR' ? 'color: red' :
            level === 'WARN' ? 'color: orange' :
                level === 'SUCCESS' ? 'color: green' : 'color: blue';

        console.log(`%c[${entry.timestamp}] [${component}] ${message}`, color, data || '');
    }

    info(component, message, data) {
        this.log('INFO', component, message, data);
    }

    warn(component, message, data) {
        this.log('WARN', component, message, data);
    }

    error(component, message, data) {
        this.log('ERROR', component, message, data);
    }

    success(component, message, data) {
        this.log('SUCCESS', component, message, data);
    }

    // Export logs as downloadable file
    exportLogs() {
        const logText = this.logs.map(entry =>
            `[${entry.timestamp}] [${entry.level}] [${entry.component}] ${entry.message}${entry.data ? '\n  Data: ' + entry.data : ''}`
        ).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `onboarding_log_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Get recent logs for display
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    // Clear all logs
    clearLogs() {
        this.logs = [];
        localStorage.removeItem(LOG_KEY);
    }
}

// Singleton instance
const logger = new OnboardingLogger();

export default logger;
