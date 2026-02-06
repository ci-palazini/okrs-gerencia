import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { User, Lock, Mail, Shield, Save } from 'lucide-react'

export function ProfilePage() {
    const { t } = useTranslation()
    const { user, updatePassword } = useAuth()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: t('profile.passwordMismatch', 'The passwords do not match') })
            return
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: t('profile.passwordTooShort', 'Password must be at least 6 characters') })
            return
        }

        setLoading(true)
        const { error } = await updatePassword(password)
        setLoading(false)

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: t('profile.passwordUpdated', 'Password updated successfully') })
            setPassword('')
            setConfirmPassword('')
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                {t('header.myProfile', 'My Profile')}
            </h1>

            <div className="grid gap-6 md:grid-cols-2">
                {/* User Info Card */}
                <div className="p-6 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800">
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {user?.full_name || t('common.user', 'User')}
                            </h2>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                            <Mail className="w-5 h-5 text-[var(--color-text-muted)]" />
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] uppercase">Email (platform)</p>
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">{user?.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                            <Shield className="w-5 h-5 text-[var(--color-text-muted)]" />
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] uppercase">{t('users.role', 'Role')}</p>
                                <p className="text-sm font-medium text-[var(--color-text-primary)] capitalize">{user?.role}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Change Password Card */}
                <div className="p-6 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]">
                            <Lock className="w-5 h-5 text-[var(--color-text-primary)]" />
                        </div>
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {t('profile.security', 'Security')}
                        </h2>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                                {t('profile.newPassword', 'New Password')}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                                {t('profile.confirmPassword', 'Confirm Password')}
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-sm ${message.type === 'success'
                                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {t('common.save', 'Save Changes')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
