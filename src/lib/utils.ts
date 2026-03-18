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
 * Supported currency types for KRs
 */
export type CurrencyType = 'BRL' | 'USD' | 'ARS' | 'GBP'

export const CURRENCY_CONFIG: Record<CurrencyType, { symbol: string; locale: string; label: string }> = {
    BRL: { symbol: 'R$', locale: 'pt-BR', label: 'Real' },
    USD: { symbol: '$', locale: 'en-US', label: 'USD' },
    ARS: { symbol: '$', locale: 'es-AR', label: 'ARS' },
    GBP: { symbol: '£', locale: 'en-GB', label: 'GBP' },
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
 * Format a KR currency value using the stored currency_type
 */
export function formatKRCurrency(value: number, currencyType: string | null | undefined = 'BRL'): string {
    const key = (currencyType || 'BRL') as CurrencyType
    const config = CURRENCY_CONFIG[key] ?? CURRENCY_CONFIG['BRL']
    return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: key,
        maximumFractionDigits: 0,
    }).format(value)
}

/**
 * Get the currency symbol for a given currency_type
 */
export function getCurrencySymbol(currencyType: string | null | undefined = 'BRL'): string {
    const key = (currencyType || 'BRL') as CurrencyType
    return (CURRENCY_CONFIG[key] ?? CURRENCY_CONFIG['BRL']).symbol
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
export function calculateProgress(current: number, target: number): number {
    if (target === 0) return 0
    const progress = (current / target) * 100
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

/**
 * Generate next hierarchical code in the format PARENT.1, PARENT.2...
 * considering only direct children of the given parent code.
 */
export function getNextHierarchicalCode(parentCode: string, siblingCodes: string[]): string {
    const escapedParentCode = parentCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const directChildRegex = new RegExp(`^${escapedParentCode}\\.(\\d+)$`)
    const usedIndexes = new Set<number>()

    siblingCodes.forEach((code) => {
        const match = code.match(directChildRegex)
        if (!match) return

        const index = Number(match[1])
        if (Number.isInteger(index) && index > 0) {
            usedIndexes.add(index)
        }
    })

    let nextIndex = 1
    while (usedIndexes.has(nextIndex)) {
        nextIndex += 1
    }

    return `${parentCode}.${nextIndex}`
}

/**
 * Format username from email (get part before @)
 */
export function formatUsername(email: string | null | undefined): string {
    if (!email) return ''
    return email.split('@')[0]
}
