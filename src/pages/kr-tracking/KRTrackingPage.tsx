import { useState } from 'react'
import {
    TrendingUp,
    RefreshCw,
    ChevronDown,
    TrendingDown,
    Target,
    Filter,
    X,
    Calendar
} from 'lucide-react'
import {
    Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, Area, AreaChart
} from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { cn } from '../../lib/utils'
import { useKRTracking } from '../../hooks/useKRTracking'
import type { AnnualKRForTracking, KRTrackingEntry } from '../../hooks/useKRTracking'

// =====================================================
// HELPERS
// =====================================================

function fmtVal(v: number | null | undefined, metricType: string, unit: string): string {
    if (v === null || v === undefined) return '—'
    if (metricType === 'currency')
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
    if (metricType === 'percentage') return `${v}%`
    return `${v}${unit ? ` ${unit}` : ''}`
}

function calcProgress(
    actual: number | null,
    target: number | null,
    direction: 'maximize' | 'minimize',
    baseline: number | null = null
): number | null {
    if (actual === null || target === null) return null

    // With baseline: measure progress from starting point to target
    if (baseline !== null) {
        if (direction === 'minimize') {
            const denominator = baseline - target
            if (denominator === 0) return null
            return Math.round(((baseline - actual) / denominator) * 100)
        } else {
            const denominator = target - baseline
            if (denominator === 0) return null
            return Math.round(((actual - baseline) / denominator) * 100)
        }
    }

    // Fallback (no baseline): original formula
    if (target === 0) return null
    if (direction === 'minimize') return actual === 0 ? null : Math.round((target / actual) * 100)
    return Math.round((actual / target) * 100)
}

function progressVariant(p: number | null): 'success' | 'warning' | 'danger' {
    if (p === null) return 'danger'
    if (p >= 70) return 'success'
    if (p >= 40) return 'warning'
    return 'danger'
}

// =====================================================
// EDITABLE CELL
// =====================================================

interface EditableCellProps {
    value: number | null
    onSave: (val: number | null) => Promise<void>
    formatFn: (v: number | null) => string
    colorClass?: string
    align?: 'left' | 'center' | 'right'
    placeholder?: string
    bgColorClass?: string
}

function EditableNumericCell({ value, onSave, formatFn, colorClass = '', align = 'center', placeholder = '—', bgColorClass }: EditableCellProps) {
    const [editing, setEditing] = useState(false)
    const [editVal, setEditVal] = useState('')
    const [saving, setSaving] = useState(false)

    function start(e: React.MouseEvent) {
        e.stopPropagation()
        setEditing(true)
        setEditVal(value !== null ? String(value) : '')
    }

    async function save() {
        setSaving(true)
        try {
            const parsed = editVal.trim() === '' ? null : Number(editVal)
            const current = value
            if (parsed !== current) {
                await onSave(parsed)
            }
        } finally {
            setSaving(false)
            setEditing(false)
        }
    }

    if (editing) {
        return (
            <input
                type="number"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') setEditing(false)
                }}
                onBlur={save}
                autoFocus
                onClick={e => e.stopPropagation()}
                className="w-20 px-1.5 py-1 text-xs text-center rounded-md border border-indigo-500 bg-white shadow-sm outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
            />
        )
    }

    return (
        <div
            onClick={start}
            className={cn(
                'group/cell relative cursor-pointer px-2 py-1.5 rounded-md transition-all duration-200 border border-transparent',
                bgColorClass || 'hover:bg-slate-50 hover:border-slate-200',
                align === 'left' && 'text-left',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right'
            )}
        >
            <span className={cn(
                'font-medium text-sm transition-opacity',
                saving ? 'opacity-50' : 'opacity-100',
                !value && 'text-slate-300',
                colorClass
            )}>
                {saving ? '...' : (value !== null ? formatFn(value) : placeholder)}
            </span>
        </div>
    )
}

// =====================================================
// KR CARD
// =====================================================

interface KRCardProps {
    kr: AnnualKRForTracking
    getEntry: (krId: string, quarter: number) => KRTrackingEntry | null
    upsertTracking: (
        krId: string,
        quarter: number,
        fields: { baseline?: number | null; target?: number | null; actual?: number | null; notes?: string | null }
    ) => Promise<void>
    currentQuarterHint?: number
}

function KRCard({ kr, getEntry, upsertTracking, currentQuarterHint }: KRCardProps) {
    const [expanded, setExpanded] = useState(false)
    const [editingNotes, setEditingNotes] = useState<number | null>(null)
    const [notesVal, setNotesVal] = useState('')

    const pillarColor = kr.objective?.pillar?.color || '#6366f1'
    const fmt = (v: number | null) => fmtVal(v, kr.metric_type, kr.unit)

    const chartData = [1, 2, 3, 4].map(q => {
        const entry = getEntry(kr.id, q)
        return {
            quarter: `Q${q}`,
            baseline: entry?.baseline ?? null,
            target: entry?.target ?? kr.target,
            actual: entry?.actual ?? null,
        }
    })

    const hasAnyActual = chartData.some(d => d.actual !== null)

    const lastEntry = [...[1, 2, 3, 4]].reverse().find(q => getEntry(kr.id, q)?.actual !== null)
    const lastActual = lastEntry ? getEntry(kr.id, lastEntry)?.actual ?? null : null
    const overallProgress = calcProgress(lastActual, kr.target, kr.target_direction, kr.baseline)

    async function saveNotes(quarter: number) {
        if (notesVal.trim() !== (getEntry(kr.id, quarter)?.notes || '')) {
            await upsertTracking(kr.id, quarter, { notes: notesVal.trim() || null })
        }
        setEditingNotes(null)
    }

    return (
        <div
            className="group relative flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out overflow-hidden"
        >
            {/* Left colored accent */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5 transition-colors"
                style={{ backgroundColor: pillarColor }}
            />

            {/* ── Card Header ── */}
            <div
                className="flex flex-col md:flex-row md:items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Title Section */}
                <div className="flex items-start gap-4 flex-1 min-w-0 pl-2">
                    <div className={cn(
                        "mt-1 p-1 rounded-md transition-all duration-300",
                        expanded ? "bg-indigo-50 text-indigo-600 rotate-180" : "text-slate-400 hover:text-slate-600"
                    )}>
                        <ChevronDown size={20} className="transition-transform duration-300" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-700"
                            >
                                {kr.code}
                            </span>
                            {kr.target_direction === 'minimize' ? (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                    <TrendingDown size={12} /> Minimizar
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    <TrendingUp size={12} /> Maximizar
                                </span>
                            )}
                        </div>
                        <h3 className="text-base font-bold text-slate-800 leading-snug">
                            {kr.title}
                        </h3>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="flex items-center gap-8 pl-12 md:pl-0 md:pr-4">
                    {/* Progress */}
                    {overallProgress !== null && (
                        <div className="flex flex-col items-end min-w-[120px]">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Avanço</span>
                                <Badge variant={progressVariant(overallProgress)} size="sm" className="font-bold border shadow-none">{overallProgress}%</Badge>
                            </div>
                            <div className="w-32 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500 ease-out",
                                        progressVariant(overallProgress) === 'success' && "bg-emerald-500",
                                        progressVariant(overallProgress) === 'warning' && "bg-amber-500",
                                        progressVariant(overallProgress) === 'danger' && "bg-red-500",
                                    )}
                                    style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="hidden sm:flex items-center gap-6 border-l border-slate-200 pl-6">
                        <div className="flex flex-col items-start px-2">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Baseline</span>
                            <span className="text-xl font-medium text-slate-700 font-mono tracking-tight">{fmt(kr.baseline)}</span>
                        </div>
                        <div className="flex flex-col items-start px-2">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Target</span>
                            <span className="text-xl font-bold text-slate-900 font-mono tracking-tight">{fmt(kr.target)}</span>
                        </div>
                        {lastActual !== null && (
                            <div className="flex flex-col items-start px-2 relative">
                                <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold mb-0.5">Atual</span>
                                <span className="text-xl font-bold text-indigo-700 font-mono tracking-tight">{fmt(lastActual)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Card Body (Expanded) ── */}
            {expanded && (
                <div className="border-t border-slate-200 bg-slate-50/50 px-6 py-6 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                        {/* ── Left: Table ── */}
                        <div className="xl:col-span-7 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Target className="w-4 h-4" /> Detalhamento Trimestral
                                </h4>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm ring-1 ring-slate-200/50">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="py-3 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider w-16 text-center">Período</th>
                                            <th className="py-3 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center">Baseline</th>
                                            <th className="py-3 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center">Target</th>
                                            <th className="py-3 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center bg-indigo-50/30">Realizado</th>
                                            <th className="py-3 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center w-24">Status</th>
                                            <th className="py-3 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Notas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {[1, 2, 3, 4].map(q => {
                                            const entry = getEntry(kr.id, q)
                                            const baseline = entry?.baseline ?? null
                                            const target = entry?.target ?? null
                                            const actual = entry?.actual ?? null
                                            const notes = entry?.notes ?? null
                                            const progress = calcProgress(actual, target ?? kr.target, kr.target_direction, kr.baseline)
                                            const isCurrent = q === currentQuarterHint

                                            return (
                                                <tr
                                                    key={q}
                                                    className={cn(
                                                        "group transition-all duration-200",
                                                        isCurrent ? "bg-indigo-50/30" : "hover:bg-slate-50"
                                                    )}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex flex-col items-center">
                                                            <div className={cn(
                                                                "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ring-1 ring-inset transition-colors shadow-sm",
                                                                isCurrent
                                                                    ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                                                                    : "bg-white text-slate-500 ring-slate-200"
                                                            )}>
                                                                Q{q}
                                                            </div>
                                                            {isCurrent && <span className="text-[9px] font-bold text-indigo-600 mt-1 uppercase tracking-wide">Atual</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <EditableNumericCell
                                                            value={baseline}
                                                            onSave={v => upsertTracking(kr.id, q, { baseline: v })}
                                                            formatFn={fmt}
                                                            colorClass="text-slate-600 font-mono"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <EditableNumericCell
                                                            value={target}
                                                            onSave={v => upsertTracking(kr.id, q, { target: v })}
                                                            formatFn={fmt}
                                                            colorClass="text-slate-900 font-semibold font-mono"
                                                            bgColorClass="hover:bg-emerald-50 hover:border-emerald-200"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 text-center relative bg-indigo-50/20 shadow-[inset_1px_0_0_0_rgba(99,102,241,0.05)]">
                                                        {/* Hover indicator */}
                                                        <div className="absolute inset-y-0 left-0 w-0.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <EditableNumericCell
                                                            value={actual}
                                                            onSave={v => upsertTracking(kr.id, q, { actual: v })}
                                                            formatFn={fmt}
                                                            colorClass="text-indigo-700 font-bold font-mono text-base"
                                                            placeholder="—"
                                                            bgColorClass="hover:bg-white hover:shadow-md hover:ring-1 hover:ring-indigo-100"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {progress !== null ? (
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <Badge variant={progressVariant(progress)} size="sm" className="border shadow-none">{progress}%</Badge>
                                                                <ProgressBar value={progress} size="sm" className="w-14" />
                                                            </div>
                                                        ) : (
                                                            <div className="text-center text-slate-300">—</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {editingNotes === q ? (
                                                            <div className="relative group/input">
                                                                <input
                                                                    type="text"
                                                                    value={notesVal}
                                                                    autoFocus
                                                                    onChange={e => setNotesVal(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') saveNotes(q)
                                                                        if (e.key === 'Escape') setEditingNotes(null)
                                                                    }}
                                                                    onBlur={() => saveNotes(q)}
                                                                    className="w-full px-3 py-1.5 text-xs rounded-md border border-indigo-500 bg-white shadow-lg outline-none text-slate-700"
                                                                    placeholder="Escreva uma observação..."
                                                                />
                                                                <div className="absolute right-2 top-1.5 text-[10px] text-slate-400 pointer-events-none opacity-0 group-focus-within/input:opacity-100 transition-opacity">Enter ↵</div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setEditingNotes(q); setNotesVal(notes || '') }}
                                                                className={cn(
                                                                    'text-xs text-left w-full truncate py-1.5 px-2 rounded-md transition-all border border-transparent',
                                                                    notes
                                                                        ? 'text-slate-700 bg-yellow-50 border-yellow-200'
                                                                        : 'text-slate-400 italic hover:text-slate-600 hover:bg-white hover:border-slate-200 hover:shadow-sm'
                                                                )}
                                                            >
                                                                {notes || 'Adicionar nota...'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ── Right: Chart ── */}
                        <div className="xl:col-span-5 flex flex-col gap-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Evolução
                            </h4>

                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm ring-1 ring-slate-200/50 h-full min-h-[300px] flex flex-col relative overflow-hidden">

                                {hasAnyActual ? (
                                    <div className="flex-1 w-full h-full min-h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id={`grad-${kr.id}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={pillarColor} stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor={pillarColor} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.8} />
                                                <XAxis
                                                    dataKey="quarter"
                                                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    width={36}
                                                    domain={['auto', 'auto']}
                                                />
                                                <Tooltip
                                                    cursor={{ stroke: pillarColor, strokeWidth: 1.5, strokeDasharray: '4 4' }}
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
                                                                    <div className="font-bold text-slate-700 mb-2">{label}</div>
                                                                    {payload.map((entry: any, index: number) => (
                                                                        <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                                                                            <div
                                                                                className="w-2 h-2 rounded-full"
                                                                                style={{ backgroundColor: entry.color }}
                                                                            />
                                                                            <span className="text-slate-500 uppercase tracking-wider font-semibold">
                                                                                {entry.name}:
                                                                            </span>
                                                                            <span className="font-mono font-bold text-slate-800 ml-auto pl-4">
                                                                                {entry.value !== null ? fmt(Number(entry.value)) : '—'}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    }}
                                                />
                                                <Legend
                                                    verticalAlign="top"
                                                    height={36}
                                                    iconType="circle"
                                                    iconSize={8}
                                                    formatter={(value) => <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider ml-1">{value}</span>}
                                                />

                                                <Line
                                                    type="monotone"
                                                    dataKey="target"
                                                    name="Target"
                                                    stroke="#10b981" // emerald-500
                                                    strokeWidth={2}
                                                    strokeDasharray="4 4"
                                                    dot={false}
                                                    connectNulls={true}
                                                    activeDot={false}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="actual"
                                                    name="Realizado"
                                                    stroke={pillarColor}
                                                    strokeWidth={3}
                                                    fill={`url(#grad-${kr.id})`}
                                                    dot={{ fill: '#fff', r: 4, strokeWidth: 2, stroke: pillarColor }}
                                                    activeDot={{ r: 6, fill: pillarColor, stroke: 'white', strokeWidth: 2 }}
                                                    connectNulls={true}
                                                    animationDuration={1500}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center flex-1 h-full rounded-xl gap-4">
                                        <div className="p-4 bg-slate-50 rounded-full animate-pulse">
                                            <TrendingUp className="w-8 h-8 text-slate-200" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-slate-400">Sem dados suficientes</p>
                                            <p className="text-xs text-slate-300 mt-1">Preencha os valores na tabela para ver o gráfico.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    )
}

// =====================================================
// PAGE
// =====================================================

export function KRTrackingPage() {
    const { annualKRs, loading, year, loadData, upsertTracking, getEntry } = useKRTracking()
    const currentMonth = new Date().getMonth() + 1
    const currentQuarterHint = Math.ceil(currentMonth / 3)

    const [filterPillar, setFilterPillar] = useState<string>('all')
    const [filterObjective, setFilterObjective] = useState<string>('all')

    const pillars = Array.from(
        new Map(
            annualKRs
                .map(kr => kr.objective?.pillar)
                .filter(Boolean)
                .map(p => [p!.id, p!])
        ).values()
    )

    const objectives = Array.from(
        new Map(
            annualKRs
                .filter(kr => filterPillar === 'all' || kr.objective?.pillar?.id === filterPillar)
                .map(kr => kr.objective)
                .filter(Boolean)
                .map(o => [o!.id, o!])
        ).values()
    )

    const filteredKRs = annualKRs.filter(kr => {
        if (filterPillar !== 'all' && kr.objective?.pillar?.id !== filterPillar) return false
        if (filterObjective !== 'all' && kr.objective?.id !== filterObjective) return false
        return true
    })

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 p-6 animate-in fade-in duration-700">

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-200 ring-1 ring-black/5">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Resultados Trimestrais
                        </h1>
                    </div>
                    <p className="text-slate-500 text-base max-w-2xl leading-relaxed pl-1">
                        Acompanhamento estratégico dos indicadores-chave de desempenho para o ano fiscal de <span className="font-semibold text-indigo-700">{year}</span>.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Exercício {year}</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                        className="rounded-full h-10 w-10 p-0 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200"
                        title="Atualizar dados"
                    >
                        <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </Button>
                </div>
            </div>

            {/* Filter Control Bar */}
            <div className="sticky top-4 z-30 flex flex-wrap items-center gap-4 p-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200 shadow-lg shadow-slate-200/50 transition-all">
                <div className="flex items-center gap-2 text-slate-400 pl-2 mr-2">
                    <Filter className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Filtros</span>
                </div>

                <div className="relative group">
                    <select
                        value={filterPillar}
                        onChange={e => { setFilterPillar(e.target.value); setFilterObjective('all') }}
                        className="appearance-none h-10 pl-4 pr-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-w-[180px] cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <option value="all">Todos os Pilares</option>
                        {pillars.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                </div>

                <div className="relative group">
                    <select
                        value={filterObjective}
                        onChange={e => setFilterObjective(e.target.value)}
                        className="appearance-none h-10 pl-4 pr-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-w-[240px] max-w-[400px] truncate cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <option value="all">Todos os Objetivos</option>
                        {objectives.map(o => (
                            <option key={o.id} value={o.id}>{o.code} — {o.title}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                </div>

                {(filterPillar !== 'all' || filterObjective !== 'all') && (
                    <button
                        onClick={() => { setFilterPillar('all'); setFilterObjective('all') }}
                        className="flex items-center gap-1.5 ml-auto px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                    >
                        <X className="w-3.5 h-3.5" />
                        Limpar
                    </button>
                )}

                <div className="ml-auto pl-6 border-l border-slate-200 pr-2">
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-0.5">Total</span>
                    <span className="text-sm font-bold text-slate-900">
                        {filteredKRs.length} <span className="text-slate-500 font-normal">KRs</span>
                    </span>
                </div>
            </div>

            {/* Content List */}
            {loading && annualKRs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-6">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-slate-100 rounded-full" />
                        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium animate-pulse">Sincronizando dados...</p>
                </div>
            ) : filteredKRs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-6 bg-white rounded-full mb-6 shadow-sm ring-1 ring-slate-100">
                        <Filter className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhum resultado encontrado</h3>
                    <p className="text-sm max-w-md text-center text-slate-500 mb-8">
                        Não encontramos nenhum KR correspondente aos filtros selecionados.
                    </p>
                    <Button variant="outline" onClick={() => { setFilterPillar('all'); setFilterObjective('all') }}>
                        Limpar Filtros
                    </Button>
                </div>
            ) : (
                <div className="space-y-6 pb-20">
                    {filteredKRs.map(kr => (
                        <KRCard
                            key={kr.id}
                            kr={kr}
                            getEntry={getEntry}
                            upsertTracking={upsertTracking}
                            currentQuarterHint={currentQuarterHint}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
