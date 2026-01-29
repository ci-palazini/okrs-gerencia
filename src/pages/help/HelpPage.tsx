import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
    Check, Pencil, BarChart2, Palette, ClipboardList,
    LayoutDashboard, History, Search, BookOpen, Target,
    ListTodo, ChevronRight, HelpCircle, ChevronDown, TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { cn } from '../../lib/utils'

interface FAQItem {
    question: string
    answer: React.ReactNode
    category: string
}

export function HelpPage() {
    const { t } = useTranslation()
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

    const faqs: FAQItem[] = [
        {
            category: t('help.faq.categories.dashboard'),
            question: t('help.faq.questions.generalProgress.q'),
            answer: t('help.faq.questions.generalProgress.a')
        },
        {
            category: t('help.faq.categories.dashboard'),
            question: t('help.faq.questions.lateKRs.q'),
            answer: t('help.faq.questions.lateKRs.a')
        },
        {
            category: t('help.faq.categories.objectives'),
            question: t('help.faq.questions.editKR.q'),
            answer: (
                <Trans
                    i18nKey="help.faq.questions.editKR.a"
                    components={[<Pencil className="w-3 h-3 inline mx-1" />]}
                />
            )
        },
        {
            category: t('help.faq.categories.objectives'),
            question: t('help.faq.questions.krColors.q'),
            answer: t('help.faq.questions.krColors.a')
        },
        {
            category: t('help.faq.categories.objectives'),
            question: t('help.faq.questions.filterUnits.q'),
            answer: t('help.faq.questions.filterUnits.a')
        },
        {
            category: t('help.faq.categories.actions'),
            question: t('help.faq.questions.createAction.q'),
            answer: t('help.faq.questions.createAction.a')
        },
        {
            category: t('help.faq.categories.actions'),
            question: t('help.faq.questions.changeActionStatus.q'),
            answer: t('help.faq.questions.changeActionStatus.a')
        },
        {
            category: t('help.faq.categories.actions'),
            question: t('help.faq.questions.priorityColors.q'),
            answer: t('help.faq.questions.priorityColors.a')
        },
        {
            category: t('help.faq.categories.general'),
            question: t('help.faq.questions.autoSave.q'),
            answer: t('help.faq.questions.autoSave.a')
        },
        {
            category: t('help.faq.categories.general'),
            question: t('help.faq.questions.audit.q'),
            answer: t('help.faq.questions.audit.a')
        }
    ]

    const excelMapping = [
        { excel: t('help.excelMap.items.corporate.excel'), platform: t('help.excelMap.items.corporate.platform'), icon: LayoutDashboard },
        { excel: t('help.excelMap.items.okrs.excel'), platform: t('help.excelMap.items.okrs.platform'), icon: Target },
        { excel: t('help.excelMap.items.profitability.excel'), platform: t('help.excelMap.items.profitability.platform'), icon: TrendingUp },
        { excel: t('help.excelMap.items.actions.excel'), platform: t('help.excelMap.items.actions.platform'), icon: ListTodo },
        { excel: t('help.excelMap.items.quarterly.excel'), platform: t('help.excelMap.items.quarterly.platform'), icon: LayoutDashboard },
        { excel: t('help.excelMap.items.history.excel'), platform: t('help.excelMap.items.history.platform'), icon: History },
    ]

    const filteredFAQs = faqs.filter(faq =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof faq.answer === 'string' && faq.answer.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const categories = [...new Set(faqs.map(f => f.category))]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('help.title')}</h1>
                <p className="text-[var(--color-text-secondary)] mt-1">
                    {t('help.subtitle')}
                </p>
            </div>

            {/* Search */}
            <Input
                placeholder={t('help.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="w-5 h-5" />}
                className="max-w-md"
            />

            {/* Excel Mapping */}
            <Card variant="glass">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-success)]/15">
                            <BookOpen className="w-5 h-5 text-[var(--color-success)]" />
                        </div>
                        <div>
                            <CardTitle>
                                <BarChart2 className="w-5 h-5 inline mr-2 text-[var(--color-primary)]" />
                                {t('help.excelMap.title')}
                            </CardTitle>
                            <CardDescription>{t('help.excelMap.description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {excelMapping.map((item, index) => {
                            const Icon = item.icon
                            return (
                                <div
                                    key={index}
                                    className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                >
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-primary)]/15">
                                        <Icon className="w-5 h-5 text-[var(--color-primary)]" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-[var(--color-text-muted)]">{t('help.excelMap.excel')}</p>
                                        <p className="font-medium text-[var(--color-text-primary)]">{item.excel}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                                    <div className="flex-1">
                                        <p className="text-sm text-[var(--color-text-muted)]">{t('help.excelMap.platform')}</p>
                                        <p className="font-medium text-[var(--color-success)]">{item.platform}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Color Legend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card variant="elevated">
                    <CardHeader>
                        <CardTitle>
                            <Palette className="w-5 h-5 inline mr-2 text-[var(--color-text-primary)]" />
                            {t('help.colors.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-success-muted)]">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-success)]" />
                            <span className="font-medium text-[var(--color-success)]">{t('help.colors.green')}</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">{t('help.colors.greenDesc')}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-warning-muted)]">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-warning)]" />
                            <span className="font-medium text-[var(--color-warning)]">{t('help.colors.yellow')}</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">{t('help.colors.yellowDesc')}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-danger-muted)]">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-danger)]" />
                            <span className="font-medium text-[var(--color-danger)]">{t('help.colors.red')}</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">{t('help.colors.redDesc')}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated">
                    <CardHeader>
                        <CardTitle>
                            <ClipboardList className="w-5 h-5 inline mr-2 text-[var(--color-text-primary)]" />
                            {t('help.actionStatus.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="default">{t('help.actionStatus.pending')}</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)]">{t('help.actionStatus.pendingDesc')}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="info">{t('help.actionStatus.inProgress')}</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)]">{t('help.actionStatus.inProgressDesc')}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="success">{t('help.actionStatus.done')}</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1">
                                {t('help.actionStatus.doneDesc')} <Check className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="danger">{t('help.actionStatus.blocked')}</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)]">{t('help.actionStatus.blockedDesc')}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* FAQ */}
            <Card variant="elevated">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                            <HelpCircle className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                            <CardTitle>{t('help.faq.title')}</CardTitle>
                            <CardDescription>{t('help.faq.description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {categories.map(category => {
                        const categoryFAQs = filteredFAQs.filter(f => f.category === category)
                        if (categoryFAQs.length === 0) return null

                        return (
                            <div key={category} className="mb-6 last:mb-0">
                                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                                    {category}
                                </h3>
                                <div className="space-y-2">
                                    {categoryFAQs.map((faq, index) => {
                                        const key = `${category}-${index}`
                                        const isExpanded = expandedFAQ === key

                                        return (
                                            <div
                                                key={key}
                                                className="rounded-xl bg-[var(--color-surface)] overflow-hidden"
                                            >
                                                <button
                                                    onClick={() => setExpandedFAQ(isExpanded ? null : key)}
                                                    className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                                                >
                                                    <span className="font-medium text-[var(--color-text-primary)]">
                                                        {faq.question}
                                                    </span>
                                                    <ChevronDown className={cn(
                                                        'w-5 h-5 text-[var(--color-text-muted)] transition-transform',
                                                        isExpanded && 'rotate-180'
                                                    )} />
                                                </button>
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 text-[var(--color-text-secondary)]">
                                                        {faq.answer}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Support */}
            <Card variant="glass">
                <CardContent className="flex items-center justify-between py-6">
                    <div>
                        <h3 className="font-semibold text-[var(--color-text-primary)]">{t('help.support.title')}</h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {t('help.support.subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Badge variant="info">Gabriel - SXS Brazil</Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
