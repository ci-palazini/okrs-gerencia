import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Target, TrendingUp, CheckCircle2, AlertCircle, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { UnitToggle } from '../../components/ui/UnitToggle'
import { supabase } from '../../lib/supabase'

interface BusinessUnit {
    id: string
    code: string
    name: string
}

interface DashboardStats {
    totalPillars: number
    totalKRs: number
    krsWithData: number
    overdueActions: number
    averageProgress: number
}

interface PillarProgress {
    id: string
    name: string
    color: string
    progress: number
    krCount: number
}

interface KeyResultDisplay {
    id: string
    code: string
    title: string
    progress: number
    status: 'success' | 'warning' | 'danger'
    pillarName: string
    confidence: string | null
}

export function DashboardPage() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [units, setUnits] = useState<BusinessUnit[]>([])
    const [selectedUnit, setSelectedUnit] = useState<string>('')
    const [stats, setStats] = useState<DashboardStats>({
        totalPillars: 0,
        totalKRs: 0,
        krsWithData: 0,
        overdueActions: 0,
        averageProgress: 0
    })
    const [pillarsProgress, setPillarsProgress] = useState<PillarProgress[]>([])
    const [topKRs, setTopKRs] = useState<KeyResultDisplay[]>([])
    const [currentQuarter] = useState(1)

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedUnit) {
            loadDashboardData()
        }
    }, [selectedUnit])

    async function loadInitialData() {
        try {
            const { data: unitsData } = await supabase
                .from('business_units')
                .select('*')
                .eq('is_active', true)
                .neq('code', 'GSC')
                .order('order_index')

            if (unitsData && unitsData.length > 0) {
                setUnits(unitsData)
                setSelectedUnit(unitsData[0].id)
            }
        } catch (error) {
            console.error('Error loading initial data:', error)
        }
    }

    async function loadDashboardData() {
        setLoading(true)
        try {
            // Fetch pillars
            const { data: pillarsData } = await supabase
                .from('pillars')
                .select('*')
                .eq('is_active', true)
                .order('order_index')

            const pillars = pillarsData || []

            // Fetch objectives for selected unit
            const { data: objectivesData } = await supabase
                .from('objectives')
                .select('id, pillar_id')
                .eq('business_unit_id', selectedUnit)
                .eq('year', 2026)

            const objectives = objectivesData || []
            const objectiveIds = objectives.map(o => o.id)

            // Fetch key results
            let keyResults: any[] = []
            if (objectiveIds.length > 0) {
                const { data: krsData } = await supabase
                    .from('key_results')
                    .select('*')
                    .in('objective_id', objectiveIds)
                    .eq('is_active', true)

                keyResults = krsData || []
            }

            // Fetch quarterly data for current quarter
            let quarterlyData: any[] = []
            if (keyResults.length > 0) {
                const krIds = keyResults.map(kr => kr.id)
                const { data: qData } = await supabase
                    .from('kr_quarterly_data')
                    .select('*')
                    .in('key_result_id', krIds)
                    .eq('quarter', currentQuarter)
                    .eq('year', 2026)

                quarterlyData = qData || []
            }

            // Fetch overdue actions
            const { data: overdueActionsData } = await supabase
                .from('actions')
                .select('*')
                .lt('due_date', new Date().toISOString().split('T')[0])
                .neq('status', 'done')

            // Calculate stats
            const krsWithProgress = quarterlyData.filter(q => q.progress !== null && q.progress > 0)
            const totalProgress = quarterlyData.reduce((sum, q) => sum + (q.progress || 0), 0)
            const averageProgress = quarterlyData.length > 0 ? Math.round(totalProgress / quarterlyData.length) : 0

            setStats({
                totalPillars: pillars.length,
                totalKRs: keyResults.length,
                krsWithData: krsWithProgress.length,
                overdueActions: overdueActionsData?.length || 0,
                averageProgress
            })

            // Calculate progress by pillar
            const pillarProgressMap = new Map<string, { total: number; count: number; name: string; color: string }>()

            pillars.forEach(pillar => {
                pillarProgressMap.set(pillar.id, { total: 0, count: 0, name: pillar.name, color: pillar.color })
            })

            keyResults.forEach(kr => {
                const objective = objectives.find(o => o.id === kr.objective_id)
                if (objective && pillarProgressMap.has(objective.pillar_id)) {
                    const qData = quarterlyData.find(q => q.key_result_id === kr.id)
                    const entry = pillarProgressMap.get(objective.pillar_id)!
                    entry.total += qData?.progress || 0
                    entry.count++
                }
            })

            const pillarsProgressData: PillarProgress[] = Array.from(pillarProgressMap.entries())
                .filter(([_, data]) => data.count > 0)
                .map(([id, data]) => ({
                    id,
                    name: data.name,
                    color: data.color,
                    progress: data.count > 0 ? Math.round(data.total / data.count) : 0,
                    krCount: data.count
                }))

            setPillarsProgress(pillarsProgressData)

            // Get KRs that need attention (lowest progress)
            const sortedKRs: KeyResultDisplay[] = keyResults
                .map(kr => {
                    const qData = quarterlyData.find(q => q.key_result_id === kr.id)
                    const objective = objectives.find(o => o.id === kr.objective_id)
                    const pillar = pillars.find(p => p.id === objective?.pillar_id)
                    const progress = qData?.progress || 0

                    return {
                        id: kr.id,
                        code: kr.code,
                        title: kr.title,
                        progress,
                        status: (progress >= 70 ? 'success' : progress >= 40 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger',
                        pillarName: pillar?.name || '',
                        confidence: qData?.confidence || null
                    }
                })
                .sort((a, b) => a.progress - b.progress)
                .slice(0, 5)

            setTopKRs(sortedKRs)

        } catch (error) {
            console.error('Error loading dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const selectedUnitName = units.find(u => u.id === selectedUnit)?.name || ''

    if (loading && units.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('dashboard.loadingData')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t('dashboard.title')}</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        {t('dashboard.overview', { year: 2026, unit: selectedUnitName })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <UnitToggle
                        units={units}
                        selectedUnit={selectedUnit}
                        onSelect={setSelectedUnit}
                    />
                    <Badge variant="info" size="md">
                        Q{currentQuarter} 2026
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadDashboardData}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card variant="elevated" className="group">
                    <CardContent className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-primary)]/15 group-hover:bg-[var(--color-primary)]/25 transition-colors">
                            <Target className="w-7 h-7 text-[var(--color-primary)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.pillars')}</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalPillars}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated" className="group">
                    <CardContent className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-accent-cyan)]/15 group-hover:bg-[var(--color-accent-cyan)]/25 transition-colors">
                            <TrendingUp className="w-7 h-7 text-[var(--color-accent-cyan)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.keyResults')}</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalKRs}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated" className="group">
                    <CardContent className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-success)]/15 group-hover:bg-[var(--color-success)]/25 transition-colors">
                            <CheckCircle2 className="w-7 h-7 text-[var(--color-success)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.withData')}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.krsWithData}</p>
                                {stats.krsWithData > 0 && stats.totalKRs > 0 && (
                                    <span className="flex items-center text-xs text-[var(--color-success)]">
                                        <ArrowUpRight className="w-3 h-3" />
                                        {Math.round((stats.krsWithData / stats.totalKRs) * 100)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="elevated" className="group">
                    <CardContent className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-danger)]/15 group-hover:bg-[var(--color-danger)]/25 transition-colors">
                            <AlertCircle className="w-7 h-7 text-[var(--color-danger)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.overdueActions')}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.overdueActions}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overall Progress */}
                <Card variant="glass" className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>{t('dashboard.generalProgress', { quarter: currentQuarter })}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-4">
                        <ProgressRing
                            value={stats.averageProgress}
                            size={160}
                            strokeWidth={12}
                            label={t('dashboard.average')}
                        />
                        <p className="text-[var(--color-text-secondary)] mt-4 text-center">
                            {t('dashboard.averageProgressDesc')}
                        </p>
                    </CardContent>
                </Card>

                {/* Progress by Pillar */}
                <Card variant="elevated" className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>{t('dashboard.progressByPillar')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {pillarsProgress.length > 0 ? (
                            pillarsProgress.map((pillar) => (
                                <div key={pillar.id} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: pillar.color }}
                                            />
                                            <span className="font-medium text-[var(--color-text-primary)]">
                                                {pillar.name}
                                            </span>
                                            <Badge variant="outline" size="sm">
                                                {pillar.krCount} {t('dashboard.krs')}
                                            </Badge>
                                        </div>
                                        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                                            {pillar.progress}%
                                        </span>
                                    </div>
                                    <ProgressBar
                                        value={pillar.progress}
                                        size="md"
                                        variant="gradient"
                                    />
                                </div>
                            ))
                        ) : (
                            <p className="text-[var(--color-text-muted)] text-center py-8">
                                {t('dashboard.noData')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Key Results that need attention */}
            <Card variant="elevated">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{t('dashboard.attentionKRs')}</CardTitle>
                    <Badge variant="outline">{t('dashboard.lowestProgress')}</Badge>
                </CardHeader>
                <CardContent>
                    {topKRs.length > 0 ? (
                        <div className="space-y-4">
                            {topKRs.map((kr) => (
                                <div
                                    key={kr.id}
                                    className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[var(--color-surface-hover)] group-hover:bg-[var(--color-surface)] transition-colors">
                                        <span className="text-sm font-bold text-[var(--color-primary)]">{kr.code}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[var(--color-text-primary)] truncate">{kr.title}</p>
                                        <p className="text-sm text-[var(--color-text-muted)]">{kr.pillarName}</p>
                                    </div>
                                    <div className="w-32">
                                        <ProgressBar value={kr.progress} size="sm" variant="gradient" />
                                    </div>
                                    <Badge variant={kr.status}>
                                        {kr.progress}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-center py-8">
                            {t('dashboard.noKRsFound')}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
