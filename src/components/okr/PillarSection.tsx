import { useState } from 'react'
import {
    ChevronDown, ChevronRight,
    TrendingUp, Truck, Shield, Target, Users, DollarSign, Clock, Pin
} from 'lucide-react'
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
}

// Map icon names to Lucide icons
const iconMap: Record<string, React.ElementType> = {
    'trending-up': TrendingUp,
    'truck': Truck,
    'shield': Shield,
    'target': Target,
    'users': Users,
    'dollar-sign': DollarSign,
    'clock': Clock
}

export function PillarSection({ pillar, children, defaultExpanded = true, actions }: PillarSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)

    const Icon = iconMap[pillar.icon] || Pin

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
