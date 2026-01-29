import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { RefreshCw, Target, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { QuarterlyCard } from '../../components/okr/QuarterlyCard'
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
    business_unit_id: string | null
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
    metric_type: string
    objective_id: string
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
    const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([])
    const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set())
    const [currentQuarter] = useState(1) // Q1 2026

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
            // Get all pillars
            const { data: pillarsResult } = await supabase
                .from('pillars')
                .select('*')
                .eq('is_active', true)
                .order('order_index')

            if (!pillarsResult || pillarsResult.length === 0) {
                setLoading(false)
                return
            }

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
                setQuarterlyData([])
                setLoading(false)
                return
            }

            // Get KRs for these objectives
            const objectiveIds = objectivesData.map(o => o.id)
            const { data: krsData } = await supabase
                .from('key_results')
                .select('*')
                .in('objective_id', objectiveIds)
                .eq('is_active', true)
                .order('order_index')

            // Get quarterly data for all KRs
            const krIds = (krsData || []).map(kr => kr.id)
            if (krIds.length > 0) {
                const { data: quarterlyDataResult } = await supabase
                    .from('kr_quarterly_data')
                    .select('*')
                    .in('key_result_id', krIds)
                    .eq('year', 2026)
                    .order('quarter')

                setQuarterlyData(quarterlyDataResult || [])
            }

            // Group objectives by pillar with their KRs
            const relevantPillars = pillarsResult.filter(p => !p.business_unit_id || p.business_unit_id === selectedUnit)

            const pillarsWithData: PillarWithObjectives[] = relevantPillars.map(pillar => {
                const pillarObjectives = objectivesData.filter(o => o.pillar_id === pillar.id)
                const objectivesWithKRs = pillarObjectives.map(obj => ({
                    ...obj,
                    key_results: (krsData || []).filter(kr => kr.objective_id === obj.id)
                }))

                return {
                    ...pillar,
                    objectives: objectivesWithKRs
                }
            }).filter(p => p.objectives.length > 0)

            setPillarsData(pillarsWithData)

            // Expand all pillars by default
            setExpandedPillars(new Set(pillarsWithData.map(p => p.id)))

        } catch (error) {
            console.error('Error loading objectives data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateQuarterly(quarterId: string, field: string, value: any) {
        setSaving(true)
        try {
            const updateData: Record<string, any> = {}
            updateData[field] = value

            // Get current data for audit log
            const currentRecord = quarterlyData.find(q => q.id === quarterId)

            const { error } = await supabase
                .from('kr_quarterly_data')
                .update(updateData)
                .eq('id', quarterId)

            if (error) throw error

            // Create audit log
            if (user && currentRecord) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'kr_quarterly_data',
                    entity_id: quarterId,
                    entity_name: `Q${currentRecord.quarter} - ${field}`,
                    old_value: { [field]: currentRecord[field as keyof QuarterlyData] },
                    new_value: { [field]: value }
                })
            }

            // Update local state
            setQuarterlyData(prev =>
                prev.map(q => q.id === quarterId ? { ...q, [field]: value } : q)
            )

            // Refetch to get calculated progress
            if (['baseline', 'target', 'actual'].includes(field)) {
                const { data: updatedData } = await supabase
                    .from('kr_quarterly_data')
                    .select('*')
                    .eq('id', quarterId)
                    .single()

                if (updatedData) {
                    setQuarterlyData(prev =>
                        prev.map(q => q.id === quarterId ? updatedData : q)
                    )
                }
            }
        } catch (error) {
            console.error('Error updating quarterly data:', error)
        } finally {
            setSaving(false)
        }
    }

    async function handleUpdateKeyResult(krId: string, field: string, value: any) {
        setSaving(true)
        try {
            const updateData: Record<string, any> = {}
            updateData[field] = value

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
                    entity_type: 'key_result',
                    entity_id: krId,
                    entity_name: `KR ${field}`,
                    old_value: {},
                    new_value: { [field]: value }
                })
            }

            // Reload data to reflect changes
            loadObjectivesData()
        } catch (error) {
            console.error('Error updating key result:', error)
        } finally {
            setSaving(false)
        }
    }

    // Get quarterly data for a specific KR
    function getQuarterlyDataForKR(krId: string): QuarterlyData[] {
        return [1, 2, 3, 4].map(quarter => {
            const existing = quarterlyData.find(q => q.key_result_id === krId && q.quarter === quarter)
            return existing || {
                id: '',
                key_result_id: krId,
                quarter,
                baseline: null,
                target: null,
                actual: null,
                progress: null,
                confidence: null as unknown as ConfidenceLevel
            }
        })
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
                                    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)]/30 p-5 space-y-6">
                                        {pillar.objectives.map((objective) => (
                                            <div key={objective.id} className="space-y-4">
                                                {/* Objective Title */}
                                                <div className="flex items-start gap-3 px-2">
                                                    <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-sm border border-[var(--color-primary)]/20">
                                                        {objective.code}
                                                    </span>
                                                    <div>
                                                        <h3 className="font-semibold text-[var(--color-text-primary)]">
                                                            {objective.title}
                                                        </h3>
                                                        {objective.description && (
                                                            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                                                                {objective.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Key Results */}
                                                <div className="space-y-4 pl-4">
                                                    {objective.key_results.map((kr) => (
                                                        <QuarterlyCard
                                                            key={kr.id}
                                                            keyResult={kr}
                                                            quarterlyData={getQuarterlyDataForKR(kr.id)}
                                                            currentQuarter={currentQuarter}
                                                            onUpdate={handleUpdateQuarterly}
                                                            onUpdateKeyResult={handleUpdateKeyResult}
                                                            editable={true}
                                                        />
                                                    ))}
                                                </div>
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
        </div>
    )
}
