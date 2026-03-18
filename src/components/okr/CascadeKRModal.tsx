import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { GitBranch, Plus, Save, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { listAssigneesForBusinessUnit, type AssigneeOption } from '../../lib/assignees'
import { useAuth } from '../../hooks/useAuth'
import type { CascadeKeyResult } from '../../hooks/useCascadeOKRData'
import type { ConfidenceLevel } from '../../types'
import { suggestQuarterlyKRDueDate } from '../../lib/validations'
import { getLastDayOfQuarter } from '../../lib/dateUtils'

interface CascadeKRModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => Promise<void> | void
    objectiveId: string
    objectiveCode: string
    objectiveTitle: string
    objectiveYear?: number
    parentKr?: Pick<CascadeKeyResult, 'id' | 'code' | 'title' | 'scope'> | null
    keyResult?: CascadeKeyResult | null
    initialCode?: string
}

interface KRFormData {
    code: string
    title: string
    owner_name: string
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    unit: string
    currency_type: 'BRL' | 'USD' | 'ARS' | 'GBP'
    target_direction: 'maximize' | 'minimize'
    baseline: string
    target: string
    actual: string
    scope: 'annual' | 'quarterly'
    quarter: string
    due_date: string
    confidence: ConfidenceLevel
    notes: string
}

function parseNullableNumber(value: string): number | null {
    const normalized = value.replace(',', '.').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isNaN(parsed) ? null : parsed
}

function getDefaultUnit(metricType: KRFormData['metric_type']): string {
    switch (metricType) {
        case 'percentage':
            return '%'
        case 'days':
            return 'dias'
        default:
            return ''
    }
}

function calculateProgress(
    target: number | null,
    actual: number | null,
    direction: 'maximize' | 'minimize' = 'maximize',
    baseline: number | null = null
): number | null {
    if (target === null || actual === null) return null

    if (baseline !== null) {
        if (direction === 'minimize') {
            const denominator = baseline - target
            if (denominator === 0) return null
            return Math.round(((baseline - actual) / denominator) * 100)
        }

        const denominator = target - baseline
        if (denominator === 0) return null
        return Math.round(((actual - baseline) / denominator) * 100)
    }

    if (target === 0) return null

    if (direction === 'minimize') {
        if (actual === 0) return null
        return Math.round((target / actual) * 100)
    }

    return Math.round((actual / target) * 100)
}

export function CascadeKRModal({
    open,
    onOpenChange,
    onSaved,
    objectiveId,
    objectiveCode,
    objectiveTitle,
    objectiveYear,
    parentKr,
    keyResult,
    initialCode,
}: CascadeKRModalProps) {
    const { t } = useTranslation()
    const { user } = useAuth()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [assigneesLoading, setAssigneesLoading] = useState(false)
    const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([])
    const initializedContextRef = useRef<string | null>(null)

    const isEditMode = !!keyResult?.id
    const isChild = useMemo(() => {
        if (isEditMode && keyResult) {
            return !!keyResult.parent_kr_id
        }
        return !!parentKr?.id
    }, [isEditMode, keyResult, parentKr])
    const parentKrId = parentKr?.id || null
    const parentKrCode = parentKr?.code || ''
    const fallbackParentId = isEditMode ? keyResult?.parent_kr_id || null : parentKrId
    const [parentScopesById, setParentScopesById] = useState<Record<string, 'annual' | 'quarterly'>>({})
    const parentScope = parentKr?.scope || (fallbackParentId ? parentScopesById[fallbackParentId] || null : null)
    const isScopeLockedByParent = parentScope === 'quarterly'

    const [formData, setFormData] = useState<KRFormData>({
        code: '',
        title: '',
        owner_name: '',
        metric_type: 'percentage',
        unit: '%',
        currency_type: 'BRL',
        target_direction: 'maximize',
        baseline: '',
        target: '',
        actual: '',
        scope: 'annual',
        quarter: '',
        due_date: `${objectiveYear || new Date().getFullYear()}-12-31`,
        confidence: null,
        notes: '',
    })

    useEffect(() => {
        if (!open) {
            initializedContextRef.current = null
            return
        }

        const contextKey = isEditMode && keyResult
            ? `edit:${keyResult.id}`
            : `create:${objectiveId}:${parentKrId || 'root'}:${initialCode || ''}`

        if (initializedContextRef.current === contextKey) {
            return
        }

        initializedContextRef.current = contextKey

        if (isEditMode && keyResult) {
            const currentYear = new Date().getFullYear()
            setFormData({
                code: keyResult.code || '',
                title: keyResult.title || '',
                owner_name: keyResult.owner_name || '',
                metric_type: keyResult.metric_type,
                unit: getDefaultUnit(keyResult.metric_type),
                currency_type: (keyResult.currency_type || 'BRL') as KRFormData['currency_type'],
                target_direction: keyResult.target_direction || 'maximize',
                baseline: keyResult.baseline?.toString() || '',
                target: keyResult.target?.toString() || '',
                actual: keyResult.actual?.toString() || '',
                scope: keyResult.scope || 'annual',
                quarter: keyResult.scope === 'quarterly' ? keyResult.quarter?.toString() || '' : '',
                due_date: keyResult.due_date
                    || (keyResult.scope === 'quarterly' && keyResult.quarter
                        ? suggestQuarterlyKRDueDate(keyResult.quarter as 1 | 2 | 3 | 4, objectiveYear || currentYear)
                        : `${objectiveYear || currentYear}-12-31`),
                confidence: keyResult.confidence,
                notes: keyResult.notes || '',
            })
            setError(null)
            return
        }

        const suggestedCode = initialCode || (isChild && parentKrCode ? `${parentKrCode}.1` : `${objectiveCode}.1`)
        const defaultScope: 'annual' | 'quarterly' = parentScope === 'quarterly' ? 'quarterly' : 'annual'
        const defaultQuarter = defaultScope === 'quarterly' ? '1' : ''
        const currentYear = objectiveYear || new Date().getFullYear()
        const suggestedDueDate = defaultScope === 'quarterly' && defaultQuarter
            ? suggestQuarterlyKRDueDate(Number(defaultQuarter) as 1 | 2 | 3 | 4, currentYear)
            : `${currentYear}-12-31`

        setFormData({
            code: suggestedCode,
            title: '',
            owner_name: user?.full_name || user?.email || '',
            metric_type: 'percentage',
            unit: getDefaultUnit('percentage'),
            currency_type: 'BRL',
            target_direction: 'maximize',
            baseline: '',
            target: '',
            actual: '',
            scope: defaultScope,
            quarter: defaultQuarter,
            due_date: suggestedDueDate,
            confidence: null,
            notes: '',
        })
        setError(null)
    }, [
        open,
        isEditMode,
        keyResult,
        isChild,
        objectiveId,
        objectiveCode,
        parentKrId,
        parentKrCode,
        initialCode,
        user?.full_name,
        user?.email,
        parentScope,
        objectiveYear,
    ])

    useEffect(() => {
        if (!open || !fallbackParentId || parentKr?.scope || parentScopesById[fallbackParentId]) {
            return
        }

        let active = true

        void (async () => {
            try {
                const { data, error: parentError } = await supabase
                    .from('key_results')
                    .select('scope')
                    .eq('id', fallbackParentId)
                    .single()

                if (parentError) throw parentError

                const fetchedScope = (data as { scope?: 'annual' | 'quarterly' } | null)?.scope
                if (active && fetchedScope) {
                    setParentScopesById((prev) => ({ ...prev, [fallbackParentId]: fetchedScope }))
                }
            } catch (parentScopeError) {
                console.error('Error loading parent KR scope:', parentScopeError)
            }
        })()

        return () => {
            active = false
        }
    }, [open, fallbackParentId, parentKr?.scope, parentScopesById])

    useEffect(() => {
        if (!open || !objectiveId) {
            setAssigneeOptions([])
            setAssigneesLoading(false)
            return
        }

        let active = true
        setAssigneesLoading(true)

        void (async () => {
            try {
                const { data: objectiveData, error: objectiveError } = await supabase
                    .from('objectives')
                    .select('business_unit_id')
                    .eq('id', objectiveId)
                    .single()

                if (objectiveError) throw objectiveError

                const businessUnitId = (objectiveData as { business_unit_id: string | null } | null)?.business_unit_id
                if (!businessUnitId) {
                    if (active) {
                        setAssigneeOptions([])
                    }
                    return
                }

                const options = await listAssigneesForBusinessUnit(businessUnitId)
                if (active) {
                    setAssigneeOptions(options)
                }
            } catch (assigneeError) {
                console.error('Error loading KR assignees:', assigneeError)
                if (active) {
                    setAssigneeOptions([])
                }
            } finally {
                if (active) {
                    setAssigneesLoading(false)
                }
            }
        })()

        return () => {
            active = false
        }
    }, [open, objectiveId])

    function handleMetricTypeChange(metricType: KRFormData['metric_type']) {
        setFormData((prev) => ({
            ...prev,
            metric_type: metricType,
            unit: getDefaultUnit(metricType),
        }))
    }

    function handleScopeChange(nextScope: KRFormData['scope']) {
        if (isScopeLockedByParent) return

        setFormData((prev) => {
            if (nextScope === 'annual') {
                return {
                    ...prev,
                    scope: 'annual',
                    quarter: '',
                }
            }

            const effectiveYear = objectiveYear || new Date().getFullYear()
            const nextQuarter = prev.quarter || '1'
            return {
                ...prev,
                scope: 'quarterly',
                quarter: nextQuarter,
                due_date: prev.due_date || suggestQuarterlyKRDueDate(Number(nextQuarter) as 1 | 2 | 3 | 4, effectiveYear),
            }
        })
    }

    function handleQuarterChange(quarterValue: string) {
        setFormData((prev) => ({
            ...prev,
            quarter: quarterValue,
            due_date: quarterValue
                ? suggestQuarterlyKRDueDate(Number(quarterValue) as 1 | 2 | 3 | 4, objectiveYear || new Date().getFullYear())
                : prev.due_date,
        }))
    }

    async function handleSave() {
        if (!user) return

        if (!formData.code.trim() || !formData.title.trim()) {
            setError(t('modals.createKR.errorRequired'))
            return
        }

        const baseline = parseNullableNumber(formData.baseline)
        const target = parseNullableNumber(formData.target)
        const actual = parseNullableNumber(formData.actual)
        const effectiveScope: KRFormData['scope'] = isScopeLockedByParent ? 'quarterly' : formData.scope
        const quarter = effectiveScope === 'quarterly' && formData.quarter ? Number(formData.quarter) : null
        const effectiveParentId = isEditMode ? keyResult?.parent_kr_id || null : parentKr?.id || null

        if (effectiveScope === 'quarterly' && (Number.isNaN(quarter) || quarter === null || quarter < 1 || quarter > 4)) {
            setError(t('modals.createKR.errorRequired'))
            return
        }

        if (effectiveParentId && effectiveScope !== 'quarterly') {
            const { data: parentData, error: parentError } = await supabase
                .from('key_results')
                .select('scope')
                .eq('id', effectiveParentId)
                .single()

            if (parentError) {
                setError(parentError.message)
                return
            }

            const parentKrScope = (parentData as { scope?: 'annual' | 'quarterly' } | null)?.scope
            if (parentKrScope === 'quarterly') {
                setError(t('modals.createKR.scopeLockedByParent'))
                return
            }
        }

        const targetDirection = formData.target_direction
        const progress = calculateProgress(target, actual, targetDirection, baseline)

        // Keep manually selected due date; only infer from quarter as fallback.
        let dueDate = formData.due_date
        const effectiveYear = objectiveYear || new Date().getFullYear()
        if (!dueDate && effectiveScope === 'quarterly' && quarter) {
            dueDate = getLastDayOfQuarter(quarter as 1 | 2 | 3 | 4, effectiveYear)
        }
        if (!dueDate) {
            setError(t('deadline.required'))
            return
        }

        const payload = {
            objective_id: objectiveId,
            code: formData.code.trim(),
            title: formData.title.trim(),
            owner_name: formData.owner_name.trim() || null,
            metric_type: formData.metric_type,
            unit: getDefaultUnit(formData.metric_type),
            currency_type: formData.metric_type === 'currency' ? formData.currency_type : null,
            target_direction: targetDirection,
            scope: effectiveScope,
            parent_kr_id: isEditMode ? keyResult?.parent_kr_id : (parentKr?.id || null),
            quarter: effectiveScope === 'quarterly' ? quarter : null,
            due_date: dueDate,
            baseline,
            target,
            actual,
            progress,
            confidence: formData.confidence,
            notes: formData.notes.trim() || null,
            is_active: true,
        }

        setLoading(true)
        setError(null)

        try {
            if (isEditMode && keyResult) {
                const { data, error: updateError } = await supabase
                    .from('key_results')
                    .update(payload)
                    .eq('id', keyResult.id)
                    .select('*')
                    .single()

                if (updateError) throw updateError

                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'key_results',
                    entity_id: keyResult.id,
                    entity_name: payload.title,
                    old_value: keyResult,
                    new_value: data,
                })
            } else {
                const { data, error: insertError } = await supabase
                    .from('key_results')
                    .insert(payload)
                    .select('*')
                    .single()

                if (insertError) throw insertError

                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'create',
                    entity_type: 'key_results',
                    entity_id: data.id,
                    entity_name: payload.title,
                    new_value: data,
                })
            }

            await onSaved()
            onOpenChange(false)
        } catch (saveError: unknown) {
            const message = saveError instanceof Error ? saveError.message : t('modals.createKR.errorSave')
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const ownerInOptions = assigneeOptions.some((assignee) => assignee.name === formData.owner_name)

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 mt-0.5">
                                {isEditMode ? (
                                    <Save className="w-5 h-5 text-[var(--color-primary)]" />
                                ) : (
                                    <Plus className="w-5 h-5 text-[var(--color-primary)]" />
                                )}
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {isEditMode ? t('modals.createKR.titleEdit') : t('modals.createKR.titleNew')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {isEditMode ? t('modals.createKR.subtitleEdit') : t('modals.createKR.subtitleNew')}
                                </Dialog.Description>
                                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                                    {objectiveCode} - {objectiveTitle}
                                </p>
                                {isChild && parentKr && (
                                    <p className="text-xs text-[var(--color-primary)] mt-1 inline-flex items-center gap-1">
                                        <GitBranch className="w-3 h-3" />
                                        {parentKr.code} - {parentKr.title}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Dialog.Close asChild>
                            <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="p-6 space-y-5 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label={`${t('modals.createKR.code')} *`}
                                value={formData.code}
                                onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value }))}
                                placeholder="KR-001"
                            />
                            <Input
                                label={`${t('modals.createKR.titleLabel')} *`}
                                value={formData.title}
                                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder={t('modals.createKR.titlePlaceholder')}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createKR.owner')}
                                </label>
                                <select
                                    value={formData.owner_name}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, owner_name: event.target.value }))}
                                    disabled={assigneesLoading}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-70"
                                >
                                    <option value="">
                                        {assigneesLoading ? t('modals.createKR.ownerLoading') : t('modals.createKR.ownerSelectPlaceholder')}
                                    </option>
                                    {formData.owner_name && !ownerInOptions && (
                                        <option value={formData.owner_name}>{formData.owner_name}</option>
                                    )}
                                    {assigneeOptions.map((assignee) => (
                                        <option key={assignee.id} value={assignee.name}>
                                            {assignee.name}
                                        </option>
                                    ))}
                                </select>
                                {!assigneesLoading && assigneeOptions.length === 0 && (
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                                        {t('modals.createKR.ownerNoUsers')}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createKR.scope')}
                                </label>
                                <select
                                    value={isScopeLockedByParent ? 'quarterly' : formData.scope}
                                    onChange={(event) => handleScopeChange(event.target.value as KRFormData['scope'])}
                                    disabled={isScopeLockedByParent}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-70"
                                >
                                    <option value="annual">{t('modals.createKR.scopeAnnual')}</option>
                                    <option value="quarterly">{t('modals.createKR.scopeQuarterly')}</option>
                                </select>
                                {isScopeLockedByParent && (
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                                        {t('modals.createKR.scopeLockedByParent')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {(isScopeLockedByParent || formData.scope === 'quarterly') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                        {t('modals.createKR.quarter')}
                                    </label>
                                    <select
                                        value={formData.quarter}
                                        onChange={(event) => handleQuarterChange(event.target.value)}
                                        className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                    >
                                        <option value="">-</option>
                                        <option value="1">Q1</option>
                                        <option value="2">Q2</option>
                                        <option value="3">Q3</option>
                                        <option value="4">Q4</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label={`${t('deadline.label')} *`}
                                type="date"
                                value={formData.due_date}
                                onChange={(event) => setFormData((prev) => ({ ...prev, due_date: event.target.value }))}
                                placeholder={t('deadline.selectDate')}
                                required
                            />
                        </div>

                        <div className={`grid grid-cols-1 gap-4 ${formData.metric_type === 'currency' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createKR.metricType')}
                                </label>
                                <select
                                    value={formData.metric_type}
                                    onChange={(event) => handleMetricTypeChange(event.target.value as KRFormData['metric_type'])}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="percentage">{t('modals.createKR.metrics.percentage')}</option>
                                    <option value="number">{t('modals.createKR.metrics.number')}</option>
                                    <option value="currency">{t('modals.createKR.metrics.currency')}</option>
                                    <option value="days">{t('modals.createKR.metrics.days')}</option>
                                </select>
                            </div>

                            {formData.metric_type === 'currency' && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                        {t('modals.createKR.currency')}
                                    </label>
                                    <select
                                        value={formData.currency_type}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, currency_type: event.target.value as KRFormData['currency_type'] }))}
                                        className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                    >
                                        <option value="BRL">BRL</option>
                                        <option value="USD">USD</option>
                                        <option value="ARS">ARS</option>
                                        <option value="GBP">GBP</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('targetDirection.label')}
                                </label>
                                <select
                                    value={formData.target_direction}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, target_direction: event.target.value as KRFormData['target_direction'] }))}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="maximize">{t('targetDirection.maximize')}</option>
                                    <option value="minimize">{t('targetDirection.minimize')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label={t('quarterlyCard.baseline')}
                                value={formData.baseline}
                                onChange={(event) => setFormData((prev) => ({ ...prev, baseline: event.target.value }))}
                                placeholder="0"
                            />
                            <Input
                                label={t('quarterlyCard.target')}
                                value={formData.target}
                                onChange={(event) => setFormData((prev) => ({ ...prev, target: event.target.value }))}
                                placeholder="0"
                            />
                            <Input
                                label={t('quarterlyCard.actual')}
                                value={formData.actual}
                                onChange={(event) => setFormData((prev) => ({ ...prev, actual: event.target.value }))}
                                placeholder="0"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('quarterlyCard.confidence')}
                                </label>
                                <select
                                    value={formData.confidence || ''}
                                    onChange={(event) => {
                                        const value = event.target.value as ConfidenceLevel | ''
                                        setFormData((prev) => ({ ...prev, confidence: value || null }))
                                    }}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="">{t('modals.createKR.confidenceNotSet')}</option>
                                    <option value="on_track">{t('modals.createKR.confidenceOnTrack')}</option>
                                    <option value="at_risk">{t('modals.createKR.confidenceAtRisk')}</option>
                                    <option value="off_track">{t('modals.createKR.confidenceOffTrack')}</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                {t('monthly.notes')}
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                                rows={2}
                                className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                placeholder={t('monthly.notesPlaceholder')}
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={loading}>
                            {isEditMode ? t('modals.createKR.saveEdit') : t('modals.createKR.saveNew')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
