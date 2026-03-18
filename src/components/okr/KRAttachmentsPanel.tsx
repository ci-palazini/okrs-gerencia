import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { Download, FileText, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'

const ATTACHMENTS_BUCKET = 'anexos'
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

interface KRAttachmentRow {
    id: string
    key_result_id: string
    file_path: string
    file_name: string
    content_type: string | null
    file_size_bytes: number | null
    note: string | null
    created_at: string
    uploaded_by: string | null
}

interface KRAttachmentItem extends KRAttachmentRow {
    uploader_name: string | null
}

interface KRAttachmentsModalProps {
    krId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

function isSchemaMissingError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const code = 'code' in error ? String((error as { code?: unknown }).code || '') : ''
    const message = 'message' in error ? String((error as { message?: unknown }).message || '') : ''

    return (
        code === '42P01'
        || code === 'PGRST205'
        || message.includes('kr_attachments')
    )
}

function sanitizeFileName(fileName: string): string {
    const normalized = fileName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
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

export function KRAttachmentsModal({ krId, open, onOpenChange }: KRAttachmentsModalProps) {
    const { t } = useTranslation()
    const { user } = useAuth()

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [attachments, setAttachments] = useState<KRAttachmentItem[]>([])
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [note, setNote] = useState('')
    const [fileInputKey, setFileInputKey] = useState(0)

    const loadAttachments = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: loadError } = await supabase
                .from('kr_attachments')
                .select('id,key_result_id,file_path,file_name,content_type,file_size_bytes,note,created_at,uploaded_by')
                .eq('key_result_id', krId)
                .order('created_at', { ascending: false })

            if (loadError) throw loadError

            const rows = (data || []) as KRAttachmentRow[]
            const uploaderIds = Array.from(new Set(
                rows
                    .map((row) => row.uploaded_by)
                    .filter((uploadedBy): uploadedBy is string => Boolean(uploadedBy))
            ))

            const userNameById = new Map<string, string>()
            if (uploaderIds.length > 0) {
                const { data: usersData, error: usersError } = await supabase
                    .from('users')
                    .select('id, full_name, email')
                    .in('id', uploaderIds)

                if (usersError) throw usersError

                for (const profile of (usersData || []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
                    userNameById.set(profile.id, profile.full_name || profile.email || '')
                }
            }

            setAttachments(rows.map((row) => ({
                ...row,
                uploader_name: row.uploaded_by ? (userNameById.get(row.uploaded_by) || null) : null,
            })))
        } catch (loadError) {
            console.error('Error loading KR attachments:', loadError)
            setAttachments([])

            if (isSchemaMissingError(loadError)) {
                setError(t('okr.fileCenter.errors.schemaMissing'))
            } else {
                setError(t('okr.fileCenter.errors.loadFailed'))
            }
        } finally {
            setLoading(false)
        }
    }, [krId, t])

    useEffect(() => {
        if (!open || !krId) return
        void loadAttachments()
    }, [open, krId, loadAttachments])

    useEffect(() => {
        if (open) return
        setError(null)
        setSelectedFile(null)
        setNote('')
        setDeletingId(null)
        setFileInputKey((prev) => prev + 1)
    }, [open])

    async function handleUpload() {
        if (!selectedFile) {
            setError(t('okr.fileCenter.errors.fileRequired'))
            return
        }

        if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
            setError(t('okr.fileCenter.errors.fileTooLarge', { maxMb: MAX_FILE_SIZE_MB }))
            return
        }

        setSaving(true)
        setError(null)

        const sanitizedName = sanitizeFileName(selectedFile.name)
        const filePath = `${krId}/${Date.now()}-${sanitizedName}`

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
                .from('kr_attachments')
                .insert({
                    key_result_id: krId,
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
            setFileInputKey((prev) => prev + 1)
            await loadAttachments()
        } catch (uploadError) {
            console.error('Error uploading KR attachment:', uploadError)
            if (isSchemaMissingError(uploadError)) {
                setError(t('okr.fileCenter.errors.schemaMissing'))
            } else {
                setError(t('okr.fileCenter.errors.uploadFailed'))
            }
        } finally {
            setSaving(false)
        }
    }

    async function handleDownload(item: KRAttachmentItem) {
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
            console.error('Error downloading KR attachment:', downloadError)
            setError(t('okr.fileCenter.errors.downloadFailed'))
        }
    }

    async function handleDelete(item: KRAttachmentItem) {
        const confirmed = window.confirm(t('okr.fileCenter.deleteConfirm', { name: item.file_name }))
        if (!confirmed) return

        setDeletingId(item.id)
        setError(null)

        try {
            const { error: deleteError } = await supabase
                .from('kr_attachments')
                .delete()
                .eq('id', item.id)

            if (deleteError) throw deleteError

            const { error: storageError } = await supabase
                .storage
                .from(ATTACHMENTS_BUCKET)
                .remove([item.file_path])

            if (storageError) {
                console.error('Error cleaning up attachment file in storage:', storageError)
                setError(t('okr.fileCenter.errors.storageCleanupFailed'))
            }

            await loadAttachments()
        } catch (deleteError) {
            console.error('Error deleting KR attachment:', deleteError)
            if (isSchemaMissingError(deleteError)) {
                setError(t('okr.fileCenter.errors.schemaMissing'))
            } else {
                setError(t('okr.fileCenter.errors.deleteFailed'))
            }
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                        <div>
                            <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)] inline-flex items-center gap-2">
                                <Paperclip className="w-5 h-5" />
                                {t('okr.fileCenter.title')}
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-[var(--color-text-muted)]">
                                {t('okr.fileCenter.subtitle')}
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <button className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                                <span className="sr-only">{t('common.cancel')}</span>
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface)]/40 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                        {t('okr.fileCenter.fileLabel')}
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
                                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                        {t('okr.fileCenter.noteLabel')}
                                    </label>
                                    <textarea
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                        placeholder={t('okr.fileCenter.notePlaceholder')}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    variant="primary"
                                    onClick={() => void handleUpload()}
                                    loading={saving}
                                    disabled={saving}
                                >
                                    <Upload className="w-4 h-4" />
                                    {saving ? t('okr.fileCenter.uploading') : t('okr.fileCenter.upload')}
                                </Button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-6">
                                <div className="w-7 h-7 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : attachments.length === 0 ? (
                            <div className="text-sm text-[var(--color-text-muted)] py-6 text-center border border-dashed border-[var(--color-border)] rounded-xl">
                                {t('okr.fileCenter.empty')}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {attachments.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface)]/50 space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-[var(--color-text-primary)] break-all inline-flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                                                    {item.file_name}
                                                </p>
                                                {item.note && (
                                                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                                        {item.note}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => void handleDownload(item)}
                                                >
                                                    <Download className="w-4 h-4" />
                                                    {t('okr.fileCenter.download')}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                                    onClick={() => void handleDelete(item)}
                                                    disabled={deletingId === item.id}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    {t('okr.fileCenter.delete')}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                            <Badge variant="outline" size="sm">
                                                {t('okr.fileCenter.fileSize')}: {formatFileSize(item.file_size_bytes)}
                                            </Badge>
                                            <Badge variant="outline" size="sm">
                                                {t('okr.fileCenter.uploadedAt')}: {formatDate(item.created_at)}
                                            </Badge>
                                            <Badge variant="outline" size="sm">
                                                {t('okr.fileCenter.uploadedBy')}: {item.uploader_name || t('okr.fileCenter.unknownUploader')}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
