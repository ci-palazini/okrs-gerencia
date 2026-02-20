import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as LucideIcons from 'lucide-react'
import { Plus, Pencil, Trash2, X, Check, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface Pillar {
    id: string
    code: string
    name: string
    description: string
    icon: string
    color: string
    order_index: number
    business_unit_ids: string[]
    is_active: boolean
}

interface PillarBusinessUnit {
    pillar_id: string
    business_unit_id: string
}

interface BusinessUnit {
    id: string
    code: string
    name: string
}

// Helper to render icon by name
function DynamicIcon({ name, className }: { name: string, className?: string }) {
    // Convert kebab-case (target) to PascalCase (Target)
    const iconName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('') as keyof typeof LucideIcons
    const IconComponent = LucideIcons[iconName] as React.ElementType

    if (!IconComponent) return <div className={className} /> // Fallback placeholder
    return <IconComponent className={className} />
}

export function PillarsTab() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [pillars, setPillars] = useState<Pillar[]>([])
    const [units, setUnits] = useState<BusinessUnit[]>([])

    // Edit/Create State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<Pillar>>({})
    const [saving, setSaving] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const [pillarsRes, unitsRes, pivotRes] = await Promise.all([
                supabase.from('pillars').select('*').order('order_index'),
                supabase.from('business_units').select('*').eq('is_active', true),
                supabase.from('pillar_business_units').select('*')
            ])

            if (pillarsRes.data && pivotRes.data) {
                // Map pivot table to pillars
                const pillarsWithUnits = pillarsRes.data.map(p => ({
                    ...p,
                    business_unit_ids: pivotRes.data
                        .filter((r: any) => r.pillar_id === p.id)
                        .map((r: any) => r.business_unit_id)
                }))
                setPillars(pillarsWithUnits)
            }
            if (unitsRes.data) setUnits(unitsRes.data)
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    function handleEdit(pillar: Pillar) {
        setEditingId(pillar.id)
        setEditForm(pillar)
        setIsCreating(false)
    }

    async function handleCreate() {
        // Get next order_index from database (MAX + 1)
        const { data } = await supabase
            .from('pillars')
            .select('order_index')
            .order('order_index', { ascending: false })
            .limit(1)

        const nextOrderIndex = (data?.[0]?.order_index || 0) + 1

        const newPillar: Partial<Pillar> = {
            code: '',
            name: '',
            description: '',
            icon: 'circle',
            color: '#3b82f6',
            order_index: nextOrderIndex,
            business_unit_ids: [],
            is_active: true
        }
        setEditingId('new')
        setEditForm(newPillar)
        setIsCreating(true)
    }

    function handleCancel() {
        setEditingId(null)
        setEditForm({})
        setIsCreating(false)
    }

    async function handleSave() {
        if (!editForm.code || !editForm.name) return // Basic validation

        setSaving(true)
        try {
            const dataToSave = {
                code: editForm.code.toUpperCase(),
                name: editForm.name,
                description: editForm.description,
                icon: editForm.icon,
                color: editForm.color,
                order_index: editForm.order_index,
                is_active: editForm.is_active
            }

            let savedPillarId = editingId

            if (isCreating) {
                const { data, error } = await supabase
                    .from('pillars')
                    .insert(dataToSave)
                    .select()
                    .single()

                if (error) throw error
                if (data) {
                    savedPillarId = data.id
                }
            } else {
                const { error } = await supabase
                    .from('pillars')
                    .update(dataToSave)
                    .eq('id', editingId)

                if (error) throw error
            }

            // Update associations
            if (savedPillarId) {
                // Delete existing
                await supabase.from('pillar_business_units').delete().eq('pillar_id', savedPillarId)

                // Insert new (if any)
                if (editForm.business_unit_ids && editForm.business_unit_ids.length > 0) {
                    const associations = editForm.business_unit_ids.map(uid => ({
                        pillar_id: savedPillarId,
                        business_unit_id: uid
                    }))
                    const { error: assocError } = await supabase.from('pillar_business_units').insert(associations)
                    if (assocError) throw assocError
                }

                // Reload data to reflect changes
                await loadData()
            }

            setEditingId(null)
            setIsCreating(false)
        } catch (error) {
            console.error('Error saving pillar:', error)
            alert(t('settings.page.pillars.form.createError'))
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm(t('settings.page.pillars.delete.confirm'))) return

        try {
            const { error } = await supabase
                .from('pillars')
                .delete()
                .eq('id', id)

            if (error) throw error

            setPillars(pillars.filter(p => p.id !== id))
        } catch (error) {
            console.error('Error deleting pillar:', error)
            alert(t('settings.page.pillars.delete.error'))
        }
    }

    return (
        <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>{t('settings.page.pillars.management.title')}</CardTitle>
                    <CardDescription>{t('settings.page.pillars.management.description')}</CardDescription>
                </div>
                <Button onClick={handleCreate} disabled={editingId !== null}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('settings.page.pillars.management.newPillar')}
                </Button>
            </CardHeader>
            <CardContent>
                {/* Editor Form */}
                {editingId && (
                    <div className="mb-8 p-6 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-primary)]/20 animate-in slide-in-from-top-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {isCreating ? t('settings.page.pillars.form.titleNew') : t('settings.page.pillars.form.titleEdit')}
                            </h3>
                            <button onClick={handleCancel} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label={t('settings.page.pillars.form.name')}
                                value={editForm.name || ''}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder={t('settings.page.pillars.form.namePlaceholder')}
                            />
                            <Input
                                label={t('settings.page.pillars.form.code')}
                                value={editForm.code || ''}
                                onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                                placeholder={t('settings.page.pillars.form.codePlaceholder')}
                                disabled={!isCreating} // Usually code shouldn't change to avoid breaking refs, but maybe ok.
                            />
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                                    {t('settings.page.pillars.form.color')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={editForm.color || '#000000'}
                                        onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                                        className="h-10 w-12 rounded cursor-pointer"
                                    />
                                    <Input
                                        value={editForm.color || ''}
                                        onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                                        placeholder="#000000"
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            {/* Icon Picker */}
                            <div className="col-span-1 md:col-span-2 space-y-3">
                                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                                    {t('settings.page.pillars.form.icon')}
                                </label>
                                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] max-h-[200px] overflow-y-auto">
                                    {[
                                        'target', 'users', 'trending-up', 'dollar-sign', 'shield-check', 'cog',
                                        'database', 'activity', 'award', 'bar-chart', 'briefcase', 'calendar',
                                        'check-circle', 'clipboard', 'clock', 'cloud', 'code', 'cpu',
                                        'credit-card', 'flag', 'globe', 'heart', 'home', 'image', 'key',
                                        'layers', 'layout', 'lightbulb', 'link', 'list', 'lock', 'map',
                                        'message-circle', 'moon', 'music', 'package', 'pie-chart', 'play',
                                        'power', 'printer', 'search', 'send', 'server', 'settings', 'share',
                                        'shopping-bag', 'shopping-cart', 'smartphone', 'smile', 'star',
                                        'sun', 'table', 'tag', 'thumbs-up', 'tool', 'trash', 'truck',
                                        'umbrella', 'unlock', 'user', 'user-plus', 'video', 'voicemail',
                                        'wifi', 'zap'
                                    ].map(iconName => (
                                        <button
                                            key={iconName}
                                            onClick={() => setEditForm({ ...editForm, icon: iconName })}
                                            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${editForm.icon === iconName
                                                ? 'bg-[var(--color-primary)] text-white shadow-md scale-110'
                                                : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                                                }`}
                                            title={iconName}
                                        >
                                            {/* We need a dynamic icon renderer here. 
                                                Since we can't easily dynamic import in this context without 
                                                loading all icons, and we want to keep it simple, 
                                                we will use a class mismatch or a helper if available. 
                                                But for now, to make "preview" work, we might need to import these.
                                                However, standard Lucide usage in this codebase seems to be explicit imports.
                                                
                                                Wait, the user wants a PREVIEW. 
                                                If I just put the name, it's not a preview.
                                                
                                                I need to import 'Icon' from lucide-react or create a map.
                                                For this user request to be "wowed", I should import the icons I listed.
                                             */}
                                            <DynamicIcon name={iconName} className="w-5 h-5" />
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {t('settings.page.pillars.form.iconSelected')} <span className="font-mono text-[var(--color-text-primary)]">{editForm.icon || t('settings.page.pillars.form.none')}</span>
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                                    {t('settings.page.pillars.form.unit')}
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                                    {units.map(u => {
                                        const isSelected = editForm.business_unit_ids?.includes(u.id)
                                        return (
                                            <label key={u.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-[var(--color-surface-hover)] rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={e => {
                                                        const current = editForm.business_unit_ids || []
                                                        if (e.target.checked) {
                                                            setEditForm({ ...editForm, business_unit_ids: [...current, u.id] })
                                                        } else {
                                                            setEditForm({ ...editForm, business_unit_ids: current.filter(id => id !== u.id) })
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                                />
                                                <span className="text-sm text-[var(--color-text-primary)]">{u.name} ({u.code})</span>
                                            </label>
                                        )
                                    })}
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {editForm.business_unit_ids?.length === units.length
                                        ? t('settings.page.pillars.list.global')
                                        : t('settings.page.pillars.form.selectedCount', { count: editForm.business_unit_ids?.length || 0 })}
                                </p>
                            </div>

                            <Input
                                label={t('settings.page.pillars.form.order')}
                                type="number"
                                value={editForm.order_index || 0}
                                onChange={e => setEditForm({ ...editForm, order_index: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="mt-4">
                            <Input
                                label={t('settings.page.pillars.form.description')}
                                value={editForm.description || ''}
                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder={t('settings.page.pillars.form.descriptionPlaceholder')}
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="ghost" onClick={handleCancel}>{t('settings.page.pillars.form.cancel')}</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                {t('settings.page.pillars.form.save')}
                            </Button>
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                        <div className="col-span-1">{t('settings.page.pillars.list.order')}</div>
                        <div className="col-span-1">{t('settings.page.pillars.list.color')}</div>
                        <div className="col-span-3">{t('settings.page.pillars.list.nameCode')}</div>
                        <div className="col-span-3">{t('settings.page.pillars.list.unit')}</div>
                        <div className="col-span-2">{t('settings.page.pillars.list.status')}</div>
                        <div className="col-span-2 text-right">{t('settings.page.pillars.list.actions')}</div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                        </div>
                    ) : (
                        pillars.map(pillar => (
                            <div
                                key={pillar.id}
                                className={`grid grid-cols-12 gap-4 items-center p-3 rounded-lg border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors ${!pillar.is_active ? 'opacity-50' : ''}`}
                            >
                                <div className="col-span-1 font-mono text-sm">{pillar.order_index}</div>
                                <div className="col-span-1">
                                    <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: pillar.color }} />
                                </div>
                                <div className="col-span-3">
                                    <p className="font-semibold text-[var(--color-text-primary)]">{pillar.name}</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">{pillar.code}</p>
                                </div>
                                <div className="col-span-3">
                                    {pillar.business_unit_ids && pillar.business_unit_ids.length > 0 ? (
                                        pillar.business_unit_ids.length === units.length ? (
                                            <Badge variant="success">{t('settings.page.pillars.list.global')}</Badge>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {pillar.business_unit_ids.map(uid => (
                                                    <Badge key={uid} variant="outline" size="sm">
                                                        {units.find(u => u.id === uid)?.code || '???'}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )
                                    ) : (
                                        <Badge variant="warning">{t('settings.page.pillars.form.none')}</Badge>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    {pillar.is_active ? (
                                        <span className="text-xs text-[var(--color-success)] flex items-center gap-1">
                                            <Check className="w-3 h-3" /> {t('settings.page.pillars.list.active')}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-[var(--color-text-muted)]">{t('settings.page.pillars.list.inactive')}</span>
                                    )}
                                </div>
                                <div className="col-span-2 flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(pillar)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    {pillar.is_active && (
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(pillar.id)} className="text-[var(--color-danger)] hover:text-[var(--color-danger)]">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
