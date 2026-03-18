import { cn } from '../../lib/utils'
import { CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react'

export type ConfidenceLevel = 'on_track' | 'at_risk' | 'off_track' | null

interface ConfidenceIndicatorProps {
    value: ConfidenceLevel
    onChange?: (value: ConfidenceLevel) => void
    size?: 'sm' | 'md' | 'lg'
    editable?: boolean
    showLabel?: boolean
}

const confidenceConfig = {
    on_track: {
        icon: CheckCircle2,
        color: 'text-[var(--color-success)]',
        bg: 'bg-[var(--color-success)]/15',
        label: 'Alta confiança',
        fillColor: 'fill-[var(--color-success)]'
    },
    at_risk: {
        icon: AlertTriangle,
        color: 'text-[var(--color-warning)]',
        bg: 'bg-[var(--color-warning)]/15',
        label: 'Média confiança',
        fillColor: 'fill-[var(--color-warning)]'
    },
    off_track: {
        icon: XCircle,
        color: 'text-[var(--color-danger)]',
        bg: 'bg-[var(--color-danger)]/15',
        label: 'Baixa confiança',
        fillColor: 'fill-[var(--color-danger)]'
    }
}

const sizeConfig = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
}

export function ConfidenceIndicator({
    value,
    onChange,
    size = 'md',
    editable = false,
    showLabel = false
}: ConfidenceIndicatorProps) {

    if (!editable) {
        if (!value) {
            return (
                <div className="flex items-center gap-2">
                    <Circle className={cn(sizeConfig[size], 'text-[var(--color-text-muted)]')} />
                    {showLabel && <span className="text-sm text-[var(--color-text-muted)]">Não definido</span>}
                </div>
            )
        }

        const config = confidenceConfig[value]
        const Icon = config.icon

        return (
            <div className="flex items-center gap-2">
                <div className={cn('flex items-center justify-center rounded-full p-1', config.bg)}>
                    <Icon className={cn(sizeConfig[size], config.color)} />
                </div>
                {showLabel && <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>}
            </div>
        )
    }

    // Editable mode - show all 3 options
    return (
        <div className="flex items-center gap-1">
            {(Object.keys(confidenceConfig) as ConfidenceLevel[]).filter(Boolean).map((level) => {
                if (!level) return null
                const config = confidenceConfig[level]
                const Icon = config.icon
                const isSelected = value === level

                return (
                    <button
                        type="button"
                        key={level}
                        onClick={() => onChange?.(level)}
                        className={cn(
                            'p-1.5 rounded-lg border border-transparent transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-surface)]',
                            isSelected
                                ? cn(config.bg, config.color, 'border-current shadow-sm opacity-100')
                                : 'opacity-50 hover:opacity-85 hover:bg-[var(--color-surface-hover)]'
                        )}
                        title={config.label}
                    >
                        <Icon className={cn(sizeConfig[size], config.color)} />
                    </button>
                )
            })}
        </div>
    )
}

// Icon-based confidence indicator for tables (no emojis)
export function ConfidenceEmoji({ value, size = 'sm' }: { value: ConfidenceLevel; size?: 'sm' | 'md' | 'lg' }) {
    if (!value) return <Circle className={cn(sizeConfig[size], 'text-[var(--color-text-muted)]')} />

    const config = confidenceConfig[value]
    const Icon = config.icon
    return (
        <div className={cn('inline-flex items-center justify-center rounded-full p-0.5', config.bg)}>
            <Icon className={cn(sizeConfig[size], config.color)} />
        </div>
    )
}
