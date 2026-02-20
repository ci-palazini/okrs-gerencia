import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, CheckCircle2, Clock, MoreVertical, ListTodo, Calendar, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { AddActionModal } from './AddActionModal'
import { ActionDetailsModal } from './ActionDetailsModal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface Action {
    id: string
    title: string
    description: string | null
    status: 'pending' | 'in_progress' | 'done'
    due_date: string | null
    owner_name: string | null
    created_at?: string
    updated_at?: string
}

interface ActionPlanListProps {
    krId: string
}

export function ActionPlanList({ krId }: ActionPlanListProps) {
    const { t } = useTranslation()
    const { user } = useAuth()

    const statusConfig = {
        pending: { label: t('actions.status.pending'), color: 'default', icon: Clock },
        in_progress: { label: t('actions.status.inProgress'), color: 'info', icon: Clock },
        done: { label: t('actions.status.done'), color: 'success', icon: CheckCircle2 }
    }

    const [loading, setLoading] = useState(true)
    const [actions, setActions] = useState<Action[]>([])
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [selectedAction, setSelectedAction] = useState<Action | null>(null)

    useEffect(() => {
        if (krId) {
            loadActions()
        }
    }, [krId])

    async function loadActions() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('actions')
                .select('*')
                .eq('key_result_id', krId)
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
            const currentAction = actions.find(a => a.id === actionId)

            const { error } = await supabase
                .from('actions')
                .update({ status: newStatus })
                .eq('id', actionId)

            if (error) throw error

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

            loadActions() // Reload to ensure consistency
        } catch (error) {
            console.error('Error updating action status:', error)
        }
    }

    async function deleteAction(actionId: string) {
        if (!confirm(t('actions.deleteConfirm'))) return

        try {
            const actionToDelete = actions.find(a => a.id === actionId)

            const { error } = await supabase
                .from('actions')
                .delete()
                .eq('id', actionId)

            if (error) throw error

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
        }
    }

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
                    {t('actions.actionPlans')}
                    <Badge variant="default" size="sm" className="ml-2">
                        {actions.length}
                    </Badge>
                </h4>
                <Button variant="outline" size="sm" onClick={() => setAddModalOpen(true)}>
                    <Plus className="w-3 h-3 mr-1.5" />
                    {t('actions.newAction')}
                </Button>
            </div>

            {actions.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                    {actions.map((action) => {
                        const status = statusConfig[action.status]
                        const StatusIcon = status.icon
                        const isOverdue = action.due_date && new Date(action.due_date) < new Date() && action.status !== 'done'

                        return (
                            <div
                                key={action.id}
                                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:shadow-sm transition-all group cursor-pointer"
                                onClick={() => setSelectedAction(action)}
                            >
                                {/* Status Icon */}
                                <div className={cn(
                                    'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
                                    status.color === 'success' && 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
                                    status.color === 'info' && 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
                                    status.color === 'default' && 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                                )}>
                                    <StatusIcon className="w-4 h-4" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                            {action.title}
                                        </p>
                                        {/* Status Badge */}
                                        <Badge variant={status.color as any} size="sm" className="flex-shrink-0">
                                            {status.label}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-4 mt-1">
                                        {action.due_date && (
                                            <span className={cn(
                                                'text-xs flex items-center gap-1',
                                                isOverdue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
                                            )}>
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(action.due_date)}
                                            </span>
                                        )}
                                        {action.owner_name && (
                                            <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[150px]">
                                                {action.owner_name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions Menu */}
                                <div onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger asChild>
                                            <button className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] opacity-0 group-hover:opacity-100 transition-all">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Portal>
                                            <DropdownMenu.Content
                                                className="min-w-[140px] p-1.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-xl animate-in fade-in-0 zoom-in-95 z-50"
                                                sideOffset={4}
                                                align="end"
                                            >
                                                <DropdownMenu.Item
                                                    className="flex items-center px-2 py-1.5 text-xs text-[var(--color-text-secondary)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                                                    onClick={() => updateActionStatus(action.id, 'pending')}
                                                >
                                                    {t('actions.markAsPending')}
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item
                                                    className="flex items-center px-2 py-1.5 text-xs text-[var(--color-text-secondary)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                                                    onClick={() => updateActionStatus(action.id, 'in_progress')}
                                                >
                                                    {t('actions.markAsInProgress')}
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item
                                                    className="flex items-center px-2 py-1.5 text-xs text-[var(--color-success)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-success-muted)]"
                                                    onClick={() => updateActionStatus(action.id, 'done')}
                                                >
                                                    {t('actions.markAsDone')}
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Separator className="h-px my-1 bg-[var(--color-border)]" />
                                                <DropdownMenu.Item
                                                    className="flex items-center px-2 py-1.5 text-xs text-[var(--color-danger)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-danger-muted)]"
                                                    onClick={() => deleteAction(action.id)}
                                                >
                                                    <Trash2 className="w-3 h-3 mr-2" />
                                                    {t('common.delete')}
                                                </DropdownMenu.Item>
                                            </DropdownMenu.Content>
                                        </DropdownMenu.Portal>
                                    </DropdownMenu.Root>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]/50">
                    <ListTodo className="w-8 h-8 text-[var(--color-text-muted)]/50 mb-2" />
                    <p className="text-sm text-[var(--color-text-muted)] mb-3">{t('actions.noActionsLinked')}</p>
                    <Button variant="ghost" size="sm" onClick={() => setAddModalOpen(true)}>
                        {t('actions.createFirst')}
                    </Button>
                </div>
            )}

            <AddActionModal
                open={addModalOpen}
                onOpenChange={(open) => {
                    setAddModalOpen(open)
                    if (!open) setSelectedAction(null) // Reset selection when closing if it was an edit
                }}
                onSave={() => {
                    loadActions()
                    if (selectedAction) {
                        // If we were editing, we might want to close the details or refresh selected action. 
                        // For simplicity, we just reload the list and close the details/edit modal.
                        setSelectedAction(null)
                    }
                }}
                preSelectedKRId={krId}
                actionToEdit={selectedAction ? {
                    id: selectedAction.id,
                    title: selectedAction.title,
                    description: selectedAction.description,
                    due_date: selectedAction.due_date,
                    key_result_id: krId, // Assuming action belongs to this KR
                    status: selectedAction.status
                } : null}
            />

            <ActionDetailsModal
                action={selectedAction}
                open={!!selectedAction && !addModalOpen} // Modify condition so Details closes when Edit opens
                onOpenChange={(open) => !open && setSelectedAction(null)}
                onEdit={() => setAddModalOpen(true)}
            />
        </div>
    )
}
