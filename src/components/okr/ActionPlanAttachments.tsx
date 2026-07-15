import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Download, FileText, Maximize2, Paperclip, Plus, Trash2, Upload, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'

type PreviewKind = 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'none'

function getFileExtension(fileName: string): string {
    const idx = fileName.lastIndexOf('.')
    return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : ''
}

function getPreviewKind(contentType: string | null, fileName: string): PreviewKind {
    const type = contentType || ''
    const ext = getFileExtension(fileName)

    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
    if (type === 'application/pdf' || ext === 'pdf') return 'pdf'
    if (type.startsWith('video/') || ['mp4', 'webm', 'ogg', 'ogv', 'mov'].includes(ext)) return 'video'
    if (type.startsWith('audio/') || ['mp3', 'wav', 'oga', 'ogg'].includes(ext)) return 'audio'
    if (type.startsWith('text/') || type === 'application/json' || ['txt', 'csv', 'md', 'json', 'log'].includes(ext)) return 'text'
    return 'none'
}

const ATTACHMENTS_BUCKET = 'anexos'
const STORAGE_PREFIX = 'action-plans'
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MIN_ZOOM = 1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.25

function clampZoom(value: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +value.toFixed(2)))
}

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

    const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewText, setPreviewText] = useState<string | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState<string | null>(null)

    // Zoom/pan state for image previews
    const [imageZoom, setImageZoom] = useState(1)
    const [imagePan, setImagePan] = useState({ x: 0, y: 0 })
    const [isDraggingImage, setIsDraggingImage] = useState(false)
    const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

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
        setPreviewItem(null)
        setPreviewUrl(null)
        setPreviewText(null)
        setPreviewError(null)
    }, [planId, loadAttachments])

    // Revoke the previous object URL whenever it changes or the component unmounts
    useEffect(() => {
        if (!previewUrl) return
        return () => URL.revokeObjectURL(previewUrl)
    }, [previewUrl])

    // Drag-to-pan while zoomed into an image preview
    useEffect(() => {
        if (!isDraggingImage) return

        function handleMouseMove(event: MouseEvent) {
            const dx = event.clientX - dragStartRef.current.x
            const dy = event.clientY - dragStartRef.current.y
            setImagePan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy })
        }
        function handleMouseUp() {
            setIsDraggingImage(false)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDraggingImage])

    async function openPreview(item: AttachmentItem) {
        setPreviewItem(item)
        setPreviewUrl(null)
        setPreviewText(null)
        setPreviewError(null)
        setImageZoom(1)
        setImagePan({ x: 0, y: 0 })

        const kind = getPreviewKind(item.content_type, item.file_name)
        if (kind === 'none') return

        setPreviewLoading(true)
        try {
            const { data: fileBlob, error: fileDownloadError } = await supabase
                .storage
                .from(ATTACHMENTS_BUCKET)
                .download(item.file_path)

            if (fileDownloadError) throw fileDownloadError
            if (!fileBlob) throw new Error('Missing file blob')

            if (kind === 'text') {
                setPreviewText(await fileBlob.text())
            } else {
                setPreviewUrl(URL.createObjectURL(fileBlob))
            }
        } catch (previewLoadError) {
            console.error('Error loading action plan attachment preview:', previewLoadError)
            setPreviewError(t('actionPlan.attachments.errors.previewFailed'))
        } finally {
            setPreviewLoading(false)
        }
    }

    function closePreview() {
        setPreviewItem(null)
        setPreviewUrl(null)
        setPreviewText(null)
        setPreviewError(null)
    }

    function zoomIn() {
        setImageZoom((z) => clampZoom(z + ZOOM_STEP))
    }

    function zoomOut() {
        setImageZoom((z) => {
            const next = clampZoom(z - ZOOM_STEP)
            if (next === MIN_ZOOM) setImagePan({ x: 0, y: 0 })
            return next
        })
    }

    function resetZoom() {
        setImageZoom(1)
        setImagePan({ x: 0, y: 0 })
    }

    function handleImageWheel(event: React.WheelEvent<HTMLDivElement>) {
        event.preventDefault()
        const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
        setImageZoom((z) => {
            const next = clampZoom(z + delta)
            if (next === MIN_ZOOM) setImagePan({ x: 0, y: 0 })
            return next
        })
    }

    function handleImageMouseDown(event: React.MouseEvent<HTMLDivElement>) {
        if (imageZoom <= MIN_ZOOM) return
        event.preventDefault()
        setIsDraggingImage(true)
        dragStartRef.current = { x: event.clientX, y: event.clientY, panX: imagePan.x, panY: imagePan.y }
    }

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

    const previewKind = previewItem ? getPreviewKind(previewItem.content_type, previewItem.file_name) : null

    let previewBody: React.ReactNode = null
    if (previewItem) {
        if (previewLoading) {
            previewBody = (
                <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            )
        } else if (previewError) {
            previewBody = (
                <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-[var(--color-danger)]">{previewError}</p>
                </div>
            )
        } else if (previewKind === 'image' && previewUrl) {
            previewBody = (
                <div
                    className="w-full h-full overflow-hidden flex items-center justify-center"
                    onWheel={handleImageWheel}
                    onMouseDown={handleImageMouseDown}
                    style={{ cursor: imageZoom > MIN_ZOOM ? (isDraggingImage ? 'grabbing' : 'grab') : 'default' }}
                >
                    <img
                        src={previewUrl}
                        alt={previewItem.file_name}
                        draggable={false}
                        className="select-none"
                        style={{
                            transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
                            transition: isDraggingImage ? 'none' : 'transform 0.12s ease-out',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                        }}
                    />
                </div>
            )
        } else if (previewKind === 'pdf' && previewUrl) {
            previewBody = <iframe src={previewUrl} title={previewItem.file_name} className="w-full h-full border-0" />
        } else if (previewKind === 'video' && previewUrl) {
            previewBody = (
                <div className="w-full h-full flex items-center justify-center p-4">
                    <video src={previewUrl} controls className="max-w-full max-h-full" />
                </div>
            )
        } else if (previewKind === 'audio' && previewUrl) {
            previewBody = (
                <div className="w-full h-full flex items-center justify-center p-8">
                    <audio src={previewUrl} controls className="w-full max-w-md" />
                </div>
            )
        } else if (previewKind === 'text' && previewText !== null) {
            previewBody = (
                <pre className="w-full h-full overflow-auto p-4 text-xs text-[var(--color-text-primary)] whitespace-pre-wrap break-words font-mono">
                    {previewText}
                </pre>
            )
        } else {
            previewBody = (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {t('actionPlan.attachments.previewUnavailableTitle')}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t('actionPlan.attachments.previewUnavailableDescription')}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void handleDownload(previewItem)}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        {t('actionPlan.attachments.downloadToView')}
                    </Button>
                </div>
            )
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
                                onClick={() => void openPreview(item)}
                                className="group/file flex items-start gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 hover:bg-[var(--color-surface-hover)]/50 cursor-pointer transition-colors"
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
                                        onClick={(event) => { event.stopPropagation(); void handleDownload(item) }}
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
                                        onClick={(event) => { event.stopPropagation(); void handleDelete(item) }}
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

            {/* Full-body preview overlay: takes over the modal's content area so the file
                becomes the focus, with a compact file rail on the side to switch between attachments. */}
            {previewItem && (
                <div className="absolute inset-0 z-20 flex bg-[var(--color-surface)]">
                    <div className="w-56 shrink-0 border-r border-[var(--color-border)] overflow-y-auto p-2 space-y-1">
                        {attachments.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => void openPreview(item)}
                                className={cn(
                                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors',
                                    previewItem.id === item.id
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30'
                                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                                )}
                            >
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-xs truncate">{item.file_name}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] shrink-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                {previewItem.file_name}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                                {previewKind === 'image' && previewUrl && (
                                    <>
                                        <button
                                            type="button"
                                            title={t('actionPlan.attachments.zoomOut')}
                                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                            onClick={zoomOut}
                                            disabled={imageZoom <= MIN_ZOOM}
                                        >
                                            <ZoomOut className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs tabular-nums text-[var(--color-text-muted)] w-11 text-center select-none">
                                            {Math.round(imageZoom * 100)}%
                                        </span>
                                        <button
                                            type="button"
                                            title={t('actionPlan.attachments.zoomIn')}
                                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                            onClick={zoomIn}
                                            disabled={imageZoom >= MAX_ZOOM}
                                        >
                                            <ZoomIn className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            title={t('actionPlan.attachments.resetZoom')}
                                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                            onClick={resetZoom}
                                            disabled={imageZoom === MIN_ZOOM}
                                        >
                                            <Maximize2 className="w-4 h-4" />
                                        </button>
                                        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
                                    </>
                                )}
                                <button
                                    type="button"
                                    title={t('actionPlan.attachments.download')}
                                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                    onClick={() => void handleDownload(previewItem)}
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    title={t('actionPlan.attachments.closePreview')}
                                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                    onClick={closePreview}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-hidden bg-[var(--color-surface-hover)]/30">
                            {previewBody}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
