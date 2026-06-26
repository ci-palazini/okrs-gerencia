import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

interface MultiSelectDropdownProps {
    options: { value: string; label: string; color?: string }[]
    selected: Set<string>
    onToggle: (value: string) => void
    placeholder: string
    className?: string
    searchable?: boolean
    align?: 'left' | 'right'
    fullWidth?: boolean
}

export function MultiSelectDropdown({ options, selected, onToggle, placeholder, className, searchable, align = 'left', fullWidth }: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    useEffect(() => {
        if (open) {
            setTimeout(() => searchRef.current?.focus(), 0)
        }
    }, [open])

    const selectedCount = selected.size
    const visibleOptions = searchable && search.trim()
        ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
        : options

    return (
        <div ref={ref} className={cn('relative', className)}>
            <button
                type="button"
                onClick={() => {
                    if (!open) setSearch('')
                    setOpen((v) => !v)
                }}
                className={cn(
                    'h-9 flex items-center justify-between gap-2 px-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] text-xs transition-all duration-200',
                    fullWidth ? 'w-full min-w-0' : 'min-w-[140px]',
                    selectedCount > 0
                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'
                )}
            >
                <span className="truncate">
                    {selectedCount > 0 ? `${selectedCount} selecionado${selectedCount > 1 ? 's' : ''}` : placeholder}
                </span>
                <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
            </button>
            {open && (
                <div className={cn(
                    'absolute top-full mt-1 z-20 w-full min-w-[180px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg flex flex-col',
                    align === 'right' ? 'right-0' : 'left-0'
                )}>
                    {searchable && (
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
                            <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
                            <input
                                ref={searchRef}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="flex-1 bg-transparent text-xs outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                            />
                        </div>
                    )}
                    <div className="max-h-52 overflow-y-auto">
                        {visibleOptions.length === 0 && (
                            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Nenhum resultado</p>
                        )}
                        {visibleOptions.map((opt) => {
                            const isSelected = selected.has(opt.value)
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => onToggle(opt.value)}
                                    className="w-full flex items-start gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                                >
                                    <div className={cn(
                                        'mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                                        isSelected
                                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                                            : 'border-[var(--color-border)]'
                                    )}>
                                        {isSelected && (
                                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                    {opt.color && (
                                        <div className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                                    )}
                                    <span className={cn(
                                        'min-w-0 break-words',
                                        isSelected ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-primary)]'
                                    )}>
                                        {opt.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
