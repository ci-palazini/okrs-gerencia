/**
 * DeadlineBadge Component
 * Displays a deadline with visual status indicator
 * Shows icon, formatted date, and days remaining/overdue
 */

import { useTranslation } from 'react-i18next'
import { Calendar, Clock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getDeadlineAlert, formatDeadlineDate } from '../../lib/dateUtils'
import type { DeadlineStatus } from '../../types'

interface DeadlineBadgeProps {
  dueDate: string
  isCompleted?: boolean
  className?: string
  showDaysRemaining?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig: Record<DeadlineStatus, {
  icon: typeof Calendar
  bgColor: string
  textColor: string
  iconColor: string
  borderColor: string
  label: string
}> = {
  'on-track': {
    icon: CheckCircle2,
    bgColor: 'bg-green-50 dark:bg-green-500/10',
    textColor: 'text-green-700 dark:text-green-400',
    iconColor: 'text-green-600 dark:text-green-500',
    borderColor: 'border-green-200 dark:border-green-800/50',
    label: 'No prazo'
  },
  'warning': {
    icon: Clock,
    bgColor: 'bg-yellow-50 dark:bg-yellow-500/10',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    iconColor: 'text-yellow-600 dark:text-yellow-500',
    borderColor: 'border-yellow-200 dark:border-yellow-800/50',
    label: 'Atenção'
  },
  'urgent': {
    icon: AlertTriangle,
    bgColor: 'bg-orange-50 dark:bg-orange-500/10',
    textColor: 'text-orange-700 dark:text-orange-400',
    iconColor: 'text-orange-600 dark:text-orange-500',
    borderColor: 'border-orange-200 dark:border-orange-800/50',
    label: 'Urgente'
  },
  'overdue': {
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-500/10',
    textColor: 'text-red-700 dark:text-red-400',
    iconColor: 'text-red-600 dark:text-red-500',
    borderColor: 'border-red-200 dark:border-red-800/50',
    label: 'Atrasado'
  }
}

const sizeConfig = {
  sm: {
    padding: 'px-2 py-1',
    iconSize: 14,
    textSize: 'text-xs',
    gap: 'gap-1'
  },
  md: {
    padding: 'px-3 py-1.5',
    iconSize: 16,
    textSize: 'text-sm',
    gap: 'gap-1.5'
  },
  lg: {
    padding: 'px-4 py-2',
    iconSize: 18,
    textSize: 'text-base',
    gap: 'gap-2'
  }
}

export function DeadlineBadge({
  dueDate,
  isCompleted = false,
  className,
  showDaysRemaining = true,
  size = 'md'
}: DeadlineBadgeProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? 'es' : 'pt'

  if (!dueDate) {
    return null
  }

  const alert = getDeadlineAlert(dueDate, isCompleted, locale)
  const config = statusConfig[alert.status]
  const sizeStyles = sizeConfig[size]
  const Icon = config.icon

  const formattedDate = formatDeadlineDate(dueDate, locale === 'es' ? 'es-ES' : 'pt-BR')

  const tooltipContent = alert.message

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md font-medium transition-colors border shadow-sm backdrop-blur-sm',
        sizeStyles.padding,
        sizeStyles.gap,
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
      title={tooltipContent}
      role="status"
      aria-label={tooltipContent}
    >
      <Icon 
        size={sizeStyles.iconSize} 
        className={cn('flex-shrink-0', config.iconColor)} 
        aria-hidden="true"
      />
      
      <span className={cn('font-semibold', sizeStyles.textSize)}>
        {formattedDate}
      </span>

      {showDaysRemaining && !isCompleted && (
        <span className={cn('font-normal opacity-90', sizeStyles.textSize)}>
          {alert.daysRemaining >= 0 
            ? `(${t('deadline.daysRemaining', { count: alert.daysRemaining })})`
            : `(${t('deadline.daysOverdue', { count: Math.abs(alert.daysRemaining) })})`
          }
        </span>
      )}

      {isCompleted && (
        <span className={cn('font-normal opacity-90', sizeStyles.textSize)}>
          ✓
        </span>
      )}
    </div>
  )
}

/**
 * DeadlineBadgeMinimal - Compact version for dense layouts
 */
export function DeadlineBadgeMinimal({
  dueDate,
  isCompleted = false,
  className
}: Omit<DeadlineBadgeProps, 'showDaysRemaining' | 'size'>) {
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
      className={cn(
        'inline-flex items-center gap-1',
        config.textColor,
        className
      )}
      title={alert.message}
      role="status"
      aria-label={alert.message}
    >
      <Icon size={14} className={config.iconColor} aria-hidden="true" />
      <span className="text-xs font-medium">
        {alert.daysRemaining >= 0 
          ? `${alert.daysRemaining}d` 
          : `${Math.abs(alert.daysRemaining)}d`
        }
      </span>
    </div>
  )
}
