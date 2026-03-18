import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Create a typed Supabase client
// Using 'any' for database types as they are not generated yet
// In production, run `supabase gen types typescript` to generate proper types
export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey)

// Secondary client for admin operations (like creating users) that shouldn't affect current session
export const supabaseAdminAuth = createClient<any>(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-admin-auth-token' // Unique key to avoid 'Multiple GoTrueClient instances' warning
    }
})

// Export typed helper for common operations
export type SupabaseClient = typeof supabase
