/**
 * Skeleton Loading Components
 * 
 * Animated placeholder components for loading states.
 */

import React from 'react';
import './Skeleton.css';

// Base skeleton element with shimmer animation
export function Skeleton({ width, height, borderRadius = '6px', className = '' }) {
    return (
        <div
            className={`skeleton ${className}`}
            style={{
                width: width || '100%',
                height: height || '20px',
                borderRadius
            }}
        />
    );
}

// Text skeleton with multiple lines
export function SkeletonText({ lines = 3, className = '' }) {
    return (
        <div className={`skeleton-text ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={i === lines - 1 ? '60%' : '100%'}
                    height="14px"
                />
            ))}
        </div>
    );
}

// Avatar skeleton
export function SkeletonAvatar({ size = 40 }) {
    return (
        <Skeleton
            width={`${size}px`}
            height={`${size}px`}
            borderRadius="50%"
        />
    );
}

// Card skeleton for dashboard-style cards
export function SkeletonCard({ className = '' }) {
    return (
        <div className={`skeleton-card ${className}`}>
            <div className="skeleton-card-header">
                <Skeleton width="120px" height="16px" />
                <Skeleton width="60px" height="28px" borderRadius="14px" />
            </div>
            <Skeleton width="80px" height="32px" />
            <Skeleton width="140px" height="12px" />
        </div>
    );
}

// Message skeleton for chat interfaces
export function SkeletonMessage({ isUser = false }) {
    return (
        <div className={`skeleton-message ${isUser ? 'user' : 'assistant'}`}>
            {!isUser && <SkeletonAvatar size={36} />}
            <div className="skeleton-message-content">
                <Skeleton width="80px" height="12px" />
                <SkeletonText lines={2} />
            </div>
            {isUser && <SkeletonAvatar size={36} />}
        </div>
    );
}

// Table row skeleton
export function SkeletonTableRow({ columns = 4 }) {
    return (
        <div className="skeleton-table-row">
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={i === 0 ? '150px' : '80px'}
                    height="16px"
                />
            ))}
        </div>
    );
}

// Full page loading skeleton
export function SkeletonPage() {
    return (
        <div className="skeleton-page">
            <div className="skeleton-header">
                <Skeleton width="200px" height="28px" />
                <Skeleton width="100px" height="36px" borderRadius="8px" />
            </div>
            <div className="skeleton-grid">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        </div>
    );
}

export default Skeleton;
