import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Save, Target, Plus, Database } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface Pillar {
    id: string
    code: string
    name: string
    icon: string
    color: string
}

interface Unit {
    id: string
    name: string
    code: string
}

interface CreateObjectiveModalV2Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: () => void
    pillars: Pillar[]
    units: Unit[]
    defaultPillarId?: string
}

export function CreateObjectiveModalV2({
    open,
    onOpenChange,
    onSave,
    pillars,
    units,
    defaultPillarId
}: CreateObjectiveModalV2Props) {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        code: '',
        title: '',
        description: '',
        pillar_id: defaultPillarId || '',
        business_unit_id: units.length > 0 ? units[0].id : '',
        year: 2026
    })

    useEffect(() => {
        if (open) {
            setFormData({
                code: '',
                title: '',
                description: '',
                pillar_id: defaultPillarId || pillars[0]?.id || '',
                business_unit_id: units.length > 0 ? units[0].id : '',
                year: 2026
            })
            setError(null)
        }
    }, [open, defaultPillarId, pillars, units])

    // Auto-generate code with PILLAR-N format
    useEffect(() => {
        async function generateCode() {
            if (!open || !formData.pillar_id || !formData.business_unit_id) return

            try {
                // Get pillar code for prefix
                const selectedPillar = pillars.find(p => p.id === formData.pillar_id)
                const pillarCode = selectedPillar?.code || 'OBJ'

                // Find last objective for this pillar + unit + year to get next sequence
                const { data } = await supabase
                    .from('objectives')
                    .select('code')
                    .eq('pillar_id', formData.pillar_id)
                    .eq('business_unit_id', formData.business_unit_id)
                    .eq('year', formData.year)
                    .order('created_at', { ascending: false })

                let nextNumber = 1
                if (data && data.length > 0) {
                    // Find the highest number from existing codes
                    // Codes can be: "RENT-1", "RENT-2", "OBJ-RENT", "1", etc.
                    const numbers = data.map(obj => {
                        const code = obj.code
                        // Try to extract number from formats like "RENT-1" or just "1"
                        const match = code.match(/-(\d+)$/) || code.match(/^(\d+)$/)
                        return match ? parseInt(match[1]) : 0
                    })
                    const maxNumber = Math.max(...numbers, 0)
                    nextNumber = maxNumber + 1
                }

                setFormData(prev => ({ ...prev, code: `${pillarCode}-${nextNumber}` }))
            } catch (err) {
                console.error('Error generating code:', err)
            }
        }

        generateCode()
    }, [formData.pillar_id, formData.business_unit_id, formData.year, open, pillars])


    async function handleSave() {
        if (!user || !formData.pillar_id || !formData.business_unit_id || !formData.code.trim() || !formData.title.trim()) {
            setError(t('modals.createObjective.errorRequired'))
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error: insertError } = await supabase
                .from('objectives')
                .insert({
                    code: formData.code.trim(),
                    title: formData.title.trim(),
                    description: (formData.description || '').trim() || null,
                    pillar_id: formData.pillar_id,
                    business_unit_id: formData.business_unit_id,
                    year: formData.year,
                    is_active: true
                })

            if (insertError) throw insertError

            // Audit log
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                user_email: user.email,
                action: 'create',
                entity_type: 'objectives',
                entity_id: 'new', // We don't have ID unless we select(), but 'new' is fine for audit or we select()
                entity_name: formData.title
            })

            onSave()
            onOpenChange(false)
        } catch (err: any) {
            setError(err.message || t('modals.createObjective.errorSave'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                                <Plus className="w-5 h-5 text-[var(--color-primary)]" />
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {t('modals.createObjective.title')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {t('modals.createObjective.subtitle')}
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
                        {/* Unit & Pillar */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createObjective.unit')} *
                                </label>
                                <select
                                    value={formData.business_unit_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, business_unit_id: e.target.value }))}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    {units.map((unit) => (
                                        <option key={unit.id} value={unit.id}>
                                            {unit.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    {t('modals.createObjective.pillar')} *
                                </label>
                                <select
                                    value={formData.pillar_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, pillar_id: e.target.value }))}
                                    className="w-full h-11 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    {pillars.map((pillar) => (
                                        <option key={pillar.id} value={pillar.id}>
                                            {pillar.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Code & Title */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <Input
                                    label={`${t('modals.createObjective.code')} *`}
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    placeholder={t('modals.createObjective.codePlaceholder')}
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    label={`${t('modals.createObjective.titleLabel')} *`}
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder={t('modals.createObjective.titlePlaceholder')}
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                {t('modals.createObjective.description')}
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-h-[100px] resize-none"
                                placeholder={t('modals.createObjective.descriptionPlaceholder')}
                            />
                        </div>

                        {/* Year */}
                        <div>
                            <Input
                                label={t('modals.createObjective.year')}
                                type="number"
                                value={formData.year.toString()}
                                onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) || 2026 }))}
                            />
                        </div>


                        {error && (
                            <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            {t('modals.createObjective.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={loading}>
                            <Save className="w-4 h-4" />
                            {t('modals.createObjective.save')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
