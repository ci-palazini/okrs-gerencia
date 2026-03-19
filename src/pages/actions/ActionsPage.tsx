import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ClipboardList, ListTodo, Pencil, X } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { supabase } from '../../lib/supabase'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { formatDate } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'

interface Team {
    id: string
    name: string
    memberNames: string[]
}

interface ActionPlanWithRelations {
    id: string
    title: string
    due_date: string | null
    owner_name: string | null
    key_result_id: string
    tracking_method?: string | null
    observations?: string | null
    effectiveness?: string | null
    key_result: {
        id: string
        code: string
        title: string
        objective: {
            id: string
            title: string
            business_unit_id: string
            business_unit: {
                name: string
            } | null
        } | null
    } | null
}

type DueFilter = 'all' | 'overdue' | 'upcoming' | 'no_due'

export function ActionsPage() {
    const { t } = useTranslation()
    const { selectedUnit } = useBusinessUnit()

    const [loading, setLoading] = useState(true)
    const [plans, setPlans] = useState<ActionPlanWithRelations[]>([])
    const [filter, setFilter] = useState<DueFilter>('all')
    const [teams, setTeams] = useState<Team[]>([])
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

    // Modal states
    const [editingPlan, setEditingPlan] = useState<ActionPlanWithRelations | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editFormData, setEditFormData] = useState({
        title: '',
        owner_name: '',
        due_date: '',
        tracking_method: '',
        observations: '',
        effectiveness: '',
    })

    useEffect(() => {
        supabase
            .from('teams')
            .select('id, name, team_members(users(full_name))')
            .eq('is_active', true)
            .order('order_index')
            .then(({ data }) => {
                if (data) {
                    setTeams(data.map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        memberNames: (t.team_members as any[])
                            .map((m: any) => m.users?.full_name)
                            .filter(Boolean),
                    })))
                }
            })
    }, [])

    useEffect(() => {
        if (selectedUnit) loadPlans()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUnit])

    async function loadPlans() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('action_plans')
                .select(`
                    id,
                    title,
                    due_date,
                    owner_name,
                    key_result_id,
                    tracking_method,
                    observations,
                    effectiveness,
                    key_result:key_results(
                        id,
                        code,
                        title,
                        objective:objectives(
                            id,
                            title,
                            business_unit_id,
                            business_unit:business_units(name)
                        )
                    )
                `)
                .order('due_date', { ascending: true, nullsFirst: false })

            if (error) throw error

            const typed = (data || []) as unknown as ActionPlanWithRelations[]
            const filtered = typed.filter((p) => p?.key_result?.objective?.business_unit_id === selectedUnit)
            setPlans(filtered)
        } catch (e) {
            console.error('Error loading action plans:', e)
            setPlans([])
        } finally {
            setLoading(false)
        }
    }

    function openEditor(plan: ActionPlanWithRelations) {
        setEditingPlan(plan)
        setEditFormData({
            title: plan.title || '',
            owner_name: plan.owner_name || '',
            due_date: plan.due_date || '',
            tracking_method: (plan as any).tracking_method || '',
            observations: (plan as any).observations || '',
            effectiveness: (plan as any).effectiveness || '',
        })
        setModalOpen(true)
    }

    async function savePlan() {
        if (!editingPlan || !editFormData.title.trim()) return

        setSaving(true)
        try {
            const { error } = await supabase
                .from('action_plans')
                .update({
                    title: editFormData.title.trim(),
                    owner_name: editFormData.owner_name.trim() || null,
                    due_date: editFormData.due_date || null,
                    tracking_method: editFormData.tracking_method.trim() || null,
                    observations: editFormData.observations.trim() || null,
                    effectiveness: editFormData.effectiveness.trim() || null,
                })
                .eq('id', editingPlan.id)

            if (error) throw error

            setModalOpen(false)
            setEditingPlan(null)
            await loadPlans()
        } catch (e) {
            console.error('Error saving action plan:', e)
        } finally {
            setSaving(false)
        }
    }

    const teamMemberNames = useMemo<Set<string> | null>(() => {
        if (!selectedTeamId) return null
        const team = teams.find((t) => t.id === selectedTeamId)
        return new Set(team?.memberNames ?? [])
    }, [selectedTeamId, teams])

    const counts = useMemo(() => {
        const now = new Date()
        const basePlans = teamMemberNames
            ? plans.filter(p => p.owner_name && teamMemberNames.has(p.owner_name))
            : plans
        return {
            all: basePlans.length,
            overdue: basePlans.filter(p => p.due_date && new Date(p.due_date) < now).length,
            upcoming: basePlans.filter(p => p.due_date && new Date(p.due_date) >= now).length,
            no_due: basePlans.filter(p => !p.due_date).length,
        }
    }, [plans, teamMemberNames])

    const filteredPlans = useMemo(() => {
        const now = new Date()
        let base = teamMemberNames
            ? plans.filter(p => p.owner_name && teamMemberNames.has(p.owner_name))
            : plans
        if (filter === 'all') return base
        if (filter === 'no_due') return base.filter(p => !p.due_date)
        if (filter === 'overdue') return base.filter(p => p.due_date && new Date(p.due_date) < now)
        return base.filter(p => p.due_date && new Date(p.due_date) >= now)
    }, [plans, filter, teamMemberNames])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('actions.title')}</h1>
                    <p className="text-[var(--color-text-muted)] mt-2">{t('actionPlan.subtitle')}</p>
                </div>
                <Button variant="outline" onClick={loadPlans}>
                    {t('krTracking.refreshData')}
                </Button>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    {([
                        { id: 'all', label: t('actions.status.all'), count: counts.all },
                        { id: 'overdue', label: t('actions.overdue'), count: counts.overdue },
                        { id: 'upcoming', label: t('actionPlan.filters.upcoming'), count: counts.upcoming },
                        { id: 'no_due', label: t('actionPlan.filters.noDueDate'), count: counts.no_due },
                    ] as { id: DueFilter; label: string; count: number }[]).map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setFilter(opt.id)}
                            className={[
                                'px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
                                filter === opt.id
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
                            ].join(' ')}
                        >
                            <span>{opt.label}</span>
                            <Badge variant="default" size="sm" className={filter === opt.id ? 'bg-white/20 text-white border-white/20' : ''}>
                                {opt.count}
                            </Badge>
                        </button>
                    ))}
                </div>

                {teams.length > 0 && (
                    <div className="flex items-end gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                                {t('okr.flow.mapTeamFilterLabel', 'Time')}
                            </label>
                            <select
                                value={selectedTeamId ?? ''}
                                onChange={(e) => setSelectedTeamId(e.target.value || null)}
                                className="h-11 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent hover:border-[var(--color-text-muted)] transition-all duration-200 min-w-[160px]"
                            >
                                <option value="">{t('okr.flow.mapTeamFilterAll', 'Todos os times')}</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {filteredPlans.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {filteredPlans.map((p) => (
                        <Card key={p.id} variant="elevated">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <ClipboardList className="w-4 h-4 text-[var(--color-text-muted)]" />
                                            <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
                                                {p.title}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-1 truncate">
                                            {p.key_result ? `${p.key_result.code} - ${p.key_result.title}` : '-'}
                                        </p>
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                                            {p.key_result?.objective?.business_unit?.name || ''}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditor(p)}
                                        className="flex-shrink-0"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                                    {p.due_date && (
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(p.due_date)}
                                        </span>
                                    )}
                                    {p.owner_name && <span className="truncate">{p.owner_name}</span>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card variant="elevated">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                            <ListTodo className="w-8 h-8 text-[var(--color-text-muted)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            {t('actionPlan.empty')}
                        </h3>
                        <p className="text-[var(--color-text-muted)] text-center max-w-md">
                            {t('actions.noActionsDesc')}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Edit modal */}
            <Dialog.Root
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open)
                    if (!open) setEditingPlan(null)
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <div>
                                <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)]">
                                    {t('actionPlan.editTitle')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {editingPlan?.key_result ? `${editingPlan.key_result.code} - ${editingPlan.key_result.title}` : ''}
                                </Dialog.Description>
                            </div>
                            <Dialog.Close asChild>
                                <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </Dialog.Close>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <Input
                                label={`${t('actionPlan.fields.title')} *`}
                                value={editFormData.title}
                                onChange={(e) => setEditFormData(p => ({ ...p, title: e.target.value }))}
                                placeholder={t('actionPlan.fields.titlePlaceholder')}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label={t('actionPlan.fields.owner')}
                                    value={editFormData.owner_name}
                                    onChange={(e) => setEditFormData(p => ({ ...p, owner_name: e.target.value }))}
                                    placeholder={t('actionPlan.fields.ownerSelectPlaceholder')}
                                />
                                <Input
                                    type="date"
                                    label={t('actionPlan.fields.dueDate')}
                                    value={editFormData.due_date}
                                    onChange={(e) => setEditFormData(p => ({ ...p, due_date: e.target.value }))}
                                    icon={<Calendar className="w-4 h-4" />}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('actionPlan.fields.trackingMethod')}
                                </label>
                                <textarea
                                    value={editFormData.tracking_method}
                                    onChange={(e) => setEditFormData(p => ({ ...p, tracking_method: e.target.value }))}
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
                                    value={editFormData.observations}
                                    onChange={(e) => setEditFormData(p => ({ ...p, observations: e.target.value }))}
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
                                    value={editFormData.effectiveness}
                                    onChange={(e) => setEditFormData(p => ({ ...p, effectiveness: e.target.value }))}
                                    placeholder={t('actionPlan.fields.effectivenessPlaceholder')}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                            <Button variant="ghost" onClick={() => setModalOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button variant="primary" onClick={savePlan} disabled={!editFormData.title.trim()} loading={saving}>
                                {saving ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    )
}

