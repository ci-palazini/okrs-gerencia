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
            pillars: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    icon: string
                    color: string
                    order_index: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    icon: string
                    color: string
                    order_index?: number
                    created_at?: string
                }
                Update: {
                    name?: string
                    description?: string | null
                    icon?: string
                    color?: string
                    order_index?: number
                }
            }
            objectives_corporate: {
                Row: {
                    id: string
                    pillar_id: string
                    code: string
                    title: string
                    description: string | null
                    owner_id: string | null
                    year: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    pillar_id: string
                    code: string
                    title: string
                    description?: string | null
                    owner_id?: string | null
                    year: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    pillar_id?: string
                    code?: string
                    title?: string
                    description?: string | null
                    owner_id?: string | null
                    year?: number
                    updated_at?: string
                }
            }
            objectives_local: {
                Row: {
                    id: string
                    corporate_objective_id: string | null
                    pillar_id: string
                    code: string
                    title: string
                    description: string | null
                    owner_id: string | null
                    country: string
                    year: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    corporate_objective_id?: string | null
                    pillar_id: string
                    code: string
                    title: string
                    description?: string | null
                    owner_id?: string | null
                    country: string
                    year: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    corporate_objective_id?: string | null
                    pillar_id?: string
                    code?: string
                    title?: string
                    description?: string | null
                    owner_id?: string | null
                    country?: string
                    year?: number
                    updated_at?: string
                }
            }
            key_results: {
                Row: {
                    id: string
                    objective_id: string
                    code: string
                    title: string
                    metric_type: 'percentage' | 'number' | 'currency' | 'days'
                    baseline: number
                    target: number
                    current_value: number
                    unit: string
                    owner_id: string | null
                    quarter: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    objective_id: string
                    code: string
                    title: string
                    metric_type: 'percentage' | 'number' | 'currency' | 'days'
                    baseline?: number
                    target: number
                    current_value?: number
                    unit?: string
                    owner_id?: string | null
                    quarter?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    objective_id?: string
                    code?: string
                    title?: string
                    metric_type?: 'percentage' | 'number' | 'currency' | 'days'
                    baseline?: number
                    target?: number
                    current_value?: number
                    unit?: string
                    owner_id?: string | null
                    quarter?: number | null
                    updated_at?: string
                }
            }
            actions: {
                Row: {
                    id: string
                    key_result_id: string
                    title: string
                    description: string | null
                    status: 'pending' | 'in_progress' | 'done'
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
                    status?: 'pending' | 'in_progress' | 'done'
                    due_date?: string | null
                    owner_name?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    key_result_id?: string
                    title?: string
                    description?: string | null
                    status?: 'pending' | 'in_progress' | 'done'
                    due_date?: string | null
                    owner_name?: string | null
                    updated_at?: string
                }
            }
            audit_logs: {
                Row: {
                    id: string
                    user_id: string
                    action: 'create' | 'update' | 'delete'
                    entity_type: string
                    entity_id: string
                    old_value: Json | null
                    new_value: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    action: 'create' | 'update' | 'delete'
                    entity_type: string
                    entity_id: string
                    old_value?: Json | null
                    new_value?: Json | null
                    created_at?: string
                }
                Update: never
            }
        }
    }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Pillar = Database['public']['Tables']['pillars']['Row']
export type ObjectiveCorporate = Database['public']['Tables']['objectives_corporate']['Row']
export type ObjectiveLocal = Database['public']['Tables']['objectives_local']['Row']
export type KeyResult = Database['public']['Tables']['key_results']['Row']
export type Action = Database['public']['Tables']['actions']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']

// Extended types with relations
export type ObjectiveLocalWithRelations = ObjectiveLocal & {
    pillar?: Pillar
    corporate_objective?: ObjectiveCorporate
    owner?: User
    key_results?: KeyResultWithRelations[]
}

export type KeyResultWithRelations = KeyResult & {
    objective?: ObjectiveLocal
    owner?: User
    actions?: Action[]
}

export type ActionWithRelations = Action & {
    key_result?: KeyResult
    owner?: User
}
