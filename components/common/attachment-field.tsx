"use client"

import { DownloadIcon, EyeIcon, FileTextIcon, ImageIcon, PaperclipIcon, Trash2Icon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { ResponsiveDialog } from "@/components/common/responsive-dialog"
import { Button } from "@/components/ui/button"
import { formatFileSize } from "@/lib/format"
import { attachmentSchema, MAX_FILE_SIZE } from "@/lib/schemas"
import type { Attachment } from "@/types"

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp"

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Convertit la pièce jointe en URL `blob:` (aperçu PDF fiable dans les navigateurs). */
function useBlobUrl(attachment: Attachment | undefined, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!attachment || !enabled) return
    let revoked = false
    let objectUrl: string | null = null
    fetch(attachment.dataUrl)
      .then((response) => response.blob())
      .then((blob) => {
        if (revoked) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setUrl(null))
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [attachment, enabled])
  return url
}

export function downloadAttachment(attachment: Attachment) {
  const link = document.createElement("a")
  link.href = attachment.dataUrl
  link.download = attachment.name
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Aperçu d'un justificatif (PDF ou image) dans un dialogue. */
export function AttachmentPreview({
  attachment,
  open,
  onOpenChange,
}: {
  attachment: Attachment
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const url = useBlobUrl(attachment, open)
  const isImage = attachment.mimeType.startsWith("image/")
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={attachment.name} size="xl">
      <div className="flex min-h-[50dvh] items-center justify-center rounded-lg bg-muted">
        {!url ? (
          <p className="text-sm text-muted-foreground">Chargement de l&apos;aperçu…</p>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.name} className="max-h-[70dvh] w-auto rounded-md object-contain" />
        ) : (
          <iframe src={url} title={attachment.name} className="h-[70dvh] w-full rounded-md bg-white" />
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={() => downloadAttachment(attachment)}>
          <DownloadIcon /> Télécharger
        </Button>
      </div>
    </ResponsiveDialog>
  )
}

/** Ligne affichant une pièce jointe avec aperçu et téléchargement. */
export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const [preview, setPreview] = useState(false)
  const Icon = attachment.mimeType.startsWith("image/") ? ImageIcon : FileTextIcon
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
        <Icon aria-hidden className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Aperçu" onClick={() => setPreview(true)}>
          <EyeIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Télécharger"
          onClick={() => downloadAttachment(attachment)}
        >
          <DownloadIcon />
        </Button>
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer le fichier" onClick={onRemove}>
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
      <AttachmentPreview attachment={attachment} open={preview} onOpenChange={setPreview} />
    </div>
  )
}

/** Sélection d'un fichier (PDF/image, 2 Mo max) stocké en base64. */
export function AttachmentField({
  value,
  onChange,
  id,
}: {
  value: Attachment | undefined
  onChange(value: Attachment | undefined): void
  id?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [loading, setLoading] = useState(false)

  if (value) return <AttachmentChip attachment={value} onRemove={() => onChange(undefined)} />

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          if (file.size > MAX_FILE_SIZE) {
            toast.error("Fichier trop volumineux", { description: "La taille maximale est de 2 Mo." })
            return
          }
          setLoading(true)
          try {
            const parsed = attachmentSchema.safeParse({
              name: file.name,
              mimeType: file.type,
              size: file.size,
              dataUrl: await readAsDataUrl(file),
            })
            if (!parsed.success) {
              toast.error("Fichier refusé", { description: parsed.error.issues[0]?.message })
              return
            }
            onChange(parsed.data)
          } finally {
            setLoading(false)
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="h-auto w-full justify-start gap-3 border-dashed py-3 text-left"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        <PaperclipIcon />
        <span className="flex flex-col">
          <span>{loading ? "Lecture du fichier…" : "Joindre un fichier"}</span>
          <span className="text-xs font-normal text-muted-foreground">PDF, PNG, JPEG ou WebP — 2 Mo maximum</span>
        </span>
      </Button>
    </div>
  )
}
