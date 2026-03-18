/**
 * Date utility functions for OKR deadline management
 * All functions work with ISO date strings (YYYY-MM-DD format)
 */

import type { DeadlineStatus, DeadlineAlert } from '../types'

/**
 * Calculates the deadline status based on days remaining
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @param isCompleted - Whether the OKR/KR is completed
 * @returns DeadlineStatus: 'on-track', 'warning', 'urgent', or 'overdue'
 */
export function calculateDeadlineStatus(
  dueDate: string,
  isCompleted: boolean = false
): DeadlineStatus {
  if (isCompleted) {
    return 'on-track'
  }

  const days = getDaysUntilDeadline(dueDate)

  if (days < 0) return 'overdue'
  if (days <= 14) return 'urgent'
  if (days <= 30) return 'warning'
  return 'on-track'
}

/**
 * Gets the number of days until (or past) the deadline
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @returns Number of days (negative if overdue)
 */
export function getDaysUntilDeadline(dueDate: string): number {
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Gets a complete deadline alert object with status, days, and message
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @param isCompleted - Whether the OKR/KR is completed
 * @param locale - Language locale ('pt' or 'es')
 * @returns DeadlineAlert object
 */
export function getDeadlineAlert(
  dueDate: string,
  isCompleted: boolean = false,
  locale: string = 'pt'
): DeadlineAlert {
  const status = calculateDeadlineStatus(dueDate, isCompleted)
  const daysRemaining = getDaysUntilDeadline(dueDate)
  
  let message: string
  const absDays = Math.abs(daysRemaining)

  if (isCompleted) {
    message = locale === 'es' ? 'Completado' : 'Concluído'
  } else if (status === 'overdue') {
    message = locale === 'es' 
      ? `Atrasado ${absDays} ${absDays === 1 ? 'día' : 'días'}`
      : `Atrasado ${absDays} ${absDays === 1 ? 'dia' : 'dias'}`
  } else if (status === 'urgent') {
    message = locale === 'es'
      ? `Urgente: ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} restantes`
      : `Urgente: ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} restantes`
  } else if (status === 'warning') {
    message = locale === 'es'
      ? `Atención: ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} restantes`
      : `Atenção: ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} restantes`
  } else {
    message = locale === 'es'
      ? `En plazo: ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} restantes`
      : `No prazo: ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} restantes`
  }

  return { status, daysRemaining, message }
}

/**
 * Formats a date for display according to locale
 * @param date - ISO date string (YYYY-MM-DD)
 * @param locale - Language locale ('pt-BR' or 'es-ES')
 * @returns Formatted date string (DD/MM/YYYY)
 */
export function formatDeadlineDate(date: string, locale: string = 'pt-BR'): string {
  if (!date) return ''
  
  const dateObj = new Date(date + 'T00:00:00')
  
  return dateObj.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Checks if a deadline is approaching within a specified number of days
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @param days - Number of days threshold
 * @returns true if deadline is within the threshold
 */
export function isDeadlineApproaching(dueDate: string, days: number): boolean {
  const daysRemaining = getDaysUntilDeadline(dueDate)
  return daysRemaining >= 0 && daysRemaining <= days
}

/**
 * Derives the quarter (1-4) from a date
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns Quarter number (1, 2, 3, or 4)
 */
export function getQuarterFromDate(date: string): 1 | 2 | 3 | 4 {
  const dateObj = new Date(date + 'T00:00:00')
  const month = dateObj.getMonth() + 1 // 1-12
  
  if (month <= 3) return 1
  if (month <= 6) return 2
  if (month <= 9) return 3
  return 4
}

/**
 * Gets the last day of a quarter
 * @param quarter - Quarter number (1-4)
 * @param year - Year number
 * @returns ISO date string (YYYY-MM-DD) of the last day of the quarter
 */
export function getLastDayOfQuarter(quarter: 1 | 2 | 3 | 4, year: number): string {
  const lastDays: Record<number, string> = {
    1: `${year}-03-31`,
    2: `${year}-06-30`,
    3: `${year}-09-30`,
    4: `${year}-12-31`
  }
  
  return lastDays[quarter]
}

/**
 * Converts a Date object to ISO date string (YYYY-MM-DD)
 * @param date - Date object
 * @returns ISO date string
 */
export function toISODateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Gets today's date as ISO string (YYYY-MM-DD)
 * @returns ISO date string for today
 */
export function getTodayISO(): string {
  const today = new Date()
  return toISODateString(today)
}

/**
 * Checks if a date is in the past
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns true if the date is before today
 */
export function isPastDate(date: string): boolean {
  return getDaysUntilDeadline(date) < 0
}

/**
 * Checks if a date is today
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns true if the date is today
 */
export function isToday(date: string): boolean {
  return getDaysUntilDeadline(date) === 0
}

/**
 * Checks if a date is in the future
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns true if the date is after today
 */
export function isFutureDate(date: string): boolean {
  return getDaysUntilDeadline(date) > 0
}

/**
 * Validates a date string format (YYYY-MM-DD)
 * @param date - Date string to validate
 * @returns true if valid format
 */
export function isValidDateFormat(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(date)) return false
  
  const dateObj = new Date(date + 'T00:00:00')
  return !isNaN(dateObj.getTime())
}
