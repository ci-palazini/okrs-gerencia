import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBusinessUnit } from '../contexts/BusinessUnitContext'
import { useQuarter } from './useQuarter'

// =====================================================
// TYPES
// =====================================================

export interface AnnualKRForTracking {
    id: string
    code: string
    title: string
    metric_type: string
    unit: string
    currency_type?: string | null
    target: number | null
    baseline: number | null
    target_direction: 'maximize' | 'minimize'
    objective_id: string
    objective: {
        id: string
        code: string
        title: string
        pillar_id: string
        pillar: {
            id: string
            name: string
            color: string
        } | null
    } | null
}

export interface KRTrackingEntry {
    id: string
    kr_id: string
    year: number
    quarter: number
    baseline: number | null
    target: number | null
    actual: number | null
    notes: string | null
}

// =====================================================
// HOOK
// =====================================================

export function useKRTracking() {
    const { selectedUnit } = useBusinessUnit()
    const { year } = useQuarter()

    const [annualKRs, setAnnualKRs] = useState<AnnualKRForTracking[]>([])
    const [trackingData, setTrackingData] = useState<KRTrackingEntry[]>([])
    const [loading, setLoading] = useState(true)

    const loadData = useCallback(async () => {
        if (!selectedUnit) return
        setLoading(true)
        try {
            // 1. Load annual KRs for the selected unit
            const { data: krsData, error: krsError } = await supabase
                .from('key_results')
                .select(`
                    id, code, title, metric_type, unit, currency_type, target, baseline, target_direction, objective_id,
                    objective:objectives!inner(
                        id, code, title, pillar_id, business_unit_id,
                        pillar:pillars(id, name, color)
                    )
                `)
                .eq('scope', 'annual')
                .eq('is_active', true)
                .eq('objective.business_unit_id', selectedUnit)
                .order('code')

            if (krsError) throw krsError

            const krs = (krsData || []) as unknown as AnnualKRForTracking[]
            setAnnualKRs(krs)

            // 2. Load all quarterly child KRs for these annual KRs
            if (krs.length > 0) {
                const { data: quarterlyKRs, error: trackingError } = await supabase
                    .from('key_results')
                    .select('id, parent_kr_id, quarter, baseline, target, actual, notes')
                    .in('parent_kr_id', krs.map(k => k.id))
                    .eq('scope', 'quarterly')
                    .order('quarter')

                if (trackingError) throw trackingError
                
                // Map KeyResult rows to KRTrackingEntry interface for UI compatibility
                const mappedEntries: KRTrackingEntry[] = (quarterlyKRs || []).map(q => ({
                    id: q.id,
                    kr_id: q.parent_kr_id!,
                    year: year, // Children KRs are for the same year
                    quarter: q.quarter!,
                    baseline: q.baseline,
                    target: q.target,
                    actual: q.actual,
                    notes: q.notes
                }))
                
                setTrackingData(mappedEntries)
            } else {
                setTrackingData([])
            }
        } catch (err) {
            console.error('Error loading KR tracking data:', err)
        } finally {
            setLoading(false)
        }
    }, [selectedUnit, year])

    useEffect(() => {
        loadData()
    }, [loadData])

    /** Update a quarterly KR entry */
    const upsertTracking = useCallback(async (
        krId: string, // This is the parent (annual) KR ID in the current state, or child ID if updated
        quarter: number,
        fields: { baseline?: number | null; target?: number | null; actual?: number | null; notes?: string | null }
    ) => {
        const existing = trackingData.find(e => e.kr_id === krId && e.quarter === quarter)
        
        if (!existing) {
            console.warn(`No quarterly KR found for annual KR ${krId} in quarter ${quarter}`)
            return
        }

        const payload: any = {
            updated_at: new Date().toISOString()
        }
        if (fields.baseline !== undefined) payload.baseline = fields.baseline
        if (fields.target !== undefined) payload.target = fields.target
        if (fields.actual !== undefined) payload.actual = fields.actual
        if (fields.notes !== undefined) payload.notes = fields.notes

        const { data, error } = await supabase
            .from('key_results')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single()

        if (error) throw error

        const updatedEntry: KRTrackingEntry = {
            id: data.id,
            kr_id: data.parent_kr_id,
            year: year,
            quarter: data.quarter,
            baseline: data.baseline,
            target: data.target,
            actual: data.actual,
            notes: data.notes
        }

        setTrackingData(prev => {
            const idx = prev.findIndex(e => e.id === data.id)
            if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = updatedEntry
                return updated
            }
            return [...prev, updatedEntry]
        })
    }, [year, trackingData])

    /** Get tracking entry for a specific KR + quarter */
    const getEntry = useCallback((krId: string, quarter: number): KRTrackingEntry | null => {
        return trackingData.find(e => e.kr_id === krId && e.quarter === quarter && e.year === year) ?? null
    }, [trackingData, year])

    return {
        annualKRs,
        trackingData,
        loading,
        year,
        loadData,
        upsertTracking,
        getEntry,
    }
}
