import { useState } from 'react'
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

const faqs: FAQItem[] = [
    {
        category: 'Dashboard',
        question: 'Onde vejo o progresso geral?',
        answer: 'No Dashboard, o card "Progresso Geral" mostra um círculo com a porcentagem média de todos os Key Results.'
    },
    {
        category: 'Dashboard',
        question: 'Como sei quais KRs estão atrasados?',
        answer: 'Na seção "Key Results que Precisam de Atenção" do Dashboard, os KRs são ordenados do menor para maior progresso.'
    },
    {
        category: 'Objetivos',
        question: 'Como edito o valor de um KR?',
        answer: (
            <span>
                Você pode editar valores (Baseline, Real, Target) clicando diretamente na célula da tabela. Para editar título ou outras propriedades, clique no ícone de editar (<Pencil className="w-3 h-3 inline mx-1" />).
            </span>
        )
    },
    {
        category: 'Objetivos',
        question: 'O que significam as cores dos KRs?',
        answer: 'Verde (70-100%): No caminho certo. Amarelo (40-69%): Atenção necessária. Vermelho (0-39%): Crítico, precisa de ação urgente.'
    },
    {
        category: 'Objetivos',
        question: 'Como filtro por SXS ou Hiter?',
        answer: 'Use o dropdown "Todas Unidades" no topo direito das páginas Dashboard e Objetivos para filtrar por unidade de negócio.'
    },
    {
        category: 'Ações',
        question: 'Como crio uma nova ação?',
        answer: 'Vá em Ações → Clique em "+ Nova Ação" → Preencha título, descrição, KR vinculado, prioridade e data limite → Clique em "Criar Ação".'
    },
    {
        category: 'Ações',
        question: 'Como mudo o status de uma ação?',
        answer: 'Passe o mouse sobre a ação → Clique nos 3 pontinhos (⋮) → Escolha o novo status: Em Progresso, Concluído ou Bloqueado.'
    },
    {
        category: 'Ações',
        question: 'O que significam as cores de prioridade?',
        answer: 'Vermelho: Alta prioridade. Amarelo: Média prioridade. Cinza: Baixa prioridade.'
    },
    {
        category: 'Geral',
        question: 'Os dados são salvos automaticamente?',
        answer: 'Sim! Todas as alterações são salvas no banco de dados imediatamente e registradas na página de Auditoria.'
    },
    {
        category: 'Geral',
        question: 'Onde vejo as alterações feitas?',
        answer: 'No menu lateral, clique em "Auditoria" para ver todo o histórico de mudanças feitas no sistema.'
    }
]

const excelMapping = [
    { excel: 'Objetivos Corporativos', platform: 'Dashboard + Objetivos', icon: LayoutDashboard },
    { excel: 'OKRs', platform: 'OKRs (filtrar por unidade)', icon: Target },
    { excel: 'Rentabilidade', platform: 'Rentabilidade', icon: TrendingUp },
    { excel: 'Ações SXS / Ações Hiter', platform: 'Ações (filtrar por unidade)', icon: ListTodo },
    { excel: 'Acompanhamento Trimestral', platform: 'Dashboard (indicador Q1 2026)', icon: LayoutDashboard },
    { excel: 'Histórico de Alterações (não havia)', platform: 'Auditoria', icon: History },
]

export function HelpPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

    const filteredFAQs = faqs.filter(faq =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof faq.answer === 'string' && faq.answer.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const categories = [...new Set(faqs.map(f => f.category))]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Central de Ajuda</h1>
                <p className="text-[var(--color-text-secondary)] mt-1">
                    Guia de transição do Excel para a plataforma
                </p>
            </div>

            {/* Search */}
            <Input
                placeholder="Buscar ajuda..."
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
                                Do Excel para a Plataforma
                            </CardTitle>
                            <CardDescription>Encontre onde cada aba do Excel está na nova plataforma</CardDescription>
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
                                        <p className="text-sm text-[var(--color-text-muted)]">No Excel:</p>
                                        <p className="font-medium text-[var(--color-text-primary)]">{item.excel}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                                    <div className="flex-1">
                                        <p className="text-sm text-[var(--color-text-muted)]">Na Plataforma:</p>
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
                            Cores de Progresso
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-success-muted)]">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-success)]" />
                            <span className="font-medium text-[var(--color-success)]">Verde (70-100%)</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">No caminho certo</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-warning-muted)]">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-warning)]" />
                            <span className="font-medium text-[var(--color-warning)]">Amarelo (40-69%)</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">Atenção necessária</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-danger-muted)]">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-danger)]" />
                            <span className="font-medium text-[var(--color-danger)]">Vermelho (0-39%)</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">Crítico</span>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated">
                    <CardHeader>
                        <CardTitle>
                            <ClipboardList className="w-5 h-5 inline mr-2 text-[var(--color-text-primary)]" />
                            Status das Ações
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="default">Pendente</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)]">Ainda não iniciado</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="info">Em Progresso</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)]">Trabalho em andamento</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="success">Concluído</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1">
                                Finalizado <Check className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                            <Badge variant="danger">Bloqueado</Badge>
                            <span className="text-sm text-[var(--color-text-secondary)]">Impedido, precisa de ação</span>
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
                            <CardTitle>Perguntas Frequentes</CardTitle>
                            <CardDescription>Respostas para as dúvidas mais comuns</CardDescription>
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
                        <h3 className="font-semibold text-[var(--color-text-primary)]">Precisa de mais ajuda?</h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Entre em contato com a equipe de Melhoria Contínua
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
