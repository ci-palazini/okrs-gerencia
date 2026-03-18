import { supabase } from './supabase'

export interface AssigneeOption {
    id: string
    name: string
    email: string | null
}

interface UserBusinessUnitRow {
    business_unit_id: string
}

interface UserWithUnitsRow {
    id: string
    full_name: string | null
    email: string | null
    role: 'admin' | 'user'
    user_business_units: UserBusinessUnitRow[] | null
}

export async function listAssigneesForBusinessUnit(businessUnitId: string): Promise<AssigneeOption[]> {
    if (!businessUnitId) return []

    const { data, error } = await supabase
        .from('users')
        .select(`
            id,
            full_name,
            email,
            role,
            user_business_units (
                business_unit_id
            )
        `)
        .order('full_name')

    if (error) {
        throw error
    }

    const rows = (data || []) as UserWithUnitsRow[]
    const filtered = rows.filter((row) => (
        row.role === 'admin'
        || (row.user_business_units || []).some((ubu) => ubu.business_unit_id === businessUnitId)
    ))

    const uniqueById = new Map<string, AssigneeOption>()
    filtered.forEach((row) => {
        uniqueById.set(row.id, {
            id: row.id,
            name: row.full_name || row.email || '',
            email: row.email,
        })
    })

    return Array.from(uniqueById.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
