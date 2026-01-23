import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { UnitToggle } from '../../components/ui/UnitToggle'
import { PillarSection } from '../../components/okr/PillarSection'
import { KRTable } from '../../components/okr/KRTable'
import { EditKRModalV2 } from '../../components/okr/EditKRModalV2'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
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

export function OKRsPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [units, setUnits] = useState<BusinessUnit[]>([])
    const [selectedUnit, setSelectedUnit] = useState<string>('')
    const [pillars, setPillars] = useState<Pillar[]>([])
    const [objectives, setObjectives] = useState<Objective[]>([])
    const [objectivesWithRelations, setObjectivesWithRelations] = useState<ObjectiveWithRelations[]>([])
    const [keyResults, setKeyResults] = useState<KeyResult[]>([])
    const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([])
    const [currentQuarter] = useState(1) // Q1 2026

    // Modal state
    const [krModalOpen, setKrModalOpen] = useState(false)
    const [selectedKR, setSelectedKR] = useState<KeyResult | null>(null)
    const [defaultObjectiveId, setDefaultObjectiveId] = useState<string>('')

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedUnit) {
            loadOKRData()
        }
    }, [selectedUnit])

    async function loadInitialData() {
        try {
            // Load business units
            const { data: unitsData } = await supabase
                .from('business_units')
                .select('*')
                .eq('is_active', true)
                .neq('code', 'GSC')
                .order('order_index')

            if (unitsData && unitsData.length > 0) {
                setUnits(unitsData)
                setSelectedUnit(unitsData[0].id)
            }

            // Load pillars
            const { data: pillarsData } = await supabase
                .from('pillars')
                .select('*')
                .eq('is_active', true)
                .order('order_index')

            setPillars(pillarsData || [])
        } catch (error) {
            console.error('Error loading initial data:', error)
        }
    }

    async function loadOKRData() {
        setLoading(true)
        try {
            // Load objectives for selected unit
            const { data: objectivesData } = await supabase
                .from('objectives')
                .select('*')
                .eq('business_unit_id', selectedUnit)
                .eq('year', 2026)
                .eq('is_active', true)

            setObjectives(objectivesData || [])

            // Load objectives with relations for the modal
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
                .eq('year', 2026)
                .eq('is_active', true)

            setObjectivesWithRelations((objectivesWithRel || []) as unknown as ObjectiveWithRelations[])

            // Load key results for these objectives
            const objectiveIds = (objectivesData || []).map(o => o.id)

            if (objectiveIds.length > 0) {
                const { data: krsData } = await supabase
                    .from('key_results')
                    .select('*')
                    .in('objective_id', objectiveIds)
                    .eq('is_active', true)
                    .order('order_index')

                setKeyResults(krsData || [])

                // Load quarterly data for current quarter
                const krIds = (krsData || []).map(kr => kr.id)

                if (krIds.length > 0) {
                    const { data: quarterlyDataResult } = await supabase
                        .from('kr_quarterly_data')
                        .select('*')
                        .in('key_result_id', krIds)
                        .eq('quarter', currentQuarter)
                        .eq('year', 2026)

                    setQuarterlyData(quarterlyDataResult || [])
                }
            } else {
                setKeyResults([])
                setQuarterlyData([])
            }
        } catch (error) {
            console.error('Error loading OKR data:', error)
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
        if (!confirm('Tem certeza que deseja excluir este Key Result?')) return

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
            loadOKRData()
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
        loadOKRData()
    }

    // Get KRs for a specific pillar
    function getKRsForPillar(pillarId: string) {
        const pillarObjectives = objectives.filter(o => o.pillar_id === pillarId)
        const objectiveIds = pillarObjectives.map(o => o.id)

        return keyResults
            .filter(kr => objectiveIds.includes(kr.objective_id))
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
    }

    // Get objective for a pillar
    function getObjectiveForPillar(pillarId: string) {
        return objectives.find(o => o.pillar_id === pillarId)
    }

    const selectedUnitName = units.find(u => u.id === selectedUnit)?.name || ''

    if (loading && units.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">Carregando dados...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">OKRs 2026</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        Objetivos e Key Results - {selectedUnitName}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <UnitToggle
                        units={units}
                        selectedUnit={selectedUnit}
                        onSelect={setSelectedUnit}
                    />
                    <Badge variant="info" size="md">
                        Q{currentQuarter} 2026
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadOKRData}
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
                <div className="space-y-4">
                    {pillars.map((pillar) => {
                        const pillarKRs = getKRsForPillar(pillar.id)
                        const objective = getObjectiveForPillar(pillar.id)

                        return (
                            <PillarSection
                                key={pillar.id}
                                pillar={{
                                    ...pillar,
                                    description: objective?.title || pillar.description
                                }}
                                actions={
                                    objective && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleAddKR(objective.id)
                                            }}
                                        >
                                            <Plus className="w-4 h-4" />
                                            Novo KR
                                        </Button>
                                    )
                                }
                            >
                                {pillarKRs.length > 0 ? (
                                    <KRTable
                                        keyResults={pillarKRs}
                                        onUpdateConfidence={updateConfidence}
                                        onUpdateValue={updateValue}
                                        onEdit={handleEditKR}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-[var(--color-text-muted)]">
                                        <p>Nenhum Key Result cadastrado para este pilar.</p>
                                        {objective && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-4"
                                                onClick={() => handleAddKR(objective.id)}
                                            >
                                                <Plus className="w-4 h-4" />
                                                Adicionar KR
                                            </Button>
                                        )}
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
                        Nenhum pilar cadastrado. Execute o script seed.sql no Supabase para popular os dados.
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
        </div>
    )
}
