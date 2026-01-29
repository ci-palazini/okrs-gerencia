import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Calendar, User, CheckCircle2, Clock, AlertTriangle, MoreVertical, ListTodo } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { AddActionModal } from '../../components/okr/AddActionModal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface ActionWithRelations {
    id: string
    title: string
    description: string | null
    status: 'pending' | 'in_progress' | 'done'
    due_date: string | null
    key_result: {
        id: string
        code: string
        title: string
        objective: {
            id: string
            title: string
            business_unit: {
                name: string
            } | null
        } | null
    } | null
}

const statusConfig = {
    pending: { label: 'Pendente', color: 'default', icon: Clock },
    in_progress: { label: 'Em Progresso', color: 'info', icon: Clock },
    done: { label: 'Concluído', color: 'success', icon: CheckCircle2 }
}

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'done'

export function ActionsPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [actions, setActions] = useState<ActionWithRelations[]>([])
    const [filter, setFilter] = useState<StatusFilter>('all')
    const [addModalOpen, setAddModalOpen] = useState(false)

    useEffect(() => {
        loadActions()
    }, [])

    async function loadActions() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('actions')
                .select(`
          *,
          key_result:key_results(
            id,
            code,
            title,
            objective:objectives(
              id,
              title,
              business_unit:business_units(name)
            )
          )
        `)
                .order('due_date', { ascending: true })

            if (error) throw error
            setActions(data || [])
        } catch (error) {
            console.error('Error loading actions:', error)
        } finally {
            setLoading(false)
        }
    }

    async function updateActionStatus(actionId: string, newStatus: string) {
        try {
            // Get current action for audit
            const currentAction = actions.find(a => a.id === actionId)

            const { error } = await supabase
                .from('actions')
                .update({ status: newStatus })
                .eq('id', actionId)

            if (error) throw error

            // Audit log
            if (user && currentAction) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'actions',
                    entity_id: actionId,
                    entity_name: currentAction.title,
                    old_value: { status: currentAction.status },
                    new_value: { status: newStatus }
                })
            }

            // Reload actions
            loadActions()
        } catch (error) {
            console.error('Error updating action:', error)
        }
    }

    async function deleteAction(actionId: string) {
        if (!confirm(t('actions.deleteConfirm'))) return

        try {
            // Get action details before checking deletion for audit log name
            const actionToDelete = actions.find(a => a.id === actionId)

            const { error } = await supabase
                .from('actions')
                .delete()
                .eq('id', actionId)

            if (error) throw error

            // Audit log
            if (user && actionToDelete) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'delete',
                    entity_type: 'actions',
                    entity_id: actionId,
                    entity_name: actionToDelete.title,
                    old_value: actionToDelete,
                    new_value: null
                })
            }

            loadActions()
        } catch (error) {
            console.error('Error deleting action:', error)
            alert(t('actions.deleteError'))
        }
    }

    const filteredActions = filter === 'all'
        ? actions
        : actions.filter(a => a.status === filter)

    const statusCounts = {
        all: actions.length,
        pending: actions.filter(a => a.status === 'pending').length,
        in_progress: actions.filter(a => a.status === 'in_progress').length,
        done: actions.filter(a => a.status === 'done').length,
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[var(--color-text-secondary)]">{t('actions.loading')}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('actions.title')}</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        {t('actions.subtitle')}
                    </p>
                </div>
                <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    {t('actions.newAction')}
                </Button>
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {(['all', 'pending', 'in_progress', 'done'] as StatusFilter[]).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                            filter === status
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                        )}
                    >
                        {status === 'all' ? t('actions.status.all') : t(`actions.status.${status === 'in_progress' ? 'inProgress' : status}`)}
                        <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs',
                            filter === status
                                ? 'bg-white/20'
                                : 'bg-[var(--color-surface-hover)]'
                        )}>
                            {statusCounts[status]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Actions List */}
            {filteredActions.length > 0 ? (
                <div className="space-y-3">
                    {filteredActions.map((action) => {
                        const status = statusConfig[action.status]
                        const StatusIcon = status.icon
                        const isOverdue = action.due_date && new Date(action.due_date) < new Date() && action.status !== 'done'

                        return (
                            <Card
                                key={action.id}
                                variant="elevated"
                                hover
                                className="group"
                            >
                                <CardContent className="flex items-center gap-4 py-4">
                                    {/* Status icon */}
                                    <div className={cn(
                                        'flex items-center justify-center w-10 h-10 rounded-xl',
                                        status.color === 'success' && 'bg-[var(--color-success-muted)]',
                                        status.color === 'info' && 'bg-[var(--color-primary)]/15',
                                        status.color === 'danger' && 'bg-[var(--color-danger-muted)]',
                                        status.color === 'default' && 'bg-[var(--color-surface-hover)]'
                                    )}>
                                        <StatusIcon className={cn(
                                            'w-5 h-5',
                                            status.color === 'success' && 'text-[var(--color-success)]',
                                            status.color === 'info' && 'text-[var(--color-primary)]',
                                            status.color === 'danger' && 'text-[var(--color-danger)]',
                                            status.color === 'default' && 'text-[var(--color-text-muted)]'
                                        )} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                                            {action.title}
                                        </p>
                                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                                            {action.key_result?.objective?.business_unit && (
                                                <span className="text-xs text-[var(--color-text-muted)]">
                                                    {action.key_result.objective.business_unit.name}
                                                </span>
                                            )}
                                            {action.due_date && (
                                                <span className={cn(
                                                    'text-xs flex items-center gap-1',
                                                    isOverdue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
                                                )}>
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(action.due_date)}
                                                    {isOverdue && ` (${t('actions.overdue')})`}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* KR Badge */}
                                    {action.key_result && (
                                        <Badge variant="outline" size="sm">
                                            KR {action.key_result.code}
                                        </Badge>
                                    )}

                                    {/* Status Badge */}
                                    <Badge variant={status.color as any} size="sm">
                                        {t(`actions.status.${action.status === 'in_progress' ? 'inProgress' : action.status}`)}
                                    </Badge>

                                    {/* Actions Menu */}
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger asChild>
                                            <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] opacity-0 group-hover:opacity-100 transition-all">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Portal>
                                            <DropdownMenu.Content
                                                className="min-w-[160px] p-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-xl animate-in fade-in-0 zoom-in-95"
                                                sideOffset={4}
                                                align="end"
                                            >
                                                <DropdownMenu.Item
                                                    className="flex items-center px-3 py-2 text-sm text-[var(--color-text-secondary)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                                                    onClick={() => updateActionStatus(action.id, 'in_progress')}
                                                >
                                                    {t('actions.status.inProgress')}
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item
                                                    className="flex items-center px-3 py-2 text-sm text-[var(--color-success)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-success-muted)]"
                                                    onClick={() => updateActionStatus(action.id, 'done')}
                                                >
                                                    {t('actions.markAsDone')}
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Separator className="h-px my-2 bg-[var(--color-border)]" />
                                                <DropdownMenu.Item
                                                    className="flex items-center px-3 py-2 text-sm text-[var(--color-danger)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-danger-muted)]"
                                                    onClick={() => deleteAction(action.id)}
                                                >
                                                    {t('common.delete')}
                                                </DropdownMenu.Item>
                                            </DropdownMenu.Content>
                                        </DropdownMenu.Portal>
                                    </DropdownMenu.Root>
                                </CardContent>
                            </Card>
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
                            {t('actions.noActions')}
                        </h3>
                        <p className="text-[var(--color-text-muted)] text-center max-w-md mb-4">
                            {filter !== 'all'
                                ? t('actions.noActionsFilter', { status: t(`actions.status.${filter === 'in_progress' ? 'inProgress' : filter}`) })
                                : t('actions.noActionsDesc')}
                        </p>
                        <Button variant="primary" onClick={() => setAddModalOpen(true)}>
                            <Plus className="w-4 h-4" />
                            {t('actions.createFirst')}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Add Action Modal */}
            <AddActionModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                onSave={loadActions}
            />
        </div>
    )
}
