import { useState } from 'react'
import { Edit3, X } from 'lucide-react'
import { ProgressBar } from '../ui/ProgressBar'
import { Badge } from '../ui/Badge'
import { ConfidenceEmoji } from '../ui/ConfidenceIndicator'
import type { ConfidenceLevel } from '../ui/ConfidenceIndicator'
import { cn } from '../../lib/utils'

interface KeyResultRow {
    id: string
    code: string
    title: string
    owner_name: string | null
    source: string | null
    metric_type: string
    unit: string
    progress: number
    confidence: ConfidenceLevel
    // Quarterly data
    baseline?: number | null
    target?: number | null
    actual?: number | null
}

interface KRTableProps {
    keyResults: KeyResultRow[]
    onEdit?: (kr: KeyResultRow) => void
    onUpdateConfidence?: (krId: string, confidence: ConfidenceLevel) => void
    onUpdateValue?: (krId: string, field: 'baseline' | 'target' | 'actual', value: number | null) => void
    compact?: boolean
    showDataColumns?: boolean // Show Baseline, Target, Real columns
}

export function KRTable({
    keyResults,
    onEdit,
    onUpdateConfidence,
    onUpdateValue,
    compact = false,
    showDataColumns = true
}: KRTableProps) {
    const [editingConfidence, setEditingConfidence] = useState<string | null>(null)
    const [editingCell, setEditingCell] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>('')

    const getProgressVariant = (progress: number): 'success' | 'warning' | 'danger' => {
        if (progress >= 70) return 'success'
        if (progress >= 40) return 'warning'
        return 'danger'
    }

    const formatValue = (value: number | null | undefined, metricType: string, unit: string): string => {
        if (value === null || value === undefined) return '-'

        if (metricType === 'currency') {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0
            }).format(value)
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
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                        <th className="px-3 py-3 w-14">KR</th>
                        <th className="px-3 py-3">Descrição</th>
                        <th className="px-3 py-3 w-28">Responsável</th>
                        {showDataColumns && (
                            <>
                                <th className="px-3 py-3 w-20 text-center">Baseline</th>
                                <th className="px-3 py-3 w-20 text-center">Real</th>
                                <th className="px-3 py-3 w-20 text-center">Target</th>
                            </>
                        )}
                        <th className="px-3 py-3 w-28">% Avanço</th>
                        <th className="px-3 py-3 w-24 text-center">Confiança</th>
                        {onEdit && <th className="px-3 py-3 w-10"></th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                    {keyResults.map((kr) => (
                        <tr
                            key={kr.id}
                            className="group hover:bg-[var(--color-surface-hover)] transition-colors"
                        >
                            {/* Code */}
                            <td className="px-3 py-3">
                                <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-sm">
                                    {kr.code}
                                </span>
                            </td>

                            {/* Title */}
                            <td className="px-3 py-3">
                                <p className="font-medium text-[var(--color-text-primary)] text-sm">
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
                                                {formatValue(kr.baseline, kr.metric_type, kr.unit)}
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
                                                {formatValue(kr.actual, kr.metric_type, kr.unit)}
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
                                                {formatValue(kr.target, kr.metric_type, kr.unit)}
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
                                            value={kr.progress}
                                            size="sm"
                                            variant="gradient"
                                        />
                                    </div>
                                    <Badge variant={getProgressVariant(kr.progress)} size="sm">
                                        {kr.progress}%
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

                            {/* Actions */}
                            {onEdit && (
                                <td className="px-3 py-3">
                                    <button
                                        onClick={() => onEdit(kr)}
                                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {keyResults.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                    Nenhum Key Result encontrado
                </div>
            )}
        </div>
    )
}
