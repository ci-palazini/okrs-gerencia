import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    GitBranch,
    Layers,
    ListTree,
    Paperclip,
    Pencil,
    Plus,
    ScanEye,
    Trash2,
    User,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { ConfidenceIndicator } from '../../components/ui/ConfidenceIndicator'
import { ActionPlanList } from '../../components/okr/ActionPlanList'
import { CascadeKRModal } from '../../components/okr/CascadeKRModal'
import { KRAttachmentsModal } from '../../components/okr/KRAttachmentsPanel'
import { DeadlineBadge } from '../../components/okr/DeadlineBadge'
import { useCascadeOKRData } from '../../hooks/useCascadeOKRData'
import type { CascadeKeyResult, CascadeObjective, CascadeTreeNode } from '../../hooks/useCascadeOKRData'
import type { ConfidenceLevel } from '../../types'
import { cn, formatKRCurrency, getNextHierarchicalCode } from '../../lib/utils'

interface KRModalState {
    open: boolean
    objective: CascadeObjective | null
    parentKr: Pick<CascadeTreeNode, 'id' | 'code' | 'title' | 'scope'> | null
    keyResult: CascadeKeyResult | null
    initialCode: string
}

interface SelectedNodeContext {
    node: CascadeTreeNode
    objective: CascadeObjective
    ancestry: CascadeTreeNode[]
}

interface FocusLocationState {
    backTo?: string
}

function findNodeInTree(
    nodes: CascadeTreeNode[],
    targetId: string,
    ancestry: CascadeTreeNode[] = []
): { node: CascadeTreeNode; ancestry: CascadeTreeNode[] } | null {
    for (const node of nodes) {
        if (node.id === targetId) {
            return { node, ancestry }
        }

        const found = findNodeInTree(node.children, targetId, [...ancestry, node])
        if (found) return found
    }
    return null
}

function collectNodeIds(nodes: CascadeTreeNode[]): string[] {
    return nodes.flatMap((node) => [node.id, ...collectNodeIds(node.children)])
}

function collectNodeIdsFromNode(node: CascadeTreeNode): string[] {
    return [node.id, ...collectNodeIds(node.children)]
}

function formatMetricValue(kr: CascadeTreeNode, value: number | null): string {
    if (value === null) return '-'
    if (kr.metric_type === 'currency') return formatKRCurrency(value, kr.currency_type)
    if (kr.metric_type === 'percentage') return `${value}%`
    return `${value}${kr.unit ? ` ${kr.unit}` : ''}`
}

function getNextChildCode(parent: CascadeTreeNode): string {
    return getNextHierarchicalCode(
        parent.code,
        parent.children.map((child) => child.code)
    )
}

interface AccordionNodeProps {
    node: CascadeTreeNode
    objective: CascadeObjective
    selectedNodeId: string
    expandedNodes: Set<string>
    openPlanNodes: Set<string>
    onToggleNode: (krId: string) => void
    onTogglePlan: (krId: string) => void
    onAddChild: (objective: CascadeObjective, parent: CascadeTreeNode) => void
    onEdit: (objective: CascadeObjective, kr: CascadeTreeNode) => void
    onDelete: (kr: CascadeTreeNode) => void
    onUpdateConfidence: (krId: string, confidence: ConfidenceLevel) => void
    onFocusNode: (krId: string) => void
}

function AccordionNode({
    node,
    objective,
    selectedNodeId,
    expandedNodes,
    openPlanNodes,
    onToggleNode,
    onTogglePlan,
    onAddChild,
    onEdit,
    onDelete,
    onUpdateConfidence,
    onFocusNode,
}: AccordionNodeProps) {
    const { t } = useTranslation()
    const isExpanded = expandedNodes.has(node.id)
    const isLeaf = node.children.length === 0
    const isPlanOpen = openPlanNodes.has(node.id)
    const isSelected = node.id === selectedNodeId

    return (
        <div className="space-y-3">
            <Card
                variant="default"
                className={cn(
                    'p-0 overflow-hidden',
                    isSelected && 'ring-2 ring-[var(--color-primary)]'
                )}
            >
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-start gap-2">
                            <button
                                type="button"
                                className={cn(
                                    'w-8 h-8 rounded-lg border border-[var(--color-border)] inline-flex items-center justify-center mt-0.5',
                                    node.children.length > 0
                                        ? 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                                        : 'text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]/50 cursor-default'
                                )}
                                onClick={() => node.children.length > 0 && onToggleNode(node.id)}
                                disabled={node.children.length === 0}
                                aria-label={node.children.length > 0 ? t('okr.cascade.toggleChildren') : t('okr.cascade.leaf')}
                            >
                                {node.children.length > 0 ? (
                                    isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                                ) : (
                                    <GitBranch className="w-3 h-3" />
                                )}
                            </button>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" size="sm" className="font-mono font-bold">
                                        {node.code}
                                    </Badge>
                                    <h3 className="text-sm md:text-base font-semibold text-[var(--color-text-primary)] truncate">
                                        {node.title}
                                    </h3>
                                    <Badge variant={isLeaf ? 'success' : 'info'} size="sm">
                                        {isLeaf ? t('okr.cascade.leaf') : t('okr.cascade.branch')}
                                    </Badge>
                                    <Badge variant="default" size="sm">
                                        {t('okr.flow.nodeChildrenCount', { count: node.children.length })}
                                    </Badge>
                                    {isSelected && (
                                        <Badge variant="info" size="sm">
                                            {t('okr.flow.currentFocus')}
                                        </Badge>
                                    )}
                                    {node.due_date && (
                                        <DeadlineBadge
                                            dueDate={node.due_date}
                                            isCompleted={node.progress === 100 || node.is_active === false}
                                            size="sm"
                                        />
                                    )}
                                </div>

                                {node.description && (
                                    <p className="text-sm text-[var(--color-text-muted)] mt-1.5">
                                        {node.description}
                                    </p>
                                )}

                                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)] flex-wrap">
                                    <span>{objective.code}</span>
                                    <span>{t('quarterlyCard.owner')}: {(node.owner_names && node.owner_names.length > 0) ? node.owner_names.join(', ') : (node.owner_name || t('common.unassigned'))}</span>
                                    {node.source && <span>{node.source}</span>}
                                    {node.quarter && <span>Q{node.quarter}</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {!isSelected && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onFocusNode(node.id)}
                                    className="h-8"
                                    title={t('okr.flow.openChildFocus')}
                                >
                                    <ScanEye className="w-3 h-3 mr-1" />
                                    {t('okr.flow.openChildFocus')}
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onAddChild(objective, node)}
                                className="h-8"
                                title={t('okr.cascade.newChildKR')}
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                {t('okr.cascade.newChildKR')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(objective, node)}
                                className="h-8"
                                title={t('okr.cascade.editKR')}
                            >
                                <Pencil className="w-3 h-3 mr-1" />
                                {t('common.edit')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(node)}
                                className="h-8 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                title={t('okr.cascade.deleteKR')}
                            >
                                <Trash2 className="w-3 h-3 mr-1" />
                                {t('common.delete')}
                            </Button>
                            {isLeaf && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onTogglePlan(node.id)}
                                    className="h-8"
                                >
                                    <ClipboardList className="w-3 h-3 mr-1" />
                                    {isPlanOpen ? t('okr.cascade.hideActionPlan') : t('okr.cascade.showActionPlan')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                            <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.baseline')}</p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                {formatMetricValue(node, node.baseline)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                            <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.actual')}</p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                {formatMetricValue(node, node.actual)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                            <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.target')}</p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                {formatMetricValue(node, node.target)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                            <p className="text-xs text-[var(--color-text-muted)]">{t('quarterlyCard.progress')}</p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                                {node.progress !== null ? `${Math.round(node.progress)}%` : '-'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                        <ProgressBar value={node.progress || 0} />
                        <ConfidenceIndicator
                            value={node.confidence}
                            editable
                            onChange={(nextValue) => onUpdateConfidence(node.id, nextValue)}
                        />
                    </div>

                    {isLeaf && isPlanOpen && (
                        <div className="pt-2 border-t border-[var(--color-border-subtle)]">
                            <ActionPlanList krId={node.id} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {node.children.length > 0 && isExpanded && (
                <div className="ml-4 md:ml-8 pl-4 border-l border-[var(--color-border-subtle)] space-y-3">
                    {node.children.map((childNode) => (
                        <AccordionNode
                            key={childNode.id}
                            node={childNode}
                            objective={objective}
                            selectedNodeId={selectedNodeId}
                            expandedNodes={expandedNodes}
                            openPlanNodes={openPlanNodes}
                            onToggleNode={onToggleNode}
                            onTogglePlan={onTogglePlan}
                            onAddChild={onAddChild}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onUpdateConfidence={onUpdateConfidence}
                            onFocusNode={onFocusNode}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export function OKRFocusPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { pillarId, krId } = useParams<{ pillarId: string; krId: string }>()
    const locationState = location.state as FocusLocationState | null
    const currentPath = `${location.pathname}${location.search}${location.hash}`
    const preservedBackTo = locationState?.backTo || currentPath

    const {
        loading,
        selectedUnitData,
        objectives,
        getVisiblePillars,
        getObjectiveRoots,
        getSubtreeSize,
        deleteKR,
        updateConfidence,
        loadData,
    } = useCascadeOKRData(pillarId)

    const [expandedState, setExpandedState] = useState<{ nodeId: string; ids: Set<string> }>({
        nodeId: '',
        ids: new Set(),
    })
    const [openPlanState, setOpenPlanState] = useState<{ nodeId: string; ids: Set<string> }>({
        nodeId: '',
        ids: new Set(),
    })
    const [krModalState, setKrModalState] = useState<KRModalState>({
        open: false,
        objective: null,
        parentKr: null,
        keyResult: null,
        initialCode: '',
    })
    const [attachmentsModalState, setAttachmentsModalState] = useState<{ open: boolean; krId: string | null }>({
        open: false,
        krId: null,
    })

    const selectedPillar = pillarId
        ? getVisiblePillars().find((pillar) => pillar.id === pillarId) || null
        : null

    let selectedContext: SelectedNodeContext | null = null
    if (krId && pillarId) {
        const pillarObjectives = objectives.filter((objective) => objective.pillar_id === pillarId)
        for (const objective of pillarObjectives) {
            const roots = getObjectiveRoots(objective.id)
            const found = findNodeInTree(roots, krId)
            if (found) {
                selectedContext = {
                    node: found.node,
                    objective,
                    ancestry: found.ancestry,
                }
                break
            }
        }
    }

    const defaultExpandedNodes = selectedContext
        ? new Set(collectNodeIdsFromNode(selectedContext.node))
        : new Set<string>()

    const expandedNodes = selectedContext && expandedState.nodeId === selectedContext.node.id
        ? expandedState.ids
        : defaultExpandedNodes

    const openPlanNodes = selectedContext && openPlanState.nodeId === selectedContext.node.id
        ? openPlanState.ids
        : new Set<string>()

    function handleToggleNode(nodeId: string) {
        if (!selectedContext) return
        setExpandedState((prev) => {
            const base = prev.nodeId === selectedContext?.node.id ? prev.ids : defaultExpandedNodes
            const next = new Set(base)
            if (next.has(nodeId)) {
                next.delete(nodeId)
            } else {
                next.add(nodeId)
            }
            return {
                nodeId: selectedContext.node.id,
                ids: next,
            }
        })
    }

    function handleTogglePlan(nodeId: string) {
        if (!selectedContext) return
        setOpenPlanState((prev) => {
            const base = prev.nodeId === selectedContext?.node.id ? prev.ids : new Set<string>()
            const next = new Set(base)
            if (next.has(nodeId)) {
                next.delete(nodeId)
            } else {
                next.add(nodeId)
            }
            return {
                nodeId: selectedContext.node.id,
                ids: next,
            }
        })
    }

    function openCreateChildKRModal(objective: CascadeObjective, parentKr: CascadeTreeNode) {
        if (selectedContext) {
            setExpandedState((prev) => {
                const base = prev.nodeId === selectedContext?.node.id ? prev.ids : defaultExpandedNodes
                const next = new Set(base)
                next.add(parentKr.id)
                return {
                    nodeId: selectedContext.node.id,
                    ids: next,
                }
            })
        }
        setKrModalState({
            open: true,
            objective,
            parentKr,
            keyResult: null,
            initialCode: getNextChildCode(parentKr),
        })
    }

    function openEditKRModal(objective: CascadeObjective, kr: CascadeTreeNode) {
        setKrModalState({
            open: true,
            objective,
            parentKr: null,
            keyResult: kr,
            initialCode: kr.code,
        })
    }

    async function handleDeleteKR(kr: CascadeTreeNode) {
        const subtreeSize = getSubtreeSize(kr.id)
        const message = subtreeSize > 1
            ? t('okr.cascade.deleteKRWithChildrenConfirm', { count: subtreeSize })
            : t('okr.deleteKRConfirm')

        if (!window.confirm(message)) return
        await deleteKR(kr.id)

        if (krId === kr.id && pillarId) {
            navigate(`/okrs/pillar/${pillarId}`, { replace: true })
        }
    }

    function handleExpandAll() {
        if (!selectedContext) return
        setExpandedState({
            nodeId: selectedContext.node.id,
            ids: new Set(collectNodeIdsFromNode(selectedContext.node)),
        })
    }

    function handleCollapseAll() {
        if (!selectedContext) return
        setExpandedState({
            nodeId: selectedContext.node.id,
            ids: new Set([selectedContext.node.id]),
        })
    }

    function handleBackNavigation() {
        const fallbackPath = pillarId ? `/okrs/pillar/${pillarId}` : '/okrs'

        if (locationState?.backTo && locationState.backTo !== currentPath) {
            navigate(locationState.backTo)
            return
        }

        if (window.history.length > 1) {
            navigate(-1)
            return
        }

        navigate(fallbackPath, { replace: true })
    }

    if (loading && !selectedContext) {
        return (
            <div className="flex items-center justify-center min-h-[360px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('okr.loadingData')}</p>
                </div>
            </div>
        )
    }

    if (!selectedPillar || !selectedContext || !pillarId || !krId) {
        return (
            <Card variant="elevated">
                <CardContent className="py-10 text-center">
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {t('okr.flow.noKRFoundTitle')}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                        {t('okr.flow.noKRFoundDescription')}
                    </p>
                    <div className="flex justify-center gap-2 mt-4">
                        <Button variant="outline" onClick={handleBackNavigation}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {t('okr.flow.backToPillars')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const selectedNode = selectedContext.node
    const selectedChildren = selectedNode.children
    const selectedIsLeaf = selectedChildren.length === 0
    const pathCodes = [...selectedContext.ancestry.map((node) => node.code), selectedNode.code].join(' > ')

    return (
        <div className="space-y-6">
            <Card variant="elevated" className="p-0 overflow-hidden">
                <CardContent className="p-5 md:p-6 space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                        <div>
                            <button
                                type="button"
                                onClick={handleBackNavigation}
                                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-3"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {t('okr.flow.backToPillar')}
                            </button>
                            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
                                {selectedNode.code} - {selectedNode.title}
                            </h1>
                            <p className="text-[var(--color-text-secondary)] mt-1.5">
                                {t('okr.flow.focusSubtitle')}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <Badge variant="outline" size="sm">{selectedPillar.name}</Badge>
                                <Badge variant="default" size="sm">{selectedContext.objective.code}</Badge>
                                <Badge variant="info" size="sm">{selectedUnitData?.name || t('okr.local')}</Badge>
                                <Badge variant="outline" size="sm" className="inline-flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {t('quarterlyCard.owner')}: {(selectedNode.owner_names && selectedNode.owner_names.length > 0) ? selectedNode.owner_names.join(', ') : (selectedNode.owner_name || t('common.unassigned'))}
                                </Badge>
                                {selectedNode.due_date && (
                                    <DeadlineBadge 
                                        dueDate={selectedNode.due_date} 
                                        isCompleted={selectedNode.progress === 100 || selectedNode.is_active === false}
                                        size="md"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {!selectedIsLeaf && (
                                <>
                                    <Button variant="outline" onClick={handleExpandAll}>
                                        <Layers className="w-4 h-4 mr-2" />
                                        {t('okr.flow.expandAllFromHere')}
                                    </Button>
                                    <Button variant="outline" onClick={handleCollapseAll}>
                                        <ListTree className="w-4 h-4 mr-2" />
                                        {t('okr.flow.collapseAllFromHere')}
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => setAttachmentsModalState({ open: true, krId: selectedNode.id })}
                            >
                                <Paperclip className="w-4 h-4 mr-2" />
                                {t('okr.fileCenter.openModal')}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => openCreateChildKRModal(selectedContext.objective, selectedNode)}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('okr.cascade.newChildKR')}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => openEditKRModal(selectedContext.objective, selectedNode)}
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                {t('common.edit')}
                            </Button>
                            <Button
                                variant="ghost"
                                className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                onClick={() => handleDeleteKR(selectedNode)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('common.delete')}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface)] space-y-2">
                        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                            {t('okr.flow.focusPath')}
                        </p>
                        <p className="text-sm text-[var(--color-text-primary)]">{pathCodes}</p>
                    </div>
                </CardContent>
            </Card>

            {selectedChildren.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {t('okr.flow.breakdownsTitle')}
                        </p>
                        <Badge variant="default" size="sm">
                            {t('okr.flow.breakdownsCount', { count: selectedChildren.length })}
                        </Badge>
                    </div>

                    {selectedChildren.map((childNode) => (
                        <AccordionNode
                            key={childNode.id}
                            node={childNode}
                            objective={selectedContext.objective}
                            selectedNodeId={selectedNode.id}
                            expandedNodes={expandedNodes}
                            openPlanNodes={openPlanNodes}
                            onToggleNode={handleToggleNode}
                            onTogglePlan={handleTogglePlan}
                            onAddChild={openCreateChildKRModal}
                            onEdit={openEditKRModal}
                            onDelete={handleDeleteKR}
                            onUpdateConfidence={updateConfidence}
                            onFocusNode={(nextKrId) => navigate(
                                `/okrs/pillar/${pillarId}/kr/${nextKrId}`,
                                { state: { backTo: preservedBackTo } }
                            )}
                        />
                    ))}
                </div>
            ) : (
                <Card variant="default" className="p-0 overflow-hidden">
                    <CardContent className="p-4 md:p-5 space-y-4">
                        <div>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {t('okr.flow.noChildBreakdownsTitle')}
                            </p>
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                {t('okr.flow.noChildBreakdownsDescription')}
                            </p>
                        </div>

                        <ActionPlanList krId={selectedNode.id} />
                    </CardContent>
                </Card>
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

            <KRAttachmentsModal
                key={selectedNode.id}
                krId={selectedNode.id}
                open={attachmentsModalState.open && attachmentsModalState.krId === selectedNode.id}
                onOpenChange={(open) => setAttachmentsModalState({ open, krId: selectedNode.id })}
            />
        </div>
    )
}
