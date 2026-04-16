import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart2, Calendar, CheckCircle2, ChevronDown, Clock, ExternalLink, FileText, ListTodo, Pencil, Trash2, User, X } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import { DeadlineBadge } from '../../components/okr/DeadlineBadge'
import { supabase } from '../../lib/supabase'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { cn } from '../../lib/utils'
import { getDeadlineAlert } from '../../lib/dateUtils'
import * as Dialog from '@radix-ui/react-dialog'

function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const AVATAR_COLORS = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
]

function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

interface Team {
    id: string
    name: string
    memberNames: string[]
}

type ActionPlanStatus = 'not_started' | 'in_progress' | 'completed'

const STATUS_CONFIG: Record<ActionPlanStatus, { label: string; className: string }> = {
    not_started: { label: 'Não iniciado',  className: 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]' },
    in_progress:  { label: 'Em andamento', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800/50' },
    completed:    { label: 'Concluído',    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-800/50' },
}

interface ActionPlanTask {
    id: string
    action_plan_id: string
    title: string
    is_done: boolean
    order_index: number
    due_date: string | null
    owner_name: string | null
}

interface ActionPlanWithRelations {
    id: string
    title: string
    due_date: string | null
    owner_name: string | null
    key_result_id: string
    status: ActionPlanStatus
    tracking_method?: string | null
    tracking_links?: Array<{ url: string; label: string }> | null
    observations?: string | null
    effectiveness?: string | null
    key_result: {
        id: string
        code: string
        title: string
        scope: 'annual' | 'quarterly'
        quarter: number | null
        objective: {
            id: string
            title: string
            business_unit_id: string
            pillar_id: string
            business_unit: {
                name: string
            } | null
        } | null
    } | null
}

type DueFilter = 'all' | 'overdue' | 'upcoming' | 'no_due'
type StatusFilter = 'all' | ActionPlanStatus

export function ActionsPage() {
    const { t } = useTranslation()
    const { selectedUnit } = useBusinessUnit()

    const [loading, setLoading] = useState(true)
    const [plans, setPlans] = useState<ActionPlanWithRelations[]>([])
    const [tasksByPlanId, setTasksByPlanId] = useState<Record<string, ActionPlanTask[]>>({})
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const [filter, setFilter] = useState<DueFilter>('all')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [teams, setTeams] = useState<Team[]>([])
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
    const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set())
    const [selectedUserNames, setSelectedUserNames] = useState<Set<string>>(new Set())
    const [selectedPillarIds, setSelectedPillarIds] = useState<Set<string>>(new Set())
    const [companyUsers, setCompanyUsers] = useState<{ id: string; full_name: string }[]>([])
    const [pillars, setPillars] = useState<{ id: string; name: string; color: string }[]>([])

    // Modal states
    const [editingPlan, setEditingPlan] = useState<ActionPlanWithRelations | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editFormData, setEditFormData] = useState({
        title: '',
        owner_name: '',
        due_date: '',
        tracking_method: '',
        observations: '',
    })

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

    useEffect(() => {
        if (!selectedUnit) return
        Promise.all([
            supabase.from('pillar_business_units').select('pillar_id').eq('business_unit_id', selectedUnit),
            supabase.from('pillars').select('id, name, color').eq('is_active', true).order('order_index'),
        ]).then(([pivotRes, pillarsRes]) => {
            const pillarIds = new Set((pivotRes.data || []).map((p: any) => p.pillar_id))
            const filtered = ((pillarsRes.data || []) as { id: string; name: string; color: string }[])
                .filter((p) => pillarIds.has(p.id))
            setPillars(filtered)
        })
    }, [selectedUnit])

    useEffect(() => {
        if (selectedUnit) loadPlans()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUnit])

    async function loadPlans() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('action_plans')
                .select(`
                    id,
                    title,
                    due_date,
                    owner_name,
                    key_result_id,
                    status,
                    tracking_method,
                    tracking_links,
                    observations,
                    effectiveness,
                    key_result:key_results(
                        id,
                        code,
                        title,
                        scope,
                        quarter,
                        objective:objectives(
                            id,
                            title,
                            business_unit_id,
                            pillar_id,
                            business_unit:business_units(name)
                        )
                    )
                `)
                .order('due_date', { ascending: true, nullsFirst: false })

            if (error) throw error

            const typed = (data || []) as unknown as ActionPlanWithRelations[]
            const filtered = typed.filter((p) => p?.key_result?.objective?.business_unit_id === selectedUnit)
            setPlans(filtered)

            if (filtered.length > 0) {
                const { data: tasksData } = await supabase
                    .from('action_plan_tasks')
                    .select('id, action_plan_id, title, is_done, order_index, due_date, owner_name')
                    .in('action_plan_id', filtered.map(p => p.id))
                    .order('order_index', { ascending: true })

                const grouped: Record<string, ActionPlanTask[]> = {}
                for (const plan of filtered) grouped[plan.id] = []
                for (const task of (tasksData || []) as ActionPlanTask[]) {
                    if (grouped[task.action_plan_id]) grouped[task.action_plan_id].push(task)
                }
                setTasksByPlanId(grouped)
            }
        } catch (e) {
            console.error('Error loading action plans:', e)
            setPlans([])
        } finally {
            setLoading(false)
        }
    }

    function toggleExpanded(planId: string) {
        setExpandedIds(prev => {
            const next = new Set(prev)
            next.has(planId) ? next.delete(planId) : next.add(planId)
            return next
        })
    }

    async function toggleTaskDone(planId: string, taskId: string, isDone: boolean) {
        try {
            await supabase.from('action_plan_tasks').update({ is_done: isDone }).eq('id', taskId)
            setTasksByPlanId(prev => ({
                ...prev,
                [planId]: (prev[planId] || []).map(t => t.id === taskId ? { ...t, is_done: isDone } : t),
            }))
        } catch (e) {
            console.error('Error toggling task:', e)
        }
    }

    async function deleteTask(planId: string, taskId: string) {
        try {
            await supabase.from('action_plan_tasks').delete().eq('id', taskId)
            setTasksByPlanId(prev => ({
                ...prev,
                [planId]: (prev[planId] || []).filter(t => t.id !== taskId),
            }))
        } catch (e) {
            console.error('Error deleting task:', e)
        }
    }

    async function updatePlanStatus(planId: string, newStatus: ActionPlanStatus) {
        try {
            await supabase.from('action_plans').update({ status: newStatus }).eq('id', planId)
            setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p))
        } catch (e) {
            console.error('Error updating plan status:', e)
        }
    }

    function openEditor(plan: ActionPlanWithRelations) {
        setEditingPlan(plan)
        setEditFormData({
            title: plan.title || '',
            owner_name: plan.owner_name || '',
            due_date: plan.due_date || '',
            tracking_method: (plan as any).tracking_method || '',
            observations: (plan as any).observations || '',
        })
        setModalOpen(true)
    }

    async function savePlan() {
        if (!editingPlan || !editFormData.title.trim()) return

        setSaving(true)
        try {
            const { error } = await supabase
                .from('action_plans')
                .update({
                    title: editFormData.title.trim(),
                    owner_name: editFormData.owner_name.trim() || null,
                    due_date: editFormData.due_date || null,
                    tracking_method: editFormData.tracking_method.trim() || null,
                    observations: editFormData.observations.trim() || null,
                })
                .eq('id', editingPlan.id)

            if (error) throw error

            setModalOpen(false)
            setEditingPlan(null)
            await loadPlans()
        } catch (e) {
            console.error('Error saving action plan:', e)
        } finally {
            setSaving(false)
        }
    }

    const teamMemberNames = useMemo<Set<string> | null>(() => {
        if (!selectedTeamId) return null
        const team = teams.find((t) => t.id === selectedTeamId)
        return new Set(team?.memberNames ?? [])
    }, [selectedTeamId, teams])

    function matchesPeriod(plan: ActionPlanWithRelations, periods: Set<string>): boolean {
        if (periods.size === 0) return true
        const kr = plan.key_result
        if (!kr) return false
        return (
            (periods.has('annual') && kr.scope === 'annual')
            || (periods.has('q1') && kr.scope === 'quarterly' && kr.quarter === 1)
            || (periods.has('q2') && kr.scope === 'quarterly' && kr.quarter === 2)
            || (periods.has('q3') && kr.scope === 'quarterly' && kr.quarter === 3)
            || (periods.has('q4') && kr.scope === 'quarterly' && kr.quarter === 4)
        )
    }

    // Base plans after team/period/user/pillar filters (used by counts and filteredPlans)
    const basePlans = useMemo(() => {
        let base = plans
        if (teamMemberNames) base = base.filter(p => p.owner_name && teamMemberNames.has(p.owner_name))
        if (selectedPeriods.size > 0) base = base.filter(p => matchesPeriod(p, selectedPeriods))
        if (selectedUserNames.size > 0) base = base.filter(p => p.owner_name && selectedUserNames.has(p.owner_name))
        if (selectedPillarIds.size > 0) base = base.filter(p => p.key_result?.objective?.pillar_id && selectedPillarIds.has(p.key_result.objective.pillar_id))
        return base
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plans, teamMemberNames, selectedPeriods, selectedUserNames, selectedPillarIds])

    const counts = useMemo(() => {
        const now = new Date()
        return {
            all: basePlans.length,
            overdue: basePlans.filter(p => p.due_date && new Date(p.due_date) < now).length,
            upcoming: basePlans.filter(p => p.due_date && new Date(p.due_date) >= now).length,
            no_due: basePlans.filter(p => !p.due_date).length,
        }
    }, [basePlans])

    const ownerColorMap = useMemo(() => {
        const map = new Map<string, string>()
        let i = 0
        for (const p of plans) {
            if (p.owner_name && !map.has(p.owner_name)) {
                map.set(p.owner_name, AVATAR_COLORS[i % AVATAR_COLORS.length])
                i++
            }
        }
        return map
    }, [plans])

    const filteredPlans = useMemo(() => {
        const now = new Date()
        let base = basePlans
        if (filter === 'overdue') base = base.filter(p => p.due_date && new Date(p.due_date) < now)
        else if (filter === 'no_due') base = base.filter(p => !p.due_date)
        else if (filter === 'upcoming') base = base.filter(p => p.due_date && new Date(p.due_date) >= now)
        if (statusFilter !== 'all') base = base.filter(p => p.status === statusFilter)
        return base
    }, [basePlans, filter, statusFilter])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('actions.title')}</h1>
                    <p className="text-[var(--color-text-muted)] mt-2">{t('actionPlan.subtitle')}</p>
                </div>
                <Button variant="outline" onClick={loadPlans}>
                    {t('krTracking.refreshData')}
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as DueFilter)}
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] hover:border-[var(--color-text-muted)] transition-all"
                >
                    <option value="all">{t('actions.status.all')} ({counts.all})</option>
                    <option value="overdue">{t('actions.overdue')} ({counts.overdue})</option>
                    <option value="upcoming">{t('actionPlan.filters.upcoming')} ({counts.upcoming})</option>
                    <option value="no_due">{t('actionPlan.filters.noDueDate')} ({counts.no_due})</option>
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] hover:border-[var(--color-text-muted)] transition-all"
                >
                    <option value="all">{t('common.allStatuses', 'Todos os status')}</option>
                    {(Object.keys(STATUS_CONFIG) as ActionPlanStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                </select>

                {/* Period toggle chips */}
                <div className="flex items-center gap-1">
                    {(['annual', 'q1', 'q2', 'q3', 'q4'] as const).map((period) => {
                        const isSelected = selectedPeriods.has(period)
                        const label = period === 'annual' ? t('quarterlyCard.annual') : period.toUpperCase()
                        return (
                            <button
                                key={period}
                                type="button"
                                onClick={() => setSelectedPeriods((prev) => {
                                    const next = new Set(prev)
                                    next.has(period) ? next.delete(period) : next.add(period)
                                    return next
                                })}
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
                            'h-9 rounded-lg border bg-[var(--color-surface)] px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all',
                            selectedTeamId
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'
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
                        onToggle={(name) => setSelectedUserNames((prev) => {
                            const next = new Set(prev)
                            next.has(name) ? next.delete(name) : next.add(name)
                            return next
                        })}
                        placeholder={t('common.allUsers', 'Todos os usuários')}
                    />
                )}

                {/* Pillar multi-select */}
                {pillars.length > 0 && (
                    <MultiSelectDropdown
                        options={pillars.map((p) => ({ value: p.id, label: p.name, color: p.color }))}
                        selected={selectedPillarIds}
                        onToggle={(id) => setSelectedPillarIds((prev) => {
                            const next = new Set(prev)
                            next.has(id) ? next.delete(id) : next.add(id)
                            return next
                        })}
                        placeholder={t('krTracking.allPillars')}
                    />
                )}
            </div>

            {filteredPlans.length > 0 ? (
                <div className={cn('grid gap-2.5', expandedIds.size > 0 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
                    {filteredPlans.map((p) => {
                        const deadlineStatus = p.due_date ? getDeadlineAlert(p.due_date, false, 'pt').status : null
                        const borderColor = deadlineStatus === 'overdue'
                            ? 'border-l-red-500'
                            : deadlineStatus === 'urgent'
                                ? 'border-l-orange-500'
                                : deadlineStatus === 'warning'
                                    ? 'border-l-yellow-400'
                                    : p.due_date
                                        ? 'border-l-green-500'
                                        : 'border-l-[var(--color-border)]'
                        const ownerColor = p.owner_name ? (ownerColorMap.get(p.owner_name) ?? 'bg-gray-500') : null

                        const isExpanded = expandedIds.has(p.id)
                        const tasks = tasksByPlanId[p.id] || []
                        const doneTasks = tasks.filter(t => t.is_done).length

                        return (
                            <div
                                key={p.id}
                                className={cn(
                                    'group rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] border-l-4 overflow-hidden',
                                    borderColor
                                )}
                            >
                                {/* Card header - clickable to expand */}
                                <button
                                    type="button"
                                    onClick={() => tasks.length > 0 && toggleExpanded(p.id)}
                                    className={cn('w-full text-left px-4 pt-3.5 pb-3 space-y-2', tasks.length > 0 && 'hover:bg-[var(--color-surface-hover)] transition-colors')}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
                                                {p.title}
                                            </h3>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <select
                                                    value={p.status}
                                                    onChange={(e) => updatePlanStatus(p.id, e.target.value as ActionPlanStatus)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={cn(
                                                        'text-xs font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] appearance-none',
                                                        STATUS_CONFIG[p.status].className
                                                    )}
                                                >
                                                    {(Object.keys(STATUS_CONFIG) as ActionPlanStatus[]).map(s => (
                                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                                {tasks.length > 0 && (
                                                    <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                                                        {doneTasks}/{tasks.length} tarefas
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                                onClick={(e) => { e.stopPropagation(); openEditor(p) }}
                                                title={t('actionPlan.edit')}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            {tasks.length > 0 && (
                                                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform text-[var(--color-text-muted)]', isExpanded && 'rotate-180')} />
                                            )}
                                        </div>
                                    </div>

                                    {/* KR reference */}
                                    {p.key_result && (
                                        <p className="text-xs text-[var(--color-text-muted)] truncate flex items-center gap-1.5">
                                            <Badge variant="outline" size="sm" className="font-mono shrink-0">{p.key_result.code}</Badge>
                                            <span className="truncate">{p.key_result.title}</span>
                                        </p>
                                    )}

                                    {/* Owner chip + deadline */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {ownerColor && p.owner_name && (
                                            <span className={`inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full text-white text-xs font-medium shrink-0 ${ownerColor}`}>
                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold">
                                                    {getInitials(p.owner_name)}
                                                </span>
                                                {p.owner_name}
                                            </span>
                                        )}
                                        {p.due_date ? (
                                            <DeadlineBadge dueDate={p.due_date} size="sm" />
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]/50">
                                                <Calendar className="w-3 h-3" />
                                                {t('actionPlan.filters.noDueDate')}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {/* Progress bar */}
                                {tasks.length > 0 && (
                                    <div className="px-4 pb-3 flex items-center gap-2.5">
                                        <div className="flex-1 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full transition-all duration-500', doneTasks === tasks.length ? 'bg-green-500' : doneTasks > 0 ? 'bg-blue-500' : 'bg-[var(--color-border)]')}
                                                style={{ width: `${Math.round((doneTasks / tasks.length) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-[var(--color-text-muted)] shrink-0 tabular-nums">
                                            {Math.round((doneTasks / tasks.length) * 100)}%
                                        </span>
                                    </div>
                                )}

                                {/* Expanded content: observations + tasks */}
                                {isExpanded && (
                                    <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 space-y-2">
                                        {/* Observations & tracking method */}
                                        {(p.observations || p.tracking_method || (p.tracking_links && p.tracking_links.length > 0)) && (
                                            <div className="space-y-1.5 pb-1">
                                                {p.observations && (
                                                    <div className="flex gap-2 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)]/60 rounded-lg px-3 py-2">
                                                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--color-text-muted)]" />
                                                        <p className="leading-relaxed">{p.observations}</p>
                                                    </div>
                                                )}
                                                {(p.tracking_method || (p.tracking_links && p.tracking_links.length > 0)) && (
                                                    <div className="flex gap-2 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)]/60 rounded-lg px-3 py-2">
                                                        <BarChart2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--color-text-muted)]" />
                                                        <div className="flex-1 space-y-2">
                                                            {p.tracking_method && (
                                                                <p className="leading-relaxed">{p.tracking_method}</p>
                                                            )}
                                                            {p.tracking_links && p.tracking_links.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {p.tracking_links.map((link, i) => (
                                                                        <a
                                                                            key={i}
                                                                            href={link.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
                                                                        >
                                                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                                                            {link.label || link.url}
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Tasks */}
                                        {tasks.map((task, index) => (
                                            <div
                                                key={task.id}
                                                className={cn(
                                                    'flex items-center gap-2.5 py-1.5 group/task',
                                                    index < tasks.length - 1 && 'border-b border-[var(--color-border-subtle)]'
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    className="shrink-0 transition-colors"
                                                    onClick={() => toggleTaskDone(p.id, task.id, !task.is_done)}
                                                >
                                                    {task.is_done
                                                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                        : <Clock className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" />
                                                    }
                                                </button>
                                                <span className={cn(
                                                    'text-sm flex-1 leading-snug min-w-0',
                                                    task.is_done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'
                                                )}>
                                                    {task.title}
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {task.due_date && (
                                                        <span className="flex items-center gap-0.5 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatShortDate(task.due_date)}
                                                        </span>
                                                    )}
                                                    {task.owner_name && (
                                                        <span className="flex items-center gap-0.5 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] border border-[var(--color-border)] px-1.5 py-0.5 rounded max-w-[110px]">
                                                            <User className="w-3 h-3 shrink-0" />
                                                            <span className="truncate">{task.owner_name}</span>
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="p-1 rounded text-transparent group-hover/task:text-[var(--color-text-muted)] hover:!text-[var(--color-danger)] transition-colors"
                                                        onClick={() => deleteTask(p.id, task.id)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {tasks.length === 0 && (
                                            <p className="text-xs text-[var(--color-text-muted)] py-1">{t('actionPlan.noTasks')}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <Card variant="elevated">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                            <ListTodo className="w-8 h-8 text-[var(--color-text-muted)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            {t('actionPlan.empty')}
                        </h3>
                        <p className="text-[var(--color-text-muted)] text-center max-w-md">
                            {t('actions.noActionsDesc')}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Edit modal */}
            <Dialog.Root
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open)
                    if (!open) setEditingPlan(null)
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <div>
                                <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)]">
                                    {t('actionPlan.editTitle')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {editingPlan?.key_result ? `${editingPlan.key_result.code} - ${editingPlan.key_result.title}` : ''}
                                </Dialog.Description>
                            </div>
                            <Dialog.Close asChild>
                                <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </Dialog.Close>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <Input
                                label={`${t('actionPlan.fields.title')} *`}
                                value={editFormData.title}
                                onChange={(e) => setEditFormData(p => ({ ...p, title: e.target.value }))}
                                placeholder={t('actionPlan.fields.titlePlaceholder')}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label={t('actionPlan.fields.owner')}
                                    value={editFormData.owner_name}
                                    onChange={(e) => setEditFormData(p => ({ ...p, owner_name: e.target.value }))}
                                    placeholder={t('actionPlan.fields.ownerSelectPlaceholder')}
                                />
                                <Input
                                    type="date"
                                    label={t('actionPlan.fields.dueDate')}
                                    value={editFormData.due_date}
                                    onChange={(e) => setEditFormData(p => ({ ...p, due_date: e.target.value }))}
                                    icon={<Calendar className="w-4 h-4" />}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('actionPlan.fields.trackingMethod')}
                                </label>
                                <textarea
                                    value={editFormData.tracking_method}
                                    onChange={(e) => setEditFormData(p => ({ ...p, tracking_method: e.target.value }))}
                                    placeholder={t('actionPlan.fields.trackingMethodPlaceholder')}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('actionPlan.fields.observations')}
                                </label>
                                <textarea
                                    value={editFormData.observations}
                                    onChange={(e) => setEditFormData(p => ({ ...p, observations: e.target.value }))}
                                    placeholder={t('actionPlan.fields.observationsPlaceholder')}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                />
                            </div>

                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                            <Button variant="ghost" onClick={() => setModalOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button variant="primary" onClick={savePlan} disabled={!editFormData.title.trim()} loading={saving}>
                                {saving ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    )
}

