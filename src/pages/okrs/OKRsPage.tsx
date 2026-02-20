import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw, Trash2, Target, Pencil } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PillarSection } from '../../components/okr/PillarSection'
import { KRTable } from '../../components/okr/KRTable'
import { EditKRModalV2 } from '../../components/okr/EditKRModalV2'
import { CreateObjectiveModalV2 } from '../../components/okr/CreateObjectiveModalV2'
import { QuarterlyTimeline } from '../../components/okr/QuarterlyTimeline'
import { QuarterSelector } from '../../components/ui/QuarterSelector'
import { cn } from '../../lib/utils'
import { useOKRData } from '../../hooks/useOKRData'
import type { KeyResult } from '../../hooks/useOKRData'

export function OKRsPage() {
    const { t } = useTranslation()
    const [searchParams] = useSearchParams()
    const filterPillar = searchParams.get('pillar')

    // Centralized data hook
    const {
        pillars,
        objectives,
        objectivesWithRelations,
        annualKRs,
        allKRs,
        loading,
        currentQuarter,
        setCurrentQuarter,
        year,
        selectedUnit,
        selectedUnitData,
        getChildKRs,
        getObjectiveKRs,
        getVisiblePillars,
        updateConfidence,
        updateValue,
        deleteKR,
        deleteObjective,
        loadData,
    } = useOKRData(filterPillar)

    // Modal state
    const [krModalOpen, setKrModalOpen] = useState(false)
    const [selectedKR, setSelectedKR] = useState<KeyResult | null>(null)
    const [defaultObjectiveId, setDefaultObjectiveId] = useState('')
    const [isCreatingObjective, setIsCreatingObjective] = useState(false)
    const [editingObjective, setEditingObjective] = useState<any>(null)

    // =====================================================
    // HANDLERS
    // =====================================================

    function handleEditKR(kr: any) {
        setSelectedKR(kr)
        setDefaultObjectiveId(kr.objective_id)
        setKrModalOpen(true)
    }

    function handleAddKR(objectiveId: string) {
        setSelectedKR(null)
        setDefaultObjectiveId(objectiveId)
        setKrModalOpen(true)
    }

    function handleAddQuarterlyKR(parentKR: KeyResult, quarter: number) {
        setSelectedKR({
            ...parentKR,
            id: undefined as any,
            scope: 'quarterly',
            parent_kr_id: parentKR.id,
            quarter,
            code: `${parentKR.code}.Q${quarter}`,
            baseline: null,
            target: null,
            actual: null,
            progress: null,
            confidence: null,
        } as any)
        setDefaultObjectiveId(parentKR.objective_id || '')
        setKrModalOpen(true)
    }

    function handleEditObjective(objective: any) {
        setEditingObjective(objective)
        setIsCreatingObjective(true)
    }

    // =====================================================
    // LOADING STATE
    // =====================================================

    if (loading && !selectedUnitData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('okr.loadingData')}</p>
                </div>
            </div>
        )
    }

    // =====================================================
    // RENDER
    // =====================================================

    const visiblePillars = getVisiblePillars().filter(p => !filterPillar || p.id === filterPillar)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                        {t('okr.title')} - {selectedUnitData?.name || t('okr.local')}
                    </h1>
                    <p className="text-[var(--color-text-secondary)]">
                        {t('okr.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => setIsCreatingObjective(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('okr.newObjective')}
                    </Button>
                    <QuarterSelector
                        quarter={currentQuarter}
                        onSelect={setCurrentQuarter}
                    />
                    <Badge variant="info" size="md">
                        {year}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Pillars */}
            {loading && visiblePillars.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-8">
                    {visiblePillars.map((pillar) => {
                        const pillarObjectives = objectives.filter(o => o.pillar_id === pillar.id)

                        return (
                            <PillarSection
                                key={pillar.id}
                                pillar={pillar}
                                actions={
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setIsCreatingObjective(true)
                                        }}
                                    >
                                        <Target className="w-4 h-4 mr-2" />
                                        {t('okr.newObjective')}
                                    </Button>
                                }
                            >
                                {pillarObjectives.length > 0 ? (
                                    <div className="space-y-8">
                                        {pillarObjectives.map((objective, index) => {
                                            const objectiveKRs = getObjectiveKRs(objective.id)

                                            return (
                                                <div key={objective.id} className={cn(
                                                    "space-y-4",
                                                    index > 0 && "pt-8 border-t border-[var(--color-border-subtle)]"
                                                )}>
                                                    {/* Objective Header */}
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge variant="outline" className="text-xs font-bold font-mono">
                                                                    {objective.code}
                                                                </Badge>
                                                                <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                                                    {objective.title}
                                                                </h4>
                                                            </div>
                                                            {objective.description && (
                                                                <p className="text-sm text-[var(--color-text-secondary)] pl-1">
                                                                    {objective.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                                                                title={t('common.edit')}
                                                                onClick={() => handleEditObjective(objective)}
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                                                title={t('common.delete')}
                                                                onClick={async () => {
                                                                    if (window.confirm(t('okr.deleteObjectiveConfirm'))) {
                                                                        try {
                                                                            await deleteObjective(objective.id)
                                                                        } catch (error) {
                                                                            console.error('Error deleting objective:', error)
                                                                            alert(t('okr.deleteObjectiveError'))
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleAddKR(objective.id)}
                                                            >
                                                                <Plus className="w-3 h-3 mr-1.5" />
                                                                {t('okr.newKR')}
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* KRs Table */}
                                                    {objectiveKRs.length > 0 ? (
                                                        <KRTable
                                                            keyResults={objectiveKRs}
                                                            onUpdateConfidence={updateConfidence}
                                                            onUpdateValue={updateValue}
                                                            onEdit={handleEditKR}
                                                            onDelete={async (krId) => {
                                                                if (window.confirm(t('okr.deleteKRConfirm'))) {
                                                                    await deleteKR(krId)
                                                                }
                                                            }}
                                                            renderExpandedRow={(kr) => {
                                                                const childKRs = getChildKRs(kr.id)

                                                                return (
                                                                    <div className="space-y-4">
                                                                        {/* Quarterly Timeline */}
                                                                        <QuarterlyTimeline
                                                                            annualKR={kr as any}
                                                                            quarterlyKRs={childKRs as any}
                                                                            currentQuarter={currentQuarter}
                                                                            onAddQuarterlyKR={(quarter) => handleAddQuarterlyKR(kr as any, quarter)}
                                                                            onEditKR={handleEditKR}
                                                                            onDeleteKR={async (id) => {
                                                                                await deleteKR(id)
                                                                            }}
                                                                            onUpdateValue={updateValue}
                                                                            onUpdateConfidence={updateConfidence}
                                                                        />

                                                                    </div>
                                                                )
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="text-center py-6 bg-[var(--color-surface-subtle)]/30 rounded-lg border border-dashed border-[var(--color-border)]">
                                                            <p className="text-sm text-[var(--color-text-muted)] mb-2">
                                                                {t('okr.noKRs')}
                                                            </p>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleAddKR(objective.id)}
                                                            >
                                                                {t('okr.addFirstKR')}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-[var(--color-text-muted)]">
                                        <p>{t('okr.noObjectives')}</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-4"
                                            onClick={() => setIsCreatingObjective(true)}
                                        >
                                            <Target className="w-4 h-4 mr-2" />
                                            {t('okr.defineFirstObjective')}
                                        </Button>
                                    </div>
                                )}
                            </PillarSection>
                        )
                    })}
                </div>
            )}

            {visiblePillars.length === 0 && !loading && (
                <div className="text-center py-16">
                    <p className="text-[var(--color-text-muted)] mb-4">
                        {t('okr.noPillars')}
                    </p>
                </div>
            )}

            {/* Edit/Create KR Modal */}
            <EditKRModalV2
                open={krModalOpen}
                onOpenChange={setKrModalOpen}
                onSave={loadData}
                keyResult={selectedKR as any}
                objectives={objectivesWithRelations}
                defaultObjectiveId={defaultObjectiveId}
            />

            <CreateObjectiveModalV2
                open={isCreatingObjective}
                onOpenChange={(open) => {
                    setIsCreatingObjective(open)
                    if (!open) setEditingObjective(null)
                }}
                onSave={loadData}
                pillars={pillars}
                units={selectedUnit ? [{ id: selectedUnit, name: selectedUnitData?.name || '', code: '' }] : []}
                defaultPillarId={filterPillar || undefined}
                objective={editingObjective}
            />
        </div>
    )
}
