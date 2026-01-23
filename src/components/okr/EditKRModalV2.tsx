import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Save, Target, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface Objective {
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

interface KeyResultFormData {
    id?: string
    code: string
    title: string
    owner_name: string | null
    source: string | null
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    unit: string
    objective_id: string
}

interface EditKRModalV2Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: () => void
    keyResult?: KeyResultFormData | null
    objectives: Objective[]
    defaultObjectiveId?: string
}

const metricTypes = [
    { value: 'percentage', label: 'Percentual', unit: '%' },
    { value: 'number', label: 'Número', unit: '' },
    { value: 'currency', label: 'Moeda', unit: 'R$' },
    { value: 'days', label: 'Dias', unit: 'dias' }
]

export function EditKRModalV2({
    open,
    onOpenChange,
    onSave,
    keyResult,
    objectives,
    defaultObjectiveId
}: EditKRModalV2Props) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState<KeyResultFormData>({
        code: '',
        title: '',
        owner_name: '',
        source: '',
        metric_type: 'percentage',
        unit: '%',
        objective_id: defaultObjectiveId || ''
    })

    const isEditing = !!keyResult?.id

    useEffect(() => {
        if (open) {
            if (keyResult) {
                setFormData({
                    id: keyResult.id,
                    code: keyResult.code,
                    title: keyResult.title,
                    owner_name: keyResult.owner_name || '',
                    source: keyResult.source || '',
                    metric_type: keyResult.metric_type,
                    unit: keyResult.unit,
                    objective_id: keyResult.objective_id
                })
            } else {
                setFormData({
                    code: '',
                    title: '',
                    owner_name: '',
                    source: '',
                    metric_type: 'percentage',
                    unit: '%',
                    objective_id: defaultObjectiveId || objectives[0]?.id || ''
                })
            }
            setError(null)
        }
    }, [open, keyResult, defaultObjectiveId, objectives])

    function handleMetricTypeChange(metricType: string) {
        const metric = metricTypes.find(m => m.value === metricType)
        setFormData(prev => ({
            ...prev,
            metric_type: metricType as any,
            unit: metric?.unit || ''
        }))
    }

    async function handleSave() {
        if (!user || !formData.objective_id || !formData.code.trim() || !formData.title.trim()) {
            setError('Preencha todos os campos obrigatórios')
            return
        }

        setLoading(true)
        setError(null)

        try {
            if (isEditing && formData.id) {
                // Update existing KR
                const { error: updateError } = await supabase
                    .from('key_results')
                    .update({
                        code: formData.code.trim(),
                        title: formData.title.trim(),
                        owner_name: (formData.owner_name || '').trim() || null,
                        source: (formData.source || '').trim() || null,
                        metric_type: formData.metric_type,
                        unit: formData.unit,
                        objective_id: formData.objective_id
                    })
                    .eq('id', formData.id)

                if (updateError) throw updateError

                // Audit log
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'key_results',
                    entity_id: formData.id,
                    entity_name: formData.title
                })
            } else {
                // Create new KR
                const { data: newKR, error: insertError } = await supabase
                    .from('key_results')
                    .insert({
                        code: formData.code.trim(),
                        title: formData.title.trim(),
                        owner_name: (formData.owner_name || '').trim() || null,
                        source: (formData.source || '').trim() || null,
                        metric_type: formData.metric_type,
                        unit: formData.unit,
                        objective_id: formData.objective_id,
                        order_index: 99, // Will be sorted later
                        is_active: true
                    })
                    .select()
                    .single()

                if (insertError) throw insertError

                // Create quarterly data for all 4 quarters
                if (newKR) {
                    const quarterlyRecords = [1, 2, 3, 4].map(quarter => ({
                        key_result_id: newKR.id,
                        quarter,
                        year: 2026,
                        baseline: null,
                        target: null,
                        actual: null,
                        confidence: null
                    }))

                    await supabase.from('kr_quarterly_data').insert(quarterlyRecords)

                    // Audit log
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        user_email: user.email,
                        action: 'create',
                        entity_type: 'key_results',
                        entity_id: newKR.id,
                        entity_name: formData.title
                    })
                }
            }

            onSave()
            onOpenChange(false)
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar')
        } finally {
            setLoading(false)
        }
    }

    const selectedObjective = objectives.find(o => o.id === formData.objective_id)

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                                {isEditing ? (
                                    <Target className="w-5 h-5 text-[var(--color-primary)]" />
                                ) : (
                                    <Plus className="w-5 h-5 text-[var(--color-primary)]" />
                                )}
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {isEditing ? 'Editar Key Result' : 'Novo Key Result'}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {isEditing ? 'Altere os dados do KR' : 'Adicione um novo KR ao objetivo'}
                                </Dialog.Description>
                            </div>
                        </div>
                        <Dialog.Close asChild>
                            <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5">
                        {/* Objective Selection */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                Objetivo Vinculado *
                            </label>
                            <select
                                value={formData.objective_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, objective_id: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                                <option value="">Selecione um objetivo</option>
                                {objectives.map((obj) => (
                                    <option key={obj.id} value={obj.id}>
                                        [{obj.business_unit?.name}] {obj.pillar?.name} - {obj.code}
                                    </option>
                                ))}
                            </select>
                            {selectedObjective && (
                                <div className="mt-2 flex items-center gap-2">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: selectedObjective.pillar?.color }}
                                    />
                                    <span className="text-xs text-[var(--color-text-muted)]">
                                        {selectedObjective.title}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Code & Title */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <Input
                                    label="Código *"
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    placeholder="1.1"
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    label="Título *"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Ex: Redução de Lead Time"
                                />
                            </div>
                        </div>

                        {/* Owner & Source */}
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Responsável"
                                value={formData.owner_name || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                                placeholder="Nome do responsável"
                            />
                            <Input
                                label="Fonte"
                                value={formData.source || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                placeholder="SAP, Finance, etc."
                            />
                        </div>

                        {/* Metric Type */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                Tipo de Métrica
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {metricTypes.map((metric) => (
                                    <button
                                        key={metric.value}
                                        type="button"
                                        onClick={() => handleMetricTypeChange(metric.value)}
                                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${formData.metric_type === metric.value
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                                            }`}
                                    >
                                        {metric.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Unit (custom if needed) */}
                        <Input
                            label="Unidade"
                            value={formData.unit}
                            onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                            placeholder="%, R$, dias, etc."
                        />

                        {error && (
                            <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={loading}>
                            <Save className="w-4 h-4" />
                            {isEditing ? 'Salvar Alterações' : 'Criar Key Result'}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
