import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useBusinessUnit } from '../contexts/BusinessUnitContext'
import type { Pillar, KeyResult, QuarterlyData, ConfidenceLevel } from '../types'

// =====================================================
// TIPOS DO HOOK
// =====================================================

interface UsePillarDataParams {
    /** ID ou código do pilar */
    pillarIdOrCode: string | undefined
}

interface UsePillarDataReturn {
    /** Dados do pilar */
    pillar: Pillar | null
    /** Lista de Key Results do pilar */
    keyResults: KeyResult[]
    /** Dados trimestrais de todos os KRs */
    quarterlyData: QuarterlyData[]
    /** Indica se está carregando dados */
    loading: boolean
    /** Indica se está salvando alterações */
    saving: boolean
    /** Mensagem de erro, se houver */
    error: string | null
    /** Recarrega os dados */
    reload: () => void
    /** Atualiza um campo dos dados trimestrais */
    updateQuarterly: (quarterId: string, field: string, value: unknown) => Promise<void>
    /** Atualiza um campo do Key Result */
    updateKeyResult: (krId: string, field: string, value: unknown) => Promise<void>
    /** Retorna os dados trimestrais de um KR específico */
    getQuarterlyDataForKR: (krId: string) => QuarterlyData[]
}

// =====================================================
// HOOK
// =====================================================

export function usePillarData({ pillarIdOrCode }: UsePillarDataParams): UsePillarDataReturn {
    const { user } = useAuth()
    const { selectedUnit } = useBusinessUnit()

    const [pillar, setPillar] = useState<Pillar | null>(null)
    const [keyResults, setKeyResults] = useState<KeyResult[]>([])
    const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // =====================================================
    // FUNÇÃO DE CARREGAMENTO
    // =====================================================

    const loadData = useCallback(async () => {
        if (!pillarIdOrCode) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            // 1. Determinar se é UUID ou código
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pillarIdOrCode)

            // 2. Buscar pilar por ID ou código
            const { data: pillarData, error: pillarError } = await supabase
                .from('pillars')
                .select('*')
                .eq(isUuid ? 'id' : 'code', pillarIdOrCode)
                .single()

            if (pillarError || !pillarData) {
                setError('Pilar não encontrado')
                setLoading(false)
                return
            }

            setPillar(pillarData)

            // 3. Buscar objetivos para este pilar e unidade
            let objectivesQuery = supabase
                .from('objectives')
                .select('id')
                .eq('pillar_id', pillarData.id)
                .eq('year', 2026)
                .eq('is_active', true)

            if (selectedUnit) {
                objectivesQuery = objectivesQuery.eq('business_unit_id', selectedUnit)
            }

            // Ordenar por código para manter consistência visual (alfanumérico)
            objectivesQuery = objectivesQuery.order('code')

            const { data: objectivesData } = await objectivesQuery

            if (!objectivesData || objectivesData.length === 0) {
                setKeyResults([])
                setQuarterlyData([])
                setLoading(false)
                return
            }

            // 4. Buscar KRs para esses objetivos
            const objectiveIds = objectivesData.map(o => o.id)
            const { data: krsData } = await supabase
                .from('key_results')
                .select('*')
                .in('objective_id', objectiveIds)
                .eq('is_active', true)
                .order('order_index')

            setKeyResults(krsData || [])

            // 5. Buscar dados trimestrais
            const krIds = (krsData || []).map(kr => kr.id)
            if (krIds.length > 0) {
                const { data: qData } = await supabase
                    .from('kr_quarterly_data')
                    .select('*')
                    .in('key_result_id', krIds)
                    .eq('year', 2026)
                    .order('quarter')

                setQuarterlyData(qData || [])
            } else {
                setQuarterlyData([])
            }

        } catch (err) {
            console.error('Error loading pillar data:', err)
            setError('Erro ao carregar dados do pilar')
        } finally {
            setLoading(false)
        }
    }, [pillarIdOrCode, selectedUnit])

    useEffect(() => {
        loadData()
    }, [loadData])

    // =====================================================
    // FUNÇÃO DE ATUALIZAÇÃO DE DADOS TRIMESTRAIS
    // =====================================================

    const updateQuarterly = useCallback(async (quarterId: string, field: string, value: unknown) => {
        setSaving(true)
        try {
            const updateData: Record<string, unknown> = {}
            updateData[field] = value

            // Pegar dados atuais para log de auditoria
            const currentRecord = quarterlyData.find(q => q.id === quarterId)
            const relatedKR = currentRecord
                ? keyResults.find(kr => kr.id === currentRecord.key_result_id)
                : null

            const { error } = await supabase
                .from('kr_quarterly_data')
                .update(updateData)
                .eq('id', quarterId)

            if (error) throw error

            // Criar log de auditoria
            if (user && currentRecord && relatedKR) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'kr_quarterly_data',
                    entity_id: quarterId,
                    entity_name: `${relatedKR.title} (Q${currentRecord.quarter}) - ${field}`,
                    old_value: { [field]: currentRecord[field as keyof QuarterlyData] },
                    new_value: { [field]: value }
                })
            }

            // Atualizar estado local
            setQuarterlyData(prev =>
                prev.map(q => q.id === quarterId ? { ...q, [field]: value } : q)
            )

            // Se atualizou baseline, target ou actual, buscar progresso recalculado
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
    }, [quarterlyData, keyResults, user])

    // =====================================================
    // FUNÇÃO DE ATUALIZAÇÃO DE KEY RESULT
    // =====================================================

    const updateKeyResult = useCallback(async (krId: string, field: string, value: unknown) => {
        setSaving(true)
        try {
            const updateData: Record<string, unknown> = {}
            updateData[field] = value

            const currentKR = keyResults.find(kr => kr.id === krId)

            const { error } = await supabase
                .from('key_results')
                .update(updateData)
                .eq('id', krId)

            if (error) throw error

            // Criar log de auditoria
            if (user && currentKR) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'key_result',
                    entity_id: krId,
                    entity_name: `${currentKR.title} - ${field}`,
                    old_value: { [field]: currentKR[field as keyof KeyResult] },
                    new_value: { [field]: value }
                })
            }

            // Atualizar estado local
            setKeyResults(prev =>
                prev.map(kr => kr.id === krId ? { ...kr, [field]: value } : kr)
            )

        } catch (error) {
            console.error('Error updating key result:', error)
        } finally {
            setSaving(false)
        }
    }, [keyResults, user])

    // =====================================================
    // HELPER: OBTER DADOS TRIMESTRAIS POR KR
    // =====================================================

    const getQuarterlyDataForKR = useCallback((krId: string): QuarterlyData[] => {
        return [1, 2, 3, 4].map(quarter => {
            const existing = quarterlyData.find(q => q.key_result_id === krId && q.quarter === quarter)
            return existing || {
                id: '',
                key_result_id: krId,
                quarter,
                year: 2026,
                baseline: null,
                target: null,
                actual: null,
                progress: null,
                confidence: null as ConfidenceLevel,
                notes: null
            }
        })
    }, [quarterlyData])

    // =====================================================
    // RETORNO DO HOOK
    // =====================================================

    return {
        pillar,
        keyResults,
        quarterlyData,
        loading,
        saving,
        error,
        reload: loadData,
        updateQuarterly,
        updateKeyResult,
        getQuarterlyDataForKR
    }
}
