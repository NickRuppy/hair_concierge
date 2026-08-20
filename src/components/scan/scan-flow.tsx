"use client"

import { useCallback, useRef, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import type { ScanSavedState } from "@/lib/scan/saved-state"
import type {
  ScanPendingSubmissionResult,
  ScanResolveResult,
  ScanResolvedVerdictResult,
  ScanUnknownProductResult,
} from "@/lib/scan/types"
// The app-wide provider is `providers/toast-provider` (mounted in AppRouteProviders);
// `components/ui/toast`'s hook talks to a second, unmounted store and would no-op.
import { useToast } from "@/providers/toast-provider"

import { ScanActionFooter } from "./scan-action-footer"
import { ScanResultCard } from "./scan-result-card"
import { ScanResultSheet } from "./scan-result-sheet"
import { ScanSaveSheet } from "./scan-save-sheet"
import { ScanSearchSheet } from "./scan-search-sheet"
import { ScanUnknownFlow, type ScanSubmissionInput } from "./scan-unknown-flow"
import { ScanWishlistSheet, ScanWishlistTrigger } from "./scan-wishlist-sheet"
import { Scanner, type ScanDecodedIdentifier, type ScanUnavailableReason } from "./scanner"

/**
 * Client orchestrator for `/scan` (the route itself is Task 6). Owns the state machine
 * scanning → resolving → sheet(result | unknown | pending), the scanner's fallbacks
 * (timeout / no camera → search sheet) and the save + Merkliste surfaces.
 *
 * The camera keeps running behind an open sheet — that is what "the sheet slides up over
 * the camera" means in the spec, and it makes "Nochmal scannen" instant. Decodes are
 * ignored while a sheet is open (see `sheetOpenRef`).
 */

type ScanIdentifier = { type: "ean"; value: string }

type ScanFlowStep =
  | { kind: "scanning" }
  | { kind: "resolving" }
  | { kind: "result"; result: ScanResolvedVerdictResult }
  | { kind: "unknown"; unknown: ScanUnknownProductResult }
  | { kind: "pending"; pending: ScanPendingSubmissionResult }

const RESOLVE_ERRORS: Record<string, string> = {
  profile_missing: "Für den Scan brauchen wir zuerst deine Haaranalyse.",
  product_not_found: "Dieses Produkt können wir gerade nicht öffnen.",
  invalid_identifier: "Diese Barcode-Nummer stimmt nicht.",
  rate_limited: "Gerade zu viele Anfragen. Versuch es in einem Moment noch einmal.",
  temporarily_unavailable: "Das hat gerade nicht geklappt. Versuch es noch einmal.",
}
const GENERIC_ERROR = "Das hat gerade nicht geklappt. Versuch es noch einmal."
const CAMERA_UNAVAILABLE_COPY: Record<ScanUnavailableReason, string> = {
  denied: "Ohne Kamerazugriff findest du dein Produkt hier über die Suche.",
  no_camera: "Wir finden keine Kamera — nutze so lange die Suche.",
  insecure: "Die Kamera braucht eine sichere Verbindung — nutze so lange die Suche.",
}

export function ScanFlow() {
  const { toast } = useToast()
  const [step, setStep] = useState<ScanFlowStep>({ kind: "scanning" })
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const [cameraNotice, setCameraNotice] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const sheetOpenRef = useRef(false)

  const sheetOpen = step.kind !== "scanning"
  sheetOpenRef.current = sheetOpen || searchOpen || wishlistOpen

  const closeSheet = useCallback(() => {
    setStep({ kind: "scanning" })
    setSaveOpen(false)
    setSubmitError(null)
  }, [])

  const resolve = useCallback(
    async (body: { identifier: ScanIdentifier } | { productId: string }) => {
      setStep({ kind: "resolving" })
      try {
        const response = await fetch("/api/scan/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          toast({
            title: RESOLVE_ERRORS[payload?.error ?? ""] ?? GENERIC_ERROR,
            variant: "destructive",
          })
          setStep({ kind: "scanning" })
          return
        }
        const result = (await response.json()) as ScanResolveResult
        if (result.kind === "unknown_product") setStep({ kind: "unknown", unknown: result })
        else if (result.kind === "pending_submission") setStep({ kind: "pending", pending: result })
        else setStep({ kind: "result", result })
      } catch {
        toast({ title: GENERIC_ERROR, variant: "destructive" })
        setStep({ kind: "scanning" })
      }
    },
    [toast],
  )

  const handleDecoded = useCallback(
    (identifier: ScanDecodedIdentifier) => {
      if (sheetOpenRef.current) return
      void resolve({ identifier })
    },
    [resolve],
  )

  const handleUnavailable = useCallback((reason: ScanUnavailableReason) => {
    setCameraAvailable(false)
    setSearchOpen(true)
    setCameraNotice(CAMERA_UNAVAILABLE_COPY[reason])
  }, [])

  const handleTimeout = useCallback(() => {
    if (sheetOpenRef.current) return
    setSearchOpen(true)
  }, [])

  const openFromProductId = useCallback(
    (productId: string) => {
      setSearchOpen(false)
      setWishlistOpen(false)
      void resolve({ productId })
    },
    [resolve],
  )

  const submitUnknown = useCallback(
    async (input: ScanSubmissionInput, identifier: ScanIdentifier) => {
      setSubmitting(true)
      setSubmitError(null)
      try {
        const response = await fetch("/api/scan/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, ...input }),
        })
        if (!response.ok) {
          setSubmitError(GENERIC_ERROR)
          return
        }
        const result = (await response.json()) as
          | { kind: "already_in_catalog"; productId: string }
          | { kind: "pending_submission"; submissionId: string; headline: string }
        if (result.kind === "already_in_catalog") {
          // The EAN was catalogued between the scan and the submission — show the real
          // verdict instead of a research receipt for a product we already know.
          await resolve({ productId: result.productId })
          return
        }
        setStep({
          kind: "pending",
          pending: {
            kind: "pending_submission",
            submissionId: result.submissionId,
            headline: result.headline,
            status: "pending_review",
          },
        })
      } catch {
        setSubmitError(GENERIC_ERROR)
      } finally {
        setSubmitting(false)
      }
    },
    [resolve],
  )

  const updateSavedState = useCallback((savedState: ScanSavedState) => {
    setStep((current) =>
      current.kind === "result"
        ? { kind: "result", result: { ...current.result, savedState } }
        : current,
    )
  }, [])

  return (
    <div className="mx-auto w-full max-w-[430px] px-3 sm:max-w-[560px] sm:px-5">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-[17px] font-bold text-foreground">Scan</h1>
        <ScanWishlistTrigger onClick={() => setWishlistOpen(true)} />
      </div>

      {cameraAvailable ? (
        <Scanner
          active
          onDecoded={handleDecoded}
          onUnavailable={handleUnavailable}
          onTimeout={handleTimeout}
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-muted px-6 text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            {cameraNotice ?? CAMERA_UNAVAILABLE_COPY.no_camera}
          </p>
        </div>
      )}

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Barcode nicht lesbar?{" "}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        >
          Produkt suchen
        </button>
      </p>

      <ScanResultSheet
        open={sheetOpen}
        title={sheetTitle(step)}
        onClose={closeSheet}
        footer={
          step.kind === "result" ? (
            <ScanActionFooter
              kind={step.result.kind}
              verdict={step.result.kind === "in_catalog" ? step.result.verdict : null}
              product={step.result.product}
              savedState={step.result.savedState}
              onSave={() => setSaveOpen(true)}
              onBuy={() => undefined}
            />
          ) : undefined
        }
      >
        {step.kind === "resolving" ? <ResolvingBody /> : null}
        {step.kind === "result" ? (
          <ScanResultCard
            result={step.result}
            onRescan={closeSheet}
            onOpenAlternative={openFromProductId}
          />
        ) : null}
        {step.kind === "unknown" ? (
          <ScanUnknownFlow
            unknown={step.unknown}
            submitting={submitting}
            error={submitError}
            // The v1 scan surface is EAN-only in both directions (resolve returns the
            // scanned/typed EAN, submit accepts nothing else), so the narrowing is safe.
            onSubmit={(input) =>
              void submitUnknown(input, { type: "ean", value: step.unknown.identifier.value })
            }
          />
        ) : null}
        {step.kind === "pending" ? (
          <PendingBody headline={step.pending.headline} onContinue={closeSheet} />
        ) : null}
      </ScanResultSheet>

      {step.kind === "result" ? (
        <ScanSaveSheet
          open={saveOpen}
          productId={step.result.product.productId}
          savedState={step.result.savedState}
          onOpenChange={setSaveOpen}
          onSavedStateChange={updateSavedState}
        />
      ) : null}

      <ScanSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectProduct={openFromProductId}
        onSubmitIdentifier={(identifier) => {
          setSearchOpen(false)
          void resolve({ identifier })
        }}
      />

      <ScanWishlistSheet
        open={wishlistOpen}
        onOpenChange={setWishlistOpen}
        onOpenProduct={openFromProductId}
      />
    </div>
  )
}

function sheetTitle(step: ScanFlowStep): string {
  switch (step.kind) {
    case "result":
      return step.result.kind === "in_catalog" ? step.result.verdictTitle : step.result.headline
    case "unknown":
      return "Das kennen wir noch nicht."
    case "pending":
      return step.pending.headline
    default:
      return "Produkt wird geprüft"
  }
}

function ResolvingBody() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-[10px]" />
        <div className="flex-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-[72px] w-full rounded-[14px]" />
      <Skeleton className="h-[120px] w-full rounded-[14px]" />
    </div>
  )
}

function PendingBody({ headline, onContinue }: { headline: string; onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span aria-hidden="true" className="text-3xl">
        🕐
      </span>
      <h2 className="font-header text-2xl leading-tight text-foreground">{headline}</h2>
      <p className="max-w-[320px] text-sm leading-6 text-[var(--text-sub)]">
        Meist innerhalb von 24 Stunden. Du bekommst eine Nachricht im Chat, sobald wir es
        eingeordnet haben.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-2 min-h-[48px] w-full rounded-[12px] border-[1.5px] border-[var(--brand-plum-light)] bg-transparent px-6 text-[15px] font-semibold text-[var(--brand-plum-dark)] transition-colors hover:border-[var(--brand-plum)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
      >
        Weiter scannen
      </button>
    </div>
  )
}
