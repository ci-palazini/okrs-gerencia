import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Loader2, Trash2, UserMinus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import type { UserDeletionImpact, UserWithUnits } from '../../types'
import { formatUsername } from '../../lib/utils'

interface DeleteUserDialogProps {
    isOpen: boolean
    onClose: () => void
    user: UserWithUnits
    /** Chamado após a exclusão, com o modo efetivamente aplicado. */
    onDeleted: (mode: 'soft' | 'hard') => void
}

export function DeleteUserDialog({ isOpen, onClose, user, onDeleted }: DeleteUserDialogProps) {
    const { t } = useTranslation()
    const [impact, setImpact] = useState<UserDeletionImpact | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false

        async function loadImpact() {
            setIsLoading(true)
            setError(null)
            setImpact(null)
            const { data, error } = await supabase.rpc('admin_user_impact', { target_user_id: user.id })
            if (cancelled) return
            if (error) setError(error.message)
            else setImpact(data as unknown as UserDeletionImpact)
            setIsLoading(false)
        }

        loadImpact()
        return () => { cancelled = true }
    }, [isOpen, user.id])

    const handleDelete = async () => {
        setIsDeleting(true)
        setError(null)
        const { data, error } = await supabase.rpc('admin_delete_user', { target_user_id: user.id })
        setIsDeleting(false)

        if (error) {
            setError(error.message)
            return
        }
        onDeleted((data as unknown as UserDeletionImpact).mode)
    }

    const isSoft = impact?.mode === 'soft'

    const contentItems = impact
        ? ([
            ['users.impactActionPlans', impact.action_plans],
            ['users.impactComments', impact.comments],
            ['users.impactAttachments', impact.action_plan_attachments + impact.kr_attachments],
            ['users.impactDiscontinued', impact.discontinued_items],
        ] as const).filter(([, count]) => count > 0)
        : []

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open && !isDeleting) onClose() }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" />
                <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[480px] translate-x-[-50%] translate-y-[-50%] rounded-[1.5rem] bg-[var(--color-surface)] p-6 shadow-2xl focus:outline-none z-[60] border border-[var(--color-border)] overflow-y-auto">
                    <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${isSoft ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                            {isSoft ? <UserMinus className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                            <Dialog.Title className="text-lg font-bold text-[var(--color-text-primary)]">
                                {t('users.deleteTitle')}
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-[var(--color-text-muted)] mt-1">
                                {user.full_name} · {formatUsername(user.email)}
                            </Dialog.Description>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {isLoading && (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                            </div>
                        )}

                        {!isLoading && impact && (
                            <>
                                <div className={`p-4 rounded-xl text-sm ${isSoft
                                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                                    }`}>
                                    {isSoft ? t('users.deleteSoftExplanation') : t('users.deleteHardExplanation')}
                                </div>

                                {contentItems.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-[var(--color-text-muted)]">
                                            {t('users.impactTitle')}
                                        </p>
                                        <ul className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] divide-y divide-[var(--color-border)]">
                                            {contentItems.map(([key, count]) => (
                                                <li key={key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                                    <span className="text-[var(--color-text-secondary)]">{t(key)}</span>
                                                    <span className="font-semibold text-[var(--color-text-primary)]">{count}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {(impact.team_memberships > 0 || impact.business_units > 0) && (
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {t('users.deleteRevokesLinks', {
                                            teams: impact.team_memberships,
                                            units: impact.business_units,
                                        })}
                                    </p>
                                )}
                            </>
                        )}

                        {error && (
                            <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-lg">{error}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <Button variant="outline" onClick={onClose} disabled={isDeleting}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            disabled={isLoading || isDeleting || !impact}
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            {isSoft ? t('users.deactivateConfirm') : t('users.deleteConfirm')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
