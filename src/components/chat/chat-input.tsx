"use client"

import { Camera, Send, X } from "lucide-react"
import { useRef, useState } from "react"

interface ChatInputProps {
  onSend: (message: string, imageUrl?: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleImageUpload(file: File) {
    setUploading(true)
    const preview = URL.createObjectURL(file)
    setImagePreview(preview)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setImageUrl(data.url)
      } else {
        setImagePreview(null)
        setImageUrl(null)
      }
    } catch {
      setImagePreview(null)
      setImageUrl(null)
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit() {
    const trimmed = message.trim()
    if (!trimmed && !imageUrl) return
    if (disabled || uploading) return

    onSend(trimmed || "Bitte analysiere mein Haar auf dem Foto.", imageUrl || undefined)
    setMessage("")
    setImagePreview(null)
    setImageUrl(null)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleTextareaInput() {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  function removeImage() {
    setImagePreview(null)
    setImageUrl(null)
  }

  return (
    <div className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Image preview */}
      {imagePreview && (
        <div className="mb-3 flex items-start gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Vorschau"
              className="h-20 w-20 rounded-lg object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
            <button
              onClick={removeImage}
              className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Photo upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Camera className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImageUpload(file)
            e.target.value = ""
          }}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleTextareaInput}
          placeholder="Stelle eine Frage zu deinen Haaren..."
          disabled={disabled}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          rows={1}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || uploading || (!message.trim() && !imageUrl)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
