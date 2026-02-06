import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface BusinessUnit {
    id: string
    code: string
    name: string
}

interface BusinessUnitContextType {
    units: BusinessUnit[]
    selectedUnit: string
    selectedUnitData: BusinessUnit | null
    setSelectedUnit: (id: string) => void
    isLoading: boolean
}

const BusinessUnitContext = createContext<BusinessUnitContextType | undefined>(undefined)

export function BusinessUnitProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [units, setUnits] = useState<BusinessUnit[]>([])
    const [selectedUnit, setSelectedUnit] = useState<string>('')
    const [isLoading, setIsLoading] = useState(true)

    // Derived state for easier access to current unit object
    const selectedUnitData = units.find(u => u.id === selectedUnit) || null

    useEffect(() => {
        if (user) {
            loadUnits()
        } else {
            setUnits([])
            setSelectedUnit('')
        }
    }, [user])

    async function loadUnits() {
        setIsLoading(true)
        try {
            // Fetch all active units, excluding GSC if it should be hidden from selector?
            // The user wants a global selector. Usually "GSC" is a special unit.
            // In OKRsPage we excluded GSC.
            // If the user wants to switch between SXS, Hiter, etc., we should fetch valid "Plants".
            // We'll exclude 'GSC' from the generic selector if it's considered "Corporate Admin" view, 
            // but if the user wants to see "GSC" view, we include it.
            // Creating a "safe" list for now, similar to OKRsPage.

            const { data: unitsData } = await supabase
                .from('business_units')
                .select('*')
                .eq('is_active', true)
                .neq('code', 'GSC') // Exclude GSC from the plant selector
                .order('order_index')

            if (unitsData && unitsData.length > 0) {
                setUnits(unitsData)

                // Try to restore from localStorage
                const savedUnitId = localStorage.getItem('okr_selected_unit')
                if (savedUnitId && unitsData.find(u => u.id === savedUnitId)) {
                    setSelectedUnit(savedUnitId)
                } else {
                    setSelectedUnit(unitsData[0].id)
                }
            }
        } catch (error) {
            console.error('Error loading business units:', error)
        } finally {
            setIsLoading(false)
        }
    }

    function handleSetSelectedUnit(id: string) {
        setSelectedUnit(id)
        localStorage.setItem('okr_selected_unit', id)
    }

    return (
        <BusinessUnitContext.Provider value={{
            units,
            selectedUnit,
            selectedUnitData,
            setSelectedUnit: handleSetSelectedUnit,
            isLoading
        }}>
            {children}
        </BusinessUnitContext.Provider>
    )
}

export function useBusinessUnit() {
    const context = useContext(BusinessUnitContext)
    if (context === undefined) {
        throw new Error('useBusinessUnit must be used within a BusinessUnitProvider')
    }
    return context
}
