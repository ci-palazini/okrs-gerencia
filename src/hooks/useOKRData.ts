import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useBusinessUnit } from '../contexts/BusinessUnitContext'
import { useQuarter } from './useQuarter'
import type { ConfidenceLevel } from '../types'

// =====================================================
// TYPES
// =====================================================

export interface Pillar {
    id: string
    code: string
    name: string
    description: string
    icon: string
    color: string
    order_index: number
    business_unit_ids?: string[]
}

export interface Objective {
    id: string
    code: string
    title: string
    description: string | null
    pillar_id: string
    business_unit_id: string
    year: number
}

export interface KeyResult {
    id: string
    code: string
    title: string
    owner_name: string | null
    source: string | null
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    unit: string
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

export interface ObjectiveWithKRs extends Objective {
    key_results: KeyResult[]
    pillar: Pillar
    progress: number
}

export interface ObjectiveWithRelations {
    id: string
    code: string
    title: string
    pillar: { id: string; name: string; color: string } | null
    business_unit: { id: string; name: string } | null
}

// =====================================================
// HOOK
// =====================================================

export function useOKRData(filterPillar?: string | null) {
    const { user } = useAuth()
    const { selectedUnit, selectedUnitData } = useBusinessUnit()
    const { quarter: currentQuarter, setQuarter: setCurrentQuarter, year } = useQuarter()

    // Data state
    const [pillars, setPillars] = useState<Pillar[]>([])
    const [objectives, setObjectives] = useState<ObjectiveWithKRs[]>([])
    const [objectivesWithRelations, setObjectivesWithRelations] = useState<ObjectiveWithRelations[]>([])
    const [annualKRs, setAnnualKRs] = useState<KeyResult[]>([])
    const [allKRs, setAllKRs] = useState<KeyResult[]>([])
    const [loading, setLoading] = useState(true)

    // =====================================================
    // DATA LOADING
    // =====================================================

    const loadData = useCallback(async () => {
        if (!selectedUnit) return
        setLoading(true)
        try {
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
                .select(`*, pillar:pillars(*), key_results(*)`)
                .eq('is_active', true)
                .eq('business_unit_id', selectedUnit)
                .eq('year', year)

            if (filterPillar) {
                objectivesQuery = objectivesQuery.eq('pillar_id', filterPillar)
            }

            const { data: objectivesData, error: objError } = await objectivesQuery
            if (objError) throw objError

            const processedObjectives = (objectivesData || []).map(obj => ({
                ...obj,
                progress: 0 // Placeholder — calculated from quarterly KRs
            }))

            setObjectives(processedObjectives as unknown as ObjectiveWithKRs[])

            // 3. Load objectives with relations (for modals)
            const { data: objectivesWithRel } = await supabase
                .from('objectives')
                .select(`id, code, title, pillar:pillars(id, name, color), business_unit:business_units(id, name)`)
                .eq('business_unit_id', selectedUnit)
                .eq('year', year)
                .eq('is_active', true)

            setObjectivesWithRelations((objectivesWithRel || []) as unknown as ObjectiveWithRelations[])

            // 4. Load all Key Results (annual + quarterly)
            const objectiveIds = (objectivesData || []).map(o => o.id)

            if (objectiveIds.length > 0) {
                const { data: krsData } = await supabase
                    .from('key_results')
                    .select('*')
                    .in('objective_id', objectiveIds)
                    .eq('is_active', true)
                    .order('order_index')

                const allKRsData = krsData || []
                setAllKRs(allKRsData)
                setAnnualKRs(allKRsData.filter(kr => kr.scope === 'annual'))
            } else {
                setAnnualKRs([])
                setAllKRs([])
            }
        } catch (error) {
            console.error('Error loading OKR data:', error)
        } finally {
            setLoading(false)
        }
    }, [selectedUnit, filterPillar, year])

    useEffect(() => {
        if (selectedUnit) {
            loadData()
        }
    }, [selectedUnit, filterPillar, currentQuarter, loadData])

    // =====================================================
    // HELPERS
    // =====================================================

    /** Get quarterly children for an annual KR, sorted by quarter */
    const getChildKRs = useCallback((parentKrId: string): KeyResult[] => {
        return allKRs
            .filter(kr => kr.parent_kr_id === parentKrId && kr.scope === 'quarterly')
            .sort((a, b) => (a.quarter ?? 0) - (b.quarter ?? 0))
    }, [allKRs])

    /** Get KRs for a specific objective (annual only) */
    const getObjectiveKRs = useCallback((objectiveId: string): KeyResult[] => {
        return annualKRs.filter(kr => kr.objective_id === objectiveId)
    }, [annualKRs])

    /** Get pillars visible for the current unit */
    const getVisiblePillars = useCallback((): Pillar[] => {
        return pillars.filter(p => {
            const ids = p.business_unit_ids || []
            return ids.includes(selectedUnit)
        })
    }, [pillars, selectedUnit])

    /** Format a value based on metric type */
    const formatValue = useCallback((v: number | null, metricType: string, unit: string): string => {
        if (v === null) return '-'
        if (metricType === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
        if (metricType === 'percentage') return `${v}%`
        return `${v}${unit ? ` ${unit}` : ''}`
    }, [])

    /** Calculate progress respecting target_direction and baseline */
    const calculateProgress = useCallback((
        target: number | null,
        actual: number | null,
        direction: 'maximize' | 'minimize' = 'maximize',
        baseline: number | null = null
    ): number | null => {
        if (target === null || actual === null) return null

        // With baseline: measure progress from starting point to target
        if (baseline !== null) {
            if (direction === 'minimize') {
                // (baseline - actual) / (baseline - target) × 100
                const denominator = baseline - target
                if (denominator === 0) return null
                return Math.round(((baseline - actual) / denominator) * 100)
            } else {
                // (actual - baseline) / (target - baseline) × 100
                const denominator = target - baseline
                if (denominator === 0) return null
                return Math.round(((actual - baseline) / denominator) * 100)
            }
        }

        // Fallback (no baseline): original formula
        if (target === 0) return null
        if (direction === 'minimize') {
            if (actual === 0) return null
            return Math.round((target / actual) * 100)
        }
        return Math.round((actual / target) * 100)
    }, [])

    // =====================================================
    // CUD OPERATIONS
    // =====================================================

    const updateConfidence = useCallback(async (krId: string, confidence: ConfidenceLevel) => {
        try {
            const kr = allKRs.find(k => k.id === krId)
            const { error } = await supabase
                .from('key_results')
                .update({ confidence })
                .eq('id', krId)

            if (!error) {
                setAllKRs(prev => prev.map(k => k.id === krId ? { ...k, confidence } : k))
                setAnnualKRs(prev => prev.map(k => k.id === krId ? { ...k, confidence } : k))

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
            }
        } catch (error) {
            console.error('Error updating confidence:', error)
        }
    }, [allKRs, user])

    const updateValue = useCallback(async (krId: string, field: 'baseline' | 'target' | 'actual', value: number | null) => {
        try {
            const kr = allKRs.find(k => k.id === krId)
            if (!kr) return

            const updateData: Record<string, any> = { [field]: value }

            // Calculate and save progress
            if (field === 'target' || field === 'actual' || field === 'baseline') {
                const newTarget = field === 'target' ? value : kr.target
                const newActual = field === 'actual' ? value : kr.actual
                const newBaseline = field === 'baseline' ? value : kr.baseline
                updateData.progress = calculateProgress(newTarget, newActual, kr.target_direction ?? 'maximize', newBaseline)
            }

            const { error } = await supabase
                .from('key_results')
                .update(updateData)
                .eq('id', krId)

            if (error) throw error

            // Audit log
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

            // Refetch updated data
            const { data: updatedData } = await supabase
                .from('key_results')
                .select('*')
                .eq('id', krId)
                .single()

            if (updatedData) {
                setAllKRs(prev => prev.map(k => k.id === krId ? updatedData : k))
                setAnnualKRs(prev => prev.map(k => k.id === krId ? { ...k, ...updatedData } : k))
            }
        } catch (error) {
            console.error('Error updating value:', error)
        }
    }, [allKRs, user, calculateProgress])

    const deleteKR = useCallback(async (krId: string) => {
        try {
            const kr = allKRs.find(k => k.id === krId)
            const { error } = await supabase
                .from('key_results')
                .delete()
                .eq('id', krId)

            if (error) throw error

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

            loadData()
        } catch (error) {
            console.error('Error deleting KR:', error)
        }
    }, [allKRs, user, loadData])

    const deleteObjective = useCallback(async (objectiveId: string) => {
        try {
            const { error } = await supabase
                .from('objectives')
                .delete()
                .eq('id', objectiveId)

            if (error) throw error
            loadData()
        } catch (error) {
            console.error('Error deleting objective:', error)
        }
    }, [loadData])

    return {
        // Data
        pillars,
        objectives,
        objectivesWithRelations,
        annualKRs,
        allKRs,
        loading,

        // Quarter
        currentQuarter,
        setCurrentQuarter,
        year,

        // Unit
        selectedUnit,
        selectedUnitData,

        // Helpers
        getChildKRs,
        getObjectiveKRs,
        getVisiblePillars,
        formatValue,
        calculateProgress,

        // Operations
        updateConfidence,
        updateValue,
        deleteKR,
        deleteObjective,
        loadData,
    }
}
