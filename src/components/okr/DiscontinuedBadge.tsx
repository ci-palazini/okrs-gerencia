import { useTranslation } from 'react-i18next'
import { Archive } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DiscontinuedBadgeProps {
    reason?: string | null
    size?: 'sm' | 'md'
    className?: string
}

/**
 * Selo neutro indicando que um OKR foi descontinuado (não mais acompanhado).
 * Distinto do verde de "concluído". Mostra o motivo no tooltip, se houver.
 */
export function DiscontinuedBadge({ reason, size = 'sm', className }: DiscontinuedBadgeProps) {
    const { t } = useTranslation()
    return (
        <span
            title={reason || t('okr.discontinue.badgeTooltip')}
            className={cn(
                'inline-flex items-center gap-1 font-medium rounded-full border border-dashed',
                'border-[var(--color-text-muted)] text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]',
                size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
                className
            )}
        >
            <Archive className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            {t('okr.discontinue.badge')}
        </span>
    )
}
