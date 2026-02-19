import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Plus, Edit3, Trash2, Target, TrendingDown,
    ChevronDown, ChevronRight, X
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { ConfidenceEmoji } from '../ui/ConfidenceIndicator'
import type { ConfidenceLevel } from '../ui/ConfidenceIndicator'
import { ActionPlanList } from './ActionPlanList'
import { cn } from '../../lib/utils'

// =====================================================
// TYPES
// =====================================================

export interface QuarterlyKRData {
    id: string
    code: string
    title: string
    quarter: number | null
    baseline: number | null
    target: number | null
    actual: number | null
    progress: number | null
    confidence: ConfidenceLevel
    metric_type: string
    unit: string
    objective_id: string
    owner_name: string | null
    source: string | null
    scope: 'annual' | 'quarterly'
    parent_kr_id: string | null
    target_direction: 'maximize' | 'minimize'
}

export interface QuarterlyTimelineProps {
    annualKR: QuarterlyKRData
    quarterlyKRs: QuarterlyKRData[]
    currentQuarter: number
    onAddQuarterlyKR: (quarter: number) => void
    onEditKR: (kr: QuarterlyKRData) => void
    onDeleteKR: (krId: string) => void
    onUpdateValue?: (krId: string, field: 'baseline' | 'target' | 'actual', value: number | null) => void
    onUpdateConfidence?: (krId: string, confidence: ConfidenceLevel) => void
}

// =====================================================
// HELPERS
// =====================================================

function fmtVal(v: number | null, metricType: string, unit: string): string {
    if (v === null || v === undefined) return '—'
    if (metricType === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
    if (metricType === 'percentage') return `${v}%`
    return `${v}${unit ? ` ${unit}` : ''}`
}

function progressVariant(p: number): 'success' | 'warning' | 'danger' {
    if (p >= 70) return 'success'
    if (p >= 40) return 'warning'
    return 'danger'
}

// =====================================================
// COMPONENT
// =====================================================

export function QuarterlyTimeline({
    annualKR,
    quarterlyKRs,
    currentQuarter,
    onAddQuarterlyKR,
    onEditKR,
    onDeleteKR,
    onUpdateValue,
    onUpdateConfidence,
}: QuarterlyTimelineProps) {
    const { t } = useTranslation()

    // Which quarterly KR has its actions expanded
    const [expandedActionKR, setExpandedActionKR] = useState<string | null>(null)

    // Confidence editing state (same pattern as KRTable)
    const [editingConfidence, setEditingConfidence] = useState<string | null>(null)

    // Inline editing state
    const [editingCell, setEditingCell] = useState<{ krId: string; field: string } | null>(null)
    const [editValue, setEditValue] = useState('')

    const quarters = [1, 2, 3, 4]

    // Group KRs by quarter
    const krsByQuarter: Record<number, QuarterlyKRData[]> = {}
    quarters.forEach(q => {
        krsByQuarter[q] = quarterlyKRs
            .filter(kr => kr.quarter === q)
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    })

    const isMinimize = annualKR.target_direction === 'minimize'

    // Inline editing helpers
    function startEdit(krId: string, field: string, currentVal: number | null) {
        setEditingCell({ krId, field })
        setEditValue(currentVal !== null ? String(currentVal) : '')
    }

    function saveEdit(krId: string, field: 'baseline' | 'target' | 'actual') {
        const val = editValue.trim() === '' ? null : Number(editValue)
        onUpdateValue?.(krId, field, val)
        setEditingCell(null)
    }

    function cancelEdit() {
        setEditingCell(null)
        setEditValue('')
    }

    function renderEditableCell(kr: QuarterlyKRData, field: 'baseline' | 'target' | 'actual', value: number | null) {
        const isEditing = editingCell?.krId === kr.id && editingCell?.field === field

        if (isEditing) {
            return (
                <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kr.id, field)
                        if (e.key === 'Escape') cancelEdit()
                    }}
                    onBlur={() => saveEdit(kr.id, field)}
                    className="w-full max-w-[80px] px-1.5 py-0.5 text-xs text-center rounded border border-[var(--color-primary)] bg-[var(--color-surface)] outline-none"
                    autoFocus
                />
            )
        }

        const colorClass =
            field === 'baseline' ? 'text-[var(--color-text-secondary)]' :
                field === 'target' ? 'text-[var(--color-success)]' :
                    'text-[var(--color-primary)] font-medium'

        return (
            <span
                className={cn('cursor-pointer hover:underline text-xs', colorClass)}
                onClick={() => startEdit(kr.id, field, value)}
                title={t('common.edit')}
            >
                {fmtVal(value, kr.metric_type || annualKR.metric_type, kr.unit || annualKR.unit)}
            </span>
        )
    }

    return (
        <div className="space-y-3">
            {/* Annual Summary Bar */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-[var(--color-surface-subtle)] to-[var(--color-surface)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Target className="w-4 h-4 text-[var(--color-primary)]" />
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                        Meta Anual
                    </span>
                </div>
                <div className="flex items-center gap-6 flex-1">
                    <div className="text-center">
                        <span className="text-[10px] text-[var(--color-text-muted)] block">Baseline</span>
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                            {fmtVal(annualKR.baseline, annualKR.metric_type, annualKR.unit)}
                        </span>
                    </div>
                    <div className="text-center">
                        <span className="text-[10px] text-[var(--color-text-muted)] block">Target</span>
                        <span className="text-sm font-bold text-[var(--color-success)]">
                            {fmtVal(annualKR.target, annualKR.metric_type, annualKR.unit)}
                        </span>
                    </div>
                    {isMinimize && (
                        <div className="flex items-center gap-1 text-[10px] text-orange-500">
                            <TrendingDown className="w-3 h-3" />
                            Minimizar
                        </div>
                    )}
                </div>
                {annualKR.progress !== null && (
                    <div className="flex items-center gap-2 flex-shrink-0 min-w-[120px]">
                        <ProgressBar value={annualKR.progress} size="sm" variant="gradient" />
                        <Badge variant={progressVariant(annualKR.progress)} size="sm">
                            {annualKR.progress}%
                        </Badge>
                    </div>
                )}
            </div>

            {/* Quarter Sections (stacked) */}
            {quarters.map(q => {
                const krs = krsByQuarter[q]
                const isCurrent = q === currentQuarter
                const isPast = q < currentQuarter
                const hasKRs = krs.length > 0

                return (
                    <div
                        key={q}
                        className={cn(
                            'rounded-xl border overflow-hidden transition-all duration-200',
                            isCurrent
                                ? 'border-[var(--color-primary)] shadow-[0_0_0_1px_var(--color-primary)]/20'
                                : hasKRs
                                    ? 'border-[var(--color-border)]'
                                    : 'border-dashed border-[var(--color-border)]'
                        )}
                    >
                        {/* Quarter Header */}
                        <div className={cn(
                            'flex items-center justify-between px-4 py-2',
                            isCurrent
                                ? 'bg-[var(--color-primary)]/10'
                                : isPast
                                    ? 'bg-[var(--color-surface-subtle)]'
                                    : 'bg-[var(--color-surface-subtle)]/30'
                        )}>
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={isCurrent ? 'info' : 'outline'}
                                    size="sm"
                                    className="text-[10px] font-bold"
                                >
                                    Q{q}
                                </Badge>
                                {isCurrent && (
                                    <span className="text-[9px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                                        Atual
                                    </span>
                                )}
                                {hasKRs && (
                                    <span className="text-[10px] text-[var(--color-text-muted)]">
                                        {krs.length} KR{krs.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => onAddQuarterlyKR(q)}
                                className={cn(
                                    'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide transition-all duration-200',
                                    isCurrent
                                        ? 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                                )}
                            >
                                <Plus className="w-3 h-3" />
                                Novo KR
                            </button>
                        </div>

                        {/* KR Rows */}
                        {hasKRs ? (
                            <div className="divide-y divide-[var(--color-border-subtle)]">
                                {krs.map(kr => {
                                    const prog = kr.progress ?? 0
                                    const isActionsOpen = expandedActionKR === kr.id

                                    return (
                                        <div key={kr.id}>
                                            {/* KR Row */}
                                            <div className="group/kr hover:bg-[var(--color-surface-hover)] transition-colors">
                                                <div className="flex items-center gap-3 px-4 py-2.5">
                                                    {/* Expand toggle for actions */}
                                                    <button
                                                        onClick={() => setExpandedActionKR(isActionsOpen ? null : kr.id)}
                                                        className={cn(
                                                            'p-0.5 rounded transition-all duration-200',
                                                            isActionsOpen
                                                                ? 'text-[var(--color-primary)]'
                                                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                                                        )}
                                                        title="Ver ações"
                                                    >
                                                        {isActionsOpen
                                                            ? <ChevronDown className="w-3.5 h-3.5" />
                                                            : <ChevronRight className="w-3.5 h-3.5" />
                                                        }
                                                    </button>

                                                    {/* Code + Title */}
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className="text-[10px] font-mono font-bold text-[var(--color-text-muted)] flex-shrink-0">
                                                            {kr.code}
                                                        </span>
                                                        <span className="text-xs text-[var(--color-text-primary)] truncate">
                                                            {kr.title}
                                                        </span>
                                                    </div>

                                                    {/* Values */}
                                                    <div className="flex items-center gap-4 flex-shrink-0">
                                                        <div className="text-center w-16">
                                                            <span className="text-[9px] text-[var(--color-text-muted)] block leading-none mb-0.5">Base</span>
                                                            {renderEditableCell(kr, 'baseline', kr.baseline)}
                                                        </div>
                                                        <div className="text-center w-16">
                                                            <span className="text-[9px] text-[var(--color-text-muted)] block leading-none mb-0.5">Meta</span>
                                                            {renderEditableCell(kr, 'target', kr.target)}
                                                        </div>
                                                        <div className="text-center w-16">
                                                            <span className="text-[9px] text-[var(--color-text-muted)] block leading-none mb-0.5">Real</span>
                                                            {renderEditableCell(kr, 'actual', kr.actual)}
                                                        </div>
                                                    </div>

                                                    {/* Progress */}
                                                    <div className="flex items-center gap-1.5 flex-shrink-0 w-28">
                                                        <ProgressBar value={prog} size="sm" variant="gradient" />
                                                        <Badge variant={progressVariant(prog)} size="sm">
                                                            {prog}%
                                                        </Badge>
                                                    </div>

                                                    {/* Confidence */}
                                                    <div className="flex items-center flex-shrink-0">
                                                        {editingConfidence === kr.id ? (
                                                            <div className="flex items-center gap-1">
                                                                {(['on_track', 'at_risk', 'off_track'] as ConfidenceLevel[]).map(level => (
                                                                    <button
                                                                        key={level}
                                                                        onClick={() => {
                                                                            onUpdateConfidence?.(kr.id, level)
                                                                            setEditingConfidence(null)
                                                                        }}
                                                                        className="text-base hover:scale-125 transition-transform"
                                                                    >
                                                                        <ConfidenceEmoji value={level} />
                                                                    </button>
                                                                ))}
                                                                <button
                                                                    onClick={() => setEditingConfidence(null)}
                                                                    className="ml-1 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => onUpdateConfidence && setEditingConfidence(kr.id)}
                                                                className={cn(
                                                                    'transition-transform',
                                                                    onUpdateConfidence && 'hover:scale-125 cursor-pointer'
                                                                )}
                                                                disabled={!onUpdateConfidence}
                                                            >
                                                                <ConfidenceEmoji value={kr.confidence} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Actions (edit/delete) */}
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/kr:opacity-100 transition-opacity flex-shrink-0">
                                                        <button
                                                            onClick={() => onEditKR(kr)}
                                                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                                                            title={t('common.edit')}
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(t('okr.deleteKRConfirm'))) {
                                                                    onDeleteKR(kr.id)
                                                                }
                                                            }}
                                                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                                                            title={t('common.delete')}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded: Action Plans */}
                                            {isActionsOpen && (
                                                <div className="px-6 py-4 bg-[var(--color-surface-subtle)]/60 border-t border-[var(--color-border-subtle)]">
                                                    <ActionPlanList krId={kr.id} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            /* Empty quarter */
                            <div className="px-4 py-4 text-center">
                                <p className="text-[11px] text-[var(--color-text-muted)]">
                                    Nenhum KR definido para este trimestre
                                </p>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
