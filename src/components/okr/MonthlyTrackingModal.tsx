import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Calendar, Save } from 'lucide-react'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { MonthlyData } from '../../types'

interface MonthlyTrackingModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    keyResultId: string
    keyResultTitle: string
    keyResultUnit: string
    keyResultMetricType: string
    scope: 'annual' | 'quarterly'
    quarter?: number | null // If quarterly, which quarter (1-4)
    year?: number
}

const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril',
    'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril',
    'Mayo', 'Junio', 'Julio', 'Agosto',
    'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getMonthsForScope(scope: 'annual' | 'quarterly', quarter?: number | null): number[] {
    if (scope === 'annual') {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    }
    if (quarter) {
        const start = (quarter - 1) * 3 + 1
        return [start, start + 1, start + 2]
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

export function MonthlyTrackingModal({
    open,
    onOpenChange,
    keyResultId,
    keyResultTitle,
    keyResultUnit,
    keyResultMetricType,
    scope,
    quarter,
    year = 2026
}: MonthlyTrackingModalProps) {
    const { t, i18n } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [monthlyData, setMonthlyData] = useState<Record<number, { actual: string; notes: string; id?: string }>>({})

    const months = getMonthsForScope(scope, quarter)
    const monthNames = i18n.language === 'es' ? MONTHS_ES : MONTHS_PT

    useEffect(() => {
        if (open && keyResultId) {
            loadMonthlyData()
        }
    }, [open, keyResultId])

    async function loadMonthlyData() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('kr_monthly_data')
                .select('*')
                .eq('key_result_id', keyResultId)
                .eq('year', year)
                .order('month')

            if (error) throw error

            const dataMap: Record<number, { actual: string; notes: string; id?: string }> = {}
            months.forEach(m => {
                const existing = (data as MonthlyData[])?.find(d => d.month === m)
                dataMap[m] = {
                    actual: existing?.actual?.toString() ?? '',
                    notes: existing?.notes ?? '',
                    id: existing?.id
                }
            })
            setMonthlyData(dataMap)
        } catch (err) {
            console.error('Error loading monthly data:', err)
        } finally {
            setLoading(false)
        }
    }

    function handleChange(month: number, field: 'actual' | 'notes', value: string) {
        setMonthlyData(prev => ({
            ...prev,
            [month]: {
                ...prev[month],
                [field]: value
            }
        }))
    }

    async function handleSave() {
        if (!user) return
        setSaving(true)
        try {
            const upserts = months
                .filter(m => monthlyData[m]?.actual !== '' || monthlyData[m]?.notes !== '')
                .map(m => ({
                    key_result_id: keyResultId,
                    month: m,
                    year,
                    actual: monthlyData[m]?.actual !== '' ? parseFloat(monthlyData[m].actual) : null,
                    notes: monthlyData[m]?.notes || null
                }))

            if (upserts.length > 0) {
                const { error } = await supabase
                    .from('kr_monthly_data')
                    .upsert(upserts, { onConflict: 'key_result_id,month,year' })

                if (error) throw error
            }

            onOpenChange(false)
        } catch (err) {
            console.error('Error saving monthly data:', err)
        } finally {
            setSaving(false)
        }
    }

    function formatUnit() {
        if (keyResultMetricType === 'currency') return 'R$'
        return keyResultUnit || ''
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                                <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {t('monthly.title')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)] max-w-md truncate">
                                    {keyResultTitle}
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
                    <div className="p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Table header */}
                                <div className="grid grid-cols-[140px_1fr_1fr] gap-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-1">
                                    <span>{t('monthly.month')}</span>
                                    <span>{t('monthly.actual')} ({formatUnit()})</span>
                                    <span>{t('monthly.notes')}</span>
                                </div>

                                {/* Month rows */}
                                {months.map(month => (
                                    <div
                                        key={month}
                                        className="grid grid-cols-[140px_1fr_1fr] gap-3 items-center p-3 rounded-xl bg-[var(--color-surface-hover)]/50 hover:bg-[var(--color-surface-hover)] transition-colors"
                                    >
                                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                            {monthNames[month - 1]}
                                        </span>
                                        <input
                                            type="number"
                                            value={monthlyData[month]?.actual ?? ''}
                                            onChange={e => handleChange(month, 'actual', e.target.value)}
                                            className="h-9 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-full"
                                            placeholder="—"
                                        />
                                        <input
                                            type="text"
                                            value={monthlyData[month]?.notes ?? ''}
                                            onChange={e => handleChange(month, 'notes', e.target.value)}
                                            className="h-9 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-full"
                                            placeholder={t('monthly.notesPlaceholder')}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={saving}>
                            <Save className="w-4 h-4" />
                            {t('common.save')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
