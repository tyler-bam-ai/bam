/**
 * ValueMetricsCards Component
 * Visual display of ROI metrics for dashboard - hours saved, questions answered, value generated
 */

import React from 'react';
import {
    Clock,
    MessageSquare,
    DollarSign,
    TrendingUp,
    ArrowUp,
    ArrowDown,
    Sparkles
} from 'lucide-react';
import './ValueMetricsCards.css';

function ValueMetricsCards({ metrics, weeklyActivity, isDemo = false }) {
    if (!metrics) return null;

    const formatValue = (value) => {
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}k`;
        }
        return `$${value.toLocaleString()}`;
    };

    const formatHours = (hours) => {
        if (hours >= 100) {
            return hours.toFixed(0);
        }
        return hours.toFixed(1);
    };

    return (
        <div className="value-metrics">
            {/* Header */}
            <div className="value-metrics-header">
                <div className="header-title">
                    <Sparkles size={20} />
                    <h3>BAM Value This Month</h3>
                </div>
                {isDemo && <span className="demo-badge">Demo Data</span>}
            </div>

            {/* Primary Value Cards */}
            <div className="primary-metrics">
                {/* Hours Saved */}
                <div className="metric-card metric-hours">
                    <div className="metric-icon">
                        <Clock size={28} />
                    </div>
                    <div className="metric-content">
                        <span className="metric-value">
                            {formatHours(metrics.hoursSaved)}
                            <span className="metric-unit">hrs</span>
                        </span>
                        <span className="metric-label">Hours Saved</span>
                        {metrics.hoursSavedDelta && (
                            <span className={`metric-delta ${metrics.hoursSavedDelta > 0 ? 'positive' : 'negative'}`}>
                                {metrics.hoursSavedDelta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                {Math.abs(metrics.hoursSavedDelta).toFixed(1)}hrs vs last week
                            </span>
                        )}
                    </div>
                </div>

                {/* Questions Answered */}
                <div className="metric-card metric-questions">
                    <div className="metric-icon">
                        <MessageSquare size={28} />
                    </div>
                    <div className="metric-content">
                        <span className="metric-value">
                            {metrics.questionsAnswered.toLocaleString()}
                        </span>
                        <span className="metric-label">Questions Answered</span>
                        {metrics.questionsAnsweredDelta && (
                            <span className={`metric-delta ${metrics.questionsAnsweredDelta > 0 ? 'positive' : 'negative'}`}>
                                {metrics.questionsAnsweredDelta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                {Math.abs(metrics.questionsAnsweredDelta)} vs last week
                            </span>
                        )}
                    </div>
                </div>

                {/* Estimated Value */}
                <div className="metric-card metric-value-generated featured">
                    <div className="metric-icon">
                        <DollarSign size={28} />
                    </div>
                    <div className="metric-content">
                        <span className="metric-value">
                            {formatValue(metrics.estimatedValue)}
                        </span>
                        <span className="metric-label">Salary Saved</span>
                        {metrics.estimatedValueDelta && (
                            <span className={`metric-delta positive`}>
                                <TrendingUp size={12} />
                                +{formatValue(metrics.estimatedValueDelta)} this month
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Weekly Activity Chart */}
            {weeklyActivity && weeklyActivity.length > 0 && (
                <div className="weekly-activity">
                    <h4>Weekly Activity</h4>
                    <div className="activity-chart">
                        {weeklyActivity.map((day, index) => {
                            const maxQuestions = Math.max(...weeklyActivity.map(d => d.questions), 1);
                            const height = (day.questions / maxQuestions) * 100;

                            return (
                                <div key={index} className="chart-bar-container">
                                    <div
                                        className="chart-bar"
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                        title={`${day.questions} questions`}
                                    >
                                        <span className="bar-value">{day.questions}</span>
                                    </div>
                                    <span className="bar-label">{day.day}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Secondary Stats Row */}
            <div className="secondary-metrics">
                <div className="secondary-stat">
                    <TrendingUp size={16} />
                    <span className="secondary-value">{metrics.knowledgeScore || 92}%</span>
                    <span className="secondary-label">Knowledge Score</span>
                </div>
                <div className="secondary-stat">
                    <TrendingUp size={16} />
                    <span className="secondary-value">{metrics.contentPosted || 23}</span>
                    <span className="secondary-label">Content Posted</span>
                </div>
                <div className="secondary-stat">
                    <Sparkles size={16} />
                    <span className="secondary-value">{metrics.employeesOnboarded || 4}</span>
                    <span className="secondary-label">Employees Onboarded</span>
                </div>
            </div>
        </div>
    );
}

export default ValueMetricsCards;
