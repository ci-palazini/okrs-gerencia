import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { Sparkles, X, Archive, Paperclip, FileText, CheckCircle2 } from 'lucide-react'
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
                        {/* Feature 1 — Descontinuar OKRs */}
                        <FeatureBlock
                            icon={<Archive className="w-5 h-5" />}
                            accent="amber"
                            tag={t('whatsNew.features.discontinue.tag')}
                            title={t('whatsNew.features.discontinue.title')}
                            description={t('whatsNew.features.discontinue.desc')}
                            visual={<DiscontinueVisual t={t} />}
                        />

                        {/* Feature 2 — Central de arquivos */}
                        <FeatureBlock
                            icon={<Paperclip className="w-5 h-5" />}
                            accent="blue"
                            tag={t('whatsNew.features.attachments.tag')}
                            title={t('whatsNew.features.attachments.title')}
                            description={t('whatsNew.features.attachments.desc')}
                            visual={<AttachmentsVisual t={t} />}
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

/** Mini-mock ilustrativo de um OKR marcado como descontinuado. */
function DiscontinueVisual({ t }: { t: (k: string) => string }) {
    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] shrink-0" />
                    <span className="text-xs font-medium text-[var(--color-text-muted)] line-through truncate">
                        {t('whatsNew.features.discontinue.mockKr')}
                    </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    <Archive className="w-2.5 h-2.5" />
                    {t('whatsNew.features.discontinue.mockBadge')}
                </span>
            </div>
        </div>
    )
}

/** Mini-mock ilustrativo de anexos em um plano de ação. */
function AttachmentsVisual({ t }: { t: (k: string) => string }) {
    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t('whatsNew.features.attachments.mockTitle')}
            </span>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 px-2 py-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs text-[var(--color-text-secondary)] truncate">{t('whatsNew.features.attachments.mockFile1')}</span>
                </div>
                <div className="flex items-center gap-2 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 px-2 py-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs text-[var(--color-text-secondary)] truncate">{t('whatsNew.features.attachments.mockFile2')}</span>
                </div>
            </div>
        </div>
    )
}
