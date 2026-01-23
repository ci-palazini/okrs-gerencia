import { useEffect, useState } from 'react'
import { Lightbulb, Plus, Trash2, Pencil } from 'lucide-react' // Added Pencil
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { X } from 'lucide-react'

interface Idea {
    id: string
    user_id: string
    title: string
    description: string
    created_at: string
    user?: {
        full_name: string
        email: string
    }
}

// Pastel colors for the "post-its"
const CARD_COLORS = [
    'bg-[#d4e6c1]', // Pastel Green (similar to image)
    'bg-[#e6e6e6]', // Pastel Grey
    'bg-[#e6d0de]', // Pastel Purple
    'bg-[#fdf3a7]', // Pastel Yellow
    'bg-[#c8e6f5]', // Pastel Blue
    'bg-[#f5d0d0]', // Pastel Red
]

export function IdeasPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [ideas, setIdeas] = useState<Idea[]>([])
    const [modalOpen, setModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [editingIdea, setEditingIdea] = useState<Idea | null>(null) // New state for editing

    // Form
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')

    useEffect(() => {
        loadIdeas()
    }, [])

    useEffect(() => {
        if (!modalOpen) {
            setEditingIdea(null)
            setTitle('')
            setDescription('')
        }
    }, [modalOpen])

    async function loadIdeas() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('ideas')
                .select('*, user:users(full_name, email)')
                .order('created_at', { ascending: true }) // Changed to ascending (new at bottom)

            if (error) throw error
            setIdeas((data as unknown as Idea[]) || [])
        } catch (error) {
            console.error('Error loading ideas:', error)
        } finally {
            setLoading(false)
        }
    }

    function handleEdit(idea: Idea) {
        setEditingIdea(idea)
        setTitle(idea.title)
        setDescription(idea.description)
        setModalOpen(true)
    }

    async function handleSubmit() {
        if (!user || !title.trim()) return

        setSubmitting(true)
        try {
            if (editingIdea) {
                // Update existing idea
                const { error } = await supabase
                    .from('ideas')
                    .update({
                        title: title.trim(),
                        description: description.trim()
                    })
                    .eq('id', editingIdea.id)

                if (error) throw error
            } else {
                // Create new idea
                const { error } = await supabase
                    .from('ideas')
                    .insert({
                        title: title.trim(),
                        description: description.trim(),
                        user_id: user.id
                    })

                if (error) throw error
            }

            setModalOpen(false)
            loadIdeas()
        } catch (error) {
            console.error('Error saving idea:', error)
        } finally {
            setSubmitting(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir esta proposta?')) return

        try {
            const { error } = await supabase
                .from('ideas')
                .delete()
                .eq('id', id)

            if (error) throw error
            loadIdeas()
        } catch (error) {
            console.error('Error deleting idea:', error)
        }
    }

    function getUserColor(userId: string) {
        let hash = 0
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash)
        }
        const index = Math.abs(hash) % CARD_COLORS.length
        return CARD_COLORS[index]
    }

    // Group ideas by user
    const ideasByUser = ideas.reduce((acc, idea) => {
        const userId = idea.user_id
        if (!acc[userId]) {
            acc[userId] = {
                user: idea.user,
                ideas: []
            }
        }
        acc[userId].ideas.push(idea)
        return acc
    }, {} as Record<string, { user: Idea['user'], ideas: Idea[] }>)

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)]">
                            <Lightbulb className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Propostas da Equipe</h1>
                    </div>
                    <p className="text-[var(--color-text-secondary)] mt-1 max-w-2xl">
                        Acompanhe as propostas e iniciativas de melhoria de cada membro.
                    </p>
                </div>
                <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Nova Proposta
                </Button>
            </div>

            {/* Ideas grouped by User - Masonry Grid */}
            {Object.keys(ideasByUser).length > 0 ? (
                <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
                    {Object.entries(ideasByUser).map(([userId, { user: ideaUser, ideas: userIdeas }]) => {
                        const bgColor = getUserColor(userId)
                        return (
                            <div
                                key={userId}
                                className={`break-inside-avoid mb-6 w-full flex flex-col rounded-md shadow-md transition-transform hover:-translate-y-1 ${bgColor}`}
                            >
                                {/* Card Header */}
                                <div className="p-4 border-b border-black/5">
                                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                                        {ideaUser?.full_name || 'Usuário'}
                                    </h3>
                                    <span className="text-xs text-gray-600 font-medium">
                                        {ideaUser?.email?.split('@')[0]}
                                    </span>
                                </div>

                                {/* Card Body - List of Ideas */}
                                <div className="p-4 space-y-4">
                                    {userIdeas.map((idea, index) => {
                                        const isOwner = user?.id === idea.user_id
                                        return (
                                            <div key={idea.id} className="group relative">
                                                <div className="flex items-start gap-2">
                                                    <span className="font-bold text-gray-800 mt-0.5">
                                                        #{index + 1} -
                                                    </span>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-gray-800 inline leading-tight break-words">
                                                            {idea.title}
                                                        </h4>
                                                        {idea.description && (
                                                            <p className="text-sm text-gray-700 mt-1 whitespace-pre-line leading-relaxed break-words">
                                                                {idea.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Buttons (Only visible on hover if owner) */}
                                                {isOwner && (
                                                    <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleEdit(idea)
                                                            }}
                                                            className="p-1.5 rounded-full bg-white/50 text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                                                            title="Editar proposta"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDelete(idea.id)
                                                            }}
                                                            className="p-1.5 rounded-full bg-white/50 text-gray-600 hover:bg-white hover:text-red-600 hover:shadow-sm"
                                                            title="Excluir proposta"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-6">
                        <Lightbulb className="w-10 h-10 text-[var(--color-text-muted)] opacity-50" />
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                        Nenhuma proposta ainda
                    </h3>
                    <p className="text-[var(--color-text-muted)] max-w-md mb-8">
                        Clique em "Nova Proposta" para criar o primeiro cartão.
                    </p>
                    <Button variant="outline" onClick={() => setModalOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Adicionar Proposta
                    </Button>
                </div>
            )}

            {/* Edit/Create Idea Modal */}
            <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {editingIdea ? 'Editar Proposta' : 'Nova Proposta'}
                            </Dialog.Title>
                            <Dialog.Close asChild>
                                <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
                                    <X className="w-5 h-5" />
                                </button>
                            </Dialog.Close>
                        </div>

                        <div className="p-6 space-y-4">
                            <Input
                                label="Título da Proposta"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Melhoria no processo X..."
                                autoFocus
                            />

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    Descrição (Opcional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detalhes..."
                                    rows={5}
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
                            <Button variant="ghost" onClick={() => setModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button variant="primary" onClick={handleSubmit} loading={submitting}>
                                {editingIdea ? 'Salvar Alterações' : 'Criar Proposta'}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    )
}
