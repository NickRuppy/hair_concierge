"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type SubmissionActionsProps = {
  submissionId: string
  jobId: string | null
  jobStatus: string
  jobStage: string
  brandReview: BrandReviewAction | null
  imageResearched: boolean
  imageSearchRequested: boolean
  imageSelected: boolean
  processedImageNeedsWork: boolean
  processedImageReady: boolean
  finalImageApproved: boolean
  propertiesResearched: boolean
  propertiesApproved: boolean
  readyForFinalApproval: boolean
  publishCompleted: boolean
}

type BrandReviewAction = {
  proposedBrand: string
  proposedLine: string | null
  proposedProductName: string
  candidates: Array<{
    brand: string
    line: string | null
  }>
  approved: boolean
  evidence: string | null
}

const retryableStatuses = new Set(["blocked", "failed"])
const activeRefreshStatuses = new Set([
  "queued",
  "running",
  "waiting_for_rework",
  "publish_preflight",
  "publishing",
])
type BusyAction = "research" | "rework" | "preflight" | "publish" | "decision"
type ImageSearchActionState = "idle" | "saving" | "queued"
type ImageProcessingActionState = "idle" | "queued"
type ActionMessage = {
  tone: "info" | "success" | "error"
  text: string
}
const imageSearchReworkComment =
  "Bild passt nicht. Neues Bild suchen: exact current product-only front-facing packshot of the saleable product alone; ideally transparent PNG/WebP or clean white/light background; no outer box/carton, product-plus-box, bundle, lifestyle image, cropped product, shadow, base reflection, dark background, watermark, sale overlay, old packaging, wrong region, or wrong variant. If no perfect transparent source exists, compare candidates and choose the best high-resolution processing-ready white-background packshot."
const decisionOptions = [
  ["change_requested", "Aenderung anfordern"],
  ["approved", "Feld passt"],
  ["image_approved", "Finales Bild passt"],
  ["image_rejected", "Bild braucht Arbeit"],
  ["publish_approved", "Produkt final freigeben"],
  ["needs_more_info", "Mehr Infos vom User"],
  ["reject", "Submission ablehnen"],
] as const

export function SubmissionActions({
  submissionId,
  jobId,
  jobStatus,
  jobStage,
  brandReview,
  imageResearched,
  imageSearchRequested,
  imageSelected,
  processedImageNeedsWork,
  processedImageReady,
  finalImageApproved,
  propertiesResearched,
  propertiesApproved,
  readyForFinalApproval,
  publishCompleted,
}: SubmissionActionsProps) {
  const router = useRouter()
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null)
  const [imageSearchActionState, setImageSearchActionState] =
    useState<ImageSearchActionState>("idle")
  const [imageProcessingActionState, setImageProcessingActionState] =
    useState<ImageProcessingActionState>("idle")
  const [message, setMessage] = useState<ActionMessage | null>(null)
  const [fieldPath, setFieldPath] = useState("final.product")
  const [decision, setDecision] = useState<(typeof decisionOptions)[number][0]>("change_requested")
  const [comment, setComment] = useState("")
  const [identityBrand, setIdentityBrand] = useState(brandReview?.proposedBrand ?? "")
  const [identityLine, setIdentityLine] = useState(brandReview?.proposedLine ?? "")
  const [identityProductName, setIdentityProductName] = useState(
    brandReview?.proposedProductName ?? "",
  )

  const isBusy = busyAction !== null
  const identityReady = identityBrand.trim().length > 0 && identityProductName.trim().length > 0

  useEffect(() => {
    if (isBusy || !activeRefreshStatuses.has(jobStatus)) return
    const refreshTimer = window.setInterval(() => {
      router.refresh()
    }, 5000)
    return () => window.clearInterval(refreshTimer)
  }, [isBusy, jobStatus, router])

  useEffect(() => {
    setIdentityBrand(brandReview?.proposedBrand ?? "")
    setIdentityLine(brandReview?.proposedLine ?? "")
    setIdentityProductName(brandReview?.proposedProductName ?? "")
  }, [brandReview])

  async function postAction(
    path: string,
    body?: Record<string, unknown>,
    options: { action?: BusyAction; busyMessage?: string } = {},
  ) {
    setBusyAction(options.action ?? "decision")
    setMessage({
      tone: "info",
      text: options.busyMessage ?? "Aktion laeuft. Bitte kurz warten.",
    })

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const result = (await response.json()) as {
        error?: string
        message?: string
        job?: { jobStatus: string }
        preflight?: { ok: boolean; blockers: string[]; next_action: string }
      }

      if (!response.ok) {
        throw new Error(result.error ?? `Aktion fehlgeschlagen (${response.status}).`)
      }

      setMessage({ tone: "success", text: buildMessage(result) })
      router.refresh()
    } catch (caught) {
      setMessage({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Aktion fehlgeschlagen.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function saveDecision() {
    await postAction(
      `/api/submissions/${submissionId}/review-decision`,
      {
        jobId,
        fieldPath,
        decision,
        comment,
      },
      { action: "decision", busyMessage: "Review-Entscheidung wird gespeichert." },
    )
    setComment("")
  }

  async function saveQuickDecision(params: {
    fieldPath: string
    decision: "approved" | "image_approved" | "image_rejected" | "publish_approved"
    busyMessage?: string
  }) {
    await postAction(
      `/api/submissions/${submissionId}/review-decision`,
      {
        jobId,
        fieldPath: params.fieldPath,
        decision: params.decision,
        comment: null,
      },
      {
        action: "decision",
        busyMessage: params.busyMessage ?? "Review-Entscheidung wird gespeichert.",
      },
    )
  }

  async function saveProductIdentity(startRework: boolean) {
    if (!brandReview) return

    const canonicalBrand = identityBrand.trim()
    const productLine = identityLine.trim() || null
    const cleanName = identityProductName.trim()
    if (!canonicalBrand || !cleanName) {
      setMessage({
        tone: "error",
        text: "Kanonische Marke und Produktname muessen ausgefuellt sein.",
      })
      return
    }

    setBusyAction(startRework ? "rework" : "decision")
    setMessage({
      tone: "info",
      text: startRework
        ? "Produktidentitaet wird gespeichert und Rework wird eingereiht."
        : "Produktidentitaet wird gespeichert.",
    })

    const identity = {
      canonical_brand: canonicalBrand,
      product_line: productLine,
      clean_name: cleanName,
    }

    try {
      await saveIdentityDecision({
        fieldPath: "product.canonical_brand",
        proposedValue: { canonical_brand: brandReview.proposedBrand },
        reviewerValue: { canonical_brand: canonicalBrand },
        comment: `Kanonische Marke fuer diesen Product-Intake freigegeben: ${canonicalBrand}`,
      })
      await saveIdentityDecision({
        fieldPath: "product.product_line",
        proposedValue: { product_line: brandReview.proposedLine },
        reviewerValue: { product_line: productLine },
        comment: `Produktlinie fuer diesen Product-Intake freigegeben: ${productLine ?? "keine Linie"}`,
      })
      await saveIdentityDecision({
        fieldPath: "product.clean_name",
        proposedValue: { clean_name: brandReview.proposedProductName },
        reviewerValue: { clean_name: cleanName },
        comment: `Produktname fuer diesen Product-Intake freigegeben: ${cleanName}`,
      })

      if (startRework) {
        const reworkResponse = await fetch(`/api/submissions/${submissionId}/rework`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reworkType: "product_rework",
            message:
              `Use reviewer-approved product identity fields exactly: ` +
              `canonical_brand="${canonicalBrand}", ` +
              `product_line="${productLine ?? ""}", ` +
              `clean_name="${cleanName}". Re-run source, image, and property research against that identity.`,
          }),
        })
        const reworkResult = (await reworkResponse.json()) as { error?: string; message?: string }
        if (!reworkResponse.ok) {
          throw new Error(reworkResult.error ?? `Rework fehlgeschlagen (${reworkResponse.status}).`)
        }
      }

      setMessage({
        tone: "success",
        text: startRework
          ? "Produktidentitaet gespeichert. Rework ist eingereiht und der Worker nutzt diese Werte."
          : "Produktidentitaet gespeichert. Der Worker nutzt diese Werte beim naechsten Rework.",
      })
      router.refresh()
    } catch (caught) {
      setMessage({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Produktidentitaet konnte nicht gespeichert werden.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function saveIdentityDecision(params: {
    fieldPath: string
    proposedValue: Record<string, unknown>
    reviewerValue: Record<string, unknown>
    comment: string
  }) {
    const response = await fetch(`/api/submissions/${submissionId}/review-decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId,
        fieldPath: params.fieldPath,
        decision: "approved",
        proposedValue: params.proposedValue,
        reviewerValue: params.reviewerValue,
        comment: params.comment,
      }),
    })
    const result = (await response.json()) as { error?: string }
    if (!response.ok) {
      throw new Error(
        result.error ?? `Identitaetsentscheidung fehlgeschlagen (${response.status}).`,
      )
    }
  }

  async function requestImageProcessing() {
    setImageProcessingActionState("queued")
    await saveQuickDecision({
      fieldPath: "raw.image",
      decision: "approved",
      busyMessage: "Bildverarbeitung wird eingereiht.",
    })
  }

  async function requestImageSearchRework() {
    setBusyAction("rework")
    setImageSearchActionState("saving")
    setMessage({
      tone: "info",
      text: "Bild wird abgelehnt. Neue Bildsuche wird sichtbar eingereiht.",
    })

    try {
      const decisionResponse = await fetch(`/api/submissions/${submissionId}/review-decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
          fieldPath: "raw.image",
          decision: "image_rejected",
          comment: imageSearchReworkComment,
        }),
      })
      const decisionResult = (await decisionResponse.json()) as { error?: string }
      if (!decisionResponse.ok) {
        throw new Error(
          decisionResult.error ?? `Bildentscheidung fehlgeschlagen (${decisionResponse.status}).`,
        )
      }

      setImageSearchActionState("queued")
      const reworkResponse = await fetch(`/api/submissions/${submissionId}/rework`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reworkType: "image_search",
          message: imageSearchReworkComment,
        }),
      })
      const reworkResult = (await reworkResponse.json()) as { error?: string; message?: string }
      if (!reworkResponse.ok) {
        throw new Error(
          reworkResult.error ?? `Bild-Rework fehlgeschlagen (${reworkResponse.status}).`,
        )
      }

      setMessage({
        tone: "success",
        text:
          reworkResult.message ??
          "Bildsuche ist eingereiht. Die Statusbox zeigt, wann der Worker sucht und wann ein neuer Vorschlag da ist.",
      })
      router.refresh()
    } catch (caught) {
      setImageSearchActionState("idle")
      setMessage({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Bild-Rework fehlgeschlagen.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function requestProductRework() {
    setBusyAction("rework")
    setMessage({
      tone: "info",
      text: "Feedback wird gespeichert und Rework wird sichtbar eingereiht.",
    })

    const trimmedComment = comment.trim()
    const reworkMessage = trimmedComment
      ? `Nick hat Review-Feedback fuer ${fieldPath} markiert: ${trimmedComment}`
      : "Nick hat Review-Kommentare markiert und einen Produkt-Rework angefordert."

    try {
      if (trimmedComment) {
        const decisionResponse = await fetch(`/api/submissions/${submissionId}/review-decision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jobId,
            fieldPath,
            decision,
            comment: trimmedComment,
          }),
        })
        const decisionResult = (await decisionResponse.json()) as { error?: string }
        if (!decisionResponse.ok) {
          throw new Error(
            decisionResult.error ??
              `Review-Feedback konnte nicht gespeichert werden (${decisionResponse.status}).`,
          )
        }
      }

      const reworkResponse = await fetch(`/api/submissions/${submissionId}/rework`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reworkType: "product_rework",
          message: reworkMessage,
        }),
      })
      const reworkResult = (await reworkResponse.json()) as { error?: string; message?: string }
      if (!reworkResponse.ok) {
        throw new Error(reworkResult.error ?? `Rework fehlgeschlagen (${reworkResponse.status}).`)
      }

      if (trimmedComment) setComment("")
      setMessage({
        tone: "success",
        text:
          reworkResult.message ??
          "Rework ist eingereiht. Die Statusbox zeigt, wann der Worker laeuft und wann neue Eigenschaften bereit sind.",
      })
      router.refresh()
    } catch (caught) {
      setMessage({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Rework fehlgeschlagen.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  function updateDecision(value: (typeof decisionOptions)[number][0]) {
    setDecision(value)
    if (value === "image_approved" || value === "image_rejected") {
      setFieldPath("final.image")
    }
    if (value === "publish_approved") {
      setFieldPath("final.product")
    }
  }

  const imageProcessingQueued = imageSelected && !processedImageReady && !processedImageNeedsWork
  const imageSearchProgressVisible =
    imageSearchActionState !== "idle" ||
    imageSearchRequested ||
    (jobStatus === "waiting_for_rework" && !imageSelected) ||
    (jobStatus === "running" && imageSearchRequested)

  return (
    <div className="workflowControl">
      <div className="workflowCards">
        {brandReview ? (
          <ActionCard
            action={
              <div className="cardActions">
                <button
                  className="smallButton"
                  type="button"
                  disabled={isBusy || !identityReady}
                  onClick={() => void saveProductIdentity(false)}
                >
                  {brandReview.approved ? "Identitaet erneut speichern" : "Identitaet speichern"}
                </button>
                <button
                  className="smallButton secondaryButton"
                  type="button"
                  disabled={isBusy || !identityReady}
                  onClick={() => void saveProductIdentity(true)}
                >
                  Speichern & neu recherchieren
                </button>
              </div>
            }
            className="brandReviewCard"
            status={brandReview.approved ? "done" : "active"}
            title="0. Produktidentitaet pruefen"
          >
            <div className="identityEditor">
              <label>
                Kanonische Marke
                <input
                  value={identityBrand}
                  onChange={(event) => setIdentityBrand(event.target.value)}
                />
              </label>
              <label>
                Linie
                <input
                  placeholder="optional"
                  value={identityLine}
                  onChange={(event) => setIdentityLine(event.target.value)}
                />
              </label>
              <label>
                Produktname
                <input
                  value={identityProductName}
                  onChange={(event) => setIdentityProductName(event.target.value)}
                />
              </label>
              {brandReview.candidates.length > 0 ? (
                <div className="identityCandidates" aria-label="Nahe Marken aus der Datenbank">
                  {brandReview.candidates.map((candidate) => (
                    <button
                      className="identityCandidate"
                      key={`${candidate.brand}:${candidate.line ?? ""}`}
                      type="button"
                      onClick={() => {
                        setIdentityBrand(candidate.brand)
                        setIdentityLine(candidate.line ?? "")
                      }}
                    >
                      {candidate.line ? `${candidate.brand} · ${candidate.line}` : candidate.brand}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {brandReview.evidence ? <span>{brandReview.evidence}</span> : null}
          </ActionCard>
        ) : null}
        <ActionCard
          action={
            <div className="cardActions">
              {imageSelected ? (
                <button className="completedButton" type="button" disabled>
                  Rohbild freigegeben
                </button>
              ) : (
                <button
                  className="smallButton"
                  type="button"
                  disabled={isBusy || !imageResearched}
                  onClick={() => void requestImageProcessing()}
                >
                  Bild passt
                </button>
              )}
              <button
                className="smallButton secondaryButton"
                type="button"
                disabled={isBusy || !imageResearched}
                onClick={() => void requestImageSearchRework()}
              >
                {busyAction === "rework"
                  ? "Bildsuche startet..."
                  : "Bild passt nicht - neues Bild suchen"}
              </button>
            </div>
          }
          status={imageSelected ? "done" : imageResearched ? "active" : "pending"}
          title="1. Bild auswaehlen"
        >
          {imageSelected
            ? "Rohbild ist ausgewaehlt."
            : imageResearched
              ? "Pruefe den Bildvorschlag und starte danach die Verarbeitung."
              : "Wartet auf Bild-Research."}
        </ActionCard>
        <ActionCard
          action={
            <div className="cardActions">
              {processedImageReady ? (
                <button
                  className="smallButton"
                  type="button"
                  disabled={isBusy || finalImageApproved}
                  onClick={() =>
                    void saveQuickDecision({ fieldPath: "final.image", decision: "image_approved" })
                  }
                >
                  Finalbild passt
                </button>
              ) : processedImageNeedsWork ? (
                <>
                  <button
                    className="smallButton"
                    type="button"
                    disabled={isBusy || finalImageApproved}
                    onClick={() =>
                      void saveQuickDecision({
                        fieldPath: "final.image",
                        decision: "image_approved",
                      })
                    }
                  >
                    Finalbild trotzdem freigeben
                  </button>
                  <button
                    className="smallButton secondaryButton"
                    type="button"
                    disabled={isBusy || !imageResearched}
                    onClick={() => void requestImageSearchRework()}
                  >
                    Besseres Bild suchen
                  </button>
                </>
              ) : imageSelected ? (
                <button
                  className="smallButton"
                  type="button"
                  disabled={isBusy || !jobId}
                  onClick={() => void requestImageProcessing()}
                >
                  {imageProcessingQueued
                    ? "Bildverarbeitung neu starten"
                    : "Bildverarbeitung starten"}
                </button>
              ) : (
                <button className="smallButton" type="button" disabled>
                  Finalbild passt
                </button>
              )}
            </div>
          }
          status={
            finalImageApproved
              ? "done"
              : processedImageReady
                ? "active"
                : processedImageNeedsWork
                  ? "active"
                  : imageProcessingQueued
                    ? "active"
                    : "pending"
          }
          title="2. Bild verarbeitet"
        >
          {finalImageApproved
            ? "Verarbeitetes Bild ist freigegeben."
            : processedImageReady
              ? "Pruefe das verarbeitete Bild fuer den finalen Check."
              : processedImageNeedsWork
                ? "Der Worker hat verarbeitet, aber die Bild-QA braucht ein besseres Bild."
                : imageProcessingQueued
                  ? "Bildverarbeitung ist eingereiht oder laeuft."
                  : "Startet nach Rohbild-Auswahl."}
        </ActionCard>
        <ActionCard
          action={
            <button
              className="smallButton"
              type="button"
              disabled={isBusy || !propertiesResearched || propertiesApproved}
              onClick={() =>
                void saveQuickDecision({ fieldPath: "final.properties", decision: "approved" })
              }
            >
              Eigenschaften passen
            </button>
          }
          status={propertiesApproved ? "done" : propertiesResearched ? "active" : "pending"}
          title="3. Eigenschaften"
        >
          {propertiesApproved
            ? "Eigenschaften sind freigegeben."
            : propertiesResearched
              ? "Pruefe die recherchierten Eigenschaften."
              : "Wartet auf Property-Research."}
        </ActionCard>
        <ActionCard
          action={
            <button
              className={publishCompleted ? "completedButton" : "smallButton dangerButton"}
              type="button"
              disabled={isBusy || !readyForFinalApproval || publishCompleted}
              onClick={() =>
                void postAction(
                  `/api/submissions/${submissionId}/publish`,
                  { confirm: true },
                  {
                    action: "publish",
                    busyMessage:
                      "Supabase-Handoff laeuft. Produkt, User-Link und Benachrichtigung werden geschrieben.",
                  },
                )
              }
            >
              {busyAction === "publish"
                ? "Freigabe laeuft..."
                : publishCompleted
                  ? "Bereits in Supabase freigegeben"
                  : "Produkt in Supabase freigeben"}
            </button>
          }
          status={
            busyAction === "publish"
              ? "busy"
              : publishCompleted
                ? "done"
                : readyForFinalApproval
                  ? "active"
                  : "pending"
          }
          title="4. Finaler Handoff"
        >
          {busyAction === "publish"
            ? "Supabase-Handoff laeuft. Bitte warten, bis Erfolg oder Fehler angezeigt wird."
            : publishCompleted
              ? "Produkt wurde in Supabase freigegeben."
              : readyForFinalApproval
                ? "Bild und Eigenschaften sind freigegeben. Naechster Klick startet den Supabase-Handoff."
                : "Wird aktiv, sobald Finalbild und Eigenschaften freigegeben sind."}
        </ActionCard>
      </div>

      {message ? <span className={messageClassName(message.tone)}>{message.text}</span> : null}

      <ImageSearchProgress
        jobStatus={jobStatus}
        localState={imageSearchActionState}
        visible={imageSearchProgressVisible}
      />

      <ImageProcessingProgress
        finalImageApproved={finalImageApproved}
        jobStage={jobStage}
        jobStatus={jobStatus}
        localState={imageProcessingActionState}
        processedImageNeedsWork={processedImageNeedsWork}
        processedImageReady={processedImageReady}
        visible={imageProcessingQueued || processedImageReady || processedImageNeedsWork}
      />

      <section className="reviewActionPanel" aria-labelledby="review-actions-heading">
        <div className="reviewActionPanelHeader">
          <div>
            <h3 id="review-actions-heading">Korrekturen und neuer Research-Lauf</h3>
            <p>
              Markiere Bild- oder Eigenschaftsprobleme hier sichtbar. Wenn alles markiert ist,
              starte die Ueberarbeitung fuer dieses Produkt.
            </p>
          </div>
          <div className="actionCluster reviewActionGroup">
            <button
              className="smallButton"
              type="button"
              disabled={isBusy}
              onClick={() =>
                void postAction(
                  jobId && retryableStatuses.has(jobStatus)
                    ? `/api/jobs/${jobId}/retry`
                    : `/api/submissions/${submissionId}/research`,
                  undefined,
                  { action: "research", busyMessage: "Research-Job wird gestartet." },
                )
              }
            >
              {busyAction === "research"
                ? "Research startet..."
                : jobId && retryableStatuses.has(jobStatus)
                  ? "Retry"
                  : "Research starten"}
            </button>
            <button
              className="smallButton secondaryButton"
              type="button"
              disabled={isBusy || !jobId}
              onClick={() => void requestProductRework()}
            >
              {busyAction === "rework" ? "Rework startet..." : "Aenderungen neu recherchieren"}
            </button>
          </div>
        </div>
        <div className="commentBox">
          <label>
            Feld
            <input value={fieldPath} onChange={(event) => setFieldPath(event.target.value)} />
          </label>
          <label>
            Entscheidung
            <select
              value={decision}
              onChange={(event) =>
                updateDecision(event.target.value as (typeof decisionOptions)[number][0])
              }
            >
              {decisionOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kommentar
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          <button
            className="smallButton"
            type="button"
            disabled={isBusy || (decision === "change_requested" && !comment.trim())}
            onClick={() => void saveDecision()}
          >
            Entscheidung speichern
          </button>
        </div>
        <div className="actionCluster reviewActionGroup technicalActionGroup">
          <button
            className="smallButton secondaryButton"
            type="button"
            disabled={isBusy}
            onClick={() =>
              void postAction(`/api/submissions/${submissionId}/publish-preflight`, undefined, {
                action: "preflight",
                busyMessage: "Publish-Preflight wird geprueft.",
              })
            }
          >
            Publish-Preflight
          </button>
          <button
            className={publishCompleted ? "completedButton" : "smallButton dangerButton"}
            type="button"
            disabled={isBusy || !readyForFinalApproval || publishCompleted}
            onClick={() =>
              void postAction(
                `/api/submissions/${submissionId}/publish`,
                { confirm: true },
                {
                  action: "publish",
                  busyMessage:
                    "Supabase-Handoff laeuft. Produkt, User-Link und Benachrichtigung werden geschrieben.",
                },
              )
            }
          >
            {busyAction === "publish"
              ? "Freigabe laeuft..."
              : publishCompleted
                ? "Bereits in Supabase freigegeben"
                : "Produkt final freigeben"}
          </button>
        </div>
      </section>
    </div>
  )
}

function ImageProcessingProgress({
  finalImageApproved,
  jobStage,
  jobStatus,
  localState,
  processedImageNeedsWork,
  processedImageReady,
  visible,
}: {
  finalImageApproved: boolean
  jobStage: string
  jobStatus: string
  localState: ImageProcessingActionState
  processedImageNeedsWork: boolean
  processedImageReady: boolean
  visible: boolean
}) {
  if (!visible || finalImageApproved) return null

  const isImageProcessingJob = jobStage === "image_judging"
  const isQueued = localState === "queued" || (isImageProcessingJob && jobStatus === "queued")
  const isRunning = isImageProcessingJob && jobStatus === "running"
  const isReady = processedImageReady
  const isError =
    processedImageNeedsWork ||
    (isImageProcessingJob && (jobStatus === "blocked" || jobStatus === "failed"))

  const headline = isRunning
    ? "Worker verarbeitet das Bild"
    : isReady
      ? "Verarbeitetes Bild pruefen"
      : processedImageNeedsWork
        ? "Bildverarbeitung braucht Arbeit"
        : isError
          ? "Bildverarbeitung braucht Aufmerksamkeit"
          : "Bildverarbeitung eingereiht"
  const description = isRunning
    ? "Der Worker entfernt Hintergrundreste, normalisiert Groesse und erstellt die Magenta-QA."
    : isReady
      ? "Das verarbeitete Bild ist fertig. Pruefe es unten und gib danach das Finalbild frei."
      : processedImageNeedsWork
        ? "Der Worker ist fertig, aber die Bild-QA hat Schatten, Reflexionen oder Hintergrundreste gefunden. Pruefe unten die Magenta-QA und fordere ein neues Bild an."
        : isError
          ? "Die Verarbeitung konnte nicht sauber abgeschlossen werden. Details stehen im aktiven Research-Status."
          : isQueued
            ? "Das Rohbild ist freigegeben und wartet auf den Worker. Diese Seite aktualisiert sich automatisch."
            : "Das Rohbild ist freigegeben. Sobald der Worker startet, siehst du hier den laufenden Verarbeitungsschritt."

  const steps = [
    {
      label: "Rohbild freigegeben",
      status: "done",
    },
    {
      label: "Bildverarbeitung eingereiht",
      status: isQueued || isRunning || isReady || isError ? "done" : "active",
    },
    {
      label: "Worker verarbeitet das Bild",
      status: isRunning
        ? "active"
        : isReady
          ? "done"
          : processedImageNeedsWork
            ? "done"
            : isError
              ? "error"
              : "pending",
    },
    {
      label: "Verarbeitetes Bild pruefen",
      status: isReady ? "active" : isError ? "error" : "pending",
    },
  ] as const

  return (
    <section
      className={`imageSearchProgress imageProcessingProgress${isError ? " imageSearchProgress-error" : ""}`}
    >
      <div className="imageSearchProgressHeader">
        <div>
          <p className="jobActivityEyebrow">Bildverarbeitung</p>
          <h3>{headline}</h3>
          <p>{description}</p>
        </div>
        <span>{isImageProcessingJob ? jobStatus : "wartet"}</span>
      </div>
      <ol className="progressSteps" aria-label="Fortschritt der Bildverarbeitung">
        {steps.map((step) => (
          <li className={`progressStep progressStep-${step.status}`} key={step.label}>
            <span aria-hidden="true" />
            {step.label}
          </li>
        ))}
      </ol>
      <p className="imageSearchProgressHint">
        {processedImageNeedsWork
          ? "Naechster Schritt: Bild passt nicht - neues Bild suchen, damit der Worker eine sauberere Quelle pruefen kann."
          : 'Fertig ist die Bildverarbeitung, wenn hier "Verarbeitetes Bild pruefen" steht und unten ein verarbeitetes Bild plus Magenta-QA erscheint.'}
      </p>
    </section>
  )
}

function ImageSearchProgress({
  jobStatus,
  localState,
  visible,
}: {
  jobStatus: string
  localState: ImageSearchActionState
  visible: boolean
}) {
  if (!visible) return null

  const isSaving = localState === "saving"
  const isQueued =
    localState === "queued" || jobStatus === "queued" || jobStatus === "waiting_for_rework"
  const isRunning = jobStatus === "running"
  const isReady = jobStatus === "waiting_for_review"
  const isError = jobStatus === "blocked" || jobStatus === "failed"

  const headline = isSaving
    ? "Bildsuche wird vorbereitet"
    : isRunning
      ? "Worker sucht neues Bild"
      : isReady
        ? "Neuen Bildvorschlag pruefen"
        : isError
          ? "Bildsuche braucht Aufmerksamkeit"
          : "Bildsuche eingereiht"
  const description = isSaving
    ? "Deine Ablehnung wird gespeichert. Danach wird der Rework-Job angelegt."
    : isRunning
      ? "Der Worker sucht gerade nach einem besseren Produktbild nach den Bildregeln."
      : isReady
        ? "Der Worker ist fertig. Pruefe jetzt den neuen Bildvorschlag oben im Review."
        : isError
          ? "Der Worker hat kein brauchbares Bild gefunden oder ist fehlgeschlagen. Details stehen im aktiven Research-Status."
          : "Der Auftrag ist gespeichert und wartet auf den Worker. Diese Seite aktualisiert sich automatisch."

  const steps = [
    {
      label: "Bild abgelehnt",
      status: isSaving || isQueued || isRunning || isReady || isError ? "done" : "active",
    },
    {
      label: "Bildsuche eingereiht",
      status: isSaving
        ? "active"
        : isQueued || isRunning || isReady || isError
          ? "done"
          : "pending",
    },
    {
      label: "Worker sucht neues Bild",
      status: isRunning ? "active" : isReady ? "done" : isError ? "error" : "pending",
    },
    {
      label: "Neuen Bildvorschlag pruefen",
      status: isReady ? "active" : isError ? "error" : "pending",
    },
  ] as const

  return (
    <section className={`imageSearchProgress${isError ? " imageSearchProgress-error" : ""}`}>
      <div className="imageSearchProgressHeader">
        <div>
          <p className="jobActivityEyebrow">Bildsuche</p>
          <h3>{headline}</h3>
          <p>{description}</p>
        </div>
        <span>{jobStatus}</span>
      </div>
      <ol className="progressSteps" aria-label="Fortschritt der neuen Bildsuche">
        {steps.map((step) => (
          <li className={`progressStep progressStep-${step.status}`} key={step.label}>
            <span aria-hidden="true" />
            {step.label}
          </li>
        ))}
      </ol>
      <p className="imageSearchProgressHint">
        Fertig ist die Bildsuche, wenn hier "Neuen Bildvorschlag pruefen" steht und im Bildvorschlag
        ein neuer Kandidat erscheint.
      </p>
    </section>
  )
}

function ActionCard({
  action,
  children,
  className,
  status,
  title,
}: {
  action: ReactNode
  children: ReactNode
  className?: string
  status: "done" | "active" | "pending" | "busy"
  title: string
}) {
  return (
    <section className={`${workflowCardClassName(status)}${className ? ` ${className}` : ""}`}>
      <div>
        <span className="workflowStatus">{statusLabel(status)}</span>
        <h3>{title}</h3>
        <div className="workflowCardBody">{children}</div>
      </div>
      {status === "busy" ? (
        <div className="cardProgress" aria-label="Aktion laeuft">
          <span />
        </div>
      ) : null}
      {action}
    </section>
  )
}

function statusLabel(status: "done" | "active" | "pending" | "busy") {
  if (status === "done") return "Erledigt"
  if (status === "busy") return "Laeuft"
  if (status === "active") return "Jetzt"
  return "Wartet"
}

function workflowCardClassName(status: "done" | "active" | "pending" | "busy") {
  if (status === "busy") return "workflowCard workflowCard-busy"
  if (status === "done") return "workflowCard workflowCard-done"
  if (status === "active") return "workflowCard workflowCard-active"
  return "workflowCard"
}

function messageClassName(tone: ActionMessage["tone"]) {
  if (tone === "error") return "actionMessage actionMessage-error"
  if (tone === "success") return "actionMessage actionMessage-success"
  return "actionMessage"
}

function buildMessage(result: {
  message?: string
  job?: { jobStatus: string; jobStage?: string }
  preflight?: { ok: boolean; blockers: string[]; next_action: string }
}) {
  if (result.message) return result.message
  if (result.preflight) {
    if (result.preflight.ok) return result.preflight.next_action
    return `Preflight blockiert: ${result.preflight.blockers.join(" · ")}`
  }
  return `Gespeichert: ${result.job?.jobStatus ?? "ok"}.`
}
