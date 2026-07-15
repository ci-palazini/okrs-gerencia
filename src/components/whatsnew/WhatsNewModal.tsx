import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { Sparkles, X, Image as ImageIcon, ZoomIn, CheckCircle2 } from 'lucide-react'
import { Button } from '../ui/Button'

interface WhatsNewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Modal "Novidades" (What's New). Apresenta de forma visual as features lançadas
 * recentemente. Abre automaticamente quando a versão atual difere da última vista
 * pelo usuário, e pode ser reaberto manualmente pelo menu do usuário.
 */
export function WhatsNewModal({ open, onOpenChange }: WhatsNewModalProps) {
    const { t } = useTranslation()

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95">
                    {/* Cabeçalho com destaque */}
                    <div className="relative overflow-hidden p-6 border-b border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/10 via-transparent to-transparent">
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)] text-white inline-flex items-center justify-center shrink-0 shadow-lg">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] mb-0.5">
                                    {t('whatsNew.badge')}
                                </span>
                                <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)] leading-tight">
                                    {t('whatsNew.title')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-[var(--color-text-muted)] mt-0.5">
                                    {t('whatsNew.subtitle')}
                                </Dialog.Description>
                            </div>
                        </div>
                        <Dialog.Close className="absolute top-4 right-4 p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                            <X className="w-4 h-4" />
                        </Dialog.Close>
                    </div>

                    {/* Lista de features */}
                    <div className="p-6 space-y-5 overflow-y-auto">
                        {/* Feature — Pré-visualização de anexos */}
                        <FeatureBlock
                            icon={<ImageIcon className="w-5 h-5" />}
                            accent="blue"
                            tag={t('whatsNew.features.attachmentPreview.tag')}
                            title={t('whatsNew.features.attachmentPreview.title')}
                            description={t('whatsNew.features.attachmentPreview.desc')}
                            visual={<AttachmentPreviewVisual t={t} />}
                        />
                    </div>

                    {/* Rodapé */}
                    <div className="flex items-center justify-end gap-2 p-6 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
                        <Button onClick={() => onOpenChange(false)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {t('whatsNew.gotIt')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

const ACCENTS = {
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
} as const

interface FeatureBlockProps {
    icon: React.ReactNode
    accent: keyof typeof ACCENTS
    tag: string
    title: string
    description: string
    visual: React.ReactNode
}

function FeatureBlock({ icon, accent, tag, title, description, visual }: FeatureBlockProps) {
    return (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 overflow-hidden">
            {/* Mock visual */}
            <div className="px-4 pt-4">
                {visual}
            </div>
            {/* Texto */}
            <div className="flex items-start gap-3 p-4">
                <div className={`w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0 ${ACCENTS[accent]}`}>
                    {icon}
                </div>
                <div>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider mb-0.5 ${ACCENTS[accent].split(' ').slice(1).join(' ')}`}>
                        {tag}
                    </span>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">{title}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">{description}</p>
                </div>
            </div>
        </div>
    )
}

/** Mini-mock da lista compacta de anexos + preview ampliado com controles de zoom. */
function AttachmentPreviewVisual({ t }: { t: (k: string) => string }) {
    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-sm flex gap-2">
            <div className="w-16 shrink-0 space-y-1">
                <div className="h-6 rounded-md bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/30" />
                <div className="h-6 rounded-md bg-[var(--color-surface-hover)]" />
                <div className="h-6 rounded-md bg-[var(--color-surface-hover)]" />
            </div>
            <div className="flex-1 rounded-md bg-[var(--color-surface-hover)]/60 flex flex-col items-center justify-center gap-1.5 relative min-h-[5.5rem]">
                <ImageIcon className="w-6 h-6 text-[var(--color-text-muted)]" />
                <span className="text-[9px] text-[var(--color-text-muted)]">
                    {t('whatsNew.features.attachmentPreview.mockPreview')}
                </span>
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-[var(--color-surface)] rounded-md px-1.5 py-0.5 border border-[var(--color-border)]">
                    <ZoomIn className="w-2.5 h-2.5 text-[var(--color-text-muted)]" />
                    <span className="text-[9px] text-[var(--color-text-muted)]">150%</span>
                </div>
            </div>
        </div>
    )
}
