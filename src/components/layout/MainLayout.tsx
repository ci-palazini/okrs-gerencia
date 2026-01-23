import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '../../hooks/useAuth'
import { useSettings } from '../../contexts/SettingsContext'
import { cn } from '../../lib/utils'

export function MainLayout() {
    const { user, loading } = useAuth()
    const { sidebarCollapsed } = useSettings()

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--color-background)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">Carregando...</p>
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
                <Header />
                <main className="p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
