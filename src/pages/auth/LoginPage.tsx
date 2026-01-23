import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { User, Lock, Sparkles, ArrowRight } from 'lucide-react'

export function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth()
    const navigate = useNavigate()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        // Auto-complete email domain
        const fullEmail = `${email}@ci-okrs.com`

        const { error } = await signIn(fullEmail, password)

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            navigate('/', { replace: true })
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* Left side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00ek0zMiAyMGMtNi42MjcgMC0xMiA1LjM3My0xMiAxMnM1LjM3MyAxMiAxMiAxMiAxMi01LjM3MyAxMi0xMi01LjM3My0xMi0xMi0xMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />

                <div className="relative z-10 flex flex-col justify-center px-16 h-full pb-32">
                    {/* Main Logo */}
                    <div className="mb-12">
                        <img
                            src="/SXS_master_blue_rgb_150ppi.png"
                            alt="SXS"
                            className="h-24 w-auto object-contain brightness-0 invert"
                        />
                    </div>

                    <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
                        Controle de Objetivos<br />e Resultados
                    </h2>
                    <p className="text-lg text-white/80 max-w-md leading-relaxed">
                        Gestão integrada e melhoria contínua.
                    </p>

                    {/* Partner Logos */}
                    <div className="absolute bottom-12 left-16 right-16">
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-6 font-medium">Empresas do Grupo</p>
                        <div className="flex items-center gap-8 opacity-80 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                            <img
                                src="/Spirax Sarco Logo_Blue_RGB_72dpi_WebRes.png"
                                alt="Spirax Sarco"
                                className="h-8 w-auto object-contain brightness-0 invert"
                            />
                            <div className="h-8 w-px bg-white/20" />
                            <img
                                src="/hiter logo.png"
                                alt="Hiter"
                                className="h-10 w-auto object-contain brightness-0 invert"
                            />
                        </div>
                    </div>
                </div>

                {/* Decorative circles */}
                <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/10" />
                <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-white/5" />
            </div>

            {/* Right side - Login form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[var(--color-background)]">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center justify-center mb-10">
                        <img
                            src="/SXS_master_blue_rgb_150ppi.png"
                            alt="SXS"
                            className="h-12 w-auto object-contain"
                        />
                    </div>

                    <div className="text-center lg:text-left mb-8">
                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                            Bem-vindo de volta
                        </h2>
                        <p className="text-[var(--color-text-secondary)]">
                            Entre com suas credenciais para acessar
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            type="text"
                            label="Usuário"
                            placeholder="seu.usuario"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<User className="w-5 h-5" />}
                            required
                            autoComplete="username"
                        />

                        <Input
                            type="password"
                            label="Senha"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                            Entrar
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </form>

                    <p className="text-center text-[var(--color-text-secondary)] mt-8">
                        Não tem uma conta?{' '}
                        <Link to="/register" className="text-[var(--color-primary)] hover:underline font-medium">
                            Criar conta
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
