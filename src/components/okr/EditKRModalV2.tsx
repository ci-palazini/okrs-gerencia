import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Save, Target, Plus, CalendarRange, BarChart3 } from 'lucide-react'
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

interface AnnualKR {
    id: string
    code: string
    title: string
    objective_id: string
}

interface KeyResultFormData {
    id?: string
    code: string
    title: string
    owner_name: string | null
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    unit: string
    objective_id: string
    target_direction: 'maximize' | 'minimize'
    scope: 'annual' | 'quarterly'
    parent_kr_id: string | null
    quarter: number | null
}

interface EditKRModalV2Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: () => void
    keyResult?: KeyResultFormData | null
    objectives: Objective[]
    defaultObjectiveId?: string
    /** If provided, forces the scope to 'quarterly' and pre-selects the parent */
    forceParentKrId?: string
    forceQuarter?: number
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
    defaultObjectiveId,
    forceParentKrId,
    forceQuarter
}: EditKRModalV2Props) {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [annualKRs, setAnnualKRs] = useState<AnnualKR[]>([])

    const [formData, setFormData] = useState<KeyResultFormData>({
        code: '',
        title: '',
        owner_name: '',
        metric_type: 'percentage',
        unit: '%',
        objective_id: defaultObjectiveId || '',
        target_direction: 'maximize',
        scope: forceParentKrId ? 'quarterly' : 'annual',
        parent_kr_id: forceParentKrId || null,
        quarter: forceQuarter || null
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
                    metric_type: keyResult.metric_type,
                    unit: keyResult.unit,
                    objective_id: keyResult.objective_id,
                    target_direction: keyResult.target_direction ?? 'maximize',
                    scope: keyResult.scope || 'annual',
                    parent_kr_id: keyResult.parent_kr_id || null,
                    quarter: keyResult.quarter || null
                })
            } else {
                setFormData({
                    code: '',
                    title: '',
                    owner_name: '',
                    metric_type: 'percentage',
                    unit: '%',
                    objective_id: defaultObjectiveId || objectives[0]?.id || '',
                    target_direction: 'maximize',
                    scope: forceParentKrId ? 'quarterly' : 'annual',
                    parent_kr_id: forceParentKrId || null,
                    quarter: forceQuarter || null
                })
            }
            setError(null)
        }
    }, [open, keyResult, defaultObjectiveId, objectives, forceParentKrId, forceQuarter])

    // Load annual KRs when scope is quarterly
    useEffect(() => {
        if (open && formData.scope === 'quarterly' && formData.objective_id) {
            loadAnnualKRs(formData.objective_id)
        }
    }, [open, formData.scope, formData.objective_id])

    async function loadAnnualKRs(objectiveId: string) {
        try {
            const { data } = await supabase
                .from('key_results')
                .select('id, code, title, objective_id')
                .eq('objective_id', objectiveId)
                .eq('scope', 'annual')
                .eq('is_active', true)
                .order('order_index')

            setAnnualKRs(data || [])
        } catch (err) {
            console.error('Error loading annual KRs:', err)
        }
    }

    // Auto-generate KR Code Logic
    useEffect(() => {
        async function generateKRCode() {
            if (isEditing || !open || !formData.objective_id) return

            try {
                if (formData.scope === 'quarterly' && formData.parent_kr_id && formData.quarter) {
                    // For quarterly KRs: use parent code + .Q{quarter}
                    const parentKR = annualKRs.find(kr => kr.id === formData.parent_kr_id)
                    if (parentKR) {
                        setFormData(prev => ({ ...prev, code: `${parentKR.code}.Q${formData.quarter}` }))
                    }
                } else {
                    // For annual KRs: same logic as before
                    const parentObj = objectives.find(o => o.id === formData.objective_id)
                    const parentCode = parentObj?.code || '1'

                    const { data } = await supabase
                        .from('key_results')
                        .select('code')
                        .eq('objective_id', formData.objective_id)
                        .eq('scope', 'annual')

                    let nextSuffix = 1
                    if (data && data.length > 0) {
                        const suffixes = data.map(kr => {
                            const code = kr.code
                            const dotMatch = code.match(/\.(\d+)$/)
                            if (dotMatch) return parseInt(dotMatch[1])
                            const num = parseInt(code)
                            return isNaN(num) ? 0 : num
                        })
                        const maxSuffix = Math.max(...suffixes, 0)
                        nextSuffix = maxSuffix + 1
                    }

                    setFormData(prev => ({ ...prev, code: `${parentCode}.${nextSuffix}` }))
                }
            } catch (err) {
                console.error('Error generating KR code:', err)
            }
        }

        generateKRCode()
    }, [formData.objective_id, formData.scope, formData.parent_kr_id, formData.quarter, open, isEditing, objectives, annualKRs])

    function handleMetricTypeChange(metricType: string) {
        const metric = metricTypes.find(m => m.value === metricType)
        setFormData(prev => ({
            ...prev,
            metric_type: metricType as any,
            unit: metric?.unit || ''
        }))
    }

    function handleScopeChange(scope: 'annual' | 'quarterly') {
        setFormData(prev => ({
            ...prev,
            scope,
            parent_kr_id: scope === 'annual' ? null : prev.parent_kr_id,
            quarter: scope === 'annual' ? null : prev.quarter
        }))
    }

    async function handleSave() {
        if (!user || !formData.objective_id || !formData.code.trim() || !formData.title.trim()) {
            setError(t('modals.createKR.errorRequired'))
            return
        }

        if (formData.scope === 'quarterly' && (!formData.parent_kr_id || !formData.quarter)) {
            setError(t('modals.createKR.errorQuarterlyRequired'))
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
                        metric_type: formData.metric_type,
                        unit: formData.unit,
                        objective_id: formData.objective_id,
                        target_direction: formData.target_direction,
                        scope: formData.scope,
                        parent_kr_id: formData.parent_kr_id,
                        quarter: formData.quarter
                    })
                    .eq('id', formData.id)

                if (updateError) throw updateError

                // Recalculate progress with the (possibly changed) target_direction
                const { data: currentValues } = await supabase
                    .from('key_results')
                    .select('target, actual')
                    .eq('id', formData.id)
                    .single()

                if (currentValues) {
                    const { target, actual } = currentValues
                    let progress: number | null = null
                    if (target !== null && target !== 0 && actual !== null) {
                        progress = formData.target_direction === 'minimize'
                            ? (actual !== 0 ? Math.round((target / actual) * 100) : null)
                            : Math.round((actual / target) * 100)
                    }
                    await supabase.from('key_results').update({ progress }).eq('id', formData.id)
                }

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
                const { data: existingKRs } = await supabase
                    .from('key_results')
                    .select('id')
                    .eq('objective_id', formData.objective_id)
                    .eq('scope', formData.scope)

                const nextOrderIndex = (existingKRs?.length || 0) + 1

                const { data: newKR, error: insertError } = await supabase
                    .from('key_results')
                    .insert({
                        code: formData.code.trim(),
                        title: formData.title.trim(),
                        owner_name: (formData.owner_name || '').trim() || null,
                        metric_type: formData.metric_type,
                        unit: formData.unit,
                        objective_id: formData.objective_id,
                        target_direction: formData.target_direction,
                        scope: formData.scope,
                        parent_kr_id: formData.parent_kr_id,
                        quarter: formData.quarter,
                        order_index: nextOrderIndex,
                        is_active: true
                    })
                    .select()
                    .single()

                if (insertError) throw insertError

                if (newKR) {
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
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] flex-shrink-0">
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
                    <div className="p-6 space-y-5 overflow-y-auto flex-1">
                        {/* Scope Selection */}
                        {!forceParentKrId && (
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createKR.scope')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleScopeChange('annual')}
                                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${formData.scope === 'annual'
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                                            }`}
                                    >
                                        <CalendarRange className="w-4 h-4 inline-block mr-1" /> {t('modals.createKR.scopeAnnual')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleScopeChange('quarterly')}
                                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${formData.scope === 'quarterly'
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                                            }`}
                                    >
                                        <BarChart3 className="w-4 h-4 inline-block mr-1" /> {t('modals.createKR.scopeQuarterly')}
                                    </button>
                                </div>
                            </div>
                        )}

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

                        {/* Parent KR Selection (only for quarterly) */}
                        {formData.scope === 'quarterly' && !forceParentKrId && (
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createKR.parentKR')} *
                                </label>
                                <select
                                    value={formData.parent_kr_id || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, parent_kr_id: e.target.value || null }))}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="">{t('modals.createKR.selectParentKR')}</option>
                                    {annualKRs.map((kr) => (
                                        <option key={kr.id} value={kr.id}>
                                            {kr.code} - {kr.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Quarter Selection (only for quarterly) */}
                        {formData.scope === 'quarterly' && (
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createKR.quarter')} *
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 2, 3, 4].map(q => (
                                        <button
                                            key={q}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, quarter: q }))}
                                            className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${formData.quarter === q
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                                                }`}
                                        >
                                            Q{q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

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

                        {/* Owner & Direction */}
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={t('modals.createKR.owner')}
                                value={formData.owner_name || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                                placeholder={t('modals.createKR.ownerPlaceholder')}
                            />
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('targetDirection.label')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, target_direction: 'maximize' }))}
                                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${formData.target_direction === 'maximize'
                                            ? 'bg-[var(--color-success)] text-white'
                                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                                            }`}
                                    >
                                        <span>↑</span> {t('targetDirection.maximize')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, target_direction: 'minimize' }))}
                                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${formData.target_direction === 'minimize'
                                            ? 'bg-[var(--color-danger)] text-white'
                                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                                            }`}
                                    >
                                        <span>↓</span> {t('targetDirection.minimize')}
                                    </button>
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                    {formData.target_direction === 'maximize'
                                        ? t('targetDirection.maximizeHint')
                                        : t('targetDirection.minimizeHint')}
                                </p>
                            </div>
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
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)] flex-shrink-0">
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
