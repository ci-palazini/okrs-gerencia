import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useBusinessUnit } from '../contexts/BusinessUnitContext'
import { calculateKRProgress } from '../lib/okr'
import type { CascadeKeyResult, CascadeObjective, CascadeMonthlyEntry, CascadePillar } from './useCascadeOKRData'

/**
 * Loads annual KRs (scope = 'annual') for the selected business unit + year, together with their
 * monthly tracking rows from kr_monthly_data.
 *
 * Unlike useCascadeOKRData (which only tracks monthly data on leaf nodes), this hook fetches the
 * monthly series directly for the annual KRs — so an annual KR keeps its own monthly chart even
 * when it has quarterly children.
 *
 * `upsertMonthly` is the core of the monthly tracking page: after saving a month it syncs the KR's
 * `actual` (and recomputed `progress`) to the most recent month that has a reported value — i.e.
 * the "valor real atual" always reflects the last reported month.
 */
export function useAnnualMonthlyTracking() {
    const { user } = useAuth()
    const { selectedUnit, selectedUnitData } = useBusinessUnit()

    const [year, setYear] = useState<number>(new Date().getFullYear())
    const [pillars, setPillars] = useState<CascadePillar[]>([])
    const [objectives, setObjectives] = useState<CascadeObjective[]>([])
    const [annualKRs, setAnnualKRs] = useState<CascadeKeyResult[]>([])
    const [monthlyEntries, setMonthlyEntries] = useState<CascadeMonthlyEntry[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    const loadData = useCallback(async () => {
        if (!selectedUnit) {
            setPillars([])
            setObjectives([])
            setAnnualKRs([])
            setMonthlyEntries([])
            return
        }

        setLoading(true)

        try {
            const { data: pillarsData } = await supabase
                .from('pillars')
                .select('*')
                .eq('is_active', true)
                .eq('business_unit_id', selectedUnit)
                .order('order_index')

            setPillars((pillarsData || []) as CascadePillar[])

            const { data: objectivesData, error: objectivesError } = await supabase
                .from('objectives')
                .select('*')
                .eq('is_active', true)
                .eq('business_unit_id', selectedUnit)
                .eq('year', year)
                .order('code')

            if (objectivesError) throw objectivesError

            const typedObjectives = ((objectivesData || []) as CascadeObjective[])
                .sort((a, b) => {
                    const numA = parseInt(a.code.split('-').pop() || '0', 10)
                    const numB = parseInt(b.code.split('-').pop() || '0', 10)
                    return numA - numB
                })
            setObjectives(typedObjectives)

            const objectiveIds = typedObjectives.map((objective) => objective.id)
            if (objectiveIds.length === 0) {
                setAnnualKRs([])
                setMonthlyEntries([])
                return
            }

            const { data: krsData, error: krsError } = await supabase
                .from('key_results')
                .select('*')
                .in('objective_id', objectiveIds)
                .eq('is_active', true)
                .eq('scope', 'annual')
                .order('order_index')

            if (krsError) throw krsError
            const typedKRs = (krsData || []) as CascadeKeyResult[]
            setAnnualKRs(typedKRs)

            if (typedKRs.length === 0) {
                setMonthlyEntries([])
                return
            }

            const krIds = typedKRs.map((kr) => kr.id)
            const { data: monthlyData, error: monthlyError } = await supabase
                .from('kr_monthly_data')
                .select('id,key_result_id,month,year,actual,notes')
                .in('key_result_id', krIds)
                .eq('year', year)
                .order('month', { ascending: true })

            if (monthlyError) throw monthlyError
            setMonthlyEntries((monthlyData || []) as CascadeMonthlyEntry[])
        } catch (error) {
            console.error('Error loading annual monthly tracking data:', error)
        } finally {
            setLoading(false)
        }
    }, [selectedUnit, year])

    useEffect(() => {
        if (selectedUnit) {
            loadData()
        }
    }, [selectedUnit, loadData])

    const updateValue = useCallback(async (
        krId: string,
        field: 'baseline' | 'target',
        value: number | null
    ) => {
        try {
            const kr = annualKRs.find((item) => item.id === krId)
            if (!kr) return

            const nextTarget = field === 'target' ? value : kr.target
            const nextBaseline = field === 'baseline' ? value : kr.baseline
            const nextProgress = calculateKRProgress(nextTarget, kr.actual, kr.target_direction, nextBaseline)

            const patch = { [field]: value, progress: nextProgress } as Partial<CascadeKeyResult>

            const { error } = await supabase
                .from('key_results')
                .update(patch)
                .eq('id', krId)

            if (error) throw error

            setAnnualKRs((prev) => prev.map((item) => (
                item.id === krId ? { ...item, ...patch } : item
            )))

            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'key_results',
                    entity_id: krId,
                    entity_name: `${kr.title} - ${field}`,
                    old_value: { [field]: kr[field], progress: kr.progress },
                    new_value: { [field]: value, progress: nextProgress },
                })
            }
        } catch (error) {
            console.error('Error updating KR value:', error)
        }
    }, [annualKRs, user])

    const getMonthlyEntry = useCallback((krId: string, month: number): CascadeMonthlyEntry | null => {
        return monthlyEntries.find((entry) => (
            entry.key_result_id === krId
            && entry.month === month
            && entry.year === year
        )) || null
    }, [monthlyEntries, year])

    const upsertMonthly = useCallback(async (
        krId: string,
        month: number,
        fields: { actual?: number | null; notes?: string | null }
    ) => {
        try {
            const kr = annualKRs.find((item) => item.id === krId)
            if (!kr) return

            const existing = monthlyEntries.find((entry) => (
                entry.key_result_id === krId
                && entry.month === month
                && entry.year === year
            ))

            const payload = {
                key_result_id: krId,
                month,
                year,
                actual: fields.actual !== undefined ? fields.actual : (existing?.actual ?? null),
                notes: fields.notes !== undefined ? fields.notes : (existing?.notes ?? null),
            }

            const { data, error } = await supabase
                .from('kr_monthly_data')
                .upsert(payload, { onConflict: 'key_result_id,month,year' })
                .select('id,key_result_id,month,year,actual,notes')
                .single()

            if (error) throw error

            const typedData = data as CascadeMonthlyEntry

            // Build the up-to-date list of this year's entries so we can find the last reported month.
            const nextEntries = (() => {
                const index = monthlyEntries.findIndex((entry) => (
                    entry.key_result_id === krId
                    && entry.month === month
                    && entry.year === year
                ))
                if (index >= 0) {
                    const next = [...monthlyEntries]
                    next[index] = typedData
                    return next
                }
                return [...monthlyEntries, typedData]
            })()

            setMonthlyEntries(nextEntries)

            // Sync the KR's actual/progress to the most recent month with a reported value.
            const lastReported = nextEntries
                .filter((entry) => entry.key_result_id === krId && entry.year === year && entry.actual !== null)
                .sort((a, b) => b.month - a.month)[0]
            const lastValue = lastReported?.actual ?? null
            const nextProgress = calculateKRProgress(kr.target, lastValue, kr.target_direction, kr.baseline)

            if (kr.actual !== lastValue || kr.progress !== nextProgress) {
                const krPatch = { actual: lastValue, progress: nextProgress }
                const { error: krError } = await supabase
                    .from('key_results')
                    .update(krPatch)
                    .eq('id', krId)

                if (krError) throw krError

                setAnnualKRs((prev) => prev.map((item) => (
                    item.id === krId ? { ...item, ...krPatch } : item
                )))

                if (user) {
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        user_email: user.email,
                        action: 'update',
                        entity_type: 'key_results',
                        entity_id: krId,
                        entity_name: `${kr.title} - actual (último mês reportado)`,
                        old_value: { actual: kr.actual, progress: kr.progress },
                        new_value: krPatch,
                    })
                }
            }

            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'kr_monthly_data',
                    entity_id: typedData.id,
                    entity_name: `${kr.title} M${month}/${year}`,
                    old_value: existing || null,
                    new_value: typedData,
                })
            }
        } catch (error) {
            console.error('Error upserting monthly data:', error)
        }
    }, [annualKRs, monthlyEntries, user, year])

    return {
        year,
        setYear,
        loading,
        selectedUnit,
        selectedUnitData,
        pillars,
        objectives,
        annualKRs,
        monthlyEntries,
        getMonthlyEntry,
        upsertMonthly,
        updateValue,
        loadData,
    }
}
