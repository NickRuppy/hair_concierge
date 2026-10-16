"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type {
  ProductIntakeReviewDecisionRow,
  ReviewPublicationReceipt,
} from "@chaarlie/product-intake-core"
import type { ProductReviewDetail } from "@/lib/product-intake/admin-review-repository"
import { ProductReviewImages } from "./review-images"

type Review = NonNullable<ProductReviewDetail["publication_review"]>
type Confirmation = {
  title: string
  description: string
  label: string
  body: Record<string, unknown>
}
const card = "rounded-xl border bg-card p-5 shadow-sm sm:p-6"
const input =
  "mt-2 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-primary"
const blockerLabels: Record<string, string> = {
  review_data_approval_required: "Werte und Anwendung sind noch nicht freigegeben.",
  review_image_approval_required: "Das Katalogbild ist noch nicht freigegeben.",
  review_properties_not_approved: "Werte und Anwendung sind noch nicht freigegeben.",
  review_image_not_approved: "Das Katalogbild ist noch nicht freigegeben.",
  review_payload_invalid: "Erforderliche Produktangaben oder Anwendungsdaten fehlen.",
  review_payload_normalization_required:
    "Die gespeicherten Werte brauchen eine aktualisierte Recherche und Prüfung.",
  review_image_missing: "Das vorbereitete Katalogbild und sein Vorschaubild fehlen.",
  review_image_finalizer_invalid:
    "Die Bildaufbereitung muss vor der Veröffentlichung erneut geprüft werden.",
  review_job_not_ready: "Die Recherche ist noch nicht bereit für die abschließende Prüfung.",
  review_submission_not_ready: "Der Eintrag ist noch nicht bereit zur Veröffentlichung.",
  review_unresolved_decisions: "Es sind noch Rückfragen oder Nacharbeiten offen.",
  review_stale: "Die Recherche hat sich geändert. Bitte lade den Eintrag neu.",
  submission_not_ready: "Der Eintrag ist noch nicht bereit zur Veröffentlichung.",
  job_not_reviewable: "Die Recherche ist noch nicht bereit für die abschließende Prüfung.",
  data_approval_missing: "Werte und Anwendung sind noch nicht freigegeben.",
  image_approval_missing: "Das Katalogbild ist noch nicht freigegeben.",
  unresolved_review_questions: "Es sind noch Rückfragen oder Nacharbeiten offen.",
  approved_private_image_missing:
    "Das vorbereitete Katalogbild oder die passende Bildfreigabe fehlt.",
}
const noticeFor = (code: string) =>
  blockerLabels[code] ??
  "Ein offener Prüfpunkt verhindert die Veröffentlichung. Bitte prüfe die Recherche und offenen Fragen."

export function ProductReviewActions({
  detail,
  reloadHref,
}: {
  detail: ProductReviewDetail
  reloadHref: string
}) {
  const router = useRouter()
  const initial = detail.publication_review ?? null
  const [review, setReview] = useState<Review | null>(initial)
  const [receipt, setReceipt] = useState<ReviewPublicationReceipt | null>(
    initial?.publication ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [pendingPublish, setPendingPublish] = useState<Record<string, unknown> | null>(null)
  const [rendered, setRendered] = useState<Record<string, boolean>>({})
  const [imageChecked, setImageChecked] = useState(false)
  const [comment, setComment] = useState("")
  const [field, setField] = useState("product.canonical_brand")
  const [answer, setAnswer] = useState("")
  const [reason, setReason] = useState("")
  const [nextStep, setNextStep] = useState("")
  const [productId, setProductId] = useState("")
  const submission = detail.submission
  const title =
    [submission.brand_text, submission.product_name_text].filter(Boolean).join(" · ") ||
    "Dieses Produkt"
  const storageKey = `product-review-publication:${submission.id}`
  const endpoint = `/api/admin/produkt-intake/${submission.id}/actions`
  const authorityIdentity = JSON.stringify([
    initial?.payload_revision,
    initial?.payload_sha256,
    initial?.job_id,
    initial?.review_cycle_id,
    initial?.data_decision_id,
    initial?.image_decision_id,
    initial?.publication?.id,
    initial?.publication?.notification_status,
  ])
  const previousAuthority = useRef(authorityIdentity)

  useEffect(() => {
    if (previousAuthority.current === authorityIdentity) return
    previousAuthority.current = authorityIdentity
    setReview(initial)
    setReceipt(initial?.publication ?? null)
    if (initial?.publication) {
      sessionStorage.removeItem(storageKey)
      setPendingPublish(null)
    }
  }, [initial, storageKey, authorityIdentity])
  useEffect(() => {
    if (initial?.publication) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as Record<
        string,
        unknown
      > | null
      if (saved?.action === "publish" && typeof saved.request_id === "string")
        setPendingPublish(saved)
    } catch {
      sessionStorage.removeItem(storageKey)
    }
  }, [initial?.publication, storageKey])
  const onRendered = useCallback((kind: string, available: boolean) => {
    setRendered((previous) =>
      previous[kind] === available ? previous : { ...previous, [kind]: available },
    )
    if (!available) setImageChecked(false)
  }, [])
  const binding = () => ({
    request_id: crypto.randomUUID(),
    job_id: review?.job_id ?? null,
    review_cycle_id: review?.review_cycle_id ?? null,
    payload_revision: submission.payload_revision,
    payload_sha256: submission.payload_sha256,
  })
  const mutable = Boolean(
    review &&
    !receipt &&
    !pendingPublish &&
    !busy &&
    !["queued", "running", "waiting_for_rework", "publishing"].includes(detail.job?.status ?? "") &&
    ["pending_review", "researching", "ready_for_review", "needs_more_info"].includes(
      submission.status,
    ),
  )
  const imagesReady = ["raw", "magenta", "final"].every((kind) => rendered[kind])
  const raw = detail.images?.find((image) => image.kind === "raw")
  const finalImage = detail.images?.find((image) => image.kind === "final")
  const pendingNotifications = detail.decisions.filter((row) =>
    ["pending", "failed"].includes(
      (row as ProductIntakeReviewDecisionRow & { notification_status?: string })
        .notification_status ?? "",
    ),
  )

  async function post(body: Record<string, unknown>) {
    if (reloadHref.startsWith("/labs/")) {
      if (process.env.NODE_ENV !== "development") throw new Error("Vorschau nicht verfügbar.")
      const { runLabReviewAction } = await import("@/app/labs/produkt-intake/review-lab-actions")
      return runLabReviewAction(submission.id, body, review)
    }
    return fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  }

  async function run(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    setFeedback("")
    const publishing = body.action === "publish"
    if (publishing) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(body))
      } catch {
        setError(
          "Der Veröffentlichungsvorgang konnte im Browser nicht gesichert werden. Bitte erlaube Sitzungsspeicher und versuche es erneut.",
        )
        setBusy(false)
        return
      }
      setPendingPublish(body)
    }
    try {
      const response = await post(body)
      const result = (await response.json()) as Record<string, unknown> & {
        error?: string
        publication?: ReviewPublicationReceipt
        decision?: { notification_status?: string }
        notification_status?: string
      }
      if (!response.ok) {
        if (publishing && response.status < 500) {
          sessionStorage.removeItem(storageKey)
          setPendingPublish(null)
        }
        throw new Error(result.error ?? "Die Aktion konnte nicht abgeschlossen werden.")
      }
      if (body.action === "preflight") {
        setReview(result as unknown as Review)
        setFeedback(
          result.ok
            ? "Die Veröffentlichung ist vorbereitet. Bitte bestätige den finalen Schritt."
            : "Die Prüfung ist aktualisiert. Offene Punkte findest du unten.",
        )
      } else if (publishing && result.publication) {
        setReceipt(result.publication)
        setPendingPublish(null)
        sessionStorage.removeItem(storageKey)
        setFeedback(
          ["sent", "not_required"].includes(result.publication.notification_status)
            ? "Produkt veröffentlicht. Die Übergabe ist abgeschlossen."
            : "Produkt veröffentlicht. Die Kundennachricht ist noch ausstehend.",
        )
      } else if (body.action === "retry_publication_notification") {
        setReceipt((previous) =>
          previous
            ? {
                ...previous,
                notification_status:
                  result.notification_status as ReviewPublicationReceipt["notification_status"],
              }
            : previous,
        )
        setFeedback(
          result.notification_status === "sent"
            ? "Die Kundennachricht wurde bestätigt."
            : "Die Nachricht ist weiterhin ausstehend. Das Produkt wird nicht erneut veröffentlicht.",
        )
      } else {
        setFeedback(
          result.decision?.notification_status === "failed"
            ? "Entscheidung gespeichert. Die Kundennachricht ist noch ausstehend."
            : body.action === "rework" || body.action === "answer" || body.action === "approve_raw"
              ? "Neue Prüfung angefordert. Bisherige Freigaben gelten nicht für diesen Durchlauf."
              : "Entscheidung gespeichert.",
        )
      }
      if (
        ["approve_data", "approve_image", "approve_no_image", "reject_image"].includes(
          String(body.action),
        )
      ) {
        const refreshed = await post({ ...binding(), action: "preflight" })
        if (refreshed.ok) setReview((await refreshed.json()) as Review)
      }
      setConfirmation(null)
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Das Ergebnis konnte nicht bestätigt werden. Bitte lade den aktuellen Stand.",
      )
    } finally {
      setBusy(false)
    }
  }
  function ask(title: string, description: string, label: string, body: Record<string, unknown>) {
    setError("")
    setConfirmation({ title, description, label, body })
  }
  function publishConfirmation() {
    if (!review?.ok || !review.data_decision_id || !review.image_decision_id) return
    ask(
      "Produkt jetzt veröffentlichen?",
      `${title} · Rechercheversion ${submission.payload_revision}. Die geprüften Werte und das freigegebene Bild werden in den Katalog übernommen. Das Produkt wird mit dem einreichenden Kunden verknüpft und die Prüfung im Chat bestätigt. Eine globale Empfehlung ist damit nicht freigegeben.`,
      "Jetzt veröffentlichen",
      {
        ...binding(),
        action: "publish",
        data_decision_id: review.data_decision_id,
        image_decision_id: review.image_decision_id,
        confirm: true,
      },
    )
  }
  return (
    <>
      <section className={card}>
        <h2 className="text-lg font-semibold">Bild prüfen</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Vergleiche Rohbild, Magenta-Prüfung und Katalogbild für diese Version.
        </p>
        <ProductReviewImages
          images={detail.images}
          reloadHref={reloadHref}
          onRendered={onRendered}
        />
        {review?.image_decision_id && (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-800">
            <Check className="h-4 w-4" />
            Bild für diese Version freigegeben.
          </p>
        )}
        {finalImage && !review?.image_decision_id && (
          <>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={imageChecked}
                disabled={!mutable || !imagesReady}
                onChange={(event) => setImageChecked(event.target.checked)}
              />
              Ich habe die drei Bilder geprüft. Produkt, Beschriftung und Freistellung stimmen.
            </label>
            <Button
              className="mt-4"
              disabled={!mutable || !imagesReady || !imageChecked}
              onClick={() =>
                run({
                  ...binding(),
                  action: "approve_image",
                  approved_asset_sha256: finalImage.sha256,
                })
              }
            >
              Katalogbild freigeben
            </Button>
          </>
        )}
        {!finalImage && raw && (
          <Button
            variant="outline"
            className="mt-4 w-full"
            disabled={!mutable || !rendered.raw}
            onClick={() =>
              ask(
                "Dieses Rohbild aufbereiten?",
                "Dieses exakte Bild wird für einen neuen, begrenzten Durchlauf ausgewählt. Bisherige Freigaben gelten danach nicht mehr.",
                "Bildaufbereitung anfordern",
                { ...binding(), action: "approve_raw", approved_asset_sha256: raw.sha256 },
              )
            }
          >
            Rohbild auswählen und aufbereiten
          </Button>
        )}
        {review?.can_approve_no_image && !review.image_decision_id && (
          <details className="mt-4 text-sm">
            <summary className="min-h-11 cursor-pointer text-primary">
              Ausnahme: ausdrücklich ohne Bild freigeben
            </summary>
            <label className="block">
              Begründung
              <textarea
                className={input}
                value={comment}
                maxLength={4000}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={!mutable || !comment.trim()}
              onClick={() =>
                ask(
                  "Ohne Bild freigeben?",
                  "Der aktuelle Vorschlag enthält kein Katalogbild. Die Begründung wird mit dieser Version gespeichert.",
                  "Ohne Bild freigeben",
                  { ...binding(), action: "approve_no_image", comment: comment.trim() },
                )
              }
            >
              Ohne Bild freigeben
            </Button>
          </details>
        )}
      </section>
      <section className={card} aria-busy={busy}>
        <h2 className="text-lg font-semibold">Prüfung &amp; Abschluss</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Freigaben gelten nur für die angezeigte Rechercheversion. Die Veröffentlichung bestätigst
          du anschließend separat.
        </p>
        <div className="mt-4" role="status" aria-live="polite">
          {feedback && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{feedback}</p>
          )}
          {busy && <p className="text-sm text-muted-foreground">Aktion wird geprüft …</p>}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        )}
        {!review && (
          <p className="mt-4 text-sm text-muted-foreground">
            Die Freigabeprüfung konnte nicht bestätigt werden. Bitte lade den Eintrag neu. Die
            Recherche bleibt sichtbar.
          </p>
        )}
        {receipt ? (
          <div className="mt-4 space-y-3">
            <p className="font-medium text-emerald-800">
              Produkt veröffentlicht · Version {receipt.payload_revision}
            </p>
            <a
              className="inline-flex min-h-11 items-center text-sm text-primary underline"
              href="/admin/products"
            >
              Zum Produktkatalog
            </a>
            <p className="break-all text-xs text-muted-foreground">
              Produkt-ID: {receipt.product_id}
            </p>
            <p className="text-sm text-muted-foreground">
              {receipt.notification_status === "sent"
                ? "Kundennachricht bestätigt. Die Übergabe ist abgeschlossen."
                : receipt.notification_status === "not_required"
                  ? "Für diesen Eintrag ist keine Kundennachricht erforderlich."
                  : "Die Kundennachricht ist noch ausstehend. Das Produkt bleibt veröffentlicht."}
            </p>
            {["pending", "failed"].includes(receipt.notification_status) && (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  run({
                    action: "retry_publication_notification",
                    publication_id: receipt.id,
                    confirm: true,
                  })
                }
              >
                Nur Kundennachricht erneut prüfen
              </Button>
            )}
          </div>
        ) : pendingPublish ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p>
              Das Ergebnis der Veröffentlichung ist noch nicht bestätigt. Wir prüfen denselben
              Vorgang, bevor eine weitere Aktion möglich ist.
            </p>
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => run(pendingPublish)}
            >
              Diesen Veröffentlichungsvorgang prüfen
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {review?.data_decision_id ? (
              <p className="flex items-center gap-2 text-sm text-emerald-800">
                <Check className="h-4 w-4" />
                Werte und Anwendung für diese Version freigegeben.
              </p>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={!mutable || Boolean(review?.validation_blockers.length)}
                onClick={() => run({ ...binding(), action: "approve_data" })}
              >
                Werte und Anwendung freigeben
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              disabled={!review || busy}
              onClick={() => run({ ...binding(), action: "preflight" })}
            >
              <RefreshCw className="h-4 w-4" />
              Veröffentlichung prüfen
            </Button>
            <Button disabled={!mutable || !review?.ok} onClick={publishConfirmation}>
              Zur Veröffentlichungsfreigabe
            </Button>
            {review && !review.ok && (
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {[...new Set(review.blockers.map(noticeFor))].map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <a
          href={reloadHref}
          className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline"
        >
          Aktuellen Stand laden
        </a>
      </section>
      {!receipt && !pendingPublish && (
        <section className={card}>
          <h2 className="text-lg font-semibold">Entscheiden &amp; nacharbeiten</h2>
          <details className="mt-3 text-sm">
            <summary className="min-h-11 cursor-pointer text-primary">
              Identität oder zusätzlichen Eintrag klären
            </summary>
            <p className="mb-3 text-muted-foreground">
              Die Antwort wird gespeichert und in einem neuen begrenzten Durchlauf geprüft. Es wird
              dadurch kein Produkt veröffentlicht.
            </p>
            <label>
              Entscheidung
              <select
                className={input}
                value={field}
                onChange={(event) => {
                  setField(event.target.value)
                  setAnswer("")
                }}
              >
                <option value="product.canonical_brand">Exakte Marke</option>
                <option value="product.product_line">Produktlinie</option>
                <option value="product.clean_name">Produktname</option>
                <option value="research.separate_deep_cleanser_listing">
                  Zusätzlicher Tiefenreinigungs-Eintrag
                </option>
              </select>
            </label>
            {field === "research.separate_deep_cleanser_listing" ? (
              <label className="mt-3 block">
                Für dieses Shampoo
                <select
                  className={input}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                >
                  <option value="">Bitte auswählen</option>
                  <option value="keep_regular_only">
                    Nur den regulären Shampoo-Eintrag behalten
                  </option>
                  <option value="review_extra_separately">
                    Zusätzlichen Eintrag separat prüfen
                  </option>
                </select>
                <span className="mt-2 block text-xs text-muted-foreground">
                  Der zusätzliche Eintrag wird nicht automatisch angelegt.
                </span>
              </label>
            ) : (
              <label className="mt-3 block">
                Exakter Wert
                <input
                  className={input}
                  value={answer}
                  maxLength={500}
                  onChange={(event) => setAnswer(event.target.value)}
                />
              </label>
            )}
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={!mutable || !answer.trim()}
              onClick={() =>
                run({ ...binding(), action: "answer", field_path: field, value: answer.trim() })
              }
            >
              Antwort speichern und neu prüfen
            </Button>
          </details>
          <details className="mt-3 text-sm">
            <summary className="min-h-11 cursor-pointer text-primary">
              Nacharbeit oder anderes Bild anfordern
            </summary>
            <label>
              Was soll geändert werden?
              <textarea
                className={input}
                value={comment}
                maxLength={4000}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Startet einen neuen begrenzten Durchlauf. Bisherige Freigaben gelten danach nicht
              mehr.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={!mutable || !comment.trim()}
                onClick={() => run({ ...binding(), action: "rework", comment: comment.trim() })}
              >
                Nacharbeit anfordern
              </Button>
              <Button
                variant="outline"
                disabled={!mutable || !comment.trim() || !finalImage}
                onClick={() =>
                  run({ ...binding(), action: "reject_image", comment: comment.trim() })
                }
              >
                Bildfreigabe zurücknehmen
              </Button>
            </div>
          </details>
          <details className="mt-3 text-sm">
            <summary className="min-h-11 cursor-pointer text-primary">
              Kunden um Informationen bitten oder Eintrag ablehnen
            </summary>
            <label>
              Nachricht an den Kunden
              <textarea
                className={input}
                value={reason}
                maxLength={4000}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label className="mt-3 block">
              Was soll der Kunde als Nächstes tun?
              <textarea
                className={input}
                value={nextStep}
                maxLength={4000}
                onChange={(event) => setNextStep(event.target.value)}
              />
            </label>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={!mutable || !reason.trim() || !nextStep.trim()}
                onClick={() =>
                  ask(
                    "Informationen vom Kunden anfordern?",
                    "Die Recherche wird angehalten. Der Kunde erhält die eingegebene Rückfrage im Chat. Ein späterer erneuter Versuch wiederholt dieselbe Nachricht nicht.",
                    "Rückfrage senden",
                    {
                      ...binding(),
                      action: "request_info",
                      reason: reason.trim(),
                      next_step: nextStep.trim(),
                      missing_fields: [],
                      confirm: true,
                    },
                  )
                }
              >
                Rückfrage vorbereiten
              </Button>
              <Button
                variant="outline"
                disabled={!mutable || !reason.trim()}
                onClick={() =>
                  ask(
                    "Diesen Eintrag ablehnen?",
                    "Die Recherche wird beendet. Der Kunde erhält die eingegebene Begründung im Chat. Das Produkt wird nicht veröffentlicht.",
                    "Eintrag ablehnen",
                    {
                      ...binding(),
                      action: "reject",
                      reason: reason.trim(),
                      next_step: nextStep.trim(),
                      confirm: true,
                    },
                  )
                }
              >
                Ablehnung vorbereiten
              </Button>
            </div>
          </details>
          <details className="mt-3 text-sm">
            <summary className="min-h-11 cursor-pointer text-primary">
              Mit vorhandenem Katalogprodukt verknüpfen
            </summary>
            <label>
              Produkt-ID des exakt passenden Eintrags
              <input
                className={input}
                value={productId}
                maxLength={36}
                onChange={(event) => setProductId(event.target.value)}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Verknüpft den bestehenden Eintrag mit dem Kunden. Seine Katalogwerte werden dadurch
              nicht geändert.
            </p>
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={!mutable || !/^[a-f0-9-]{36}$/i.test(productId)}
              onClick={() =>
                ask(
                  "Vorhandenes Produkt verknüpfen?",
                  `Die Recherche wird beendet. Der bestehende Eintrag ${productId} wird mit dem Kunden verknüpft und im Chat bestätigt.`,
                  "Produkt verknüpfen",
                  { ...binding(), action: "link_existing", product_id: productId, confirm: true },
                )
              }
            >
              Verknüpfung prüfen
            </Button>
          </details>
        </section>
      )}
      {pendingNotifications.length > 0 && (
        <section className={card}>
          <h2 className="text-lg font-semibold">Ausstehende Kundennachrichten</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Gespeicherte Entscheidungen bleiben erhalten. Hier wird nur ihre fehlende Chat-Nachricht
            erneut geprüft.
          </p>
          {pendingNotifications.map((row) => (
            <Button
              key={row.id}
              variant="outline"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() =>
                run({ action: "retry_decision_notification", decision_id: row.id, confirm: true })
              }
            >
              Nachricht zur Entscheidung erneut prüfen
            </Button>
          ))}
        </section>
      )}
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null)
        }}
      >
        <DialogContent>
          <DialogTitle>{confirmation?.title}</DialogTitle>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {confirmation?.description}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              Abbrechen
            </Button>
            <Button disabled={busy} onClick={() => confirmation && run(confirmation.body)}>
              {busy ? "Wird geprüft …" : confirmation?.label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
