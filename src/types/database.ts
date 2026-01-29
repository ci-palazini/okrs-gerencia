/**
 * Tipos gerados a partir do schema do Supabase
 * Este arquivo deve ser atualizado quando o schema do banco mudar.
 * 
 * Para tipos de uso geral na aplicação, use src/types/index.ts
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    full_name: string
                    email: string
                    avatar_url: string | null
                    role: 'admin' | 'user'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    full_name: string
                    email: string
                    avatar_url?: string | null
                    role?: 'admin' | 'user'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string
                    email?: string
                    avatar_url?: string | null
                    role?: 'admin' | 'user'
                    updated_at?: string
                }
            }
            business_units: {
                Row: {
                    id: string
                    code: string
                    name: string
                    description: string | null
                    is_active: boolean
                    order_index: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    code: string
                    name: string
                    description?: string | null
                    is_active?: boolean
                    order_index?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    code?: string
                    name?: string
                    description?: string | null
                    is_active?: boolean
                    order_index?: number
                    updated_at?: string
                }
            }
            pillars: {
                Row: {
                    id: string
                    code: string
                    name: string
                    description: string | null
                    icon: string
                    color: string
                    order_index: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    code: string
                    name: string
                    description?: string | null
                    icon?: string
                    color?: string
                    order_index?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    code?: string
                    name?: string
                    description?: string | null
                    icon?: string
                    color?: string
                    order_index?: number
                    is_active?: boolean
                    updated_at?: string
                }
            }
            objectives: {
                Row: {
                    id: string
                    business_unit_id: string
                    pillar_id: string
                    code: string
                    title: string
                    description: string | null
                    year: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    business_unit_id: string
                    pillar_id: string
                    code: string
                    title: string
                    description?: string | null
                    year?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    business_unit_id?: string
                    pillar_id?: string
                    code?: string
                    title?: string
                    description?: string | null
                    year?: number
                    is_active?: boolean
                    updated_at?: string
                }
            }
            key_results: {
                Row: {
                    id: string
                    objective_id: string
                    code: string
                    title: string
                    description: string | null
                    owner_name: string | null
                    source: string | null
                    metric_type: 'percentage' | 'number' | 'currency' | 'days'
                    unit: string
                    order_index: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    objective_id: string
                    code: string
                    title: string
                    description?: string | null
                    owner_name?: string | null
                    source?: string | null
                    metric_type?: 'percentage' | 'number' | 'currency' | 'days'
                    unit?: string
                    order_index?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    objective_id?: string
                    code?: string
                    title?: string
                    description?: string | null
                    owner_name?: string | null
                    source?: string | null
                    metric_type?: 'percentage' | 'number' | 'currency' | 'days'
                    unit?: string
                    order_index?: number
                    is_active?: boolean
                    updated_at?: string
                }
            }
            kr_quarterly_data: {
                Row: {
                    id: string
                    key_result_id: string
                    quarter: number
                    year: number
                    baseline: number | null
                    target: number | null
                    actual: number | null
                    progress: number | null
                    confidence: 'on_track' | 'at_risk' | 'off_track' | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    key_result_id: string
                    quarter: number
                    year?: number
                    baseline?: number | null
                    target?: number | null
                    actual?: number | null
                    confidence?: 'on_track' | 'at_risk' | 'off_track' | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    key_result_id?: string
                    quarter?: number
                    year?: number
                    baseline?: number | null
                    target?: number | null
                    actual?: number | null
                    confidence?: 'on_track' | 'at_risk' | 'off_track' | null
                    notes?: string | null
                    updated_at?: string
                }
            }
            actions: {
                Row: {
                    id: string
                    key_result_id: string
                    title: string
                    description: string | null
                    status: 'pending' | 'in_progress' | 'done' | 'blocked'
                    priority: 'low' | 'medium' | 'high'
                    due_date: string | null
                    owner_name: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    key_result_id: string
                    title: string
                    description?: string | null
                    status?: 'pending' | 'in_progress' | 'done' | 'blocked'
                    priority?: 'low' | 'medium' | 'high'
                    due_date?: string | null
                    owner_name?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    key_result_id?: string
                    title?: string
                    description?: string | null
                    status?: 'pending' | 'in_progress' | 'done' | 'blocked'
                    priority?: 'low' | 'medium' | 'high'
                    due_date?: string | null
                    owner_name?: string | null
                    updated_at?: string
                }
            }
            audit_logs: {
                Row: {
                    id: string
                    user_id: string | null
                    user_email: string | null
                    user_name: string | null
                    action: 'create' | 'update' | 'delete'
                    entity_type: string
                    entity_id: string
                    entity_name: string | null
                    old_value: Json | null
                    new_value: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    user_email?: string | null
                    user_name?: string | null
                    action: 'create' | 'update' | 'delete'
                    entity_type: string
                    entity_id: string
                    entity_name?: string | null
                    old_value?: Json | null
                    new_value?: Json | null
                    created_at?: string
                }
                Update: never
            }
        }
    }
}

// Convenience types - extraídos da interface Database
export type User = Database['public']['Tables']['users']['Row']
export type BusinessUnit = Database['public']['Tables']['business_units']['Row']
export type Pillar = Database['public']['Tables']['pillars']['Row']
export type Objective = Database['public']['Tables']['objectives']['Row']
export type KeyResult = Database['public']['Tables']['key_results']['Row']
export type QuarterlyData = Database['public']['Tables']['kr_quarterly_data']['Row']
export type Action = Database['public']['Tables']['actions']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
