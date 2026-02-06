import { useState } from 'react'

export function useQuarter() {
    // Calculate default quarter based on current date
    const defaultQuarter = Math.floor(new Date().getMonth() / 3) + 1

    const [quarter, setQuarter] = useState(defaultQuarter)
    const year = 2026

    return {
        quarter,
        setQuarter,
        year
    }
}
