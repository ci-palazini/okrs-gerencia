/**
 * DeadlineIndicator Component
 * Compact deadline display for table cells
 * Shows icon + date or icon + days remaining with subtle background
 */

import { useTranslation } from 'react-i18next'
import { Calendar, Clock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getDeadlineAlert, formatDeadlineDate } from '../../lib/dateUtils'
import type { DeadlineStatus } from '../../types'

interface DeadlineIndicatorProps {
  dueDate: string | null
  isCompleted?: boolean
  className?: string
  variant?: 'date' | 'days' | 'both'
}

const statusConfig: Record<DeadlineStatus, {
  icon: typeof Calendar
  bgColor: string
  textColor: string
  iconColor: string
  borderColor: string
}> = {
  'on-track': {
    icon: CheckCircle2,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-400',
    iconColor: 'text-green-600 dark:text-green-500',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  'warning': {
    icon: Clock,
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    iconColor: 'text-yellow-600 dark:text-yellow-500',
    borderColor: 'border-yellow-200 dark:border-yellow-800'
  },
  'urgent': {
    icon: AlertTriangle,
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-400',
    iconColor: 'text-orange-600 dark:text-orange-500',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  'overdue': {
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-400',
    iconColor: 'text-red-600 dark:text-red-500',
    borderColor: 'border-red-200 dark:border-red-800'
  }
}

export function DeadlineIndicator({
  dueDate,
  isCompleted = false,
  className,
  variant = 'both'
}: DeadlineIndicatorProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es' : 'pt'

  if (!dueDate) {
    return (
      <div className={cn('text-xs text-gray-400 dark:text-gray-600', className)}>
        {t('deadline.noDeadline')}
      </div>
    )
  }

  const alert = getDeadlineAlert(dueDate, isCompleted, locale)
  const config = statusConfig[alert.status]
  const Icon = config.icon

  const formattedDate = formatDeadlineDate(dueDate, locale === 'es' ? 'es-ES' : 'pt-BR')

  // Determine what to display based on variant
  let displayText = ''
  if (variant === 'date') {
    displayText = formattedDate
  } else if (variant === 'days') {
    displayText = alert.daysRemaining >= 0 
      ? `${alert.daysRemaining}d`
      : `-${Math.abs(alert.daysRemaining)}d`
  } else { // both
    displayText = alert.daysRemaining >= 0 
      ? `${formattedDate} (${alert.daysRemaining}d)`
      : `${formattedDate} (-${Math.abs(alert.daysRemaining)}d)`
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-colors',
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
      title={alert.message}
      role="status"
      aria-label={alert.message}
    >
      <Icon 
        size={14} 
        className={cn('flex-shrink-0', config.iconColor)} 
        aria-hidden="true"
      />
      
      <span className="text-xs font-medium whitespace-nowrap">
        {displayText}
      </span>

      {isCompleted && (
        <span className="text-xs opacity-75">✓</span>
      )}
    </div>
  )
}

/**
 * DeadlineIndicatorIcon - Just the icon with status color
 * Ultra-compact for very dense tables
 */
export function DeadlineIndicatorIcon({
  dueDate,
  isCompleted = false,
  className
}: Omit<DeadlineIndicatorProps, 'variant'>) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es' : 'pt'

  if (!dueDate) {
    return null
  }

  const alert = getDeadlineAlert(dueDate, isCompleted, locale)
  const config = statusConfig[alert.status]
  const Icon = config.icon

  return (
    <div
      className={cn('inline-flex', className)}
      title={alert.message}
      role="status"
      aria-label={alert.message}
    >
      <Icon 
        size={16} 
        className={cn('flex-shrink-0', config.iconColor)} 
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * DeadlineIndicatorCompact - Shows only days remaining with color coding
 * Good for tight spaces where date is not essential
 */
export function DeadlineIndicatorCompact({
  dueDate,
  isCompleted = false,
  className
}: Omit<DeadlineIndicatorProps, 'variant'>) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es' : 'pt'

  if (!dueDate) {
    return null
  }

  const alert = getDeadlineAlert(dueDate, isCompleted, locale)
  const config = statusConfig[alert.status]

  const displayDays = alert.daysRemaining >= 0 
    ? `${alert.daysRemaining}d`
    : `${Math.abs(alert.daysRemaining)}d`

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-semibold min-w-[32px]',
        config.bgColor,
        config.textColor,
        className
      )}
      title={alert.message}
      role="status"
      aria-label={alert.message}
    >
      {alert.daysRemaining < 0 && '−'}
      {displayDays}
    </div>
  )
}
