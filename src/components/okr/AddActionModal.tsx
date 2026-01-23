import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import { X, Save, ListTodo, Calendar, ChevronDown, Check } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'

interface KeyResultOption {
    id: string
    code: string
    title: string
    objective: {
        title: string
        business_unit: {
            name: string
        } | null
    } | null
}

interface AddActionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: () => void
    preSelectedKRId?: string
}

export function AddActionModal({ open, onOpenChange, onSave, preSelectedKRId }: AddActionModalProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [keyResults, setKeyResults] = useState<KeyResultOption[]>([])

    // Form state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [selectedKRId, setSelectedKRId] = useState(preSelectedKRId || '')
    const [dueDate, setDueDate] = useState('')
    const [openSelect, setOpenSelect] = useState(false)

    useEffect(() => {
        if (open) {
            loadKeyResults()
            if (preSelectedKRId) {
                setSelectedKRId(preSelectedKRId)
            }
        }
    }, [open, preSelectedKRId])

    async function loadKeyResults() {
        try {
            const { data, error } = await supabase
                .from('key_results')
                .select(`
                    id,
                    code,
                    title,
                    objective:objectives(title, business_unit:business_units(name))
                `)
                .eq('is_active', true)
                .order('code')

            if (error) throw error
            setKeyResults((data || []) as unknown as KeyResultOption[])
        } catch (err) {
            console.error('Error loading KRs:', err)
        }
    }

    async function handleSave() {
        if (!user || !selectedKRId || !title.trim()) {
            setError('Preencha todos os campos obrigatórios')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { data, error: insertError } = await supabase
                .from('actions')
                .insert({
                    title: title.trim(),
                    description: description.trim() || null,
                    key_result_id: selectedKRId,
                    due_date: dueDate || null,
                    status: 'pending',
                    owner_name: user.user_metadata?.full_name || user.email
                })
                .select()
                .single()

            if (insertError) throw insertError

            // Create audit log
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                action: 'create',
                entity_type: 'actions',
                entity_id: data.id,
                entity_name: data.title,
                old_value: null,
                new_value: data
            })

            // Reset form
            setTitle('')
            setDescription('')
            setSelectedKRId('')
            setDueDate('')

            onSave()
            onOpenChange(false)
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar')
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
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-success)]/15">
                                <ListTodo className="w-5 h-5 text-[var(--color-success)]" />
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    Nova Ação
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    Adicione uma iniciativa vinculada a um KR
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
                        {/* Title */}
                        <Input
                            label="Título da Ação *"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Implementar sistema de gestão visual"
                        />

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                Descrição
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhes adicionais sobre a ação..."
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                            />
                        </div>

                        {/* Key Result Selection */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                Key Result Vinculado *
                            </label>
                            <Popover.Root open={openSelect} onOpenChange={setOpenSelect} modal>
                                <Popover.Trigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            "w-full min-h-[44px] px-4 py-2 text-left rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] flex items-center justify-between gap-2 transition-colors",
                                            !selectedKRId && "text-[var(--color-text-muted)]"
                                        )}
                                    >
                                        <span className="block truncate whitespace-normal text-sm leading-tight">
                                            {selectedKRId
                                                ? (() => {
                                                    const kr = keyResults.find(k => k.id === selectedKRId)
                                                    if (!kr) return 'Selecione um KR'
                                                    return `[${kr.objective?.business_unit?.name || 'N/A'}] ${kr.code} - ${kr.title}`
                                                })()
                                                : 'Selecione um KR'}
                                        </span>
                                        <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                                    </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                    <Popover.Content
                                        className="w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl z-[9999] animate-in fade-in-0 zoom-in-95 pointer-events-auto"
                                        sideOffset={5}
                                        align="start"
                                    >
                                        <div className="space-y-1">
                                            {keyResults.map((kr) => {
                                                const isSelected = selectedKRId === kr.id
                                                return (
                                                    <button
                                                        key={kr.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedKRId(kr.id)
                                                            setOpenSelect(false)
                                                        }}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-start gap-2",
                                                            isSelected
                                                                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                                                : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]"
                                                        )}
                                                    >
                                                        <div className="flex-1 break-words">
                                                            <span className="font-semibold">[{kr.objective?.business_unit?.name || 'N/A'}]</span>
                                                            <span className="mx-1 text-[var(--color-text-muted)]">•</span>
                                                            <span>{kr.code} - {kr.title}</span>
                                                        </div>
                                                        {isSelected && (
                                                            <Check className="w-4 h-4 mt-0.5" />
                                                        )}
                                                    </button>
                                                )
                                            })}
                                            {keyResults.length === 0 && (
                                                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">
                                                    Nenhum KR encontrado
                                                </div>
                                            )}
                                        </div>
                                    </Popover.Content>
                                </Popover.Portal>
                            </Popover.Root>
                        </div>

                        {/* Due Date */}
                        <Input
                            type="date"
                            label="Data Limite"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            icon={<Calendar className="w-5 h-5" />}
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
                            Criar Ação
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
