import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { TeamEditModal } from '../../components/Admin/TeamEditModal'
import { Button } from '../../components/ui/Button'
import {
    Loader2,
    Crown,
    Users,
    Plus,
    Pencil,
    Trash2,
    ChevronDown,
    ChevronRight,
    Network,
} from 'lucide-react'
import type { UserWithUnits, TeamWithMembers } from '../../types'
import { formatUsername } from '../../lib/utils'

export function TeamsPage() {
    const { t } = useTranslation()
    const [teams, setTeams] = useState<TeamWithMembers[]>([])
    const [allUsers, setAllUsers] = useState<UserWithUnits[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [editingTeam, setEditingTeam] = useState<TeamWithMembers | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setIsLoading(true)
        try {
            const [teamsRes, usersRes] = await Promise.all([
                supabase
                    .from('teams')
                    .select(`
                        *,
                        team_members (
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
                    .order('order_index'),
                supabase
                    .from('users')
                    .select(`
                        *,
                        user_business_units (
                            business_unit_id,
                            business_units ( code )
                        )
                    `)
                    .order('full_name'),
            ])

            if (teamsRes.data) setTeams(teamsRes.data as unknown as TeamWithMembers[])
            if (usersRes.data) setAllUsers(usersRes.data as unknown as UserWithUnits[])
        } catch (error) {
            console.error('Error loading teams:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenCreate = () => {
        setEditingTeam(null)
        setModalOpen(true)
    }

    const handleOpenEdit = (team: TeamWithMembers) => {
        setEditingTeam(team)
        setModalOpen(true)
    }

    const handleSave = async (data: {
        id?: string
        name: string
        description: string | null
        leaderId: string | null
        memberIds: string[]
    }) => {
        if (data.id) {
            // Atualizar time existente
            const { error: teamError } = await supabase
                .from('teams')
                .update({ name: data.name, description: data.description })
                .eq('id', data.id)

            if (teamError) throw teamError

            // Reconstruir membros
            await supabase.from('team_members').delete().eq('team_id', data.id)

            const membersToInsert = data.memberIds.map(uid => ({
                team_id: data.id!,
                user_id: uid,
                role: uid === data.leaderId ? 'leader' as const : 'member' as const,
            }))

            if (membersToInsert.length > 0) {
                const { error: membersError } = await supabase
                    .from('team_members')
                    .insert(membersToInsert)
                if (membersError) throw membersError
            }
        } else {
            // Criar novo time
            const { data: newTeam, error: createError } = await supabase
                .from('teams')
                .insert({
                    name: data.name,
                    description: data.description,
                    order_index: teams.length,
                })
                .select()
                .single()

            if (createError || !newTeam) throw createError

            const membersToInsert = data.memberIds.map(uid => ({
                team_id: newTeam.id,
                user_id: uid,
                role: uid === data.leaderId ? 'leader' as const : 'member' as const,
            }))

            if (membersToInsert.length > 0) {
                const { error: membersError } = await supabase
                    .from('team_members')
                    .insert(membersToInsert)
                if (membersError) throw membersError
            }
        }

        await loadData()
    }

    const handleDelete = async (teamId: string, teamName: string) => {
        const confirmed = window.confirm(
            t('teams.deleteConfirm', `Tem certeza que deseja excluir o time "{{name}}"? Todos os membros serão desvinculados.`, { name: teamName })
        )
        if (!confirmed) return

        try {
            const { error } = await supabase.from('teams').delete().eq('id', teamId)
            if (error) throw error
            await loadData()
        } catch (error) {
            console.error('Error deleting team:', error)
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                        {t('teams.title', 'Times')}
                    </h1>
                    <p className="text-[var(--color-text-muted)] mt-1">
                        {t('teams.subtitle', 'Organize colaboradores em times para acompanhamento de OKRs')}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[var(--color-surface-elevated)] px-4 py-2 rounded-lg border border-[var(--color-border)]">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                            {teams.length} {teams.length === 1
                                ? t('teams.countSingular', 'time')
                                : t('teams.countPlural', 'times')
                            }
                        </span>
                    </div>
                    <Button onClick={handleOpenCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('teams.newTeam', 'Novo Time')}
                    </Button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center p-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
            ) : teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--color-text-muted)]">
                    <Network className="w-16 h-16 mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold mb-1">{t('teams.emptyTitle', 'Nenhum time cadastrado')}</h3>
                    <p className="text-sm mb-6">{t('teams.emptyDesc', 'Crie times para organizar colaboradores e acompanhar OKRs por equipe.')}</p>
                    <Button onClick={handleOpenCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('teams.createFirst', 'Criar Primeiro Time')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {teams.map(team => (
                        <TeamCard
                            key={team.id}
                            team={team}
                            onEdit={() => handleOpenEdit(team)}
                            onDelete={() => handleDelete(team.id, team.name)}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <TeamEditModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingTeam(null) }}
                team={editingTeam}
                allUsers={allUsers}
                currentLeaderId={
                    editingTeam?.team_members?.find(m => m.role === 'leader')?.user_id ?? null
                }
                currentMemberIds={
                    editingTeam?.team_members?.map(m => m.user_id) ?? []
                }
                onSave={handleSave}
            />
        </div>
    )
}

// ─── Team Card ────────────────────────────────────────────────────

function TeamCard({
    team,
    onEdit,
    onDelete,
}: {
    team: TeamWithMembers
    onEdit: () => void
    onDelete: () => void
}) {
    const { t } = useTranslation()
    const [isOpen, setIsOpen] = useState(true)

    const members = team.team_members || []
    const leader = members.find(m => m.role === 'leader')
    const teamMembers = members.filter(m => m.role === 'member')

    return (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-[var(--color-surface-elevated)]">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                >
                    {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                    )}
                    <Network className="w-5 h-5 text-[var(--color-primary)]" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-semibold text-[var(--color-text-primary)] text-base">{team.name}</span>
                        {team.description && (
                            <span className="text-xs text-[var(--color-text-muted)] truncate hidden sm:inline">
                                — {team.description}
                            </span>
                        )}
                    </div>
                    <span className="text-sm text-[var(--color-text-muted)] flex-shrink-0">
                        {members.length} {members.length === 1 ? t('teams.memberSingular', 'membro') : t('teams.memberPlural', 'membros')}
                    </span>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={onEdit}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
                        title={t('common.edit', 'Editar')}
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                        title={t('common.delete', 'Excluir')}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Body */}
            {isOpen && (
                <div className="p-5 space-y-4">
                    {/* Leader Section */}
                    {leader && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                                {t('teams.leader', 'Líder')}
                            </h4>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                {leader.users.avatar_url ? (
                                    <img src={leader.users.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold">
                                        {leader.users.full_name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2 flex-wrap">
                                        {leader.users.full_name}
                                        {leader.users.user_business_units?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {leader.users.user_business_units.map(ubu => (
                                                    <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                        {ubu.business_units.code}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-sm text-[var(--color-text-muted)]">{formatUsername(leader.users.email)}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Team Members Section */}
                    {teamMembers.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                {t('teams.teamMembers', 'Membros do Time')} ({teamMembers.length})
                            </h4>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {teamMembers.map(member => (
                                    <div
                                        key={member.user_id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]"
                                    >
                                        {member.users.avatar_url ? (
                                            <img src={member.users.avatar_url} alt="" className="w-9 h-9 rounded-full" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] font-bold text-sm">
                                                {member.users.full_name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="font-medium text-sm text-[var(--color-text-primary)] flex items-center gap-2 flex-wrap">
                                                {member.users.full_name}
                                                {member.users.user_business_units?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {member.users.user_business_units.map(ubu => (
                                                            <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                                {ubu.business_units.code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-muted)] truncate">{formatUsername(member.users.email)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {members.length === 0 && (
                        <div className="text-center py-6 text-[var(--color-text-muted)] text-sm">
                            {t('teams.noMembers', 'Nenhum membro vinculado. Clique em editar para adicionar.')}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
