/**
 * Theme Context
 * 
 * Provides light/dark mode toggle and theme persistence
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = {
    light: {
        name: 'Light',
        class: 'theme-light',
        icon: '☀️'
    },
    dark: {
        name: 'Dark',
        class: 'theme-dark',
        icon: '🌙'
    }
};

export function ThemeProvider({ children }) {
    // Get initial theme from localStorage or system preference
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('bam_theme');
        if (saved && THEMES[saved]) return saved;

        // Check system preference
        if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });

    // Apply theme class to document
    useEffect(() => {
        const root = document.documentElement;

        // Remove all theme classes
        Object.values(THEMES).forEach(t => {
            root.classList.remove(t.class);
        });

        // Add current theme class
        root.classList.add(THEMES[theme].class);

        // Save to localStorage
        localStorage.setItem('bam_theme', theme);

        console.log(`[THEME] Applied: ${theme}`);
    }, [theme]);

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e) => {
            const saved = localStorage.getItem('bam_theme');
            // Only auto-switch if user hasn't explicitly set a preference
            if (!saved) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const value = {
        theme,
        setTheme,
        toggleTheme,
        isDarkMode: theme === 'dark',
        themeInfo: THEMES[theme]
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
