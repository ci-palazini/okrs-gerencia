import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { UserWithUnits, BusinessUnit } from '../../types'
import { UserEditModal } from '../../components/Admin/UserEditModal'
import { Badge } from '../../components/ui/Badge'
import { Pencil, Loader2, ShieldCheck, User as UserIcon } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function UserManagementPage() {
    const { user: currentUser } = useAuth()
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
            // Note: Typescript might complain about join structure if not casted, 
            // as standard query returns arrays.
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

    const handleSaveUser = async (userId: string, role: 'admin' | 'user', unitIds: string[]) => {
        try {
            // 1. Update role
            const { error: roleError } = await supabase
                .from('users')
                .update({ role })
                .eq('id', userId)

            if (roleError) throw roleError

            // 2. Update assignments
            // Delete existing
            await supabase
                .from('user_business_units')
                .delete()
                .eq('user_id', userId)

            // Insert new (if any)
            if (unitIds.length > 0) {
                const { error: insertError } = await supabase
                    .from('user_business_units')
                    .insert(
                        unitIds.map(bid => ({ user_id: userId, business_unit_id: bid }))
                    )
                if (insertError) throw insertError
            }

            // Reload data
            loadData()
        } catch (error) {
            console.error('Error saving user:', error)
            alert('Não foi possível salvar as alterações. Verifique se você tem permissão.')
        }
    }

    if (!currentUser || currentUser.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
                <ShieldCheck className="w-16 h-16 mb-4 text-[var(--color-text-muted)] opacity-20" />
                <h2 className="text-xl font-semibold">Acesso Restrito</h2>
                <p>Apenas administradores podem acessar esta página.</p>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Gerenciamento de Usuários</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Configure permissões de acesso e atribuições de empresas</p>
                </div>
                <div className="bg-[var(--color-surface-elevated)] px-4 py-2 rounded-lg border border-[var(--color-border)]">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">Total: {users.length} usuários</span>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
            ) : (
                <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)]">
                                <th className="p-4 text-sm font-medium text-[var(--color-text-muted)]">Usuário</th>
                                <th className="p-4 text-sm font-medium text-[var(--color-text-muted)]">Função</th>
                                <th className="p-4 text-sm font-medium text-[var(--color-text-muted)]">Acesso às Empresas</th>
                                <th className="p-4 text-sm font-medium text-[var(--color-text-muted)] text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {users.map(user => (
                                <tr key={user.id} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
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
                                                <div className="text-sm text-[var(--color-text-muted)]">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {user.role === 'admin' ? (
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                                Admin
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
                                                <UserIcon className="w-3.5 h-3.5 mr-1" />
                                                Usuário
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {user.role === 'admin' ? (
                                            <span className="text-sm text-[var(--color-text-muted)] italic">Acesso total (Admin)</span>
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
                                                    <span className="text-sm text-red-400">Sem acesso</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => setEditingUser(user)}
                                            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
                                            title="Editar permissões"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
