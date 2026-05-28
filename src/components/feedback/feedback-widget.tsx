"use client"

import * as React from "react"
import { MessageSquare, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { posthog } from "@/providers/posthog-provider"
import { cn } from "@/lib/utils"

const MAX_LENGTH = 4000
const SUCCESS_AUTOCLOSE_MS = 1800

export function FeedbackWidget() {
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const enabled = process.env.NEXT_PUBLIC_BETA_FEEDBACK_ENABLED === "true"

  React.useEffect(() => {
    if (open && !success) {
      // Focus textarea after Dialog mounts (portal needs a tick)
      const timer = setTimeout(() => textareaRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [open, success])

  if (!enabled || loading || !user) return null

  const trimmed = message.trim()
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !submitting

  function handleOpenChange(next: boolean) {
    if (submitting) return
    setOpen(next)
    if (!next) {
      // Reset shortly after close animation finishes
      setTimeout(() => {
        setMessage("")
        setSuccess(false)
      }, 250)
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Fehler beim Senden")
      }

      posthog.capture("feedback_submitted", {
        page_url: typeof window !== "undefined" ? window.location.pathname : undefined,
      })
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        // Reset after close animation
        setTimeout(() => {
          setMessage("")
          setSuccess(false)
        }, 250)
      }, SUCCESS_AUTOCLOSE_MS)
    } catch (err) {
      const description = err instanceof Error ? err.message : "Bitte versuche es nochmal."
      toast({
        title: "Hat nicht geklappt",
        description,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Feedback geben"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-40",
          "flex h-[52px] w-[52px] items-center justify-center",
          "rounded-full bg-secondary text-secondary-foreground",
          "shadow-[0_10px_24px_-6px_rgba(217,106,118,0.5)]",
          "transition-transform duration-150",
          "hover:scale-105 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md rounded-2xl">
          {success ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(140_45%_92%)] text-[hsl(140_50%_35%)]">
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <h2 className="font-display text-xl font-semibold">Danke!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Wir lesen&apos;s. Wenn du willst, schreib uns nochmal — jede Nachricht zählt.
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="font-display text-xl font-semibold">Etwas stimmt nicht?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sag uns kurz Bescheid — wir lesen jede Nachricht.
                </p>
              </div>
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                placeholder="Was ist los?"
                maxLength={MAX_LENGTH}
                rows={5}
                className="resize-y"
                disabled={submitting}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {message.length} / {MAX_LENGTH}
                </span>
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-auto px-5"
                >
                  {submitting ? "Senden …" : "Senden"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
