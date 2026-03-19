import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { UserWithUnits, BusinessUnit } from '../../types'
import { UserEditModal } from '../../components/Admin/UserEditModal'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Pencil, Loader2, ShieldCheck, User as UserIcon, UserPlus, Building2, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { formatUsername } from '../../lib/utils'

interface UserGroup {
    id: string
    label: string
    code?: string
    icon: 'admin' | 'company' | 'none'
    users: UserWithUnits[]
}

function UserRow({ user, onEdit }: { user: UserWithUnits; onEdit: (u: UserWithUnits) => void }) {
    const { t } = useTranslation()
    return (
        <tr className="group hover:bg-[var(--color-surface-hover)] transition-colors">
            <td className="p-4">
                <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] font-bold">
                            {user.full_name.charAt(0)}
                        </div>
                    )}
                    <div>
                        <div className="font-semibold text-[var(--color-text-primary)]">{user.full_name}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">{formatUsername(user.email)}</div>
                    </div>
                </div>
            </td>
            <td className="p-4">
                {user.role === 'admin' ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                        {t('users.administrator')}
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
                        <UserIcon className="w-3.5 h-3.5 mr-1" />
                        {t('users.userRole')}
                    </Badge>
                )}
            </td>
            <td className="p-4">
                {user.role === 'admin' ? (
                    <span className="text-sm text-[var(--color-text-muted)] italic">{t('users.fullAccess')}</span>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {user.user_business_units && user.user_business_units.length > 0 ? (
                            user.user_business_units.map((ubu: any) => (
                                <span
                                    key={ubu.business_unit_id}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                                >
                                    {ubu.business_units?.code || 'UNK'}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-red-400">{t('users.noAccess')}</span>
                        )}
                    </div>
                )}
            </td>
            <td className="p-4 text-right">
                <button
                    onClick={() => onEdit(user)}
                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
                    title={t('users.editPermissions')}
                >
                    <Pencil className="w-4 h-4" />
                </button>
            </td>
        </tr>
    )
}

function UserGroupSection({ group, onEdit }: { group: UserGroup; onEdit: (u: UserWithUnits) => void }) {
    const { t } = useTranslation()
    const [isOpen, setIsOpen] = useState(true)

    const iconElement = group.icon === 'admin' ? (
        <ShieldCheck className="w-5 h-5 text-amber-500" />
    ) : group.icon === 'company' ? (
        <Building2 className="w-5 h-5 text-[var(--color-primary)]" />
    ) : (
        <Users className="w-5 h-5 text-[var(--color-text-muted)]" />
    )

    return (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 px-5 py-4 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer text-left"
            >
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                )}
                {iconElement}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-[var(--color-text-primary)] text-base">{group.label}</span>
                    {group.code && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                            {group.code}
                        </span>
                    )}
                </div>
                <span className="text-sm text-[var(--color-text-muted)] flex-shrink-0">
                    {group.users.length} {group.users.length === 1 ? t('users.singular') : t('users.plural')}
                </span>
            </button>
            {isOpen && (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-border)]">
                            <th className="p-4 text-sm font-medium text-[var(--color-text-muted)]">{t('common.user')}</th>
                            <th className="p-4 text-sm font-medium text-[var(--color-text-muted)]">{t('users.role')}</th>
                            <th className="p-4 text-sm font-medium text-[var(--color-text-muted)]">{t('users.companies')}</th>
                            <th className="p-4 text-sm font-medium text-[var(--color-text-muted)] text-right">{t('sidebar.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {group.users.map(user => (
                            <UserRow key={user.id} user={user} onEdit={onEdit} />
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

export function UserManagementPage() {
    const { t } = useTranslation()
    const { user: currentUser } = useAuth()
    const navigate = useNavigate()
    const [users, setUsers] = useState<UserWithUnits[]>([])
    const [units, setUnits] = useState<BusinessUnit[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingUser, setEditingUser] = useState<UserWithUnits | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setIsLoading(true)
        try {
            // Fetch Units
            const { data: unitsData } = await supabase
                .from('business_units')
                .select('*')
                .eq('is_active', true)
                .order('order_index')

            if (unitsData) setUnits(unitsData)

            // Fetch Users with their units
            const { data: usersData, error } = await supabase
                .from('users')
                .select(`
                    *,
                    user_business_units (
                        business_unit_id,
                        business_units ( name, code )
                    )
                `)
                .order('full_name')

            if (error) throw error
            setUsers(usersData as unknown as UserWithUnits[])
        } catch (error) {
            console.error('Error loading users', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Group users by business unit
    const userGroups = useMemo<UserGroup[]>(() => {
        const groups: UserGroup[] = []

        // 1. Admins section
        const admins = users.filter(u => u.role === 'admin')
        if (admins.length > 0) {
            groups.push({
                id: '__admins__',
                label: t('users.adminGroup'),
                icon: 'admin',
                users: admins,
            })
        }

        // 2. One section per business unit (ordered by order_index from DB)
        for (const unit of units) {
            const unitUsers = users.filter(
                u => u.role !== 'admin' && u.user_business_units?.some(ubu => ubu.business_unit_id === unit.id)
            )
            if (unitUsers.length > 0) {
                groups.push({
                    id: unit.id,
                    label: unit.name,
                    code: unit.code,
                    icon: 'company',
                    users: unitUsers,
                })
            }
        }

        // 3. Users without any assignment (non-admin)
        const unassigned = users.filter(
            u => u.role !== 'admin' && (!u.user_business_units || u.user_business_units.length === 0)
        )
        if (unassigned.length > 0) {
            groups.push({
                id: '__unassigned__',
                label: t('users.unassigned'),
                icon: 'none',
                users: unassigned,
            })
        }

        return groups
    }, [users, units])

    const handleSaveUser = async (userId: string, role: 'admin' | 'user', unitIds: string[]) => {
        try {
            // 1. Update role
            const { error: roleError } = await supabase
                .from('users')
                .update({ role })
                .eq('id', userId)

            if (roleError) throw roleError

            // 2. Update assignments
            await supabase
                .from('user_business_units')
                .delete()
                .eq('user_id', userId)

            if (unitIds.length > 0) {
                const { error: insertError } = await supabase
                    .from('user_business_units')
                    .insert(
                        unitIds.map(bid => ({ user_id: userId, business_unit_id: bid }))
                    )
                if (insertError) throw insertError
            }

            loadData()
        } catch (error) {
            console.error('Error saving user:', error)
            alert(t('users.saveFailed'))
        }
    }

    if (!currentUser || currentUser.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
                <ShieldCheck className="w-16 h-16 mb-4 text-[var(--color-text-muted)] opacity-20" />
                <h2 className="text-xl font-semibold">{t('users.restricted', 'Acesso Restrito')}</h2>
                <p>{t('users.adminOnly', 'Apenas administradores podem acessar esta página.')}</p>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('users.title')}</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">{t('users.subtitle')}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[var(--color-surface-elevated)] px-4 py-2 rounded-lg border border-[var(--color-border)]">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('users.totalCount', { count: users.length })}</span>
                    </div>
                    <Button onClick={() => navigate('/admin/users/create')}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        {t('users.newUser')}
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
            ) : (
                <div className="space-y-4">
                    {userGroups.map(group => (
                        <UserGroupSection
                            key={group.id}
                            group={group}
                            onEdit={setEditingUser}
                        />
                    ))}
                    {userGroups.length === 0 && (
                        <div className="text-center py-12 text-[var(--color-text-muted)]">
                            {t('users.notFound')}
                        </div>
                    )}
                </div>
            )}

            {editingUser && (
                <UserEditModal
                    isOpen={!!editingUser}
                    onClose={() => setEditingUser(null)}
                    user={editingUser}
                    allUnits={units}
                    onSave={handleSaveUser}
                />
            )}
        </div>
    )
}
