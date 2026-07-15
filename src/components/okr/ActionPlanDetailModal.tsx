import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    AlertTriangle, BarChart2, Calendar, CheckCircle2, Clock,
    ExternalLink, FileText, MessageSquare, Pencil, Plus, Trash2, User,
    Send, Repeat, History, RotateCcw,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'
import { getEffectiveDeadline, formatDeadlineDate, toDateLocale, getTodayISO } from '../../lib/dateUtils'
import {
    type RecurrenceType,
    getTaskEffectiveState,
    getCurrentPeriodDate,
    getNextOccurrence,
    describeRecurrence,
    defaultWeekdays,
    addDaysISO,
} from '../../lib/recurrence'
import i18n from '../../i18n'
import { DeadlineBadge } from './DeadlineBadge'
import { ActionPlanAttachments } from './ActionPlanAttachments'
import { type AssigneeOption } from '../../lib/assignees'

// ── Shared types ──────────────────────────────────────────────────────────────

export type ActionPlanStatus = 'not_started' | 'in_progress' | 'completed'

export const STATUS_CONFIG: Record<ActionPlanStatus, { label: string; className: string }> = {
    not_started: { label: 'Não iniciado',  className: 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]' },
    in_progress:  { label: 'Em andamento', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800/50' },
    completed:    { label: 'Concluído',    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-800/50' },
}

export interface TrackingLink {
    url: string
    label: string
}

export interface ActionPlan {
    id: string
    owner_name: string | null
    due_date: string | null
    title: string
    essential_tasks?: string | null
    tracking_method?: string | null
    tracking_links?: TrackingLink[] | null
    observations?: string | null
    effectiveness?: string | null
    status: ActionPlanStatus
    created_by?: string | null
    creator_name?: string | null
    created_at?: string | null
}

export interface ActionPlanTask {
    id: string
    title: string
    is_done: boolean
    order_index: number
    due_date: string | null
    owner_name: string | null
    completed_at: string | null
    is_recurring: boolean
    recurrence_type: RecurrenceType | null
    recurrence_interval: number | null
    recurrence_weekdays: number[] | null
    recurrence_day_of_month: number | null
    recurrence_start_date: string | null
    recurrence_end_date: string | null
}

export interface ActionPlanTaskCompletion {
    id: string
    task_id: string
    period_date: string
    completed_at: string
    completed_by: string | null
    completed_by_name: string | null
    note: string | null
}

/** Columns selected for a task (shared by list and modal queries). */
export const TASK_COLUMNS =
    'id, title, is_done, order_index, due_date, owner_name, completed_at, ' +
    'is_recurring, recurrence_type, recurrence_interval, recurrence_weekdays, ' +
    'recurrence_day_of_month, recurrence_start_date, recurrence_end_date'

export function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(toDateLocale(i18n.language), { day: '2-digit', month: 'short' })
}

// ── Comment type ──────────────────────────────────────────────────────────────

interface ActionPlanComment {
    id: string
    action_plan_id: string
    author_name: string
    author_id: string | null
    content: string
    created_at: string
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ActionPlanDetailModalProps {
    plan: ActionPlan | null
    tasks: ActionPlanTask[]
    assigneeOptions: AssigneeOption[]
    onClose: () => void
    onPlanUpdated: (updated: ActionPlan) => void
    onTasksChanged: (planId: string, tasks: ActionPlanTask[]) => void
    onEditPlan: (plan: ActionPlan) => void
    onDeletePlan: (plan: ActionPlan) => void
}

interface NewTaskDraft {
    title: string
    dueDate: string
    ownerName: string
}

export function ActionPlanDetailModal({
    plan,
    tasks,
    assigneeOptions,
    onClose,
    onPlanUpdated,
    onTasksChanged,
    onEditPlan,
    onDeletePlan,
}: ActionPlanDetailModalProps) {
    const { t, i18n } = useTranslation()
    const dateLocale = toDateLocale(i18n.language)
    const { user } = useAuth()

    // Comments
    const [comments, setComments] = useState<ActionPlanComment[]>([])
    const commentsLoaded = useRef(false)
    const [commentsLoading, setCommentsLoading] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [postingComment, setPostingComment] = useState(false)

    // Add-task form
    const [newTaskDraft, setNewTaskDraft] = useState<NewTaskDraft>({ title: '', dueDate: '', ownerName: '' })
    const [addingTask, setAddingTask] = useState(false)
    const [showAddTaskForm, setShowAddTaskForm] = useState(false)

    // Selected-task detail panel (inline editing, replaces the old sub-modal)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [taskTitle, setTaskTitle] = useState('')
    const [taskDueDate, setTaskDueDate] = useState('')
    const [taskOwnerName, setTaskOwnerName] = useState('')
    const [savingTask, setSavingTask] = useState(false)
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

    // Recurrence config (mirrors the selected task while editing)
    const [isRecurring, setIsRecurring] = useState(false)
    const [recType, setRecType] = useState<RecurrenceType>('daily')
    const [recInterval, setRecInterval] = useState(1)
    const [recWeekdays, setRecWeekdays] = useState<number[]>([])
    const [recDayOfMonth, setRecDayOfMonth] = useState(1)
    const [recStart, setRecStart] = useState('')
    const [recEnd, setRecEnd] = useState('')

    // Completion history, keyed by task id (recent window for progress; full for selected task)
    const [completionsByTaskId, setCompletionsByTaskId] = useState<Record<string, ActionPlanTaskCompletion[]>>({})
    const [completionNote, setCompletionNote] = useState('')
    const [togglingCompletion, setTogglingCompletion] = useState(false)

    // Delete plan confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null

    // Reset state when the modal opens for a new plan
    useEffect(() => {
        if (plan) {
            setNewComment('')
            setNewTaskDraft({ title: '', dueDate: '', ownerName: '' })
            setShowAddTaskForm(false)
            setComments([])
            commentsLoaded.current = false
            setShowDeleteConfirm(false)
            setSelectedTaskId(null)
            setCompletionsByTaskId({})
            // Eagerly load comments
            commentsLoaded.current = true
            setCommentsLoading(true)
            supabase
                .from('action_plan_comments')
                .select('*')
                .eq('action_plan_id', plan.id)
                .order('created_at', { ascending: true })
                .then(({ data }) => {
                    setComments((data as ActionPlanComment[]) || [])
                    setCommentsLoading(false)
                })
            // Load recent completions for recurring tasks (drives current-period state)
            const recurringIds = tasks.filter(t => t.is_recurring).map(t => t.id)
            if (recurringIds.length > 0) {
                const since = addDaysISO(getTodayISO(), -62)
                supabase
                    .from('action_plan_task_completions')
                    .select('*')
                    .in('task_id', recurringIds)
                    .gte('period_date', since)
                    .then(({ data }) => {
                        const grouped: Record<string, ActionPlanTaskCompletion[]> = {}
                        for (const c of (data as ActionPlanTaskCompletion[]) || []) {
                            ;(grouped[c.task_id] ??= []).push(c)
                        }
                        setCompletionsByTaskId(grouped)
                    })
            }
        }
    }, [plan?.id])

    // ── Task operations ──────────────────────────────────────────────────────

    async function toggleTaskDone(taskId: string, isDone: boolean) {
        if (!plan) return
        try {
            const completedAt = isDone ? new Date().toISOString() : null
            await supabase.from('action_plan_tasks').update({ is_done: isDone, completed_at: completedAt }).eq('id', taskId)
            const updated = tasks.map(t => t.id === taskId ? { ...t, is_done: isDone, completed_at: completedAt } : t)
            onTasksChanged(plan.id, updated)
        } catch (e) {
            console.error('Error toggling task:', e)
        }
    }

    async function addTask() {
        if (!plan || !newTaskDraft.title.trim()) return
        setAddingTask(true)
        try {
            const nextIndex = tasks.length > 0
                ? Math.max(...tasks.map(t => t.order_index)) + 1
                : 0

            const { data, error } = await supabase
                .from('action_plan_tasks')
                .insert({
                    action_plan_id: plan.id,
                    title: newTaskDraft.title.trim(),
                    is_done: false,
                    order_index: nextIndex,
                    due_date: newTaskDraft.dueDate || null,
                    owner_name: newTaskDraft.ownerName || null,
                })
                .select(TASK_COLUMNS)
                .single()

            if (error) throw error

            const created = data as unknown as ActionPlanTask
            onTasksChanged(plan.id, [...tasks, created])
            setNewTaskDraft({ title: '', dueDate: '', ownerName: '' })
            setShowAddTaskForm(false)
            selectTask(created)
        } catch (e) {
            console.error('Error adding task:', e)
        } finally {
            setAddingTask(false)
        }
    }

    function selectTask(task: ActionPlanTask) {
        setSelectedTaskId(task.id)
        setTaskTitle(task.title)
        setTaskDueDate(task.due_date || '')
        setTaskOwnerName(task.owner_name || '')
        setCompletionNote('')
        setIsRecurring(task.is_recurring)
        setRecType(task.recurrence_type ?? 'daily')
        setRecInterval(task.recurrence_interval ?? 1)
        setRecWeekdays(task.recurrence_weekdays ?? [])
        setRecDayOfMonth(task.recurrence_day_of_month ?? 1)
        setRecStart(task.recurrence_start_date ?? getTodayISO())
        setRecEnd(task.recurrence_end_date ?? '')
        // Lazily load full completion history for recurring tasks
        if (task.is_recurring) {
            supabase
                .from('action_plan_task_completions')
                .select('*')
                .eq('task_id', task.id)
                .order('period_date', { ascending: false })
                .then(({ data }) => {
                    setCompletionsByTaskId(prev => ({
                        ...prev,
                        [task.id]: (data as ActionPlanTaskCompletion[]) || [],
                    }))
                })
        }
    }

    function buildRecurrencePayload() {
        return {
            is_recurring: isRecurring,
            recurrence_type: isRecurring ? recType : null,
            recurrence_interval: isRecurring && recType === 'custom' ? Math.max(1, recInterval) : 1,
            recurrence_weekdays: isRecurring && recType === 'weekly' ? recWeekdays : null,
            recurrence_day_of_month: isRecurring && recType === 'monthly' ? recDayOfMonth : null,
            recurrence_start_date: isRecurring ? (recStart || getTodayISO()) : null,
            recurrence_end_date: isRecurring ? (recEnd || null) : null,
        }
    }

    async function saveTask() {
        if (!selectedTask || !plan || !taskTitle.trim()) return
        setSavingTask(true)
        try {
            const { data, error } = await supabase
                .from('action_plan_tasks')
                .update({
                    title: taskTitle.trim(),
                    due_date: isRecurring ? null : (taskDueDate || null),
                    owner_name: taskOwnerName || null,
                    ...buildRecurrencePayload(),
                })
                .eq('id', selectedTask.id)
                .select(TASK_COLUMNS)
                .single()

            if (error) throw error

            onTasksChanged(plan.id, tasks.map(t => t.id === selectedTask.id ? (data as unknown as ActionPlanTask) : t))
        } catch (e) {
            console.error('Error saving task:', e)
        } finally {
            setSavingTask(false)
        }
    }

    async function deleteTask(taskId: string) {
        if (!plan) return
        setDeletingTaskId(taskId)
        try {
            await supabase.from('action_plan_tasks').delete().eq('id', taskId)
            onTasksChanged(plan.id, tasks.filter(t => t.id !== taskId))
            if (selectedTaskId === taskId) setSelectedTaskId(null)
        } catch (e) {
            console.error('Error deleting task:', e)
        } finally {
            setDeletingTaskId(null)
        }
    }

    // ── Recurring completions ────────────────────────────────────────────────

    async function markPeriodDone(task: ActionPlanTask, note?: string) {
        if (!plan) return
        const period = getCurrentPeriodDate(task)
        if (!period) return
        setTogglingCompletion(true)
        try {
            const completedByName = (user as any)?.full_name || user?.email || null
            const { data, error } = await supabase
                .from('action_plan_task_completions')
                .insert({
                    task_id: task.id,
                    period_date: period,
                    completed_by: user?.id ?? null,
                    completed_by_name: completedByName,
                    note: note?.trim() || null,
                })
                .select('*')
                .single()
            if (error) throw error
            setCompletionsByTaskId(prev => ({
                ...prev,
                [task.id]: [data as ActionPlanTaskCompletion, ...(prev[task.id] || [])],
            }))
            setCompletionNote('')
        } catch (e) {
            console.error('Error marking period done:', e)
        } finally {
            setTogglingCompletion(false)
        }
    }

    async function unmarkPeriodDone(task: ActionPlanTask) {
        if (!plan) return
        const period = getCurrentPeriodDate(task)
        if (!period) return
        const existing = (completionsByTaskId[task.id] || []).find(c => c.period_date === period)
        if (!existing) return
        setTogglingCompletion(true)
        try {
            await supabase.from('action_plan_task_completions').delete().eq('id', existing.id)
            setCompletionsByTaskId(prev => ({
                ...prev,
                [task.id]: (prev[task.id] || []).filter(c => c.id !== existing.id),
            }))
        } catch (e) {
            console.error('Error unmarking period:', e)
        } finally {
            setTogglingCompletion(false)
        }
    }

    // ── Comments ─────────────────────────────────────────────────────────────

    async function postComment() {
        if (!plan || !newComment.trim() || !user) return
        setPostingComment(true)
        try {
            const authorName = (user as any).full_name || user.email || 'Usuário'
            const { data, error } = await supabase
                .from('action_plan_comments')
                .insert({
                    action_plan_id: plan.id,
                    author_name: authorName,
                    author_id: user.id,
                    content: newComment.trim(),
                })
                .select('*')
                .single()

            if (error) throw error
            setComments(prev => [...prev, data as ActionPlanComment])
            setNewComment('')
        } catch (e) {
            console.error('Error posting comment:', e)
        } finally {
            setPostingComment(false)
        }
    }

    async function deleteComment(commentId: string) {
        try {
            await supabase.from('action_plan_comments').delete().eq('id', commentId)
            setComments(prev => prev.filter(c => c.id !== commentId))
        } catch (e) {
            console.error('Error deleting comment:', e)
        }
    }

    // ── Derived ──────────────────────────────────────────────────────────────

    const today = getTodayISO()

    // Effective { dueDate, isDone } per task, unifying recurring and one-off tasks.
    const effectiveStateById = useMemo(() => {
        const map: Record<string, { dueDate: string | null; isDone: boolean }> = {}
        for (const task of tasks) {
            map[task.id] = getTaskEffectiveState(task, completionsByTaskId[task.id] || [], today)
        }
        return map
    }, [tasks, completionsByTaskId, today])

    const doneTasks = tasks.filter(t => effectiveStateById[t.id]?.isDone).length
    const totalTasks = tasks.length
    const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
    const allDone = totalTasks > 0 && doneTasks === totalTasks
    const someDone = doneTasks > 0 && !allDone

    const effectiveDeadline = plan
        ? getEffectiveDeadline(
            plan.due_date,
            tasks.map(t => {
                const s = effectiveStateById[t.id]
                return { due_date: s?.dueDate ?? null, is_done: s?.isDone ?? t.is_done }
            })
        )
        : null

    function getInitials(name: string): string {
        return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
    }

    function formatCommentDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString(dateLocale, {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })
    }

    function formatCreatedAt(dateStr: string): string {
        const d = new Date(dateStr)
        const date = d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
        const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
        return `${date} ${t('common.at')} ${time}`
    }

    function formatCompletedAt(dateStr: string): string {
        const d = new Date(dateStr)
        const date = d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })
        const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
        return `${t('taskDetail.completedAt', 'Concluída em')} ${date} ${t('common.at')} ${time}`
    }

    const hasDetails = !!(
        plan?.tracking_method ||
        plan?.observations ||
        plan?.effectiveness ||
        (plan?.tracking_links && plan.tracking_links.length > 0)
    )

    const collaborators = Array.from(
        new Set(
            tasks
                .map(t => t.owner_name)
                .filter((name): name is string => !!name && name !== plan?.owner_name)
        )
    )

    // Shared field styles for the task detail panel
    const fieldCls = 'w-full h-9 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
    const labelCls = 'block text-xs font-medium text-[var(--color-text-muted)] mb-1'
    const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            <Dialog.Root open={plan !== null} onOpenChange={(open) => { if (!open) onClose() }}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[40] bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className={cn(
                        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[50] w-full max-h-[92vh] flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 overflow-hidden transition-[max-width] duration-300',
                        selectedTask ? 'max-w-[96rem]' : 'max-w-[76rem]'
                    )}>

                        {/* ── Header ── */}
                        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--color-border)]">
                            <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0 space-y-2.5">
                                    <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)] leading-snug">
                                        {plan?.title}
                                    </Dialog.Title>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {plan && (
                                            <span className={cn(
                                                'text-xs font-semibold px-2.5 py-1 rounded-full border',
                                                STATUS_CONFIG[plan.status].className
                                            )}>
                                                {STATUS_CONFIG[plan.status].label}
                                            </span>
                                        )}
                                        {plan?.owner_name && (
                                            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                                <div className="w-5 h-5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[10px] font-bold flex items-center justify-center">
                                                    {getInitials(plan.owner_name)}
                                                </div>
                                                {plan.owner_name}
                                            </span>
                                        )}
                                        {effectiveDeadline && (
                                            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                                <Calendar className="w-3 h-3" />
                                                {formatDeadlineDate(effectiveDeadline.effectiveDate)}
                                                {effectiveDeadline.isFromTask && plan?.due_date && (
                                                    <span className="opacity-60">· orig. {formatShortDate(plan.due_date)}</span>
                                                )}
                                            </span>
                                        )}
                                        {totalTasks > 0 && (
                                            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                                <span className="text-[var(--color-text-muted)]">·</span>
                                                <CheckCircle2 className="w-3 h-3" />
                                                {doneTasks}/{totalTasks} tarefas
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => plan && onEditPlan(plan)}
                                        >
                                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                            Editar
                                        </Button>
                                        <button
                                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                                            onClick={() => plan && setShowDeleteConfirm(true)}
                                            title="Deletar plano"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <Dialog.Close asChild>
                                            <button className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors text-base leading-none">
                                                ✕
                                            </button>
                                        </Dialog.Close>
                                    </div>
                                    {(plan?.created_at || plan?.creator_name) && (
                                        <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                            <Clock className="w-3 h-3" />
                                            Criado
                                            {plan?.creator_name && <> por <span className="font-medium text-[var(--color-text-secondary)]">{plan.creator_name}</span></>}
                                            {plan?.created_at && <> em {formatCreatedAt(plan.created_at)}</>}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Body ── */}
                        <div className="flex-1 overflow-y-auto">

                            {/* Two-column layout */}
                            <div className="flex min-h-0 divide-x divide-[var(--color-border)]">

                                {/* ── Left: Tasks ── */}
                                <div className="flex-[3] p-6 space-y-4 min-w-0">

                                    {/* Section header */}
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                                            Tarefas
                                        </h3>
                                        {totalTasks > 0 && (
                                            <span className={cn(
                                                'text-xs font-semibold tabular-nums',
                                                allDone ? 'text-green-600 dark:text-green-400' : someDone ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--color-text-muted)]'
                                            )}>
                                                {progressPct}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Progress bar */}
                                    {totalTasks > 0 && (
                                        <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all duration-700',
                                                    allDone ? 'bg-green-500' : someDone ? 'bg-blue-500' : 'bg-[var(--color-border)]'
                                                )}
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                    )}

                                    {/* Task list */}
                                    {tasks.length > 0 ? (
                                        <div className="space-y-1">
                                            {tasks.map(task => {
                                                const state = effectiveStateById[task.id] ?? { dueDate: task.due_date, isDone: task.is_done }
                                                const isSelected = task.id === selectedTaskId
                                                const recurringDesc = task.is_recurring ? describeRecurrence(task, t) : ''
                                                return (
                                                <div
                                                    key={task.id}
                                                    onClick={() => selectTask(task)}
                                                    className={cn(
                                                        'group/task flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors',
                                                        isSelected
                                                            ? 'bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/30'
                                                            : 'hover:bg-[var(--color-surface-hover)]'
                                                    )}
                                                >
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                                                            state.isDone
                                                                ? 'border-green-500 bg-green-500 text-white'
                                                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)] bg-transparent text-transparent hover:text-[var(--color-primary)]'
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (task.is_recurring) {
                                                                if (state.isDone) unmarkPeriodDone(task)
                                                                else markPeriodDone(task)
                                                            } else {
                                                                toggleTaskDone(task.id, !task.is_done)
                                                            }
                                                        }}
                                                    >
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            'text-sm leading-relaxed flex items-center gap-1.5',
                                                            state.isDone
                                                                ? 'text-[var(--color-text-muted)] line-through'
                                                                : 'text-[var(--color-text-primary)]'
                                                        )}>
                                                            {task.is_recurring && <Repeat className="w-3 h-3 shrink-0 text-[var(--color-primary)]" />}
                                                            <span className="truncate">{task.title}</span>
                                                        </p>
                                                        {(state.dueDate || task.owner_name || recurringDesc || (!task.is_recurring && state.isDone && task.completed_at)) && (
                                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                {state.dueDate && (
                                                                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {formatShortDate(state.dueDate)}
                                                                    </span>
                                                                )}
                                                                {recurringDesc && (
                                                                    <span className="flex items-center gap-1 text-xs text-[var(--color-primary)]">
                                                                        <Repeat className="w-3 h-3" />
                                                                        {recurringDesc}
                                                                    </span>
                                                                )}
                                                                {task.owner_name && (
                                                                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                                                        <User className="w-3 h-3" />
                                                                        {task.owner_name}
                                                                    </span>
                                                                )}
                                                                {!task.is_recurring && state.isDone && task.completed_at && (
                                                                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                                                        <CheckCircle2 className="w-3 h-3" />
                                                                        {formatCompletedAt(task.completed_at)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            type="button"
                                                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                                                            disabled={deletingTaskId === task.id}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6 text-[var(--color-text-muted)] rounded-xl border border-dashed border-[var(--color-border)]">
                                            <Clock className="w-7 h-7 mb-2 opacity-30" />
                                            <p className="text-sm opacity-70">{t('actionPlan.noTasks')}</p>
                                        </div>
                                    )}

                                    {/* Add task */}
                                    {showAddTaskForm ? (
                                        <div className="space-y-3 pt-1 border-t border-[var(--color-border)]">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    autoFocus
                                                    value={newTaskDraft.title}
                                                    onChange={(e) => setNewTaskDraft(prev => ({ ...prev, title: e.target.value }))}
                                                    placeholder="Título da tarefa..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') addTask()
                                                        if (e.key === 'Escape') setShowAddTaskForm(false)
                                                    }}
                                                    className="flex-1 h-9 px-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                                />
                                            </div>
                                            {newTaskDraft.title.trim() && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Prazo (opcional)</label>
                                                        <input
                                                            type="date"
                                                            value={newTaskDraft.dueDate}
                                                            onChange={(e) => setNewTaskDraft(prev => ({ ...prev, dueDate: e.target.value }))}
                                                            className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Responsável (opcional)</label>
                                                        {assigneeOptions.length > 0 ? (
                                                            <select
                                                                value={newTaskDraft.ownerName}
                                                                onChange={(e) => setNewTaskDraft(prev => ({ ...prev, ownerName: e.target.value }))}
                                                                className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                                            >
                                                                <option value="">Sem responsável</option>
                                                                {assigneeOptions.map((a) => (
                                                                    <option key={a.id} value={a.name}>{a.name}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={newTaskDraft.ownerName}
                                                                onChange={(e) => setNewTaskDraft(prev => ({ ...prev, ownerName: e.target.value }))}
                                                                placeholder="Nome do responsável"
                                                                className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={addTask}
                                                    disabled={!newTaskDraft.title.trim()}
                                                    loading={addingTask}
                                                >
                                                    Adicionar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => { setShowAddTaskForm(false); setNewTaskDraft({ title: '', dueDate: '', ownerName: '' }) }}
                                                >
                                                    Cancelar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowAddTaskForm(true)}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Adicionar tarefa
                                        </button>
                                    )}
                                </div>

                                {/* ── Middle: Task detail panel ── */}
                                {selectedTask && (
                                    <div className="w-96 shrink-0 flex flex-col overflow-y-auto bg-[var(--color-surface)]">
                                        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-[var(--color-surface)] z-10 border-b border-[var(--color-border)]">
                                            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                                                {selectedTask.is_recurring && <Repeat className="w-3.5 h-3.5 text-[var(--color-primary)]" />}
                                                {t('taskDetail.title')}
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTaskId(null)}
                                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors text-base leading-none"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className="px-5 py-4 space-y-4">
                                            {/* Title */}
                                            <div>
                                                <label className={labelCls}>{t('taskDetail.taskTitle')}</label>
                                                <input
                                                    value={taskTitle}
                                                    onChange={(e) => setTaskTitle(e.target.value)}
                                                    className={fieldCls}
                                                />
                                            </div>

                                            {/* Owner */}
                                            <div>
                                                <label className={labelCls}>{t('actionPlan.fields.owner')}</label>
                                                {assigneeOptions.length > 0 ? (
                                                    <select
                                                        value={taskOwnerName}
                                                        onChange={(e) => setTaskOwnerName(e.target.value)}
                                                        className={fieldCls}
                                                    >
                                                        <option value="">{t('actionPlan.fields.ownerSelectPlaceholder')}</option>
                                                        {taskOwnerName && !assigneeOptions.some(a => a.name === taskOwnerName) && (
                                                            <option value={taskOwnerName}>{taskOwnerName}</option>
                                                        )}
                                                        {assigneeOptions.map((a) => (
                                                            <option key={a.id} value={a.name}>{a.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={taskOwnerName}
                                                        onChange={(e) => setTaskOwnerName(e.target.value)}
                                                        placeholder={t('actionPlan.fields.ownerPlaceholder')}
                                                        className={fieldCls}
                                                    />
                                                )}
                                            </div>

                                            {/* Due date (one-off tasks only) */}
                                            {!isRecurring && (
                                                <div>
                                                    <label className={labelCls}>{t('actionPlan.fields.dueDate')}</label>
                                                    <input
                                                        type="date"
                                                        value={taskDueDate}
                                                        onChange={(e) => setTaskDueDate(e.target.value)}
                                                        className={fieldCls}
                                                    />
                                                </div>
                                            )}

                                            {/* Recurrence config */}
                                            <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-3">
                                                <label className="flex items-center justify-between cursor-pointer">
                                                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                                                        <Repeat className="w-4 h-4 text-[var(--color-primary)]" />
                                                        {t('recurringTask.makeRecurring')}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isRecurring}
                                                        onChange={(e) => {
                                                            const on = e.target.checked
                                                            setIsRecurring(on)
                                                            if (on && recWeekdays.length === 0) setRecWeekdays(defaultWeekdays(today))
                                                            if (on && !recStart) setRecStart(today)
                                                        }}
                                                        className="w-4 h-4 accent-[var(--color-primary)]"
                                                    />
                                                </label>

                                                {isRecurring && (
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className={labelCls}>{t('recurringTask.type')}</label>
                                                            <select
                                                                value={recType}
                                                                onChange={(e) => {
                                                                    const next = e.target.value as RecurrenceType
                                                                    setRecType(next)
                                                                    if (next === 'weekly' && recWeekdays.length === 0) setRecWeekdays(defaultWeekdays(today))
                                                                }}
                                                                className={fieldCls}
                                                            >
                                                                <option value="daily">{t('recurringTask.freq.daily')}</option>
                                                                <option value="weekly">{t('recurringTask.freq.weekly')}</option>
                                                                <option value="monthly">{t('recurringTask.freq.monthly')}</option>
                                                                <option value="custom">{t('recurringTask.freq.custom')}</option>
                                                            </select>
                                                        </div>

                                                        {recType === 'weekly' && (
                                                            <div>
                                                                <label className={labelCls}>{t('recurringTask.weekdays')}</label>
                                                                <div className="flex gap-1">
                                                                    {weekdayOrder.map(wd => (
                                                                        <button
                                                                            key={wd}
                                                                            type="button"
                                                                            onClick={() => setRecWeekdays(prev => prev.includes(wd) ? prev.filter(d => d !== wd) : [...prev, wd])}
                                                                            className={cn(
                                                                                'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                                                                                recWeekdays.includes(wd)
                                                                                    ? 'bg-[var(--color-primary)] text-white'
                                                                                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                                                                            )}
                                                                        >
                                                                            {t(`recurringTask.weekdayShort.${wd}`)}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {recType === 'monthly' && (
                                                            <div>
                                                                <label className={labelCls}>{t('recurringTask.dayOfMonth')}</label>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={31}
                                                                    value={recDayOfMonth}
                                                                    onChange={(e) => setRecDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                                                                    className={cn(fieldCls, 'w-24')}
                                                                />
                                                            </div>
                                                        )}

                                                        {recType === 'custom' && (
                                                            <div>
                                                                <label className={labelCls}>{t('recurringTask.intervalDays')}</label>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    value={recInterval}
                                                                    onChange={(e) => setRecInterval(Math.max(1, Number(e.target.value) || 1))}
                                                                    className={cn(fieldCls, 'w-24')}
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className={labelCls}>{t('recurringTask.startDate')}</label>
                                                                <input type="date" value={recStart} onChange={(e) => setRecStart(e.target.value)} className={fieldCls} />
                                                            </div>
                                                            <div>
                                                                <label className={labelCls}>{t('recurringTask.endDate')}</label>
                                                                <input type="date" value={recEnd} onChange={(e) => setRecEnd(e.target.value)} className={fieldCls} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Save / Delete */}
                                            <div className="flex items-center justify-between gap-2 pt-1">
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => deleteTask(selectedTask.id)}
                                                    loading={deletingTaskId === selectedTask.id}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-1.5" />
                                                    {t('common.delete', 'Deletar')}
                                                </Button>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={saveTask}
                                                    loading={savingTask}
                                                    disabled={!taskTitle.trim()}
                                                >
                                                    {t('common.save')}
                                                </Button>
                                            </div>

                                            {/* Completion stamp (one-off tasks) */}
                                            {!selectedTask.is_recurring && selectedTask.is_done && selectedTask.completed_at && (
                                                <div className="pt-3 border-t border-[var(--color-border)]">
                                                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        {formatCompletedAt(selectedTask.completed_at)}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recurrence status + completion history (persisted recurring tasks) */}
                                            {selectedTask.is_recurring && (() => {
                                                const period = getCurrentPeriodDate(selectedTask, today)
                                                const history = completionsByTaskId[selectedTask.id] || []
                                                const doneForPeriod = period ? history.some(c => c.period_date === period) : false
                                                const nextDue = period && doneForPeriod ? getNextOccurrence(selectedTask, period) : period
                                                return (
                                                    <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium text-[var(--color-text-muted)]">{t('recurringTask.nextDue')}</span>
                                                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                                                {nextDue ? formatDeadlineDate(nextDue) : t('recurringTask.ended')}
                                                            </span>
                                                        </div>

                                                        {period && (doneForPeriod ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                    {t('recurringTask.doneForPeriod')}
                                                                </div>
                                                                <Button variant="outline" size="sm" onClick={() => unmarkPeriodDone(selectedTask)} loading={togglingCompletion} className="w-full">
                                                                    <RotateCcw className="w-4 h-4 mr-1.5" />
                                                                    {t('recurringTask.unmark')}
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <input
                                                                    value={completionNote}
                                                                    onChange={(e) => setCompletionNote(e.target.value)}
                                                                    placeholder={t('recurringTask.completionNotePlaceholder')}
                                                                    className={fieldCls}
                                                                />
                                                                <Button variant="primary" size="sm" onClick={() => markPeriodDone(selectedTask, completionNote)} loading={togglingCompletion} className="w-full">
                                                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                                                    {t('recurringTask.markDoneToday')}
                                                                </Button>
                                                            </div>
                                                        ))}

                                                        <div className="space-y-2">
                                                            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                                                                <History className="w-3.5 h-3.5" />
                                                                {t('recurringTask.history')}
                                                            </h4>
                                                            {history.length > 0 ? (
                                                                <div className="space-y-1.5">
                                                                    {history.map(c => (
                                                                        <div key={c.id} className="flex items-start gap-2 text-xs">
                                                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                                                                            <div className="flex-1 min-w-0">
                                                                                <span className="text-[var(--color-text-primary)] font-medium">{formatDeadlineDate(c.period_date)}</span>
                                                                                {c.completed_by_name && <span className="text-[var(--color-text-muted)]"> · {c.completed_by_name}</span>}
                                                                                {c.note && <p className="text-[var(--color-text-muted)] truncate">{c.note}</p>}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-[var(--color-text-muted)] opacity-60">{t('recurringTask.noHistory')}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* ── Right: Details sidebar ── */}
                                <div className="w-72 shrink-0 p-5 space-y-5 bg-[var(--color-surface-hover)]/30">
                                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                                        Detalhes
                                    </h3>

                                    {/* Metadata rows */}
                                    <div className="space-y-3">
                                        {/* Status */}
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-[var(--color-text-muted)]">Status</p>
                                            {plan && (
                                                <span className={cn(
                                                    'inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border',
                                                    STATUS_CONFIG[plan.status].className
                                                )}>
                                                    {STATUS_CONFIG[plan.status].label}
                                                </span>
                                            )}
                                        </div>

                                        {/* Responsável */}
                                        {plan?.owner_name && (
                                            <div className="space-y-1.5">
                                                <p className="text-xs font-medium text-[var(--color-text-muted)]">Responsável</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-xs font-bold flex items-center justify-center shrink-0">
                                                        {getInitials(plan.owner_name)}
                                                    </div>
                                                    <span className="text-sm text-[var(--color-text-primary)] truncate">{plan.owner_name}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Colaboradores (task owners different from the plan owner) */}
                                        {collaborators.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-xs font-medium text-[var(--color-text-muted)]">Colaboradores</p>
                                                <div className="space-y-1.5">
                                                    {collaborators.map(name => (
                                                        <div key={name} className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-bold flex items-center justify-center shrink-0">
                                                                {getInitials(name)}
                                                            </div>
                                                            <span className="text-sm text-[var(--color-text-secondary)] truncate">{name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Prazo */}
                                        {effectiveDeadline && (
                                            <div className="space-y-1.5">
                                                <p className="text-xs font-medium text-[var(--color-text-muted)]">
                                                    {effectiveDeadline.isFromTask ? 'Prazo atual' : 'Prazo'}
                                                </p>
                                                <div className="space-y-1">
                                                    <DeadlineBadge
                                                        dueDate={effectiveDeadline.effectiveDate}
                                                        isCompleted={plan?.status === 'completed'}
                                                        size="sm"
                                                        showDaysRemaining={plan?.status !== 'completed'}
                                                    />
                                                    {effectiveDeadline.isFromTask && (
                                                        <p className="text-xs text-[var(--color-text-muted)] opacity-70 pl-0.5">
                                                            via tarefa pendente
                                                        </p>
                                                    )}
                                                </div>
                                                {effectiveDeadline.isFromTask && plan?.due_date && (
                                                    <div className="space-y-1 pt-1 border-t border-[var(--color-border)]">
                                                        <p className="text-xs font-medium text-[var(--color-text-muted)] opacity-70">Prazo original</p>
                                                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                                            <Calendar className="w-3 h-3 opacity-60" />
                                                            {formatDate(plan.due_date)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    {hasDetails && <div className="border-t border-[var(--color-border)]" />}

                                    {/* Tracking method */}
                                    {plan?.tracking_method && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                                                <BarChart2 className="w-3.5 h-3.5" />
                                                {t('actionPlan.fields.trackingMethod')}
                                            </p>
                                            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                                                {plan.tracking_method}
                                            </p>
                                        </div>
                                    )}

                                    {/* Links */}
                                    {plan?.tracking_links && plan.tracking_links.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Links
                                            </p>
                                            <div className="space-y-1">
                                                {plan.tracking_links.map((link, i) => (
                                                    <a
                                                        key={i}
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline truncate"
                                                    >
                                                        <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                                                        <span className="truncate">{link.label || link.url}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Observations */}
                                    {plan?.observations && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5" />
                                                Observações
                                            </p>
                                            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                                                {plan.observations}
                                            </p>
                                        </div>
                                    )}

                                    {/* Effectiveness */}
                                    {plan?.effectiveness && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-medium text-[var(--color-text-muted)]">Efetividade</p>
                                            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                                                {plan.effectiveness}
                                            </p>
                                        </div>
                                    )}

                                    {/* Empty state */}
                                    {!hasDetails && (
                                        <div className="text-center py-4">
                                            <p className="text-xs text-[var(--color-text-muted)] opacity-60">Nenhum detalhe preenchido</p>
                                            <button
                                                type="button"
                                                onClick={() => plan && onEditPlan(plan)}
                                                className="mt-2 text-xs text-[var(--color-primary)] hover:underline"
                                            >
                                                Editar plano
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Attachments / File center ── */}
                            {plan && <ActionPlanAttachments planId={plan.id} />}

                            {/* ── Comments section ── */}
                            <div className="border-t border-[var(--color-border)]">
                                <div className="px-6 py-5 space-y-4">
                                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-2">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Comentários
                                        {comments.length > 0 && (
                                            <span className="font-normal text-[var(--color-text-muted)] normal-case tracking-normal">
                                                ({comments.length})
                                            </span>
                                        )}
                                    </h3>

                                    {commentsLoading ? (
                                        <div className="flex justify-center py-4">
                                            <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : comments.length > 0 ? (
                                        <div className="space-y-4">
                                            {comments.map(comment => (
                                                <div key={comment.id} className="flex gap-3 group/comment">
                                                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-xs font-bold flex items-center justify-center shrink-0">
                                                        {getInitials(comment.author_name)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline gap-2 mb-0.5">
                                                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                                {comment.author_name}
                                                            </span>
                                                            <span className="text-xs text-[var(--color-text-muted)]">
                                                                {formatCommentDate(comment.created_at)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                                                            {comment.content}
                                                        </p>
                                                    </div>
                                                    {comment.author_id === user?.id && (
                                                        <button
                                                            type="button"
                                                            className="p-1 rounded opacity-0 group-hover/comment:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all shrink-0"
                                                            onClick={() => deleteComment(comment.id)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[var(--color-text-muted)] opacity-60">Nenhum comentário ainda.</p>
                                    )}

                                    {/* Comment input */}
                                    <div className="flex gap-3 pt-1">
                                        {user && (
                                            <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                {getInitials((user as any).full_name || user.email || 'U')}
                                            </div>
                                        )}
                                        <div className="flex-1 flex gap-2 items-end">
                                            <textarea
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postComment()
                                                }}
                                                placeholder="Deixe um comentário… (Ctrl+Enter para enviar)"
                                                rows={2}
                                                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={postComment}
                                                disabled={!newComment.trim() || postingComment}
                                                className="h-10 w-10 rounded-xl flex items-center justify-center bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                                            >
                                                {postingComment
                                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    : <Send className="w-4 h-4" />
                                                }
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* ── Delete plan confirmation ── */}
            <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[50] bg-black/40 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 p-6">
                        <div className="flex items-start gap-4 mb-5">
                            <AlertTriangle className="w-6 h-6 text-[var(--color-danger)] shrink-0 mt-0.5" />
                            <div>
                                <Dialog.Title className="text-base font-semibold text-[var(--color-text-primary)]">
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
                                variant="danger"
                                onClick={() => {
                                    if (plan) onDeletePlan(plan)
                                    setShowDeleteConfirm(false)
                                }}
                            >
                                {t('common.delete', 'Deletar')}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    )
}
