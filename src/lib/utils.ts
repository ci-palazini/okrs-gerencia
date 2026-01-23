import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number, decimals = 0): string {
    return `${value.toFixed(decimals)}%`
}

/**
 * Format a number with locale
 */
export function formatNumber(value: number, locale = 'pt-BR'): string {
    return new Intl.NumberFormat(locale).format(value)
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency = 'BRL', locale = 'pt-BR'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
    }).format(value)
}

/**
 * Format a date
 */
export function formatDate(date: Date | string, locale = 'pt-BR'): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(d)
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, target: number, baseline = 0): number {
    if (target === baseline) return 0
    const progress = ((current - baseline) / (target - baseline)) * 100
    return Math.max(0, Math.min(100, progress))
}

/**
 * Get status color based on progress
 */
export function getStatusColor(progress: number): 'success' | 'warning' | 'danger' {
    if (progress >= 70) return 'success'
    if (progress >= 40) return 'warning'
    return 'danger'
}
