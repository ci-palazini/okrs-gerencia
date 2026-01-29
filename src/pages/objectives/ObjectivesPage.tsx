import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Plus, Building2, Edit3 } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { EditKRModal } from '../../components/okr/EditKRModal'
import { supabase } from '../../lib/supabase'
import { cn, calculateProgress } from '../../lib/utils'

interface PillarData {
    id: string
    name: string
    color: string
}

interface KeyResultData {
    id: string
    code: string
    title: string
    baseline: number
    target: number
    current_value: number
    unit: string
    metric_type: string
    objective?: {
        title: string
        country: string
    }
}

interface ObjectiveWithKRs {
    id: string
    code: string
    title: string
    description: string | null
    country: string
    pillar: PillarData | null
    key_results: KeyResultData[]
}

interface ObjectiveCountry {
    country: string
}

export function ObjectivesPage() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [objectives, setObjectives] = useState<ObjectiveWithKRs[]>([])
    const [expandedObjective, setExpandedObjective] = useState<string | null>(null)
    const [selectedUnit, setSelectedUnit] = useState<string>('all')
    const [units, setUnits] = useState<string[]>([])

    // Modal state
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [selectedKR, setSelectedKR] = useState<KeyResultData | null>(null)

    useEffect(() => {
        loadObjectives()
    }, [selectedUnit])

    async function loadObjectives() {
        setLoading(true)
        try {
            // Get unique units
            const { data: allObjectivesData } = await supabase
                .from('objectives_local')
                .select('country')

            const allObjectives = (allObjectivesData || []) as ObjectiveCountry[]
            const uniqueUnits = [...new Set(allObjectives.map(o => o.country))]
            setUnits(uniqueUnits)

            // Fetch objectives with KRs
            let query = supabase
                .from('objectives_local')
                .select(`
          *,
          pillar:pillars(*),
          key_results(*)
        `)
                .eq('year', 2026)
                .order('code')

            if (selectedUnit !== 'all') {
                query = query.eq('country', selectedUnit)
            }

            const { data, error } = await query

            if (error) throw error
            setObjectives((data || []) as ObjectiveWithKRs[])
        } catch (error) {
            console.error('Error loading objectives:', error)
        } finally {
            setLoading(false)
        }
    }

    function calculateObjectiveProgress(krs: ObjectiveWithKRs['key_results']) {
        if (!krs || krs.length === 0) return 0
        const total = krs.reduce((acc, kr) => {
            return acc + calculateProgress(kr.current_value, kr.target)
        }, 0)
        return Math.round(total / krs.length)
    }

    function handleEditKR(kr: KeyResultData, objective: ObjectiveWithKRs) {
        setSelectedKR({
            ...kr,
            objective: {
                title: objective.title,
                country: objective.country
            }
        })
        setEditModalOpen(true)
    }

    function handleKRSaved() {
        loadObjectives() // Reload data after save
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[var(--color-text-secondary)]">{t('objectives.loading')}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('objectives.title')}</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        {t('objectives.subtitle', { year: 2026, company: 'Spirax' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Unit Filter */}
                    <select
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="h-10 px-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    >
                        <option value="all">{t('objectives.allUnits')}</option>
                        {units.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                        ))}
                    </select>
                    <Button variant="primary" size="md">
                        <Plus className="w-4 h-4" />
                        {t('objectives.newObjective')}
                    </Button>
                </div>
            </div>

            {/* Objectives List */}
            {objectives.length > 0 ? (
                <div className="space-y-4">
                    {objectives.map((objective) => {
                        const isExpanded = expandedObjective === objective.id
                        const progress = calculateObjectiveProgress(objective.key_results)

                        return (
                            <Card
                                key={objective.id}
                                variant="elevated"
                                className="overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:border-[var(--color-primary)]/30"
                            >
                                {/* Objective Header */}
                                <div
                                    className="flex items-center gap-4 p-6 cursor-pointer hover:bg-[var(--color-surface-subtle)]/50 transition-colors"
                                    onClick={() => setExpandedObjective(isExpanded ? null : objective.id)}
                                >
                                    {/* Pillar indicator */}
                                    <div
                                        className="w-1.5 h-16 rounded-full shadow-sm"
                                        style={{ backgroundColor: objective.pillar?.color || 'var(--color-primary)' }}
                                    />

                                    {/* Code badge */}
                                    <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                                        <span className="text-lg font-bold text-[var(--color-primary)]">{objective.code}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                                            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                                                {objective.title}
                                            </h3>
                                            <Badge variant="outline" size="sm" className="bg-white">
                                                {objective.pillar?.name}
                                            </Badge>
                                            <Badge variant="info" size="sm" className="flex items-center gap-1 shadow-sm">
                                                <Building2 className="w-3 h-3" />
                                                {objective.country}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                                            {objective.description}
                                        </p>
                                    </div>

                                    {/* Progress */}
                                    <div className="flex items-center gap-6">
                                        <div className="w-40">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-[var(--color-text-muted)]">{t('objectives.progress')}</span>
                                                <span className="text-sm font-bold text-[var(--color-text-primary)]">{progress}%</span>
                                            </div>
                                            <ProgressBar value={progress} size="md" variant="gradient" className="shadow-inner" />
                                        </div>
                                        <Badge variant={progress >= 70 ? 'success' : progress >= 40 ? 'warning' : 'danger'} size="lg" className="shadow-sm">
                                            {objective.key_results?.length || 0} KRs
                                        </Badge>
                                        <ChevronRight className={cn(
                                            'w-5 h-5 text-[var(--color-text-muted)] transition-transform duration-200',
                                            isExpanded && 'rotate-90 text-[var(--color-primary)]'
                                        )} />
                                    </div>
                                </div>

                                {/* Key Results (Expanded) */}
                                {isExpanded && objective.key_results && objective.key_results.length > 0 && (
                                    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                                        <div className="p-6 space-y-4">
                                            <h4 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                                <div className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
                                                {t('dashboard.keyResults')}
                                            </h4>
                                            {objective.key_results.map((kr) => {
                                                const krProgress = calculateProgress(kr.current_value, kr.target)

                                                return (
                                                    <div
                                                        key={kr.id}
                                                        className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:shadow-md transition-all group"
                                                    >
                                                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)]">
                                                            <span className="text-sm font-bold text-[var(--color-accent-blue)]">{kr.code}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-[var(--color-text-primary)]">{kr.title}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                                                                    {t('objectives.base')}: {kr.baseline} {kr.unit}
                                                                </code>
                                                                <span className="text-xs text-[var(--color-text-muted)]">→</span>
                                                                <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-medium">
                                                                    {t('objectives.target')}: {kr.target} {kr.unit}
                                                                </code>
                                                                <span className="text-xs text-[var(--color-border)]">|</span>
                                                                <span className="text-xs font-medium text-[var(--color-primary)]">
                                                                    {t('objectives.current')}: {kr.current_value} {kr.unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="w-32">
                                                            <ProgressBar value={krProgress} size="sm" variant="gradient" />
                                                        </div>
                                                        <Badge variant={krProgress >= 70 ? 'success' : krProgress >= 40 ? 'warning' : 'danger'} className="shadow-sm">
                                                            {Math.round(krProgress)}%
                                                        </Badge>
                                                        {/* Edit Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleEditKR(kr, objective)
                                                            }}
                                                            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <Card variant="elevated">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                            <Building2 className="w-8 h-8 text-[var(--color-text-muted)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            {t('objectives.noObjectives')}
                        </h3>
                        <p className="text-[var(--color-text-muted)] text-center max-w-md">
                            {t('objectives.seedData', { script: 'seed.sql' })}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Edit KR Modal */}
            <EditKRModal
                keyResult={selectedKR}
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                onSave={handleKRSaved}
            />
        </div>
    )
}
