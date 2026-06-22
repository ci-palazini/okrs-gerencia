import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { Archive, X } from 'lucide-react'
import { Button } from '../ui/Button'

interface DiscontinueModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** "objective" | "kr" — só muda os textos exibidos */
    entity: 'objective' | 'kr'
    /** Código/título do item sendo descontinuado, para contexto no cabeçalho */
    label?: string
    onConfirm: (reason: string | null) => Promise<void> | void
}

/**
 * Modal de confirmação para descontinuar um Objetivo ou KR.
 * Mantém o item no histórico (não apaga) e pede um motivo opcional.
 */
export function DiscontinueModal({ open, onOpenChange, entity, label, onConfirm }: DiscontinueModalProps) {
    const { t } = useTranslation()
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (open) {
            setReason('')
            setSubmitting(false)
        }
    }, [open])

    async function handleConfirm() {
        setSubmitting(true)
        try {
            await onConfirm(reason.trim() || null)
            onOpenChange(false)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95">
                    <div className="flex items-start justify-between p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] inline-flex items-center justify-center shrink-0">
                                <Archive className="w-5 h-5" />
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {t('okr.discontinue.modalTitle')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                    {entity === 'objective'
                                        ? t('okr.discontinue.modalSubtitleObjective')
                                        : t('okr.discontinue.modalSubtitleKR')}
                                </Dialog.Description>
                            </div>
                        </div>
                        <Dialog.Close className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                            <X className="w-4 h-4" />
                        </Dialog.Close>
                    </div>

                    <div className="p-6 space-y-4">
                        {label && (
                            <p className="text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-hover)] rounded-lg px-3 py-2">
                                {label}
                            </p>
                        )}
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            {t('okr.discontinue.modalExplanation')}
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                                {t('okr.discontinue.reasonLabel')}
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder={t('okr.discontinue.reasonPlaceholder')}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 p-6 border-t border-[var(--color-border)]">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleConfirm} disabled={submitting}>
                            <Archive className="w-4 h-4 mr-2" />
                            {t('okr.discontinue.confirm')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
