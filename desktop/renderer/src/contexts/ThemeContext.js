/**
 * Theme Context
 * 
 * Provides 10 color themes, each with light/dark mode variants
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// 10 color themes, each has dark and light variants
export const COLOR_THEMES = [
    { id: 'default', name: 'Default', accent: '#7c5cff', darkBg: '#0a0a0f', lightBg: '#ffffff' },
    { id: 'ocean', name: 'Ocean', accent: '#0ea5e9', darkBg: '#0c1929', lightBg: '#e6f2ff' },
    { id: 'forest', name: 'Forest', accent: '#22c55e', darkBg: '#0d1f0d', lightBg: '#e8f5e8' },
    { id: 'sunset', name: 'Sunset', accent: '#f97316', darkBg: '#1f0c0c', lightBg: '#fff5f0' },
    { id: 'purple', name: 'Purple', accent: '#a855f7', darkBg: '#150d1f', lightBg: '#f5f0ff' },
    { id: 'midnight', name: 'Midnight', accent: '#6366f1', darkBg: '#0a0a14', lightBg: '#f0f0f8' },
    { id: 'ember', name: 'Ember', accent: '#ef4444', darkBg: '#1a0f05', lightBg: '#fff8f0' },
    { id: 'arctic', name: 'Arctic', accent: '#06b6d4', darkBg: '#0f1a1a', lightBg: '#f0ffff' },
    { id: 'rose', name: 'Rose', accent: '#ec4899', darkBg: '#1a0f14', lightBg: '#fff0f5' },
    { id: 'slate', name: 'Slate', accent: '#64748b', darkBg: '#12141a', lightBg: '#f5f7fa' }
];

export function ThemeProvider({ children }) {
    // Get initial state from localStorage
    const [colorTheme, setColorTheme] = useState(() => {
        const saved = localStorage.getItem('bam_color_theme');
        const found = COLOR_THEMES.find(t => t.id === saved);
        return found ? saved : 'default';
    });

    const [mode, setMode] = useState(() => {
        const saved = localStorage.getItem('bam_theme_mode');
        return saved === 'light' ? 'light' : 'dark';
    });

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement;
        const theme = COLOR_THEMES.find(t => t.id === colorTheme) || COLOR_THEMES[0];

        // Remove all old theme classes
        root.className = root.className
            .split(' ')
            .filter(c => !c.startsWith('theme-'))
            .join(' ');

        // Add new theme class
        root.classList.add(`theme-${colorTheme}-${mode}`);

        // Set CSS variables for accent color
        root.style.setProperty('--accent-primary', theme.accent);
        root.style.setProperty('--theme-bg', mode === 'dark' ? theme.darkBg : theme.lightBg);

        // Save to localStorage
        localStorage.setItem('bam_color_theme', colorTheme);
        localStorage.setItem('bam_theme_mode', mode);

        console.log(`[THEME] Applied: ${colorTheme} (${mode})`);
    }, [colorTheme, mode]);

    // Cycle to next/previous theme
    const nextTheme = () => {
        setColorTheme(prev => {
            const idx = COLOR_THEMES.findIndex(t => t.id === prev);
            const nextIdx = (idx + 1) % COLOR_THEMES.length;
            return COLOR_THEMES[nextIdx].id;
        });
    };

    const prevTheme = () => {
        setColorTheme(prev => {
            const idx = COLOR_THEMES.findIndex(t => t.id === prev);
            const prevIdx = (idx - 1 + COLOR_THEMES.length) % COLOR_THEMES.length;
            return COLOR_THEMES[prevIdx].id;
        });
    };

    const toggleMode = () => {
        setMode(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const currentTheme = COLOR_THEMES.find(t => t.id === colorTheme) || COLOR_THEMES[0];

    const value = {
        colorTheme,
        setColorTheme,
        mode,
        setMode,
        toggleMode,
        nextTheme,
        prevTheme,
        isDarkMode: mode === 'dark',
        currentTheme,
        allThemes: COLOR_THEMES
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

