import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
    const { t } = useTranslation()
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
                    code: '', // Will be calculated below
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

    // Auto-generate KR Code Logic
    useEffect(() => {
        async function generateKRCode() {
            // Only generate for new KRs when modal is open and objective is selected
            if (isEditing || !open || !formData.objective_id) return

            try {
                // Find parent objective code
                const parentObj = objectives.find(o => o.id === formData.objective_id)
                const parentCode = parentObj?.code || '1'

                // Find ALL KRs for this objective to calculate next number
                const { data } = await supabase
                    .from('key_results')
                    .select('code')
                    .eq('objective_id', formData.objective_id)

                let nextSuffix = 1
                if (data && data.length > 0) {
                    // Extract numbers from all existing KR codes
                    // Codes can be: "1.1", "RENT-1.2", "2.3", etc.
                    const suffixes = data.map(kr => {
                        const code = kr.code
                        // Try to extract the last number after a dot
                        const dotMatch = code.match(/\.(\d+)$/)
                        if (dotMatch) return parseInt(dotMatch[1])
                        // Fallback: try to parse the whole code as number
                        const num = parseInt(code)
                        return isNaN(num) ? 0 : num
                    })
                    const maxSuffix = Math.max(...suffixes, 0)
                    nextSuffix = maxSuffix + 1
                }

                setFormData(prev => ({ ...prev, code: `${parentCode}.${nextSuffix}` }))
            } catch (err) {
                console.error('Error generating KR code:', err)
            }
        }

        generateKRCode()
    }, [formData.objective_id, open, isEditing, objectives])

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
            setError(t('modals.createKR.errorRequired'))
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
                // Calculate order_index based on existing KRs count
                const { data: existingKRs } = await supabase
                    .from('key_results')
                    .select('id')
                    .eq('objective_id', formData.objective_id)

                const nextOrderIndex = (existingKRs?.length || 0) + 1

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
                        order_index: nextOrderIndex,
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
            setError(err.message || t('modals.createKR.errorSave'))
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
                                    {isEditing ? t('modals.createKR.titleEdit') : t('modals.createKR.titleNew')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {isEditing ? t('modals.createKR.subtitleEdit') : t('modals.createKR.subtitleNew')}
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
                                {t('modals.createKR.linkedObjective')} *
                            </label>
                            <select
                                value={formData.objective_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, objective_id: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                                <option value="">{t('modals.createKR.selectObjective')}</option>
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
                                    label={`${t('modals.createKR.code')} *`}
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    placeholder="1.1"
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    label={`${t('modals.createKR.titleLabel')} *`}
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder={t('modals.createKR.titlePlaceholder')}
                                />
                            </div>
                        </div>

                        {/* Owner & Source */}
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={t('modals.createKR.owner')}
                                value={formData.owner_name || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                                placeholder={t('modals.createKR.ownerPlaceholder')}
                            />
                            <Input
                                label={t('modals.createKR.source')}
                                value={formData.source || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                placeholder={t('modals.createKR.sourcePlaceholder')}
                            />
                        </div>

                        {/* Metric Type */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                {t('modals.createKR.metricType')}
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
                                        {t(`modals.createKR.metrics.${metric.value}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Unit (custom if needed) */}
                        <Input
                            label={t('modals.createKR.unit')}
                            value={formData.unit}
                            onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                            placeholder={t('modals.createKR.unitPlaceholder')}
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
                            {t('modals.createKR.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={loading}>
                            <Save className="w-4 h-4" />
                            {isEditing ? t('modals.createKR.saveEdit') : t('modals.createKR.saveNew')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
