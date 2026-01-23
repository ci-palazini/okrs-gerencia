import { cn } from '../../lib/utils'

interface BusinessUnit {
    id: string
    code: string
    name: string
}

interface UnitToggleProps {
    units: BusinessUnit[]
    selectedUnit: string
    onSelect: (unitId: string) => void
    className?: string
}

export function UnitToggle({ units, selectedUnit, onSelect, className }: UnitToggleProps) {
    return (
        <div className={cn(
            'inline-flex items-center p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]',
            className
        )}>
            {units.map((unit) => (
                <button
                    key={unit.id}
                    onClick={() => onSelect(unit.id)}
                    className={cn(
                        'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                        selectedUnit === unit.id
                            ? 'bg-[var(--color-primary)] text-white shadow-md'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                    )}
                >
                    {unit.name}
                </button>
            ))}
        </div>
    )
}
