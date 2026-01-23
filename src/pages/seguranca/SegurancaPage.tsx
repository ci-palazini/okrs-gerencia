import { useEffect, useState } from 'react'
import { RefreshCw, Shield } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { UnitToggle } from '../../components/ui/UnitToggle'
import { QuarterlyCard } from '../../components/okr/QuarterlyCard'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { ConfidenceLevel } from '../../components/ui/ConfidenceIndicator'

interface BusinessUnit {
    id: string
    code: string
    name: string
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

export function SegurancaPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [units, setUnits] = useState<BusinessUnit[]>([])
    const [selectedUnit, setSelectedUnit] = useState<string>('')
    const [keyResults, setKeyResults] = useState<KeyResult[]>([])
    const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([])
    const [currentQuarter] = useState(1) // Q1 2026

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedUnit) {
            loadSegurancaData()
        }
    }, [selectedUnit])

    async function loadInitialData() {
        try {
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
        } catch (error) {
            console.error('Error loading initial data:', error)
        }
    }

    async function loadSegurancaData() {
        setLoading(true)
        try {
            // Get Safety pillar
            const { data: pillarData } = await supabase
                .from('pillars')
                .select('id')
                .eq('code', 'SEG')
                .single()

            if (!pillarData) {
                setLoading(false)
                return
            }

            // Get objectives for this unit and pillar
            const { data: objectivesData } = await supabase
                .from('objectives')
                .select('id, title')
                .eq('business_unit_id', selectedUnit)
                .eq('pillar_id', pillarData.id)
                .eq('year', 2026)

            if (!objectivesData || objectivesData.length === 0) {
                setKeyResults([])
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

            setKeyResults(krsData || [])

            // Get all quarterly data for these KRs
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
        } catch (error) {
            console.error('Error loading safety data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateQuarterly(quarterId: string, field: string, value: any) {
        setSaving(true)
        try {
            const updateData: Record<string, any> = {}
            updateData[field] = value

            // Get current data for audit log (before update)
            const currentRecord = quarterlyData.find(q => q.id === quarterId)
            const relatedKR = currentRecord
                ? keyResults.find(kr => kr.id === currentRecord.key_result_id)
                : null

            const { error } = await supabase
                .from('kr_quarterly_data')
                .update(updateData)
                .eq('id', quarterId)

            if (error) throw error

            // Create audit log
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

            // Update local state
            setQuarterlyData(prev =>
                prev.map(q => q.id === quarterId ? { ...q, [field]: value } : q)
            )

            // If we updated baseline, target, or actual, we need to refetch to get the calculated progress
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

            const currentKR = keyResults.find(kr => kr.id === krId)

            const { error } = await supabase
                .from('key_results')
                .update(updateData)
                .eq('id', krId)

            if (error) throw error

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

            setKeyResults(prev =>
                prev.map(kr => kr.id === krId ? { ...kr, [field]: value } : kr)
            )
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
                confidence: null
            }
        })
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
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            <Shield className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Segurança e Saúde</h1>
                    </div>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        Transformação rumo a uma cultura de segurança proativa com participação integral dos colaboradores.
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
                    {saving && (
                        <Badge variant="warning" size="sm">
                            Salvando...
                        </Badge>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadSegurancaData}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="p-4 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                <p className="text-sm text-[var(--color-text-secondary)]">
                    <strong className="text-[var(--color-primary)]">Dica:</strong> Clique nos valores de Baseline, Target ou Real para editar diretamente.
                    O % de Avanço é calculado automaticamente. Use os indicadores de confiança para sinalizar o status de cada KR.
                </p>
            </div>

            {/* KR Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : keyResults.length > 0 ? (
                <div className="space-y-6">
                    {keyResults.map((kr) => (
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
            ) : (
                <div className="text-center py-16">
                    <p className="text-[var(--color-text-muted)]">
                        Nenhum Key Result de Segurança encontrado para {selectedUnitName}.
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                        Execute o script seed.sql no Supabase para popular os dados.
                    </p>
                </div>
            )}
        </div>
    )
}
