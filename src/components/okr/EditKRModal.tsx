import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Save, TrendingUp, Target } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ProgressBar } from '../ui/ProgressBar'
import { Badge } from '../ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { calculateProgress, cn } from '../../lib/utils'

interface KeyResultData {
    id: string
    code: string
    title: string
    metric_type: string
    baseline: number
    target: number
    current_value: number
    unit: string
    objective?: {
        title: string
        country: string
    }
}

interface EditKRModalProps {
    keyResult: KeyResultData | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: () => void
}

export function EditKRModal({ keyResult, open, onOpenChange, onSave }: EditKRModalProps) {
    const { user } = useAuth()
    const [currentValue, setCurrentValue] = useState<string>('')
    const [loading, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (keyResult) {
            setCurrentValue(keyResult.current_value.toString())
        }
    }, [keyResult])

    if (!keyResult) return null

    const progress = calculateProgress(
        parseFloat(currentValue) || keyResult.current_value,
        keyResult.target
    )

    async function handleSave() {
        if (!user) return

        setSaving(true)
        setError(null)

        try {
            const newValue = parseFloat(currentValue)

            if (isNaN(newValue)) {
                throw new Error('Valor inválido')
            }

            // Get old data for audit
            const { data: oldData } = await supabase
                .from('key_results')
                .select('*')
                .eq('id', keyResult!.id)
                .single()

            // Update the key result
            const { data: newData, error: updateError } = await supabase
                .from('key_results')
                .update({
                    current_value: newValue,
                    updated_at: new Date().toISOString()
                })
                .eq('id', keyResult!.id)
                .select()
                .single()

            if (updateError) throw updateError

            // Create audit log
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                action: 'update',
                entity_type: 'key_results',
                entity_id: keyResult!.id,
                old_value: oldData,
                new_value: newData
            })

            onSave()
            onOpenChange(false)
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                                <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    Atualizar Key Result
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    Atualize o valor atual do KR
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
                    <div className="p-6 space-y-6">
                        {/* KR Info */}
                        <div className="p-4 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-surface)]">
                                    <span className="text-sm font-bold text-[var(--color-accent-cyan)]">{keyResult.code}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-[var(--color-text-primary)]">{keyResult.title}</p>
                                    {keyResult.objective && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" size="sm">{keyResult.objective.country}</Badge>
                                            <span className="text-xs text-[var(--color-text-muted)]">{keyResult.objective.title}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-[var(--color-surface-elevated)] text-center">
                                <p className="text-xs text-[var(--color-text-muted)] mb-1">Baseline</p>
                                <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                                    {keyResult.baseline} {keyResult.unit}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-[var(--color-primary)]/10 text-center border-2 border-[var(--color-primary)]/30">
                                <p className="text-xs text-[var(--color-primary)] mb-1">Atual</p>
                                <p className="text-lg font-bold text-[var(--color-primary)]">
                                    {currentValue || keyResult.current_value} {keyResult.unit}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-[var(--color-surface-elevated)] text-center">
                                <p className="text-xs text-[var(--color-text-muted)] mb-1">Target</p>
                                <p className="text-lg font-bold text-[var(--color-success)]">
                                    {keyResult.target} {keyResult.unit}
                                </p>
                            </div>
                        </div>

                        {/* Progress Preview */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[var(--color-text-muted)]">Progresso</span>
                                <Badge variant={progress >= 70 ? 'success' : progress >= 40 ? 'warning' : 'danger'}>
                                    {Math.round(progress)}%
                                </Badge>
                            </div>
                            <ProgressBar value={progress} size="lg" variant="gradient" />
                        </div>

                        {/* Input */}
                        <Input
                            type="number"
                            label="Novo valor atual"
                            value={currentValue}
                            onChange={(e) => setCurrentValue(e.target.value)}
                            placeholder={`Ex: ${keyResult.target}`}
                            icon={<Target className="w-5 h-5" />}
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
                            Salvar Alteração
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
