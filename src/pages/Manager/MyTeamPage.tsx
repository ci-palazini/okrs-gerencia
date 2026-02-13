import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
    Loader2,
    ShieldAlert,
    Users,
    Crown,
    Mail
} from 'lucide-react'
import type { DepartmentWithMembers } from '../../types'
import { formatUsername } from '../../lib/utils'

export function MyTeamPage() {
    const { t } = useTranslation()
    const { user: currentUser } = useAuth()
    const [department, setDepartment] = useState<DepartmentWithMembers | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Check if user is a manager
    const managerRole = currentUser?.department_members?.find(m => m.role === 'manager')
    const isManager = !!managerRole

    useEffect(() => {
        if (isManager && managerRole?.department_id) {
            loadTeam(managerRole.department_id)
        } else {
            setIsLoading(false)
        }
    }, [isManager, managerRole])

    async function loadTeam(deptId: string) {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('departments')
                .select(`
                    *,
                    department_members (
                        user_id,
                        role,
                        users (
                            id, email, full_name, avatar_url, role,
                            user_business_units (
                                business_unit_id,
                                business_units ( code )
                            )
                        )
                    )
                `)
                .eq('id', deptId)
                .single()

            if (error) throw error
            setDepartment(data as unknown as DepartmentWithMembers)
        } catch (error) {
            console.error('Error loading team:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (!currentUser) return null

    if (!isManager) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
                <ShieldAlert className="w-16 h-16 mb-4 text-[var(--color-text-muted)] opacity-20" />
                <h2 className="text-xl font-semibold">{t('myTeam.restricted', 'Acesso Restrito')}</h2>
                <p>{t('myTeam.managerOnly', 'Apenas gerentes de departamento têm acesso a esta página.')}</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex justify-center p-20">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
        )
    }

    if (!department) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
                <Users className="w-16 h-16 mb-4 opacity-20" />
                <h2 className="text-xl font-semibold">{t('myTeam.notFound', 'Departamento não encontrado')}</h2>
            </div>
        )
    }

    const members = department.department_members || []
    const manager = members.find(m => m.role === 'manager')
    const teamMembers = members.filter(m => m.role === 'member')

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <Users className="w-8 h-8 text-[var(--color-primary)]" />
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                        {t('myTeam.title', 'Meu Time')}
                    </h1>
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-1">{department.name}</h2>
                    {department.description && (
                        <p className="text-[var(--color-text-secondary)]">{department.description}</p>
                    )}
                    <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                        <span className="px-2.5 py-1 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                            {members.length} {members.length === 1 ? t('departments.memberSingular', 'membro') : t('departments.memberPlural', 'membros')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Manager Card (You) */}
            {manager && (
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500" />
                        {t('departments.manager', 'Gerente')}
                    </h3>
                    <div className="bg-[var(--color-surface)] border border-amber-500/20 rounded-xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                        {manager.users.avatar_url ? (
                            <img src={manager.users.avatar_url} alt="" className="w-12 h-12 rounded-full border-2 border-[var(--color-surface)] shadow-sm" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 font-bold text-lg">
                                {manager.users.full_name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <div className="font-bold text-[var(--color-text-primary)] text-lg flex items-center gap-2">
                                {manager.users.full_name}
                                {manager.users.id === currentUser.id && (
                                    <span className="text-xs font-normal text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                                        {t('myTeam.you', 'Você')}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-sm">
                                <Mail className="w-3.5 h-3.5" />
                                {formatUsername(manager.users.email)}
                            </div>
                            {manager.users.user_business_units?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {manager.users.user_business_units.map(ubu => (
                                        <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                            {ubu.business_units.code}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Team Members */}
            <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('departments.teamMembers', 'Membros do Time')}
                </h3>

                {teamMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teamMembers.map(member => (
                            <div
                                key={member.user_id}
                                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-[var(--color-primary)]/30 hover:shadow-md transition-all"
                            >
                                {member.users.avatar_url ? (
                                    <img src={member.users.avatar_url} alt="" className="w-12 h-12 rounded-full border border-[var(--color-border)]" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] font-bold text-lg">
                                        {member.users.full_name.charAt(0)}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-[var(--color-text-primary)] truncate" title={member.users.full_name}>
                                        {member.users.full_name}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)] text-xs mb-1.5 truncate" title={member.users.email}>
                                        <Mail className="w-3 h-3 flex-shrink-0" />
                                        {formatUsername(member.users.email)}
                                    </div>
                                    {member.users.user_business_units?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {member.users.user_business_units.map(ubu => (
                                                <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                    {ubu.business_units.code}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] border-dashed rounded-xl p-8 text-center">
                        <Users className="w-12 h-12 mx-auto text-[var(--color-text-muted)] opacity-20 mb-3" />
                        <p className="text-[var(--color-text-muted)]">{t('myTeam.noMembers', 'Ainda não há membros neste time.')}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
