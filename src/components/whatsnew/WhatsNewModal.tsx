import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { Sparkles, X, Repeat, PanelRight, CheckCircle2 } from 'lucide-react'
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
                        {/* Feature 1 — Tarefas recorrentes */}
                        <FeatureBlock
                            icon={<Repeat className="w-5 h-5" />}
                            accent="blue"
                            tag={t('whatsNew.features.recurring.tag')}
                            title={t('whatsNew.features.recurring.title')}
                            description={t('whatsNew.features.recurring.desc')}
                            visual={<RecurringVisual t={t} />}
                        />

                        {/* Feature 2 — Painel de detalhe da tarefa */}
                        <FeatureBlock
                            icon={<PanelRight className="w-5 h-5" />}
                            accent="emerald"
                            tag={t('whatsNew.features.taskPanel.tag')}
                            title={t('whatsNew.features.taskPanel.title')}
                            description={t('whatsNew.features.taskPanel.desc')}
                            visual={<TaskPanelVisual t={t} />}
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

/** Mini-mock de uma tarefa recorrente: badge de frequência, próximo prazo e histórico. */
function RecurringVisual({ t }: { t: (k: string) => string }) {
    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border-2 border-green-500 bg-green-500 text-white inline-flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                </span>
                <span className="text-xs font-medium text-[var(--color-text-primary)] flex-1 truncate">
                    {t('whatsNew.features.recurring.mockTitle')}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                    <Repeat className="w-2.5 h-2.5" />
                    {t('whatsNew.features.recurring.mockFreq')}
                </span>
            </div>
            <div className="flex items-center justify-between text-[10px] pl-7">
                <span className="text-[var(--color-primary)] font-medium">
                    {t('whatsNew.features.recurring.mockNext')}
                </span>
                <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                    <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                    15/07 · 14/07 · 12/07
                </span>
            </div>
        </div>
    )
}

/** Mini-mock do layout lista de tarefas + painel de detalhe ao lado. */
function TaskPanelVisual({ t }: { t: (k: string) => string }) {
    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-sm flex gap-2">
            <div className="flex-1 space-y-1">
                <div className="h-6 rounded-md bg-[var(--color-surface-hover)] flex items-center px-2 text-[10px] text-[var(--color-text-muted)]">
                    {t('whatsNew.features.taskPanel.mockList')}
                </div>
                <div className="h-6 rounded-md bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/30 flex items-center px-2 gap-1">
                    <Repeat className="w-2.5 h-2.5 text-[var(--color-primary)]" />
                    <span className="h-1.5 flex-1 rounded bg-[var(--color-primary)]/30" />
                </div>
                <div className="h-6 rounded-md bg-[var(--color-surface-hover)]" />
            </div>
            <div className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 p-1.5 space-y-1.5">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t('whatsNew.features.taskPanel.mockDetail')}
                </div>
                <div className="h-2 rounded bg-[var(--color-border)]" />
                <div className="h-2 rounded bg-[var(--color-border)] w-3/4" />
                <div className="h-2 rounded bg-[var(--color-border)] w-1/2" />
            </div>
        </div>
    )
}
