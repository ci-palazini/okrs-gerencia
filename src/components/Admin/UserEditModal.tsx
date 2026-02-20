import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Check, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Button } from '../ui/Button'
import type { BusinessUnit, UserWithUnits } from '../../types'
import { formatUsername } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'

interface UserEditModalProps {
    isOpen: boolean
    onClose: () => void
    user: UserWithUnits
    allUnits: BusinessUnit[]
    onSave: (userId: string, role: 'admin' | 'user', unitIds: string[]) => Promise<void>
}

export function UserEditModal({ isOpen, onClose, user, allUnits, onSave }: UserEditModalProps) {
    const { adminResetPassword } = useAuth()
    const [role, setRole] = useState<'admin' | 'user'>(user.role)
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)

    // Password reset state
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isResettingPassword, setIsResettingPassword] = useState(false)
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        if (isOpen) {
            setRole(user.role)
            const ids = user.user_business_units?.map(ubu => ubu.business_unit_id) || []
            setSelectedUnitIds(ids)
            // Reset password fields when modal opens
            setNewPassword('')
            setShowPassword(false)
            setPasswordMessage(null)
        }
    }, [isOpen, user])

    const handleToggleUnit = (unitId: string) => {
        setSelectedUnitIds(prev =>
            prev.includes(unitId)
                ? prev.filter(id => id !== unitId)
                : [...prev, unitId]
        )
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onSave(user.id, role, selectedUnitIds)
            onClose()
        } catch (error) {
            console.error('Failed to save user', error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres' })
            return
        }

        setIsResettingPassword(true)
        setPasswordMessage(null)

        const { error } = await adminResetPassword(user.id, newPassword)

        if (error) {
            setPasswordMessage({ type: 'error', text: error.message })
        } else {
            setPasswordMessage({ type: 'success', text: 'Senha redefinida com sucesso!' })
            setNewPassword('')
            setShowPassword(false)
        }
        setIsResettingPassword(false)
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-[1.5rem] bg-[var(--color-surface)] p-6 shadow-2xl focus:outline-none z-50 border border-[var(--color-border)] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-xl font-bold text-[var(--color-text-primary)]">
                            Editar Usuário
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="space-y-6">
                        {/* User Info */}
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface-elevated)]">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.full_name} className="w-12 h-12 rounded-full" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-lg">
                                    {user.full_name.charAt(0)}
                                </div>
                            )}
                            <div>
                                <h3 className="font-semibold text-[var(--color-text-primary)]">{user.full_name}</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">{formatUsername(user.email)}</p>
                            </div>
                        </div>

                        {/* Role Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-[var(--color-text-muted)]">Nível de Acesso</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRole('user')}
                                    className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-all ${role === 'user'
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-secondary)]'
                                        }`}
                                >
                                    Usuário
                                </button>
                                <button
                                    onClick={() => setRole('admin')}
                                    className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-all ${role === 'admin'
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-secondary)]'
                                        }`}
                                >
                                    Administrador
                                </button>
                            </div>
                            {role === 'admin' && (
                                <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">
                                    Administradores têm acesso total a todas as empresas e configurações.
                                </p>
                            )}
                        </div>

                        {/* Business Units */}
                        <div className={`space-y-3 ${role === 'admin' ? 'opacity-75' : ''}`}>
                            <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)]">
                                Empresas Vinculadas
                                {role === 'admin' && <span className="text-xs font-normal text-amber-500">(Supérfluo para Admin)</span>}
                            </label>
                            <div className="max-h-48 overflow-y-auto space-y-2 border border-[var(--color-border)] rounded-xl p-2 bg-[var(--color-surface-elevated)]">
                                {allUnits.map(unit => (
                                    <div
                                        key={unit.id}
                                        onClick={() => handleToggleUnit(unit.id)}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-hover)] cursor-pointer select-none"
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedUnitIds.includes(unit.id)
                                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                            : 'border-[var(--color-text-muted)]'
                                            }`}>
                                            {selectedUnitIds.includes(unit.id) && <Check className="w-3.5 h-3.5" />}
                                        </div>
                                        <span className="text-sm text-[var(--color-text-secondary)]">{unit.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Password Reset */}
                        <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
                            <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)]">
                                <KeyRound className="w-4 h-4" />
                                Redefinir Senha
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => {
                                            setNewPassword(e.target.value)
                                            setPasswordMessage(null)
                                        }}
                                        placeholder="Nova senha (mín. 6 caracteres)"
                                        className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleResetPassword}
                                    disabled={isResettingPassword || !newPassword}
                                    className="shrink-0"
                                >
                                    {isResettingPassword ? 'Redefinindo...' : 'Redefinir'}
                                </Button>
                            </div>
                            {passwordMessage && (
                                <p className={`text-xs p-2 rounded ${passwordMessage.type === 'success'
                                        ? 'text-emerald-600 bg-emerald-500/10'
                                        : 'text-red-500 bg-red-500/10'
                                    }`}>
                                    {passwordMessage.text}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <Button variant="outline" onClick={onClose} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
