import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'

const ATTACHMENTS_BUCKET = 'anexos'
const STORAGE_PREFIX = 'action-plans'
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

interface AttachmentRow {
    id: string
    action_plan_id: string
    file_path: string
    file_name: string
    content_type: string | null
    file_size_bytes: number | null
    note: string | null
    created_at: string
    uploaded_by: string | null
}

interface AttachmentItem extends AttachmentRow {
    uploader_name: string | null
}

function sanitizeFileName(fileName: string): string {
    const normalized = fileName
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

    return normalized || 'arquivo'
}

function formatFileSize(value: number | null): string {
    if (value === null || Number.isNaN(value)) return '-'
    if (value < 1024) return `${value} B`

    const units = ['KB', 'MB', 'GB']
    let current = value / 1024
    let unitIndex = 0

    while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024
        unitIndex += 1
    }

    const decimals = current >= 10 ? 0 : 1
    return `${current.toFixed(decimals)} ${units[unitIndex]}`
}

interface ActionPlanAttachmentsProps {
    planId: string
}

export function ActionPlanAttachments({ planId }: ActionPlanAttachmentsProps) {
    const { t } = useTranslation()
    const { user } = useAuth()

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [attachments, setAttachments] = useState<AttachmentItem[]>([])
    const [showForm, setShowForm] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [note, setNote] = useState('')
    const [fileInputKey, setFileInputKey] = useState(0)

    const loadAttachments = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: loadError } = await supabase
                .from('action_plan_attachments')
                .select('id,action_plan_id,file_path,file_name,content_type,file_size_bytes,note,created_at,uploaded_by')
                .eq('action_plan_id', planId)
                .order('created_at', { ascending: false })

            if (loadError) throw loadError

            const rows = (data || []) as AttachmentRow[]
            const uploaderIds = Array.from(new Set(
                rows
                    .map((row) => row.uploaded_by)
                    .filter((uploadedBy): uploadedBy is string => Boolean(uploadedBy))
            ))

            const userNameById = new Map<string, string>()
            if (uploaderIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, full_name, email')
                    .in('id', uploaderIds)

                for (const profile of (usersData || []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
                    userNameById.set(profile.id, profile.full_name || profile.email || '')
                }
            }

            setAttachments(rows.map((row) => ({
                ...row,
                uploader_name: row.uploaded_by ? (userNameById.get(row.uploaded_by) || null) : null,
            })))
        } catch (loadError) {
            console.error('Error loading action plan attachments:', loadError)
            setAttachments([])
            setError(t('actionPlan.attachments.errors.loadFailed'))
        } finally {
            setLoading(false)
        }
    }, [planId, t])

    useEffect(() => {
        if (!planId) return
        void loadAttachments()
        setShowForm(false)
        setSelectedFile(null)
        setNote('')
        setError(null)
    }, [planId, loadAttachments])

    async function handleUpload() {
        if (!selectedFile) {
            setError(t('actionPlan.attachments.errors.fileRequired'))
            return
        }

        if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
            setError(t('actionPlan.attachments.errors.fileTooLarge', { maxMb: MAX_FILE_SIZE_MB }))
            return
        }

        setSaving(true)
        setError(null)

        const sanitizedName = sanitizeFileName(selectedFile.name)
        const filePath = `${STORAGE_PREFIX}/${planId}/${Date.now()}-${sanitizedName}`

        try {
            const { error: storageError } = await supabase
                .storage
                .from(ATTACHMENTS_BUCKET)
                .upload(filePath, selectedFile, {
                    upsert: false,
                    contentType: selectedFile.type || undefined,
                })

            if (storageError) throw storageError

            const { error: insertError } = await supabase
                .from('action_plan_attachments')
                .insert({
                    action_plan_id: planId,
                    file_path: filePath,
                    file_name: selectedFile.name,
                    content_type: selectedFile.type || null,
                    file_size_bytes: selectedFile.size,
                    note: note.trim() || null,
                    uploaded_by: user?.id || null,
                })

            if (insertError) {
                await supabase.storage.from(ATTACHMENTS_BUCKET).remove([filePath])
                throw insertError
            }

            setSelectedFile(null)
            setNote('')
            setShowForm(false)
            setFileInputKey((prev) => prev + 1)
            await loadAttachments()
        } catch (uploadError) {
            console.error('Error uploading action plan attachment:', uploadError)
            setError(t('actionPlan.attachments.errors.uploadFailed'))
        } finally {
            setSaving(false)
        }
    }

    async function handleDownload(item: AttachmentItem) {
        setError(null)

        try {
            const { data: fileBlob, error: fileDownloadError } = await supabase
                .storage
                .from(ATTACHMENTS_BUCKET)
                .download(item.file_path)

            if (fileDownloadError) throw fileDownloadError
            if (!fileBlob) throw new Error('Missing file blob')

            const downloadUrl = URL.createObjectURL(fileBlob)
            const anchor = document.createElement('a')
            anchor.href = downloadUrl
            anchor.download = item.file_name
            anchor.style.display = 'none'
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(downloadUrl)
        } catch (downloadError) {
            console.error('Error downloading action plan attachment:', downloadError)
            setError(t('actionPlan.attachments.errors.downloadFailed'))
        }
    }

    async function handleDelete(item: AttachmentItem) {
        const confirmed = window.confirm(t('actionPlan.attachments.deleteConfirm', { name: item.file_name }))
        if (!confirmed) return

        setDeletingId(item.id)
        setError(null)

        try {
            const { error: deleteError } = await supabase
                .from('action_plan_attachments')
                .delete()
                .eq('id', item.id)

            if (deleteError) throw deleteError

            const { error: storageError } = await supabase
                .storage
                .from(ATTACHMENTS_BUCKET)
                .remove([item.file_path])

            if (storageError) {
                console.error('Error cleaning up attachment file in storage:', storageError)
                setError(t('actionPlan.attachments.errors.storageCleanupFailed'))
            }

            await loadAttachments()
        } catch (deleteError) {
            console.error('Error deleting action plan attachment:', deleteError)
            setError(t('actionPlan.attachments.errors.deleteFailed'))
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="border-t border-[var(--color-border)]">
            <div className="px-6 py-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5" />
                        {t('actionPlan.attachments.title')}
                        {attachments.length > 0 && (
                            <span className="font-normal text-[var(--color-text-muted)] normal-case tracking-normal">
                                ({attachments.length})
                            </span>
                        )}
                    </h3>
                    {!showForm && (
                        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            {t('actionPlan.attachments.addFile')}
                        </Button>
                    )}
                </div>

                {/* Upload form */}
                {showForm && (
                    <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-hover)]/30 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                                        {t('actionPlan.attachments.fileLabel')}
                                    </label>
                                    <input
                                        key={fileInputKey}
                                        type="file"
                                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                                        className="block w-full text-sm text-[var(--color-text-primary)] file:mr-3 file:px-3 file:h-9 file:rounded-lg file:border file:border-[var(--color-border)] file:bg-[var(--color-surface)] file:text-[var(--color-text-primary)] hover:file:bg-[var(--color-surface-hover)]"
                                    />
                                    {selectedFile && (
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                                            {selectedFile.name} ({formatFileSize(selectedFile.size)})
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                                        {t('actionPlan.attachments.noteLabel')}
                                    </label>
                                    <textarea
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                        placeholder={t('actionPlan.attachments.notePlaceholder')}
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setSelectedFile(null); setNote(''); setFileInputKey((prev) => prev + 1) }}
                                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setShowForm(false); setSelectedFile(null); setNote(''); setFileInputKey((prev) => prev + 1) }}
                            >
                                {t('actionPlan.attachments.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void handleUpload()}
                                loading={saving}
                                disabled={saving || !selectedFile}
                            >
                                <Upload className="w-3.5 h-3.5 mr-1.5" />
                                {saving ? t('actionPlan.attachments.uploading') : t('actionPlan.attachments.upload')}
                            </Button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                        {error}
                    </div>
                )}

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : attachments.length === 0 ? (
                    !showForm && (
                        <p className="text-sm text-[var(--color-text-muted)] opacity-60">
                            {t('actionPlan.attachments.empty')}
                        </p>
                    )
                ) : (
                    <div className="space-y-2">
                        {attachments.map((item) => (
                            <div
                                key={item.id}
                                className="group/file flex items-start gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 hover:bg-[var(--color-surface-hover)]/50 transition-colors"
                            >
                                <div className="mt-0.5 w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--color-text-primary)] break-all">
                                        {item.file_name}
                                    </p>
                                    {item.note && (
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 break-words">
                                            {item.note}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--color-text-muted)]">
                                        <span>{formatFileSize(item.file_size_bytes)}</span>
                                        <span>·</span>
                                        <span>{formatDate(item.created_at)}</span>
                                        <span>·</span>
                                        <span>{item.uploader_name || t('actionPlan.attachments.unknownUploader')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity shrink-0">
                                    <button
                                        type="button"
                                        title={t('actionPlan.attachments.download')}
                                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
                                        onClick={() => void handleDownload(item)}
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        title={t('actionPlan.attachments.delete')}
                                        className={cn(
                                            'p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors',
                                            deletingId === item.id && 'opacity-50 pointer-events-none'
                                        )}
                                        onClick={() => void handleDelete(item)}
                                        disabled={deletingId === item.id}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
