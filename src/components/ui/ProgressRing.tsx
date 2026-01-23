import * as React from 'react'
import { cn, getStatusColor } from '../../lib/utils'

interface ProgressRingProps {
    value: number
    size?: number
    strokeWidth?: number
    showLabel?: boolean
    label?: string
    className?: string
}

export function ProgressRing({
    value,
    size = 120,
    strokeWidth = 8,
    showLabel = true,
    label,
    className
}: ProgressRingProps) {
    const status = getStatusColor(value)
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

    const colors = {
        success: {
            stroke: 'var(--color-success)',
            glow: 'rgba(16, 185, 129, 0.4)'
        },
        warning: {
            stroke: 'var(--color-warning)',
            glow: 'rgba(245, 158, 11, 0.4)'
        },
        danger: {
            stroke: 'var(--color-danger)',
            glow: 'rgba(239, 68, 68, 0.4)'
        }
    }

    return (
        <div className={cn('relative inline-flex items-center justify-center', className)}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--color-surface-hover)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={colors[status].stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease',
                        filter: `drop-shadow(0 0 6px ${colors[status].glow})`
                    }}
                />
            </svg>
            {showLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn(
                        'text-2xl font-bold',
                        status === 'success' && 'text-[var(--color-success)]',
                        status === 'warning' && 'text-[var(--color-warning)]',
                        status === 'danger' && 'text-[var(--color-danger)]'
                    )}>
                        {value.toFixed(0)}%
                    </span>
                    {label && (
                        <span className="text-xs text-[var(--color-text-muted)] mt-1">
                            {label}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
