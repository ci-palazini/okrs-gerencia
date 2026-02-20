import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import { X, Save, ListTodo, Calendar, ChevronDown, Check, User } from 'lucide-react'
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
        business_unit_id: string | null
        business_unit: {
            id: string
            name: string
        } | null
    } | null
}

interface UnitUser {
    id: string
    full_name: string
}

interface AddActionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: () => void
    preSelectedKRId?: string
    actionToEdit?: {
        id: string
        title: string
        description: string | null
        due_date: string | null
        key_result_id: string
        owner_name: string | null
        status: string // Needed for audit log
    } | null
}

export function AddActionModal({ open, onOpenChange, onSave, preSelectedKRId, actionToEdit }: AddActionModalProps) {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [keyResults, setKeyResults] = useState<KeyResultOption[]>([])
    const [unitUsers, setUnitUsers] = useState<UnitUser[]>([])

    // Form state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [selectedKRId, setSelectedKRId] = useState(preSelectedKRId || '')
    const [dueDate, setDueDate] = useState('')
    const [ownerName, setOwnerName] = useState('')
    const [openSelect, setOpenSelect] = useState(false)
    const [openAssignee, setOpenAssignee] = useState(false)

    useEffect(() => {
        if (open) {
            loadKeyResults()
            if (actionToEdit) {
                setTitle(actionToEdit.title)
                setDescription(actionToEdit.description || '')
                setSelectedKRId(actionToEdit.key_result_id)
                setDueDate(actionToEdit.due_date || '')
                setOwnerName(actionToEdit.owner_name || '')
            } else {
                setTitle('')
                setDescription('')
                setSelectedKRId(preSelectedKRId || '')
                setDueDate('')
                setOwnerName(user?.full_name || user?.email || '')
            }
        }
    }, [open, preSelectedKRId, actionToEdit])

    // When selected KR changes, load users for that business unit
    useEffect(() => {
        if (!selectedKRId) { setUnitUsers([]); return }
        const kr = keyResults.find(k => k.id === selectedKRId)
        const unitId = kr?.objective?.business_unit?.id ?? null
        if (!unitId) { setUnitUsers([]); return }
        loadUnitUsers(unitId)
    }, [selectedKRId, keyResults])

    async function loadKeyResults() {
        try {
            const { data, error } = await supabase
                .from('key_results')
                .select(`
                    id,
                    code,
                    title,
                    objective:objectives(title, business_unit_id, business_unit:business_units(id, name))
                `)
                .eq('is_active', true)
                .order('code')

            if (error) throw error
            setKeyResults((data || []) as unknown as KeyResultOption[])
        } catch (err) {
            console.error('Error loading KRs:', err)
        }
    }

    async function loadUnitUsers(unitId: string) {
        try {
            const { data, error } = await supabase
                .from('user_business_units')
                .select('users(id, full_name)')
                .eq('business_unit_id', unitId)

            if (error) throw error
            const users = (data || [])
                .map((row: any) => row.users)
                .filter(Boolean)
                .sort((a: UnitUser, b: UnitUser) => a.full_name.localeCompare(b.full_name))
            setUnitUsers(users)
        } catch (err) {
            console.error('Error loading unit users:', err)
            setUnitUsers([])
        }
    }

    async function handleSave() {
        if (!user || !selectedKRId || !title.trim()) {
            setError(t('modals.action.errorRequired'))
            return
        }

        setLoading(true)
        setError(null)

        try {
            if (actionToEdit) {
                // UPDATE
                const { data, error: updateError } = await supabase
                    .from('actions')
                    .update({
                        title: title.trim(),
                        description: description.trim() || null,
                        key_result_id: selectedKRId,
                        due_date: dueDate || null,
                        owner_name: ownerName.trim() || null,
                    })
                    .eq('id', actionToEdit.id)
                    .select()
                    .single()

                if (updateError) throw updateError

                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email || '',
                    action: 'update',
                    entity_type: 'actions',
                    entity_id: data.id,
                    entity_name: data.title,
                    old_value: actionToEdit,
                    new_value: data
                })

            } else {
                // CREATE
                const { data, error: insertError } = await supabase
                    .from('actions')
                    .insert({
                        title: title.trim(),
                        description: description.trim() || null,
                        key_result_id: selectedKRId,
                        due_date: dueDate || null,
                        status: 'pending',
                        owner_name: ownerName.trim() || user.full_name || user.email
                    })
                    .select()
                    .single()

                if (insertError) throw insertError

                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email || '',
                    action: 'create',
                    entity_type: 'actions',
                    entity_id: data.id,
                    entity_name: data.title,
                    old_value: null,
                    new_value: data
                })
            }

            setTitle('')
            setDescription('')
            setSelectedKRId('')
            setDueDate('')
            setOwnerName('')

            onSave()
            onOpenChange(false)
        } catch (err: any) {
            setError(err.message || t('modals.action.errorSave'))
        } finally {
            setLoading(false)
        }
    }

    const selectedKR = keyResults.find(k => k.id === selectedKRId)

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-success)]/15">
                                <ListTodo className="w-6 h-6 text-[var(--color-success)]" />
                            </div>
                            <div>
                                <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)]">
                                    {actionToEdit ? t('modals.action.titleEdit') : t('modals.action.titleNew')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {actionToEdit ? t('modals.action.subtitleEdit') : t('modals.action.subtitleNew')}
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
                        {/* Title */}
                        <Input
                            label={`${t('modals.action.titleLabel')} *`}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('modals.action.titlePlaceholder')}
                        />

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                {t('modals.action.description')}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('modals.action.descriptionPlaceholder')}
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                            />
                        </div>

                        {/* Key Result Selection */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                {t('modals.action.linkedKR')} *
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
                                            {selectedKR
                                                ? `[${selectedKR.objective?.business_unit?.name || 'N/A'}] ${selectedKR.code} - ${selectedKR.title}`
                                                : t('modals.action.selectKR')}
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
                                                        {isSelected && <Check className="w-4 h-4 mt-0.5" />}
                                                    </button>
                                                )
                                            })}
                                            {keyResults.length === 0 && (
                                                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">
                                                    {t('modals.action.noKRFound')}
                                                </div>
                                            )}
                                        </div>
                                    </Popover.Content>
                                </Popover.Portal>
                            </Popover.Root>
                        </div>

                        {/* Bottom row: Assignee + Due Date */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Assignee */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    <span className="flex items-center gap-1.5">
                                        <User className="w-4 h-4" />
                                        {t('modals.action.assignee')}
                                    </span>
                                </label>
                                <Popover.Root open={openAssignee} onOpenChange={setOpenAssignee} modal>
                                    <Popover.Trigger asChild>
                                        <button
                                            type="button"
                                            disabled={!selectedKRId}
                                            className={cn(
                                                "w-full min-h-[44px] px-4 py-2 text-left rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] flex items-center justify-between gap-2 transition-colors",
                                                (!selectedKRId || !ownerName) && "text-[var(--color-text-muted)]",
                                                !selectedKRId && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <span className="block truncate text-sm">
                                                {ownerName || t('modals.action.selectAssignee')}
                                            </span>
                                            <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                                        </button>
                                    </Popover.Trigger>
                                    <Popover.Portal>
                                        <Popover.Content
                                            className="w-[var(--radix-popover-trigger-width)] max-h-[240px] overflow-y-auto p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl z-[9999] animate-in fade-in-0 zoom-in-95 pointer-events-auto"
                                            sideOffset={5}
                                            align="start"
                                        >
                                            <div className="space-y-1">
                                                {unitUsers.length === 0 ? (
                                                    <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">
                                                        {t('modals.action.noUsersForUnit')}
                                                    </div>
                                                ) : (
                                                    unitUsers.map((u) => (
                                                        <button
                                                            key={u.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setOwnerName(u.full_name)
                                                                setOpenAssignee(false)
                                                            }}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                                                                ownerName === u.full_name
                                                                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                                                    : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]"
                                                            )}
                                                        >
                                                            <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-xs flex-shrink-0">
                                                                {u.full_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="flex-1">{u.full_name}</span>
                                                            {ownerName === u.full_name && <Check className="w-4 h-4" />}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </Popover.Content>
                                    </Popover.Portal>
                                </Popover.Root>
                            </div>

                            {/* Due Date */}
                            <Input
                                type="date"
                                label={t('modals.action.dueDate')}
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                icon={<Calendar className="w-5 h-5" />}
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)] flex-shrink-0">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            {t('modals.action.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={loading}>
                            <Save className="w-4 h-4" />
                            {actionToEdit ? t('modals.action.saveEdit') : t('modals.action.saveNew')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
