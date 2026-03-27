import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronDown, Clock, ListTodo, Calendar, Plus, Trash2, Pencil, ClipboardList, User, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { supabase } from '../../lib/supabase'
import { listAssigneesForBusinessUnit, type AssigneeOption } from '../../lib/assignees'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { Input } from '../ui/Input'

type ActionPlanStatus = 'not_started' | 'in_progress' | 'completed'

const STATUS_CONFIG: Record<ActionPlanStatus, { label: string; className: string }> = {
    not_started: { label: 'Não iniciado',  className: 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]' },
    in_progress:  { label: 'Em andamento', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800/50' },
    completed:    { label: 'Concluído',    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-800/50' },
}

interface ActionPlan {
    id: string
    owner_name: string | null
    due_date: string | null
    title: string
    essential_tasks: string | null
    tracking_method: string | null
    observations: string | null
    effectiveness: string | null
    status: ActionPlanStatus
}

interface ActionPlanTask {
    id: string
    title: string
    is_done: boolean
    order_index: number
}

interface ActionPlanTaskRow extends ActionPlanTask {
    action_plan_id: string
}

interface ObjectiveBusinessUnitRow {
    business_unit_id: string | null
}

interface KeyResultBusinessUnitRow {
    objective: ObjectiveBusinessUnitRow | ObjectiveBusinessUnitRow[] | null
}

function getBusinessUnitIdFromKeyResult(row: KeyResultBusinessUnitRow | null): string | null {
    const objectiveRelation = row?.objective
    if (!objectiveRelation) return null
    if (Array.isArray(objectiveRelation)) return objectiveRelation[0]?.business_unit_id || null
    return objectiveRelation.business_unit_id || null
}

interface ActionPlanListProps {
    krId: string
}

function isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('code' in error)) return false
    return (error as { code?: string }).code === '23505'
}

export function ActionPlanList({ krId }: ActionPlanListProps) {
    const { t } = useTranslation()
    const { user } = useAuth()

    const [loading, setLoading] = useState(true)
    const [plans, setPlans] = useState<ActionPlan[]>([])
    const [tasksByPlanId, setTasksByPlanId] = useState<Record<string, ActionPlanTask[]>>({})
    const [expandedPlanIds, setExpandedPlanIds] = useState<string[]>([])
    const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null)
    const [draftTasks, setDraftTasks] = useState<ActionPlanTask[]>([])
    const [newTaskByPlanId, setNewTaskByPlanId] = useState<Record<string, string>>({})
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [assigneesLoading, setAssigneesLoading] = useState(true)
    const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([])
    const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Form state
    const [title, setTitle] = useState('')
    const [ownerName, setOwnerName] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [trackingMethod, setTrackingMethod] = useState('')
    const [observations, setObservations] = useState('')
    const [effectiveness, setEffectiveness] = useState('')
    const [formStatus, setFormStatus] = useState<ActionPlanStatus>('not_started')
    const [newDraftTaskTitle, setNewDraftTaskTitle] = useState('')

    const loadPlans = useCallback(async () => {
        setLoading(true)
        setAssigneesLoading(true)
        try {
            const [keyResultResponse, plansResponse] = await Promise.all([
                supabase
                    .from('key_results')
                    .select('objective:objectives ( business_unit_id )')
                    .eq('id', krId)
                    .single(),
                supabase
                    .from('action_plans')
                    .select('*')
                    .eq('key_result_id', krId)
                    .order('due_date', { ascending: true, nullsFirst: false }),
            ])

            const { data: keyResultData, error: keyResultError } = keyResultResponse
            if (keyResultError) {
                console.error('Error loading assignee scope for action plans:', keyResultError)
                setAssigneeOptions([])
            } else {
                const businessUnitId = getBusinessUnitIdFromKeyResult(keyResultData as KeyResultBusinessUnitRow | null)
                if (businessUnitId) {
                    const options = await listAssigneesForBusinessUnit(businessUnitId)
                    setAssigneeOptions(options)
                } else {
                    setAssigneeOptions([])
                }
            }

            const { data: plansData, error: plansError } = plansResponse
            if (plansError) throw plansError

            const normalizedPlans = (plansData as ActionPlan[]) || []
            setPlans(normalizedPlans)

            if (normalizedPlans.length === 0) {
                setTasksByPlanId({})
                setExpandedPlanIds([])
                return
            }

            const planIds = normalizedPlans.map(plan => plan.id)
            const { data: tasksData, error: tasksError } = await supabase
                .from('action_plan_tasks')
                .select('id, action_plan_id, title, is_done, order_index')
                .in('action_plan_id', planIds)
                .order('order_index', { ascending: true })

            if (tasksError) throw tasksError

            const groupedTasks: Record<string, ActionPlanTask[]> = {}
            for (const planItem of normalizedPlans) {
                groupedTasks[planItem.id] = []
            }

            for (const task of (tasksData as ActionPlanTaskRow[] | null) || []) {
                if (!groupedTasks[task.action_plan_id]) {
                    groupedTasks[task.action_plan_id] = []
                }
                groupedTasks[task.action_plan_id].push({
                    id: task.id,
                    title: task.title,
                    is_done: task.is_done,
                    order_index: task.order_index,
                })
            }

            setTasksByPlanId(groupedTasks)
            setExpandedPlanIds((prev) => {
                const validExpandedIds = prev.filter(id => planIds.includes(id))
                if (validExpandedIds.length > 0) return validExpandedIds
                return planIds.length > 0 ? [planIds[0]] : []
            })
        } catch (loadError) {
            console.error('Error loading action plans:', loadError)
            setAssigneeOptions([])
        } finally {
            setAssigneesLoading(false)
            setLoading(false)
        }
    }, [krId])

    useEffect(() => {
        if (krId) loadPlans()
    }, [krId, loadPlans])

    const taskCountsByPlanId = useMemo(() => {
        const counts: Record<string, { total: number; done: number }> = {}
        for (const planItem of plans) {
            const planTasks = tasksByPlanId[planItem.id] || []
            counts[planItem.id] = {
                total: planTasks.length,
                done: planTasks.filter(task => task.is_done).length,
            }
        }
        return counts
    }, [plans, tasksByPlanId])

    function togglePlanExpanded(planId: string) {
        setExpandedPlanIds(prev => (
            prev.includes(planId)
                ? prev.filter(id => id !== planId)
                : [...prev, planId]
        ))
    }

    async function updatePlanStatus(planId: string, newStatus: ActionPlanStatus) {
        try {
            await supabase.from('action_plans').update({ status: newStatus }).eq('id', planId)
            setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p))
        } catch (e) {
            console.error('Error updating plan status:', e)
        }
    }

    function openEditor(currentPlan: ActionPlan | null) {
        setError(null)
        setEditingPlan(currentPlan)

        if (currentPlan) {
            setTitle(currentPlan.title || '')
            setOwnerName(currentPlan.owner_name || '')
            setDueDate(currentPlan.due_date || '')
            setTrackingMethod(currentPlan.tracking_method || '')
            setObservations(currentPlan.observations || '')
            setEffectiveness(currentPlan.effectiveness || '')
            setFormStatus(currentPlan.status || 'not_started')
            setDraftTasks((tasksByPlanId[currentPlan.id] || []).map(task => ({ ...task })))
        } else {
            const defaultOwner = assigneeOptions.find((option) => option.id === user?.id)?.name || ''
            setTitle('')
            setOwnerName(defaultOwner)
            setDueDate('')
            setTrackingMethod('')
            setObservations('')
            setEffectiveness('')
            setFormStatus('not_started')
            setDraftTasks([])
        }

        setNewDraftTaskTitle('')
        setModalOpen(true)
    }

    async function savePlan() {
        if (!user) return
        if (!title.trim()) {
            setError(t('actionPlan.errors.titleRequired'))
            return
        }

        setSaving(true)
        try {
            let createdPlanId: string | null = null

            if (editingPlan) {
                const oldValue = editingPlan
                const { data, error: updateError } = await supabase
                    .from('action_plans')
                    .update({
                        title: title.trim(),
                        owner_name: ownerName.trim() || null,
                        due_date: dueDate || null,
                        tracking_method: trackingMethod.trim() || null,
                        observations: observations.trim() || null,
                        effectiveness: effectiveness.trim() || null,
                        status: formStatus,
                    })
                    .eq('id', editingPlan.id)
                    .select()
                    .single()

                if (updateError) throw updateError

                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email || '',
                    action: 'update',
                    entity_type: 'action_plans',
                    entity_id: data.id,
                    entity_name: data.title,
                    old_value: oldValue,
                    new_value: data
                })
            } else {
                const { data, error: insertError } = await supabase
                    .from('action_plans')
                    .insert({
                        key_result_id: krId,
                        title: title.trim(),
                        owner_name: ownerName.trim() || null,
                        due_date: dueDate || null,
                        essential_tasks: null,
                        tracking_method: trackingMethod.trim() || null,
                        observations: observations.trim() || null,
                        effectiveness: effectiveness.trim() || null,
                        status: formStatus,
                    })
                    .select()
                    .single()

                if (insertError) throw insertError

                createdPlanId = data.id

                const preparedTasks = draftTasks
                    .map((task, index) => ({
                        action_plan_id: data.id,
                        title: task.title.trim(),
                        is_done: task.is_done,
                        order_index: index,
                    }))
                    .filter(task => task.title)

                if (preparedTasks.length > 0) {
                    const { error: insertTasksError } = await supabase
                        .from('action_plan_tasks')
                        .insert(preparedTasks)

                    if (insertTasksError) {
                        await supabase
                            .from('action_plans')
                            .delete()
                            .eq('id', data.id)
                        throw insertTasksError
                    }
                }

                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email || '',
                    action: 'create',
                    entity_type: 'action_plans',
                    entity_id: data.id,
                    entity_name: data.title,
                    old_value: null,
                    new_value: data
                })
            }

            if (createdPlanId) {
                setExpandedPlanIds(prev => (
                    prev.includes(createdPlanId)
                        ? prev
                        : [...prev, createdPlanId]
                ))
            }

            setModalOpen(false)
            setEditingPlan(null)
            setDraftTasks([])
            setNewDraftTaskTitle('')
            await loadPlans()
        } catch (saveError) {
            console.error('Error saving action plan:', saveError)
            if (isUniqueViolation(saveError)) {
                setError(t('actionPlan.errors.multiplePlansConstraint'))
                return
            }
            setError(t('actionPlan.errors.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    async function toggleTaskDone(planId: string, taskId: string, isDone: boolean) {
        try {
            await supabase
                .from('action_plan_tasks')
                .update({ is_done: isDone })
                .eq('id', taskId)

            setTasksByPlanId(prev => ({
                ...prev,
                [planId]: (prev[planId] || []).map(task => (
                    task.id === taskId ? { ...task, is_done: isDone } : task
                ))
            }))
        } catch (toggleError) {
            console.error('Error toggling task:', toggleError)
        }
    }

    function toggleDraftTaskDone(taskId: string) {
        setDraftTasks(prev => prev.map(task => (
            task.id === taskId
                ? { ...task, is_done: !task.is_done }
                : task
        )))
    }

    function addDraftTask() {
        const taskTitle = newDraftTaskTitle.trim()
        if (!taskTitle) return

        setDraftTasks(prev => [
            ...prev,
            {
                id: `draft-${Date.now()}-${prev.length}`,
                title: taskTitle,
                is_done: false,
                order_index: prev.length
            }
        ])
        setNewDraftTaskTitle('')
    }

    function deleteDraftTask(taskId: string) {
        setDraftTasks(prev => (
            prev
                .filter(task => task.id !== taskId)
                .map((task, index) => ({ ...task, order_index: index }))
        ))
    }

    async function addTask(planId: string) {
        const taskTitle = (newTaskByPlanId[planId] || '').trim()
        if (!taskTitle) return

        try {
            const planTasks = tasksByPlanId[planId] || []
            const nextIndex = planTasks.length > 0
                ? Math.max(...planTasks.map(task => task.order_index)) + 1
                : 0

            const { data, error: insertError } = await supabase
                .from('action_plan_tasks')
                .insert({
                    action_plan_id: planId,
                    title: taskTitle,
                    is_done: false,
                    order_index: nextIndex
                })
                .select('id, title, is_done, order_index')
                .single()

            if (insertError) throw insertError

            const insertedTask = data as ActionPlanTask

            setNewTaskByPlanId(prev => ({
                ...prev,
                [planId]: ''
            }))
            setTasksByPlanId(prev => ({
                ...prev,
                [planId]: [...(prev[planId] || []), insertedTask]
            }))
        } catch (addError) {
            console.error('Error adding task:', addError)
        }
    }

    async function deleteTask(planId: string, taskId: string) {
        try {
            await supabase.from('action_plan_tasks').delete().eq('id', taskId)
            setTasksByPlanId(prev => ({
                ...prev,
                [planId]: (prev[planId] || []).filter(task => task.id !== taskId)
            }))
        } catch (deleteError) {
            console.error('Error deleting task:', deleteError)
        }
    }

    async function deleteActionPlan() {
        if (!user || !editingPlan) return

        setDeletingPlanId(editingPlan.id)
        try {
            const planId = editingPlan.id
            const planTitle = editingPlan.title

            // Delete all tasks associated with the plan first
            await supabase.from('action_plan_tasks').delete().eq('action_plan_id', planId)

            // Delete the plan itself
            const { error: deleteError } = await supabase
                .from('action_plans')
                .delete()
                .eq('id', planId)

            if (deleteError) throw deleteError

            // Log the deletion
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                user_email: user.email || '',
                action: 'delete',
                entity_type: 'action_plans',
                entity_id: planId,
                entity_name: planTitle,
                old_value: editingPlan,
                new_value: null
            })

            // Close modal and refresh
            setModalOpen(false)
            setEditingPlan(null)
            setShowDeleteConfirm(false)
            setDraftTasks([])
            setNewDraftTaskTitle('')
            await loadPlans()
        } catch (deleteError) {
            console.error('Error deleting action plan:', deleteError)
            setError(t('actionPlan.errors.deleteFailed', 'Erro ao deletar plano de ação'))
        } finally {
            setDeletingPlanId(null)
        }
    }

    const ownerInOptions = assigneeOptions.some((assignee) => assignee.name === ownerName)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    <ListTodo className="w-4 h-4" />
                    {t('actionPlan.title')}
                    <Badge variant="default" size="sm" className="ml-2">
                        {plans.length}
                    </Badge>
                </h4>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditor(null)}
                >
                    <Plus className="w-3 h-3 mr-1.5" />
                    {t('actionPlan.create')}
                </Button>
            </div>

            {plans.length > 0 ? (
                <div className="space-y-3">
                    {plans.map(planItem => {
                        const planTasks = tasksByPlanId[planItem.id] || []
                        const planTaskCounts = taskCountsByPlanId[planItem.id] || { total: 0, done: 0 }
                        const isExpanded = expandedPlanIds.includes(planItem.id)
                        const newTaskTitle = newTaskByPlanId[planItem.id] || ''
                        const allDone = planTaskCounts.total > 0 && planTaskCounts.done === planTaskCounts.total
                        const someDone = planTaskCounts.done > 0 && !allDone
                        const progressPct = planTaskCounts.total > 0
                            ? Math.round((planTaskCounts.done / planTaskCounts.total) * 100)
                            : 0
                        const borderColor = allDone
                            ? 'border-l-green-500'
                            : someDone
                                ? 'border-l-blue-500'
                                : 'border-l-[var(--color-border)]'
                        const barColor = allDone ? 'bg-green-500' : someDone ? 'bg-blue-500' : 'bg-[var(--color-border)]'

                        return (
                            <div
                                key={planItem.id}
                                className={cn(
                                    'group rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] border-l-4 overflow-hidden',
                                    borderColor
                                )}
                            >
                                {/* Plan header */}
                                <div className="px-4 pt-3.5 pb-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                    {planItem.title}
                                                </p>
                                                {planTaskCounts.total > 0 && (
                                                    <Badge variant={allDone ? 'success' : someDone ? 'info' : 'default'} size="sm">
                                                        {planTaskCounts.done}/{planTaskCounts.total}
                                                    </Badge>
                                                )}
                                                <select
                                                    value={planItem.status}
                                                    onChange={(e) => updatePlanStatus(planItem.id, e.target.value as ActionPlanStatus)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={cn(
                                                        'text-xs font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] appearance-none',
                                                        STATUS_CONFIG[planItem.status].className
                                                    )}
                                                >
                                                    {(Object.keys(STATUS_CONFIG) as ActionPlanStatus[]).map(s => (
                                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {(planItem.due_date || planItem.owner_name) && (
                                                <div className="flex items-center gap-4 mt-1.5 text-xs text-[var(--color-text-muted)]">
                                                    {planItem.due_date && (
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatDate(planItem.due_date)}
                                                        </span>
                                                    )}
                                                    {planItem.owner_name && (
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            <span className="truncate max-w-[180px]">{planItem.owner_name}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                                onClick={() => openEditor(planItem)}
                                                title={t('actionPlan.edit')}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setEditingPlan(planItem)
                                                    setShowDeleteConfirm(true)
                                                }}
                                                title={t('actionPlan.delete', 'Deletar')}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                                onClick={() => togglePlanExpanded(planItem.id)}
                                                title={isExpanded ? t('actionPlan.collapsePlan') : t('actionPlan.expandPlan')}
                                            >
                                                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isExpanded ? 'rotate-180' : '')} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                {planTaskCounts.total > 0 && (
                                    <div className="px-4 pb-3 flex items-center gap-2.5">
                                        <div className="flex-1 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-[var(--color-text-muted)] shrink-0 tabular-nums">
                                            {progressPct}%
                                        </span>
                                    </div>
                                )}

                                {isExpanded && (
                                    <div className="space-y-2 pt-3 pb-4 px-4 border-t border-[var(--color-border-subtle)]">
                                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                            {t('actionPlan.tasksTitle')}
                                        </p>

                                        {planTasks.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {planTasks.map(task => (
                                                    <div
                                                        key={task.id}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40"
                                                    >
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                'flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
                                                                task.is_done
                                                                    ? 'bg-[var(--color-success-muted)] border-[var(--color-success)]/40 text-[var(--color-success)]'
                                                                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                                                            )}
                                                            onClick={() => toggleTaskDone(planItem.id, task.id, !task.is_done)}
                                                            aria-label={task.is_done ? t('actionPlan.taskMarkUndone') : t('actionPlan.taskMarkDone')}
                                                        >
                                                            {task.is_done ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                        </button>
                                                        <span className={cn('text-sm flex-1', task.is_done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]')}>
                                                            {task.title}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                                                            onClick={() => deleteTask(planItem.id, task.id)}
                                                            aria-label={t('actionPlan.taskDelete')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-[var(--color-text-muted)]">
                                                {t('actionPlan.noTasks')}
                                            </div>
                                        )}

                                        <div className="flex items-end gap-2 pt-1">
                                            <div className="flex-1">
                                                <Input
                                                    label={t('actionPlan.newTaskLabel')}
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskByPlanId(prev => ({ ...prev, [planItem.id]: e.target.value }))}
                                                    placeholder={t('actionPlan.newTaskPlaceholder')}
                                                />
                                            </div>
                                            <Button variant="outline" onClick={() => addTask(planItem.id)} disabled={!newTaskTitle.trim()}>
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]/50">
                    <ListTodo className="w-8 h-8 text-[var(--color-text-muted)]/50 mb-2" />
                    <p className="text-sm text-[var(--color-text-muted)] mb-3">{t('actionPlan.empty')}</p>
                    <Button variant="ghost" size="sm" onClick={() => openEditor(null)}>
                        {t('actionPlan.create')}
                    </Button>
                </div>
            )}

            {/* Delete confirmation modal */}
            <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 p-6">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-[var(--color-danger)]" />
                            </div>
                            <div className="flex-1">
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {t('actionPlan.deleteConfirmTitle', 'Deletar plano de ação?')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)] mt-1">
                                    {t('actionPlan.deleteConfirmDescription', 'Esta ação não pode ser desfeita. Todas as tarefas associadas também serão deletadas.')}
                                </Dialog.Description>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={deleteActionPlan}
                                loading={deletingPlanId === editingPlan?.id}
                            >
                                {t('common.delete', 'Deletar')}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Editor modal */}
            <Dialog.Root
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open)
                    if (!open) {
                        setError(null)
                        setEditingPlan(null)
                        setDraftTasks([])
                        setNewDraftTaskTitle('')
                    }
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <div>
                                <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)]">
                                    {editingPlan ? t('actionPlan.editTitle') : t('actionPlan.createTitle')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {t('actionPlan.subtitle')}
                                </Dialog.Description>
                            </div>
                            <Dialog.Close asChild>
                                <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <span className="sr-only">{t('common.cancel')}</span>
                                    ✕
                                </button>
                            </Dialog.Close>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <Input
                                label={`${t('actionPlan.fields.title')} *`}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={t('actionPlan.fields.titlePlaceholder')}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                        {t('actionPlan.fields.owner')}
                                    </label>
                                    <select
                                        value={ownerName}
                                        onChange={(e) => setOwnerName(e.target.value)}
                                        disabled={assigneesLoading}
                                        className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-70"
                                    >
                                        <option value="">
                                            {assigneesLoading
                                                ? t('actionPlan.fields.ownerLoading')
                                                : t('actionPlan.fields.ownerSelectPlaceholder')}
                                        </option>
                                        {ownerName && !ownerInOptions && (
                                            <option value={ownerName}>{ownerName}</option>
                                        )}
                                        {assigneeOptions.map((assignee) => (
                                            <option key={assignee.id} value={assignee.name}>
                                                {assignee.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!assigneesLoading && assigneeOptions.length === 0 && (
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                                            {t('actionPlan.fields.ownerNoUsers')}
                                        </p>
                                    )}
                                </div>
                                <Input
                                    type="date"
                                    label={t('actionPlan.fields.dueDate')}
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    icon={<Calendar className="w-5 h-5" />}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('actionPlan.fields.status', 'Status')}
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {(Object.keys(STATUS_CONFIG) as ActionPlanStatus[]).map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setFormStatus(s)}
                                            className={cn(
                                                'text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors',
                                                formStatus === s
                                                    ? STATUS_CONFIG[s].className
                                                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                                            )}
                                        >
                                            {STATUS_CONFIG[s].label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {!editingPlan && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                        {t('actionPlan.fields.essentialTasks')}
                                    </p>
                                    {draftTasks.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {draftTasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40"
                                                >
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            'flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
                                                            task.is_done
                                                                ? 'bg-[var(--color-success-muted)] border-[var(--color-success)]/40 text-[var(--color-success)]'
                                                                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                                                        )}
                                                        onClick={() => toggleDraftTaskDone(task.id)}
                                                        aria-label={task.is_done ? t('actionPlan.taskMarkUndone') : t('actionPlan.taskMarkDone')}
                                                    >
                                                        {task.is_done ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                    </button>
                                                    <span className={cn('text-sm flex-1', task.is_done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]')}>
                                                        {task.title}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                                                        onClick={() => deleteDraftTask(task.id)}
                                                        aria-label={t('actionPlan.taskDelete')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[var(--color-text-muted)]">
                                            {t('actionPlan.noTasks')}
                                        </p>
                                    )}

                                    <div className="flex items-end gap-2 pt-1">
                                        <div className="flex-1">
                                            <Input
                                                label={t('actionPlan.newTaskLabel')}
                                                value={newDraftTaskTitle}
                                                onChange={(e) => setNewDraftTaskTitle(e.target.value)}
                                                placeholder={t('actionPlan.newTaskPlaceholder')}
                                            />
                                        </div>
                                        <Button variant="outline" onClick={addDraftTask} disabled={!newDraftTaskTitle.trim()}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('actionPlan.fields.trackingMethod')}
                                </label>
                                <textarea
                                    value={trackingMethod}
                                    onChange={(e) => setTrackingMethod(e.target.value)}
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
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    placeholder={t('actionPlan.fields.observationsPlaceholder')}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('actionPlan.fields.effectiveness')}
                                </label>
                                <textarea
                                    value={effectiveness}
                                    onChange={(e) => setEffectiveness(e.target.value)}
                                    placeholder={t('actionPlan.fields.effectivenessPlaceholder')}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                                    {error}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 p-6 border-t border-[var(--color-border)]">
                            {editingPlan && (
                                <Button
                                    variant="destructive"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    loading={deletingPlanId === editingPlan.id}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {t('common.delete', 'Deletar')}
                                </Button>
                            )}
                            <div className="flex items-center justify-end gap-3 ml-auto">
                                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button variant="primary" onClick={savePlan} loading={saving}>
                                    {saving ? t('common.saving') : t('common.save')}
                                </Button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    )
}
