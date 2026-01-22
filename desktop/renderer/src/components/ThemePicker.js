/**
 * Theme Picker Component
 * 
 * Minimal bottom-left UI with color swatch and arrows to cycle themes
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemePicker.css';

function ThemePicker() {
    const { currentTheme, nextTheme, prevTheme, mode, toggleMode } = useTheme();

    return (
        <div className="theme-picker">
            <button
                className="theme-arrow"
                onClick={prevTheme}
                title="Previous theme"
            >
                <ChevronLeft size={14} />
            </button>

            <div
                className="theme-swatch"
                style={{ background: currentTheme.accent }}
                title={currentTheme.name}
            />

            <button
                className="theme-arrow"
                onClick={nextTheme}
                title="Next theme"
            >
                <ChevronRight size={14} />
            </button>

            <button
                className="mode-toggle"
                onClick={toggleMode}
                title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
            >
                {mode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
        </div>
    );
}

export default ThemePicker;
