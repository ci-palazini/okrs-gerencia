/**
 * Pure recurrence logic for recurring action-plan tasks.
 * All dates are ISO strings (YYYY-MM-DD). No React/Supabase dependencies.
 *
 * Completion model: "log + next deadline". Each check writes one completion row
 * for the current period; the task then resets to the next computed occurrence.
 */

import { getTodayISO } from './dateUtils'

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

/** Subset of task fields describing its recurrence configuration. */
export interface RecurrenceConfig {
  is_recurring: boolean
  recurrence_type: RecurrenceType | null
  recurrence_interval: number | null
  recurrence_weekdays: number[] | null // 0=Sunday … 6=Saturday (Date.getDay convention)
  recurrence_day_of_month: number | null
  recurrence_start_date: string | null
  recurrence_end_date: string | null
}

// ── Low-level ISO date helpers (UTC-based, timezone-safe) ─────────────────────

function parseUTC(iso: string): number {
  return Date.parse(iso + 'T00:00:00Z')
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(parseUTC(iso) + days * 86400000)
  return d.toISOString().slice(0, 10)
}

function diffDaysISO(a: string, b: string): number {
  return Math.round((parseUTC(a) - parseUTC(b)) / 86400000)
}

function weekdayOf(iso: string): number {
  return new Date(parseUTC(iso)).getUTCDay()
}

function dayOfMonthOf(iso: string): number {
  return new Date(parseUTC(iso)).getUTCDate()
}

function daysInMonthOf(iso: string): number {
  const d = new Date(parseUTC(iso))
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

// ── Occurrence predicate ──────────────────────────────────────────────────────

const MAX_SCAN = 400 // safe upper bound: covers monthly (~31d) and yearly gaps

function isOccurrence(cfg: RecurrenceConfig, iso: string): boolean {
  if (!cfg.is_recurring || !cfg.recurrence_type) return false
  const start = cfg.recurrence_start_date
  if (start && iso < start) return false

  switch (cfg.recurrence_type) {
    case 'daily':
      return true
    case 'custom': {
      const interval = Math.max(1, cfg.recurrence_interval || 1)
      const base = start ?? iso
      return diffDaysISO(iso, base) % interval === 0
    }
    case 'weekly': {
      const days = cfg.recurrence_weekdays
      return Array.isArray(days) && days.length > 0 && days.includes(weekdayOf(iso))
    }
    case 'monthly': {
      const d = cfg.recurrence_day_of_month
      if (!d) return false
      return dayOfMonthOf(iso) === Math.min(d, daysInMonthOf(iso))
    }
    default:
      return false
  }
}

/** First occurrence date on or after `from` (bounded scan). */
function occurrenceOnOrAfter(cfg: RecurrenceConfig, from: string): string | null {
  const start = cfg.recurrence_start_date
  let cursor = start && from < start ? start : from
  for (let i = 0; i < MAX_SCAN; i++) {
    if (isOccurrence(cfg, cursor)) return cursor
    cursor = addDaysISO(cursor, 1)
  }
  return null
}

/** Latest occurrence date on or before `to` (bounded scan). */
function occurrenceOnOrBefore(cfg: RecurrenceConfig, to: string): string | null {
  const start = cfg.recurrence_start_date
  if (start && to < start) return null
  let cursor = to
  for (let i = 0; i < MAX_SCAN; i++) {
    if (start && cursor < start) return null
    if (isOccurrence(cfg, cursor)) return cursor
    cursor = addDaysISO(cursor, -1)
  }
  return null
}

function withinEnd(cfg: RecurrenceConfig, date: string | null): string | null {
  if (!date) return null
  if (cfg.recurrence_end_date && date > cfg.recurrence_end_date) return null
  return date
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * The occurrence date of the current open period — the one the user is expected
 * to complete now. Returns null if recurrence is inactive or has ended.
 */
export function getCurrentPeriodDate(
  cfg: RecurrenceConfig,
  today: string = getTodayISO()
): string | null {
  if (!cfg.is_recurring || !cfg.recurrence_type) return null
  const start = cfg.recurrence_start_date
  if (start && today < start) {
    return withinEnd(cfg, occurrenceOnOrAfter(cfg, start))
  }
  return withinEnd(cfg, occurrenceOnOrBefore(cfg, today))
}

/** The next occurrence strictly after `afterDate` (null if past end date). */
export function getNextOccurrence(
  cfg: RecurrenceConfig,
  afterDate: string
): string | null {
  if (!cfg.is_recurring || !cfg.recurrence_type) return null
  return withinEnd(cfg, occurrenceOnOrAfter(cfg, addDaysISO(afterDate, 1)))
}

export interface HasPeriod {
  period_date: string
}

/** Whether the current period has already been completed. */
export function isDoneForPeriod(
  cfg: RecurrenceConfig,
  completions: HasPeriod[],
  today: string = getTodayISO()
): boolean {
  const current = getCurrentPeriodDate(cfg, today)
  if (!current) return false
  return completions.some(c => c.period_date === current)
}

/**
 * Unifies recurring and non-recurring tasks into a single { dueDate, isDone }
 * shape that can be fed to getEffectiveDeadline and progress counters.
 */
export function getTaskEffectiveState(
  task: RecurrenceConfig & { due_date: string | null; is_done: boolean },
  completions: HasPeriod[],
  today: string = getTodayISO()
): { dueDate: string | null; isDone: boolean } {
  if (!task.is_recurring || !task.recurrence_type) {
    return { dueDate: task.due_date ?? null, isDone: task.is_done }
  }
  const current = getCurrentPeriodDate(task, today)
  if (!current) {
    // Recurrence ended: inactive — excluded from deadline, counts as done.
    return { dueDate: null, isDone: true }
  }
  const done = completions.some(c => c.period_date === current)
  if (done) {
    return { dueDate: getNextOccurrence(task, current), isDone: true }
  }
  return { dueDate: current, isDone: false }
}

/** Default weekday set (today's weekday) used when enabling weekly recurrence. */
export function defaultWeekdays(today: string = getTodayISO()): number[] {
  return [weekdayOf(today)]
}

/**
 * Human-readable recurrence label, e.g. "Diária", "Semanal · Seg, Qua",
 * "Dia 15 de cada mês", "A cada 3 dias". `t` is the i18next translator.
 */
export function describeRecurrence(
  cfg: RecurrenceConfig,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (!cfg.is_recurring || !cfg.recurrence_type) return ''
  switch (cfg.recurrence_type) {
    case 'daily':
      return t('recurringTask.freq.daily')
    case 'weekly': {
      const days = (cfg.recurrence_weekdays ?? []).slice().sort((a, b) => a - b)
      const labels = days.map(d => t(`recurringTask.weekdayShort.${d}`)).join(', ')
      return labels
        ? `${t('recurringTask.freq.weekly')} · ${labels}`
        : t('recurringTask.freq.weekly')
    }
    case 'monthly':
      return cfg.recurrence_day_of_month
        ? t('recurringTask.monthlyDay', { day: cfg.recurrence_day_of_month })
        : t('recurringTask.freq.monthly')
    case 'custom':
      return t('recurringTask.everyNDays', { count: Math.max(1, cfg.recurrence_interval || 1) })
    default:
      return ''
  }
}
