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
            let query = supabase
                .from('business_units')
                .select('*')
                .eq('is_active', true)
                .neq('code', 'GSC')
                .order('order_index')

            // Non-admin users can only see their assigned business units
            if (user?.role !== 'admin') {
                const allowedIds = (user?.user_business_units || []).map(ubu => ubu.business_unit_id)
                if (allowedIds.length > 0) {
                    query = query.in('id', allowedIds)
                } else {
                    // User has no assigned units — show nothing
                    setUnits([])
                    setSelectedUnit('')
                    setIsLoading(false)
                    return
                }
            }

            const { data: unitsData } = await query

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
