import { useState } from 'react'
import { Edit3, Save, X, Circle } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { ConfidenceEmoji } from '../ui/ConfidenceIndicator'
import type { ConfidenceLevel } from '../ui/ConfidenceIndicator'
import { cn } from '../../lib/utils'

interface QuarterlyData {
    id: string
    quarter: number
    baseline: number | null
    target: number | null
    actual: number | null
    progress: number | null
    confidence: ConfidenceLevel
}

interface QuarterlyCardProps {
    keyResult: {
        id: string
        code: string
        title: string
        owner_name: string | null
        source: string | null
        unit: string
        metric_type: string
    }
    quarterlyData: QuarterlyData[]
    currentQuarter?: number
    onUpdate?: (quarterId: string, field: string, value: any) => void
    editable?: boolean
}

export function QuarterlyCard({
    keyResult,
    quarterlyData,
    currentQuarter = 1,
    onUpdate,
    editable = true
}: QuarterlyCardProps) {
    const [editingCell, setEditingCell] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>('')

    const formatValue = (value: number | null, metricType: string, unit: string): string => {
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

        return `${value} ${unit}`
    }

    const startEdit = (quarterId: string, field: string, currentValue: number | null) => {
        setEditingCell(`${quarterId}-${field}`)
        setEditValue(currentValue?.toString() || '')
    }

    const saveEdit = (quarterId: string, field: string) => {
        const numValue = editValue ? parseFloat(editValue) : null
        onUpdate?.(quarterId, field, numValue)
        setEditingCell(null)
        setEditValue('')
    }

    const cancelEdit = () => {
        setEditingCell(null)
        setEditValue('')
    }

    // Calculate YTD
    const calculateYTD = (field: 'baseline' | 'target' | 'actual'): number | null => {
        const values = quarterlyData
            .filter(q => q.quarter <= currentQuarter)
            .map(q => q[field])
            .filter((v): v is number => v !== null)

        if (values.length === 0) return null

        // For percentage/days, use average; for currency, use sum
        if (keyResult.metric_type === 'currency') {
            return values.reduce((a, b) => a + b, 0)
        }
        return values.reduce((a, b) => a + b, 0) / values.length
    }

    const ytdProgress = (() => {
        const baseline = calculateYTD('baseline')
        const target = calculateYTD('target')
        const actual = calculateYTD('actual')

        if (target === null || baseline === null || actual === null) return null
        if (target === baseline) return 0

        return Math.round(((actual - baseline) / (target - baseline)) * 100)
    })()

    const rows = [
        { key: 'baseline', label: 'Baseline', editable: true },
        { key: 'target', label: 'Target', editable: true },
        { key: 'actual', label: 'Real', editable: true },
        { key: 'progress', label: '% Avanço', editable: false },
        { key: 'confidence', label: 'Confiança', editable: true }
    ]

    return (
        <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]/50">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold border border-[var(--color-primary)]/20 shadow-sm">
                            {keyResult.code}
                        </span>
                        <div>
                            <h4 className="font-semibold text-[var(--color-text-primary)]">
                                {keyResult.title}
                            </h4>
                            <div className="flex items-center gap-4 mt-1">
                                <span className="text-sm text-[var(--color-text-muted)]">
                                    Responsável: <strong className="text-[var(--color-text-secondary)]">{keyResult.owner_name || '-'}</strong>
                                </span>
                                <Badge variant="outline" size="sm" className="bg-white">
                                    Fonte: {keyResult.source || '-'}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]">
                            <th className="px-4 py-3 text-left w-32 border-r border-[var(--color-border-subtle)]">Indicador</th>
                            {[1, 2, 3, 4].map(q => (
                                <th
                                    key={q}
                                    className={cn(
                                        'px-4 py-3 text-center w-28 border-r border-[var(--color-border-subtle)] last:border-r-0',
                                        q === currentQuarter && 'bg-[var(--color-primary)]/5 text-[var(--color-primary)] font-bold'
                                    )}
                                >
                                    Q{q}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-center w-28 bg-[var(--color-surface-subtle)] font-bold text-[var(--color-text-primary)] border-l border-[var(--color-border)]">YTD</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {rows.map((row, rowIndex) => (
                            <tr
                                key={row.key}
                                className={cn(
                                    "transition-colors hover:bg-[var(--color-surface-hover)]",
                                    rowIndex % 2 === 0 ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-subtle)]/30"
                                )}
                            >
                                <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/10">
                                    {row.label}
                                </td>
                                {quarterlyData.map((qData) => {
                                    const cellId = `${qData.id}-${row.key}`
                                    const isEditing = editingCell === cellId
                                    const isFutureQuarter = qData.quarter > currentQuarter
                                    const value = qData[row.key as keyof QuarterlyData]

                                    // Confidence cell
                                    if (row.key === 'confidence') {
                                        return (
                                            <td
                                                key={qData.quarter}
                                                className={cn(
                                                    'px-4 py-3 text-center border-r border-[var(--color-border-subtle)] last:border-r-0',
                                                    qData.quarter === currentQuarter && 'bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/10 ring-inset'
                                                )}
                                            >
                                                {isFutureQuarter ? (
                                                    <Circle className="w-5 h-5 text-[var(--color-border)] mx-auto" strokeWidth={1.5} />
                                                ) : editable && row.editable ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        {(['on_track', 'at_risk', 'off_track'] as ConfidenceLevel[]).map((level) => (
                                                            <button
                                                                key={level}
                                                                onClick={() => onUpdate?.(qData.id, 'confidence', level)}
                                                                className={cn(
                                                                    'text-lg transition-all hover:scale-125 focus:outline-none',
                                                                    value !== level && 'opacity-20 hover:opacity-100 grayscale'
                                                                )}
                                                            >
                                                                <ConfidenceEmoji value={level} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <ConfidenceEmoji value={value as ConfidenceLevel} />
                                                )}
                                            </td>
                                        )
                                    }

                                    // Progress cell (calculated, not editable)
                                    if (row.key === 'progress') {
                                        const progressValue = value as number | null
                                        return (
                                            <td
                                                key={qData.quarter}
                                                className={cn(
                                                    'px-4 py-3 text-center text-sm font-bold border-r border-[var(--color-border-subtle)] last:border-r-0',
                                                    qData.quarter === currentQuarter && 'bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/10 ring-inset',
                                                    progressValue !== null && progressValue >= 70 && 'text-[var(--color-success)]',
                                                    progressValue !== null && progressValue >= 40 && progressValue < 70 && 'text-[var(--color-warning)]',
                                                    progressValue !== null && progressValue < 40 && 'text-[var(--color-danger)]'
                                                )}
                                            >
                                                {progressValue !== null ? (
                                                    <div className="inline-flex items-center justify-center min-w-[3rem] py-0.5 rounded bg-white shadow-sm border border-[var(--color-border-subtle)]">
                                                        {progressValue}%
                                                    </div>
                                                ) : '-'}
                                            </td>
                                        )
                                    }

                                    // Regular editable cells
                                    return (
                                        <td
                                            key={qData.quarter}
                                            className={cn(
                                                'px-4 py-3 text-center border-r border-[var(--color-border-subtle)] last:border-r-0',
                                                qData.quarter === currentQuarter && 'bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/10 ring-inset',
                                                isFutureQuarter && 'bg-[var(--color-surface-subtle)] opacity-60'
                                            )}
                                        >
                                            {isFutureQuarter ? (
                                                <span className="text-sm text-[var(--color-text-muted)]">-</span>
                                            ) : isEditing ? (
                                                <div className="flex items-center gap-1 justify-center relative z-10">
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-20 px-2 py-1 text-sm text-center rounded border border-[var(--color-primary)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] shadow-sm"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit(qData.id, row.key)
                                                            if (e.key === 'Escape') cancelEdit()
                                                        }}
                                                    />
                                                    <div className="flex flex-col gap-0.5 absolute -right-6">
                                                        <button
                                                            onClick={() => saveEdit(qData.id, row.key)}
                                                            className="p-0.5 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded bg-white border border-[var(--color-border)] shadow-sm"
                                                        >
                                                            <Save className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="p-0.5 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded bg-white border border-[var(--color-border)] shadow-sm"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => editable && row.editable && startEdit(qData.id, row.key, value as number | null)}
                                                    className={cn(
                                                        'text-sm transition-all rounded px-2 py-0.5 min-w-[3rem]',
                                                        editable && row.editable && 'hover:bg-[var(--color-surface)] hover:shadow-sm hover:text-[var(--color-primary)] cursor-pointer hover:ring-1 hover:ring-[var(--color-border)]'
                                                    )}
                                                    disabled={!editable || !row.editable}
                                                >
                                                    {formatValue(value as number | null, keyResult.metric_type, keyResult.unit)}
                                                </button>
                                            )}
                                        </td>
                                    )
                                })}

                                {/* YTD Column */}
                                <td className="px-4 py-3 text-center bg-[var(--color-surface-subtle)] border-l border-[var(--color-border)]">
                                    {row.key === 'confidence' ? (
                                        <span className="text-lg">-</span>
                                    ) : row.key === 'progress' ? (
                                        <span className={cn(
                                            'text-sm font-bold inline-flex items-center justify-center min-w-[3rem] py-0.5 rounded bg-white shadow-sm border border-[var(--color-border-subtle)]',
                                            ytdProgress !== null && ytdProgress >= 70 && 'text-[var(--color-success)]',
                                            ytdProgress !== null && ytdProgress >= 40 && ytdProgress < 70 && 'text-[var(--color-warning)]',
                                            ytdProgress !== null && ytdProgress < 40 && 'text-[var(--color-danger)]'
                                        )}>
                                            {ytdProgress !== null ? `${ytdProgress}%` : '-'}
                                        </span>
                                    ) : (
                                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                            {formatValue(
                                                calculateYTD(row.key as 'baseline' | 'target' | 'actual'),
                                                keyResult.metric_type,
                                                keyResult.unit
                                            )}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
