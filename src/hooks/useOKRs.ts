import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ObjectiveLocal, KeyResult, ObjectiveLocalWithRelations, KeyResultWithRelations, Pillar } from '../types/database'

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

    const fetchObjectives = useCallback(async (year: number = 2026, country: string = 'Brazil') => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('objectives_local')
                .select(`
          *,
          pillar:pillars(*),
          corporate_objective:objectives_corporate(*),
          owner:users(*),
          key_results(
            *,
            owner:users(*),
            actions(*)
          )
        `)
                .eq('year', year)
                .eq('country', country)
                .order('code')

            if (error) throw error
            return data as ObjectiveLocalWithRelations[]
        } catch (err) {
            setError(err as Error)
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchKeyResults = useCallback(async (objectiveId?: string, quarter?: number) => {
        setLoading(true)
        setError(null)
        try {
            let query = supabase
                .from('key_results')
                .select(`
          *,
          objective:objectives_local(*),
          owner:users(*),
          actions(*)
        `)

            if (objectiveId) {
                query = query.eq('objective_id', objectiveId)
            }
            if (quarter) {
                query = query.eq('quarter', quarter)
            }

            const { data, error } = await query.order('code')

            if (error) throw error
            return data as KeyResultWithRelations[]
        } catch (err) {
            setError(err as Error)
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const updateKeyResultProgress = useCallback(async (
        id: string,
        currentValue: number,
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
                .update({ current_value: currentValue, updated_at: new Date().toISOString() })
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
        updateKeyResultProgress
    }
}
