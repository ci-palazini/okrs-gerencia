import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ClipboardList, ListTodo } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { formatDate } from '../../lib/utils'

interface ActionPlanWithRelations {
    id: string
    title: string
    due_date: string | null
    owner_name: string | null
    key_result_id: string
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

    const counts = useMemo(() => {
        const now = new Date()
        return {
            all: plans.length,
            overdue: plans.filter(p => p.due_date && new Date(p.due_date) < now).length,
            upcoming: plans.filter(p => p.due_date && new Date(p.due_date) >= now).length,
            no_due: plans.filter(p => !p.due_date).length,
        }
    }, [plans])

    const filteredPlans = useMemo(() => {
        const now = new Date()
        if (filter === 'all') return plans
        if (filter === 'no_due') return plans.filter(p => !p.due_date)
        if (filter === 'overdue') return plans.filter(p => p.due_date && new Date(p.due_date) < now)
        return plans.filter(p => p.due_date && new Date(p.due_date) >= now)
    }, [plans, filter])

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

            {filteredPlans.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {filteredPlans.map((p) => (
                        <Card key={p.id} variant="elevated">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
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
        </div>
    )
}

