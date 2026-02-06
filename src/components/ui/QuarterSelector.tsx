import { cn } from '../../lib/utils'

interface QuarterSelectorProps {
    quarter: number
    onSelect: (quarter: number) => void
    className?: string
}

export function QuarterSelector({ quarter, onSelect, className }: QuarterSelectorProps) {
    const quarters = [1, 2, 3, 4]

    return (
        <div className={cn(
            'inline-flex items-center p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]',
            className
        )}>
            {quarters.map((q) => (
                <button
                    key={q}
                    onClick={() => onSelect(q)}
                    className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 min-w-[3rem]',
                        quarter === q
                            ? 'bg-[var(--color-primary)] text-white shadow-md'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                    )}
                >
                    Q{q}
                </button>
            ))}
        </div>
    )
}
