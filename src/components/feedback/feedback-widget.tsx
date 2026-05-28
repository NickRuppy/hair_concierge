"use client"

import * as React from "react"
import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { posthog } from "@/providers/posthog-provider"
import { cn } from "@/lib/utils"

const MAX_LENGTH = 4000
const SUCCESS_AUTOCLOSE_MS = 1800
const HINT_STORAGE_KEY = "chaarlie_feedback_hint_seen"
const HINT_DELAY_MS = 1200

export function FeedbackWidget() {
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [hintVisible, setHintVisible] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const hintTimerRef = React.useRef<number | null>(null)

  const enabled = process.env.NEXT_PUBLIC_BETA_FEEDBACK_ENABLED === "true"

  // First-time hint: show once per browser, after a short delay so it doesn't
  // collide with page load. Dismissal via tab-click or explicit close persists.
  React.useEffect(() => {
    if (!enabled || loading || !user) return
    if (typeof window === "undefined") return

    let alreadySeen = false
    try {
      alreadySeen = !!window.localStorage.getItem(HINT_STORAGE_KEY)
    } catch {
      // Storage blocked (private mode, strict cookie policy) — assume not seen
    }
    if (alreadySeen) return

    hintTimerRef.current = window.setTimeout(() => {
      setHintVisible(true)
      hintTimerRef.current = null
    }, HINT_DELAY_MS)
    return () => {
      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
    }
  }, [enabled, loading, user])

  React.useEffect(() => {
    if (open && !success) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [open, success])

  if (!enabled || loading || !user) return null

  function dismissHint() {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    setHintVisible(false)
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, "1")
    } catch {
      // localStorage may be disabled (private mode, etc.) — hint just won't persist
    }
  }

  function handleTabClick() {
    dismissHint()
    setOpen(true)
  }

  const trimmed = message.trim()
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !submitting

  function handleOpenChange(next: boolean) {
    if (submitting) return
    setOpen(next)
    if (!next) {
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
          pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
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
      {/* First-time hint bubble — sits to the left of the tab */}
      {hintVisible && (
        <div
          role="status"
          className={cn(
            "fixed right-12 top-1/2 z-40 -translate-y-1/2",
            "max-w-[260px] rounded-xl bg-card px-4 py-3 pr-9",
            "border border-border shadow-[0_12px_32px_-12px_rgba(60,50,70,0.22)]",
            "animate-in fade-in slide-in-from-right-2 duration-300",
          )}
        >
          <p className="text-sm leading-snug text-foreground">
            Hier kannst du uns Feedback geben — wir lesen jede Nachricht.
          </p>
          <button
            type="button"
            aria-label="Hinweis schließen"
            onClick={dismissHint}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* Arrow pointing right toward the tab */}
          <span
            aria-hidden="true"
            className="absolute right-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border border-border bg-card"
            style={{ borderLeft: "none", borderBottom: "none" }}
          />
        </div>
      )}

      {/* Vertical side tab */}
      <button
        type="button"
        aria-label="Feedback geben"
        onClick={handleTabClick}
        className={cn(
          "fixed right-0 top-1/2 z-40 -translate-y-1/2",
          "flex items-center justify-center",
          "rounded-l-xl bg-secondary text-secondary-foreground",
          "px-2 py-5",
          "shadow-[-6px_0_16px_-6px_rgba(217,106,118,0.45)]",
          "transition-transform duration-200 ease-out",
          "hover:-translate-x-[3px] hover:-translate-y-1/2",
          "active:translate-x-[0px] active:-translate-y-1/2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          hintVisible && "animate-feedback-pulse",
        )}
      >
        <span className="text-xs font-semibold tracking-wider [writing-mode:vertical-rl] rotate-180">
          Feedback
        </span>
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
