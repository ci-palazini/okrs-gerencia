import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit3, Trash2, X, ChevronDown, CalendarRange } from 'lucide-react'
import { ProgressBar } from '../ui/ProgressBar'
import { Badge } from '../ui/Badge'
import { ConfidenceEmoji } from '../ui/ConfidenceIndicator'
import type { ConfidenceLevel } from '../ui/ConfidenceIndicator'
import { cn, formatKRCurrency } from '../../lib/utils'
import { DeadlineIndicator } from './DeadlineIndicator'

interface KeyResultRow {
    id: string
    code: string
    title: string
    owner_name: string | null
    source: string | null
    metric_type: string
    unit: string
    currency_type?: string | null
    progress: number | null
    confidence: ConfidenceLevel
    scope?: 'annual' | 'quarterly'
    quarter?: number | null
    objective_id?: string
    due_date?: string | null
    is_active?: boolean
    // Quarterly data
    baseline?: number | null
    target?: number | null
    actual?: number | null
}

interface KRTableProps {
    keyResults: KeyResultRow[]
    onEdit?: (kr: KeyResultRow) => void
    onDelete?: (krId: string) => void
    onUpdateConfidence?: (krId: string, confidence: ConfidenceLevel) => void
    onUpdateValue?: (krId: string, field: 'baseline' | 'target' | 'actual', value: number | null) => void
    compact?: boolean
    showDataColumns?: boolean // Show Baseline, Target, Real columns
}


export function KRTable({
    keyResults,
    onEdit,
    onDelete,
    onUpdateConfidence,
    onUpdateValue,
    renderExpandedRow, // New prop
    compact = false,
    showDataColumns = true
}: KRTableProps & { renderExpandedRow?: (kr: KeyResultRow) => React.ReactNode }) {
    const [editingConfidence, setEditingConfidence] = useState<string | null>(null)
    const [editingCell, setEditingCell] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const { t } = useTranslation()
    const hasActions = Boolean(onEdit || onDelete)
    const expandedColSpan = (showDataColumns ? 10 : 7) + (hasActions ? 1 : 0)

    const toggleExpand = (krId: string) => {
        const newExpanded = new Set(expandedIds)
        if (newExpanded.has(krId)) {
            newExpanded.delete(krId)
        } else {
            newExpanded.add(krId)
        }
        setExpandedIds(newExpanded)
    }

    const getProgressVariant = (progress: number): 'success' | 'warning' | 'danger' => {
        if (progress >= 70) return 'success'
        if (progress >= 40) return 'warning'
        return 'danger'
    }

    const formatValue = (value: number | null | undefined, metricType: string, unit: string, currencyType?: string | null): string => {
        if (value === null || value === undefined) return '-'

        if (metricType === 'currency') {
            return formatKRCurrency(value, currencyType)
        }

        if (metricType === 'percentage') {
            return `${value}%`
        }

        return `${value}${unit ? ` ${unit}` : ''}`
    }

    const startEditCell = (krId: string, field: string, currentValue: number | null | undefined) => {
        setEditingCell(`${krId}-${field}`)
        setEditValue(currentValue?.toString() || '')
    }

    const saveEditCell = (krId: string, field: 'baseline' | 'target' | 'actual') => {
        const numValue = editValue.trim() ? parseFloat(editValue) : null
        onUpdateValue?.(krId, field, numValue)
        setEditingCell(null)
        setEditValue('')
    }

    const cancelEdit = () => {
        setEditingCell(null)
        setEditValue('')
    }

    return (
        <div className={cn('overflow-x-auto', compact && 'text-xs')}>
            <table className="w-full">
                <thead>
                    <tr className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                        <th className="px-3 py-3 w-8"></th> {/* Expand toggle column */}
                        <th className="px-3 py-3 w-28">KR</th>
                        <th className="px-3 py-3">{t('common.description')}</th>
                        <th className="px-3 py-3 w-28">{t('quarterlyCard.owner')}</th>
                        {showDataColumns && (
                            <>
                                <th className="px-3 py-3 w-20 text-center">{t('quarterlyCard.baseline')}</th>
                                <th className="px-3 py-3 w-20 text-center">{t('quarterlyCard.actual')}</th>
                                <th className="px-3 py-3 w-20 text-center">{t('quarterlyCard.target')}</th>
                            </>
                        )}
                        <th className="px-3 py-3 w-28">{t('quarterlyCard.progress')}</th>
                        <th className="px-3 py-3 w-24 text-center">{t('quarterlyCard.confidence')}</th>
                        <th className="px-3 py-3 w-32 text-center">{t('deadline.label')}</th>
                        {hasActions && <th className="px-3 py-3 w-20 text-right"></th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                    {keyResults.map((kr) => {
                        const isExpanded = expandedIds.has(kr.id)
                        return (
                            <Fragment key={kr.id}>
                                <tr
                                    className={cn(
                                        "group transition-colors",
                                        isExpanded ? "bg-[var(--color-surface-hover)]" : "hover:bg-[var(--color-surface-hover)]"
                                    )}
                                >
                                    {/* Expand Toggle */}
                                    <td className="px-3 py-3">
                                        {renderExpandedRow && (
                                            <button
                                                onClick={() => toggleExpand(kr.id)}
                                                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text-muted)] transition-colors"
                                            >
                                                <ChevronDown className={cn(
                                                    "w-4 h-4 transition-transform duration-200",
                                                    isExpanded && "transform rotate-180"
                                                )} />
                                            </button>
                                        )}
                                    </td>

                                    {/* Code + Scope Badge */}
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-sm whitespace-nowrap">
                                                {kr.code}
                                            </span>
                                            {kr.scope === 'annual' && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                                                    <CalendarRange className="w-3 h-3" /> {t('quarterlyCard.annual')}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Title */}
                                    <td className="px-3 py-3">
                                        <p className="font-medium text-[var(--color-text-primary)] text-sm cursor-pointer hover:text-[var(--color-primary)]" onClick={() => renderExpandedRow && toggleExpand(kr.id)}>
                                            {kr.title}
                                        </p>
                                    </td>

                                    {/* Owner */}
                                    <td className="px-3 py-3">
                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                            {kr.owner_name || '-'}
                                        </span>
                                    </td>

                                    {/* Data Columns: Baseline, Real, Target */}
                                    {showDataColumns && (
                                        <>
                                            {/* Baseline */}
                                            <td className="px-3 py-3 text-center">
                                                {editingCell === `${kr.id}-baseline` ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            className="w-16 px-2 py-1 text-xs text-center rounded border border-[var(--color-primary)] bg-[var(--color-surface)] focus:outline-none"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEditCell(kr.id, 'baseline')
                                                                if (e.key === 'Escape') cancelEdit()
                                                            }}
                                                            onBlur={() => saveEditCell(kr.id, 'baseline')}
                                                        />
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => onUpdateValue && startEditCell(kr.id, 'baseline', kr.baseline)}
                                                        className={cn(
                                                            'text-xs px-2 py-1 rounded',
                                                            onUpdateValue && 'hover:bg-[var(--color-surface)] cursor-pointer'
                                                        )}
                                                        disabled={!onUpdateValue}
                                                    >
                                                        {formatValue(kr.baseline, kr.metric_type, kr.unit, kr.currency_type)}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Actual/Real */}
                                            <td className="px-3 py-3 text-center">
                                                {editingCell === `${kr.id}-actual` ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            className="w-16 px-2 py-1 text-xs text-center rounded border border-[var(--color-primary)] bg-[var(--color-surface)] focus:outline-none"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEditCell(kr.id, 'actual')
                                                                if (e.key === 'Escape') cancelEdit()
                                                            }}
                                                            onBlur={() => saveEditCell(kr.id, 'actual')}
                                                        />
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => onUpdateValue && startEditCell(kr.id, 'actual', kr.actual)}
                                                        className={cn(
                                                            'text-xs px-2 py-1 rounded font-medium text-[var(--color-primary)]',
                                                            onUpdateValue && 'hover:bg-[var(--color-surface)] cursor-pointer'
                                                        )}
                                                        disabled={!onUpdateValue}
                                                    >
                                                        {formatValue(kr.actual, kr.metric_type, kr.unit, kr.currency_type)}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Target */}
                                            <td className="px-3 py-3 text-center">
                                                {editingCell === `${kr.id}-target` ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            className="w-16 px-2 py-1 text-xs text-center rounded border border-[var(--color-primary)] bg-[var(--color-surface)] focus:outline-none"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEditCell(kr.id, 'target')
                                                                if (e.key === 'Escape') cancelEdit()
                                                            }}
                                                            onBlur={() => saveEditCell(kr.id, 'target')}
                                                        />
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => onUpdateValue && startEditCell(kr.id, 'target', kr.target)}
                                                        className={cn(
                                                            'text-xs px-2 py-1 rounded text-[var(--color-success)]',
                                                            onUpdateValue && 'hover:bg-[var(--color-surface)] cursor-pointer'
                                                        )}
                                                        disabled={!onUpdateValue}
                                                    >
                                                        {formatValue(kr.target, kr.metric_type, kr.unit, kr.currency_type)}
                                                    </button>
                                                )}
                                            </td>
                                        </>
                                    )}

                                    {/* Progress */}
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 min-w-16">
                                                <ProgressBar
                                                    value={kr.progress ?? 0}
                                                    size="sm"
                                                    variant="gradient"
                                                />
                                            </div>
                                            <Badge variant={getProgressVariant(kr.progress ?? 0)} size="sm">
                                                {kr.progress ?? 0}%
                                            </Badge>
                                        </div>
                                    </td>

                                    {/* Confidence */}
                                    <td className="px-3 py-3 text-center">
                                        {editingConfidence === kr.id ? (
                                            <div className="flex items-center justify-center gap-1">
                                                {(['on_track', 'at_risk', 'off_track'] as ConfidenceLevel[]).map((level) => (
                                                    <button
                                                        key={level}
                                                        onClick={() => {
                                                            onUpdateConfidence?.(kr.id, level)
                                                            setEditingConfidence(null)
                                                        }}
                                                        className="text-lg hover:scale-125 transition-transform"
                                                    >
                                                        <ConfidenceEmoji value={level} />
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setEditingConfidence(null)}
                                                    className="ml-1 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
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
                                    </td>

                                    {/* Deadline */}
                                    <td className="px-3 py-3 text-center">
                                        {kr.due_date ? (
                                            <DeadlineIndicator 
                                                dueDate={kr.due_date} 
                                                isCompleted={kr.progress === 100 || kr.is_active === false}
                                                variant="both"
                                            />
                                        ) : (
                                            <span className="text-xs text-[var(--color-text-muted)]">-</span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    {hasActions && (
                                        <td className="px-3 py-3 text-right whitespace-nowrap">
                                            {onEdit && (
                                                <button
                                                    onClick={() => onEdit(kr)}
                                                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 opacity-0 group-hover:opacity-100 transition-all mr-1"
                                                    title={t('quarterlyCard.editKR')}
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(t('okr.deleteKRConfirm'))) {
                                                            onDelete(kr.id)
                                                        }
                                                    }}
                                                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    title={t('quarterlyCard.deleteKR')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                                {isExpanded && renderExpandedRow && (
                                    <tr>
                                        <td colSpan={expandedColSpan} className="p-0 bg-[var(--color-surface-subtle)]/50 border-b border-[var(--color-border)] animate-in slide-in-from-top-2 duration-200">
                                            <div className="p-4 pl-14">
                                                {renderExpandedRow(kr)}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        )
                    })}
                </tbody>
            </table>

            {keyResults.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                    {t('quarterlyCard.noKRsFound')}
                </div>
            )}
        </div>
    )
}
