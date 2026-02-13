import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DepartmentEditModal } from '../../components/Admin/DepartmentEditModal'
import { Button } from '../../components/ui/Button'
import {
    Loader2,
    ShieldCheck,
    Crown,
    Users,
    Plus,
    Pencil,
    Trash2,
    ChevronDown,
    ChevronRight,
    FolderTree,
} from 'lucide-react'
import type { UserWithUnits, DepartmentWithMembers } from '../../types'
import { formatUsername } from '../../lib/utils'

export function DepartmentsPage() {
    const { t } = useTranslation()
    const { user: currentUser } = useAuth()
    const [departments, setDepartments] = useState<DepartmentWithMembers[]>([])
    const [allUsers, setAllUsers] = useState<UserWithUnits[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [editingDept, setEditingDept] = useState<DepartmentWithMembers | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setIsLoading(true)
        try {
            const [deptsRes, usersRes] = await Promise.all([
                supabase
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

            if (deptsRes.data) setDepartments(deptsRes.data as unknown as DepartmentWithMembers[])
            if (usersRes.data) setAllUsers(usersRes.data as unknown as UserWithUnits[])
        } catch (error) {
            console.error('Error loading departments:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Set of user IDs that already belong to some department
    const usersInDepartments = useMemo(() => {
        const map = new Map<string, string>() // userId -> departmentId
        for (const dept of departments) {
            for (const m of dept.department_members || []) {
                map.set(m.user_id, dept.id)
            }
        }
        return map
    }, [departments])

    const handleOpenCreate = () => {
        setEditingDept(null)
        setModalOpen(true)
    }

    const handleOpenEdit = (dept: DepartmentWithMembers) => {
        setEditingDept(dept)
        setModalOpen(true)
    }

    const handleSave = async (data: {
        id?: string
        name: string
        description: string | null
        managerId: string | null
        memberIds: string[]
    }) => {
        if (data.id) {
            // Update existing department
            const { error: deptError } = await supabase
                .from('departments')
                .update({ name: data.name, description: data.description })
                .eq('id', data.id)

            if (deptError) throw deptError

            // Rebuild members
            await supabase.from('department_members').delete().eq('department_id', data.id)

            const membersToInsert = data.memberIds.map(uid => ({
                department_id: data.id!,
                user_id: uid,
                role: uid === data.managerId ? 'manager' as const : 'member' as const,
            }))

            if (membersToInsert.length > 0) {
                const { error: membersError } = await supabase
                    .from('department_members')
                    .insert(membersToInsert)
                if (membersError) throw membersError
            }
        } else {
            // Create new department
            const { data: newDept, error: createError } = await supabase
                .from('departments')
                .insert({
                    name: data.name,
                    description: data.description,
                    order_index: departments.length,
                })
                .select()
                .single()

            if (createError || !newDept) throw createError

            const membersToInsert = data.memberIds.map(uid => ({
                department_id: newDept.id,
                user_id: uid,
                role: uid === data.managerId ? 'manager' as const : 'member' as const,
            }))

            if (membersToInsert.length > 0) {
                const { error: membersError } = await supabase
                    .from('department_members')
                    .insert(membersToInsert)
                if (membersError) throw membersError
            }
        }

        await loadData()
    }

    const handleDelete = async (deptId: string, deptName: string) => {
        const confirmed = window.confirm(
            t('departments.deleteConfirm', `Tem certeza que deseja excluir o departamento "{{name}}"? Todos os membros serão desvinculados.`, { name: deptName })
        )
        if (!confirmed) return

        try {
            const { error } = await supabase.from('departments').delete().eq('id', deptId)
            if (error) throw error
            await loadData()
        } catch (error) {
            console.error('Error deleting department:', error)
        }
    }

    // --- Access guard ---
    if (!currentUser || currentUser.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
                <ShieldCheck className="w-16 h-16 mb-4 text-[var(--color-text-muted)] opacity-20" />
                <h2 className="text-xl font-semibold">{t('departments.restricted', 'Acesso Restrito')}</h2>
                <p>{t('departments.adminOnly', 'Apenas administradores podem acessar esta página.')}</p>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                        {t('departments.title', 'Departamentos')}
                    </h1>
                    <p className="text-[var(--color-text-muted)] mt-1">
                        {t('departments.subtitle', 'Organize gerentes e equipes por departamento')}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[var(--color-surface-elevated)] px-4 py-2 rounded-lg border border-[var(--color-border)]">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                            {departments.length} {departments.length === 1
                                ? t('departments.countSingular', 'departamento')
                                : t('departments.countPlural', 'departamentos')
                            }
                        </span>
                    </div>
                    <Button onClick={handleOpenCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('departments.newDepartment', 'Novo Departamento')}
                    </Button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center p-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
            ) : departments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--color-text-muted)]">
                    <FolderTree className="w-16 h-16 mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold mb-1">{t('departments.emptyTitle', 'Nenhum departamento cadastrado')}</h3>
                    <p className="text-sm mb-6">{t('departments.emptyDesc', 'Crie departamentos para organizar gerentes e equipes.')}</p>
                    <Button onClick={handleOpenCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('departments.createFirst', 'Criar Primeiro Departamento')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {departments.map(dept => (
                        <DepartmentCard
                            key={dept.id}
                            department={dept}
                            onEdit={() => handleOpenEdit(dept)}
                            onDelete={() => handleDelete(dept.id, dept.name)}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <DepartmentEditModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingDept(null) }}
                department={editingDept}
                allUsers={allUsers}
                currentManagerId={
                    editingDept?.department_members?.find(m => m.role === 'manager')?.user_id ?? null
                }
                currentMemberIds={
                    editingDept?.department_members?.map(m => m.user_id) ?? []
                }
                usersInOtherDepartments={
                    // Users that belong to departments OTHER than the one being edited
                    Array.from(usersInDepartments.entries())
                        .filter(([, deptId]) => deptId !== editingDept?.id)
                        .map(([userId]) => userId)
                }
                onSave={handleSave}
            />
        </div>
    )
}

// ─── Department Card ─────────────────────────────────────────────

function DepartmentCard({
    department,
    onEdit,
    onDelete,
}: {
    department: DepartmentWithMembers
    onEdit: () => void
    onDelete: () => void
}) {
    const { t } = useTranslation()
    const [isOpen, setIsOpen] = useState(true)

    const members = department.department_members || []
    const manager = members.find(m => m.role === 'manager')
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
                    <FolderTree className="w-5 h-5 text-[var(--color-primary)]" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-semibold text-[var(--color-text-primary)] text-base">{department.name}</span>
                        {department.description && (
                            <span className="text-xs text-[var(--color-text-muted)] truncate hidden sm:inline">
                                — {department.description}
                            </span>
                        )}
                    </div>
                    <span className="text-sm text-[var(--color-text-muted)] flex-shrink-0">
                        {members.length} {members.length === 1 ? t('departments.memberSingular', 'membro') : t('departments.memberPlural', 'membros')}
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
                    {/* Manager Section */}
                    {manager && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                                {t('departments.manager', 'Gerente')}
                            </h4>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                {manager.users.avatar_url ? (
                                    <img src={manager.users.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold">
                                        {manager.users.full_name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="font-semibold text-[var(--color-text-primary)]">
                                        {manager.users.full_name}
                                        {manager.users.user_business_units?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 ml-2">
                                                {manager.users.user_business_units.map(ubu => (
                                                    <span key={ubu.business_unit_id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                                                        {ubu.business_units.code}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-sm text-[var(--color-text-muted)]">{formatUsername(manager.users.email)}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Team Members Section */}
                    {teamMembers.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                {t('departments.teamMembers', 'Membros do Time')} ({teamMembers.length})
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
                                            <div className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                                                {member.users.full_name}
                                                {member.users.user_business_units?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 ml-2">
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
                            {t('departments.noMembers', 'Nenhum membro vinculado. Clique em editar para adicionar.')}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
