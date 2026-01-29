import * as Dialog from '@radix-ui/react-dialog'
import { X, Calendar, User, Clock, CheckCircle2, AlertTriangle, FileText, Edit3 } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn, formatDate } from '../../lib/utils'

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

interface ActionDetailsModalProps {
    action: Action | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit?: () => void
}

const statusConfig = {
    pending: { label: 'Pendente', color: 'default', icon: Clock },
    in_progress: { label: 'Em Progresso', color: 'info', icon: Clock },
    done: { label: 'Concluído', color: 'success', icon: CheckCircle2 }
}

export function ActionDetailsModal({ action, open, onOpenChange, onEdit }: ActionDetailsModalProps) {
    if (!action) return null

    const status = statusConfig[action.status]
    const StatusIcon = status.icon
    const isOverdue = action.due_date && new Date(action.due_date) < new Date() && action.status !== 'done'

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 z-50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 z-[51] max-h-[90vh] overflow-y-auto outline-none">
                    {/* Header */}
                    <div className="flex items-start justify-between p-6 border-b border-[var(--color-border)]">
                        <div className="pr-8">
                            <Dialog.Title className="text-xl font-bold text-[var(--color-text-primary)] leading-snug">
                                {action.title}
                            </Dialog.Title>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant={status.color as any} size="sm">
                                    <StatusIcon className="w-3 h-3 mr-1" />
                                    {status.label}
                                </Badge>
                                {isOverdue && (
                                    <Badge variant="danger" size="sm">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        Atrasado
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {onEdit && (
                                <button
                                    onClick={onEdit}
                                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                                    title="Editar Ação"
                                >
                                    <Edit3 className="w-5 h-5" />
                                </button>
                            )}
                            <Dialog.Close asChild>
                                <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </Dialog.Close>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Description */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Descrição
                            </h4>
                            <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)]/50 border border-[var(--color-border)] text-[var(--color-text-primary)] whitespace-pre-wrap text-sm leading-relaxed">
                                {action.description || <span className="text-[var(--color-text-muted)] italic">Nenhuma descrição fornecida.</span>}
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Owner */}
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    Responsável
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <span>{action.owner_name || 'Não atribuído'}</span>
                                </div>
                            </div>

                            {/* Due Date */}
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    Data Limite
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                        isOverdue ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]" : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
                                    )}>
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <span>
                                        {action.due_date ? formatDate(action.due_date) : 'Sem data definida'}
                                    </span>
                                </div>
                            </div>

                            {/* Created At */}
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    Criado em
                                </h4>
                                <div className="text-sm text-[var(--color-text-primary)] pl-1">
                                    {action.created_at ? new Date(action.created_at).toLocaleDateString('pt-BR') : '-'}
                                </div>
                            </div>

                            {/* Completed At (using updated_at if done) */}
                            {action.status === 'done' && (
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                        Concluído em
                                    </h4>
                                    <div className="text-sm text-[var(--color-text-primary)] pl-1">
                                        {action.updated_at ? new Date(action.updated_at).toLocaleDateString('pt-BR') : '-'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
