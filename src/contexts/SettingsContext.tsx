import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface SettingsContextType {
    sidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    theme: 'light' | 'dark'
    toggleTheme: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
    // Initialize from localStorage or default
    const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed')
        return saved ? JSON.parse(saved) : false
    })

    const [theme, setThemeState] = useState<'light' | 'dark'>('light') // Default to light for now as per recent changes

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed))
    }, [sidebarCollapsed])

    function toggleSidebar() {
        setSidebarCollapsedState((prev: boolean) => !prev)
    }

    function setSidebarCollapsed(collapsed: boolean) {
        setSidebarCollapsedState(collapsed)
    }

    function toggleTheme() {
        setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
        // Implementation of actual theme switching would go here (e.g. adding class to body)
        // For now we just track the state preference
    }

    return (
        <SettingsContext.Provider
            value={{
                sidebarCollapsed,
                toggleSidebar,
                setSidebarCollapsed,
                theme,
                toggleTheme
            }}
        >
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
