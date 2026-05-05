import { useMemo, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, GitBranch, Search, ClipboardList, Pencil, Check, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import { DeadlineIndicatorIcon } from '../../components/okr/DeadlineIndicator'
import { useCascadeOKRData } from '../../hooks/useCascadeOKRData'
import type { CascadeObjective, CascadePillar, CascadeTreeNode } from '../../hooks/useCascadeOKRData'
import type { ConfidenceLevel } from '../../types'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionPlanBrief {
    id: string
    title: string
    status: 'not_started' | 'in_progress' | 'completed'
    owner_name: string | null
    due_date: string | null
}

interface ConfidenceSummary {
    total: number
    on_track: number
    at_risk: number
    off_track: number
    not_set: number
}

interface ObjectiveGroup {
    objective: CascadeObjective
    roots: CascadeTreeNode[]
    confidence: ConfidenceSummary
}

interface PillarSection {
    pillar: CascadePillar
    objectives: ObjectiveGroup[]
    confidence: ConfidenceSummary
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function flattenNodes(nodes: CascadeTreeNode[]): CascadeTreeNode[] {
    return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}

function countConfidence(nodes: CascadeTreeNode[]): ConfidenceSummary {
    return nodes.reduce<ConfidenceSummary>((acc, node) => {
        acc.total += 1
        if (node.confidence === 'on_track') acc.on_track += 1
        else if (node.confidence === 'at_risk') acc.at_risk += 1
        else if (node.confidence === 'off_track') acc.off_track += 1
        else acc.not_set += 1
        return acc
    }, { total: 0, on_track: 0, at_risk: 0, off_track: 0, not_set: 0 })
}

function matchesText(value: string | null | undefined, term: string): boolean {
    if (!term) return true
    return (value || '').toLowerCase().includes(term)
}

function nodeMatchesSearch(node: CascadeTreeNode, term: string): boolean {
    if (!term) return true
    if (
        matchesText(node.code, term)
        || matchesText(node.title, term)
        || matchesText(node.owner_name, term)
        || (node.owner_names || []).some((n) => matchesText(n, term))
        || matchesText(node.description, term)
    ) return true
    return node.children.some((child) => nodeMatchesSearch(child, term))
}

function filterTreeBySearch(nodes: CascadeTreeNode[], term: string): CascadeTreeNode[] {
    if (!term) return nodes
    return nodes
        .filter((node) => nodeMatchesSearch(node, term))
        .map((node) => ({
            ...node,
            children: filterTreeBySearch(node.children, term),
        }))
}

function nodeMatchesTeam(node: CascadeTreeNode, memberNames: Set<string>): boolean {
    const owners = node.owner_names?.length
        ? node.owner_names
        : node.owner_name ? [node.owner_name] : []
    if (owners.some((o) => memberNames.has(o))) return true
    return node.children.some((child) => nodeMatchesTeam(child, memberNames))
}

function filterTreeByTeam(nodes: CascadeTreeNode[], memberNames: Set<string>): CascadeTreeNode[] {
    return nodes
        .filter((node) => nodeMatchesTeam(node, memberNames))
        .map((node) => ({
            ...node,
            children: filterTreeByTeam(node.children, memberNames),
        }))
}

function nodeMatchesPeriod(node: CascadeTreeNode, periods: Set<string>): boolean {
    if (periods.size === 0) return true
    const directMatch =
        (periods.has('annual') && node.scope === 'annual')
        || (periods.has('q1') && node.scope === 'quarterly' && node.quarter === 1)
        || (periods.has('q2') && node.scope === 'quarterly' && node.quarter === 2)
        || (periods.has('q3') && node.scope === 'quarterly' && node.quarter === 3)
        || (periods.has('q4') && node.scope === 'quarterly' && node.quarter === 4)
    if (directMatch) return true
    return node.children.some((child) => nodeMatchesPeriod(child, periods))
}

function filterTreeByPeriod(nodes: CascadeTreeNode[], periods: Set<string>): CascadeTreeNode[] {
    if (periods.size === 0) return nodes
    return nodes
        .filter((node) => nodeMatchesPeriod(node, periods))
        .map((node) => ({
            ...node,
            children: filterTreeByPeriod(node.children, periods),
        }))
}

function nodeMatchesUser(node: CascadeTreeNode, userNames: Set<string>): boolean {
    const owners = node.owner_names?.length
        ? node.owner_names
        : node.owner_name ? [node.owner_name] : []
    if (owners.some((o) => userNames.has(o))) return true
    return node.children.some((child) => nodeMatchesUser(child, userNames))
}

function filterTreeByUser(nodes: CascadeTreeNode[], userNames: Set<string>): CascadeTreeNode[] {
    return nodes
        .filter((node) => nodeMatchesUser(node, userNames))
        .map((node) => ({
            ...node,
            children: filterTreeByUser(node.children, userNames),
        }))
}

function getProgressColor(progress: number | null): string {
    if (progress === null) return 'var(--color-border)'
    if (progress >= 70) return 'var(--color-success)'
    if (progress >= 40) return 'var(--color-warning)'
    return 'var(--color-danger)'
}

function formatKRValue(value: number | null, metricType: string, unit: string, currencyType?: string | null): string {
    if (value === null) return '—'
    const formatted = value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
    if (metricType === 'currency') {
        const locale = currencyType === 'BRL' ? 'pt-BR' : 'en-US'
        const currency = currencyType || 'BRL'
        return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
    }
    if (metricType === 'percentage') return `${formatted}%`
    if (metricType === 'days') return `${formatted} ${unit || 'dias'}`
    return unit ? `${formatted} ${unit}` : formatted
}

// ─── ConfidenceDot ────────────────────────────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: ConfidenceLevel }) {
    const color =
        confidence === 'on_track' ? 'var(--color-success)'
        : confidence === 'at_risk' ? 'var(--color-warning)'
        : confidence === 'off_track' ? 'var(--color-danger)'
        : 'var(--color-text-muted)'
    return (
        <div
            className="flex-shrink-0 rounded-full"
            style={{ width: '10px', height: '10px', backgroundColor: color, boxShadow: `0 0 0 3px ${color}30` }}
        />
    )
}

// ─── ActionPlanStatusBadge ────────────────────────────────────────────────────

function ActionPlanStatusBadge({ status }: { status: ActionPlanBrief['status'] }) {
    if (status === 'completed') {
        return (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-800/50">
                Concluído
            </span>
        )
    }
    if (status === 'in_progress') {
        return (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800/50">
                Em andamento
            </span>
        )
    }
    return (
        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]">
            Não iniciado
        </span>
    )
}

// ─── GlobalSummaryBar ─────────────────────────────────────────────────────────

function GlobalSummaryBar({ summary }: { summary: ConfidenceSummary }) {
    const { t } = useTranslation()
    if (summary.total === 0) return null

    const segments = [
        { key: 'on_track', count: summary.on_track, color: 'var(--color-success)', label: t('okr.flow.mapOnTrackCount', { count: summary.on_track }) },
        { key: 'at_risk', count: summary.at_risk, color: 'var(--color-warning)', label: t('okr.flow.mapAtRiskCount', { count: summary.at_risk }) },
        { key: 'off_track', count: summary.off_track, color: 'var(--color-danger)', label: t('okr.flow.mapOffTrackCount', { count: summary.off_track }) },
        { key: 'not_set', count: summary.not_set, color: 'var(--color-border)', label: t('okr.flow.mapNotSetCount', { count: summary.not_set }) },
    ]

    return (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {t('okr.flow.mapTotalKRs', { count: summary.total })}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                    {segments.map((seg) => seg.count > 0 && (
                        <div key={seg.key} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                            <span className="text-xs text-[var(--color-text-secondary)]">
                                {seg.label}
                                <span className="ml-1 text-[var(--color-text-muted)]">
                                    ({Math.round((seg.count / summary.total) * 100)}%)
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
                {segments.map((seg) => seg.count > 0 && (
                    <div
                        key={seg.key}
                        className="transition-all duration-500"
                        style={{ width: `${(seg.count / summary.total) * 100}%`, backgroundColor: seg.color }}
                    />
                ))}
            </div>
        </div>
    )
}

// ─── PillarNavigator ──────────────────────────────────────────────────────────

interface PillarNavigatorProps {
    sections: PillarSection[]
    activePillarId: string | null
    onPillarClick: (pillarId: string) => void
}

function PillarNavigator({ sections, activePillarId, onPillarClick }: PillarNavigatorProps) {
    const { t } = useTranslation()

    return (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-2 mb-2">
                {t('okr.flow.pillarsNav', 'Pilares')}
            </p>
            <div className="flex flex-col gap-1">
                {sections.map((section) => {
                    const isActive = activePillarId === section.pillar.id
                    const { total, on_track, at_risk, off_track, not_set } = section.confidence
                    const pct = (n: number) => total > 0 ? (n / total) * 100 : 0

                    return (
                        <button
                            key={section.pillar.id}
                            type="button"
                            onClick={() => onPillarClick(section.pillar.id)}
                            className={cn(
                                'w-full text-left px-2 py-2 rounded-lg transition-colors',
                                isActive
                                    ? 'bg-[var(--color-primary)]/10'
                                    : 'hover:bg-[var(--color-surface-hover)]'
                            )}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: section.pillar.color }}
                                />
                                <span className={cn(
                                    'text-xs font-medium truncate flex-1',
                                    isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
                                )}>
                                    {section.pillar.name}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">{total}</span>
                            </div>
                            <div className="flex h-1 rounded-full overflow-hidden gap-px">
                                {on_track > 0 && <div style={{ width: `${pct(on_track)}%`, backgroundColor: 'var(--color-success)' }} />}
                                {at_risk > 0 && <div style={{ width: `${pct(at_risk)}%`, backgroundColor: 'var(--color-warning)' }} />}
                                {off_track > 0 && <div style={{ width: `${pct(off_track)}%`, backgroundColor: 'var(--color-danger)' }} />}
                                {not_set > 0 && <div style={{ width: `${pct(not_set)}%`, backgroundColor: 'var(--color-border)' }} />}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── KRTreeNode ───────────────────────────────────────────────────────────────

interface KRTreeNodeProps {
    node: CascadeTreeNode
    pillarId: string
    depth: number
    isLast: boolean
    ancestorIsLast: boolean[]
    onNavigate: (pillarId: string, krId: string) => void
    showActionPlans: boolean
    actionPlansByKrId: Record<string, ActionPlanBrief[]>
    onUpdateActual: (krId: string, value: number | null) => void
}

function KRTreeNode({ node, pillarId, depth, isLast, ancestorIsLast, onNavigate, showActionPlans, actionPlansByKrId, onUpdateActual }: KRTreeNodeProps) {
    const { t } = useTranslation()
    const [collapsed, setCollapsed] = useState(false)
    const [editingActual, setEditingActual] = useState(false)
    const [actualDraft, setActualDraft] = useState('')

    const hasChildren = node.children.length > 0
    const progress = node.progress !== null ? Math.max(0, Math.min(100, node.progress)) : null
    const progressColor = getProgressColor(progress)
    const confidenceBorderColor =
        node.confidence === 'on_track' ? 'var(--color-success)'
        : node.confidence === 'at_risk' ? 'var(--color-warning)'
        : node.confidence === 'off_track' ? 'var(--color-danger)'
        : 'transparent'

    function startEdit() {
        setActualDraft(node.actual !== null ? String(node.actual) : '')
        setEditingActual(true)
    }

    function saveActual() {
        const trimmed = actualDraft.trim()
        const parsed = trimmed === '' ? null : parseFloat(trimmed.replace(',', '.'))
        if (trimmed !== '' && (parsed === null || isNaN(parsed))) {
            setEditingActual(false)
            return
        }
        onUpdateActual(node.id, parsed)
        setEditingActual(false)
    }

    function cancelEdit() {
        setEditingActual(false)
    }

    function handleActualKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') { e.preventDefault(); saveActual() }
        if (e.key === 'Escape') cancelEdit()
    }

    return (
        <div>
            <div className="flex items-center group min-h-[40px]">
                {/* Vertical continuation lines for ancestor levels */}
                {Array.from({ length: depth }, (_, i) => (
                    <div
                        key={i}
                        className="flex-shrink-0 self-stretch"
                        style={{
                            width: '20px',
                            borderLeft: ancestorIsLast[i] ? 'none' : '2px solid var(--color-border)',
                        }}
                    />
                ))}

                {/* L-shaped connector for current level */}
                {depth > 0 && (
                    <div className="flex-shrink-0 self-stretch relative" style={{ width: '20px' }}>
                        <div
                            className="absolute"
                            style={{
                                left: 0,
                                top: 0,
                                width: '14px',
                                height: '50%',
                                borderLeft: '2px solid var(--color-border)',
                                borderBottom: '2px solid var(--color-border)',
                                borderBottomLeftRadius: '4px',
                            }}
                        />
                        {!isLast && (
                            <div
                                className="absolute"
                                style={{
                                    left: 0,
                                    top: '50%',
                                    bottom: 0,
                                    borderLeft: '2px solid var(--color-border)',
                                }}
                            />
                        )}
                    </div>
                )}

                {/* Edit mode panel — replaces nav button entirely to avoid nested interactives */}
                {editingActual ? (
                    <div
                        className="flex-1 flex items-center gap-2 px-2 py-1 rounded-lg min-w-0 border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/[0.05]"
                    >
                        <ConfidenceDot confidence={node.confidence} />
                        <span className="font-mono text-[11px] font-semibold text-[var(--color-text-muted)] flex-shrink-0 hidden md:block">
                            {node.code}
                        </span>
                        <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate min-w-0">
                            {node.title}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap hidden sm:block">
                                Valor atual
                            </span>
                            <input
                                type="number"
                                value={actualDraft}
                                onChange={(e) => setActualDraft(e.target.value)}
                                onBlur={saveActual}
                                onKeyDown={handleActualKeyDown}
                                autoFocus
                                step="any"
                                className="w-20 text-xs text-right bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                            />
                            <button
                                type="button"
                                onClick={saveActual}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)] transition-colors"
                                style={{ color: 'var(--color-success)' }}
                                title="Salvar"
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors"
                                title="Cancelar"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Normal navigation button */
                    <button
                        type="button"
                        onClick={() => onNavigate(pillarId, node.id)}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-left min-w-0 transition-colors border-l-2"
                        style={{ borderLeftColor: confidenceBorderColor }}
                    >
                        <ConfidenceDot confidence={node.confidence} />

                        <span className="font-mono text-[11px] font-semibold text-[var(--color-text-muted)] flex-shrink-0 min-w-[52px]">
                            {node.code}
                        </span>

                        <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] min-w-[30px] text-center">
                            {node.scope === 'annual'
                                ? 'Anual'
                                : node.quarter
                                ? `Q${node.quarter}`
                                : '—'}
                        </span>

                        <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
                            {node.title}
                        </span>

                        {/* Metric section: baseline → atual / meta + barra */}
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <div className="flex items-center gap-1">
                                {node.baseline !== null && (
                                    <>
                                        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                                            {formatKRValue(node.baseline, node.metric_type, node.unit, node.currency_type)}
                                        </span>
                                        <span className="text-[10px] text-[var(--color-text-muted)]">→</span>
                                    </>
                                )}
                                <span className={cn(
                                    'text-xs font-semibold tabular-nums',
                                    node.actual !== null
                                        ? 'text-[var(--color-text-primary)]'
                                        : 'text-[var(--color-text-muted)]'
                                )}>
                                    {formatKRValue(node.actual, node.metric_type, node.unit, node.currency_type)}
                                </span>
                                {node.target !== null && (
                                    <>
                                        <span className="text-[10px] text-[var(--color-text-muted)]">/</span>
                                        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                                            {formatKRValue(node.target, node.metric_type, node.unit, node.currency_type)}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-20 h-1.5 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
                                    {progress !== null && (
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%`, backgroundColor: progressColor }}
                                        />
                                    )}
                                </div>
                                <span className="text-[10px] font-medium text-[var(--color-text-muted)] w-7 text-right flex-shrink-0">
                                    {node.progress !== null ? `${node.progress}%` : '—'}
                                </span>
                            </div>
                        </div>

                        {/* Owner (hidden on smaller screens) */}
                        <span className="hidden xl:block text-xs text-[var(--color-text-muted)] w-28 truncate flex-shrink-0">
                            {(node.owner_names && node.owner_names.length > 0)
                                ? node.owner_names.join(', ')
                                : (node.owner_name || t('common.unassigned'))}
                        </span>

                        {/* Deadline */}
                        {node.due_date && (
                            <DeadlineIndicatorIcon
                                dueDate={node.due_date}
                                isCompleted={node.is_completed || node.progress === 100 || node.is_active === false}
                            />
                        )}
                    </button>
                )}

                {/* Pencil: editar valor atual — visível no hover do grupo */}
                {!editingActual && (
                    <button
                        type="button"
                        onClick={startEdit}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] opacity-0 group-hover:opacity-100 transition-all ml-0.5"
                        title="Editar valor atual"
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                )}

                {/* Expand/collapse children */}
                {hasChildren && (
                    <button
                        type="button"
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors ml-1"
                    >
                        {collapsed
                            ? <ChevronRight className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                )}
            </div>

            {/* Action Plans */}
            {showActionPlans && (actionPlansByKrId[node.id]?.length ?? 0) > 0 && (
                <div
                    className="pb-1.5"
                    style={{
                        paddingLeft: `${depth === 0 ? 4 : (depth + 1) * 20 + 4}px`,
                        paddingRight: '4px',
                    }}
                >
                    <div className="rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/[0.04] overflow-hidden">
                        <div
                            className="flex items-center gap-1.5 px-3 py-1 border-b border-[var(--color-primary)]/15"
                        >
                            <ClipboardList
                                className="w-3 h-3 flex-shrink-0"
                                style={{ color: 'var(--color-primary)', opacity: 0.65 }}
                            />
                            <span
                                className="text-[10px] font-semibold uppercase tracking-widest"
                                style={{ color: 'var(--color-primary)', opacity: 0.65 }}
                            >
                                Planos de Ação
                            </span>
                            <span
                                className="ml-auto text-[10px] font-medium flex-shrink-0 tabular-nums"
                                style={{ color: 'var(--color-primary)', opacity: 0.45 }}
                            >
                                {actionPlansByKrId[node.id].length}
                            </span>
                        </div>
                        <div className="divide-y divide-[var(--color-primary)]/10">
                            {actionPlansByKrId[node.id].map((plan) => (
                                <div key={plan.id} className="flex items-center gap-2 px-3 py-1.5 min-w-0">
                                    <ActionPlanStatusBadge status={plan.status} />
                                    <span className="flex-1 text-xs text-[var(--color-text-primary)] truncate min-w-0">
                                        {plan.title}
                                    </span>
                                    {plan.owner_name && (
                                        <span className="hidden sm:block text-[10px] text-[var(--color-text-muted)] truncate max-w-[100px] flex-shrink-0">
                                            {plan.owner_name}
                                        </span>
                                    )}
                                    {plan.due_date && (
                                        <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                                            {formatShortDate(plan.due_date)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Children */}
            {hasChildren && !collapsed && (
                <div>
                    {node.children.map((child, i) => (
                        <KRTreeNode
                            key={child.id}
                            node={child}
                            pillarId={pillarId}
                            depth={depth + 1}
                            isLast={i === node.children.length - 1}
                            ancestorIsLast={[...ancestorIsLast, isLast]}
                            onNavigate={onNavigate}
                            showActionPlans={showActionPlans}
                            actionPlansByKrId={actionPlansByKrId}
                            onUpdateActual={onUpdateActual}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OKRConfidenceMapPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const currentPath = `${location.pathname}${location.search}${location.hash}`

    const { loading, selectedUnit, selectedUnitData, objectives, getVisiblePillars, getObjectiveRoots, updateValue } = useCascadeOKRData()

    const [searchTerm, setSearchTerm] = useState('')
    const [collapsedPillarIds, setCollapsedPillarIds] = useState<Set<string>>(new Set())
    const [collapsedObjectiveIds, setCollapsedObjectiveIds] = useState<Set<string>>(new Set())
    const [activePillarId, setActivePillarId] = useState<string | null>(null)
    const [teams, setTeams] = useState<{ id: string; name: string; memberNames: string[] }[]>([])
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
    const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set())
    const [selectedUserNames, setSelectedUserNames] = useState<Set<string>>(new Set())
    const [companyUsers, setCompanyUsers] = useState<{ id: string; full_name: string }[]>([])
    const [showActionPlans, setShowActionPlans] = useState(false)
    const [actionPlansByKrId, setActionPlansByKrId] = useState<Record<string, ActionPlanBrief[]>>({})
    const [loadingActionPlans, setLoadingActionPlans] = useState(false)

    const pillarSectionRefs = useRef<Map<string, HTMLElement>>(new Map())

    useEffect(() => {
        supabase
            .from('teams')
            .select('id, name, team_members(users(full_name))')
            .eq('is_active', true)
            .order('order_index')
            .then(({ data }) => {
                if (data) {
                    setTeams(data.map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        memberNames: (t.team_members as any[])
                            .map((m: any) => m.users?.full_name)
                            .filter(Boolean),
                    })))
                }
            })
    }, [])

    useEffect(() => {
        if (!selectedUnit) return
        supabase
            .from('user_business_units')
            .select('users(id, full_name)')
            .eq('business_unit_id', selectedUnit)
            .then(({ data }) => {
                if (data) {
                    const users = (data as any[])
                        .map((row: any) => row.users)
                        .filter(Boolean)
                        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
                    setCompanyUsers(users)
                }
            })
    }, [selectedUnit])

    // Build all sections from data
    const allSections = useMemo<PillarSection[]>(() => {
        return getVisiblePillars().map((pillar) => {
            const objectiveGroups: ObjectiveGroup[] = objectives
                .filter((objective) => objective.pillar_id === pillar.id)
                .map((objective) => {
                    const roots = getObjectiveRoots(objective.id)
                    return {
                        objective,
                        roots,
                        confidence: countConfidence(flattenNodes(roots)),
                    }
                })
            return {
                pillar,
                objectives: objectiveGroups,
                confidence: countConfidence(objectiveGroups.flatMap((g) => flattenNodes(g.roots))),
            }
        })
    }, [getObjectiveRoots, getVisiblePillars, objectives])

    useEffect(() => {
        if (!showActionPlans || allSections.length === 0) return
        const allKrIds = allSections.flatMap((s) =>
            s.objectives.flatMap((g) => flattenNodes(g.roots).map((n) => n.id))
        )
        if (allKrIds.length === 0) return
        setLoadingActionPlans(true)
        supabase
            .from('action_plans')
            .select('id, key_result_id, title, status, owner_name, due_date')
            .in('key_result_id', allKrIds)
            .then(({ data }) => {
                if (data) {
                    const byKrId: Record<string, ActionPlanBrief[]> = {}
                    for (const plan of data as any[]) {
                        if (!byKrId[plan.key_result_id]) byKrId[plan.key_result_id] = []
                        byKrId[plan.key_result_id].push({
                            id: plan.id,
                            title: plan.title,
                            status: plan.status,
                            owner_name: plan.owner_name,
                            due_date: plan.due_date,
                        })
                    }
                    setActionPlansByKrId(byKrId)
                }
                setLoadingActionPlans(false)
            })
    }, [showActionPlans, allSections])

    const normalizedSearch = searchTerm.trim().toLowerCase()

    const teamMemberNames = useMemo<Set<string> | null>(() => {
        if (!selectedTeamId) return null
        const team = teams.find((t) => t.id === selectedTeamId)
        return new Set(team?.memberNames ?? [])
    }, [selectedTeamId, teams])

    const filteredSections = useMemo<PillarSection[]>(() => {
        return allSections
            .map((section) => {
                const pillarMatches = (
                    matchesText(section.pillar.name, normalizedSearch)
                    || matchesText(section.pillar.code, normalizedSearch)
                    || matchesText(section.pillar.description, normalizedSearch)
                )
                const objectiveGroups = section.objectives
                    .map((group) => {
                        const objectiveMatches = (
                            matchesText(group.objective.code, normalizedSearch)
                            || matchesText(group.objective.title, normalizedSearch)
                        )

                        // Apply search filter
                        let roots = group.roots
                        if (normalizedSearch && !pillarMatches && !objectiveMatches) {
                            roots = filterTreeBySearch(roots, normalizedSearch)
                            if (roots.length === 0) return null
                        }

                        // Apply team filter
                        if (teamMemberNames) {
                            roots = filterTreeByTeam(roots, teamMemberNames)
                            if (roots.length === 0) return null
                        }

                        // Apply period filter
                        if (selectedPeriods.size > 0) {
                            roots = filterTreeByPeriod(roots, selectedPeriods)
                            if (roots.length === 0) return null
                        }

                        // Apply user filter
                        if (selectedUserNames.size > 0) {
                            roots = filterTreeByUser(roots, selectedUserNames)
                            if (roots.length === 0) return null
                        }

                        return {
                            objective: group.objective,
                            roots,
                            confidence: countConfidence(flattenNodes(roots)),
                        }
                    })
                    .filter((group): group is ObjectiveGroup => group !== null)

                const hasActiveFilter = Boolean(normalizedSearch || teamMemberNames || selectedPeriods.size > 0 || selectedUserNames.size > 0)
                if (hasActiveFilter && !pillarMatches && objectiveGroups.length === 0) return null

                return {
                    pillar: section.pillar,
                    objectives: objectiveGroups,
                    confidence: countConfidence(objectiveGroups.flatMap((g) => flattenNodes(g.roots))),
                }
            })
            .filter((section): section is PillarSection => section !== null)
    }, [allSections, normalizedSearch, teamMemberNames, selectedPeriods, selectedUserNames])

    const globalSummary = useMemo(() => {
        return filteredSections.reduce<ConfidenceSummary>((acc, s) => {
            acc.total += s.confidence.total
            acc.on_track += s.confidence.on_track
            acc.at_risk += s.confidence.at_risk
            acc.off_track += s.confidence.off_track
            acc.not_set += s.confidence.not_set
            return acc
        }, { total: 0, on_track: 0, at_risk: 0, off_track: 0, not_set: 0 })
    }, [filteredSections])

    // Auto-expand everything when searching or filtering
    useEffect(() => {
        if (normalizedSearch || selectedTeamId || selectedPeriods.size > 0 || selectedUserNames.size > 0) {
            setCollapsedPillarIds(new Set())
            setCollapsedObjectiveIds(new Set())
        }
    }, [normalizedSearch, selectedTeamId, selectedPeriods, selectedUserNames])

    // Initialize active pillar to first section
    useEffect(() => {
        if (!activePillarId && filteredSections.length > 0) {
            setActivePillarId(filteredSections[0].pillar.id)
        }
    }, [filteredSections, activePillarId])

    // IntersectionObserver for scroll-spy
    useEffect(() => {
        const refs = pillarSectionRefs.current
        if (refs.size === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('data-pillar-id')
                        if (id) setActivePillarId(id)
                        break
                    }
                }
            },
            { threshold: 0, rootMargin: '-80px 0px -60% 0px' }
        )

        refs.forEach((el) => observer.observe(el))
        return () => observer.disconnect()
    }, [filteredSections])

    function setPillarRef(pillarId: string, el: HTMLElement | null) {
        if (el) pillarSectionRefs.current.set(pillarId, el)
        else pillarSectionRefs.current.delete(pillarId)
    }

    function scrollToPillar(pillarId: string) {
        const el = pillarSectionRefs.current.get(pillarId)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setActivePillarId(pillarId)
        }
    }

    function togglePeriod(period: string) {
        setSelectedPeriods((prev) => {
            const next = new Set(prev)
            if (next.has(period)) next.delete(period)
            else next.add(period)
            return next
        })
    }

    function toggleUser(userName: string) {
        setSelectedUserNames((prev) => {
            const next = new Set(prev)
            if (next.has(userName)) next.delete(userName)
            else next.add(userName)
            return next
        })
    }

    function togglePillar(pillarId: string) {
        setCollapsedPillarIds((prev) => {
            const next = new Set(prev)
            if (next.has(pillarId)) next.delete(pillarId)
            else next.add(pillarId)
            return next
        })
    }

    function toggleObjective(objectiveId: string) {
        setCollapsedObjectiveIds((prev) => {
            const next = new Set(prev)
            if (next.has(objectiveId)) next.delete(objectiveId)
            else next.add(objectiveId)
            return next
        })
    }

    function openKRFocus(pillarId: string, krId: string) {
        navigate(`/okrs/pillar/${pillarId}/kr/${krId}`, { state: { backTo: currentPath } })
    }

    if (loading && allSections.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[360px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('okr.loadingData')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex gap-0 min-h-[calc(100vh-112px)]">
            {/* Left sticky navigator */}
            <aside className="hidden lg:block w-[200px] flex-shrink-0 sticky top-6 self-start pr-4">
                <PillarNavigator
                    sections={filteredSections}
                    activePillarId={activePillarId}
                    onPillarClick={scrollToPillar}
                />
            </aside>

            {/* Right scrollable content */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            <GitBranch className="w-6 h-6 text-[var(--color-primary)]" />
                            {t('okr.flow.mapTitle')}
                        </h1>
                        <p className="text-[var(--color-text-secondary)] mt-1">
                            {selectedUnitData?.name && (
                                <span className="font-medium">{selectedUnitData.name} · </span>
                            )}
                            {t('okr.flow.mapSubtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowActionPlans((prev) => !prev)}
                            className={cn(
                                'flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-all duration-200',
                                showActionPlans
                                    ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]'
                            )}
                        >
                            <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
                            {loadingActionPlans
                                ? 'Carregando…'
                                : showActionPlans
                                ? 'Ocultar planos'
                                : 'Planos de ação'}
                        </button>
                        <Button variant="outline" onClick={() => setCollapsedPillarIds(new Set())}>
                            {t('okr.cascade.expandAll')}
                        </Button>
                        <Button variant="ghost" onClick={() => setCollapsedPillarIds(new Set(filteredSections.map((s) => s.pillar.id)))}>
                            {t('okr.cascade.collapseAll')}
                        </Button>
                    </div>
                </div>

                {/* Search + Filters */}
                <div className="flex flex-col gap-2">
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('okr.flow.mapSearchPlaceholder')}
                        icon={<Search className="w-4 h-4" />}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Period toggle chips */}
                        <div className="flex items-center gap-1">
                            {(['annual', 'q1', 'q2', 'q3', 'q4'] as const).map((period) => {
                                const isSelected = selectedPeriods.has(period)
                                const label = period === 'annual' ? t('quarterlyCard.annual') : period.toUpperCase()
                                return (
                                    <button
                                        key={period}
                                        type="button"
                                        onClick={() => togglePeriod(period)}
                                        className={cn(
                                            'h-9 px-3 text-xs font-medium rounded-lg border transition-all duration-200',
                                            isSelected
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                                        )}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Team dropdown */}
                        {teams.length > 0 && (
                            <select
                                value={selectedTeamId ?? ''}
                                onChange={(e) => setSelectedTeamId(e.target.value || null)}
                                className={cn(
                                    'h-9 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-200 min-w-[140px]',
                                    selectedTeamId
                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                                )}
                            >
                                <option value="">{t('okr.flow.mapTeamFilterAll', 'Todos os times')}</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        )}

                        {/* User multi-select */}
                        {companyUsers.length > 0 && (
                            <MultiSelectDropdown
                                options={companyUsers.map((u) => ({ value: u.full_name, label: u.full_name }))}
                                selected={selectedUserNames}
                                onToggle={toggleUser}
                                placeholder={t('common.allUsers', 'Todos os usuários')}
                            />
                        )}
                    </div>
                </div>

                {/* Global confidence bar */}
                <GlobalSummaryBar summary={globalSummary} />

                {/* Pillar sections */}
                {filteredSections.length === 0 ? (
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-10 text-center">
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {t('okr.flow.mapEmptyTitle')}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2">
                            {normalizedSearch
                                ? t('okr.flow.mapEmptySearchDescription')
                                : t('okr.flow.mapEmptyDescription')}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredSections.map((section) => {
                            const isPillarExpanded = !collapsedPillarIds.has(section.pillar.id)
                            return (
                                <section
                                    key={section.pillar.id}
                                    ref={(el) => setPillarRef(section.pillar.id, el)}
                                    data-pillar-id={section.pillar.id}
                                >
                                    <div
                                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
                                        style={{ borderLeftColor: section.pillar.color, borderLeftWidth: '4px' }}
                                    >
                                        {/* Pillar header */}
                                        <div className="px-4 py-3 bg-[var(--color-surface-hover)]/40 border-b border-[var(--color-border)]">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePillar(section.pillar.id)}
                                                        className="w-7 h-7 rounded-lg border border-[var(--color-border)] inline-flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] flex-shrink-0"
                                                        aria-label={isPillarExpanded ? t('okr.flow.mapCollapsePillar') : t('okr.flow.mapExpandPillar')}
                                                    >
                                                        {isPillarExpanded
                                                            ? <ChevronDown className="w-3.5 h-3.5" />
                                                            : <ChevronRight className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <div
                                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: section.pillar.color }}
                                                    />
                                                    <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                                                        {section.pillar.name}
                                                    </h2>
                                                    <Badge variant="outline" size="sm" className="flex-shrink-0">
                                                        {section.pillar.code}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <Badge variant="default" size="sm">
                                                        {t('okr.flow.mapTotalKRs', { count: section.confidence.total })}
                                                    </Badge>
                                                    {section.confidence.on_track > 0 && (
                                                        <Badge variant="success" size="sm">{section.confidence.on_track}</Badge>
                                                    )}
                                                    {section.confidence.at_risk > 0 && (
                                                        <Badge variant="warning" size="sm">{section.confidence.at_risk}</Badge>
                                                    )}
                                                    {section.confidence.off_track > 0 && (
                                                        <Badge variant="danger" size="sm">{section.confidence.off_track}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            {section.confidence.total > 0 && (
                                                <div className="mt-2.5 flex h-1.5 rounded-full overflow-hidden gap-px">
                                                    {section.confidence.on_track > 0 && (
                                                        <div style={{ width: `${(section.confidence.on_track / section.confidence.total) * 100}%`, backgroundColor: 'var(--color-success)' }} />
                                                    )}
                                                    {section.confidence.at_risk > 0 && (
                                                        <div style={{ width: `${(section.confidence.at_risk / section.confidence.total) * 100}%`, backgroundColor: 'var(--color-warning)' }} />
                                                    )}
                                                    {section.confidence.off_track > 0 && (
                                                        <div style={{ width: `${(section.confidence.off_track / section.confidence.total) * 100}%`, backgroundColor: 'var(--color-danger)' }} />
                                                    )}
                                                    {section.confidence.not_set > 0 && (
                                                        <div style={{ width: `${(section.confidence.not_set / section.confidence.total) * 100}%`, backgroundColor: 'var(--color-border)' }} />
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Objectives and KR trees */}
                                        {isPillarExpanded && (
                                            <div className="divide-y divide-[var(--color-border)]">
                                                {section.objectives.map((group) => {
                                                    const isObjectiveExpanded = !collapsedObjectiveIds.has(group.objective.id)
                                                    return (
                                                        <div key={group.objective.id}>
                                                            {/* Objective header */}
                                                            <div className="px-4 pt-2.5 pb-2 bg-[var(--color-surface-hover)]/20">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleObjective(group.objective.id)}
                                                                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex-shrink-0"
                                                                    >
                                                                        {isObjectiveExpanded
                                                                            ? <ChevronDown className="w-3.5 h-3.5" />
                                                                            : <ChevronRight className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                    <Badge variant="outline" size="sm" className="font-mono flex-shrink-0">
                                                                        {group.objective.code}
                                                                    </Badge>
                                                                    <span className="text-sm font-semibold text-[var(--color-text-primary)] flex-1 truncate">
                                                                        {group.objective.title}
                                                                    </span>
                                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                                        <Badge variant="default" size="sm">
                                                                            {t('okr.flow.mapTotalKRs', { count: group.confidence.total })}
                                                                        </Badge>
                                                                        {group.confidence.on_track > 0 && (
                                                                            <Badge variant="success" size="sm">{group.confidence.on_track}</Badge>
                                                                        )}
                                                                        {group.confidence.at_risk > 0 && (
                                                                            <Badge variant="warning" size="sm">{group.confidence.at_risk}</Badge>
                                                                        )}
                                                                        {group.confidence.off_track > 0 && (
                                                                            <Badge variant="danger" size="sm">{group.confidence.off_track}</Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* KR tree */}
                                                            {isObjectiveExpanded && group.roots.length > 0 && (
                                                                <div className="px-4 py-2">
                                                                    {group.roots.map((root, i) => (
                                                                        <KRTreeNode
                                                                            key={root.id}
                                                                            node={root}
                                                                            pillarId={section.pillar.id}
                                                                            depth={0}
                                                                            isLast={i === group.roots.length - 1}
                                                                            ancestorIsLast={[]}
                                                                            onNavigate={openKRFocus}
                                                                            showActionPlans={showActionPlans}
                                                                            actionPlansByKrId={actionPlansByKrId}
                                                                            onUpdateActual={(krId, value) => updateValue(krId, 'actual', value)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {isObjectiveExpanded && group.roots.length === 0 && (
                                                                <div className="px-4 py-3">
                                                                    <p className="text-sm text-[var(--color-text-muted)]">
                                                                        {t('okr.flow.noRootForObjective')}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
