import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Check, Crown } from 'lucide-react'
import { Button } from '../ui/Button'
import type { UserWithUnits } from '../../types'
import { useTranslation } from 'react-i18next'
import { formatUsername } from '../../lib/utils'

interface TeamEditModalProps {
    isOpen: boolean
    onClose: () => void
    team: { id?: string; name: string; description: string | null } | null
    allUsers: UserWithUnits[]
    currentLeaderId: string | null
    currentMemberIds: string[]
    onSave: (data: {
        id?: string
        name: string
        description: string | null
        leaderId: string | null
        memberIds: string[]
    }) => Promise<void>
}

export function TeamEditModal({
    isOpen,
    onClose,
    team,
    allUsers,
    currentLeaderId,
    currentMemberIds,
    onSave,
}: TeamEditModalProps) {
    const { t } = useTranslation()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [leaderId, setLeaderId] = useState<string | null>(null)
    const [memberIds, setMemberIds] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setName(team?.name || '')
            setDescription(team?.description || '')
            setLeaderId(currentLeaderId)
            setMemberIds(currentMemberIds)
        }
    }, [isOpen, team, currentLeaderId, currentMemberIds])

    const handleToggleMember = (userId: string) => {
        if (userId === leaderId) return // não pode desmarcar o líder dos membros
        setMemberIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const handleSetLeader = (userId: string) => {
        if (leaderId === userId) {
            setLeaderId(null)
        } else {
            setLeaderId(userId)
            // garantir que o líder está na lista de membros
            if (!memberIds.includes(userId)) {
                setMemberIds(prev => [...prev, userId])
            }
        }
    }

    const handleSave = async () => {
        if (!name.trim()) return
        setIsSaving(true)
        try {
            await onSave({
                id: team?.id,
                name: name.trim(),
                description: description.trim() || null,
                leaderId,
                memberIds,
            })
            onClose()
        } catch (error) {
            console.error('Failed to save team', error)
        } finally {
            setIsSaving(false)
        }
    }

    const isEditing = !!team?.id

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[560px] translate-x-[-50%] translate-y-[-50%] rounded-[1.5rem] bg-[var(--color-surface)] p-6 shadow-2xl focus:outline-none z-50 border border-[var(--color-border)] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-xl font-bold text-[var(--color-text-primary)]">
                            {isEditing ? t('teams.editTeam', 'Editar Time') : t('teams.newTeam', 'Novo Time')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="space-y-5">
                        {/* Nome */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)]">
                                {t('teams.name', 'Nome')} *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
                                placeholder={t('teams.namePlaceholder', 'Ex: Time de Produto, Comercial Sul...')}
                            />
                        </div>

                        {/* Descrição */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)]">
                                {t('teams.description', 'Descrição')}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 resize-none"
                                placeholder={t('teams.descriptionPlaceholder', 'Descrição opcional...')}
                            />
                        </div>

                        {/* Seleção de Líder */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)] flex items-center gap-2">
                                <Crown className="w-4 h-4 text-amber-500" />
                                {t('teams.leader', 'Líder')}
                            </label>
                            <div className="max-h-36 overflow-y-auto space-y-1 border border-[var(--color-border)] rounded-xl p-2 bg-[var(--color-surface-elevated)]">
                                {allUsers.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleSetLeader(user.id)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer select-none transition-colors ${leaderId === user.id
                                            ? 'bg-amber-500/10 border border-amber-500/30'
                                            : 'hover:bg-[var(--color-surface-hover)]'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${leaderId === user.id
                                            ? 'bg-amber-500 border-amber-500 text-white'
                                            : 'border-[var(--color-text-muted)]'
                                            }`}>
                                            {leaderId === user.id && <Crown className="w-3 h-3" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm text-[var(--color-text-secondary)]">
                                                {user.full_name}
                                                {user.user_business_units?.length > 0 && (
                                                    <span className="inline-flex flex-wrap gap-1 ml-2">
                                                        {user.user_business_units.map(ubu => (
                                                            <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                                {ubu.business_units.code}
                                                            </span>
                                                        ))}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-xs text-[var(--color-text-muted)]">{formatUsername(user.email)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Membros do Time */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)]">
                                {t('teams.teamMembers', 'Membros do Time')}
                            </label>
                            <div className="max-h-48 overflow-y-auto space-y-1 border border-[var(--color-border)] rounded-xl p-2 bg-[var(--color-surface-elevated)]">
                                {allUsers.map(user => {
                                    const isLeader = leaderId === user.id
                                    const isSelected = memberIds.includes(user.id)
                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => handleToggleMember(user.id)}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer select-none transition-colors ${isLeader ? 'opacity-60 cursor-default' : 'hover:bg-[var(--color-surface-hover)]'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                : 'border-[var(--color-text-muted)]'
                                                }`}>
                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-sm text-[var(--color-text-secondary)] truncate">
                                                    {user.full_name}
                                                    {user.user_business_units?.length > 0 && (
                                                        <span className="inline-flex flex-wrap gap-1 ml-2">
                                                            {user.user_business_units.map(ubu => (
                                                                <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                                    {ubu.business_units.code}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    )}
                                                </span>
                                                {isLeader && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex-shrink-0">
                                                        {t('teams.leaderLabel', 'Líder')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <Button variant="outline" onClick={onClose} disabled={isSaving}>
                            {t('common.cancel', 'Cancelar')}
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
                            {isSaving
                                ? t('teams.saving', 'Salvando...')
                                : isEditing
                                    ? t('teams.saveChanges', 'Salvar Alterações')
                                    : t('teams.create', 'Criar Time')
                            }
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
