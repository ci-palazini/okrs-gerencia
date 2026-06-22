import { useEffect, useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '../../hooks/useAuth'
import { useSettings } from '../../contexts/SettingsContext'
import { cn } from '../../lib/utils'
import { WhatsNewModal } from '../whatsnew/WhatsNewModal'
import { WHATS_NEW_VERSION } from '../../lib/whatsNew'

export function MainLayout() {
    const { t } = useTranslation()
    const { user, loading, markWhatsNewSeen } = useAuth()
    const { sidebarCollapsed } = useSettings()
    const [whatsNewOpen, setWhatsNewOpen] = useState(false)

    // Abre automaticamente quando há novidades não vistas (pequeno delay para não
    // competir com o carregamento da página).
    useEffect(() => {
        if (user && user.whats_new_seen_version !== WHATS_NEW_VERSION) {
            const timer = setTimeout(() => setWhatsNewOpen(true), 600)
            return () => clearTimeout(timer)
        }
    }, [user])

    function handleWhatsNewChange(open: boolean) {
        setWhatsNewOpen(open)
        if (!open) markWhatsNewSeen(WHATS_NEW_VERSION)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--color-background)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('app.loading')}</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)]">
            <Sidebar />
            <div className={cn(
                "transition-all duration-300",
                sidebarCollapsed ? "pl-20" : "pl-64"
            )}>
                <Header onShowWhatsNew={() => setWhatsNewOpen(true)} />
                <main className="p-6">
                    <Outlet />
                </main>
            </div>
            <WhatsNewModal open={whatsNewOpen} onOpenChange={handleWhatsNewChange} />
        </div>
    )
}
