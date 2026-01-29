import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Target, AlertCircle } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { QuarterlyCard } from '../../components/okr/QuarterlyCard'
import { usePillarData } from '../../hooks/usePillarData'
import { useBusinessUnit } from '../../contexts/BusinessUnitContext'
import * as LucideIcons from 'lucide-react'

/**
 * Página genérica para exibir os Key Results de qualquer pilar.
 * Recebe o ID ou código do pilar via parâmetro de rota.
 * 
 * Substituí as páginas específicas (RentabilidadePage, LeadTimePage, SegurancaPage)
 * que tinham código duplicado.
 */
export function GenericPillarPage() {
    const { t } = useTranslation()
    const { pillarId } = useParams<{ pillarId: string }>()
    const { selectedUnitData } = useBusinessUnit()
    const currentQuarter = 1 // Q1 2026

    // Usar o hook centralizado para toda a lógica de dados
    const {
        pillar,
        keyResults,
        loading,
        saving,
        error,
        reload,
        updateQuarterly,
        updateKeyResult,
        getQuarterlyDataForKR
    } = usePillarData({ pillarIdOrCode: pillarId })

    // Determinar ícone dinamicamente
    // Determinar ícone dinamicamente (converter kebab-case para PascalCase)
    const iconName = pillar?.icon
        ? pillar.icon.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
        : 'Circle'

    const IconComponent = (LucideIcons[iconName as keyof typeof LucideIcons] as React.ElementType) || Target

    // Estado de carregamento inicial
    if (loading && !pillar) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('dashboard.loadingData')}</p>
                </div>
            </div>
        )
    }

    // Estado de erro
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <AlertCircle className="w-12 h-12 text-[var(--color-danger)] mb-4" />
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('pillar.page.error')}</h2>
                <p className="text-[var(--color-text-secondary)]">{error}</p>
                <Button className="mt-4" onClick={() => window.history.back()}>{t('common.back')}</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div
                            className="p-3 rounded-xl"
                            style={{
                                backgroundColor: `${pillar?.color || 'var(--color-primary)'}20`,
                                color: pillar?.color || 'var(--color-primary)'
                            }}
                        >
                            <IconComponent className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                            {pillar?.name}
                        </h1>
                    </div>
                    {pillar?.description && (
                        <p className="text-[var(--color-text-secondary)] mt-1 max-w-3xl">
                            {pillar.description}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="info" size="md">
                        Q{currentQuarter} 2026
                    </Badge>
                    {saving && (
                        <Badge variant="warning" size="sm">
                            {t('pillar.page.saving')}
                        </Badge>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={reload}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Info Banner */}
            <div
                className="p-4 rounded-xl border"
                style={{
                    backgroundColor: `${pillar?.color || 'var(--color-primary)'}10`,
                    borderColor: `${pillar?.color || 'var(--color-primary)'}20`
                }}
            >
                <p className="text-sm text-[var(--color-text-secondary)]">
                    <strong style={{ color: pillar?.color || 'var(--color-primary)' }}>{t('pillar.page.tip')}</strong> {t('pillar.page.tipContent')}
                </p>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : keyResults.length > 0 ? (
                <div className="space-y-6">
                    {keyResults.map((kr) => (
                        <QuarterlyCard
                            key={kr.id}
                            keyResult={kr}
                            quarterlyData={getQuarterlyDataForKR(kr.id)}
                            currentQuarter={currentQuarter}
                            onUpdate={updateQuarterly}
                            onUpdateKeyResult={updateKeyResult}
                            editable={true}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <p className="text-[var(--color-text-muted)]">
                        {t('pillar.page.emptyState.title', { pillar: pillar?.name, unit: selectedUnitData?.name || 'selecionada' })}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                        {t('pillar.page.emptyState.description')}
                    </p>
                </div>
            )}
        </div>
    )
}
