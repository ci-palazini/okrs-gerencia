import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, TrendingDown, TrendingUp } from 'lucide-react'
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import type { CascadeKeyResult, CascadeObjective, CascadeMonthlyEntry } from '../../hooks/useCascadeOKRData'
import { calculateKRProgress, formatMetricValue } from '../../lib/okr'
import { cn } from '../../lib/utils'
import { toDateLocale } from '../../lib/dateUtils'

interface AnnualKRTrackingCardProps {
    kr: CascadeKeyResult
    objective: Pick<CascadeObjective, 'id' | 'code' | 'title'>
    getMonthlyEntry: (krId: string, month: number) => CascadeMonthlyEntry | null
    onSaveMonthly: (
        krId: string,
        month: number,
        fields: { actual?: number | null; notes?: string | null }
    ) => Promise<void>
    onUpdateValue: (krId: string, field: 'baseline' | 'target', value: number | null) => void | Promise<void>
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function monthLabel(month: number, locale = 'pt-BR'): string {
    const label = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2026, month - 1, 1))
    return label.replace('.', '')
}

function toComparableNumber(raw: string): number | null | 'invalid' {
    const normalized = raw.replace(',', '.').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isNaN(parsed) ? 'invalid' : parsed
}

/** A labelled metric value that can be edited inline (click the pencil → number input). */
function EditableStat({
    label,
    value,
    display,
    onSave,
}: {
    label: string
    value: number | null
    display: string
    onSave: (value: number | null) => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')

    function startEdit() {
        setDraft(value !== null ? String(value) : '')
        setEditing(true)
    }

    function commit() {
        const parsed = toComparableNumber(draft)
        if (parsed === 'invalid') {
            setEditing(false)
            return
        }
        if (parsed !== value) onSave(parsed)
        setEditing(false)
    }

    return (
        <div className="group/stat">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
            {editing ? (
                <input
                    type="number"
                    value={draft}
                    autoFocus
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') { event.preventDefault(); commit() }
                        if (event.key === 'Escape') setEditing(false)
                    }}
                    className="w-full h-7 px-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-primary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
            ) : (
                <button
                    type="button"
                    onClick={startEdit}
                    className="flex items-center gap-1 text-sm font-semibold text-[var(--color-text-primary)] tabular-nums hover:text-[var(--color-primary)] transition-colors"
                    title={label}
                >
                    {display}
                    <Pencil className="w-3 h-3 text-[var(--color-text-muted)] opacity-0 group-hover/stat:opacity-100 transition-opacity" />
                </button>
            )}
        </div>
    )
}

export function AnnualKRTrackingCard({ kr, objective, getMonthlyEntry, onSaveMonthly, onUpdateValue }: AnnualKRTrackingCardProps) {
    const { t, i18n } = useTranslation()
    const dateLocale = toDateLocale(i18n.language)

    const [drafts, setDrafts] = useState<Record<number, string>>({})
    const [savingMonths, setSavingMonths] = useState<Set<number>>(new Set())

    const owners = kr.owner_names?.length
        ? kr.owner_names
        : kr.owner_name ? [kr.owner_name] : []

    const isMinimize = kr.target_direction === 'minimize'

    const chartData = useMemo(() => (
        MONTHS.map((month) => ({
            month: monthLabel(month, dateLocale),
            actual: getMonthlyEntry(kr.id, month)?.actual ?? null,
        }))
    ), [getMonthlyEntry, kr.id, dateLocale])

    const progress = kr.progress !== null
        ? Math.max(0, Math.min(100, kr.progress))
        : null

    function getDraft(month: number): string {
        const current = getMonthlyEntry(kr.id, month)?.actual
        return drafts[month] ?? (current !== null && current !== undefined ? String(current) : '')
    }

    async function saveMonth(month: number) {
        const parsed = toComparableNumber(getDraft(month))
        const previous = getMonthlyEntry(kr.id, month)?.actual ?? null

        if (parsed === 'invalid') {
            setDrafts((prev) => ({ ...prev, [month]: previous !== null ? String(previous) : '' }))
            return
        }
        if (parsed === previous) return

        setSavingMonths((prev) => new Set(prev).add(month))
        await onSaveMonthly(kr.id, month, { actual: parsed })
        setSavingMonths((prev) => {
            const next = new Set(prev)
            next.delete(month)
            return next
        })
        // Clear the local draft so the value reflects the saved entry from the source of truth.
        setDrafts((prev) => {
            const next = { ...prev }
            delete next[month]
            return next
        })
    }

    return (
        <Card variant="elevated" className="p-0 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/30">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" size="sm" className="font-mono">{kr.code}</Badge>
                            <h3 className="text-sm md:text-base font-semibold text-[var(--color-text-primary)]">
                                {kr.title}
                            </h3>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                                    isMinimize
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                        : 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                )}
                                title={isMinimize ? t('monthlyTracking.minimizeHint') : t('monthlyTracking.maximizeHint')}
                            >
                                {isMinimize ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {isMinimize ? t('monthlyTracking.minimize') : t('monthlyTracking.maximize')}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                            {objective.code} - {objective.title}
                        </p>
                        {owners.length > 0 && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                                {owners.join(', ')}
                            </p>
                        )}
                    </div>

                    <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 lg:w-[360px]">
                        <EditableStat
                            label={t('monthlyTracking.baseline')}
                            value={kr.baseline}
                            display={formatMetricValue(kr, kr.baseline)}
                            onSave={(value) => onUpdateValue(kr.id, 'baseline', value)}
                        />
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                                {t('monthlyTracking.current')}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
                                {formatMetricValue(kr, kr.actual)}
                            </p>
                        </div>
                        <EditableStat
                            label={t('monthlyTracking.goal')}
                            value={kr.target}
                            display={formatMetricValue(kr, kr.target)}
                            onSave={(value) => onUpdateValue(kr.id, 'target', value)}
                        />
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                                {t('monthlyTracking.progress')}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
                                {progress !== null ? `${kr.progress}%` : '-'}
                            </p>
                        </div>
                    </div>
                </div>
                {progress !== null && (
                    <div className="mt-3">
                        <ProgressBar value={progress} />
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="p-5">
                <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                                axisLine={{ stroke: 'var(--color-border)' }}
                                tickLine={false}
                            />
                            <YAxis
                                width={56}
                                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => formatMetricValue(kr, value as number)}
                            />
                            {kr.baseline !== null && (
                                <ReferenceLine
                                    y={kr.baseline}
                                    stroke="var(--color-text-muted)"
                                    strokeDasharray="2 2"
                                    label={{
                                        value: t('monthlyTracking.baseline'),
                                        position: 'insideBottomRight',
                                        fontSize: 10,
                                        fill: 'var(--color-text-muted)',
                                    }}
                                />
                            )}
                            {kr.target !== null && (
                                <ReferenceLine
                                    y={kr.target}
                                    stroke="var(--color-warning)"
                                    strokeDasharray="4 4"
                                    label={{
                                        value: t('monthlyTracking.goal'),
                                        position: 'insideTopRight',
                                        fontSize: 10,
                                        fill: 'var(--color-warning)',
                                    }}
                                />
                            )}
                            <Tooltip
                                formatter={(value) => [formatMetricValue(kr, value as number), t('monthlyTracking.current')]}
                                contentStyle={{
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '0.5rem',
                                    fontSize: '12px',
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="actual"
                                stroke="var(--color-primary)"
                                strokeWidth={2}
                                connectNulls
                                dot={{ r: 3, fill: 'var(--color-primary)' }}
                                activeDot={{ r: 5 }}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Inline month editing */}
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-2">
                    {MONTHS.map((month) => {
                        const entry = getMonthlyEntry(kr.id, month)
                        const monthProgress = calculateKRProgress(kr.target, entry?.actual ?? null, kr.target_direction, kr.baseline)
                        return (
                            <div key={month} className="rounded-lg border border-[var(--color-border)] p-2 bg-[var(--color-surface)]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] capitalize">
                                        {monthLabel(month, dateLocale)}
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-muted)]">
                                        {monthProgress !== null ? `${monthProgress}%` : '-'}
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    value={getDraft(month)}
                                    onChange={(event) => setDrafts((prev) => ({ ...prev, [month]: event.target.value }))}
                                    onBlur={() => saveMonth(month)}
                                    className={cn(
                                        'w-full h-8 px-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
                                        savingMonths.has(month) && 'opacity-70'
                                    )}
                                    placeholder="-"
                                />
                            </div>
                        )
                    })}
                </div>
            </div>
        </Card>
    )
}
