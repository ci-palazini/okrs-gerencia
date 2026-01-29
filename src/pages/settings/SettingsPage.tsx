import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Settings, Palette, Shield, Database, Download, X, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { cn } from '../../lib/utils'
import { useSettings } from '../../contexts/SettingsContext'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { PillarsTab } from './PillarsTab'

interface DatabaseStats {
    objectives: number
    keyResults: number
    actions: number
    audit: number
}

export function SettingsPage() {
    const { t } = useTranslation()
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = (searchParams.get('tab') as 'general' | 'data' | 'pillars') || 'general'

    const setActiveTab = (tab: string) => {
        setSearchParams({ tab })
    }

    const { sidebarCollapsed, toggleSidebar, theme } = useSettings()
    const { updatePassword } = useAuth()

    // Password modal state
    const [passwordModalOpen, setPasswordModalOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [passwordSuccess, setPasswordSuccess] = useState(false)

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

    async function handlePasswordChange() {
        setPasswordError(null)
        setPasswordSuccess(false)

        // Validations
        if (!newPassword || !confirmPassword) {
            setPasswordError(t('settings.page.general.passwordModal.errors.fillAll'))
            return
        }

        if (newPassword.length < 6) {
            setPasswordError(t('settings.page.general.passwordModal.errors.minChars'))
            return
        }

        if (newPassword !== confirmPassword) {
            setPasswordError(t('settings.page.general.passwordModal.errors.mismatch'))
            return
        }

        setPasswordLoading(true)

        try {
            const { error } = await updatePassword(newPassword)

            if (error) {
                setPasswordError(error.message)
            } else {
                setPasswordSuccess(true)
                // Reset form after success
                setTimeout(() => {
                    setPasswordModalOpen(false)
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setPasswordSuccess(false)
                }, 2000)
            }
        } catch (err: any) {
            setPasswordError(err.message || t('settings.page.general.passwordModal.errors.generic'))
        } finally {
            setPasswordLoading(false)
        }
    }

    function resetPasswordForm() {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordError(null)
        setPasswordSuccess(false)
        setShowCurrentPassword(false)
        setShowNewPassword(false)
        setShowConfirmPassword(false)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('settings.page.title')}</h1>
                <p className="text-[var(--color-text-secondary)] mt-1">
                    {t('settings.page.subtitle')}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-[var(--color-surface)] w-fit border border-[var(--color-border)]">
                {[
                    { key: 'general', label: t('settings.page.tabs.general'), icon: Settings },
                    { key: 'pillars', label: t('settings.page.tabs.pillars'), icon: Palette }, // Reusing Palette icon
                    { key: 'data', label: t('settings.page.tabs.data'), icon: Database },
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
                                    <CardTitle>{t('settings.page.general.appearance.title')}</CardTitle>
                                    <CardDescription>{t('settings.page.general.appearance.description')}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">{t('settings.page.general.appearance.theme')}</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">{t('settings.page.general.appearance.currentTheme', { theme: theme === 'light' ? t('settings.page.general.appearance.themeLight') : t('settings.page.general.appearance.themeDark') })}</p>
                                </div>
                                <Badge variant="success">{t('settings.page.general.appearance.lightDefault')}</Badge>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">{t('settings.page.general.sidebar.title')}</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">{t('settings.page.general.sidebar.description')}</p>
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
                                    <CardTitle>{t('settings.page.general.security.title')}</CardTitle>
                                    <CardDescription>{t('settings.page.general.security.description')}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">{t('settings.page.general.security.auth')}</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">{t('settings.page.general.security.authDesc')}</p>
                                </div>
                                <Badge variant="success">{t('settings.page.general.security.active')}</Badge>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    resetPasswordForm()
                                    setPasswordModalOpen(true)
                                }}
                            >
                                <Lock className="w-4 h-4 mr-2" />
                                {t('settings.page.general.security.changePassword')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}



            {activeTab === 'pillars' && (
                <PillarsTab />
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
                                    <CardTitle>{t('settings.page.data.export.title')}</CardTitle>
                                    <CardDescription>{t('settings.page.data.export.description')}</CardDescription>
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
                                {exporting === 'okrs' ? t('settings.page.data.export.exporting') : t('settings.page.data.export.okrs')}
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => handleExport('actions')}
                                disabled={exporting !== null}
                            >
                                <Download className={cn("w-4 h-4 mr-2", exporting === 'actions' && "animate-bounce")} />
                                {exporting === 'actions' ? t('settings.page.data.export.exporting') : t('settings.page.data.export.actions')}
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
                                    <CardTitle>{t('settings.page.data.stats.title')}</CardTitle>
                                    <CardDescription>{t('settings.page.data.stats.description')}</CardDescription>
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
                                        { label: t('settings.page.data.stats.objectives'), value: stats.objectives },
                                        { label: t('settings.page.data.stats.keyResults'), value: stats.keyResults },
                                        { label: t('settings.page.data.stats.actions'), value: stats.actions },
                                        { label: t('settings.page.data.stats.audit'), value: stats.audit },
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

            {/* Password Change Modal */}
            <Dialog.Root open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-success)]/15">
                                    <Lock className="w-5 h-5 text-[var(--color-success)]" />
                                </div>
                                <div>
                                    <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                        {t('settings.page.general.passwordModal.title')}
                                    </Dialog.Title>
                                    <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                        {t('settings.page.general.passwordModal.description')}
                                    </Dialog.Description>
                                </div>
                            </div>
                            <Dialog.Close asChild>
                                <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </Dialog.Close>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {passwordSuccess ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success)]/15">
                                        <CheckCircle className="w-8 h-8 text-[var(--color-success)]" />
                                    </div>
                                    <p className="text-lg font-medium text-[var(--color-success)]">
                                        {t('settings.page.general.passwordModal.success')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* New Password */}
                                    <div className="relative">
                                        <Input
                                            type={showNewPassword ? 'text' : 'password'}
                                            label={t('settings.page.general.passwordModal.newPassword')}
                                            placeholder={t('settings.page.general.passwordModal.newPasswordPlaceholder')}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            icon={<Lock className="w-5 h-5" />}
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-[38px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="relative">
                                        <Input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            label={t('settings.page.general.passwordModal.confirmPassword')}
                                            placeholder={t('settings.page.general.passwordModal.confirmPasswordPlaceholder')}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            icon={<Lock className="w-5 h-5" />}
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-[38px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* Password requirements */}
                                    <div className="p-3 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                                        <p className="text-xs text-[var(--color-text-muted)]">
                                            {t('settings.page.general.passwordModal.requirements')}
                                        </p>
                                    </div>

                                    {passwordError && (
                                        <div className="p-3 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-sm">
                                            {passwordError}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!passwordSuccess && (
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                                <Button variant="ghost" onClick={() => setPasswordModalOpen(false)}>
                                    {t('settings.page.general.passwordModal.cancel')}
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handlePasswordChange}
                                    loading={passwordLoading}
                                >
                                    <Lock className="w-4 h-4" />
                                    {t('settings.page.general.passwordModal.save')}
                                </Button>
                            </div>
                        )}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    )
}

