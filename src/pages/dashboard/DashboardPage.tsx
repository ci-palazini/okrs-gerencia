import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Gauge, Info, RefreshCw, ShieldAlert, UserX } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { DeadlineBadgeMinimal } from '../../components/okr/DeadlineBadge'
import { useCascadeOKRData } from '../../hooks/useCascadeOKRData'
import { useDeadlineAlerts } from '../../hooks/useDeadlineAlerts'
import { supabase } from '../../lib/supabase'
import type { ConfidenceLevel } from '../../types'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

interface ActionPlanSummaryRow {
    id: string
    key_result_id: string
    owner_name: string | null
    due_date: string | null
}

interface ActionPlanTaskRow {
    id: string
    action_plan_id: string
    is_done: boolean
}

interface DashboardKR {
    id: string
    code: string
    title: string
    ownerName: string | null
    dueDate: string | null
    progress: number | null
    confidence: ConfidenceLevel
    objectiveCode: string
    pillarId: string | null
    pillarName: string
    isCritical: boolean
}

interface PillarHealthRow {
    id: string
    name: string
    color: string
    krCount: number
    onTrack: number
    atRisk: number
    offTrack: number
    notSet: number
    avgProgress: number | null
    criticalCount: number
}

interface AssigneeExecutionRow {
    ownerName: string
    plans: number
    overduePlans: number
    tasksOpen: number
    tasksDone: number
    criticalLinked: number
    completionRate: number | null
}

function isCriticalConfidence(confidence: ConfidenceLevel): boolean {
    return confidence === 'at_risk' || confidence === 'off_track'
}

function getConfidenceScore(confidence: ConfidenceLevel): number | null {
    if (confidence === 'on_track') return 100
    if (confidence === 'at_risk') return 55
    if (confidence === 'off_track') return 20
    return null
}

function getConfidencePriority(confidence: ConfidenceLevel): number {
    if (confidence === 'off_track') return 0
    if (confidence === 'at_risk') return 1
    return 2
}

function getConfidenceVariant(confidence: ConfidenceLevel): BadgeVariant {
    if (confidence === 'on_track') return 'success'
    if (confidence === 'at_risk') return 'warning'
    if (confidence === 'off_track') return 'danger'
    return 'outline'
}

function normalizeOwner(ownerName: string | null, fallback: string): string {
    const trimmed = ownerName?.trim() || ''
    return trimmed || fallback
}

export function DashboardPage() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()

    const {
        year,
        loading,
        selectedUnit,
        selectedUnitData,
        objectives,
        keyResults,
        getVisiblePillars,
        loadData,
    } = useCascadeOKRData()

    const [refreshing, setRefreshing] = useState(false)
    const [plansLoading, setPlansLoading] = useState(false)
    const [actionPlans, setActionPlans] = useState<ActionPlanSummaryRow[]>([])
    const [tasksByPlanId, setTasksByPlanId] = useState<Record<string, ActionPlanTaskRow[]>>({})

    const currentPath = `${location.pathname}${location.search}${location.hash}`
    const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
    const visiblePillars = useMemo(() => getVisiblePillars(), [getVisiblePillars])

    const loadExecutionData = useCallback(async () => {
        if (keyResults.length === 0) {
            setActionPlans([])
            setTasksByPlanId({})
            return
        }

        setPlansLoading(true)

        try {
            const krIds = keyResults.map((kr) => kr.id)

            const { data: plansData, error: plansError } = await supabase
                .from('action_plans')
                .select('id, key_result_id, owner_name, due_date')
                .in('key_result_id', krIds)

            if (plansError) throw plansError

            const typedPlans = (plansData || []) as ActionPlanSummaryRow[]
            setActionPlans(typedPlans)

            if (typedPlans.length === 0) {
                setTasksByPlanId({})
                return
            }

            const planIds = typedPlans.map((plan) => plan.id)
            const { data: tasksData, error: tasksError } = await supabase
                .from('action_plan_tasks')
                .select('id, action_plan_id, is_done')
                .in('action_plan_id', planIds)

            if (tasksError) throw tasksError

            const groupedTasks: Record<string, ActionPlanTaskRow[]> = {}
            typedPlans.forEach((plan) => {
                groupedTasks[plan.id] = []
            })

            for (const task of (tasksData || []) as ActionPlanTaskRow[]) {
                if (!groupedTasks[task.action_plan_id]) {
                    groupedTasks[task.action_plan_id] = []
                }
                groupedTasks[task.action_plan_id].push(task)
            }

            setTasksByPlanId(groupedTasks)
        } catch (error) {
            console.error('Error loading dashboard execution data:', error)
            setActionPlans([])
            setTasksByPlanId({})
        } finally {
            setPlansLoading(false)
        }
    }, [keyResults])

    useEffect(() => {
        void loadExecutionData()
    }, [loadExecutionData])

    const handleRefresh = useCallback(async () => {
        setRefreshing(true)
        try {
            await loadData()
        } finally {
            setRefreshing(false)
        }
    }, [loadData])

    const objectiveById = useMemo(() => {
        return new Map(objectives.map((objective) => [objective.id, objective]))
    }, [objectives])

    const pillarById = useMemo(() => {
        return new Map(visiblePillars.map((pillar) => [pillar.id, pillar]))
    }, [visiblePillars])

    const dashboardKRs = useMemo<DashboardKR[]>(() => {
        return keyResults.map((kr) => {
            const objective = objectiveById.get(kr.objective_id)
            const pillar = objective ? pillarById.get(objective.pillar_id) : null

            return {
                id: kr.id,
                code: kr.code,
                title: kr.title,
                ownerName: kr.owner_name,
                dueDate: kr.due_date,
                progress: kr.progress,
                confidence: kr.confidence,
                objectiveCode: objective?.code || '-',
                pillarId: pillar?.id || null,
                pillarName: pillar?.name || t('dashboard.unknownPillar'),
                isCritical: isCriticalConfidence(kr.confidence),
            }
        })
    }, [keyResults, objectiveById, pillarById, t])

    const deadlineLocale = i18n.language === 'es' ? 'es' : 'pt'
    const { overdueAlerts, urgentAlerts, counts: deadlineCounts } = useDeadlineAlerts(
        objectives,
        keyResults,
        {
            includeCompleted: false,
            locale: deadlineLocale,
            sortBy: 'daysRemaining',
        }
    )

    const topOverdueAlerts = useMemo(() => overdueAlerts.slice(0, 5), [overdueAlerts])
    const topUrgentAlerts = useMemo(() => urgentAlerts.slice(0, 5), [urgentAlerts])

    const confidenceSummary = useMemo(() => {
        return dashboardKRs.reduce((acc, kr) => {
            if (kr.confidence === 'on_track') acc.onTrack += 1
            else if (kr.confidence === 'at_risk') acc.atRisk += 1
            else if (kr.confidence === 'off_track') acc.offTrack += 1
            else acc.notSet += 1
            return acc
        }, {
            onTrack: 0,
            atRisk: 0,
            offTrack: 0,
            notSet: 0,
        })
    }, [dashboardKRs])

    const confidenceAverage = useMemo(() => {
        const scored = dashboardKRs
            .map((kr) => getConfidenceScore(kr.confidence))
            .filter((score): score is number => score !== null)

        if (scored.length === 0) return 0
        return Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
    }, [dashboardKRs])

    const unassignedKRs = useMemo(() => {
        return dashboardKRs.filter((kr) => !kr.ownerName || kr.ownerName.trim().length === 0).length
    }, [dashboardKRs])

    const overduePlanIds = useMemo(() => {
        const overdue = new Set<string>()

        actionPlans.forEach((plan) => {
            if (!plan.due_date) return

            const dueDate = plan.due_date.slice(0, 10)
            if (dueDate >= todayIso) return

            const tasks = tasksByPlanId[plan.id] || []
            const hasPendingTasks = tasks.length === 0 || tasks.some((task) => !task.is_done)
            if (hasPendingTasks) {
                overdue.add(plan.id)
            }
        })

        return overdue
    }, [actionPlans, tasksByPlanId, todayIso])

    const pillarHealth = useMemo<PillarHealthRow[]>(() => {
        const grouped = new Map<string, PillarHealthRow & { progressTotal: number; progressCount: number }>()

        visiblePillars.forEach((pillar) => {
            grouped.set(pillar.id, {
                id: pillar.id,
                name: pillar.name,
                color: pillar.color,
                krCount: 0,
                onTrack: 0,
                atRisk: 0,
                offTrack: 0,
                notSet: 0,
                avgProgress: null,
                criticalCount: 0,
                progressTotal: 0,
                progressCount: 0,
            })
        })

        dashboardKRs.forEach((kr) => {
            if (!kr.pillarId) return
            const entry = grouped.get(kr.pillarId)
            if (!entry) return

            entry.krCount += 1

            if (kr.progress !== null) {
                entry.progressTotal += kr.progress
                entry.progressCount += 1
            }

            if (kr.confidence === 'on_track') entry.onTrack += 1
            else if (kr.confidence === 'at_risk') entry.atRisk += 1
            else if (kr.confidence === 'off_track') entry.offTrack += 1
            else entry.notSet += 1
        })

        return Array.from(grouped.values())
            .map((entry) => ({
                id: entry.id,
                name: entry.name,
                color: entry.color,
                krCount: entry.krCount,
                onTrack: entry.onTrack,
                atRisk: entry.atRisk,
                offTrack: entry.offTrack,
                notSet: entry.notSet,
                avgProgress: entry.progressCount > 0
                    ? Math.round(entry.progressTotal / entry.progressCount)
                    : null,
                criticalCount: entry.atRisk + entry.offTrack,
            }))
            .sort((a, b) => (
                b.criticalCount - a.criticalCount
                || b.krCount - a.krCount
                || a.name.localeCompare(b.name, 'pt-BR')
            ))
    }, [dashboardKRs, visiblePillars])

    const topCriticalKRs = useMemo(() => {
        return dashboardKRs
            .filter((kr) => kr.isCritical)
            .sort((a, b) => {
                const rankDiff = getConfidencePriority(a.confidence) - getConfidencePriority(b.confidence)
                if (rankDiff !== 0) return rankDiff

                const progressA = a.progress === null ? 101 : a.progress
                const progressB = b.progress === null ? 101 : b.progress
                if (progressA !== progressB) return progressA - progressB

                return a.code.localeCompare(b.code, 'pt-BR')
            })
            .slice(0, 8)
    }, [dashboardKRs])

    const krById = useMemo(() => {
        return new Map(dashboardKRs.map((kr) => [kr.id, kr]))
    }, [dashboardKRs])

    const assigneeExecution = useMemo<AssigneeExecutionRow[]>(() => {
        const fallbackOwner = t('common.unassigned')
        const grouped = new Map<string, {
            ownerName: string
            plans: number
            overduePlans: number
            tasksOpen: number
            tasksDone: number
            criticalKrIds: Set<string>
        }>()

        actionPlans.forEach((plan) => {
            const ownerName = normalizeOwner(plan.owner_name, fallbackOwner)

            if (!grouped.has(ownerName)) {
                grouped.set(ownerName, {
                    ownerName,
                    plans: 0,
                    overduePlans: 0,
                    tasksOpen: 0,
                    tasksDone: 0,
                    criticalKrIds: new Set<string>(),
                })
            }

            const entry = grouped.get(ownerName)
            if (!entry) return

            entry.plans += 1
            if (overduePlanIds.has(plan.id)) {
                entry.overduePlans += 1
            }

            const tasks = tasksByPlanId[plan.id] || []
            const doneTasks = tasks.filter((task) => task.is_done).length
            const openTasks = Math.max(0, tasks.length - doneTasks)

            entry.tasksDone += doneTasks
            entry.tasksOpen += openTasks

            const linkedKr = krById.get(plan.key_result_id)
            if (linkedKr?.isCritical) {
                entry.criticalKrIds.add(linkedKr.id)
            }
        })

        return Array.from(grouped.values())
            .map((entry) => {
                const totalTasks = entry.tasksDone + entry.tasksOpen
                return {
                    ownerName: entry.ownerName,
                    plans: entry.plans,
                    overduePlans: entry.overduePlans,
                    tasksOpen: entry.tasksOpen,
                    tasksDone: entry.tasksDone,
                    criticalLinked: entry.criticalKrIds.size,
                    completionRate: totalTasks > 0
                        ? Math.round((entry.tasksDone / totalTasks) * 100)
                        : null,
                }
            })
            .sort((a, b) => (
                b.overduePlans - a.overduePlans
                || b.tasksOpen - a.tasksOpen
                || b.plans - a.plans
                || a.ownerName.localeCompare(b.ownerName, 'pt-BR')
            ))
    }, [actionPlans, krById, overduePlanIds, t, tasksByPlanId])

    const totalKRs = dashboardKRs.length
    const criticalKRs = confidenceSummary.atRisk + confidenceSummary.offTrack
    const unassignedRate = totalKRs > 0 ? Math.round((unassignedKRs / totalKRs) * 100) : 0
    const isLoading = loading || plansLoading || refreshing

    const confidenceRows: Array<{ key: string; label: string; count: number; variant: BadgeVariant }> = [
        {
            key: 'on_track',
            label: t('dashboard.confidence.onTrack'),
            count: confidenceSummary.onTrack,
            variant: 'success',
        },
        {
            key: 'at_risk',
            label: t('dashboard.confidence.atRisk'),
            count: confidenceSummary.atRisk,
            variant: 'warning',
        },
        {
            key: 'off_track',
            label: t('dashboard.confidence.offTrack'),
            count: confidenceSummary.offTrack,
            variant: 'danger',
        },
        {
            key: 'not_set',
            label: t('dashboard.confidence.notSet'),
            count: confidenceSummary.notSet,
            variant: 'outline',
        },
    ]

    const confidenceLabel = (confidence: ConfidenceLevel) => {
        if (confidence === 'on_track') return t('dashboard.confidence.onTrack')
        if (confidence === 'at_risk') return t('dashboard.confidence.atRisk')
        if (confidence === 'off_track') return t('dashboard.confidence.offTrack')
        return t('dashboard.confidence.notSet')
    }

    function openKRFocus(kr: DashboardKR) {
        if (!kr.pillarId) return
        navigate(`/okrs/pillar/${kr.pillarId}/kr/${kr.id}`, {
            state: { backTo: currentPath },
        })
    }

    function openDeadlineAlert(alert: (typeof topOverdueAlerts)[number]) {
        if (alert.type === 'objective') {
            const objective = objectiveById.get(alert.id)
            const pillarId = objective?.pillar_id || alert.relatedId
            if (!pillarId) return
            navigate(`/okrs/pillar/${pillarId}`, {
                state: { backTo: currentPath },
            })
            return
        }

        const kr = krById.get(alert.id)
        if (!kr?.pillarId) return
        navigate(`/okrs/pillar/${kr.pillarId}/kr/${alert.id}`, {
            state: { backTo: currentPath },
        })
    }

    if (!selectedUnit) {
        return (
            <Card variant="elevated">
                <CardContent className="py-10 text-center">
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {t('dashboard.title')}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                        {t('dashboard.selectCompany')}
                    </p>
                </CardContent>
            </Card>
        )
    }

    if (isLoading && totalKRs === 0) {
        return (
            <div className="flex items-center justify-center min-h-[380px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('dashboard.loadingData')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card variant="elevated" className="p-0 overflow-hidden">
                <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
                                {t('dashboard.title')}
                            </h1>
                            <p className="text-[var(--color-text-secondary)] mt-1.5">
                                {t('dashboard.executiveOverview', {
                                    unit: selectedUnitData?.name || t('okr.local'),
                                    year,
                                })}
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => void handleRefresh()}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            {t('dashboard.refresh')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card variant="elevated" className="p-0">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] inline-flex items-center justify-center">
                            <Gauge className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.kpis.confidenceAverage')}</p>
                                <span
                                    className="text-[var(--color-text-muted)]"
                                    title={t('dashboard.kpis.confidenceAverageTip')}
                                    aria-label={t('dashboard.kpis.confidenceAverageTip')}
                                >
                                    <Info className="w-3.5 h-3.5" />
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{confidenceAverage}%</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.kpis.confidenceAverageHint')}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated" className="p-0">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[var(--color-warning-muted)] text-[var(--color-warning)] inline-flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.kpis.criticalKRs')}</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{criticalKRs}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.kpis.criticalKRsHint')}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated" className="p-0">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[var(--color-danger-muted)] text-[var(--color-danger)] inline-flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.kpis.overduePlans')}</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{overduePlanIds.size}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.kpis.overduePlansHint')}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated" className="p-0">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] inline-flex items-center justify-center">
                            <UserX className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.kpis.unassignedKRs')}</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                                {unassignedKRs} <span className="text-base text-[var(--color-text-muted)]">({unassignedRate}%)</span>
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.kpis.unassignedKRsHint')}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card variant="elevated">
                    <CardHeader>
                        <CardTitle className="inline-flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />
                            {t('deadline.overdueItemsTitle')}
                        </CardTitle>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {t('deadline.overdueItemsDescription', { count: deadlineCounts.overdue })}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {topOverdueAlerts.length > 0 ? (
                            topOverdueAlerts.map((alert) => {
                                const objective = alert.type === 'objective'
                                    ? objectiveById.get(alert.id)
                                    : objectiveById.get(alert.relatedId || '')
                                const canOpen = alert.type === 'objective'
                                    ? Boolean(objective?.pillar_id || alert.relatedId)
                                    : Boolean(krById.get(alert.id)?.pillarId)

                                return (
                                    <div
                                        key={alert.id}
                                        className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface)]/50 space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" size="sm" className="font-mono">{alert.code}</Badge>
                                                    <DeadlineBadgeMinimal dueDate={alert.dueDate} />
                                                </div>
                                                <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1 truncate">
                                                    {alert.title}
                                                </p>
                                                {objective && (
                                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                                        {objective.code}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openDeadlineAlert(alert)}
                                                disabled={!canOpen}
                                            >
                                                {t('deadline.openItem')}
                                                <ArrowRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
                                {t('deadline.noneOverdue')}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card variant="elevated">
                    <CardHeader>
                        <CardTitle className="inline-flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-[var(--color-warning)]" />
                            {t('deadline.urgentItemsTitle')}
                        </CardTitle>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {t('deadline.urgentItemsDescription', { count: deadlineCounts.urgent })}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {topUrgentAlerts.length > 0 ? (
                            topUrgentAlerts.map((alert) => {
                                const objective = alert.type === 'objective'
                                    ? objectiveById.get(alert.id)
                                    : objectiveById.get(alert.relatedId || '')
                                const canOpen = alert.type === 'objective'
                                    ? Boolean(objective?.pillar_id || alert.relatedId)
                                    : Boolean(krById.get(alert.id)?.pillarId)

                                return (
                                    <div
                                        key={alert.id}
                                        className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface)]/50 space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" size="sm" className="font-mono">{alert.code}</Badge>
                                                    <DeadlineBadgeMinimal dueDate={alert.dueDate} />
                                                </div>
                                                <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1 truncate">
                                                    {alert.title}
                                                </p>
                                                {objective && (
                                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                                        {objective.code}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openDeadlineAlert(alert)}
                                                disabled={!canOpen}
                                            >
                                                {t('deadline.openItem')}
                                                <ArrowRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
                                {t('deadline.noneUrgent')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card variant="elevated" className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle>{t('dashboard.pillarHealthTitle')}</CardTitle>
                        <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.pillarHealthSubtitle')}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {pillarHealth.length > 0 ? (
                            pillarHealth.map((pillar) => (
                                <div
                                    key={pillar.id}
                                    className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface)]/50 space-y-2"
                                >
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: pillar.color }}
                                            />
                                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{pillar.name}</p>
                                            <Badge variant="outline" size="sm">{pillar.krCount} {t('dashboard.krs')}</Badge>
                                        </div>
                                        <Badge variant={pillar.criticalCount > 0 ? 'warning' : 'success'} size="sm">
                                            {t('dashboard.criticalCount', { count: pillar.criticalCount })}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="success" size="sm">{t('dashboard.confidence.onTrack')}: {pillar.onTrack}</Badge>
                                        <Badge variant="warning" size="sm">{t('dashboard.confidence.atRisk')}: {pillar.atRisk}</Badge>
                                        <Badge variant="danger" size="sm">{t('dashboard.confidence.offTrack')}: {pillar.offTrack}</Badge>
                                        <Badge variant="outline" size="sm">{t('dashboard.confidence.notSet')}: {pillar.notSet}</Badge>
                                    </div>

                                    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                        <div>
                                            <p className="text-xs text-[var(--color-text-muted)] mb-1">{t('dashboard.avgProgress')}</p>
                                            <ProgressBar value={pillar.avgProgress || 0} size="sm" variant="gradient" />
                                        </div>
                                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                            {pillar.avgProgress !== null ? `${pillar.avgProgress}%` : '-'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">{t('dashboard.noData')}</p>
                        )}
                    </CardContent>
                </Card>

                <Card variant="elevated">
                    <CardHeader>
                        <CardTitle>{t('quarterlyCard.confidence')}</CardTitle>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {totalKRs} {t('dashboard.krs')}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {confidenceRows.map((row) => {
                            const share = totalKRs > 0 ? Math.round((row.count / totalKRs) * 100) : 0
                            return (
                                <div key={row.key} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Badge variant={row.variant} size="sm">{row.label}</Badge>
                                        <span className="text-xs text-[var(--color-text-muted)]">{row.count} ({share}%)</span>
                                    </div>
                                    <ProgressBar value={share} size="sm" />
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <Card variant="elevated" className="xl:col-span-3">
                    <CardHeader>
                        <CardTitle>{t('dashboard.prioritiesTitle')}</CardTitle>
                        <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.prioritiesSubtitle')}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {topCriticalKRs.length > 0 ? (
                            topCriticalKRs.map((kr) => (
                                <div
                                    key={kr.id}
                                    className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface)]/50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" size="sm" className="font-mono">{kr.code}</Badge>
                                                <Badge variant={getConfidenceVariant(kr.confidence)} size="sm">
                                                    {confidenceLabel(kr.confidence)}
                                                </Badge>
                                                {kr.dueDate && (
                                                    <DeadlineBadgeMinimal
                                                        dueDate={kr.dueDate}
                                                        isCompleted={(kr.progress ?? 0) >= 100}
                                                    />
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1.5 truncate">
                                                {kr.title}
                                            </p>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                                {kr.pillarName} • {kr.objectiveCode} • {t('quarterlyCard.owner')}: {normalizeOwner(kr.ownerName, t('common.unassigned'))}
                                            </p>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openKRFocus(kr)}
                                        >
                                            {t('dashboard.openFocus')}
                                            <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-[1fr_auto] gap-3 items-center mt-3">
                                        <ProgressBar value={kr.progress || 0} size="sm" variant="gradient" />
                                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                            {kr.progress !== null ? `${Math.round(kr.progress)}%` : '-'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
                                {t('dashboard.noCriticalKRs')}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card variant="elevated" className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle>{t('dashboard.executionTitle')}</CardTitle>
                        <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.executionSubtitle')}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {assigneeExecution.length > 0 ? (
                            assigneeExecution.map((entry) => (
                                <div
                                    key={entry.ownerName}
                                    className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface)]/50 space-y-2"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{entry.ownerName}</p>
                                        <Badge variant="outline" size="sm">{t('dashboard.plans')}: {entry.plans}</Badge>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant={entry.overduePlans > 0 ? 'danger' : 'outline'} size="sm">
                                            {t('dashboard.overdueActions')}: {entry.overduePlans}
                                        </Badge>
                                        <Badge variant="default" size="sm">
                                            {t('dashboard.tasksOpen')}: {entry.tasksOpen}
                                        </Badge>
                                        <Badge variant="success" size="sm">
                                            {t('dashboard.tasksDone')}: {entry.tasksDone}
                                        </Badge>
                                        <Badge variant={entry.criticalLinked > 0 ? 'warning' : 'outline'} size="sm">
                                            {t('dashboard.criticalLinked')}: {entry.criticalLinked}
                                        </Badge>
                                    </div>

                                    {entry.completionRate !== null && (
                                        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                            <div>
                                                <p className="text-xs text-[var(--color-text-muted)] mb-1">{t('dashboard.completionRate')}</p>
                                                <ProgressBar value={entry.completionRate} size="sm" />
                                            </div>
                                            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                                                {entry.completionRate}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
                                {t('dashboard.noExecutionData')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
