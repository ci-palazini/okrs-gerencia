import { useAuth } from '../../hooks/useAuth'
import { LogOut, User, Bell } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export function Header() {
    const { user, signOut } = useAuth()

    // Get name from user metadata or email
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-[var(--color-background)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
            {/* Left side - Breadcrumb or Title */}
            <div>
                <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    OKR Dashboard
                </h1>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center gap-4">
                {/* Notifications */}
                <button className="relative p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                </button>

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
                            >
                                <User className="w-4 h-4" />
                                Meu Perfil
                            </DropdownMenu.Item>

                            <DropdownMenu.Separator className="h-px my-2 bg-[var(--color-border)]" />

                            <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] rounded-lg cursor-pointer outline-none hover:bg-[var(--color-danger-muted)] transition-colors"
                                onClick={() => signOut()}
                            >
                                <LogOut className="w-4 h-4" />
                                Sair
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </div>
        </header>
    )
}
