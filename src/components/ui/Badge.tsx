import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
    size?: 'sm' | 'md' | 'lg'
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', size = 'md', ...props }, ref) => {
        const variants = {
            default: 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
            success: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
            warning: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
            danger: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]',
            info: 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]',
            outline: 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'
        }

        const sizes = {
            sm: 'text-xs px-2 py-0.5',
            md: 'text-sm px-2.5 py-1',
            lg: 'text-base px-3 py-1.5'
        }

        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center font-medium rounded-full transition-colors',
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        )
    }
)
Badge.displayName = 'Badge'

export { Badge }
