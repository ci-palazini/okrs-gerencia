import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, CalendarDays, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { ProgressBar } from '../ui/ProgressBar'
import type { CascadeObjective, CascadeTreeNode, CascadeMonthlyEntry } from '../../hooks/useCascadeOKRData'
import { cn, formatKRCurrency } from '../../lib/utils'

export interface MonthlyCockpitItem {
    objective: Pick<CascadeObjective, 'id' | 'code' | 'title'>
    kr: CascadeTreeNode
    path: string
}

interface MonthlyCockpitPanelProps {
    year: number
    selectedMonth: number
    onSelectedMonthChange: (month: number) => void
    items: MonthlyCockpitItem[]
    getMonthlyEntry: (krId: string, month: number) => CascadeMonthlyEntry | null
    onSaveMonthly: (krId: string, month: number, fields: { actual?: number | null; notes?: string | null }) => Promise<void>
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function monthLabel(month: number, locale = 'pt-BR') {
    const label = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2026, month - 1, 1))
    return label.replace('.', '')
}

function toComparableNumber(raw: string): number | null | 'invalid' {
    const normalized = raw.replace(',', '.').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isNaN(parsed) ? 'invalid' : parsed
}

function calculateProgress(
    target: number | null,
    actual: number | null,
    direction: 'maximize' | 'minimize',
    baseline: number | null
): number | null {
    if (target === null || actual === null) return null

    if (baseline !== null) {
        if (direction === 'minimize') {
            const denominator = baseline - target
            if (denominator === 0) return null
            return Math.round(((baseline - actual) / denominator) * 100)
        }
        const denominator = target - baseline
        if (denominator === 0) return null
        return Math.round(((actual - baseline) / denominator) * 100)
    }

    if (target === 0) return null
    if (direction === 'minimize') {
        if (actual === 0) return null
        return Math.round((target / actual) * 100)
    }

    return Math.round((actual / target) * 100)
}

function formatMetricValue(kr: CascadeTreeNode, value: number | null): string {
    if (value === null) return '-'
    if (kr.metric_type === 'currency') return formatKRCurrency(value, kr.currency_type)
    if (kr.metric_type === 'percentage') return `${value}%`
    return `${value}${kr.unit ? ` ${kr.unit}` : ''}`
}

export function MonthlyCockpitPanel({
    year,
    selectedMonth,
    onSelectedMonthChange,
    items,
    getMonthlyEntry,
    onSaveMonthly,
}: MonthlyCockpitPanelProps) {
    const { t } = useTranslation()

    const [search, setSearch] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const [draftActual, setDraftActual] = useState<Record<string, string>>({})
    const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})
    const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())

    const locale = 'pt-BR'
    const filteredItems = useMemo(() => {
        const normalized = search.trim().toLowerCase()
        if (!normalized) return items

        return items.filter(({ objective, kr, path }) => (
            objective.code.toLowerCase().includes(normalized)
            || objective.title.toLowerCase().includes(normalized)
            || kr.code.toLowerCase().includes(normalized)
            || kr.title.toLowerCase().includes(normalized)
            || path.toLowerCase().includes(normalized)
        ))
    }, [items, search])

    const summary = useMemo(() => {
        const total = filteredItems.length
        const withActual = filteredItems.filter(({ kr }) => getMonthlyEntry(kr.id, selectedMonth)?.actual !== null).length

        const progressValues = filteredItems
            .map(({ kr }) => {
                const actual = getMonthlyEntry(kr.id, selectedMonth)?.actual ?? null
                return calculateProgress(kr.target, actual, kr.target_direction, kr.baseline)
            })
            .filter((progress): progress is number => progress !== null)

        const avgProgress = progressValues.length > 0
            ? Math.round(progressValues.reduce((acc, value) => acc + value, 0) / progressValues.length)
            : null

        return {
            total,
            withActual,
            avgProgress,
        }
    }, [filteredItems, getMonthlyEntry, selectedMonth])

    function makeKey(krId: string, month: number, kind: 'actual' | 'notes') {
        return `${krId}-${month}-${kind}`
    }

    function getActualDraft(krId: string, month: number) {
        const key = makeKey(krId, month, 'actual')
        const current = getMonthlyEntry(krId, month)?.actual
        return draftActual[key] ?? (current !== null && current !== undefined ? String(current) : '')
    }

    function getNotesDraft(krId: string, month: number) {
        const key = makeKey(krId, month, 'notes')
        const current = getMonthlyEntry(krId, month)?.notes
        return draftNotes[key] ?? (current || '')
    }

    function toggleExpanded(krId: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(krId)) {
                next.delete(krId)
            } else {
                next.add(krId)
            }
            return next
        })
    }

    async function saveActual(krId: string, month: number) {
        const key = makeKey(krId, month, 'actual')
        const raw = getActualDraft(krId, month)
        const parsed = toComparableNumber(raw)
        const previous = getMonthlyEntry(krId, month)?.actual ?? null

        if (parsed === 'invalid') {
            setDraftActual((prev) => ({
                ...prev,
                [key]: previous !== null ? String(previous) : '',
            }))
            return
        }

        if (parsed === previous) return

        setSavingKeys((prev) => new Set(prev).add(key))
        await onSaveMonthly(krId, month, { actual: parsed })
        setSavingKeys((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
        })
    }

    async function saveNotes(krId: string, month: number) {
        const key = makeKey(krId, month, 'notes')
        const current = getNotesDraft(krId, month).trim()
        const previous = (getMonthlyEntry(krId, month)?.notes || '').trim()

        if (current === previous) return

        setSavingKeys((prev) => new Set(prev).add(key))
        await onSaveMonthly(krId, month, { notes: current || null })
        setSavingKeys((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
        })
    }

    return (
        <Card variant="elevated" className="p-0 overflow-hidden">
            <CardHeader className="p-5 md:p-6 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/30">
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
                            {t('okr.cockpit.title')}
                        </CardTitle>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            {t('okr.cockpit.subtitle', { year })}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                        <Input
                            label={t('okr.cockpit.searchLabel')}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('okr.cockpit.searchPlaceholder')}
                            icon={<Search className="w-4 h-4" />}
                            className="w-64"
                        />
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                {t('okr.cockpit.monthLabel')}
                            </label>
                            <select
                                value={selectedMonth}
                                onChange={(event) => onSelectedMonthChange(Number(event.target.value))}
                                className="h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                                {MONTHS.map((month) => (
                                    <option key={month} value={month}>
                                        {monthLabel(month, locale)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="default">{t('okr.cockpit.totalLeafs', { count: summary.total })}</Badge>
                    <Badge variant="success">{t('okr.cockpit.withMonthData', { count: summary.withActual })}</Badge>
                    <Badge variant="info">
                        {summary.avgProgress !== null
                            ? t('okr.cockpit.avgProgress', { value: summary.avgProgress })
                            : t('okr.cockpit.avgProgressEmpty')
                        }
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-5 md:p-6 space-y-3">
                {filteredItems.length === 0 ? (
                    <div className="text-center py-10 text-[var(--color-text-muted)]">
                        {t('okr.cockpit.empty')}
                    </div>
                ) : (
                    filteredItems.map(({ objective, kr, path }) => {
                        const selectedEntry = getMonthlyEntry(kr.id, selectedMonth)
                        const selectedProgress = calculateProgress(kr.target, selectedEntry?.actual ?? null, kr.target_direction, kr.baseline)
                        const isExpanded = expandedIds.has(kr.id)
                        const actualKey = makeKey(kr.id, selectedMonth, 'actual')
                        const notesKey = makeKey(kr.id, selectedMonth, 'notes')

                        return (
                            <div key={kr.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                                <div className="p-4 space-y-3">
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" size="sm" className="font-mono">{kr.code}</Badge>
                                                <h4 className="text-sm md:text-base font-semibold text-[var(--color-text-primary)] truncate">
                                                    {kr.title}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                                                {objective.code} - {objective.title}
                                            </p>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                                                {path}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                                            onClick={() => toggleExpanded(kr.id)}
                                        >
                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            {isExpanded ? t('okr.cockpit.hideYear') : t('okr.cockpit.showYear')}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_180px] gap-3 items-end">
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                                                {t('okr.cockpit.actualMonth', { month: monthLabel(selectedMonth, locale) })}
                                            </label>
                                            <input
                                                type="number"
                                                value={getActualDraft(kr.id, selectedMonth)}
                                                onChange={(event) => {
                                                    const key = makeKey(kr.id, selectedMonth, 'actual')
                                                    setDraftActual((prev) => ({ ...prev, [key]: event.target.value }))
                                                }}
                                                onBlur={() => saveActual(kr.id, selectedMonth)}
                                                className={cn(
                                                    'w-full h-10 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
                                                    savingKeys.has(actualKey) && 'opacity-70'
                                                )}
                                                placeholder="-"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                                                {t('okr.cockpit.notesMonth')}
                                            </label>
                                            <input
                                                type="text"
                                                value={getNotesDraft(kr.id, selectedMonth)}
                                                onChange={(event) => {
                                                    const key = makeKey(kr.id, selectedMonth, 'notes')
                                                    setDraftNotes((prev) => ({ ...prev, [key]: event.target.value }))
                                                }}
                                                onBlur={() => saveNotes(kr.id, selectedMonth)}
                                                className={cn(
                                                    'w-full h-10 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
                                                    savingKeys.has(notesKey) && 'opacity-70'
                                                )}
                                                placeholder={t('monthly.notesPlaceholder')}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.progress')}</span>
                                                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                    {selectedProgress !== null ? `${selectedProgress}%` : '-'}
                                                </span>
                                            </div>
                                            <ProgressBar value={selectedProgress || 0} />
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                {t('okr.cockpit.goalLabel')}: {formatMetricValue(kr, kr.target)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/30 p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                            {MONTHS.map((month) => {
                                                const entry = getMonthlyEntry(kr.id, month)
                                                const key = makeKey(kr.id, month, 'actual')
                                                const monthProgress = calculateProgress(kr.target, entry?.actual ?? null, kr.target_direction, kr.baseline)

                                                return (
                                                    <div key={month} className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-semibold text-[var(--color-text-secondary)] inline-flex items-center gap-1">
                                                                <CalendarDays className="w-3 h-3" />
                                                                {monthLabel(month, locale)}
                                                            </span>
                                                            <span className="text-xs font-medium text-[var(--color-text-muted)]">
                                                                {monthProgress !== null ? `${monthProgress}%` : '-'}
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            value={getActualDraft(kr.id, month)}
                                                            onChange={(event) => {
                                                                const draftKey = makeKey(kr.id, month, 'actual')
                                                                setDraftActual((prev) => ({ ...prev, [draftKey]: event.target.value }))
                                                            }}
                                                            onBlur={() => saveActual(kr.id, month)}
                                                            className={cn(
                                                                'w-full h-9 px-2.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
                                                                savingKeys.has(key) && 'opacity-70'
                                                            )}
                                                            placeholder="-"
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
