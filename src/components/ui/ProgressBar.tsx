import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn, getStatusColor } from '../../lib/utils'

interface ProgressBarProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
    value: number
    showLabel?: boolean
    size?: 'sm' | 'md' | 'lg'
    variant?: 'default' | 'gradient'
}

const ProgressBar = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    ProgressBarProps
>(({ className, value, showLabel = false, size = 'md', variant = 'default', ...props }, ref) => {
    const status = getStatusColor(value)

    const heights = {
        sm: 'h-1.5',
        md: 'h-2.5',
        lg: 'h-4'
    }

    const colors = {
        success: 'bg-[var(--color-success)]',
        warning: 'bg-[var(--color-warning)]',
        danger: 'bg-[var(--color-danger)]'
    }

    const gradientColors = {
        success: 'bg-gradient-to-r from-[var(--color-success)] to-[var(--color-accent-cyan)]',
        warning: 'bg-gradient-to-r from-[var(--color-warning)] to-orange-500',
        danger: 'bg-gradient-to-r from-[var(--color-danger)] to-rose-400'
    }

    return (
        <div className="w-full">
            {showLabel && (
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-[var(--color-text-muted)]">Progress</span>
                    <span className={cn(
                        'text-sm font-semibold',
                        status === 'success' && 'text-[var(--color-success)]',
                        status === 'warning' && 'text-[var(--color-warning)]',
                        status === 'danger' && 'text-[var(--color-danger)]'
                    )}>
                        {value.toFixed(0)}%
                    </span>
                </div>
            )}
            <ProgressPrimitive.Root
                ref={ref}
                className={cn(
                    'relative w-full overflow-hidden rounded-full bg-[var(--color-surface-hover)]',
                    heights[size],
                    className
                )}
                {...props}
            >
                <ProgressPrimitive.Indicator
                    className={cn(
                        'h-full transition-all duration-500 ease-out rounded-full',
                        variant === 'gradient' ? gradientColors[status] : colors[status]
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </ProgressPrimitive.Root>
        </div>
    )
})
ProgressBar.displayName = 'ProgressBar'

export { ProgressBar }
