import Link from "next/link"
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw } from "lucide-react"
import {
  PRODUCT_REVIEW_GROUPS,
  PRODUCT_REVIEW_GROUP_LABELS,
  productReviewGroup,
  productReviewRecord,
  productReviewSourceUrl,
  productReviewValues,
  type ProductReviewGroup,
  type ProductReviewQueueEntry,
} from "@/lib/product-intake/admin-review-model"
import type { ProductReviewDetail } from "@/lib/product-intake/admin-review-repository"
import { ProductReviewActions } from "./review-actions"

const categoryLabels: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  mask: "Maske",
  leave_in: "Leave-in",
  oil: "Öl",
  heat_protectant: "Hitzeschutz",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  deep_cleansing_shampoo: "Tiefenreinigung",
  bondbuilder: "Bondbuilder",
  peeling: "Peeling",
}
const badgeStyles: Record<ProductReviewGroup, string> = {
  ready: "bg-emerald-50 text-emerald-800",
  decisions: "bg-amber-50 text-amber-900",
  errors: "bg-red-50 text-red-800",
  processing: "bg-primary/10 text-primary",
}
const card = "rounded-xl border bg-card p-5 shadow-sm sm:p-6"

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Datum unbekannt"
    : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(
        date,
      )
}

function Status({ group }: { group: ProductReviewGroup }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeStyles[group]}`}
    >
      {PRODUCT_REVIEW_GROUP_LABELS[group]}
    </span>
  )
}

export function ProductReviewUnavailable({ href = "/admin/produkt-intake" }: { href?: string }) {
  return (
    <section className={card} role="alert">
      <h1 className="text-xl font-semibold">Produktprüfung gerade nicht verfügbar</h1>
      <p className="mt-2 text-muted-foreground">
        Die Recherche konnte nicht geladen werden. Gespeicherte Daten bleiben erhalten.
      </p>
      <Link href={href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-primary">
        <RefreshCw className="h-4 w-4" />
        Erneut laden
      </Link>
    </section>
  )
}

export function ProductReviewQueue({
  entries,
  group = "ready",
  basePath = "/admin/produkt-intake",
}: {
  entries: ProductReviewQueueEntry[]
  group?: ProductReviewGroup
  basePath?: string
}) {
  const selected = entries.filter((entry) => entry.group === group)
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produktprüfung</h1>
        <p className="mt-2 text-muted-foreground">
          Prüfe die recherchierten Werte und Bilder, bevor ein Produkt veröffentlicht wird.
        </p>
      </div>
      <nav aria-label="Prüfgruppen" className="flex flex-wrap gap-2">
        {PRODUCT_REVIEW_GROUPS.map((key) => (
          <Link
            key={key}
            href={`${basePath}?gruppe=${key}`}
            aria-current={key === group ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm ${key === group ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
          >
            {PRODUCT_REVIEW_GROUP_LABELS[key]}
            <span className="tabular-nums">
              {entries.filter((entry) => entry.group === key).length}
            </span>
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">
        Alle offenen Einträge bleiben sichtbar. Ältere Recherchen können eine erneute Prüfung
        brauchen.
      </p>
      <div className="overflow-hidden rounded-xl border bg-card">
        {selected.length === 0 ? (
          <p className="p-6 text-muted-foreground">
            {group === "ready"
              ? "Im Moment ist kein Produkt bereit zur Prüfung. Andere Prüfgruppen findest du oben."
              : "In dieser Gruppe gibt es derzeit keine Einträge."}
          </p>
        ) : (
          <ul className="divide-y">
            {selected.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={
                    basePath.startsWith("/labs/")
                      ? `${basePath}?detail=${entry.id}`
                      : `${basePath}/${entry.id}`
                  }
                  className="flex min-h-24 items-center justify-between gap-4 p-5 transition-colors hover:bg-accent/50 focus-visible:outline-primary sm:p-6"
                >
                  <div className="min-w-0 space-y-2">
                    <p className="break-words font-semibold">
                      {[entry.brand_text, entry.product_name_text].filter(Boolean).join(" · ") ||
                        "Produkt noch nicht eindeutig"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {categoryLabels[entry.category] ?? entry.category} · Eingereicht am{" "}
                      {dateLabel(entry.created_at)}
                    </p>
                    <Status group={entry.group} />
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                    Ansehen
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ProductReviewDetailView({
  detail,
  queuePath = "/admin/produkt-intake",
}: {
  detail: ProductReviewDetail
  queuePath?: string
}) {
  const { submission, job, artifacts, decisions } = detail
  const payload = productReviewRecord(submission.researched_payload)
  const final = productReviewRecord(detail.publication_review?.proposed_final ?? payload?.final)
  const engine = productReviewRecord(payload?.engine)
  const protocol = productReviewRecord(payload?.draft)?.protocol
  const protocolRows = productReviewRecord(final?.category_specs)?.product_application_protocols
  const instructions = [
    productReviewRecord(protocol)?.instructions,
    ...(Array.isArray(protocolRows)
      ? protocolRows.map((row) => productReviewRecord(row)?.source_text)
      : []),
  ].filter((text): text is string => typeof text === "string" && text.trim().length > 0)
  const group = productReviewGroup(submission.status, job)
  const sources = [
    ...new Set(
      artifacts
        .flatMap((artifact) => [
          ...(artifact.source_urls ?? []),
          artifact.payload.source_url,
          artifact.payload.url,
        ])
        .map(productReviewSourceUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ]
  const judgments = artifacts.filter(
    (artifact) =>
      ["model_judgment", "image_judgment"].includes(artifact.kind) && artifact.job_id === job?.id,
  )
  const comments = decisions.filter(
    (decision) => decision.decision === "change_requested" && !decision.resolved_at,
  )
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href={queuePath}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Zur Produktprüfung
      </Link>
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {categoryLabels[submission.category] ?? submission.category} · Eingereicht am{" "}
          {dateLabel(submission.created_at)}
        </p>
        <h1 className="break-words text-2xl font-semibold tracking-tight">
          {[submission.brand_text, submission.product_name_text].filter(Boolean).join(" · ") ||
            "Produkt noch nicht eindeutig"}
        </h1>
        <Status group={group} />
        <p className="text-sm text-muted-foreground">
          {submission.payload_revision
            ? `Rechercheversion ${submission.payload_revision}`
            : "Ältere Recherche ohne Versionsbindung"}{" "}
          ·{" "}
          {engine
            ? `${String(engine.id ?? "Recherche")}, ${String(engine.methodology ?? "Version nicht angegeben")}`
            : "Rechercheverfahren noch nicht versioniert"}
        </p>
      </header>
      {(!engine || !submission.payload_revision) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Diese ältere Recherche braucht vor der Veröffentlichung eine aktuelle Prüfung. Bisherige
          Freigaben werden nicht automatisch übernommen.
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <section className={card}>
            <h2 className="text-lg font-semibold">Produkt &amp; Quellen</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Marke</dt>
                <dd className="mt-1 break-words font-medium">
                  {submission.brand_text || "Noch offen"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Kategorie</dt>
                <dd className="mt-1 font-medium">
                  {categoryLabels[submission.category] ?? submission.category}
                </dd>
              </div>
            </dl>
            <ul className="mt-5 space-y-2">
              {sources.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="inline-flex min-h-11 max-w-full items-center gap-2 break-all text-sm text-primary"
                  >
                    {url}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
            {sources.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Noch keine verlinkten Quellen gespeichert.
              </p>
            )}
          </section>
          <section className={card}>
            <h2 className="text-lg font-semibold">Vorgeschlagene Katalogwerte</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Gespeicherter Recherchevorschlag mit exakten Werten. Die Veröffentlichungsprüfung
              steht noch aus.
            </p>
            {final ? (
              <dl className="mt-4 divide-y">
                {productReviewValues(final).map((row) => (
                  <div key={row.path} className="grid gap-2 py-3 text-sm sm:grid-cols-2">
                    <dt className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                      {row.path}
                    </dt>
                    <dd className="min-w-0 break-words font-mono text-xs">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Es liegt noch kein finaler Recherchevorschlag vor.
              </p>
            )}
          </section>
          <section className={card}>
            <h2 className="text-lg font-semibold">Anwendung</h2>
            {instructions.length > 0 ? (
              [...new Set(instructions)].map((text) => (
                <p key={text} className="mt-4 whitespace-pre-wrap break-words text-sm">
                  {text}
                </p>
              ))
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Noch keine lesbare Herstelleranleitung gespeichert.
              </p>
            )}
            {protocolRows || protocol ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-primary">
                  Exakte Anwendungsdaten ansehen
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify(protocolRows ?? protocol, null, 2)}
                </pre>
              </details>
            ) : null}
          </section>
        </div>
        <div className="min-w-0 space-y-5">
          <ProductReviewActions
            key={`${submission.id}:${submission.payload_revision}:${job?.review_cycle_id}`}
            detail={detail}
            reloadHref={
              queuePath.startsWith("/labs/")
                ? `${queuePath}?detail=${submission.id}`
                : `/admin/produkt-intake/${submission.id}`
            }
          />
          {(comments.length > 0 || job?.last_error) && (
            <section className={card}>
              <h2 className="text-lg font-semibold">Noch zu klären</h2>
              {comments.map((comment) => (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm" key={comment.id}>
                  {comment.comment || comment.field_path}
                </p>
              ))}
              {job?.last_error && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-primary">
                    Gespeicherten Fehler ansehen
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap break-words">{job.last_error}</p>
                </details>
              )}
            </section>
          )}
          <section className={card}>
            <h2 className="text-lg font-semibold">Automatische Prüfungen</h2>
            {judgments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Noch kein gespeichertes Prüfergebnis.
              </p>
            ) : (
              judgments.map((item) => (
                <details key={item.id} className="mt-3">
                  <summary className="cursor-pointer text-sm text-primary">
                    {item.kind === "image_judgment" ? "Bildprüfung" : "Werteprüfung"} ·{" "}
                    {dateLabel(item.created_at)}
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </details>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
