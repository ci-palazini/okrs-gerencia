import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useBusinessUnit } from '../contexts/BusinessUnitContext'
import type { ConfidenceLevel } from '../types'

export interface CascadePillar {
    id: string
    code: string
    name: string
    description: string | null
    icon: string
    color: string
    order_index: number
    is_active: boolean
    business_unit_id: string
}

export interface CascadeObjective {
    id: string
    code: string
    title: string
    description: string | null
    pillar_id: string
    business_unit_id: string
    year: number
    due_date: string | null
    is_active: boolean
    is_completed: boolean
}

export interface CascadeObjectiveWithRelations {
    id: string
    code: string
    title: string
    pillar: { id: string; name: string; color: string } | null
    business_unit: { id: string; name: string } | null
}

export interface CascadeKeyResult {
    id: string
    code: string
    title: string
    description: string | null
    owner_name: string | null
    owner_names: string[] | null
    source: string | null
    metric_type: 'percentage' | 'number' | 'currency' | 'days'
    unit: string
    currency_type: string | null
    order_index: number
    objective_id: string
    is_active: boolean
    scope: 'annual' | 'quarterly'
    parent_kr_id: string | null
    quarter: number | null
    target_direction: 'maximize' | 'minimize'
    baseline: number | null
    target: number | null
    actual: number | null
    progress: number | null
    confidence: ConfidenceLevel
    notes: string | null
    due_date: string | null
    is_completed: boolean
}

export interface CascadeTreeNode extends CascadeKeyResult {
    children: CascadeTreeNode[]
    depth: number
}

export interface CascadeMonthlyEntry {
    id: string
    key_result_id: string
    month: number
    year: number
    actual: number | null
    notes: string | null
}

function compareKRs(a: CascadeKeyResult, b: CascadeKeyResult): number {
    // Sort by code numerically (e.g., 1.1, 1.2, 1.10)
    const codeResult = a.code.localeCompare(b.code, 'pt-BR', { numeric: true })
    if (codeResult !== 0) return codeResult

    // Fallback to order_index if codes are identical
    if (a.order_index !== b.order_index) {
        return a.order_index - b.order_index
    }

    // Secondary fallback to quarter
    const aQuarter = a.quarter ?? Number.MAX_SAFE_INTEGER
    const bQuarter = b.quarter ?? Number.MAX_SAFE_INTEGER
    return aQuarter - bQuarter
}

function sortTree(nodes: CascadeTreeNode[]) {
    nodes.sort(compareKRs)
    nodes.forEach((node) => sortTree(node.children))
}

function assignDepth(nodes: CascadeTreeNode[], depth = 0) {
    nodes.forEach((node) => {
        node.depth = depth
        assignDepth(node.children, depth + 1)
    })
}

function buildObjectiveTree(keyResults: CascadeKeyResult[]): CascadeTreeNode[] {
    const nodeMap = new Map<string, CascadeTreeNode>()

    keyResults.forEach((kr) => {
        nodeMap.set(kr.id, {
            ...kr,
            children: [],
            depth: 0,
        })
    })

    const roots: CascadeTreeNode[] = []

    nodeMap.forEach((node) => {
        if (node.parent_kr_id && nodeMap.has(node.parent_kr_id)) {
            nodeMap.get(node.parent_kr_id)?.children.push(node)
            return
        }
        roots.push(node)
    })

    assignDepth(roots)
    sortTree(roots)

    return roots
}

function collectDescendantIds(rootId: string, childrenByParent: Map<string, string[]>): string[] {
    const all: string[] = [rootId]
    const stack: string[] = [rootId]

    while (stack.length > 0) {
        const current = stack.pop()
        if (!current) continue

        const children = childrenByParent.get(current) || []
        children.forEach((childId) => {
            all.push(childId)
            stack.push(childId)
        })
    }

    return all
}

function calculateProgress(
    target: number | null,
    actual: number | null,
    direction: 'maximize' | 'minimize' = 'maximize',
    baseline: number | null = null
): number | null {
    if (target === null || actual === null) return null

    if (baseline !== null) {
        if (direction === 'minimize') {
            const denominator = baseline - target
            if (denominator === 0) return null
            return Math.round(((baseline - actual) / denominator) * 100)
        }

        const denominator = target - baseline
        if (denominator === 0) return null
        return Math.round(((actual - baseline) / denominator) * 100)
    }

    if (target === 0) return null

    if (direction === 'minimize') {
        if (actual === 0) return null
        return Math.round((target / actual) * 100)
    }

    return Math.round((actual / target) * 100)
}

function collectLeafNodes(nodes: CascadeTreeNode[]): CascadeTreeNode[] {
    const leaves: CascadeTreeNode[] = []

    nodes.forEach((node) => {
        if (node.children.length === 0) {
            leaves.push(node)
            return
        }

        leaves.push(...collectLeafNodes(node.children))
    })

    return leaves
}

export function useCascadeOKRData(filterPillar?: string | null) {
    const { user } = useAuth()
    const { selectedUnit, selectedUnitData } = useBusinessUnit()

    const [year, setYear] = useState<number>(new Date().getFullYear())
    const [pillars, setPillars] = useState<CascadePillar[]>([])
    const [objectives, setObjectives] = useState<CascadeObjective[]>([])
    const [objectivesWithRelations, setObjectivesWithRelations] = useState<CascadeObjectiveWithRelations[]>([])
    const [keyResults, setKeyResults] = useState<CascadeKeyResult[]>([])
    const [monthlyEntries, setMonthlyEntries] = useState<CascadeMonthlyEntry[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    const childrenByParent = useMemo(() => {
        const map = new Map<string, string[]>()

        keyResults.forEach((kr) => {
            if (!kr.parent_kr_id) return
            if (!map.has(kr.parent_kr_id)) {
                map.set(kr.parent_kr_id, [])
            }
            map.get(kr.parent_kr_id)?.push(kr.id)
        })

        return map
    }, [keyResults])

    const treeByObjective = useMemo(() => {
        const grouped = new Map<string, CascadeKeyResult[]>()
        keyResults.forEach((kr) => {
            if (!grouped.has(kr.objective_id)) {
                grouped.set(kr.objective_id, [])
            }
            grouped.get(kr.objective_id)?.push(kr)
        })

        const objectiveTrees = new Map<string, CascadeTreeNode[]>()
        grouped.forEach((objectiveKRs, objectiveId) => {
            objectiveTrees.set(objectiveId, buildObjectiveTree(objectiveKRs))
        })

        return objectiveTrees
    }, [keyResults])

    const leafNodesByObjective = useMemo(() => {
        const map = new Map<string, CascadeTreeNode[]>()
        treeByObjective.forEach((roots, objectiveId) => {
            map.set(objectiveId, collectLeafNodes(roots))
        })
        return map
    }, [treeByObjective])

    const allLeafNodes = useMemo(() => {
        return Array.from(leafNodesByObjective.values()).flat()
    }, [leafNodesByObjective])

    const getVisiblePillars = useCallback(() => {
        return pillars
    }, [pillars])

    const getObjectiveRoots = useCallback((objectiveId: string): CascadeTreeNode[] => {
        return treeByObjective.get(objectiveId) || []
    }, [treeByObjective])

    const getObjectiveLeafNodes = useCallback((objectiveId: string): CascadeTreeNode[] => {
        return leafNodesByObjective.get(objectiveId) || []
    }, [leafNodesByObjective])

    const getMonthlyEntry = useCallback((krId: string, month: number): CascadeMonthlyEntry | null => {
        return monthlyEntries.find((entry) => (
            entry.key_result_id === krId
            && entry.month === month
            && entry.year === year
        )) || null
    }, [monthlyEntries, year])

    const hasChildren = useCallback((krId: string) => {
        return (childrenByParent.get(krId) || []).length > 0
    }, [childrenByParent])

    const getSubtreeSize = useCallback((krId: string) => {
        return collectDescendantIds(krId, childrenByParent).length
    }, [childrenByParent])

    const loadData = useCallback(async () => {
        if (!selectedUnit) {
            setPillars([])
            setObjectives([])
            setObjectivesWithRelations([])
            setKeyResults([])
            setMonthlyEntries([])
            return
        }

        setLoading(true)

        try {
            const { data: pillarsData } = await supabase
                .from('pillars')
                .select('*')
                .eq('is_active', true)
                .eq('business_unit_id', selectedUnit)
                .order('order_index')

            setPillars((pillarsData || []) as CascadePillar[])

            let objectivesQuery = supabase
                .from('objectives')
                .select('*')
                .eq('is_active', true)
                .eq('business_unit_id', selectedUnit)
                .eq('year', year)
                .order('created_at')

            if (filterPillar) {
                objectivesQuery = objectivesQuery.eq('pillar_id', filterPillar)
            }

            const { data: objectivesData, error: objectivesError } = await objectivesQuery
            if (objectivesError) throw objectivesError

            const typedObjectives = ((objectivesData || []) as CascadeObjective[])
                .sort((a, b) => {
                    const numA = parseInt(a.code.split('-').pop() || '0', 10)
                    const numB = parseInt(b.code.split('-').pop() || '0', 10)
                    return numA - numB
                })
            setObjectives(typedObjectives)

            const { data: objectivesWithRel } = await supabase
                .from('objectives')
                .select(`
                    id,
                    code,
                    title,
                    pillar:pillars(id, name, color),
                    business_unit:business_units(id, name)
                `)
                .eq('business_unit_id', selectedUnit)
                .eq('year', year)
                .eq('is_active', true)

            setObjectivesWithRelations((objectivesWithRel || []) as unknown as CascadeObjectiveWithRelations[])

            const objectiveIds = typedObjectives.map((objective) => objective.id)
            if (objectiveIds.length === 0) {
                setKeyResults([])
                setMonthlyEntries([])
                return
            }

            const { data: krsData, error: krsError } = await supabase
                .from('key_results')
                .select('*')
                .in('objective_id', objectiveIds)
                .eq('is_active', true)

            if (krsError) throw krsError
            const typedKRs = (krsData || []) as CascadeKeyResult[]
            setKeyResults(typedKRs)

            if (typedKRs.length === 0) {
                setMonthlyEntries([])
                return
            }

            const parentIds = new Set(
                typedKRs
                    .map((kr) => kr.parent_kr_id)
                    .filter((id): id is string => Boolean(id))
            )

            const leafIds = typedKRs
                .filter((kr) => !parentIds.has(kr.id))
                .map((kr) => kr.id)

            if (leafIds.length === 0) {
                setMonthlyEntries([])
                return
            }

            const { data: monthlyData, error: monthlyError } = await supabase
                .from('kr_monthly_data')
                .select('id,key_result_id,month,year,actual,notes')
                .in('key_result_id', leafIds)
                .eq('year', year)
                .order('month', { ascending: true })

            if (monthlyError) throw monthlyError
            setMonthlyEntries((monthlyData || []) as CascadeMonthlyEntry[])
        } catch (error) {
            console.error('Error loading cascade OKR data:', error)
        } finally {
            setLoading(false)
        }
    }, [selectedUnit, filterPillar, year])

    useEffect(() => {
        if (selectedUnit) {
            loadData()
        }
    }, [selectedUnit, loadData])

    const updateConfidence = useCallback(async (krId: string, confidence: ConfidenceLevel) => {
        try {
            const kr = keyResults.find((item) => item.id === krId)
            const { error } = await supabase
                .from('key_results')
                .update({ confidence })
                .eq('id', krId)

            if (error) throw error

            setKeyResults((prev) => prev.map((item) => (
                item.id === krId
                    ? { ...item, confidence }
                    : item
            )))

            if (user && kr) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'key_results',
                    entity_id: krId,
                    entity_name: `${kr.title} - confidence`,
                    old_value: { confidence: kr.confidence },
                    new_value: { confidence },
                })
            }
        } catch (error) {
            console.error('Error updating KR confidence:', error)
        }
    }, [keyResults, user])

    const updateValue = useCallback(async (krId: string, field: 'baseline' | 'target' | 'actual', value: number | null) => {
        try {
            const kr = keyResults.find((item) => item.id === krId)
            if (!kr) return

            const nextTarget = field === 'target' ? value : kr.target
            const nextActual = field === 'actual' ? value : kr.actual
            const nextBaseline = field === 'baseline' ? value : kr.baseline
            const nextProgress = calculateProgress(nextTarget, nextActual, kr.target_direction, nextBaseline)

            const patch: Partial<CascadeKeyResult> = {
                [field]: value,
                progress: nextProgress,
            }

            const { error } = await supabase
                .from('key_results')
                .update(patch)
                .eq('id', krId)

            if (error) throw error

            setKeyResults((prev) => prev.map((item) => (
                item.id === krId
                    ? { ...item, ...patch }
                    : item
            )))

            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'key_results',
                    entity_id: krId,
                    entity_name: `${kr.title} - ${field}`,
                    old_value: { [field]: kr[field], progress: kr.progress },
                    new_value: { [field]: value, progress: nextProgress },
                })
            }
        } catch (error) {
            console.error('Error updating KR value:', error)
        }
    }, [keyResults, user])

    const deleteKR = useCallback(async (krId: string) => {
        try {
            const kr = keyResults.find((item) => item.id === krId)
            if (!kr) return

            const idsToDelete = collectDescendantIds(krId, childrenByParent)
            const { error } = await supabase
                .from('key_results')
                .delete()
                .in('id', idsToDelete)

            if (error) throw error

            setKeyResults((prev) => prev.filter((item) => !idsToDelete.includes(item.id)))

            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'delete',
                    entity_type: 'key_results',
                    entity_id: krId,
                    entity_name: kr.title,
                    old_value: {
                        deleted_ids: idsToDelete,
                    },
                })
            }
        } catch (error) {
            console.error('Error deleting KR tree:', error)
        }
    }, [childrenByParent, keyResults, user])

    const deleteObjective = useCallback(async (objectiveId: string) => {
        try {
            const objective = objectives.find((item) => item.id === objectiveId)
            const { error } = await supabase
                .from('objectives')
                .delete()
                .eq('id', objectiveId)

            if (error) throw error

            setObjectives((prev) => prev.filter((item) => item.id !== objectiveId))
            setObjectivesWithRelations((prev) => prev.filter((item) => item.id !== objectiveId))
            setKeyResults((prev) => prev.filter((item) => item.objective_id !== objectiveId))

            if (user && objective) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'delete',
                    entity_type: 'objectives',
                    entity_id: objectiveId,
                    entity_name: objective.title,
                })
            }
        } catch (error) {
            console.error('Error deleting objective:', error)
        }
    }, [objectives, user])

    const toggleKRComplete = useCallback(async (krId: string, isCompleted: boolean) => {
        try {
            const kr = keyResults.find((item) => item.id === krId)
            const { error } = await supabase
                .from('key_results')
                .update({ is_completed: isCompleted })
                .eq('id', krId)

            if (error) throw error

            setKeyResults((prev) => prev.map((item) => (
                item.id === krId ? { ...item, is_completed: isCompleted } : item
            )))

            if (user && kr) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'key_results',
                    entity_id: krId,
                    entity_name: `${kr.title} - is_completed`,
                    old_value: { is_completed: kr.is_completed },
                    new_value: { is_completed: isCompleted },
                })
            }
        } catch (error) {
            console.error('Error toggling KR completion:', error)
        }
    }, [keyResults, user])

    const toggleObjectiveComplete = useCallback(async (objectiveId: string, isCompleted: boolean) => {
        try {
            const objective = objectives.find((item) => item.id === objectiveId)
            const { error } = await supabase
                .from('objectives')
                .update({ is_completed: isCompleted })
                .eq('id', objectiveId)

            if (error) throw error

            setObjectives((prev) => prev.map((item) => (
                item.id === objectiveId ? { ...item, is_completed: isCompleted } : item
            )))

            if (user && objective) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'objectives',
                    entity_id: objectiveId,
                    entity_name: `${objective.title} - is_completed`,
                    old_value: { is_completed: objective.is_completed },
                    new_value: { is_completed: isCompleted },
                })
            }
        } catch (error) {
            console.error('Error toggling objective completion:', error)
        }
    }, [objectives, user])

    const upsertMonthlyData = useCallback(async (
        krId: string,
        month: number,
        fields: { actual?: number | null; notes?: string | null }
    ) => {
        try {
            const existing = monthlyEntries.find((entry) => (
                entry.key_result_id === krId
                && entry.month === month
                && entry.year === year
            ))

            const payload = {
                key_result_id: krId,
                month,
                year,
                actual: fields.actual !== undefined ? fields.actual : (existing?.actual ?? null),
                notes: fields.notes !== undefined ? fields.notes : (existing?.notes ?? null),
            }

            const { data, error } = await supabase
                .from('kr_monthly_data')
                .upsert(payload, { onConflict: 'key_result_id,month,year' })
                .select('id,key_result_id,month,year,actual,notes')
                .single()

            if (error) throw error

            const typedData = data as CascadeMonthlyEntry
            setMonthlyEntries((prev) => {
                const index = prev.findIndex((entry) => (
                    entry.key_result_id === krId
                    && entry.month === month
                    && entry.year === year
                ))

                if (index >= 0) {
                    const next = [...prev]
                    next[index] = typedData
                    return next
                }

                return [...prev, typedData]
            })

            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'update',
                    entity_type: 'kr_monthly_data',
                    entity_id: typedData.id,
                    entity_name: `KR ${krId} M${month}/${year}`,
                    old_value: existing || null,
                    new_value: typedData,
                })
            }
        } catch (error) {
            console.error('Error upserting monthly data:', error)
        }
    }, [monthlyEntries, user, year])

    return {
        year,
        setYear,
        loading,
        selectedUnit,
        selectedUnitData,
        pillars,
        objectives,
        objectivesWithRelations,
        keyResults,
        allLeafNodes,
        monthlyEntries,
        getVisiblePillars,
        getObjectiveRoots,
        getObjectiveLeafNodes,
        hasChildren,
        getSubtreeSize,
        getMonthlyEntry,
        calculateProgress,
        loadData,
        updateConfidence,
        updateValue,
        upsertMonthlyData,
        deleteKR,
        deleteObjective,
        toggleKRComplete,
        toggleObjectiveComplete,
    }
}
