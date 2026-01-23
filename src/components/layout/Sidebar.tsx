import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Target,
    ListTodo,
    Settings,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    History,
    HelpCircle,
    TrendingUp,

    DollarSign,
    Truck,
    Shield,
    Lightbulb
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSettings } from '../../contexts/SettingsContext'

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: "OKR's", href: '/okrs', icon: Target },
    { name: 'Rentabilidade', href: '/rentabilidade', icon: DollarSign },
    { name: 'Serviços', href: '/lead-time', icon: Truck },
    { name: 'Segurança', href: '/seguranca', icon: Shield },
    { name: 'Ações', href: '/actions', icon: ListTodo },
    { name: 'Propostas', href: '/ideas', icon: Lightbulb },
    { name: 'Auditoria', href: '/audit', icon: History },
]

const bottomNavigation = [
    { name: 'Ajuda', href: '/help', icon: HelpCircle },
    { name: 'Configurações', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const { sidebarCollapsed, toggleSidebar } = useSettings()
    const location = useLocation()
    const collapsed = sidebarCollapsed

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out flex flex-col',
                'bg-[var(--color-surface)] border-r border-[var(--color-border)]',
                collapsed ? 'w-20' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className="flex items-center h-16 px-4 border-b border-[var(--color-border)]">
                <div className={cn(
                    'flex items-center gap-3 transition-all duration-300',
                    collapsed && 'justify-center w-full'
                )}>
                    <div className={cn(
                        "flex items-center gap-3 transition-all duration-300",
                        collapsed ? "w-full justify-center" : "w-auto"
                    )}>
                        <img
                            src="/SXS_master_blue_rgb_150ppi.png"
                            alt="OKR Dashboard"
                            className={cn(
                                "object-contain transition-all duration-300",
                                collapsed ? "h-6 w-auto" : "h-8 w-auto"
                            )}
                        />
                        {!collapsed && (
                            <div className="flex flex-col whitespace-nowrap">
                                <span className="text-lg font-bold text-[var(--color-text-primary)] leading-none">OKR's</span>
                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-tight">Controle de Gestão</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex flex-col gap-1 p-3 mt-4 flex-1">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href ||
                        (item.href !== '/' && location.pathname.startsWith(item.href))

                    return (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                isActive
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                                collapsed && 'justify-center px-3'
                            )}
                        >
                            <item.icon className={cn(
                                'w-5 h-5 transition-transform duration-200',
                                isActive && 'drop-shadow-[0_0_8px_var(--color-primary)]',
                                'group-hover:scale-110'
                            )} />
                            {!collapsed && (
                                <span className="font-medium">{item.name}</span>
                            )}
                            {isActive && !collapsed && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                            )}
                        </NavLink>
                    )
                })}
            </nav>

            {/* Bottom Navigation - Help & Settings */}
            <nav className="flex flex-col gap-1 p-3 border-t border-[var(--color-border)]">
                {bottomNavigation.map((item) => {
                    const isActive = location.pathname === item.href

                    return (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                isActive
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                                collapsed && 'justify-center px-3'
                            )}
                        >
                            <item.icon className={cn(
                                'w-5 h-5 transition-transform duration-200',
                                isActive && 'drop-shadow-[0_0_8px_var(--color-primary)]',
                                'group-hover:scale-110'
                            )} />
                            {!collapsed && (
                                <span className="font-medium">{item.name}</span>
                            )}
                        </NavLink>
                    )
                })}
            </nav>

            {/* Collapse button */}
            <button
                onClick={toggleSidebar}
                className={cn(
                    'absolute bottom-24 right-0 translate-x-1/2 z-50',
                    'flex items-center justify-center w-8 h-8 rounded-full',
                    'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
                    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                    'hover:border-[var(--color-primary)] transition-all duration-200',
                    'shadow-lg'
                )}
            >
                {collapsed ? (
                    <ChevronRight className="w-4 h-4" />
                ) : (
                    <ChevronLeft className="w-4 h-4" />
                )}
            </button>
        </aside>
    )
}
