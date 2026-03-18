import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Mail, Lock, User, UserPlus, ArrowLeft } from 'lucide-react'

export function CreateUserPage() {
    const { t } = useTranslation()
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signUp } = useAuth()
    const navigate = useNavigate()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError(t('auth.passwordMismatch'))
            return
        }

        if (password.length < 6) {
            setError(t('auth.passwordLength'))
            return
        }

        setLoading(true)

        // Sanitize inputs and auto-complete email domain
        const cleanUsername = username.trim().split('@')[0]
        const fullEmail = `${cleanUsername}@ci-okrs.com`
        const cleanFullName = fullName.trim()

        const { error } = await signUp(fullEmail, password, cleanFullName)

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            // Success - navigate back to user management
            navigate('/admin/users', { replace: true })
        }
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/admin/users')}>
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    {t('common.back')}
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('users.createTitle')}</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">{t('users.createSubtitle')}</p>
                </div>
            </div>

            <div className="max-w-md mx-auto mt-8 p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                <div className="flex items-center justify-center mb-8">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                        <UserPlus className="w-6 h-6" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        type="text"
                        label={t('auth.fullName')}
                        placeholder={t('auth.namePlaceholder')}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        icon={<User className="w-5 h-5" />}
                        required
                    />

                    <Input
                        type="text"
                        label={t('auth.username')}
                        placeholder={t('users.usernamePlaceholder')}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        icon={<User className="w-5 h-5" />}
                        required
                        autoComplete="off"
                    />

                    <Input
                        type="password"
                        label={t('auth.password')}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock className="w-5 h-5" />}
                        required
                    />

                    <Input
                        type="password"
                        label={t('auth.confirmPassword')}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        icon={<Lock className="w-5 h-5" />}
                        required
                    />

                    {error && (
                        <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => navigate('/admin/users')}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            loading={loading}
                        >
                            {t('users.createButton')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
