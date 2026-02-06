import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import { UnitToggle } from '../ui/UnitToggle'
import { LogOut, User, Languages } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useNavigate } from 'react-router-dom'

export function Header() {
    const { t, i18n } = useTranslation()
    const { user, signOut } = useAuth()
    const { units, selectedUnit, setSelectedUnit } = useBusinessUnit()
    const navigate = useNavigate()

    // Get name from user metadata or email
    const displayName = user?.full_name || user?.email?.split('@')[0] || t('header.user')

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-[var(--color-background)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
            {/* Left side - Breadcrumb or Title */}
            <div>
                <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    OKR Dashboard
                </h1>
            </div>

            {/* Right side - User menu and Unit Selector */}
            <div className="flex items-center gap-4">
                <UnitToggle
                    units={units}
                    selectedUnit={selectedUnit}
                    onSelect={setSelectedUnit}
                />

                {/* Language Switcher */}
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors">
                            <Languages className="w-5 h-5" />
                            <span className="text-sm font-medium uppercase">{i18n.resolvedLanguage || 'pt'}</span>
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="min-w-[120px] p-1 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-xl animate-in fade-in-0 zoom-in-95"
                            sideOffset={8}
                            align="end"
                        >
                            <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-secondary)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                                onClick={() => i18n.changeLanguage('pt')}
                            >
                                <span className="w-6 text-center">🇧🇷</span>
                                Português
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-secondary)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                                onClick={() => i18n.changeLanguage('es')}
                            >
                                <span className="w-6 text-center">🇦🇷</span>
                                Español
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* User Dropdown */}
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors">
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-blue-800">
                                <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                    {displayName}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {user?.email}
                                </p>
                            </div>
                        </button>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="min-w-[200px] p-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-xl animate-in fade-in-0 zoom-in-95"
                            sideOffset={8}
                            align="end"
                        >
                            <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-secondary)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                                onClick={() => navigate('/profile')}
                            >
                                <User className="w-4 h-4" />
                                {t('header.myProfile')}
                            </DropdownMenu.Item>

                            <DropdownMenu.Separator className="h-px my-2 bg-[var(--color-border)]" />

                            <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-danger-muted)] transition-colors"
                                onClick={() => signOut()}
                            >
                                <LogOut className="w-4 h-4" />
                                {t('auth.logout')}
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </div>
        </header>
    )
}
