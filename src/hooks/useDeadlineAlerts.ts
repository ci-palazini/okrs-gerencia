/**
 * useDeadlineAlerts Hook
 * Manages deadline alerts for objectives and key results
 * Filters, sorts, and aggregates deadline information
 */

import { useMemo } from 'react'
import { getDeadlineAlert } from '../lib/dateUtils'
import type { Objective, KeyResult, DeadlineAlert, DeadlineStatus } from '../types'

interface DeadlineItem {
  id: string
  type: 'objective' | 'key_result'
  title: string
  code: string
  dueDate: string
  isCompleted: boolean
  alert: DeadlineAlert
  relatedId?: string // objective_id for KRs, pillar_id for objectives
  relatedName?: string // objective title for KRs, pillar name for objectives
}

interface DeadlineAlertsCounts {
  overdue: number
  urgent: number
  warning: number
  onTrack: number
  total: number
}

interface UseDeadlineAlertsResult {
  alerts: DeadlineItem[]
  overdueAlerts: DeadlineItem[]
  urgentAlerts: DeadlineItem[]
  warningAlerts: DeadlineItem[]
  counts: DeadlineAlertsCounts
  getOverdueCount: () => number
  getUrgentCount: () => number
  getWarningCount: () => number
  getAlertsByStatus: (status: DeadlineStatus) => DeadlineItem[]
}

interface UseDeadlineAlertsOptions {
  includeCompleted?: boolean
  locale?: string
  sortBy?: 'status' | 'date' | 'daysRemaining'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Hook to manage deadline alerts for objectives and key results
 * @param objectives - Array of objectives
 * @param keyResults - Array of key results
 * @param options - Configuration options
 */
export function useDeadlineAlerts(
  objectives: Objective[] = [],
  keyResults: KeyResult[] = [],
  options: UseDeadlineAlertsOptions = {}
): UseDeadlineAlertsResult {
  const {
    includeCompleted = false,
    locale = 'pt',
    sortBy = 'daysRemaining',
    sortOrder = 'asc'
  } = options

  const alerts = useMemo(() => {
    const items: DeadlineItem[] = []

    // Process objectives
    objectives.forEach(objective => {
      if (!objective.due_date) return
      
      const isCompleted = objective.is_completed
      if (!includeCompleted && isCompleted) return

      const alert = getDeadlineAlert(objective.due_date, isCompleted, locale)

      items.push({
        id: objective.id,
        type: 'objective',
        title: objective.title,
        code: objective.code,
        dueDate: objective.due_date,
        isCompleted,
        alert,
        relatedId: objective.pillar_id
      })
    })

    // Process key results
    keyResults.forEach(kr => {
      if (!kr.due_date) return
      
      const isCompleted = kr.is_completed
      if (!includeCompleted && isCompleted) return

      const alert = getDeadlineAlert(kr.due_date, isCompleted, locale)

      items.push({
        id: kr.id,
        type: 'key_result',
        title: kr.title,
        code: kr.code,
        dueDate: kr.due_date,
        isCompleted,
        alert,
        relatedId: kr.objective_id
      })
    })

    // Sort items
    items.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'status':
          // Priority: overdue > urgent > warning > on-track
          const statusOrder = { 'overdue': 0, 'urgent': 1, 'warning': 2, 'on-track': 3 }
          comparison = statusOrder[a.alert.status] - statusOrder[b.alert.status]
          break
        
        case 'date':
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        
        case 'daysRemaining':
        default:
          comparison = a.alert.daysRemaining - b.alert.daysRemaining
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return items
  }, [objectives, keyResults, includeCompleted, locale, sortBy, sortOrder])

  // Filter alerts by status
  const overdueAlerts = useMemo(() => 
    alerts.filter(item => item.alert.status === 'overdue'),
    [alerts]
  )

  const urgentAlerts = useMemo(() => 
    alerts.filter(item => item.alert.status === 'urgent'),
    [alerts]
  )

  const warningAlerts = useMemo(() => 
    alerts.filter(item => item.alert.status === 'warning'),
    [alerts]
  )

  // Calculate counts
  const counts = useMemo((): DeadlineAlertsCounts => {
    const statusCounts = alerts.reduce((acc, item) => {
      acc[item.alert.status] = (acc[item.alert.status] || 0) + 1
      return acc
    }, {} as Record<DeadlineStatus, number>)

    return {
      overdue: statusCounts['overdue'] || 0,
      urgent: statusCounts['urgent'] || 0,
      warning: statusCounts['warning'] || 0,
      onTrack: statusCounts['on-track'] || 0,
      total: alerts.length
    }
  }, [alerts])

  // Helper functions
  const getOverdueCount = () => counts.overdue
  const getUrgentCount = () => counts.urgent
  const getWarningCount = () => counts.warning

  const getAlertsByStatus = (status: DeadlineStatus) => 
    alerts.filter(item => item.alert.status === status)

  return {
    alerts,
    overdueAlerts,
    urgentAlerts,
    warningAlerts,
    counts,
    getOverdueCount,
    getUrgentCount,
    getWarningCount,
    getAlertsByStatus
  }
}

/**
 * Hook to get deadline alerts for a specific objective and its KRs
 * @param objective - The objective to check
 * @param keyResults - Key results belonging to this objective
 * @param options - Configuration options
 */
export function useObjectiveDeadlineAlerts(
  objective: Objective | null,
  keyResults: KeyResult[] = [],
  options: UseDeadlineAlertsOptions = {}
) {
  return useDeadlineAlerts(
    objective ? [objective] : [],
    keyResults,
    options
  )
}

/**
 * Hook to get critical deadline alerts (overdue + urgent)
 * @param objectives - Array of objectives
 * @param keyResults - Array of key results
 * @param locale - Language locale
 */
export function useCriticalDeadlineAlerts(
  objectives: Objective[] = [],
  keyResults: KeyResult[] = [],
  locale: string = 'pt'
) {
  const { overdueAlerts, urgentAlerts, counts } = useDeadlineAlerts(
    objectives,
    keyResults,
    { includeCompleted: false, locale, sortBy: 'daysRemaining' }
  )

  const criticalAlerts = useMemo(() => 
    [...overdueAlerts, ...urgentAlerts],
    [overdueAlerts, urgentAlerts]
  )

  const criticalCount = counts.overdue + counts.urgent

  return {
    criticalAlerts,
    criticalCount,
    overdueCount: counts.overdue,
    urgentCount: counts.urgent,
    hasCritical: criticalCount > 0
  }
}
