import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Calendar, User, CheckCircle2, Clock, AlertTriangle, MoreVertical, ListTodo, ChevronDown, ChevronRight, Target } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { AddActionModal } from '../../components/okr/AddActionModal'
import { ActionDetailsModal } from '../../components/okr/ActionDetailsModal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { cn, formatDate } from '../../lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface ActionWithRelations {
    id: string
    title: string
    description: string | null
    status: 'pending' | 'in_progress' | 'done'
    due_date: string | null
    owner_name: string | null
    created_at: string
    updated_at: string
    key_result_id: string | null
    key_result: {
        id: string
        code: string
        title: string
        scope: string | null
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
    const { selectedUnit } = useBusinessUnit()
    const [loading, setLoading] = useState(true)
    const [actions, setActions] = useState<ActionWithRelations[]>([])
    const [filter, setFilter] = useState<StatusFilter>('all')
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [selectedAction, setSelectedAction] = useState<ActionWithRelations | null>(null)
    const [actionToEdit, setActionToEdit] = useState<ActionWithRelations | null>(null)
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set()) // Stores KR IDs (or 'orphan') to collapse

    useEffect(() => {
        if (selectedUnit) {
            loadActions()
        }
    }, [selectedUnit])

    async function loadActions() {
        setLoading(true)
        try {
            const { data: allActions, error } = await supabase
                .from('actions')
                .select(`
                    *,
                    key_result:key_results(
                        id,
                        code,
                        title,
                        scope,
                        objective:objectives(
                            id,
                            title,
                            business_unit_id,
                            business_unit:business_units(name)
                        )
                    )
                `)
                .order('due_date', { ascending: true })

            if (error) throw error

            // Client-side filter: only quarterly KR actions for the selected business unit
            const filteredByBu = (allActions || []).filter(action => {
                if (action.key_result?.scope !== 'quarterly') return false
                if (action.key_result?.objective?.business_unit_id === selectedUnit) {
                    return true
                }
                return false
            })

            setActions(filteredByBu as ActionWithRelations[])
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

    const groupedActions = useMemo(() => {
        const groups: Record<string, { kr: ActionWithRelations['key_result'], actions: ActionWithRelations[] }> = {}

        filteredActions.forEach(action => {
            const krId = action.key_result?.id || 'orphan'
            if (!groups[krId]) {
                groups[krId] = {
                    kr: action.key_result,
                    actions: []
                }
            }
            groups[krId].actions.push(action)
        })

        return groups
    }, [filteredActions])

    const toggleGroup = (groupId: string) => {
        const newCollapsed = new Set(collapsedGroups)
        if (newCollapsed.has(groupId)) {
            newCollapsed.delete(groupId)
        } else {
            newCollapsed.add(groupId)
        }
        setCollapsedGroups(newCollapsed)
    }

    const handleActionClick = (action: ActionWithRelations) => {
        setSelectedAction(action)
        setDetailsModalOpen(true)
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
                <Button variant="primary" size="md" onClick={() => {
                    setActionToEdit(null)
                    setAddModalOpen(true)
                }}>
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

            {/* Actions List - Grouped by KR */}
            {Object.keys(groupedActions).length > 0 ? (
                <div className="space-y-6">
                    {Object.entries(groupedActions).map(([groupId, group]) => {
                        const isExpanded = !collapsedGroups.has(groupId)
                        // Actually, let's stick to expanded by default.
                        // I'll use expandedGroups to store COLLAPSED items if I want default expanded.
                        // Or just use it as "isExpanded" and init with all keys.
                        // Let's simplify: toggle state.

                        return (
                            <div key={groupId} className="space-y-3">
                                {/* Group Header */}
                                <div
                                    className="flex items-center gap-2 cursor-pointer group/header select-none"
                                    onClick={() => toggleGroup(groupId)}
                                >
                                    <button className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors">
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5" />
                                        )}
                                    </button>

                                    {groupId === 'orphan' ? (
                                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                            <ListTodo className="w-5 h-5" />
                                            <h3 className="font-semibold">{t('actions.otherActions', 'Outras Ações')}</h3>
                                            <Badge variant="default" size="sm" className="ml-2">{group.actions.length}</Badge>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="font-mono font-bold text-sm bg-[var(--color-surface)]">
                                                {group.kr?.code}
                                            </Badge>
                                            <h3 className="font-semibold text-[var(--color-text-primary)] group-hover/header:text-[var(--color-primary)] transition-colors">
                                                {group.kr?.title}
                                            </h3>
                                            <Badge variant="default" size="sm" className="ml-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                                                {group.actions.length}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {/* Actions in Group */}
                                {isExpanded && (
                                    <div className="pl-4 md:pl-9 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                        {group.actions.map((action) => {
                                            const status = statusConfig[action.status]
                                            const StatusIcon = status.icon
                                            const isOverdue = action.due_date && new Date(action.due_date) < new Date() && action.status !== 'done'

                                            return (
                                                <Card
                                                    key={action.id}
                                                    variant="elevated"
                                                    hover
                                                    className="group cursor-pointer hover:border-[var(--color-primary)]/50 transition-all"
                                                    onClick={() => handleActionClick(action)}
                                                >
                                                    <CardContent className="flex items-center gap-4 py-3 px-4">
                                                        {/* Status icon */}
                                                        <div className={cn(
                                                            'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
                                                            status.color === 'success' && 'bg-[var(--color-success-muted)]',
                                                            status.color === 'info' && 'bg-[var(--color-primary)]/15',
                                                            status.color === 'danger' && 'bg-[var(--color-danger-muted)]',
                                                            status.color === 'default' && 'bg-[var(--color-surface-hover)]'
                                                        )}>
                                                            <StatusIcon className={cn(
                                                                'w-4 h-4',
                                                                status.color === 'success' && 'text-[var(--color-success)]',
                                                                status.color === 'info' && 'text-[var(--color-primary)]',
                                                                status.color === 'danger' && 'text-[var(--color-danger)]',
                                                                status.color === 'default' && 'text-[var(--color-text-muted)]'
                                                            )} />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors truncate">
                                                                {action.title}
                                                            </p>
                                                            <div className="flex items-center gap-4 mt-0.5 text-xs text-[var(--color-text-secondary)]">
                                                                {action.owner_name && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <User className="w-3 h-3" />
                                                                        {action.owner_name}
                                                                    </div>
                                                                )}
                                                                {action.due_date && (
                                                                    <div className={cn(
                                                                        'flex items-center gap-1.5',
                                                                        isOverdue ? 'text-[var(--color-danger)]' : ''
                                                                    )}>
                                                                        <Calendar className="w-3 h-3" />
                                                                        {formatDate(action.due_date)}
                                                                        {isOverdue && <span className="font-medium">({t('actions.overdue')})</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Status Badge */}
                                                        <Badge variant={status.color as any} size="sm">
                                                            {t(`actions.status.${action.status === 'in_progress' ? 'inProgress' : action.status}`)}
                                                        </Badge>

                                                        {/* Actions Menu */}
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu.Root>
                                                                <DropdownMenu.Trigger asChild>
                                                                    <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] opacity-0 group-hover:opacity-100 transition-all">
                                                                        <MoreVertical className="w-4 h-4" />
                                                                    </button>
                                                                </DropdownMenu.Trigger>
                                                                <DropdownMenu.Portal>
                                                                    <DropdownMenu.Content
                                                                        className="min-w-[160px] p-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-xl animate-in fade-in-0 zoom-in-95 z-50"
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
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
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
                            {t('actions.noActions')}
                        </h3>
                        <p className="text-[var(--color-text-muted)] text-center max-w-md mb-4">
                            {filter !== 'all'
                                ? t('actions.noActionsFilter', { status: t(`actions.status.${filter === 'in_progress' ? 'inProgress' : filter}`) })
                                : t('actions.noActionsDesc')}
                        </p>
                        <Button variant="primary" onClick={() => {
                            setActionToEdit(null)
                            setAddModalOpen(true)
                        }}>
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
                actionToEdit={actionToEdit ? {
                    id: actionToEdit.id,
                    title: actionToEdit.title,
                    description: actionToEdit.description,
                    due_date: actionToEdit.due_date,
                    key_result_id: actionToEdit.key_result_id || '',
                    owner_name: actionToEdit.owner_name || null,
                    status: actionToEdit.status
                } : null}
            />

            {/* Action Details Modal */}
            <ActionDetailsModal
                action={selectedAction}
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
                onEdit={() => {
                    if (selectedAction) {
                        setActionToEdit(selectedAction)
                        setDetailsModalOpen(false)
                        setAddModalOpen(true)
                    }
                }}
            />
        </div>
    )
}
