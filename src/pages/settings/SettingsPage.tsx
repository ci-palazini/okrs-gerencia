import { useState, useEffect } from 'react'
import { Settings, Palette, Bell, Shield, Database, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/utils'
import { useSettings } from '../../contexts/SettingsContext'
import { supabase } from '../../lib/supabase'

interface DatabaseStats {
    objectives: number
    keyResults: number
    actions: number
    audit: number
}

export function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'data'>('general')
    const { sidebarCollapsed, toggleSidebar, theme } = useSettings()

    // Stats state
    const [stats, setStats] = useState<DatabaseStats>({
        objectives: 0,
        keyResults: 0,
        actions: 0,
        audit: 0
    })
    const [loadingStats, setLoadingStats] = useState(false)
    const [exporting, setExporting] = useState<'okrs' | 'actions' | 'report' | null>(null)

    useEffect(() => {
        if (activeTab === 'data') {
            fetchStats()
        }
    }, [activeTab])

    async function fetchStats() {
        setLoadingStats(true)
        try {
            const [
                { count: objCount },
                { count: krCount },
                { count: actionCount },
                { count: auditCount }
            ] = await Promise.all([
                supabase.from('objectives').select('*', { count: 'exact', head: true }),
                supabase.from('key_results').select('*', { count: 'exact', head: true }),
                supabase.from('actions').select('*', { count: 'exact', head: true }),
                supabase.from('audit_logs').select('*', { count: 'exact', head: true })
            ])

            setStats({
                objectives: objCount || 0,
                keyResults: krCount || 0,
                actions: actionCount || 0,
                audit: auditCount || 0
            })
        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setLoadingStats(false)
        }
    }

    async function handleExport(type: 'okrs' | 'actions' | 'report') {
        setExporting(type)
        try {
            let data: any[] = []
            let filename = ''

            if (type === 'okrs') {
                const { data: okrs } = await supabase
                    .from('objectives')
                    .select(`
                        id, code, title, description, year,
                        pillar:pillars(name),
                        business_unit:business_units(name),
                        krs:key_results(
                            code, title, metric_type, unit, 
                            owner_name
                        )
                    `)
                data = okrs || []
                filename = 'okrs_export.csv'
            } else if (type === 'actions') {
                const { data: actions } = await supabase
                    .from('actions')
                    .select('*')
                data = actions || []
                filename = 'actions_export.csv'
            }

            if (data.length > 0) {
                // Simple JSON to CSV (just headers + values logic could be improved for production)
                // For nested data like OKRs, flattening would be needed for a perfect CSV.
                // Here we just export a JSON string for simplicity or basic fields.

                const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
                    JSON.stringify(data, null, 2)
                )}`;
                const link = document.createElement("a");
                link.href = jsonString;
                link.download = type + ".json"; // Exporting as JSON for better nested structure support
                link.click();
            }
        } catch (error) {
            console.error('Export failed:', error)
        } finally {
            setExporting(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Configurações</h1>
                <p className="text-[var(--color-text-secondary)] mt-1">
                    Personalize sua experiência no OKR Dashboard
                </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-[var(--color-surface)] w-fit border border-[var(--color-border)]">
                {[
                    { key: 'general', label: 'Geral', icon: Settings },
                    { key: 'notifications', label: 'Notificações', icon: Bell },
                    { key: 'data', label: 'Dados', icon: Database },
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key as any)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                            activeTab === key
                                ? 'bg-[var(--color-primary)] text-white shadow-md'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card variant="elevated">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                                    <Palette className="w-5 h-5 text-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <CardTitle>Aparência</CardTitle>
                                    <CardDescription>Personalize o visual do dashboard</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">Tema</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">Atualmente: {theme === 'light' ? 'Claro' : 'Escuro'}</p>
                                </div>
                                <Badge variant="success">Light (Padrão)</Badge>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">Sidebar Compacta</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">Recolher menu lateral</p>
                                </div>
                                <button
                                    onClick={toggleSidebar}
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2",
                                        sidebarCollapsed ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                            sidebarCollapsed ? "translate-x-6" : "translate-x-1"
                                        )}
                                    />
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card variant="elevated">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-success)]/15">
                                    <Shield className="w-5 h-5 text-[var(--color-success)]" />
                                </div>
                                <div>
                                    <CardTitle>Segurança</CardTitle>
                                    <CardDescription>Configurações de conta</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">Autenticação</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">Email e senha</p>
                                </div>
                                <Badge variant="success">Ativo</Badge>
                            </div>
                            <Button variant="outline" className="w-full">
                                Alterar Senha
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'notifications' && (
                <Card variant="elevated">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-warning)]/15">
                                <Bell className="w-5 h-5 text-[var(--color-warning)]" />
                            </div>
                            <div>
                                <CardTitle>Notificações</CardTitle>
                                <CardDescription>Gerencie suas preferências de notificação</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { label: 'Atualizações de KRs', description: 'Quando um KR é atualizado', enabled: true },
                            { label: 'Novas Ações', description: 'Quando ações são criadas', enabled: true },
                            { label: 'Prazos Próximos', description: 'Lembretes de ações com prazo próximo', enabled: false },
                            { label: 'Resumo Semanal', description: 'Email com resumo de progresso', enabled: false },
                        ].map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">{item.description}</p>
                                </div>
                                <Badge variant={item.enabled ? 'success' : 'outline'}>
                                    {item.enabled ? 'Ativo' : 'Desativado'}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'data' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card variant="elevated">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-accent-cyan)]/15">
                                    <Download className="w-5 h-5 text-[var(--color-accent-cyan)]" />
                                </div>
                                <div>
                                    <CardTitle>Exportar Dados</CardTitle>
                                    <CardDescription>Baixe seus dados em formato JSON</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => handleExport('okrs')}
                                disabled={exporting !== null}
                            >
                                <Download className={cn("w-4 h-4 mr-2", exporting === 'okrs' && "animate-bounce")} />
                                {exporting === 'okrs' ? 'Exportando...' : 'Exportar OKRs (JSON)'}
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => handleExport('actions')}
                                disabled={exporting !== null}
                            >
                                <Download className={cn("w-4 h-4 mr-2", exporting === 'actions' && "animate-bounce")} />
                                {exporting === 'actions' ? 'Exportando...' : 'Exportar Ações (JSON)'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card variant="elevated">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                                    <Database className="w-5 h-5 text-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <CardTitle>Estatísticas do Banco</CardTitle>
                                    <CardDescription>Visão geral dos dados</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loadingStats ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Objetivos', value: stats.objectives },
                                        { label: 'Key Results', value: stats.keyResults },
                                        { label: 'Ações', value: stats.actions },
                                        { label: 'Logs de Auditoria', value: stats.audit },
                                    ].map((stat, index) => (
                                        <div key={index} className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-center">
                                            <p className="text-2xl font-bold text-[var(--color-primary)]">{stat.value}</p>
                                            <p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
