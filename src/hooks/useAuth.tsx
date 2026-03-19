import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, supabaseAdminAuth } from '../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { UserWithUnits } from '../types'

interface AuthContextType {
    user: UserWithUnits | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
    adminResetPassword: (userId: string, newPassword: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserWithUnits | null>(null)
    const [loading, setLoading] = useState(true)

    async function fetchUserProfile(authUser: SupabaseUser): Promise<UserWithUnits> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
                    *,
                    user_business_units (
                        business_unit_id,
                        business_units ( name, code )
                    ),
                    team_members (
                        team_id,
                        role,
                        teams ( name )
                    )
                `)
                .eq('id', authUser.id)
                .single()

            if (error || !data) {
                console.warn('Profile not found, using auth data fallback')
                return {
                    id: authUser.id,
                    email: authUser.email!,
                    full_name: authUser.user_metadata?.full_name || authUser.email!,
                    role: 'user',
                    avatar_url: authUser.user_metadata?.avatar_url || null,
                    user_business_units: []
                }
            }
            return data as unknown as UserWithUnits
        } catch (error) {
            console.error('Error fetching profile:', error)
            return {
                id: authUser.id,
                email: authUser.email!,
                full_name: authUser.user_metadata?.full_name || authUser.email!,
                role: 'user',
                avatar_url: authUser.user_metadata?.avatar_url || null,
                user_business_units: []
            }
        }
    }

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchUserProfile(session.user).then(profile => {
                    setUser(profile)
                    setLoading(false)
                })
            } else {
                setUser(null)
                setLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                // Optionally re-fetch profile if needed, or just use session if strictly auth
                // Use fetchUserProfile to be safe and get latest role
                fetchUserProfile(session.user).then((profile) => {
                    setUser(profile)
                    setLoading(false)
                })
            } else {
                setUser(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function signIn(email: string, password: string) {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            return { error: error ? new Error(error.message) : null }
        } catch (error) {
            return { error: error as Error }
        }
    }

    async function signUp(email: string, password: string, fullName: string) {
        try {
            const { error } = await supabaseAdminAuth.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            })

            if (error) throw error

            return { error: null }
        } catch (error) {
            return { error: error as Error }
        }
    }

    async function signOut() {
        await supabase.auth.signOut({ scope: 'local' })
        setUser(null)
        // Limpar qualquer chave de sessão do Supabase que possa ter ficado no localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-')) localStorage.removeItem(key)
        })
        // Forçar reload completo para a raiz, evitando restauração da sessão em cache
        window.location.href = '/'
    }

    async function updatePassword(newPassword: string) {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })
            return { error: error ? new Error(error.message) : null }
        } catch (error) {
            return { error: error as Error }
        }
    }

    async function adminResetPassword(userId: string, newPassword: string) {
        try {
            const { error } = await supabase.rpc('admin_reset_password', {
                target_user_id: userId,
                new_password: newPassword
            })
            return { error: error ? new Error(error.message) : null }
        } catch (error) {
            return { error: error as Error }
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updatePassword, adminResetPassword }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
