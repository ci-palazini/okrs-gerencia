import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart as LineChartIcon, Search, X } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import { AnnualKRTrackingCard } from '../../components/okr/AnnualKRTrackingCard'
import { useAnnualMonthlyTracking } from '../../hooks/useAnnualMonthlyTracking'
import type { CascadeKeyResult } from '../../hooks/useCascadeOKRData'

function getOwners(kr: CascadeKeyResult): string[] {
    return kr.owner_names?.length
        ? kr.owner_names
        : kr.owner_name ? [kr.owner_name] : []
}

export function MonthlyTrackingPage() {
    const { t } = useTranslation()
    const {
        loading,
        selectedUnitData,
        pillars,
        objectives,
        annualKRs,
        getMonthlyEntry,
        upsertMonthly,
        updateValue,
    } = useAnnualMonthlyTracking()

    const [search, setSearch] = useState('')
    const [selectedPillars, setSelectedPillars] = useState<Set<string>>(new Set())
    const [selectedObjectives, setSelectedObjectives] = useState<Set<string>>(new Set())
    const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set())

    const ownerOptions = useMemo(() => {
        const unique = new Set<string>()
        annualKRs.forEach((kr) => getOwners(kr).forEach((owner) => unique.add(owner)))
        return Array.from(unique)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'))
            .map((owner) => ({ value: owner, label: owner }))
    }, [annualKRs])

    const pillarOptions = useMemo(() => (
        pillars.map((pillar) => ({ value: pillar.id, label: pillar.name, color: pillar.color }))
    ), [pillars])

    const objectiveOptions = useMemo(() => (
        objectives
            .filter((objective) => selectedPillars.size === 0 || selectedPillars.has(objective.pillar_id))
            .map((objective) => ({ value: objective.id, label: `${objective.code} · ${objective.title}` }))
    ), [objectives, selectedPillars])

    const groups = useMemo(() => {
        const normalized = search.trim().toLowerCase()
        return objectives
            .filter((objective) => selectedPillars.size === 0 || selectedPillars.has(objective.pillar_id))
            .filter((objective) => selectedObjectives.size === 0 || selectedObjectives.has(objective.id))
            .map((objective) => {
                const krs = annualKRs
                    .filter((kr) => kr.objective_id === objective.id)
                    .filter((kr) => {
                        if (!normalized) return true
                        return (
                            kr.code.toLowerCase().includes(normalized)
                            || kr.title.toLowerCase().includes(normalized)
                            || objective.code.toLowerCase().includes(normalized)
                            || objective.title.toLowerCase().includes(normalized)
                        )
                    })
                    .filter((kr) => {
                        if (selectedOwners.size === 0) return true
                        return getOwners(kr).some((owner) => selectedOwners.has(owner))
                    })
                return { objective, krs }
            })
            .filter((group) => group.krs.length > 0)
    }, [objectives, annualKRs, search, selectedPillars, selectedObjectives, selectedOwners])

    const totalKRs = useMemo(
        () => groups.reduce((acc, group) => acc + group.krs.length, 0),
        [groups]
    )

    const hasActiveFilters = search.trim() !== '' || selectedPillars.size > 0 || selectedObjectives.size > 0 || selectedOwners.size > 0

    function togglePillar(value: string) {
        const nextPillars = new Set(selectedPillars)
        if (nextPillars.has(value)) nextPillars.delete(value)
        else nextPillars.add(value)
        setSelectedPillars(nextPillars)

        // Drop objective selections that no longer belong to the active pillars
        setSelectedObjectives((prev) => {
            if (prev.size === 0 || nextPillars.size === 0) return prev
            const next = new Set(prev)
            objectives.forEach((objective) => {
                if (next.has(objective.id) && !nextPillars.has(objective.pillar_id)) {
                    next.delete(objective.id)
                }
            })
            return next.size === prev.size ? prev : next
        })
    }

    function toggleObjective(value: string) {
        setSelectedObjectives((prev) => {
            const next = new Set(prev)
            if (next.has(value)) next.delete(value)
            else next.add(value)
            return next
        })
    }

    function toggleOwner(value: string) {
        setSelectedOwners((prev) => {
            const next = new Set(prev)
            if (next.has(value)) next.delete(value)
            else next.add(value)
            return next
        })
    }

    function clearFilters() {
        setSearch('')
        setSelectedPillars(new Set())
        setSelectedObjectives(new Set())
        setSelectedOwners(new Set())
    }

    if (loading && annualKRs.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[360px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-text-secondary)]">{t('monthlyTracking.loading')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            <LineChartIcon className="w-6 h-6 text-[var(--color-primary)]" />
                            {t('monthlyTracking.title')}
                        </h1>
                        <p className="text-[var(--color-text-secondary)] mt-1">
                            {selectedUnitData?.name && (
                                <span className="font-medium">{selectedUnitData.name} · </span>
                            )}
                            {t('monthlyTracking.subtitle')}
                        </p>
                    </div>

                    <Badge variant="info" className="whitespace-nowrap flex-shrink-0">
                        {t('monthlyTracking.totalKRs', { count: totalKRs })}
                    </Badge>
                </div>

                {/* Filter bar */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('monthlyTracking.searchPlaceholder')}
                        icon={<Search className="w-4 h-4" />}
                        className="h-9 sm:w-44 lg:w-56 sm:flex-shrink-0"
                    />
                    <div className="flex flex-1 items-center gap-2">
                        {pillarOptions.length > 0 && (
                            <MultiSelectDropdown
                                options={pillarOptions}
                                selected={selectedPillars}
                                onToggle={togglePillar}
                                placeholder={t('monthlyTracking.filterPillar')}
                                className="flex-1"
                                fullWidth
                            />
                        )}
                        {objectiveOptions.length > 0 && (
                            <MultiSelectDropdown
                                options={objectiveOptions}
                                selected={selectedObjectives}
                                onToggle={toggleObjective}
                                placeholder={t('monthlyTracking.filterObjective')}
                                searchable
                                className="flex-1"
                                fullWidth
                            />
                        )}
                        {ownerOptions.length > 0 && (
                            <MultiSelectDropdown
                                options={ownerOptions}
                                selected={selectedOwners}
                                onToggle={toggleOwner}
                                placeholder={t('monthlyTracking.filterOwner')}
                                searchable
                                align="right"
                                className="flex-1"
                                fullWidth
                            />
                        )}
                        <button
                            type="button"
                            onClick={clearFilters}
                            disabled={!hasActiveFilters}
                            title={t('monthlyTracking.clearFilters')}
                            aria-label={t('monthlyTracking.clearFilters')}
                            className="inline-flex flex-shrink-0 items-center justify-center h-9 w-9 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-all enabled:hover:border-[var(--color-primary)] enabled:hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {groups.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-10 text-center">
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {t('monthlyTracking.emptyTitle')}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                        {hasActiveFilters ? t('monthlyTracking.emptySearch') : t('monthlyTracking.emptyDescription')}
                    </p>
                </div>
            ) : (
                groups.map((group) => (
                    <section key={group.objective.id} className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" size="sm" className="font-mono">{group.objective.code}</Badge>
                            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                                {group.objective.title}
                            </h2>
                        </div>
                        <div className="flex flex-col gap-4">
                            {group.krs.map((kr) => (
                                <AnnualKRTrackingCard
                                    key={kr.id}
                                    kr={kr}
                                    objective={group.objective}
                                    getMonthlyEntry={getMonthlyEntry}
                                    onSaveMonthly={upsertMonthly}
                                    onUpdateValue={updateValue}
                                />
                            ))}
                        </div>
                    </section>
                ))
            )}
        </div>
    )
}
