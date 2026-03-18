import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, ListTree, ScanEye, Search } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ConfidenceIndicator } from '../../components/ui/ConfidenceIndicator'
import { Input } from '../../components/ui/Input'
import { DeadlineIndicatorIcon } from '../../components/okr/DeadlineIndicator'
import { useCascadeOKRData } from '../../hooks/useCascadeOKRData'
import type { CascadeObjective, CascadePillar, CascadeTreeNode } from '../../hooks/useCascadeOKRData'
import type { ConfidenceLevel } from '../../types'
import { cn } from '../../lib/utils'

interface ConfidenceSummary {
    total: number
    on_track: number
    at_risk: number
    off_track: number
    not_set: number
}

interface FlowNodeLayout {
    id: string
    node: CascadeTreeNode
    parentId: string | null
    depth: number
    row: number
    x: number
    y: number
}

interface FlowEdgeLayout {
    id: string
    path: string
    confidence: ConfidenceLevel
}

interface ObjectiveFlowLayout {
    nodes: FlowNodeLayout[]
    edges: FlowEdgeLayout[]
    width: number
    height: number
}

interface ObjectiveFlowGroup {
    objective: CascadeObjective
    roots: CascadeTreeNode[]
    layout: ObjectiveFlowLayout
    confidence: ConfidenceSummary
}

interface PillarMapSection {
    pillar: CascadePillar
    objectives: ObjectiveFlowGroup[]
    confidence: ConfidenceSummary
}

const FLOW_NODE_WIDTH = 250
const FLOW_NODE_HEIGHT = 94
const FLOW_COL_GAP = 130
const FLOW_ROW_GAP = 112
const FLOW_PAD_X = 26
const FLOW_PAD_Y = 20

function flattenNodes(nodes: CascadeTreeNode[]): CascadeTreeNode[] {
    return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}

function countConfidence(nodes: CascadeTreeNode[]): ConfidenceSummary {
    return nodes.reduce<ConfidenceSummary>((acc, node) => {
        acc.total += 1
        if (node.confidence === 'on_track') acc.on_track += 1
        else if (node.confidence === 'at_risk') acc.at_risk += 1
        else if (node.confidence === 'off_track') acc.off_track += 1
        else acc.not_set += 1
        return acc
    }, {
        total: 0,
        on_track: 0,
        at_risk: 0,
        off_track: 0,
        not_set: 0,
    })
}

function matchesText(value: string | null | undefined, term: string): boolean {
    if (!term) return true
    return (value || '').toLowerCase().includes(term)
}

function nodeMatchesSearch(node: CascadeTreeNode, term: string): boolean {
    if (!term) return true

    if (
        matchesText(node.code, term)
        || matchesText(node.title, term)
        || matchesText(node.owner_name, term)
        || matchesText(node.description, term)
    ) {
        return true
    }

    return node.children.some((child) => nodeMatchesSearch(child, term))
}

function filterTreeBySearch(nodes: CascadeTreeNode[], term: string): CascadeTreeNode[] {
    if (!term) return nodes

    return nodes
        .filter((node) => nodeMatchesSearch(node, term))
        .map((node) => ({
            ...node,
            children: filterTreeBySearch(node.children, term),
        }))
}

function getNodeAccentClasses(confidence: ConfidenceLevel): string {
    if (confidence === 'on_track') {
        return 'border-[var(--color-success)]/40 bg-[var(--color-success-muted)]/45'
    }
    if (confidence === 'at_risk') {
        return 'border-[var(--color-warning)]/40 bg-[var(--color-warning-muted)]/45'
    }
    if (confidence === 'off_track') {
        return 'border-[var(--color-danger)]/45 bg-[var(--color-danger-muted)]/45'
    }
    return 'border-[var(--color-border)] bg-[var(--color-surface)]/80'
}

function getEdgeColorClass(confidence: ConfidenceLevel): string {
    if (confidence === 'on_track') return 'stroke-[var(--color-success)]/45'
    if (confidence === 'at_risk') return 'stroke-[var(--color-warning)]/45'
    if (confidence === 'off_track') return 'stroke-[var(--color-danger)]/45'
    return 'stroke-[var(--color-border)]'
}

function buildFlowLayout(roots: CascadeTreeNode[]): ObjectiveFlowLayout {
    if (roots.length === 0) {
        return {
            nodes: [],
            edges: [],
            width: 0,
            height: 0,
        }
    }

    type Unpositioned = Omit<FlowNodeLayout, 'x' | 'y'>
    const staged: Unpositioned[] = []
    let nextRow = 0

    const walk = (node: CascadeTreeNode, depth: number, parentId: string | null): number => {
        if (node.children.length === 0) {
            const row = nextRow
            nextRow += 1
            staged.push({
                id: node.id,
                node,
                parentId,
                depth,
                row,
            })
            return row
        }

        const childRows = node.children.map((child) => walk(child, depth + 1, node.id))
        const row = (Math.min(...childRows) + Math.max(...childRows)) / 2
        staged.push({
            id: node.id,
            node,
            parentId,
            depth,
            row,
        })
        return row
    }

    roots.forEach((root, index) => {
        if (index > 0) {
            nextRow += 0.85
        }
        walk(root, 0, null)
    })

    const maxDepth = Math.max(...staged.map((item) => item.depth))
    const maxRow = Math.max(...staged.map((item) => item.row))

    const width = (FLOW_PAD_X * 2) + ((maxDepth + 1) * FLOW_NODE_WIDTH) + (maxDepth * FLOW_COL_GAP)
    const height = (FLOW_PAD_Y * 2) + ((maxRow + 1) * FLOW_ROW_GAP) + FLOW_NODE_HEIGHT

    const nodes: FlowNodeLayout[] = staged.map((item) => ({
        ...item,
        x: FLOW_PAD_X + (item.depth * (FLOW_NODE_WIDTH + FLOW_COL_GAP)),
        y: FLOW_PAD_Y + (item.row * FLOW_ROW_GAP),
    }))

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const curve = Math.max(36, FLOW_COL_GAP * 0.42)

    const edges = nodes
        .filter((node) => node.parentId)
        .map((node) => {
            const parent = nodeById.get(node.parentId || '')
            if (!parent) return null

            const startX = parent.x + FLOW_NODE_WIDTH
            const startY = parent.y + (FLOW_NODE_HEIGHT / 2)
            const endX = node.x
            const endY = node.y + (FLOW_NODE_HEIGHT / 2)
            const path = `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`

            return {
                id: `${parent.id}-${node.id}`,
                path,
                confidence: node.node.confidence,
            }
        })
        .filter((edge): edge is FlowEdgeLayout => edge !== null)

    return {
        nodes,
        edges,
        width,
        height,
    }
}

export function OKRConfidenceMapPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const currentPath = `${location.pathname}${location.search}${location.hash}`
    const {
        loading,
        selectedUnitData,
        objectives,
        getVisiblePillars,
        getObjectiveRoots,
    } = useCascadeOKRData()

    const [searchTerm, setSearchTerm] = useState('')
    const [collapsedPillarIds, setCollapsedPillarIds] = useState<Set<string>>(new Set())
    const [presentationMode, setPresentationMode] = useState(false)


    const allSections = useMemo<PillarMapSection[]>(() => {
        return getVisiblePillars().map((pillar) => {
            const objectiveGroups: ObjectiveFlowGroup[] = objectives
                .filter((objective) => objective.pillar_id === pillar.id)
                .map((objective) => {
                    const roots = getObjectiveRoots(objective.id)
                    const allNodes = flattenNodes(roots)
                    return {
                        objective,
                        roots,
                        layout: buildFlowLayout(roots),
                        confidence: countConfidence(allNodes),
                    }
                })

            const allNodes = objectiveGroups.flatMap((group) => flattenNodes(group.roots))
            return {
                pillar,
                objectives: objectiveGroups,
                confidence: countConfidence(allNodes),
            }
        })
    }, [getObjectiveRoots, getVisiblePillars, objectives])

    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filteredSections = useMemo<PillarMapSection[]>(() => {
        return allSections
            .map((section) => {
                const pillarMatches = (
                    matchesText(section.pillar.name, normalizedSearch)
                    || matchesText(section.pillar.code, normalizedSearch)
                    || matchesText(section.pillar.description, normalizedSearch)
                )

                const objectiveGroups = section.objectives
                    .map((group) => {
                        const objectiveMatches = (
                            matchesText(group.objective.code, normalizedSearch)
                            || matchesText(group.objective.title, normalizedSearch)
                            || matchesText(group.objective.description, normalizedSearch)
                        )

                        if (!normalizedSearch || pillarMatches || objectiveMatches) {
                            return group
                        }

                        const filteredRoots = filterTreeBySearch(group.roots, normalizedSearch)
                        if (filteredRoots.length === 0) return null

                        return {
                            objective: group.objective,
                            roots: filteredRoots,
                            layout: buildFlowLayout(filteredRoots),
                            confidence: countConfidence(flattenNodes(filteredRoots)),
                        }
                    })
                    .filter((group): group is ObjectiveFlowGroup => group !== null)

                if (normalizedSearch && !pillarMatches && objectiveGroups.length === 0) {
                    return null
                }

                const visibleNodes = objectiveGroups.flatMap((group) => flattenNodes(group.roots))
                return {
                    pillar: section.pillar,
                    objectives: objectiveGroups,
                    confidence: countConfidence(visibleNodes),
                }
            })
            .filter((section): section is PillarMapSection => section !== null)
    }, [allSections, normalizedSearch])

    const globalSummary = useMemo(() => {
        return allSections.reduce<ConfidenceSummary>((acc, section) => {
            acc.total += section.confidence.total
            acc.on_track += section.confidence.on_track
            acc.at_risk += section.confidence.at_risk
            acc.off_track += section.confidence.off_track
            acc.not_set += section.confidence.not_set
            return acc
        }, {
            total: 0,
            on_track: 0,
            at_risk: 0,
            off_track: 0,
            not_set: 0,
        })
    }, [allSections])


    function togglePillar(pillarId: string) {
        setCollapsedPillarIds((prev) => {
            const next = new Set(prev)
            if (next.has(pillarId)) next.delete(pillarId)
            else next.add(pillarId)
            return next
        })
    }

    function expandAllPillars() {
        setCollapsedPillarIds(new Set())
    }

    function collapseAllPillars() {
        setCollapsedPillarIds(new Set(filteredSections.map((section) => section.pillar.id)))
    }

    function openKRFocus(pillarId: string, krId: string) {
        navigate(`/okrs/pillar/${pillarId}/kr/${krId}`, { state: { backTo: currentPath } })
    }

    function handlePrint() {
        window.print()
    }

    if (loading && allSections.length === 0) {
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
        <div className={cn('space-y-6', presentationMode && 'pb-10')}>
            {!presentationMode && (
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

                                <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                    <ListTree className="w-6 h-6 text-[var(--color-primary)]" />
                                    {t('okr.flow.mapTitle')}
                                </h1>
                                <p className="text-[var(--color-text-secondary)] mt-1.5">
                                    {t('okr.flow.mapSubtitle')}
                                </p>
                                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                                    {t('okr.flow.mapShareHint')}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button variant="outline" onClick={expandAllPillars}>
                                    {t('okr.cascade.expandAll')}
                                </Button>
                                <Button variant="ghost" onClick={collapseAllPillars}>
                                    {t('okr.cascade.collapseAll')}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3 items-end">
                            <Input
                                label={t('okr.flow.mapSearchLabel')}
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder={t('okr.flow.mapSearchPlaceholder')}
                                icon={<Search className="w-4 h-4" />}
                            />
                            <Button variant="outline" onClick={() => setPresentationMode(true)}>
                                {t('okr.flow.mapPresentationEnter')}
                            </Button>
                            <Button variant="outline" onClick={handlePrint}>
                                {t('okr.flow.mapPrint')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {presentationMode && (
                <div className="flex justify-end gap-2 print:hidden">
                    <Button variant="outline" onClick={() => setPresentationMode(false)}>
                        {t('okr.flow.mapPresentationExit')}
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                        {t('okr.flow.mapPrint')}
                    </Button>
                </div>
            )}

            <Card variant="elevated">
                <CardContent className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" size="sm">
                            {selectedUnitData?.name || t('okr.local')}
                        </Badge>
                        <Badge variant="default" size="sm">
                            {t('okr.flow.mapTotalKRs', { count: globalSummary.total })}
                        </Badge>
                        <Badge variant="success" size="sm">
                            {t('okr.flow.mapOnTrackCount', { count: globalSummary.on_track })}
                        </Badge>
                        <Badge variant="warning" size="sm">
                            {t('okr.flow.mapAtRiskCount', { count: globalSummary.at_risk })}
                        </Badge>
                        <Badge variant="danger" size="sm">
                            {t('okr.flow.mapOffTrackCount', { count: globalSummary.off_track })}
                        </Badge>
                        <Badge variant="default" size="sm">
                            {t('okr.flow.mapNotSetCount', { count: globalSummary.not_set })}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {filteredSections.length === 0 ? (
                <Card variant="elevated">
                    <CardContent className="py-10 text-center">
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {t('okr.flow.mapEmptyTitle')}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2">
                            {normalizedSearch
                                ? t('okr.flow.mapEmptySearchDescription')
                                : t('okr.flow.mapEmptyDescription')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredSections.map((section) => {
                        const isExpanded = !collapsedPillarIds.has(section.pillar.id)

                        return (
                            <Card key={section.pillar.id} variant="elevated" className="overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="px-4 md:px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePillar(section.pillar.id)}
                                                        className="w-8 h-8 rounded-lg border border-[var(--color-border)] inline-flex items-center justify-center text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                                                        aria-label={isExpanded ? t('okr.flow.mapCollapsePillar') : t('okr.flow.mapExpandPillar')}
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                                        {section.pillar.name}
                                                    </h2>
                                                    <Badge variant="outline" size="sm">{section.pillar.code}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap mt-2">
                                                    <Badge variant="default" size="sm">
                                                        {t('okr.flow.pillarObjectives', { count: section.objectives.length })}
                                                    </Badge>
                                                    <Badge variant="success" size="sm">
                                                        {t('okr.flow.mapOnTrackCount', { count: section.confidence.on_track })}
                                                    </Badge>
                                                    <Badge variant="warning" size="sm">
                                                        {t('okr.flow.mapAtRiskCount', { count: section.confidence.at_risk })}
                                                    </Badge>
                                                    <Badge variant="danger" size="sm">
                                                        {t('okr.flow.mapOffTrackCount', { count: section.confidence.off_track })}
                                                    </Badge>
                                                    <Badge variant="default" size="sm">
                                                        {t('okr.flow.mapNotSetCount', { count: section.confidence.not_set })}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-4 md:p-5 space-y-4">
                                            {section.objectives.map((group) => (
                                                <div key={group.objective.id} className="space-y-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="outline" size="sm">{group.objective.code}</Badge>
                                                        <p className="text-sm md:text-base font-semibold text-[var(--color-text-primary)]">
                                                            {group.objective.title}
                                                        </p>
                                                        <Badge variant="default" size="sm">
                                                            {t('okr.flow.mapTotalKRs', { count: group.confidence.total })}
                                                        </Badge>
                                                    </div>

                                                    {group.layout.nodes.length > 0 ? (
                                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 overflow-x-auto">
                                                            <div
                                                                className="relative"
                                                                style={{
                                                                    width: `${group.layout.width}px`,
                                                                    height: `${group.layout.height}px`,
                                                                    minWidth: `${group.layout.width}px`,
                                                                    minHeight: `${group.layout.height}px`,
                                                                }}
                                                            >
                                                                <svg
                                                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                                                    viewBox={`0 0 ${group.layout.width} ${group.layout.height}`}
                                                                    fill="none"
                                                                >
                                                                    {group.layout.edges.map((edge) => (
                                                                        <path
                                                                            key={edge.id}
                                                                            d={edge.path}
                                                                            className={cn('stroke-[2.4] fill-none', getEdgeColorClass(edge.confidence))}
                                                                            strokeLinecap="round"
                                                                        />
                                                                    ))}
                                                                </svg>

                                                                {group.layout.nodes.map((item) => (
                                                                    <button
                                                                        key={item.id}
                                                                        type="button"
                                                                        onClick={() => openKRFocus(section.pillar.id, item.id)}
                                                                        className={cn(
                                                                            'absolute text-left rounded-xl border shadow-sm p-3 transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
                                                                            getNodeAccentClasses(item.node.confidence)
                                                                        )}
                                                                        style={{
                                                                            left: `${item.x}px`,
                                                                            top: `${item.y}px`,
                                                                            width: `${FLOW_NODE_WIDTH}px`,
                                                                            height: `${FLOW_NODE_HEIGHT}px`,
                                                                        }}
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Badge variant="outline" size="sm" className="font-mono font-semibold">
                                                                                    {item.node.code}
                                                                                </Badge>
                                                                                {item.node.due_date && (
                                                                                    <DeadlineIndicatorIcon 
                                                                                        dueDate={item.node.due_date} 
                                                                                        isCompleted={item.node.progress === 100 || item.node.is_active === false}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <ConfidenceIndicator value={item.node.confidence} size="sm" />
                                                                        </div>

                                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-2 line-clamp-2">
                                                                            {item.node.title}
                                                                        </p>

                                                                        <div className="flex items-center justify-between gap-2 mt-2 text-xs text-[var(--color-text-muted)]">
                                                                            <span className="truncate">
                                                                                {item.node.owner_name || t('common.unassigned')}
                                                                            </span>
                                                                            <span className="inline-flex items-center gap-1">
                                                                                <ScanEye className="w-3 h-3" />
                                                                                {t('okr.flow.openFullScreen')}
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-[var(--color-text-muted)]">
                                                            {t('okr.flow.noRootForObjective')}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
