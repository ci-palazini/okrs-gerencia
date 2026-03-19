import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, GitBranch, Plus, Search, Trash2, Pencil, User } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfidenceIndicator } from '../../components/ui/ConfidenceIndicator'
import { Input } from '../../components/ui/Input'
import { CreateObjectiveModalV2 } from '../../components/okr/CreateObjectiveModalV2'
import { CascadeKRModal } from '../../components/okr/CascadeKRModal'
import { DeadlineBadge } from '../../components/okr/DeadlineBadge'
import { useCascadeOKRData } from '../../hooks/useCascadeOKRData'
import type { CascadeKeyResult, CascadeObjective, CascadeTreeNode } from '../../hooks/useCascadeOKRData'
import { formatKRCurrency, getNextHierarchicalCode } from '../../lib/utils'

interface KRModalState {
  open: boolean
  objective: CascadeObjective | null
  parentKr: Pick<CascadeTreeNode, 'id' | 'code' | 'title' | 'scope'> | null
  keyResult: CascadeKeyResult | null
  initialCode: string
}

function getNextRootCode(objective: CascadeObjective, roots: CascadeTreeNode[]): string {
    return getNextHierarchicalCode(
        objective.code,
        roots.map((node) => node.code)
    )
}

function formatMetricValue(kr: CascadeTreeNode, value: number | null): string {
    if (value === null) return '-'
    if (kr.metric_type === 'currency') return formatKRCurrency(value, kr.currency_type)
    if (kr.metric_type === 'percentage') return `${value}%`
    return `${value}${kr.unit ? ` ${kr.unit}` : ''}`
}

function countLeaves(nodes: CascadeTreeNode[]): number {
    return nodes.reduce((acc, node) => {
        if (node.children.length === 0) return acc + 1
        return acc + countLeaves(node.children)
    }, 0)
}

export function PillarOKRsPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { pillarId } = useParams<{ pillarId: string }>()
    const currentPath = `${location.pathname}${location.search}${location.hash}`

    const {
        year,
        loading,
        selectedUnit,
        selectedUnitData,
        objectives,
        getVisiblePillars,
        getObjectiveRoots,
        updateConfidence,
        deleteObjective,
        getSubtreeSize,
        deleteKR,
        loadData,
    } = useCascadeOKRData(pillarId)

    const [searchTerm, setSearchTerm] = useState('')
    const [objectiveModalOpen, setObjectiveModalOpen] = useState(false)
    const [editingObjective, setEditingObjective] = useState<CascadeObjective | null>(null)
    const [krModalState, setKrModalState] = useState<KRModalState>({
        open: false,
        objective: null,
        parentKr: null,
        keyResult: null,
        initialCode: '',
    })

    const selectedPillar = useMemo(() => {
        if (!pillarId) return null
        return getVisiblePillars().find((pillar) => pillar.id === pillarId) || null
    }, [getVisiblePillars, pillarId])

    const normalizedSearch = searchTerm.trim().toLowerCase()

    const objectiveCards = useMemo(() => {
        if (!pillarId) return []

        return objectives
            .filter((objective) => objective.pillar_id === pillarId)
            .map((objective) => {
                const roots = getObjectiveRoots(objective.id)
                const filteredRoots = roots.filter((root) => {
                    if (!normalizedSearch) return true
                    return (
                        root.code.toLowerCase().includes(normalizedSearch)
                        || root.title.toLowerCase().includes(normalizedSearch)
                        || (root.owner_name || '').toLowerCase().includes(normalizedSearch)
                        || (root.owner_names || []).some((n) => n.toLowerCase().includes(normalizedSearch))
                        || (root.description || '').toLowerCase().includes(normalizedSearch)
                    )
                })

                if (normalizedSearch) {
                    const objectiveMatch = objective.code.toLowerCase().includes(normalizedSearch)
                        || objective.title.toLowerCase().includes(normalizedSearch)
                        || (objective.description || '').toLowerCase().includes(normalizedSearch)

                    if (!objectiveMatch && filteredRoots.length === 0) {
                        return null
                    }
                }

                return {
                    objective,
                    roots: filteredRoots,
                    rootCount: roots.length,
                    leafCount: countLeaves(roots),
                }
            })
            .filter((item): item is { objective: CascadeObjective; roots: CascadeTreeNode[]; rootCount: number; leafCount: number } => item !== null)
    }, [getObjectiveRoots, normalizedSearch, objectives, pillarId])


    function openCreateRootKRModal(objective: CascadeObjective) {
        const roots = getObjectiveRoots(objective.id)
        setKrModalState({
            open: true,
            objective,
            parentKr: null,
            keyResult: null,
            initialCode: getNextRootCode(objective, roots),
        })
    }

    async function handleDeleteObjective(objective: CascadeObjective) {
        if (!window.confirm(t('okr.deleteObjectiveConfirm'))) return
        await deleteObjective(objective.id)
    }

    async function handleDeleteRootKR(rootKr: CascadeTreeNode) {
        const subtreeSize = getSubtreeSize(rootKr.id)
        const message = subtreeSize > 1
            ? t('okr.cascade.deleteKRWithChildrenConfirm', { count: subtreeSize })
            : t('okr.deleteKRConfirm')

        if (!window.confirm(message)) return
        await deleteKR(rootKr.id)
    }

    if (loading && !selectedPillar) {
        return (
            <div className="flex items-center justify-center min-h-[360px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('okr.loadingData')}</p>
                </div>
            </div>
        )
    }

    if (!selectedPillar) {
        return (
            <Card variant="elevated">
                <CardContent className="py-10 text-center">
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {t('okr.flow.noPillarFoundTitle')}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                        {t('okr.flow.noPillarFoundDescription')}
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/okrs')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('okr.flow.backToPillars')}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card variant="elevated" className="p-0 overflow-hidden">
                <CardContent className="p-5 md:p-6 space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                        <div>
                            <button
                                type="button"
                                onClick={() => navigate('/okrs')}
                                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-3"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {t('okr.flow.backToPillars')}
                            </button>
                            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
                                {selectedPillar.name} - {selectedUnitData?.name || t('okr.local')}
                            </h1>
                            <p className="text-[var(--color-text-secondary)] mt-1.5">
                                {t('okr.flow.pillarPageSubtitle')}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <Badge variant="outline" size="sm">{selectedPillar.code}</Badge>
                                <Badge variant="default" size="sm">
                                    {t('okr.flow.pillarObjectives', { count: objectiveCards.length })}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Badge variant="info" size="md" className="h-10 px-4">
                                {year}
                            </Badge>
                            <Button
                                onClick={() => {
                                    setEditingObjective(null)
                                    setObjectiveModalOpen(true)
                                }}
                                disabled={!selectedUnit}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('okr.newObjective')}
                            </Button>
                        </div>
                    </div>

                    <Input
                        label={t('okr.flow.searchRootKRsLabel')}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t('okr.flow.searchRootKRsPlaceholder')}
                        icon={<Search className="w-4 h-4" />}
                    />
                </CardContent>
            </Card>

            {objectiveCards.length === 0 ? (
                <Card variant="elevated">
                    <CardContent className="py-12 text-center">
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {t('okr.flow.emptyPillarObjectivesTitle')}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2">
                            {t('okr.flow.emptyPillarObjectivesDescription')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-5">
                    {objectiveCards.map(({ objective, roots, rootCount, leafCount }) => (
                        <Card key={objective.id} variant="elevated" className="p-0 overflow-hidden">
                            <CardHeader className="p-4 md:p-5 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/20">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" size="sm" className="font-mono font-bold">
                                                {objective.code}
                                            </Badge>
                                            <CardTitle className="text-base">{objective.title}</CardTitle>
                                            {objective.due_date && (
                                                <DeadlineBadge 
                                                    dueDate={objective.due_date} 
                                                    isCompleted={objective.is_active === false}
                                                    size="sm"
                                                />
                                            )}
                                        </div>
                                        {objective.description && (
                                            <p className="text-sm text-[var(--color-text-muted)] mt-1.5">
                                                {objective.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <Badge variant="info" size="sm">
                                                {t('okr.flow.pillarRootKRs', { count: rootCount })}
                                            </Badge>
                                            <Badge variant="success" size="sm">
                                                {t('okr.flow.pillarLeafKRs', { count: leafCount })}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingObjective(objective)
                                                setObjectiveModalOpen(true)
                                            }}
                                        >
                                            <Pencil className="w-3 h-3 mr-1" />
                                            {t('common.edit')}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                            onClick={() => handleDeleteObjective(objective)}
                                        >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            {t('common.delete')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openCreateRootKRModal(objective)}
                                        >
                                            <Plus className="w-3 h-3 mr-1" />
                                            {t('okr.cascade.newRootKR')}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-4 md:p-5 space-y-3">
                                {roots.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed border-[var(--color-border)] rounded-xl">
                                        <p className="text-sm text-[var(--color-text-muted)] mb-3">
                                            {t('okr.flow.noRootForObjective')}
                                        </p>
                                        <Button variant="outline" size="sm" onClick={() => openCreateRootKRModal(objective)}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            {t('okr.addFirstKR')}
                                        </Button>
                                    </div>
                                ) : (
                                    roots.map((root) => (
                                        <Card key={root.id} variant="default" className="p-0 overflow-hidden">
                                            <CardContent className="p-4">
                                                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge variant="outline" size="sm" className="font-mono">{root.code}</Badge>
                                                            <p className="text-sm md:text-base font-semibold text-[var(--color-text-primary)] truncate">
                                                                {root.title}
                                                            </p>
                                                            <Badge variant={root.children.length > 0 ? 'info' : 'success'} size="sm">
                                                                {t('okr.flow.rootChildren', { count: root.children.length })}
                                                            </Badge>
                                                            {root.due_date && (
                                                                <DeadlineBadge
                                                                    dueDate={root.due_date}
                                                                    isCompleted={root.is_active === false || (root.progress ?? 0) >= 100}
                                                                    size="sm"
                                                                />
                                                            )}
                                                        </div>
                                                        {root.description && (
                                                            <p className="text-sm text-[var(--color-text-muted)] mt-1.5 line-clamp-2">
                                                                {root.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setKrModalState({
                                                                    open: true,
                                                                    objective,
                                                                    parentKr: null,
                                                                    keyResult: root,
                                                                    initialCode: root.code,
                                                                })
                                                            }}
                                                        >
                                                            <Pencil className="w-3 h-3 mr-1" />
                                                            {t('common.edit')}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                                            onClick={() => handleDeleteRootKR(root)}
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-1" />
                                                            {t('common.delete')}
                                                        </Button>
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            onClick={() => navigate(
                                                                `/okrs/pillar/${selectedPillar.id}/kr/${root.id}`,
                                                                { state: { backTo: currentPath } }
                                                            )}
                                                        >
                                                            {t('okr.flow.openFullScreen')}
                                                            <ArrowRight className="w-4 h-4 ml-1" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                                                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                                                        <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.baseline')}</p>
                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                                            {formatMetricValue(root, root.baseline)}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                                                        <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.actual')}</p>
                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                                            {formatMetricValue(root, root.actual)}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                                                        <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.target')}</p>
                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                                            {formatMetricValue(root, root.target)}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                                                        <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.progress')}</p>
                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                                            {root.progress !== null ? `${Math.round(root.progress)}%` : '-'}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                                                        <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.confidence')}</p>
                                                        <div className="mt-1">
                                                            <ConfidenceIndicator
                                                                value={root.confidence}
                                                                editable
                                                                onChange={(nextValue) => updateConfidence(root.id, nextValue)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)] flex-wrap">
                                                    <span className="inline-flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {t('quarterlyCard.owner')}: {(root.owner_names && root.owner_names.length > 0) ? root.owner_names.join(', ') : (root.owner_name || t('common.unassigned'))}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <GitBranch className="w-3 h-3" />
                                                        {t('okr.flow.openFullScreenHint')}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CascadeKRModal
                open={krModalState.open}
                onOpenChange={(open) => {
                    setKrModalState((prev) => ({ ...prev, open }))
                    if (!open) {
                        setKrModalState({
                            open: false,
                            objective: null,
                            parentKr: null,
                            keyResult: null,
                            initialCode: '',
                        })
                    }
                }}
                onSaved={loadData}
                objectiveId={krModalState.objective?.id || ''}
                objectiveCode={krModalState.objective?.code || ''}
                objectiveTitle={krModalState.objective?.title || ''}
                objectiveYear={krModalState.objective?.year}
                parentKr={krModalState.parentKr}
                keyResult={krModalState.keyResult}
                initialCode={krModalState.initialCode}
            />

            <CreateObjectiveModalV2
                open={objectiveModalOpen}
                onOpenChange={(open) => {
                    setObjectiveModalOpen(open)
                    if (!open) setEditingObjective(null)
                }}
                onSave={loadData}
                pillars={selectedPillar ? [selectedPillar] : []}
                units={selectedUnit && selectedUnitData
                    ? [{ id: selectedUnit, name: selectedUnitData.name, code: selectedUnitData.code }]
                    : []
                }
                defaultPillarId={selectedPillar.id}
                defaultYear={year}
                objective={editingObjective}
            />
        </div>
    )
}
