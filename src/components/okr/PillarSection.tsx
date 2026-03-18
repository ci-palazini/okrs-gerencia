import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    ChevronDown, ChevronRight, Pin
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { cn } from '../../lib/utils'

interface PillarSectionProps {
    pillar: {
        id: string
        code: string
        name: string
        description: string
        icon: string
        color: string
    }
    children: React.ReactNode
    defaultExpanded?: boolean
    actions?: React.ReactNode
    deadlineStats?: {
        overdue: number
        urgent: number
        warning?: number
    }
}

// Helper to dynamic icon load
import * as LucideIcons from 'lucide-react'

// ...

export function PillarSection({
    pillar,
    children,
    defaultExpanded = true,
    actions,
    deadlineStats,
}: PillarSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const { t } = useTranslation()

    // Convert kebab-case (target) to PascalCase (Target)
    const iconName = pillar.icon
        ? pillar.icon.split('-').map((part: string) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
        : 'Circle'

    const Icon = (LucideIcons[iconName as keyof typeof LucideIcons] as React.ElementType) || Pin

    return (
        <div className="rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] overflow-hidden">
            {/* Header - using div instead of button to avoid nesting issues */}
            <div className="flex items-center gap-4 p-5 hover:bg-[var(--color-surface-hover)] transition-colors">
                {/* Clickable area for expand/collapse */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsExpanded(!isExpanded)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                >
                    {/* Pillar color indicator */}
                    <div
                        className="w-1.5 h-12 rounded-full"
                        style={{ backgroundColor: pillar.color }}
                    />

                    {/* Icon */}
                    <Icon className="w-8 h-8" style={{ color: pillar.color }} />

                    {/* Title & Description */}
                    <div className="flex-1 text-left">
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                            {pillar.name}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-1">
                            {pillar.description}
                        </p>
                        {deadlineStats && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {deadlineStats.overdue > 0 && (
                                    <Badge variant="danger" size="sm">
                                        {deadlineStats.overdue} {t(deadlineStats.overdue > 1 ? 'deadline.overduePlural' : 'deadline.overdue')}
                                    </Badge>
                                )}
                                {deadlineStats.urgent > 0 && (
                                    <Badge variant="warning" size="sm">
                                        {deadlineStats.urgent} {t(deadlineStats.urgent > 1 ? 'deadline.urgentPlural' : 'deadline.urgent')}
                                    </Badge>
                                )}
                                {deadlineStats.warning && deadlineStats.warning > 0 && (
                                    <Badge variant="info" size="sm">
                                        {t('deadline.attentionCount', { count: deadlineStats.warning })}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions - outside clickable area */}
                {actions && (
                    <div className="flex-shrink-0">
                        {actions}
                    </div>
                )}

                {/* Expand/Collapse Icon */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsExpanded(!isExpanded)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
                    className="cursor-pointer"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={cn(
                'overflow-hidden transition-all duration-300',
                isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            )}>
                <div className="border-t border-[var(--color-border)] p-5">
                    {children}
                </div>
            </div>
        </div>
    )
}
