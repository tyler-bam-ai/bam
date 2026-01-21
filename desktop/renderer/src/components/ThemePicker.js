/**
 * Theme Picker Component
 * 
 * Bottom-left UI with left/right arrows to cycle through 10 color themes
 * and a toggle for light/dark mode
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemePicker.css';

function ThemePicker() {
    const { currentTheme, nextTheme, prevTheme, mode, toggleMode } = useTheme();

    return (
        <div className="theme-picker">
            <div className="theme-selector">
                <button
                    className="theme-arrow"
                    onClick={prevTheme}
                    title="Previous theme"
                >
                    <ChevronLeft size={16} />
                </button>
                <div
                    className="theme-name"
                    style={{
                        borderBottom: `2px solid ${currentTheme.accent}`
                    }}
                >
                    {currentTheme.name}
                </div>
                <button
                    className="theme-arrow"
                    onClick={nextTheme}
                    title="Next theme"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
            <button
                className="mode-toggle"
                onClick={toggleMode}
                title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
                {mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
        </div>
    );
}

export default ThemePicker;
