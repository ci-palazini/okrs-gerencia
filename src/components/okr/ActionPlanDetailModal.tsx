import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    AlertTriangle, BarChart2, Calendar, CheckCircle2, Clock,
    ExternalLink, FileText, MessageSquare, Pencil, Plus, Trash2, User,
    Send,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'
import { getEffectiveDeadline, formatDeadlineDate } from '../../lib/dateUtils'
import { DeadlineBadge } from './DeadlineBadge'
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
    notes: string | null
}

export function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
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
    const { t } = useTranslation()
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

    // Task edit sub-modal
    const [editingTask, setEditingTask] = useState<ActionPlanTask | null>(null)
    const [taskModalOpen, setTaskModalOpen] = useState(false)
    const [taskTitle, setTaskTitle] = useState('')
    const [taskDueDate, setTaskDueDate] = useState('')
    const [taskOwnerName, setTaskOwnerName] = useState('')
    const [taskNotes, setTaskNotes] = useState('')
    const [savingTask, setSavingTask] = useState(false)
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

    // Delete plan confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Reset state when the modal opens for a new plan
    useEffect(() => {
        if (plan) {
            setNewComment('')
            setNewTaskDraft({ title: '', dueDate: '', ownerName: '' })
            setShowAddTaskForm(false)
            setComments([])
            commentsLoaded.current = false
            setShowDeleteConfirm(false)
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
        }
    }, [plan?.id])

    // ── Task operations ──────────────────────────────────────────────────────

    async function toggleTaskDone(taskId: string, isDone: boolean) {
        if (!plan) return
        try {
            await supabase.from('action_plan_tasks').update({ is_done: isDone }).eq('id', taskId)
            const updated = tasks.map(t => t.id === taskId ? { ...t, is_done: isDone } : t)
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
                .select('id, title, is_done, order_index, due_date, owner_name, notes')
                .single()

            if (error) throw error

            onTasksChanged(plan.id, [...tasks, data as ActionPlanTask])
            setNewTaskDraft({ title: '', dueDate: '', ownerName: '' })
            setShowAddTaskForm(false)
        } catch (e) {
            console.error('Error adding task:', e)
        } finally {
            setAddingTask(false)
        }
    }

    function openTaskEditor(task: ActionPlanTask) {
        setEditingTask(task)
        setTaskTitle(task.title)
        setTaskDueDate(task.due_date || '')
        setTaskOwnerName(task.owner_name || '')
        setTaskNotes(task.notes || '')
        setTaskModalOpen(true)
    }

    async function saveTask() {
        if (!editingTask || !plan || !taskTitle.trim()) return
        setSavingTask(true)
        try {
            const { data, error } = await supabase
                .from('action_plan_tasks')
                .update({
                    title: taskTitle.trim(),
                    due_date: taskDueDate || null,
                    owner_name: taskOwnerName || null,
                    notes: taskNotes.trim() || null,
                })
                .eq('id', editingTask.id)
                .select('id, title, is_done, order_index, due_date, owner_name, notes')
                .single()

            if (error) throw error

            onTasksChanged(plan.id, tasks.map(t => t.id === editingTask.id ? (data as ActionPlanTask) : t))
            setTaskModalOpen(false)
            setEditingTask(null)
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
            if (taskModalOpen && editingTask?.id === taskId) {
                setTaskModalOpen(false)
                setEditingTask(null)
            }
        } catch (e) {
            console.error('Error deleting task:', e)
        } finally {
            setDeletingTaskId(null)
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

    const doneTasks = tasks.filter(t => t.is_done).length
    const totalTasks = tasks.length
    const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
    const allDone = totalTasks > 0 && doneTasks === totalTasks
    const someDone = doneTasks > 0 && !allDone

    const effectiveDeadline = plan
        ? getEffectiveDeadline(plan.due_date, tasks)
        : null

    function getInitials(name: string): string {
        return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
    }

    function formatCommentDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })
    }

    function formatCreatedAt(dateStr: string): string {
        const d = new Date(dateStr)
        const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        return `${date} às ${time}`
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

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            <Dialog.Root open={plan !== null} onOpenChange={(open) => { if (!open) onClose() }}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[40] bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[50] w-full max-w-[76rem] max-h-[92vh] flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 overflow-hidden">

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
                                            {tasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    className="group/task flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors"
                                                >
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                                                            task.is_done
                                                                ? 'border-green-500 bg-green-500 text-white'
                                                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)] bg-transparent text-transparent hover:text-[var(--color-primary)]'
                                                        )}
                                                        onClick={() => toggleTaskDone(task.id, !task.is_done)}
                                                    >
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            'text-sm leading-relaxed',
                                                            task.is_done
                                                                ? 'text-[var(--color-text-muted)] line-through'
                                                                : 'text-[var(--color-text-primary)]'
                                                        )}>
                                                            {task.title}
                                                        </p>
                                                        {(task.due_date || task.owner_name || task.notes) && (
                                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                {task.due_date && (
                                                                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {formatShortDate(task.due_date)}
                                                                    </span>
                                                                )}
                                                                {task.owner_name && (
                                                                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                                                        <User className="w-3 h-3" />
                                                                        {task.owner_name}
                                                                    </span>
                                                                )}
                                                                {task.notes && (
                                                                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] max-w-[180px]">
                                                                        <FileText className="w-3 h-3 shrink-0" />
                                                                        <span className="truncate">{task.notes}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            type="button"
                                                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
                                                            onClick={() => openTaskEditor(task)}
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                                                            onClick={() => deleteTask(task.id)}
                                                            disabled={deletingTaskId === task.id}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
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

            {/* ── Task edit sub-modal ── */}
            <Dialog.Root
                open={taskModalOpen}
                onOpenChange={(open) => {
                    setTaskModalOpen(open)
                    if (!open) setEditingTask(null)
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[50] bg-black/40 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95">
                        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
                            <Dialog.Title className="text-base font-semibold text-[var(--color-text-primary)]">
                                Editar tarefa
                            </Dialog.Title>
                            <Dialog.Close asChild>
                                <button className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                    ✕
                                </button>
                            </Dialog.Close>
                        </div>

                        <div className="p-5 space-y-4">
                            <Input
                                label="Título *"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                placeholder="Descrição da tarefa"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    type="date"
                                    label="Prazo"
                                    value={taskDueDate}
                                    onChange={(e) => setTaskDueDate(e.target.value)}
                                    icon={<Calendar className="w-4 h-4" />}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                        Responsável
                                    </label>
                                    {assigneeOptions.length > 0 ? (
                                        <select
                                            value={taskOwnerName}
                                            onChange={(e) => setTaskOwnerName(e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        >
                                            <option value="">Sem responsável</option>
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
                                            placeholder="Nome do responsável"
                                            className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    Notas
                                </label>
                                <textarea
                                    value={taskNotes}
                                    onChange={(e) => setTaskNotes(e.target.value)}
                                    placeholder="Observações sobre esta tarefa..."
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 p-5 border-t border-[var(--color-border)]">
                            <Button
                                variant="danger"
                                onClick={() => editingTask && deleteTask(editingTask.id)}
                                loading={deletingTaskId === editingTask?.id}
                            >
                                <Trash2 className="w-4 h-4 mr-1.5" />
                                Deletar
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={() => setTaskModalOpen(false)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={saveTask}
                                    loading={savingTask}
                                    disabled={!taskTitle.trim()}
                                >
                                    {t('common.save')}
                                </Button>
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
