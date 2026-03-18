import { useMemo, useState, type ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Layers, Map, Search, AlertTriangle } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { useCascadeOKRData } from '../../hooks/useCascadeOKRData'
import type { CascadeTreeNode } from '../../hooks/useCascadeOKRData'
import { calculateDeadlineStatus } from '../../lib/dateUtils'

function countLeaves(nodes: CascadeTreeNode[]): number {
    return nodes.reduce((acc, node) => {
        if (node.children.length === 0) return acc + 1
        return acc + countLeaves(node.children)
    }, 0)
}

function getPillarIcon(iconName: string | null | undefined): ElementType {
    if (!iconName) return Layers
    const normalized = iconName
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')

    return (LucideIcons[normalized as keyof typeof LucideIcons] as ElementType) || Layers
}

export function OKRsPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const {
        loading,
        selectedUnitData,
        objectives,
        getVisiblePillars,
        getObjectiveRoots,
    } = useCascadeOKRData()

    const [searchTerm, setSearchTerm] = useState('')


    const normalizedSearch = searchTerm.trim().toLowerCase()

    const pillarCards = useMemo(() => {
        const pillars = getVisiblePillars()

        return pillars
            .map((pillar) => {
                const pillarObjectives = objectives.filter((objective) => objective.pillar_id === pillar.id)
                const roots = pillarObjectives.flatMap((objective) => getObjectiveRoots(objective.id))
                const totalLeaves = countLeaves(roots)

                // Calculate deadline statistics for active objectives
                const activeObjectives = pillarObjectives.filter((obj) => obj.is_active !== false)
                const overdueCount = activeObjectives.filter(obj => 
                    obj.due_date && calculateDeadlineStatus(obj.due_date, obj.is_active === false) === 'overdue'
                ).length
                const urgentCount = activeObjectives.filter(obj => 
                    obj.due_date && calculateDeadlineStatus(obj.due_date, obj.is_active === false) === 'urgent'
                ).length

                return {
                    pillar,
                    objectiveCount: pillarObjectives.length,
                    rootCount: roots.length,
                    leafCount: totalLeaves,
                    overdueCount,
                    urgentCount,
                }
            })
            .filter(({ pillar }) => {
                if (!normalizedSearch) return true
                return (
                    pillar.name.toLowerCase().includes(normalizedSearch)
                    || pillar.code.toLowerCase().includes(normalizedSearch)
                    || (pillar.description || '').toLowerCase().includes(normalizedSearch)
                )
            })
    }, [getObjectiveRoots, getVisiblePillars, normalizedSearch, objectives])

    if (loading && !selectedUnitData) {
        return (
            <div className="flex items-center justify-center min-h-[360px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('okr.loadingData')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card variant="elevated" className="p-0 overflow-hidden">
                <CardContent className="p-5 md:p-6 space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
                                {t('okr.title')} - {selectedUnitData?.name || t('okr.local')}
                            </h1>
                            <p className="text-[var(--color-text-secondary)] mt-1.5">
                                {t('okr.flow.pillarsSubtitle')}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="primary"
                                onClick={() => navigate('/okrs/mapa')}
                                className="shadow-md"
                            >
                                <Map className="w-4 h-4 mr-2" />
                                {t('okr.flow.openConfidenceMap')}
                            </Button>
                        </div>
                    </div>

                    <Input
                        label={t('okr.flow.searchPillarsLabel')}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t('okr.flow.searchPillarsPlaceholder')}
                        icon={<Search className="w-4 h-4" />}
                    />
                </CardContent>
            </Card>

            {pillarCards.length === 0 ? (
                <Card variant="elevated">
                    <CardContent className="py-12 text-center">
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {t('okr.flow.emptyPillarsTitle')}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2">
                            {t('okr.flow.emptyPillarsDescription')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pillarCards.map(({ pillar, objectiveCount, rootCount, leafCount, overdueCount, urgentCount }) => {
                        const PillarIcon = getPillarIcon(pillar.icon)
                        const hasDeadlineIssues = overdueCount > 0 || urgentCount > 0
                        return (
                            <button
                                key={pillar.id}
                                type="button"
                                onClick={() => navigate(`/okrs/pillar/${pillar.id}`)}
                                className="text-left"
                            >
                                <Card variant="elevated" hover className="h-full">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: `${pillar.color}22`, color: pillar.color }}
                                                >
                                                    <PillarIcon className="w-4 h-4" />
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <CardTitle className="text-base truncate">{pillar.name}</CardTitle>
                                                        {hasDeadlineIssues && (
                                                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                                        {pillar.code}
                                                    </p>
                                                </div>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {pillar.description && (
                                            <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">
                                                {pillar.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="default" size="sm">
                                                {t('okr.flow.pillarObjectives', { count: objectiveCount })}
                                            </Badge>
                                            <Badge variant="info" size="sm">
                                                {t('okr.flow.pillarRootKRs', { count: rootCount })}
                                            </Badge>
                                            <Badge variant="success" size="sm">
                                                {t('okr.flow.pillarLeafKRs', { count: leafCount })}
                                            </Badge>
                                            {overdueCount > 0 && (
                                                <Badge variant="danger" size="sm">
                                                    {overdueCount} {t(overdueCount > 1 ? 'deadline.overduePlural' : 'deadline.overdue')}
                                                </Badge>
                                            )}
                                            {urgentCount > 0 && (
                                                <Badge variant="warning" size="sm">
                                                    {urgentCount} {t(urgentCount > 1 ? 'deadline.urgentPlural' : 'deadline.urgent')}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-[var(--color-primary)]">
                                            {t('okr.flow.openPillar')}
                                        </p>
                                    </CardContent>
                                </Card>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
