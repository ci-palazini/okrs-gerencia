import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Objective, KeyResult, Pillar, Action, MonthlyData } from '../types'

// Tipos com relações para este hook
interface ObjectiveWithRelations extends Objective {
    pillar?: Pillar
    key_results?: KeyResultWithRelations[]
}

interface KeyResultWithRelations extends KeyResult {
    objective?: Objective
    actions?: Action[]
    children?: KeyResult[] // quarterly KRs
    monthly_data?: MonthlyData[]
}

export function useOKRs() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const fetchPillars = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('pillars')
                .select('*')
                .eq('is_active', true)
                .order('order_index')

            if (error) throw error
            return data as Pillar[]
        } catch (err) {
            setError(err as Error)
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchObjectives = useCallback(async (year: number = 2026, businessUnitId?: string) => {
        setLoading(true)
        setError(null)
        try {
            let query = supabase
                .from('objectives')
                .select(`
                    *,
                    pillar:pillars(*),
                    key_results(
                        *,
                        actions(*)
                    )
                `)
                .eq('year', year)
                .eq('is_active', true)
                .order('code')

            if (businessUnitId) {
                query = query.eq('business_unit_id', businessUnitId)
            }

            const { data, error } = await query

            if (error) throw error
            return data as ObjectiveWithRelations[]
        } catch (err) {
            setError(err as Error)
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchKeyResults = useCallback(async (objectiveId?: string, scope?: 'annual' | 'quarterly') => {
        setLoading(true)
        setError(null)
        try {
            let query = supabase
                .from('key_results')
                .select(`
                    *,
                    objective:objectives(*),
                    actions(*)
                `)
                .eq('is_active', true)

            if (objectiveId) {
                query = query.eq('objective_id', objectiveId)
            }

            if (scope) {
                query = query.eq('scope', scope)
            }

            const { data, error } = await query.order('order_index')

            if (error) throw error
            return data as KeyResultWithRelations[]
        } catch (err) {
            setError(err as Error)
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchChildrenKRs = useCallback(async (parentKrId: string) => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('key_results')
                .select('*, actions(*)')
                .eq('parent_kr_id', parentKrId)
                .eq('is_active', true)
                .order('quarter')

            if (error) throw error
            return data as KeyResultWithRelations[]
        } catch (err) {
            setError(err as Error)
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchMonthlyData = useCallback(async (keyResultId: string, year: number = 2026) => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('kr_monthly_data')
                .select('*')
                .eq('key_result_id', keyResultId)
                .eq('year', year)
                .order('month')

            if (error) throw error
            return data as MonthlyData[]
        } catch (err) {
            setError(err as Error)
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const updateMonthlyData = useCallback(async (
        keyResultId: string,
        month: number,
        year: number,
        actual: number | null,
        notes: string | null,
        userId: string
    ) => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('kr_monthly_data')
                .upsert({
                    key_result_id: keyResultId,
                    month,
                    year,
                    actual,
                    notes
                }, {
                    onConflict: 'key_result_id,month,year'
                })
                .select()
                .single()

            if (error) throw error

            // Audit log
            await supabase.from('audit_logs').insert({
                user_id: userId,
                action: 'update',
                entity_type: 'kr_monthly_data',
                entity_id: data.id,
                new_value: { month, year, actual, notes }
            })

            return data as MonthlyData
        } catch (err) {
            setError(err as Error)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    const updateKeyResultProgress = useCallback(async (
        id: string,
        field: string,
        value: unknown,
        userId: string
    ) => {
        setLoading(true)
        setError(null)
        try {
            // Get old value for audit
            const { data: oldData } = await supabase
                .from('key_results')
                .select('*')
                .eq('id', id)
                .single()

            // Update value
            const { data, error } = await supabase
                .from('key_results')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            // Create audit log
            await supabase.from('audit_logs').insert({
                user_id: userId,
                action: 'update',
                entity_type: 'key_results',
                entity_id: id,
                old_value: oldData,
                new_value: data
            })

            return data as KeyResult
        } catch (err) {
            setError(err as Error)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        loading,
        error,
        fetchPillars,
        fetchObjectives,
        fetchKeyResults,
        fetchChildrenKRs,
        fetchMonthlyData,
        updateMonthlyData,
        updateKeyResultProgress
    }
}
