import { formatKRCurrency } from './utils'

export type TargetDirection = 'maximize' | 'minimize'

/**
 * Calculate a KR's progress percentage respecting target_direction and an optional baseline.
 *
 * Shared by useOKRData, useCascadeOKRData, MonthlyCockpitPanel and the monthly tracking page,
 * which all used to keep their own identical copy of this logic.
 *
 * - With a baseline: measures advance from the starting point towards the target.
 * - Without a baseline: falls back to a simple actual/target (or target/actual when minimizing).
 */
export function calculateKRProgress(
    target: number | null,
    actual: number | null,
    direction: TargetDirection = 'maximize',
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

export interface MetricFormatInput {
    metric_type: string
    unit: string | null
    currency_type?: string | null
}

/** Format a KR value based on its metric type (percentage / currency / number). */
export function formatMetricValue(kr: MetricFormatInput, value: number | null): string {
    if (value === null) return '-'
    if (kr.metric_type === 'currency') return formatKRCurrency(value, kr.currency_type)
    if (kr.metric_type === 'percentage') return `${value}%`
    return `${value}${kr.unit ? ` ${kr.unit}` : ''}`
}
