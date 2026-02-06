import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    LayoutDashboard,
    Target,
    ListTodo,
    Settings,
    ChevronLeft,
    ChevronRight,
    History,
    HelpCircle,
    Building2,
    Lightbulb,
    Plus,
    Edit3,
    Users
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSettings } from '../../contexts/SettingsContext'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'



export function Sidebar() {
    const { t } = useTranslation()
    const { sidebarCollapsed, toggleSidebar } = useSettings()
    const { selectedUnit } = useBusinessUnit() // Use global context
    const location = useLocation()
    const { user } = useAuth()
    const collapsed = sidebarCollapsed

    const [dynamicPillars, setDynamicPillars] = useState<any[]>([])

    useEffect(() => {
        if (selectedUnit) {
            loadPillars()
        }
    }, [selectedUnit])

    async function loadPillars() {
        try {
            const [pillarsRes, pivotRes] = await Promise.all([
                supabase
                    .from('pillars')
                    .select('*')
                    .eq('is_active', true)
                    .order('order_index'),
                supabase
                    .from('pillar_business_units')
                    .select('*')
            ])

            const pillarsData = pillarsRes.data
            const pivotData = pivotRes.data

            if (pillarsData && pivotData) {
                // Determine visibility
                // A pillar is visible if:
                // 1. It is mapped to the selected unit in pivot table
                // 2. OR it is mapped to ALL units (Global) - conceptually "Global" is just "Mapped to All", but practically we check if it's mapped to THIS unit.
                // Wait, if it IS mapped to this unit, it's visible. Period.

                // So we just need to check if there is an entry in pivot table for (pillar_id, selectedUnit)

                // However, "Global" legacy logic meant (business_unit_id IS NULL).
                // Migration 011 converted NULL to "Mapped to All".
                // So checking for existence in pivot is correct.

                const visiblePillars = pillarsData.filter(p => {
                    const isMapped = pivotData.some((r: any) => r.pillar_id === p.id && r.business_unit_id === selectedUnit)
                    return isMapped
                })

                // Map to nav items
                const navItems = visiblePillars.map(p => ({
                    id: p.id,
                    name: p.name,
                    // Usar sempre a rota dinâmica
                    href: `/pillar/${p.id}`,
                    icon: p.icon // Pass original icon name (kebab-case)
                }))

                setDynamicPillars(navItems)
            }
        } catch (error) {
            console.error('Error loading sidebar pillars:', error)
        }
    }

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
                    { name: t('sidebar.corporateObjectives'), href: '/objectives-corporate', icon: Building2 },
                    { name: t('sidebar.okrs'), href: '/okrs', icon: Target },
                ].map((item) => {
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
                            {isActive && !collapsed && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                            )}
                        </NavLink>
                    )
                })}

                {/* Divider if pillars exist */}
                {dynamicPillars.length > 0 && (
                    <div className="my-2 border-t border-[var(--color-border)] opacity-50" />
                )}

                {/* Dynamic Pillar Links */}
                {dynamicPillars.map((pillar) => {
                    const isActive = location.pathname === pillar.href

                    // Dynamic icon mapping (kebab-case -> PascalCase)
                    const iconName = pillar.icon
                        ? pillar.icon.split('-').map((part: string) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
                        : 'Circle'

                    const IconComponent = (LucideIcons[iconName as keyof typeof LucideIcons] as React.ElementType) || Target

                    return (
                        <NavLink
                            key={pillar.id}
                            to={pillar.href}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                isActive
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                                collapsed && 'justify-center px-3'
                            )}
                        >
                            <IconComponent className={cn(
                                'w-5 h-5 transition-transform duration-200',
                                isActive && 'drop-shadow-[0_0_8px_var(--color-primary)]',
                                'group-hover:scale-110'
                            )} />
                            {!collapsed && (
                                <span className="font-medium truncate" title={pillar.name}>{pillar.name}</span>
                            )}
                            {isActive && !collapsed && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                            )}
                        </NavLink>
                    )
                })}

                {/* Manage Pillars Shortcut */}
                <NavLink
                    to="/settings?tab=pillars"
                    className={({ isActive }) => cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group mt-2',
                        isActive && location.search.includes('tab=pillars')
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                        collapsed && 'justify-center px-3'
                    )}
                    title="Gerenciar Pilares"
                >
                    <Edit3 className={cn(
                        "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                        location.pathname === '/settings' && location.search.includes('tab=pillars') && 'drop-shadow-[0_0_8px_var(--color-primary)]'
                    )} />
                    {!collapsed && <span className="font-medium">{t('sidebar.managePillars')}</span>}
                </NavLink>

                {/* Other standard links that are not pillars but specific pages */}
                {[
                    { name: t('sidebar.actions'), href: '/actions', icon: ListTodo },
                    { name: t('sidebar.ideas'), href: '/ideas', icon: Lightbulb },
                    { name: t('sidebar.audit'), href: '/audit', icon: History },
                ].map((item) => {
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
                    <NavLink
                        to="/admin/users"
                        className={({ isActive }) => cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                            isActive
                                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                            collapsed && 'justify-center px-3'
                        )}
                        title="Gerenciar Usuários"
                    >
                        <Users className={cn(
                            'w-5 h-5 transition-transform duration-200 group-hover:scale-110',
                            location.pathname === '/admin/users' && 'drop-shadow-[0_0_8px_var(--color-primary)]'
                        )} />
                        {!collapsed && <span className="font-medium">Usuários</span>}
                    </NavLink>
                )}

                {[
                    { name: t('sidebar.help'), href: '/help', icon: HelpCircle },
                    { name: t('sidebar.settings'), href: '/settings', icon: Settings },
                ].map((item) => {
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
