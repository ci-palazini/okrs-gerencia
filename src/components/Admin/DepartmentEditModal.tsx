import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Check, Crown } from 'lucide-react'
import { Button } from '../ui/Button'
import type { UserWithUnits } from '../../types'
import { useTranslation } from 'react-i18next'
import { formatUsername } from '../../lib/utils'

interface DepartmentEditModalProps {
    isOpen: boolean
    onClose: () => void
    department: { id?: string; name: string; description: string | null } | null
    allUsers: UserWithUnits[]
    currentManagerId: string | null
    currentMemberIds: string[]
    /** IDs de usuários que já estão em OUTRO departamento (disabled na lista) */
    usersInOtherDepartments: string[]
    onSave: (data: {
        id?: string
        name: string
        description: string | null
        managerId: string | null
        memberIds: string[]
    }) => Promise<void>
}

export function DepartmentEditModal({
    isOpen,
    onClose,
    department,
    allUsers,
    currentManagerId,
    currentMemberIds,
    usersInOtherDepartments,
    onSave,
}: DepartmentEditModalProps) {
    const { t } = useTranslation()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [managerId, setManagerId] = useState<string | null>(null)
    const [memberIds, setMemberIds] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setName(department?.name || '')
            setDescription(department?.description || '')
            setManagerId(currentManagerId)
            setMemberIds(currentMemberIds)
        }
    }, [isOpen, department, currentManagerId, currentMemberIds])

    const handleToggleMember = (userId: string) => {
        if (userId === managerId) return // can't uncheck the manager from members
        setMemberIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const handleSetManager = (userId: string) => {
        if (managerId === userId) {
            setManagerId(null)
        } else {
            setManagerId(userId)
            // also make sure the manager is in the members list
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
                id: department?.id,
                name: name.trim(),
                description: description.trim() || null,
                managerId,
                memberIds,
            })
            onClose()
        } catch (error) {
            console.error('Failed to save department', error)
        } finally {
            setIsSaving(false)
        }
    }

    const isEditing = !!department?.id

    // Available users: admins are always selectable; for non-admins, only those not in OTHER departments
    const availableUsers = allUsers.filter(u => {
        const isInThisDept = currentMemberIds.includes(u.id)
        const isInOtherDept = usersInOtherDepartments.includes(u.id)
        return isInThisDept || !isInOtherDept
    })

    // Users that are in another department (show disabled if they happen to appear)
    const disabledUsers = allUsers.filter(u => {
        return usersInOtherDepartments.includes(u.id) && !currentMemberIds.includes(u.id)
    })

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[560px] translate-x-[-50%] translate-y-[-50%] rounded-[1.5rem] bg-[var(--color-surface)] p-6 shadow-2xl focus:outline-none z-50 border border-[var(--color-border)] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-xl font-bold text-[var(--color-text-primary)]">
                            {isEditing ? t('departments.editDepartment', 'Editar Departamento') : t('departments.newDepartment', 'Novo Departamento')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="space-y-5">
                        {/* Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)]">
                                {t('departments.name', 'Nome')} *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
                                placeholder={t('departments.namePlaceholder', 'Ex: Engenharia, Comercial...')}
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)]">
                                {t('departments.description', 'Descrição')}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 resize-none"
                                placeholder={t('departments.descriptionPlaceholder', 'Descrição opcional...')}
                            />
                        </div>

                        {/* Manager Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)] flex items-center gap-2">
                                <Crown className="w-4 h-4 text-amber-500" />
                                {t('departments.manager', 'Gerente')}
                            </label>
                            <div className="max-h-36 overflow-y-auto space-y-1 border border-[var(--color-border)] rounded-xl p-2 bg-[var(--color-surface-elevated)]">
                                {availableUsers.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleSetManager(user.id)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer select-none transition-colors ${managerId === user.id
                                            ? 'bg-amber-500/10 border border-amber-500/30'
                                            : 'hover:bg-[var(--color-surface-hover)]'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${managerId === user.id
                                            ? 'bg-amber-500 border-amber-500 text-white'
                                            : 'border-[var(--color-text-muted)]'
                                            }`}>
                                            {managerId === user.id && <Crown className="w-3 h-3" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm text-[var(--color-text-secondary)]">
                                                {user.full_name}
                                                {user.user_business_units?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 ml-2 inline-flex">
                                                        {user.user_business_units.map(ubu => (
                                                            <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                                {ubu.business_units.code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </span>
                                            <span className="text-xs text-[var(--color-text-muted)]">{formatUsername(user.email)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Team Members */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--color-text-muted)]">
                                {t('departments.teamMembers', 'Membros do Time')}
                            </label>
                            <div className="max-h-48 overflow-y-auto space-y-1 border border-[var(--color-border)] rounded-xl p-2 bg-[var(--color-surface-elevated)]">
                                {availableUsers.map(user => {
                                    const isManager = managerId === user.id
                                    const isSelected = memberIds.includes(user.id)
                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => handleToggleMember(user.id)}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer select-none transition-colors ${isManager ? 'opacity-60 cursor-default' : 'hover:bg-[var(--color-surface-hover)]'
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
                                                        <div className="flex flex-wrap gap-1 ml-2 inline-flex">
                                                            {user.user_business_units.map(ubu => (
                                                                <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                                    {ubu.business_units.code}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </span>
                                                {isManager && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex-shrink-0">
                                                        {t('departments.managerLabel', 'Gerente')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* Show disabled users from other departments */}
                                {disabledUsers.map(user => (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-3 p-2 rounded-lg opacity-40 cursor-not-allowed select-none"
                                        title={t('departments.userInOtherDept', 'Usuário já pertence a outro departamento')}
                                    >
                                        <div className="w-5 h-5 rounded border border-[var(--color-text-muted)] flex items-center justify-center" />
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-sm text-[var(--color-text-muted)] truncate">{user.full_name}</span>
                                            <span className="text-xs text-[var(--color-text-muted)] italic flex-shrink-0">
                                                {t('departments.otherDept', 'outro dept.')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <Button variant="outline" onClick={onClose} disabled={isSaving}>
                            {t('common.cancel', 'Cancelar')}
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
                            {isSaving
                                ? t('departments.saving', 'Salvando...')
                                : isEditing
                                    ? t('departments.saveChanges', 'Salvar Alterações')
                                    : t('departments.create', 'Criar Departamento')
                            }
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
