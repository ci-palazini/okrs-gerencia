import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    LayoutDashboard,
    Target,
    ListTodo,
    Settings,
    ChevronLeft,
    ChevronRight,
    History,
    Users,
    FolderTree,
    Megaphone,
    TrendingUp,
    Layers
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSettings } from '../../contexts/SettingsContext'
import { useAuth } from '../../hooks/useAuth'





export function Sidebar() {
    const { t } = useTranslation()
    const { sidebarCollapsed, toggleSidebar } = useSettings()
    const location = useLocation()
    const { user } = useAuth()
    const collapsed = sidebarCollapsed
    const isRouteActive = (href: string) => (
        location.pathname === href ||
        (href !== '/' && location.pathname.startsWith(`${href}/`))
    )

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
                            alt={t('header.appTitle')}
                            className={cn(
                                "object-contain transition-all duration-300",
                                collapsed ? "h-6 w-auto" : "h-8 w-auto"
                            )}
                        />
                        {!collapsed && (
                            <div className="flex flex-col whitespace-nowrap">
                                <span className="text-lg font-bold text-[var(--color-text-primary)] leading-none">{t('sidebar.okrs')}</span>
                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-tight">{t('sidebar.managementControl')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex flex-col gap-1 p-3 mt-4 flex-1 overflow-y-auto">
                {/* Static Links */}
                {[
                    { name: t('sidebar.dashboard'), href: '/', icon: LayoutDashboard },
                    { name: t('sidebar.okrs'), href: '/okrs', icon: Target },
                    { name: t('sidebar.tracking'), href: '/kr-tracking', icon: TrendingUp },
                    { name: t('sidebar.pillars'), href: '/pillars', icon: Layers },
                ].map((item) => {
                    const isActive = isRouteActive(item.href)
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

                {/* Other standard links that are not pillars but specific pages */}
                {[
                    { name: t('sidebar.actions'), href: '/actions', icon: ListTodo },
                    { name: t('sidebar.audit'), href: '/audit', icon: History },
                ].map((item) => {
                    const isActive = isRouteActive(item.href)
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
                {/* Admin Link */}
                {user?.role === 'admin' && (
                    <>
                        <NavLink
                            to="/admin/users"
                            className={({ isActive }) => cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                isActive
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                                collapsed && 'justify-center px-3'
                            )}
                            title={t('users.title')}
                        >
                            <Users className={cn(
                                'w-5 h-5 transition-transform duration-200 group-hover:scale-110',
                                location.pathname === '/admin/users' && 'drop-shadow-[0_0_8px_var(--color-primary)]'
                            )} />
                            {!collapsed && <span className="font-medium">{t('sidebar.users')}</span>}
                        </NavLink>
                        <NavLink
                            to="/admin/departments"
                            className={({ isActive }) => cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                isActive
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                                collapsed && 'justify-center px-3'
                            )}
                            title={t('departments.title', 'Departamentos')}
                        >
                            <FolderTree className={cn(
                                'w-5 h-5 transition-transform duration-200 group-hover:scale-110',
                                location.pathname === '/admin/departments' && 'drop-shadow-[0_0_8px_var(--color-primary)]'
                            )} />
                            {!collapsed && <span className="font-medium">{t('departments.title', 'Departamentos')}</span>}
                        </NavLink>
                    </>
                )}

                {/* Manager Link */}
                {user?.department_members?.some(m => m.role === 'manager') && (
                    <NavLink
                        to="/my-team"
                        className={({ isActive }) => cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                            isActive
                                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                            collapsed && 'justify-center px-3'
                        )}
                        title={t('myTeam.title', 'Meu Time')}
                    >
                        <Megaphone className={cn(
                            'w-5 h-5 transition-transform duration-200 group-hover:scale-110',
                            location.pathname === '/my-team' && 'drop-shadow-[0_0_8px_var(--color-primary)]'
                        )} />
                        {!collapsed && <span className="font-medium">{t('myTeam.title', 'Meu Time')}</span>}
                    </NavLink>
                )}

                {[
                    { name: t('sidebar.settings'), href: '/settings', icon: Settings },
                ].map((item) => {
                    const isActive = isRouteActive(item.href)

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
