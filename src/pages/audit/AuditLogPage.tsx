
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, User, FileEdit, Trash2, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { Badge } from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { formatDate, cn, formatUsername } from '../../lib/utils'

interface AuditLogEntry {
    id: string
    user_id: string
    user_email: string | null
    action: 'create' | 'update' | 'delete'
    entity_type: string
    entity_id: string
    entity_name: string | null
    old_value: Record<string, unknown> | null
    new_value: Record<string, unknown> | null
    created_at: string
    user?: {
        email: string
        full_name: string
    }
}

const actionConfig = (t: any) => ({
    create: { label: t('audit.actions.create'), color: 'success', icon: Plus },
    update: { label: t('audit.actions.update'), color: 'info', icon: FileEdit },
    delete: { label: t('audit.actions.delete'), color: 'danger', icon: Trash2 }
})

const entityLabels = (t: any): Record<string, string> => ({
    key_results: t('audit.entities.key_results'),
    objectives: t('audit.entities.objectives'),
    actions: t('audit.entities.actions'),
    pillars: t('audit.entities.pillars'),
    kr_quarterly_data: t('audit.entities.kr_quarterly_data')
})

export function AuditLogPage() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [filter, setFilter] = useState<string>('all')

    useEffect(() => {
        loadAuditLogs()
    }, [filter])

    async function loadAuditLogs() {
        setLoading(true)
        try {
            let query = supabase
                .from('audit_logs')
                .select('*, user:users(email, full_name)')
                .order('created_at', { ascending: false })
                .limit(100)

            if (filter !== 'all') {
                query = query.eq('action', filter)
            }

            const { data, error } = await query

            if (error) throw error
            setLogs((data as unknown as AuditLogEntry[]) || [])
        } catch (error) {
            console.error('Error loading audit logs:', error)
        } finally {
            setLoading(false)
        }
    }

    function getChangedFields(oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null): string[] {
        if (!oldValue || !newValue) return []

        const changes: string[] = []
        const keys = new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})])

        keys.forEach(key => {
            if (key === 'updated_at' || key === 'created_at') return
            if (JSON.stringify(oldValue?.[key]) !== JSON.stringify(newValue?.[key])) {
                changes.push(key)
            }
        })

        return changes
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('audit.loading')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('audit.title')}</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        {t('audit.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="h-10 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    >
                        <option value="all">{t('audit.filter.all')}</option>
                        <option value="create">{t('audit.filter.create')}</option>
                        <option value="update">{t('audit.filter.update')}</option>
                        <option value="delete">{t('audit.filter.delete')}</option>
                    </select>
                </div>
            </div>

            {/* Logs List */}
            {logs.length > 0 ? (
                <div className="space-y-3">
                    {logs.map((log) => {
                        const config = actionConfig(t)[log.action]
                        const ActionIcon = config.icon
                        const changedFields = getChangedFields(log.old_value, log.new_value)
                        const labels = entityLabels(t)

                        return (
                            <Card key={log.id} variant="elevated" className="group">
                                <CardContent className="flex items-start gap-4 py-4">
                                    {/* Action Icon */}
                                    <div className={cn(
                                        'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                                        config.color === 'success' && 'bg-[var(--color-success-muted)]',
                                        config.color === 'info' && 'bg-[var(--color-primary)]/15',
                                        config.color === 'danger' && 'bg-[var(--color-danger-muted)]'
                                    )}>
                                        <ActionIcon className={cn(
                                            'w-5 h-5',
                                            config.color === 'success' && 'text-[var(--color-success)]',
                                            config.color === 'info' && 'text-[var(--color-primary)]',
                                            config.color === 'danger' && 'text-[var(--color-danger)]'
                                        )} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant={config.color as 'success' | 'info' | 'danger'} size="sm">
                                                {config.label}
                                            </Badge>
                                            <Badge variant="outline" size="sm">
                                                {labels[log.entity_type] || log.entity_type}
                                            </Badge>
                                            {log.entity_name && (
                                                <span className="text-sm text-[var(--color-text-primary)] font-medium">
                                                    {log.entity_name}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 mt-2">
                                            <User className="w-4 h-4 text-[var(--color-text-muted)]" />
                                            <span className="font-medium truncate block max-w-[150px]" title={log.user?.full_name || formatUsername(log.user?.email) || formatUsername(log.user_email) || undefined}>
                                                {log.user?.full_name || formatUsername(log.user?.email) || formatUsername(log.user_email) || t('audit.unknownUser')}
                                            </span>
                                        </div>

                                        {/* Changed Fields */}
                                        {log.action === 'update' && changedFields.length > 0 && (
                                            <div className="mt-2 p-3 rounded-lg bg-[var(--color-surface)]">
                                                <p className="text-xs text-[var(--color-text-muted)] mb-2">{t('audit.changedFields')}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {changedFields.map(field => (
                                                        <span key={field} className="px-2 py-1 text-xs rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                                                            {field}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <div className="text-right shrink-0">
                                        <p className="text-sm text-[var(--color-text-secondary)]">
                                            {formatDate(log.created_at)}
                                        </p>
                                        <p className="text-xs text-[var(--color-text-muted)]">
                                            {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <Card variant="elevated">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                            <History className="w-8 h-8 text-[var(--color-text-muted)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            {t('audit.noLogs')}
                        </h3>
                        <p className="text-[var(--color-text-muted)] text-center max-w-md">
                            {t('audit.noLogsDesc')}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
