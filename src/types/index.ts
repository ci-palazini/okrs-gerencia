/**
 * Tipos centralizados do OKR Dashboard
 * Este arquivo contém todos os tipos compartilhados pela aplicação.
 */

// =====================================================
// TIPOS BASE DO BANCO DE DADOS
// =====================================================

export interface BusinessUnit {
    id: string
    code: string
    name: string
    description?: string | null
    is_active: boolean
    order_index: number
    created_at?: string
    updated_at?: string
}

export interface Pillar {
    id: string
    code: string
    name: string
    description: string | null
    icon: string
    color: string
    order_index: number
    is_active: boolean
    business_unit_ids?: string[]
    // business_unit_id removed in migration 011
    created_at?: string
    updated_at?: string
}

export interface Objective {
    id: string
    code: string
    title: string
    description: string | null
    pillar_id: string
    business_unit_id: string
    year: number
    is_active: boolean
    created_at?: string
    updated_at?: string
}

export type KRScope = 'annual' | 'quarterly'

export interface KeyResult {
    id: string
    code: string
    title: string
    description?: string | null
    owner_name: string | null
    source: string | null
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    unit: string
    currency_type?: string | null
    order_index: number
    objective_id: string
    is_active: boolean
    // Hierarchy fields
    scope: KRScope
    parent_kr_id: string | null
    quarter: number | null // 1-4 for quarterly KRs
    target_direction: 'maximize' | 'minimize'
    // Data fields (previously in kr_quarterly_data)
    baseline: number | null
    target: number | null
    actual: number | null
    progress: number | null
    confidence: ConfidenceLevel
    notes?: string | null
    created_at?: string
    updated_at?: string
}

export type ConfidenceLevel = 'on_track' | 'at_risk' | 'off_track' | null

export interface MonthlyData {
    id: string
    key_result_id: string
    month: number // 1-12
    year: number
    actual: number | null
    notes?: string | null
    created_at?: string
    updated_at?: string
}

// Legacy type kept for compatibility during migration
export interface QuarterlyData {
    id: string
    key_result_id: string
    quarter: number
    year: number
    baseline: number | null
    target: number | null
    actual: number | null
    progress: number | null
    confidence: ConfidenceLevel
    notes?: string | null
    created_at?: string
    updated_at?: string
}

export interface Action {
    id: string
    key_result_id: string
    title: string
    description: string | null
    status: 'pending' | 'in_progress' | 'done' | 'blocked'
    priority: 'low' | 'medium' | 'high'
    due_date: string | null
    owner_name: string | null
    created_at?: string
    updated_at?: string
}

export interface AuditLog {
    id: string
    user_id: string | null
    user_email: string | null
    user_name: string | null
    action: 'create' | 'update' | 'delete'
    entity_type: string
    entity_id: string
    entity_name: string | null
    old_value: Record<string, unknown> | null
    new_value: Record<string, unknown> | null
    created_at: string
}

export interface User {
    id: string
    email: string
    full_name: string
    avatar_url: string | null
    role: 'admin' | 'user'
    created_at?: string
    updated_at?: string
}

export interface UserBusinessUnit {
    user_id: string
    business_unit_id: string
    created_at: string
}

export interface UserWithUnits extends User {
    user_business_units: {
        business_unit_id: string
        business_units: BusinessUnit
    }[]
    department_members?: {
        department_id: string
        role: 'manager' | 'member'
        departments?: {
            name: string
        }
    }[]
}

export interface Department {
    id: string
    name: string
    description: string | null
    is_active: boolean
    order_index: number
    created_at?: string
    updated_at?: string
}

export interface DepartmentMember {
    department_id: string
    user_id: string
    role: 'manager' | 'member'
    created_at?: string
}

export interface DepartmentWithMembers extends Department {
    department_members: {
        user_id: string
        role: 'manager' | 'member'
        users: UserWithUnits
    }[]
}

// =====================================================
// TIPOS COM RELAÇÕES
// =====================================================

export interface KeyResultWithChildren extends KeyResult {
    children: KeyResult[] // quarterly KRs
    monthly_data?: MonthlyData[]
}

// Legacy alias
export interface KeyResultWithQuarterly extends KeyResult {
    quarterlyData: QuarterlyData[]
}

export interface ObjectiveWithKRs extends Objective {
    key_results: KeyResult[]
    pillar?: Pillar
}

export interface PillarWithObjectives extends Pillar {
    objectives: ObjectiveWithKRs[]
}

// =====================================================
// TIPOS PARA COMPONENTES
// =====================================================

export interface NavItem {
    id: string
    name: string
    href: string
    icon_name: string
}

// Re-export ConfidenceLevel para uso em componentes
export type { ConfidenceLevel as ConfidenceLevelType }

