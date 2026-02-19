import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { RefreshCw, Target, ChevronDown, ChevronRight, Pencil, Plus, Trash2, BarChart3, Edit3 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { KRTable } from '../../components/okr/KRTable'
import { ActionPlanList } from '../../components/okr/ActionPlanList'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { ConfidenceEmoji } from '../../components/ui/ConfidenceIndicator'
import { CreateObjectiveModalV2 } from '../../components/okr/CreateObjectiveModalV2'
import { EditKRModalV2 } from '../../components/okr/EditKRModalV2'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'
import type { ConfidenceLevel } from '../../components/ui/ConfidenceIndicator'

interface BusinessUnit {
    id: string
    code: string
    name: string
}

interface Pillar {
    id: string
    code: string
    name: string
    color: string
    icon: string
    business_unit_ids?: string[]
}

interface Objective {
    id: string
    code: string
    title: string
    description: string | null
    pillar_id: string
}

interface KeyResult {
    id: string
    code: string
    title: string
    owner_name: string | null
    source: string | null
    unit: string
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    objective_id: string
    target_direction: 'maximize' | 'minimize'
    scope: 'annual' | 'quarterly'
    parent_kr_id: string | null
    quarter: number | null
    baseline: number | null
    target: number | null
    actual: number | null
    progress: number | null
    confidence: ConfidenceLevel
}

interface ObjectiveWithKRs extends Objective {
    key_results: KeyResult[]
}

interface PillarWithObjectives extends Pillar {
    objectives: ObjectiveWithKRs[]
}

export function ObjectivesCorporatePage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [units, setUnits] = useState<BusinessUnit[]>([])
    const [selectedUnit, setSelectedUnit] = useState<string>('')
    const [pillarsData, setPillarsData] = useState<PillarWithObjectives[]>([])
    const [allKRs, setAllKRs] = useState<KeyResult[]>([])
    const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set())
    const [currentQuarter] = useState(1) // Q1 2026

    // Edit objective state
    const [isEditingObjective, setIsEditingObjective] = useState(false)
    const [editingObjective, setEditingObjective] = useState<Objective | null>(null)
    const [allPillars, setAllPillars] = useState<any[]>([])

    // Edit KR state
    const [krModalOpen, setKrModalOpen] = useState(false)
    const [selectedKR, setSelectedKR] = useState<KeyResult | null>(null)
    const [defaultObjectiveId, setDefaultObjectiveId] = useState<string>('')

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedUnit) {
            loadObjectivesData()
        }
    }, [selectedUnit])

    async function loadInitialData() {
        try {
            // Get GSC Corporate unit specifically
            const { data: gscUnit } = await supabase
                .from('business_units')
                .select('*')
                .eq('code', 'GSC')
                .single()

            if (gscUnit) {
                setUnits([gscUnit])
                setSelectedUnit(gscUnit.id)
            } else {
                // Fallback: get all units
                const { data: unitsData } = await supabase
                    .from('business_units')
                    .select('*')
                    .eq('is_active', true)
                    .order('order_index')

                if (unitsData && unitsData.length > 0) {
                    setUnits(unitsData)
                    setSelectedUnit(unitsData[0].id)
                }
            }
        } catch (error) {
            console.error('Error loading initial data:', error)
        }
    }

    async function loadObjectivesData() {
        setLoading(true)
        try {
            // Get all pillars and associations
            const [pillarsRes, pivotRes] = await Promise.all([
                supabase.from('pillars').select('*').eq('is_active', true).order('order_index'),
                supabase.from('pillar_business_units').select('*')
            ])

            let pillarsResult = pillarsRes.data || []
            const pivotData = pivotRes.data || []

            if (pillarsResult.length === 0) {
                setLoading(false)
                return
            }

            // Attach relations
            pillarsResult = pillarsResult.map(p => ({
                ...p,
                business_unit_ids: pivotData
                    .filter((r: any) => r.pillar_id === p.id)
                    .map((r: any) => r.business_unit_id)
            }))

            // Get objectives for this unit
            const { data: objectivesData } = await supabase
                .from('objectives')
                .select('*')
                .eq('business_unit_id', selectedUnit)
                .eq('year', 2026)
                .eq('is_active', true)
                .order('code')

            if (!objectivesData || objectivesData.length === 0) {
                setPillarsData(pillarsResult.map(p => ({ ...p, objectives: [] })))
                setAllKRs([])
                setLoading(false)
                return
            }

            // Get all KRs for these objectives (both annual and quarterly)
            const objectiveIds = objectivesData.map(o => o.id)
            const { data: krsData } = await supabase
                .from('key_results')
                .select('*')
                .in('objective_id', objectiveIds)
                .eq('is_active', true)
                .order('order_index')

            setAllKRs(krsData || [])

            // Filter only annual KRs for the table display
            const annualKRs = (krsData || []).filter(kr => kr.scope === 'annual')

            // Group objectives by pillar with their annual KRs
            const relevantPillars = pillarsResult.filter(p => p.business_unit_ids?.includes(selectedUnit))

            const pillarsWithData: PillarWithObjectives[] = relevantPillars.map(pillar => {
                const pillarObjectives = objectivesData.filter(o => o.pillar_id === pillar.id)
                const objectivesWithKRs = pillarObjectives.map(obj => ({
                    ...obj,
                    key_results: annualKRs.filter(kr => kr.objective_id === obj.id)
                }))

                return {
                    ...pillar,
                    objectives: objectivesWithKRs
                }
            }).filter(p => p.objectives.length > 0)

            setPillarsData(pillarsWithData)
            setAllPillars(pillarsResult)

            // Expand all pillars by default
            setExpandedPillars(new Set(pillarsWithData.map(p => p.id)))

        } catch (error) {
            console.error('Error loading objectives data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function updateConfidence(krId: string, confidence: ConfidenceLevel) {
        try {
            const kr = allKRs.find(k => k.id === krId)

            const { error } = await supabase
                .from('key_results')
                .update({ confidence })
                .eq('id', krId)

            if (!error) {
                setAllKRs(prev =>
                    prev.map(k => k.id === krId ? { ...k, confidence } : k)
                )

                if (user && kr) {
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        user_email: user.email,
                        action: 'update',
                        entity_type: 'key_results',
                        entity_id: krId,
                        entity_name: `${kr.title} - confidence`,
                        old_value: { confidence: kr.confidence },
                        new_value: { confidence }
                    })
                }

                loadObjectivesData()
            }
        } catch (error) {
            console.error('Error updating confidence:', error)
        }
    }

    async function updateValue(krId: string, field: 'baseline' | 'target' | 'actual', value: number | null) {
        try {
            const kr = allKRs.find(k => k.id === krId)

            if (kr) {
                const updateData: Record<string, any> = {}
                updateData[field] = value

                // Calculate and save progress
                if (field === 'target' || field === 'actual') {
                    const newTarget = field === 'target' ? value : kr.target
                    const newActual = field === 'actual' ? value : kr.actual

                    let newProgress: number | null = null

                    if (newTarget !== null && newTarget !== 0 && newActual !== null) {
                        const direction = kr.target_direction ?? 'maximize'

                        if (direction === 'minimize') {
                            if (newActual !== 0) {
                                newProgress = Math.round((newTarget / newActual) * 100)
                            }
                        } else {
                            newProgress = Math.round((newActual / newTarget) * 100)
                        }
                    }

                    updateData.progress = newProgress
                }

                const { error } = await supabase
                    .from('key_results')
                    .update(updateData)
                    .eq('id', krId)

                if (error) throw error

                if (user) {
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        user_email: user.email,
                        action: 'update',
                        entity_type: 'key_results',
                        entity_id: krId,
                        entity_name: `${kr.title} - ${field}`,
                        old_value: { [field]: kr[field] },
                        new_value: { [field]: value }
                    })
                }

                loadObjectivesData()
            }
        } catch (error) {
            console.error('Error updating value:', error)
        }
    }

    function handleEditKR(kr: any) {
        setSelectedKR(kr)
        setDefaultObjectiveId(kr.objective_id)
        setKrModalOpen(true)
    }

    function handleAddKR(objectiveId: string) {
        setSelectedKR(null)
        setDefaultObjectiveId(objectiveId)
        setKrModalOpen(true)
    }

    function togglePillar(pillarId: string) {
        setExpandedPillars(prev => {
            const newSet = new Set(prev)
            if (newSet.has(pillarId)) {
                newSet.delete(pillarId)
            } else {
                newSet.add(pillarId)
            }
            return newSet
        })
    }

    const selectedUnitName = units.find(u => u.id === selectedUnit)?.name || ''

    if (loading && units.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('dashboard.loadingData')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            <Target className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('objectives.corporate.title')}</h1>
                    </div>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        {t('objectives.corporate.subtitle', { year: '2026' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="info" size="md">
                        Q{currentQuarter} 2026
                    </Badge>
                    {saving && (
                        <Badge variant="warning" size="sm">
                            {t('objectives.corporate.saving')}
                        </Badge>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadObjectivesData}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="p-4 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                <p className="text-sm text-[var(--color-text-secondary)]">
                    <strong className="text-[var(--color-primary)]">{t('objectives.corporate.tip')}</strong> {t('objectives.corporate.tipContent')}
                </p>
            </div>

            {/* Pillars with Objectives */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : pillarsData.length > 0 ? (
                <div className="space-y-6">
                    {pillarsData.map((pillar) => {
                        const isExpanded = expandedPillars.has(pillar.id)
                        const totalKRs = pillar.objectives.reduce((acc, obj) => acc + obj.key_results.length, 0)

                        return (
                            <div
                                key={pillar.id}
                                className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] overflow-hidden"
                            >
                                {/* Pillar Header */}
                                <button
                                    onClick={() => togglePillar(pillar.id)}
                                    className="w-full flex items-center gap-4 p-5 hover:bg-[var(--color-surface-hover)] transition-colors"
                                >
                                    <div
                                        className="w-1.5 h-12 rounded-full"
                                        style={{ backgroundColor: pillar.color }}
                                    />
                                    <div className="flex-1 text-left">
                                        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                                            {pillar.name}
                                        </h2>
                                        <p className="text-sm text-[var(--color-text-muted)]">
                                            {t('objectives.corporate.pillarSummary', { objectives: pillar.objectives.length, krs: totalKRs })}
                                        </p>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        size="md"
                                        className="mr-2"
                                        style={{ borderColor: pillar.color, color: pillar.color }}
                                    >
                                        {pillar.code}
                                    </Badge>
                                    {isExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                                    )}
                                </button>

                                {/* Objectives and KRs */}
                                {isExpanded && (
                                    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)]/30 p-5 space-y-8">
                                        {pillar.objectives.map((objective, index) => (
                                            <div key={objective.id} className={cn(
                                                "space-y-4",
                                                index > 0 && "pt-8 border-t border-[var(--color-border-subtle)]"
                                            )}>
                                                {/* Objective Header */}
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="outline" className="text-xs font-bold font-mono">
                                                                {objective.code}
                                                            </Badge>
                                                            <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                                                {objective.title}
                                                            </h4>
                                                        </div>
                                                        {objective.description && (
                                                            <p className="text-sm text-[var(--color-text-secondary)] pl-1">
                                                                {objective.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                                                            title={t('common.edit')}
                                                            onClick={() => {
                                                                setEditingObjective(objective)
                                                                setIsEditingObjective(true)
                                                            }}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleAddKR(objective.id)}
                                                        >
                                                            <Plus className="w-3 h-3 mr-1.5" />
                                                            {t('okr.newKR')}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* KRs Table */}
                                                {objective.key_results.length > 0 ? (
                                                    <KRTable
                                                        keyResults={objective.key_results.map(kr => ({
                                                            ...kr,
                                                            scope: kr.scope as 'annual' | 'quarterly',
                                                        }))}
                                                        onUpdateConfidence={updateConfidence}
                                                        onUpdateValue={updateValue}
                                                        onEdit={handleEditKR}
                                                        onDelete={async (krId) => {
                                                            if (window.confirm(t('okr.deleteKRConfirm'))) {
                                                                try {
                                                                    await supabase.from('key_results').delete().eq('id', krId)
                                                                    loadObjectivesData()
                                                                } catch (e) {
                                                                    console.error(e)
                                                                }
                                                            }
                                                        }}
                                                        renderExpandedRow={(kr) => {
                                                            const childKRs = allKRs.filter(
                                                                q => q.parent_kr_id === kr.id && q.scope === 'quarterly'
                                                            ).sort((a, b) => (a.quarter ?? 0) - (b.quarter ?? 0))

                                                            return (
                                                                <div className="space-y-4">
                                                                    {/* Quarterly Children */}
                                                                    <div>
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <h5 className="text-sm font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5">
                                                                                <BarChart3 className="w-4 h-4 text-purple-500" />
                                                                                {t('quarterlyCard.quarterly')} KRs
                                                                            </h5>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="text-purple-600 hover:bg-purple-50 text-xs h-7"
                                                                                onClick={() => {
                                                                                    setSelectedKR({
                                                                                        ...kr,
                                                                                        id: undefined as any,
                                                                                        scope: 'quarterly',
                                                                                        parent_kr_id: kr.id,
                                                                                        quarter: currentQuarter,
                                                                                        code: `${kr.code}.Q${currentQuarter}`,
                                                                                        baseline: null,
                                                                                        target: null,
                                                                                        actual: null,
                                                                                        progress: null,
                                                                                        confidence: null
                                                                                    } as any)
                                                                                    setDefaultObjectiveId(kr.objective_id || '')
                                                                                    setKrModalOpen(true)
                                                                                }}
                                                                            >
                                                                                <Plus className="w-3 h-3 mr-1" />
                                                                                {t('quarterlyCard.addQuarterlyKR')}
                                                                            </Button>
                                                                        </div>

                                                                        {childKRs.length > 0 ? (
                                                                            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
                                                                                <table className="w-full">
                                                                                    <thead>
                                                                                        <tr className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface-subtle)]">
                                                                                            <th className="px-3 py-2 text-left w-24">{t('quarterlyCard.indicator')}</th>
                                                                                            <th className="px-3 py-2 text-center w-20">{t('quarterlyCard.baseline')}</th>
                                                                                            <th className="px-3 py-2 text-center w-20">{t('quarterlyCard.target')}</th>
                                                                                            <th className="px-3 py-2 text-center w-20">{t('quarterlyCard.actual')}</th>
                                                                                            <th className="px-3 py-2 w-24">{t('quarterlyCard.progress')}</th>
                                                                                            <th className="px-3 py-2 text-center w-20">{t('quarterlyCard.confidence')}</th>
                                                                                            <th className="px-3 py-2 w-16"></th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                                                                        {childKRs.map(child => {
                                                                                            const childProgress = child.progress ?? 0
                                                                                            const progressVariant = childProgress >= 70 ? 'success' : childProgress >= 40 ? 'warning' : 'danger'

                                                                                            const formatVal = (v: number | null) => {
                                                                                                if (v === null) return '-'
                                                                                                if (kr.metric_type === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
                                                                                                if (kr.metric_type === 'percentage') return `${v}%`
                                                                                                return `${v}${kr.unit ? ` ${kr.unit}` : ''}`
                                                                                            }

                                                                                            return (
                                                                                                <tr key={child.id} className="group/child hover:bg-[var(--color-surface-hover)] transition-colors">
                                                                                                    <td className="px-3 py-2">
                                                                                                        <div className="flex items-center gap-1.5">
                                                                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                                                                                                                Q{child.quarter}
                                                                                                            </span>
                                                                                                            <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[120px]">
                                                                                                                {child.title}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-center text-xs text-[var(--color-text-secondary)]">
                                                                                                        {formatVal(child.baseline)}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-center text-xs text-[var(--color-success)]">
                                                                                                        {formatVal(child.target)}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-center text-xs font-medium text-[var(--color-primary)]">
                                                                                                        {formatVal(child.actual)}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2">
                                                                                                        <div className="flex items-center gap-1.5">
                                                                                                            <ProgressBar value={childProgress} size="sm" variant="gradient" />
                                                                                                            <Badge variant={progressVariant} size="sm">{childProgress}%</Badge>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-center">
                                                                                                        <ConfidenceEmoji value={child.confidence} />
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-right">
                                                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                                                                                            <button
                                                                                                                onClick={() => handleEditKR(child)}
                                                                                                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                                                                                                                title={t('common.edit')}
                                                                                                            >
                                                                                                                <Edit3 className="w-3 h-3" />
                                                                                                            </button>
                                                                                                            <button
                                                                                                                onClick={async () => {
                                                                                                                    if (window.confirm(t('okr.deleteKRConfirm'))) {
                                                                                                                        try {
                                                                                                                            await supabase.from('key_results').delete().eq('id', child.id)
                                                                                                                            loadObjectivesData()
                                                                                                                        } catch (e) {
                                                                                                                            console.error(e)
                                                                                                                        }
                                                                                                                    }
                                                                                                                }}
                                                                                                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                                                                                                title={t('common.delete')}
                                                                                                            >
                                                                                                                <Trash2 className="w-3 h-3" />
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            )
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center py-4 rounded-xl border border-dashed border-purple-200 bg-purple-50/30">
                                                                                <p className="text-xs text-[var(--color-text-muted)]">
                                                                                    {t('okr.noKRs')}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Action Plan */}
                                                                    <ActionPlanList krId={kr.id} />
                                                                </div>
                                                            )
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="text-center py-6 bg-[var(--color-surface-subtle)]/30 rounded-lg border border-dashed border-[var(--color-border)]">
                                                        <p className="text-sm text-[var(--color-text-muted)] mb-2">
                                                            {t('okr.noKRs')}
                                                        </p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleAddKR(objective.id)}
                                                        >
                                                            {t('okr.addFirstKR')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-16">
                    <p className="text-[var(--color-text-muted)]">
                        {t('objectives.corporate.emptyState.title')}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                        <Trans
                            i18nKey="objectives.corporate.emptyState.description"
                            components={{ 1: <code className="px-2 py-1 rounded bg-[var(--color-surface-hover)] text-[var(--color-primary)]" /> }}
                        />
                    </p>
                </div>
            )}

            {/* Edit KR Modal */}
            <EditKRModalV2
                open={krModalOpen}
                onOpenChange={(open) => {
                    setKrModalOpen(open)
                    if (!open) setSelectedKR(null)
                }}
                onSave={loadObjectivesData}
                keyResult={selectedKR}
                objectives={pillarsData.flatMap(p => p.objectives).map(o => ({
                    id: o.id,
                    code: o.code,
                    title: o.title,
                    pillar: null,
                    business_unit: null
                }))}
                defaultObjectiveId={defaultObjectiveId}
            />

            {/* Edit Objective Modal */}
            <CreateObjectiveModalV2
                open={isEditingObjective}
                onOpenChange={(open) => {
                    setIsEditingObjective(open)
                    if (!open) setEditingObjective(null)
                }}
                onSave={loadObjectivesData}
                pillars={allPillars.map(p => ({ id: p.id, code: p.code, name: p.name, icon: p.icon || '', color: p.color }))}
                units={selectedUnit ? [{ id: selectedUnit, name: selectedUnitName, code: '' }] : []}
                objective={editingObjective ? {
                    id: editingObjective.id,
                    code: editingObjective.code,
                    title: editingObjective.title,
                    description: editingObjective.description,
                    pillar_id: editingObjective.pillar_id,
                    business_unit_id: selectedUnit,
                    year: 2026
                } : null}
            />
        </div>
    )
}
