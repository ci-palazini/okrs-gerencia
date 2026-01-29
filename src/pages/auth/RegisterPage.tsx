import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Mail, Lock, User, Sparkles, ArrowRight } from 'lucide-react'

export function RegisterPage() {
    const { t } = useTranslation()
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
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
        const { error } = await signUp(email, password, fullName)

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            navigate('/', { replace: true })
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-[var(--color-background)]">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-8 justify-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent-purple)] shadow-lg shadow-[var(--color-primary)]/30">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-[var(--color-text-primary)]">OKR Dashboard</span>
                </div>

                <div className="p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                            {t('auth.createAccountTitle')}
                        </h2>
                        <p className="text-[var(--color-text-secondary)]">
                            {t('auth.fillData')}
                        </p>
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
                            type="email"
                            label={t('auth.email')}
                            placeholder={t('auth.emailPlaceholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<Mail className="w-5 h-5" />}
                            required
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

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full group"
                            loading={loading}
                        >
                            {t('auth.createAccount')}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </form>

                    <p className="text-center text-[var(--color-text-secondary)] mt-8">
                        {t('auth.alreadyHaveAccount')}{' '}
                        <Link to="/login" className="text-[var(--color-primary)] hover:underline font-medium">
                            {t('auth.doLogin')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
