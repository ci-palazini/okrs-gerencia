/**
 * Validation functions for OKR deadline management
 * Used in forms and modals to ensure data integrity
 */

import { isValidDateFormat, getDaysUntilDeadline, getQuarterFromDate, getLastDayOfQuarter } from './dateUtils'

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates an objective due date
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @param locale - Language locale ('pt' or 'es')
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateObjectiveDueDate(
  dueDate: string,
  locale: string = 'pt'
): ValidationResult {
  // Check if date is provided
  if (!dueDate || dueDate.trim() === '') {
    return {
      valid: false,
      error: locale === 'es' ? 'Plazo obligatorio' : 'Prazo obrigatório'
    }
  }

  // Check date format
  if (!isValidDateFormat(dueDate)) {
    return {
      valid: false,
      error: locale === 'es' 
        ? 'Formato de fecha inválido. Use AAAA-MM-DD'
        : 'Formato de data inválido. Use AAAA-MM-DD'
    }
  }

  // Check if date is reasonable (not before 2020)
  const dateObj = new Date(dueDate + 'T00:00:00')
  const year = dateObj.getFullYear()
  
  if (year < 2020) {
    return {
      valid: false,
      error: locale === 'es'
        ? 'La fecha debe ser posterior a 2020'
        : 'A data deve ser posterior a 2020'
    }
  }

  // Allow past dates (objectives might have historical dates)
  // but warn if it's too far in the past (more than 2 years ago)
  const daysUntil = getDaysUntilDeadline(dueDate)
  if (daysUntil < -730) { // 2 years
    return {
      valid: false,
      error: locale === 'es'
        ? 'La fecha está muy lejos en el pasado'
        : 'A data está muito distante no passado'
    }
  }

  // Warn if date is too far in the future (more than 5 years)
  if (daysUntil > 1825) { // ~5 years
    return {
      valid: false,
      error: locale === 'es'
        ? 'La fecha está muy lejos en el futuro'
        : 'A data está muito distante no futuro'
    }
  }

  return { valid: true }
}

/**
 * Validates a key result due date against its parent objective
 * @param krDueDate - KR due date ISO string (YYYY-MM-DD)
 * @param objectiveDueDate - Parent objective due date ISO string (YYYY-MM-DD)
 * @param locale - Language locale ('pt' or 'es')
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateKRDueDate(
  krDueDate: string,
  objectiveDueDate: string,
  locale: string = 'pt'
): ValidationResult {
  // First validate the KR date itself
  const basicValidation = validateObjectiveDueDate(krDueDate, locale)
  if (!basicValidation.valid) {
    return basicValidation
  }

  // If no objective due date, we can't validate hierarchy
  if (!objectiveDueDate || objectiveDueDate.trim() === '') {
    return { valid: true }
  }

  // Validate that KR due date doesn't exceed objective due date
  const krDate = new Date(krDueDate + 'T00:00:00')
  const objDate = new Date(objectiveDueDate + 'T00:00:00')

  if (krDate > objDate) {
    return {
      valid: false,
      error: locale === 'es'
        ? 'El plazo del Key Result no puede superar el plazo del Objetivo'
        : 'O prazo do Key Result não pode ultrapassar o prazo do Objetivo'
    }
  }

  return { valid: true }
}

/**
 * Validates a quarterly KR due date is within the correct quarter
 * @param krDueDate - KR due date ISO string (YYYY-MM-DD)
 * @param quarter - Quarter number (1-4)
 * @param year - Year number
 * @param locale - Language locale ('pt' or 'es')
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateQuarterlyKRDate(
  krDueDate: string,
  quarter: number,
  year: number,
  locale: string = 'pt'
): ValidationResult {
  // First validate the basic date
  const basicValidation = validateObjectiveDueDate(krDueDate, locale)
  if (!basicValidation.valid) {
    return basicValidation
  }

  // Check if quarter is valid
  if (quarter < 1 || quarter > 4) {
    return {
      valid: false,
      error: locale === 'es'
        ? 'Trimestre inválido. Debe ser entre 1 y 4'
        : 'Quarter inválido. Deve ser entre 1 e 4'
    }
  }

  // Get the actual quarter from the date
  const actualQuarter = getQuarterFromDate(krDueDate)
  const dateYear = new Date(krDueDate + 'T00:00:00').getFullYear()

  // Check if the date is in the correct year
  if (dateYear !== year) {
    return {
      valid: false,
      error: locale === 'es'
        ? `La fecha debe estar en el año ${year}`
        : `A data deve estar no ano ${year}`
    }
  }

  // Check if the date is in the correct quarter
  if (actualQuarter !== quarter) {
    const quarterNames = {
      pt: ['Q1 (Jan-Mar)', 'Q2 (Abr-Jun)', 'Q3 (Jul-Set)', 'Q4 (Out-Dez)'],
      es: ['Q1 (Ene-Mar)', 'Q2 (Abr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dic)']
    }
    const lang = locale === 'es' ? 'es' : 'pt'
    
    return {
      valid: false,
      error: locale === 'es'
        ? `La fecha debe estar en ${quarterNames[lang][quarter - 1]}`
        : `A data deve estar em ${quarterNames[lang][quarter - 1]}`
    }
  }

  return { valid: true }
}

/**
 * Suggests an optimal due date for a quarterly KR
 * Returns the last day of the quarter
 * @param quarter - Quarter number (1-4)
 * @param year - Year number
 * @returns ISO date string (YYYY-MM-DD)
 */
export function suggestQuarterlyKRDueDate(quarter: 1 | 2 | 3 | 4, year: number): string {
  return getLastDayOfQuarter(quarter, year)
}

/**
 * Validates multiple KR due dates against an objective
 * Useful for cascade operations
 * @param krDueDates - Array of KR due dates
 * @param objectiveDueDate - Parent objective due date
 * @param locale - Language locale ('pt' or 'es')
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateMultipleKRDueDates(
  krDueDates: string[],
  objectiveDueDate: string,
  locale: string = 'pt'
): ValidationResult {
  for (let i = 0; i < krDueDates.length; i++) {
    const validation = validateKRDueDate(krDueDates[i], objectiveDueDate, locale)
    if (!validation.valid) {
      return {
        valid: false,
        error: locale === 'es'
          ? `Key Result ${i + 1}: ${validation.error}`
          : `Key Result ${i + 1}: ${validation.error}`
      }
    }
  }
  
  return { valid: true }
}

/**
 * Checks if a date change would cause validation issues with child KRs
 * Used when updating an objective's due date
 * @param newObjectiveDueDate - New objective due date
 * @param childKRDueDates - Array of child KR due dates
 * @param locale - Language locale ('pt' or 'es')
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateObjectiveDateChange(
  newObjectiveDueDate: string,
  childKRDueDates: string[],
  locale: string = 'pt'
): ValidationResult {
  const newObjDate = new Date(newObjectiveDueDate + 'T00:00:00')
  
  for (let i = 0; i < childKRDueDates.length; i++) {
    const krDate = new Date(childKRDueDates[i] + 'T00:00:00')
    
    if (krDate > newObjDate) {
      return {
        valid: false,
        error: locale === 'es'
          ? `No se puede establecer esta fecha porque algunos Key Results tienen plazos posteriores`
          : `Não é possível definir esta data porque alguns Key Results têm prazos posteriores`
      }
    }
  }
  
  return { valid: true }
}
