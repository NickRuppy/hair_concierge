"use client"

import { Send } from "lucide-react"
import { useRef, useState } from "react"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    const trimmed = message.trim()
    if (!trimmed) return
    if (disabled) return

    onSend(trimmed)
    setMessage("")

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

  return (
    <div className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-2">
        {/* Text input */}
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
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
          data-testid="chat-send"
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          aria-label="Nachricht senden"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
