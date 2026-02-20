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

            // 2. Load all tracking entries for these KRs and current year
            if (krs.length > 0) {
                const { data: trackingRows, error: trackingError } = await supabase
                    .from('kr_annual_tracking')
                    .select('*')
                    .in('kr_id', krs.map(k => k.id))
                    .eq('year', year)
                    .order('quarter')

                if (trackingError) throw trackingError
                setTrackingData((trackingRows || []) as KRTrackingEntry[])
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

    /** Upsert a tracking entry (insert or update by unique kr_id+year+quarter) */
    const upsertTracking = useCallback(async (
        krId: string,
        quarter: number,
        fields: { baseline?: number | null; target?: number | null; actual?: number | null; notes?: string | null }
    ) => {
        const existing = trackingData.find(e => e.kr_id === krId && e.quarter === quarter && e.year === year)
        const payload = {
            kr_id: krId,
            year,
            quarter,
            baseline: fields.baseline !== undefined ? fields.baseline : (existing?.baseline ?? null),
            target: fields.target !== undefined ? fields.target : (existing?.target ?? null),
            actual: fields.actual !== undefined ? fields.actual : (existing?.actual ?? null),
            notes: fields.notes !== undefined ? fields.notes : (existing?.notes ?? null),
        }

        const { data, error } = await supabase
            .from('kr_annual_tracking')
            .upsert(payload, { onConflict: 'kr_id,year,quarter' })
            .select()
            .single()

        if (error) throw error

        setTrackingData(prev => {
            const idx = prev.findIndex(e => e.kr_id === krId && e.quarter === quarter && e.year === year)
            if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = data as KRTrackingEntry
                return updated
            }
            return [...prev, data as KRTrackingEntry]
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
