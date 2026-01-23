import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, icon, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                            {icon}
                        </div>
                    )}
                    <input
                        type={type}
                        className={cn(
                            'flex h-11 w-full rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
                            'hover:border-[var(--color-text-muted)]',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            icon && 'pl-10',
                            error && 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]',
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>
                )}
            </div>
        )
    }
)
Input.displayName = 'Input'

export { Input }
