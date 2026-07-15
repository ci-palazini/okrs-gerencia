import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Search, CheckCircle2, AlertTriangle } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { cn } from '../../lib/utils'
import { type ActionPlan, type ActionPlanTask } from './ActionPlanDetailModal'

interface PillarRelation {
    id: string
    name: string
    color: string
}

interface ObjectiveRelation {
    id: string
    title: string
    business_unit_id: string
    pillar: PillarRelation | PillarRelation[] | null
}

interface KeyResultRow {
    id: string
    code: string
    title: string
    scope: 'annual' | 'quarterly'
    quarter: number | null
    objective: ObjectiveRelation | ObjectiveRelation[] | null
}

interface KrOption {
    id: string
    code: string
    title: string
    scope: 'annual' | 'quarterly'
    quarter: number | null
    objectiveId: string
    objectiveTitle: string
    pillarName: string | null
    pillarColor: string | null
}

function toSingle<T>(value: T | T[] | null): T | null {
    if (!value) return null
    return Array.isArray(value) ? (value[0] ?? null) : value
}

interface CloneActionPlanDialogProps {
    plan: ActionPlan | null
    tasks: ActionPlanTask[]
    sourceKrId: string
    onClose: () => void
}

export function CloneActionPlanDialog({ plan, tasks, sourceKrId, onClose }: CloneActionPlanDialogProps) {
    const { t } = useTranslation()
    const { user } = useAuth()
    const { units, selectedUnit } = useBusinessUnit()

    const [businessUnitId, setBusinessUnitId] = useState('')
    const [search, setSearch] = useState('')
    const [krOptions, setKrOptions] = useState<KrOption[]>([])
    const [krsLoading, setKrsLoading] = useState(false)
    const [selectedTargetKrId, setSelectedTargetKrId] = useState<string | null>(null)
    const [cloning, setCloning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [clonedIntoTitle, setClonedIntoTitle] = useState<string | null>(null)

    // Reset dialog state whenever it opens for a (new) plan
    useEffect(() => {
        if (plan) {
            setBusinessUnitId(selectedUnit)
            setSearch('')
            setSelectedTargetKrId(null)
            setError(null)
            setClonedIntoTitle(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan])

    useEffect(() => {
        if (!plan || !businessUnitId) return

        let cancelled = false
        setKrsLoading(true)
        setSelectedTargetKrId(null)

        async function loadKrOptions() {
            const { data, error: loadError } = await supabase
                .from('key_results')
                .select(`
                    id, code, title, scope, quarter,
                    objective:objectives!inner (
                        id, title, business_unit_id,
                        pillar:pillars ( id, name, color )
                    )
                `)
                .eq('is_active', true)
                .eq('objective.business_unit_id', businessUnitId)

            if (cancelled) return

            if (loadError) {
                console.error('Error loading KRs for clone target:', loadError)
                setKrOptions([])
            } else {
                const rows = (data as unknown as KeyResultRow[]) || []
                const options: KrOption[] = rows.map(row => {
                    const objective = toSingle(row.objective)
                    const pillar = toSingle(objective?.pillar ?? null)
                    return {
                        id: row.id,
                        code: row.code,
                        title: row.title,
                        scope: row.scope,
                        quarter: row.quarter,
                        objectiveId: objective?.id ?? '',
                        objectiveTitle: objective?.title ?? '',
                        pillarName: pillar?.name ?? null,
                        pillarColor: pillar?.color ?? null,
                    }
                })
                setKrOptions(options)
            }

            if (!cancelled) setKrsLoading(false)
        }

        loadKrOptions()

        return () => { cancelled = true }
    }, [plan, businessUnitId])

    const groupedOptions = useMemo(() => {
        const q = search.trim().toLowerCase()
        const filtered = krOptions
            .filter(kr => kr.id !== sourceKrId)
            .filter(kr => (
                !q ||
                kr.title.toLowerCase().includes(q) ||
                kr.code.toLowerCase().includes(q) ||
                kr.objectiveTitle.toLowerCase().includes(q)
            ))

        const map = new Map<string, { objectiveTitle: string; items: KrOption[] }>()
        for (const kr of filtered) {
            if (!map.has(kr.objectiveId)) {
                map.set(kr.objectiveId, { objectiveTitle: kr.objectiveTitle, items: [] })
            }
            map.get(kr.objectiveId)!.items.push(kr)
        }

        return Array.from(map.values()).sort((a, b) => a.objectiveTitle.localeCompare(b.objectiveTitle))
    }, [krOptions, search, sourceKrId])

    async function handleClone() {
        if (!plan || !user || !selectedTargetKrId) return

        setCloning(true)
        setError(null)
        try {
            const { data: newPlan, error: insertPlanError } = await supabase
                .from('action_plans')
                .insert({
                    key_result_id: selectedTargetKrId,
                    title: plan.title,
                    owner_name: plan.owner_name,
                    due_date: plan.due_date,
                    essential_tasks: plan.essential_tasks ?? null,
                    tracking_method: plan.tracking_method ?? null,
                    tracking_links: plan.tracking_links ?? null,
                    observations: plan.observations ?? null,
                    effectiveness: plan.effectiveness ?? null,
                    status: 'not_started',
                    created_by: user.id,
                })
                .select()
                .single()

            if (insertPlanError) throw insertPlanError

            if (tasks.length > 0) {
                const preparedTasks = tasks.map(task => ({
                    action_plan_id: newPlan.id,
                    title: task.title,
                    is_done: false,
                    order_index: task.order_index,
                    due_date: task.due_date,
                    owner_name: task.owner_name,
                    completed_at: null,
                    is_recurring: task.is_recurring,
                    recurrence_type: task.recurrence_type,
                    recurrence_interval: task.recurrence_interval,
                    recurrence_weekdays: task.recurrence_weekdays,
                    recurrence_day_of_month: task.recurrence_day_of_month,
                    recurrence_start_date: task.recurrence_start_date,
                    recurrence_end_date: task.recurrence_end_date,
                }))

                const { error: insertTasksError } = await supabase
                    .from('action_plan_tasks')
                    .insert(preparedTasks)

                if (insertTasksError) {
                    await supabase.from('action_plans').delete().eq('id', newPlan.id)
                    throw insertTasksError
                }
            }

            await supabase.from('audit_logs').insert({
                user_id: user.id,
                user_email: user.email || '',
                action: 'create',
                entity_type: 'action_plans',
                entity_id: newPlan.id,
                entity_name: newPlan.title,
                old_value: null,
                new_value: newPlan,
            })

            const targetKr = krOptions.find(kr => kr.id === selectedTargetKrId)
            setClonedIntoTitle(targetKr ? `${targetKr.code} · ${targetKr.title}` : t('actionPlan.clone.genericTarget', 'o KR selecionado'))
            setSelectedTargetKrId(null)
        } catch (cloneError) {
            console.error('Error cloning action plan:', cloneError)
            setError(t('actionPlan.clone.errors.failed', 'Não foi possível clonar o plano de ação.'))
        } finally {
            setCloning(false)
        }
    }

    return (
        <Dialog.Root open={plan !== null} onOpenChange={(open) => { if (!open) onClose() }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[85vh] flex flex-col">
                    <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--color-border)]">
                        <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Copy className="w-4 h-4" />
                            {t('actionPlan.clone.title', 'Clonar plano de ação')}
                        </Dialog.Title>
                        <Dialog.Description className="text-sm text-[var(--color-text-muted)] mt-1">
                            {t('actionPlan.clone.subtitle', 'Escolha o KR de destino. As tarefas e os detalhes serão copiados; o progresso começa zerado.')}
                        </Dialog.Description>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                        {clonedIntoTitle && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-success-muted)] text-[var(--color-success)] text-sm">
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{t('actionPlan.clone.success', 'Plano clonado com sucesso para "{{target}}".', { target: clonedIntoTitle })}</span>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                                {t('actionPlan.clone.businessUnit', 'Empresa')}
                            </label>
                            <select
                                value={businessUnitId}
                                onChange={(e) => setBusinessUnitId(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                            >
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('actionPlan.clone.searchPlaceholder', 'Buscar KR por título ou código...')}
                                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                            />
                        </div>

                        <div className="border border-[var(--color-border)] rounded-lg max-h-64 overflow-y-auto divide-y divide-[var(--color-border)]">
                            {krsLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : groupedOptions.length > 0 ? (
                                groupedOptions.map(group => (
                                    <div key={group.objectiveTitle} className="py-1.5">
                                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] truncate">
                                            {group.objectiveTitle}
                                        </p>
                                        {group.items.map(kr => (
                                            <button
                                                key={kr.id}
                                                type="button"
                                                onClick={() => setSelectedTargetKrId(kr.id)}
                                                className={cn(
                                                    'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                                                    selectedTargetKrId === kr.id
                                                        ? 'bg-[var(--color-primary)]/10'
                                                        : 'hover:bg-[var(--color-surface-hover)]'
                                                )}
                                            >
                                                {kr.pillarColor && (
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: kr.pillarColor }}
                                                    />
                                                )}
                                                <span className="flex-1 min-w-0 text-sm text-[var(--color-text-primary)] truncate">
                                                    {kr.code} · {kr.title}
                                                </span>
                                                <Badge variant="outline" size="sm" className="shrink-0">
                                                    {kr.scope === 'annual'
                                                        ? t('actionPlan.clone.scopeAnnual', 'Anual')
                                                        : t('actionPlan.clone.scopeQuarterly', 'T{{quarter}}', { quarter: kr.quarter })}
                                                </Badge>
                                                {selectedTargetKrId === kr.id && (
                                                    <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                                    {t('actionPlan.clone.noResults', 'Nenhum KR encontrado.')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                        <Button variant="ghost" onClick={onClose}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleClone}
                            disabled={!selectedTargetKrId}
                            loading={cloning}
                        >
                            <Copy className="w-4 h-4 mr-2" />
                            {cloning
                                ? t('actionPlan.clone.cloning', 'Clonando...')
                                : t('actionPlan.clone.confirm', 'Clonar para este KR')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
