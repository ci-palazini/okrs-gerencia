import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw, Trash2, Target, ChevronDown, ChevronUp, MoreHorizontal, Pencil, ArrowRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { PillarSection } from '../../components/okr/PillarSection'
import { KRTable } from '../../components/okr/KRTable'
import { EditKRModalV2 } from '../../components/okr/EditKRModalV2'
import { CreateObjectiveModalV2 } from '../../components/okr/CreateObjectiveModalV2'
import { ActionPlanList } from '../../components/okr/ActionPlanList'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { useQuarter } from '../../hooks/useQuarter'
import { QuarterSelector } from '../../components/ui/QuarterSelector'
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
    description: string
    icon: string
    color: string
    order_index: number
    business_unit_ids?: string[]
}

interface KeyResult {
    id: string
    code: string
    title: string
    owner_name: string | null
    source: string | null
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    unit: string
    objective_id: string
}

interface Objective {
    id: string
    code: string
    title: string
    description: string | null
    pillar_id: string
    business_unit_id: string
}

interface ObjectiveWithRelations {
    id: string
    code: string
    title: string
    pillar: {
        id: string
        name: string
        color: string
    } | null
    business_unit: {
        id: string
        name: string
    } | null
}

interface ObjectiveWithKRs extends Objective {
    key_results: KeyResult[]
    pillar: Pillar
    progress: number
}

interface QuarterlyData {
    id: string
    key_result_id: string
    quarter: number
    baseline: number | null
    target: number | null
    actual: number | null
    progress: number | null
    confidence: ConfidenceLevel
}

// Helper function to calculate objective progress (placeholder, implement actual logic)
function calculateObjectiveProgress(keyResults: KeyResult[] | null): number {
    if (!keyResults || keyResults.length === 0) return 0
    // This is a placeholder. In a real app, you'd fetch quarterly data for each KR
    // and calculate an aggregate progress based on baseline, target, actual, and weights.
    // For now, let's just return a dummy value or average of some KR progress if available.
    return 0 // Or some actual calculation based on your data model
}

export function OKRsPage() {
    const { user } = useAuth()
    const { t } = useTranslation()
    const { selectedUnit, selectedUnitData } = useBusinessUnit() // Use global context
    const [searchParams] = useSearchParams()

    // UI State
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'krs' | 'dashboard'>('overview')
    const [filterPillar, setFilterPillar] = useState<string | null>(searchParams.get('pillar'))

    // Data State
    const [pillars, setPillars] = useState<Pillar[]>([])
    const [objectives, setObjectives] = useState<ObjectiveWithKRs[]>([])
    const [objectivesWithRelations, setObjectivesWithRelations] = useState<ObjectiveWithRelations[]>([])
    const [keyResults, setKeyResults] = useState<KeyResult[]>([])
    const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([])
    const { quarter: currentQuarter, setQuarter: setCurrentQuarter, year } = useQuarter()

    // Modal state
    const [krModalOpen, setKrModalOpen] = useState(false)
    const [selectedKR, setSelectedKR] = useState<KeyResult | null>(null)
    const [defaultObjectiveId, setDefaultObjectiveId] = useState<string>('')

    // Create modal states
    const [isCreatingObjective, setIsCreatingObjective] = useState(false)
    const [isCreatingKR, setIsCreatingKR] = useState(false)
    const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null)

    useEffect(() => {
        if (selectedUnit) {
            loadData()
        }
    }, [selectedUnit, filterPillar, currentQuarter])

    useEffect(() => {
        setFilterPillar(searchParams.get('pillar'))
    }, [searchParams])

    async function loadData() {
        setLoading(true)
        try {
            // 1. Load pillars
            // 1. Load pillars and associations
            const [pillarsRes, pivotRes] = await Promise.all([
                supabase.from('pillars').select('*').eq('is_active', true).order('order_index'),
                supabase.from('pillar_business_units').select('*')
            ])

            let pillarsData = pillarsRes.data || []
            const pivotData = pivotRes.data || []

            if (pillarsData.length > 0 && pivotData.length > 0) {
                pillarsData = pillarsData.map(p => ({
                    ...p,
                    business_unit_ids: pivotData
                        .filter((r: any) => r.pillar_id === p.id)
                        .map((r: any) => r.business_unit_id)
                }))
            }

            setPillars(pillarsData)

            // 2. Load Objectives for selected unit
            let objectivesQuery = supabase
                .from('objectives')
                .select(`
                    *,
                    pillar:pillars(*),
                    key_results(*)
                `)
                .eq('is_active', true)
                .eq('business_unit_id', selectedUnit)
                .eq('year', year)

            if (filterPillar) {
                objectivesQuery = objectivesQuery.eq('pillar_id', filterPillar)
            }

            const { data: objectivesData, error: objError } = await objectivesQuery
            if (objError) throw objError

            // Map progress (placeholder calculation)
            const processedObjectives = (objectivesData || []).map(obj => ({
                ...obj,
                progress: calculateObjectiveProgress(obj.key_results || [])
            }))

            setObjectives(processedObjectives as unknown as ObjectiveWithKRs[])

            // 3. Load objectives with relations (for modals)
            const { data: objectivesWithRel } = await supabase
                .from('objectives')
                .select(`
                    id,
                    code,
                    title,
                    pillar:pillars(id, name, color),
                    business_unit:business_units(id, name)
                `)
                .eq('business_unit_id', selectedUnit)
                .eq('year', year)
                .eq('is_active', true)

            setObjectivesWithRelations((objectivesWithRel || []) as unknown as ObjectiveWithRelations[])

            // 4. Load Key Results and Quarterly Data
            const objectiveIds = (objectivesData || []).map(o => o.id)

            if (objectiveIds.length > 0) {
                const { data: krsData } = await supabase
                    .from('key_results')
                    .select('*')
                    .in('objective_id', objectiveIds)
                    .eq('is_active', true)
                    .order('order_index')

                setKeyResults(krsData || [])

                const krIds = (krsData || []).map(kr => kr.id)
                if (krIds.length > 0) {
                    const { data: qData } = await supabase
                        .from('kr_quarterly_data')
                        .select('*')
                        .in('key_result_id', krIds)
                        .eq('quarter', currentQuarter)
                        .eq('year', year)

                    setQuarterlyData(qData || [])
                } else {
                    setQuarterlyData([])
                }
            } else {
                setKeyResults([])
                setQuarterlyData([])
            }

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function updateConfidence(krId: string, confidence: ConfidenceLevel) {
        try {
            const qData = quarterlyData.find(q => q.key_result_id === krId)

            if (qData) {
                const { error } = await supabase
                    .from('kr_quarterly_data')
                    .update({ confidence })
                    .eq('id', qData.id)

                if (!error) {
                    setQuarterlyData(prev =>
                        prev.map(q => q.id === qData.id ? { ...q, confidence } : q)
                    )

                    // Audit log
                    const kr = keyResults.find(k => k.id === krId)
                    if (user && kr) {
                        await supabase.from('audit_logs').insert({
                            user_id: user.id,
                            user_email: user.email,
                            action: 'update',
                            entity_type: 'kr_quarterly_data',
                            entity_id: qData.id,
                            entity_name: `${kr.title} (Q${qData.quarter}) - confidence`,
                            old_value: { confidence: qData.confidence },
                            new_value: { confidence }
                        })
                    }
                }
            }
        } catch (error) {
            console.error('Error updating confidence:', error)
        }
    }

    async function updateValue(krId: string, field: 'baseline' | 'target' | 'actual', value: number | null) {
        try {
            const qData = quarterlyData.find(q => q.key_result_id === krId)

            if (qData) {
                const updateData: Record<string, any> = {}
                updateData[field] = value

                const { error } = await supabase
                    .from('kr_quarterly_data')
                    .update(updateData)
                    .eq('id', qData.id)

                if (error) throw error

                // Audit log
                const kr = keyResults.find(k => k.id === krId)
                if (user && kr) {
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        user_email: user.email,
                        action: 'update',
                        entity_type: 'kr_quarterly_data',
                        entity_id: qData.id,
                        entity_name: `${kr.title} (Q${qData.quarter}) - ${field}`,
                        old_value: { [field]: qData[field] },
                        new_value: { [field]: value }
                    })
                }

                // Refetch to get calculated progress
                const { data: updatedData } = await supabase
                    .from('kr_quarterly_data')
                    .select('*')
                    .eq('id', qData.id)
                    .single()

                if (updatedData) {
                    setQuarterlyData(prev =>
                        prev.map(q => q.id === qData.id ? updatedData : q)
                    )
                }
            }
        } catch (error) {
            console.error('Error updating value:', error)
        }
    }

    async function deleteKR(krId: string) {
        if (!confirm(t('okr.deleteKRConfirm'))) return


        try {
            const kr = keyResults.find(k => k.id === krId)

            // Soft delete - set is_active to false
            const { error } = await supabase
                .from('key_results')
                .update({ is_active: false })
                .eq('id', krId)

            if (error) throw error

            // Audit log
            if (user && kr) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'delete',
                    entity_type: 'key_results',
                    entity_id: krId,
                    entity_name: kr.title
                })
            }

            // Reload data
            loadData()
        } catch (error) {
            console.error('Error deleting KR:', error)
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

    function handleKRSaved() {
        loadData()
    }

    if (loading && !selectedUnitData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('okr.loadingData')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                        {t('okr.title')} - {selectedUnitData?.name || t('okr.local')}
                    </h1>
                    <p className="text-[var(--color-text-secondary)]">
                        {t('okr.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => setIsCreatingObjective(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('okr.newObjective')}
                    </Button>
                    <QuarterSelector
                        quarter={currentQuarter}
                        onSelect={setCurrentQuarter}
                    />
                    <Badge variant="info" size="md">
                        {year}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Pillars */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-8">
                    {pillars
                        .filter(pillar => {
                            // Filter by selected unit (if pillar has specific assignments)
                            // If pillar.business_unit_ids is empty/undefined -> It's NOT global anymore (migration logic). 
                            // Wait, in my migration: "Global" became "All Units".
                            // So business_unit_ids should NOT be empty for active pillars if they are global.
                            // But if it IS empty, it means it's assigned to NO ONE? Or Global?
                            // Let's assume: if business_unit_ids is present and length > 0, check if includes selectedUnit.
                            // If missing or empty? In new logic, explicit assignment is preferred.
                            // But `Sidebar` logic was: `isMapped = pivotData.some(...)`.
                            // So here: `pillar.business_unit_ids?.includes(selectedUnit)`

                            // Safety check
                            const ids = pillar.business_unit_ids || []
                            return ids.includes(selectedUnit)
                        })
                        .filter(pillar => !filterPillar || pillar.id === filterPillar)
                        .map((pillar) => {
                            const pillarObjectives = objectives.filter(o => o.pillar_id === pillar.id)

                            return (
                                <PillarSection
                                    key={pillar.id}
                                    pillar={pillar}
                                    actions={
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setIsCreatingObjective(true)
                                            }}
                                        >
                                            <Target className="w-4 h-4 mr-2" />
                                            {t('okr.newObjective')}
                                        </Button>
                                    }
                                >
                                    {pillarObjectives.length > 0 ? (
                                        <div className="space-y-8">
                                            {pillarObjectives.map((objective, index) => {
                                                const objectiveKRs = keyResults
                                                    .filter(kr => kr.objective_id === objective.id)
                                                    .map(kr => {
                                                        const qData = quarterlyData.find(q => q.key_result_id === kr.id)
                                                        return {
                                                            ...kr,
                                                            progress: qData?.progress || 0,
                                                            confidence: qData?.confidence || null,
                                                            baseline: qData?.baseline,
                                                            target: qData?.target,
                                                            actual: qData?.actual
                                                        }
                                                    })

                                                return (
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
                                                                    className="h-8 w-8 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                                                    title={t('common.delete')}
                                                                    onClick={async () => {
                                                                        if (window.confirm(t('okr.deleteObjectiveConfirm'))) {
                                                                            try {
                                                                                const { error } = await supabase
                                                                                    .from('objectives')
                                                                                    .delete()
                                                                                    .eq('id', objective.id)

                                                                                if (error) throw error
                                                                                loadData()
                                                                            } catch (error) {
                                                                                console.error('Error deleting objective:', error)
                                                                                alert(t('okr.deleteObjectiveError'))
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
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
                                                        {objectiveKRs.length > 0 ? (
                                                            <KRTable
                                                                keyResults={objectiveKRs}
                                                                onUpdateConfidence={updateConfidence}
                                                                onUpdateValue={updateValue}
                                                                onEdit={handleEditKR}
                                                                onDelete={async (krId) => {
                                                                    try {
                                                                        // Hard delete now that we have cascade enabled and permission
                                                                        const { error } = await supabase
                                                                            .from('key_results')
                                                                            .delete()
                                                                            .eq('id', krId)

                                                                        if (error) throw error
                                                                        handleKRSaved()
                                                                    } catch (error) {
                                                                        console.error('Error deleting KR:', error)
                                                                        alert(t('okr.deleteKRError'))
                                                                    }
                                                                }}
                                                                renderExpandedRow={(kr) => (
                                                                    <ActionPlanList krId={kr.id} />
                                                                )}
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
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-[var(--color-text-muted)]">
                                            <p>{t('okr.noObjectives')}</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-4"
                                                onClick={() => setIsCreatingObjective(true)}
                                            >
                                                <Target className="w-4 h-4 mr-2" />
                                                {t('okr.defineFirstObjective')}
                                            </Button>
                                        </div>
                                    )}
                                </PillarSection>
                            )
                        })}
                </div>
            )}

            {pillars.length === 0 && !loading && (
                <div className="text-center py-16">
                    <p className="text-[var(--color-text-muted)] mb-4">
                        {t('okr.noPillars')}
                    </p>
                </div>
            )}

            {/* Edit/Create KR Modal */}
            <EditKRModalV2
                open={krModalOpen}
                onOpenChange={setKrModalOpen}
                onSave={handleKRSaved}
                keyResult={selectedKR}
                objectives={objectivesWithRelations}
                defaultObjectiveId={defaultObjectiveId}
            />

            <CreateObjectiveModalV2
                open={isCreatingObjective}
                onOpenChange={setIsCreatingObjective}
                onSave={handleKRSaved}
                pillars={pillars}
                units={selectedUnit ? [{ id: selectedUnit, name: selectedUnitData?.name || '', code: '' }] : []} // Pass current unit
                defaultPillarId={filterPillar || undefined} // Pre-select pillar if filtered
            />
        </div>
    )
}
