"use client"

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react"

export type LeaveInPropertyReviewStatus = "unreviewed" | "rework_open" | "approved"
export type LeaveInReviewStatus = "needs_review" | "rework_open" | "approved" | "excluded"
type ReviewAction = "approve_property" | "request_rework" | "approve_product" | "approve_boundary"
type QueueLane = "offen" | "nacharbeit" | "freigegeben" | "ausgeschlossen"

export type LeaveInAdjudication = {
  id: string
  title: string
  note: string
  source: string
}

export type LeaveInEcho = {
  field: string
  value: string
  label: string
}

export type LeaveInProperty = {
  path: string
  group: "g0" | "dimension" | "hinweise" | "care_direction" | "profile"
  label: string
  value: string
  confidence: string | null
  evidenceLevel: string | null
  evidenceScope: string | null
  informational: boolean
  echo: LeaveInEcho | null
  rationale: string | null
  reasoningShort: string
  rationaleSource: string
  rationaleExtractionGap: boolean
  observations: string[]
  counterSignals: string[]
  derivedFrom: string[]
  reviewNote: string | null
  adjudication: LeaveInAdjudication | null
  humanReviewStatus: LeaveInPropertyReviewStatus
}

export type LeaveInReviewDecision = {
  action: string
  propertyPath: string | null
  comment: string | null
  savedAt: string
} | null

export type LeaveInBatch = "gold-set" | "unseen-test"

export type LeaveInQueueItem = {
  productId: string
  slot: number
  batch: LeaveInBatch
  productName: string
  brandName: string
  archetypeRole: string
  market: string
  packSize: string
  gtin: string | null
  g0State: string
  statusLabel: string
  summary: string
  uncertainFields: string[]
  cautionsDe: string[]
  excluded: boolean
  categoryBoundaryStatus: "eligible" | "excluded_product_form"
  reviewStatus: LeaveInReviewStatus
  priorityGroup: "priority" | "standard" | "boundary"
  openProperties: number
  propertyCount: number
  openAdjudicationIds: string[]
  staleReview: boolean
  lastReviewDecision: LeaveInReviewDecision
}

export type LeaveInClaim = {
  claimText: string
  claimType: string | null
  authorityTier: string | null
  tierBasis: string | null
  domain: string | null
  url: string | null
  date: string | null
  createsClaim: boolean | null
  note: string | null
}

export type LeaveInDetail = LeaveInQueueItem & {
  identity: {
    gtin: string | null
    market: string
    packSize: string
    identityStatus: string
    rawInci: string
    normalizedIngredients: string[]
    directionsOfUse: string | null
    directionsStatus: string
    applicationStage: {
      value: string[]
      evidenceLevel: string
      evidenceScope: string
      sourceTier: string
      basis: Array<{ stage: string; quote: string }>
      note: string | null
    } | null
    claims: LeaveInClaim[]
    claimsStatus: string
    remainingGap: string | null
    fingerprints: { rawInciSha256: string; formulaFingerprintSha256: string }
  }
  g0: {
    state: string
    outOfCategory: boolean
    rationale: string
    informationalOnly: boolean
    profileNote: string | null
  }
  reviewRouting: {
    reviewStatus: string
    routed: boolean
    triggers: string[]
    triggerBasis: Array<{ trigger: string; basis: string }>
  }
  properties: LeaveInProperty[]
  propertyStatuses: Record<string, LeaveInPropertyReviewStatus>
  productFingerprint: string
  formulaFingerprint: string
  standardVersion: string
  keyVersion: string
  canApproveProduct: boolean
  canApproveBoundary: boolean
  reviewBlockers: string[]
}

export type LeaveInLabData = {
  meta: {
    keyVersion: string
    derivedFromRun: string
    standardVersion: string
    modelVersion: string
    packetVersion: string
    generatedAt: string
    stopCondition: string
  }
  summary: {
    products: number
    inCategory: number
    excluded: number
    rationaleGaps: number
    reviewCounts: {
      approved: number
      reworkOpen: number
      needsReview: number
      excluded: number
    }
  }
  openAdjudications: LeaveInAdjudication[]
  queueItems: LeaveInQueueItem[]
  initialDetail: LeaveInDetail
}

const LANE_LABELS: Record<QueueLane, string> = {
  offen: "offen",
  nacharbeit: "in Nacharbeit",
  freigegeben: "freigegeben",
  ausgeschlossen: "ausgeschlossen",
}

const BATCH_ORDER: LeaveInBatch[] = ["gold-set", "unseen-test"]

const BATCH_LABELS: Record<LeaveInBatch, string> = {
  "gold-set": "Batch 1 — Gold-Set (Kalibrierung)",
  "unseen-test": "Batch 2 — Unseen-Test",
}

const GROUP_LABELS: Record<LeaveInProperty["group"], string> = {
  g0: "G0 — Produktform-Gate",
  dimension: "Dimensionen (§7) — 7 nach dem Trim",
  hinweise: "Hinweise (§8) — ein Record, nur was ausgelöst hat",
  care_direction: "Pflegerichtung (§9)",
  profile: "Lean Matching Profile (§10) — prüfbare Felder",
}

const GROUP_HINTS: Partial<Record<LeaveInProperty["group"], string>> = {
  dimension:
    "SLIP ist in COND aufgenommen (T1), SFR ist zur typisierten smoothing_route beim Fokus geworden (T2), DOSE ist entfallen (T3), FORM ist zur Leseweise §3.1.2 geworden und keine eigene Zeile mehr (T11), ROLE ist entfallen und lebt als Identitätsfeld application_stage im Kopfbereich weiter, nicht hier (T12). „→ Profilwert“ ist die deterministische Projektion dieser Zeile — sie wird mit der Dimension freigegeben, nicht separat (T8).",
  hinweise:
    "SHN, CURL, R3, LAYER, Buildup und Transfer in einem Record. Gelistet wird nur, was tatsächlich ausgelöst hat; der R3-Zustand wird immer mitgeführt, auch wenn er „none“ ist (T5).",
  profile:
    "Nur Felder mit eigener Regel oder zweitem Input. Echo-Felder (Pflegelevel, Gewicht, Persistenz, Halt) stehen als Annotation an ihrer Dimension (T8). Produktform ist ab T10 kein Echo-Feld mehr — sie wird unabhängig an der Identität erfasst und ist eigenständig prüfbar. Anwendungsrolle (usage_role) ist ab T12 kein Feld mehr — die Anwendungsstadien stehen als Identitätsfeld im Kopfbereich (neben der Anwendung), nicht hier.",
}

const GROUP_ORDER: LeaveInProperty["group"][] = [
  "g0",
  "dimension",
  "hinweise",
  "care_direction",
  "profile",
]

const COLUMN_COUNT = 5

function laneOf(item: LeaveInQueueItem): QueueLane {
  if (item.reviewStatus === "approved") return "freigegeben"
  if (item.reviewStatus === "rework_open") return "nacharbeit"
  if (item.excluded) return "ausgeschlossen"
  return "offen"
}

function statusTone(status: LeaveInReviewStatus) {
  return status === "approved"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : status === "rework_open"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : status === "excluded"
        ? "border-stone-300 bg-stone-100 text-stone-800"
        : "border-sky-200 bg-sky-50 text-sky-900"
}

function propertyStatusLabel(status: LeaveInPropertyReviewStatus) {
  return status === "approved"
    ? "freigegeben"
    : status === "rework_open"
      ? "in Nacharbeit"
      : "offen"
}

/* --------------------------------------------------------------------------
 * Rationale rendering — the verbatim rationale strings are markdown-ish.
 * A small line-based parser turns them into clean React blocks so that no raw
 * `###`, `**` or backtick characters ever reach the screen.
 * ------------------------------------------------------------------------ */

type RationaleBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "separator"; label: string }

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/
const BULLET_PATTERN = /^[-*]\s+(.*)$/
const SEPARATOR_PATTERN = /^—(?:\s*—){2,}/
const TABLE_DIVIDER_CELL = /^:?-{1,}:?$/

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function parseRationale(text: string): RationaleBlock[] {
  const blocks: RationaleBlock[] = []
  let paragraph: string[] = []
  let list: string[] | null = null
  let table: string[][] | null = null

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") })
      paragraph = []
    }
  }
  const flushList = () => {
    if (list && list.length) blocks.push({ kind: "list", items: list })
    list = null
  }
  const flushTable = () => {
    if (table && table.length) blocks.push({ kind: "table", rows: table })
    table = null
  }
  const flushAll = () => {
    flushParagraph()
    flushList()
    flushTable()
  }

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim()
    if (!line) {
      flushAll()
      continue
    }
    if (line.startsWith("|")) {
      flushParagraph()
      flushList()
      table ??= []
      table.push(splitTableRow(line))
      continue
    }
    flushTable()
    if (SEPARATOR_PATTERN.test(line)) {
      flushAll()
      blocks.push({
        kind: "separator",
        label: line.replace(/^[—–\s]+/, "").replace(/[—–\s]+$/, ""),
      })
      continue
    }
    const heading = HEADING_PATTERN.exec(line)
    if (heading) {
      flushAll()
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]! })
      continue
    }
    const bullet = BULLET_PATTERN.exec(line)
    if (bullet) {
      flushParagraph()
      list ??= []
      list.push(bullet[1]!)
      continue
    }
    if (list && list.length) {
      list[list.length - 1] = `${list[list.length - 1]} ${line}`
      continue
    }
    paragraph.push(line)
  }
  flushAll()
  return blocks
}

const INLINE_PATTERN = /(\*\*.+?\*\*|\*[^*\s][^*]*?\*|`[^`]+`)/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE_PATTERN)
    .filter((part) => part !== "")
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={key} className="font-semibold text-stone-950">
            {renderInline(part.slice(2, -2), key)}
          </strong>
        )
      }
      if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
        return (
          <em key={key} className="italic">
            {renderInline(part.slice(1, -1), key)}
          </em>
        )
      }
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={key} className="rounded bg-stone-200/60 px-1 font-mono text-[12px]">
            {part.slice(1, -1)}
          </code>
        )
      }
      return <span key={key}>{part}</span>
    })
}

function renderRationale(text: string) {
  const blocks = parseRationale(text)
  return (
    <div className="space-y-2 text-[13px] leading-6 text-stone-800">
      {blocks.map((block, index) => {
        const key = `block-${index}`
        if (block.kind === "heading") {
          return (
            <h6
              key={key}
              className={
                block.level <= 2
                  ? "pt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-600"
                  : "pt-1 text-[13px] font-semibold text-stone-950"
              }
            >
              {renderInline(block.text, key)}
            </h6>
          )
        }
        if (block.kind === "separator") {
          return (
            <div key={key} className="pt-2">
              <hr className="border-stone-300" />
              {block.label ? (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  {block.label}
                </p>
              ) : null}
            </div>
          )
        }
        if (block.kind === "list") {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ul>
          )
        }
        if (block.kind === "table") {
          const rows = block.rows.filter(
            (row) => !row.every((cell) => TABLE_DIVIDER_CELL.test(cell)),
          )
          const [head, ...body] = rows
          if (!head) return null
          return (
            <div key={key} className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px] leading-5">
                <thead>
                  <tr>
                    {head.map((cell, cellIndex) => (
                      <th
                        key={`${key}-h-${cellIndex}`}
                        scope="col"
                        className="border-b border-stone-300 px-2 py-1 text-left font-semibold text-stone-700"
                      >
                        {renderInline(cell, `${key}-h-${cellIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={`${key}-r-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${key}-r-${rowIndex}-${cellIndex}`}
                          className="border-b border-stone-200 px-2 py-1 align-top"
                        >
                          {renderInline(cell, `${key}-r-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return <p key={key}>{renderInline(block.text, key)}</p>
      })}
    </div>
  )
}

/* ---------------------------------------------------------------------- */

function MetaChip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded border border-stone-200 bg-white px-1.5 py-px text-[10px] font-medium text-stone-600"
    >
      {children}
    </span>
  )
}

// The provenance string points at a markdown heading, so it carries `###` and
// backticks. The section it names stays intact; only the syntax is dropped.
function cleanSourceLabel(source: string) {
  return source.replace(/#{1,6}\s*/g, "").replace(/`/g, "")
}

function PropertyDetailPanel({ property }: { property: LeaveInProperty }) {
  return (
    <div className="space-y-3 border-l-4 border-l-stone-300 bg-stone-50 px-4 py-3">
      {property.adjudication ? (
        <div className="rounded-md border-l-4 border-l-rose-500 border-y border-r border-rose-200 bg-rose-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">
            Offener Adjudikationspunkt
          </p>
          <h6 className="mt-1 text-sm font-semibold text-rose-950">
            {property.adjudication.title}
          </h6>
          <p className="mt-1 text-[13px] leading-6 text-rose-950">{property.adjudication.note}</p>
          <p className="mt-1 text-[11px] text-rose-800">Quelle: {property.adjudication.source}</p>
        </div>
      ) : null}
      {property.rationale ? (
        renderRationale(property.rationale)
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] leading-6 text-amber-950">
          Keine Begründung im Evidenz-Markdown auffindbar (rationale_extraction_gap). Es wurde
          bewusst kein Text ergänzt — bitte Nacharbeit anfordern.
        </p>
      )}
      {property.observations.length ? (
        <div>
          <h6 className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">
            Beobachtungen
          </h6>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-stone-800">
            {property.observations.map((entry, index) => (
              <li key={entry}>{renderInline(entry, `observation-${index}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {property.counterSignals.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <h6 className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            Gegensignale
          </h6>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-amber-950">
            {property.counterSignals.map((entry, index) => (
              <li key={entry}>{renderInline(entry, `counter-signal-${index}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {property.derivedFrom.length ? (
        <p className="text-[13px] leading-6 text-stone-700">
          <span className="font-semibold">Abgeleitet aus:</span> {property.derivedFrom.join(" · ")}
        </p>
      ) : null}
      {property.reviewNote ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-[13px] leading-6 text-sky-950">
          <span className="font-semibold">Review-Routing:</span> {property.reviewNote}
        </p>
      ) : null}
      <p className="text-[11px] text-stone-500">
        Quelle: {cleanSourceLabel(property.rationaleSource)}
      </p>
    </div>
  )
}

function IdentityHeader({ detail }: { detail: LeaveInDetail }) {
  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">Identität</h3>
        <dl className="mt-2 space-y-1 text-sm text-stone-700">
          <div>
            <dt className="inline font-medium">GTIN: </dt>
            <dd className="inline">{detail.identity.gtin ?? "nicht belegt"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Markt / Größe: </dt>
            <dd className="inline">
              {detail.identity.market} · {detail.identity.packSize}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Identitätsstatus: </dt>
            <dd className="inline">{detail.identity.identityStatus}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Archetyp: </dt>
            <dd className="inline">{detail.archetypeRole}</dd>
          </div>
        </dl>
        <p className="mt-2 break-all text-xs leading-5 text-stone-500">
          Formel: {detail.formulaFingerprint}
          <br />
          Record: {detail.productFingerprint}
          <br />
          Standard: {detail.standardVersion} · Key: {detail.keyVersion}
        </p>
        {detail.identity.remainingGap ? (
          <p className="mt-2 text-xs leading-5 text-stone-600">
            Offene Lücke: {detail.identity.remainingGap}
          </p>
        ) : null}
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">Anwendung ({detail.identity.directionsStatus})</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {detail.identity.directionsOfUse ?? "nicht erfasst"}
        </p>
        {detail.identity.applicationStage ? (
          <div className="mt-3 border-t border-stone-100 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Anwendungsstadium (Identität, T12 — keine geprüfte Zeile)
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-700">
              {detail.identity.applicationStage.value.length
                ? detail.identity.applicationStage.value.join(" · ")
                : "keine"}
            </p>
            {detail.identity.applicationStage.note ? (
              <p className="mt-1 text-xs leading-5 text-stone-600">
                {detail.identity.applicationStage.note}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-4 lg:col-span-2">
        <h3 className="font-semibold">Original-INCI</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">{detail.identity.rawInci}</p>
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-4 lg:col-span-2">
        <h3 className="font-semibold">
          Eingefrorene Claims ({detail.identity.claimsStatus} · {detail.identity.claims.length})
        </h3>
        {detail.identity.claims.length === 0 ? (
          <p className="mt-2 text-sm text-stone-700">Keine Claims eingefroren.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {detail.identity.claims.map((claim) => (
              <li
                key={`${claim.claimText}-${claim.domain ?? ""}`}
                className="rounded-md border border-stone-200 p-3"
              >
                <p className="text-sm leading-6 text-stone-800">„{claim.claimText}“</p>
                <p className="mt-1 text-xs text-stone-600">
                  Tier {claim.authorityTier ?? "?"} · {claim.domain ?? "Quelle offen"} ·{" "}
                  {claim.claimType ?? "Typ offen"} ·{" "}
                  {claim.createsClaim === false
                    ? "erzeugt keine Aussage"
                    : claim.createsClaim === true
                      ? "erzeugt eine Aussage"
                      : "Wirkung offen"}
                </p>
                {claim.tierBasis ? (
                  <p className="mt-1 text-xs leading-5 text-stone-600">
                    Tier-Basis: {claim.tierBasis}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function DetailPanel({
  detail,
  comment,
  setComment,
  pending,
  onAction,
}: {
  detail: LeaveInDetail
  comment: string
  setComment: (value: string) => void
  pending: boolean
  onAction: (action: ReviewAction, path?: string) => void
}) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set<string>())
  const [reworkPath, setReworkPath] = useState<string | null>(null)

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    properties: detail.properties.filter((property) => property.group === group),
  })).filter((entry) => entry.properties.length > 0)

  const allExpanded =
    detail.properties.length > 0 &&
    detail.properties.every((entry) => expandedPaths.has(entry.path))

  function toggleExpanded(path: string) {
    setExpandedPaths((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <section className="min-w-0 self-start rounded-md border border-stone-200 bg-stone-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-stone-500">
            Slot {detail.slot} · Produkt-Audit · nur lokal
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{detail.productName}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {detail.brandName} · {detail.market} · {detail.packSize}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {detail.openProperties} von {detail.propertyCount} Eigenschaften sind noch offen · G0:{" "}
            {detail.g0State}
          </p>
        </div>
        <div className="ml-auto w-full max-w-sm text-left sm:text-right">
          {detail.excluded ? (
            <button
              type="button"
              disabled={pending || !detail.canApproveBoundary}
              onClick={() => onAction("approve_boundary")}
              className="rounded-md border border-amber-500 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
            >
              {pending ? "Speichert …" : "G0-Ausschluss bestätigen"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || !detail.canApproveProduct}
              onClick={() => onAction("approve_product")}
              className="rounded-md border border-emerald-800 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
            >
              {pending ? "Speichert …" : "Gesamtes Produkt freigeben"}
            </button>
          )}
          <p className="mt-2 text-xs leading-5 text-stone-600">
            {detail.excluded
              ? detail.canApproveBoundary
                ? "Bestätigt die G0-Entscheidung für diese exakte Formelversion. Keine Katalogfreigabe."
                : "Der G0-Ausschluss ist bereits bestätigt."
              : (detail.reviewBlockers[0] ??
                "Gibt den gesamten Record für diese exakte Formelversion frei. Keine Katalogfreigabe.")}
          </p>
        </div>
      </div>

      {detail.staleReview ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          Formel, Record oder Standardversion hat sich geändert. Eigenschaften mit verändertem Wert
          oder verändertem Reasoning sind wieder offen; unveränderte Freigaben bleiben erhalten.
        </p>
      ) : null}

      {detail.excluded ? (
        <section className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">
            Gate G0 · {detail.g0State} · kein Lean-Profil
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">
            {detail.g0.rationale}
          </p>
          {detail.g0.profileNote ? (
            <p className="mt-2 text-sm leading-6 text-amber-950">{detail.g0.profileNote}</p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-amber-950">
            Die §7-Dimensionen unten sind für diesen Record ausdrücklich informativ und nicht
            autoritativ — sie sind trotzdem einzeln prüfbar.
          </p>
        </section>
      ) : null}

      {detail.reviewRouting.triggerBasis.length ? (
        <section className="mt-5 rounded-md border border-sky-200 bg-sky-50 p-4">
          <h3 className="font-semibold text-stone-950">
            Review-Routing (§14) · {detail.reviewRouting.reviewStatus}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-800">
            {detail.reviewRouting.triggerBasis.map((entry) => (
              <li key={entry.trigger}>
                <span className="font-semibold">{entry.trigger}</span>
                {entry.basis ? ` — ${entry.basis}` : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="mt-5 rounded-md border border-stone-200 bg-white">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">
          Identität, INCI, Anwendung &amp; Claims anzeigen
        </summary>
        <div className="px-4 pb-4">
          <IdentityHeader detail={detail} />
        </div>
      </details>

      {detail.cautionsDe.length || detail.uncertainFields.length ? (
        <section
          className="mt-5 rounded-md border border-stone-200 bg-white p-4"
          data-leave-in-echo-panel="true"
        >
          <h3 className="font-semibold">Projizierte Ausgaben (§18 / §10)</h3>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            Deterministische Folge der oben geprüften Feldwerte. Wird angezeigt, nicht Zeile für
            Zeile freigegeben — wer einem Hinweis widerspricht, widerspricht dem Feld, das ihn
            auslöst (T8, §10.1.3).
          </p>
          {detail.cautionsDe.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-800">
              {detail.cautionsDe.map((entry) => (
                <li key={entry}>„{entry}“</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-700">Keine deutschen Warnhinweise emittiert.</p>
          )}
          {detail.uncertainFields.length ? (
            <p className="mt-3 text-sm text-stone-700">
              <span className="font-semibold">Als unsicher markiert:</span>{" "}
              {detail.uncertainFields.join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {reworkPath === null ? (
        <details className="mt-5 rounded-md border border-stone-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">
            Reviewer-Kommentar
          </summary>
          <div className="px-4 pb-4">
            <label htmlFor="leave-in-review-comment" className="text-sm text-stone-700">
              Für Nacharbeit ist ein konkreter Kommentar erforderlich. Für Freigaben ist er
              optional.
            </label>
            <textarea
              id="leave-in-review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-md border border-stone-300 p-3 text-sm"
              placeholder="Zum Beispiel: focus.primary bitte permissiv lesen und neu begründen."
            />
          </div>
        </details>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Eigenschaften ({detail.properties.length}) · Wert, Konfidenz, Begründung
        </h3>
        <button
          type="button"
          onClick={() =>
            setExpandedPaths(
              allExpanded
                ? new Set<string>()
                : new Set<string>(detail.properties.map((entry) => entry.path)),
            )
          }
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800"
        >
          {allExpanded ? "Alle einklappen" : "Alle ausklappen"}
        </button>
      </div>

      <div className="mt-2 overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <colgroup>
            <col className="w-9" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[42%]" />
            <col className="w-[128px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-stone-300 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-600">
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">Details</span>
              </th>
              <th scope="col" className="px-2 py-2">
                Eigenschaft
              </th>
              <th scope="col" className="px-2 py-2">
                Wert
              </th>
              <th scope="col" className="px-3 py-2">
                Begründung
              </th>
              <th scope="col" className="px-2 py-2">
                Status
              </th>
            </tr>
          </thead>
          {grouped.map((entry) => (
            <tbody key={entry.group}>
              <tr data-leave-in-group={entry.group}>
                <th
                  colSpan={COLUMN_COUNT}
                  scope="colgroup"
                  className="border-y border-stone-200 bg-[#f7efe6] px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-700"
                >
                  {GROUP_LABELS[entry.group]} ({entry.properties.length})
                  {GROUP_HINTS[entry.group] ? (
                    <details className="mt-1 font-normal normal-case tracking-normal">
                      <summary className="cursor-pointer text-[11px] font-semibold text-stone-600">
                        Regelhinweis
                      </summary>
                      <p className="mt-1 max-w-4xl text-[12px] leading-5 text-stone-700">
                        {GROUP_HINTS[entry.group]}
                      </p>
                    </details>
                  ) : null}
                </th>
              </tr>
              {entry.properties.map((property) => {
                const status = detail.propertyStatuses[property.path] ?? property.humanReviewStatus
                const isExpanded = expandedPaths.has(property.path)
                return (
                  <Fragment key={property.path}>
                    <tr
                      data-leave-in-property={property.path}
                      className="border-b border-stone-200/70 align-top"
                    >
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? `Details zu ${property.label} einklappen`
                              : `Details zu ${property.label} ausklappen`
                          }
                          title={isExpanded ? "Details einklappen" : "Details ausklappen"}
                          onClick={() => toggleExpanded(property.path)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100"
                        >
                          {isExpanded ? "⌄" : "›"}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(property.path)}
                          className="text-left font-medium text-stone-950 hover:underline"
                        >
                          {property.label}
                        </button>
                        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                          {property.informational ? (
                            <span className="inline-flex rounded-full border border-stone-300 bg-stone-100 px-1.5 py-px text-[10px] font-semibold text-stone-700">
                              informativ
                            </span>
                          ) : null}
                          {property.rationaleExtractionGap ? (
                            <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-900">
                              Begründung fehlt
                            </span>
                          ) : null}
                          {property.adjudication ? (
                            <button
                              type="button"
                              data-leave-in-adjudication={property.adjudication.id}
                              title={`Offener Adjudikationspunkt: ${property.adjudication.title}`}
                              aria-label={`Offener Adjudikationspunkt: ${property.adjudication.title}`}
                              onClick={() => toggleExpanded(property.path)}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-px text-[10px] font-semibold text-rose-900"
                            >
                              <span aria-hidden="true">●</span> Adjudikation
                            </button>
                          ) : null}
                        </span>
                        <p className="mt-0.5 font-mono text-[11px] text-stone-500">
                          {property.path}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-semibold text-stone-950">{property.value}</p>
                        {property.confidence || property.evidenceLevel || property.evidenceScope ? (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {property.confidence ? (
                              <MetaChip title="Konfidenz">Konf. {property.confidence}</MetaChip>
                            ) : null}
                            {property.evidenceLevel ? (
                              <MetaChip title="Evidenzlevel">{property.evidenceLevel}</MetaChip>
                            ) : null}
                            {property.evidenceScope ? (
                              <MetaChip title="Evidenz-Scope">{property.evidenceScope}</MetaChip>
                            ) : null}
                          </p>
                        ) : null}
                        {property.echo ? (
                          <p
                            className="mt-1 text-[11px] leading-5 text-stone-500"
                            data-leave-in-echo={property.echo.field}
                            title="Deterministische Projektion dieser Dimension — wird mit ihr freigegeben, nicht separat geprüft (T8, §10.1.3)."
                          >
                            → {property.echo.label}:{" "}
                            <span className="font-medium text-stone-700">
                              {property.echo.value}
                            </span>{" "}
                            ({property.echo.field})
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[13px] leading-6 text-stone-800">
                        {property.reasoningShort}
                      </td>
                      <td className="px-2 py-2">
                        <span className="block text-[11px] font-medium text-stone-600">
                          {propertyStatusLabel(status)}
                        </span>
                        <span className="mt-1 flex gap-1">
                          <button
                            type="button"
                            disabled={pending || status === "approved"}
                            onClick={() => onAction("approve_property", property.path)}
                            aria-label={`${property.label} freigeben`}
                            title="Freigeben"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span aria-hidden="true">✓</span>
                          </button>
                          <button
                            type="button"
                            disabled={pending || status === "rework_open"}
                            onClick={() => setReworkPath(property.path)}
                            aria-label={`Nacharbeit für ${property.label} anfordern`}
                            title="Nacharbeit anfordern"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-300 text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span aria-hidden="true">↺</span>
                          </button>
                        </span>
                      </td>
                    </tr>
                    {reworkPath === property.path ? (
                      <tr
                        data-leave-in-property-rework={property.path}
                        className="border-b border-stone-200/70"
                      >
                        <td colSpan={COLUMN_COUNT} className="p-0">
                          <div className="border-l-4 border-l-amber-400 bg-amber-50 px-4 py-3">
                            <label
                              htmlFor="leave-in-review-comment"
                              className="text-xs font-semibold text-amber-950"
                            >
                              Nacharbeit für „{property.label}“ — bitte konkret begründen
                            </label>
                            <textarea
                              id="leave-in-review-comment"
                              autoFocus
                              value={comment}
                              onChange={(event) => setComment(event.target.value)}
                              className="mt-2 min-h-20 w-full rounded-md border border-amber-300 bg-white p-3 text-sm"
                              placeholder="Zum Beispiel: focus.primary bitte permissiv lesen und neu begründen."
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={pending || !comment.trim()}
                                onClick={() => {
                                  onAction("request_rework", property.path)
                                  setReworkPath(null)
                                }}
                                className="rounded-md border border-amber-500 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Nacharbeit anfordern
                              </button>
                              <button
                                type="button"
                                onClick={() => setReworkPath(null)}
                                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {isExpanded ? (
                      <tr
                        data-leave-in-property-detail={property.path}
                        className="border-b border-stone-200/70"
                      >
                        <td colSpan={COLUMN_COUNT} className="p-0">
                          <PropertyDetailPanel property={property} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}

export function LeaveInResearchLabClient({ data }: { data: LeaveInLabData }) {
  const [items, setItems] = useState(data.queueItems)
  const [summary, setSummary] = useState(data.summary)
  const [selectedDetail, setSelectedDetail] = useState<LeaveInDetail | null>(data.initialDetail)
  const [selectedId, setSelectedId] = useState<string | null>(data.initialDetail.productId)
  const [comment, setComment] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [activeLane, setActiveLane] = useState<QueueLane>(() =>
    data.queueItems.some((item) => laneOf(item) === "offen") ? "offen" : laneOf(data.initialDetail),
  )
  const requestSequence = useRef(0)

  const laneCounts = useMemo(
    () =>
      items.reduce(
        (counts, item) => {
          counts[laneOf(item)] += 1
          return counts
        },
        { offen: 0, nacharbeit: 0, freigegeben: 0, ausgeschlossen: 0 } as Record<QueueLane, number>,
      ),
    [items],
  )
  const visibleItems = useMemo(
    () => items.filter((item) => laneOf(item) === activeLane),
    [activeLane, items],
  )
  const visibleItemsByBatch = useMemo(
    () =>
      BATCH_ORDER.map((batch) => ({
        batch,
        items: visibleItems.filter((item) => item.batch === batch),
      })).filter((group) => group.items.length > 0),
    [visibleItems],
  )
  const reviewCountsByBatch = useMemo(
    () =>
      BATCH_ORDER.map((batch) => {
        const batchItems = items.filter((item) => item.batch === batch)
        return {
          batch,
          total: batchItems.length,
          needsReview: batchItems.filter((item) => item.reviewStatus === "needs_review").length,
          reworkOpen: batchItems.filter((item) => item.reviewStatus === "rework_open").length,
          approved: batchItems.filter((item) => item.reviewStatus === "approved").length,
          excluded: batchItems.filter((item) => item.reviewStatus === "excluded").length,
        }
      }).filter((group) => group.total > 0),
    [items],
  )

  async function selectItem(productId: string) {
    const sequence = ++requestSequence.current
    setSelectedId(productId)
    setSelectedDetail(null)
    setFeedback("Audit wird geladen …")
    try {
      const response = await fetch(
        `/api/labs/leave-in-research/queue?productId=${encodeURIComponent(productId)}`,
      )
      const payload = await response.json()
      if (!response.ok || !payload.detail)
        throw new Error(payload.error ?? "Leave-In-Audit konnte nicht geladen werden.")
      if (requestSequence.current === sequence) {
        setSelectedDetail(payload.detail as LeaveInDetail)
        setFeedback(null)
        setComment("")
      }
    } catch (error) {
      if (requestSequence.current === sequence)
        setFeedback(
          error instanceof Error ? error.message : "Leave-In-Audit konnte nicht geladen werden.",
        )
    }
  }

  async function submit(action: ReviewAction, propertyPath?: string) {
    if (!selectedDetail || pending) return
    if (action === "request_rework" && !comment.trim()) {
      setFeedback("Bitte begründe die Nacharbeit im Reviewer-Kommentar.")
      document.getElementById("leave-in-review-comment")?.focus()
      return
    }
    const sequence = ++requestSequence.current
    const reviewedProductId = selectedDetail.productId
    const reviewedProductName = selectedDetail.productName
    setPending(true)
    setFeedback("Entscheidung wird gespeichert …")
    try {
      const response = await fetch("/api/labs/leave-in-research/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          itemId: reviewedProductId,
          ...(propertyPath ? { propertyPath } : {}),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.detail || !payload.data) {
        const blockers = Array.isArray(payload.blockers)
          ? payload.blockers.filter((entry: unknown): entry is string => typeof entry === "string")
          : []
        throw new Error(
          [
            payload.error ?? "Review-Entscheidung konnte nicht gespeichert werden.",
            ...blockers,
          ].join(" "),
        )
      }
      const nextItems = (payload.data.queueItems ?? []) as LeaveInQueueItem[]
      setItems(nextItems)
      if (payload.data.summary) setSummary(payload.data.summary as LeaveInLabData["summary"])
      if (requestSequence.current === sequence) {
        setSelectedDetail(payload.detail as LeaveInDetail)
        const nextSummary = nextItems.find((item) => item.productId === reviewedProductId)
        if (nextSummary) setActiveLane(laneOf(nextSummary))
        if (action === "request_rework") setComment("")
      }
      setFeedback(
        action === "request_rework"
          ? `Nacharbeit für ${reviewedProductName} wurde lokal gespeichert.`
          : `Lokale Review-Entscheidung für ${reviewedProductName} wurde gespeichert.`,
      )
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Review-Entscheidung konnte nicht gespeichert werden. Bitte erneut versuchen.",
      )
    } finally {
      setPending(false)
    }
  }

  function selectLane(lane: QueueLane) {
    setActiveLane(lane)
    const firstItem = items.find((item) => laneOf(item) === lane)
    if (firstItem && firstItem.productId !== selectedId) {
      void selectItem(firstItem.productId)
      return
    }
    if (!firstItem) {
      requestSequence.current += 1
      setSelectedId(null)
      setSelectedDetail(null)
      setFeedback(null)
      setComment("")
    }
  }

  return (
    <div className="min-h-screen bg-[#f5eee5] text-stone-950">
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Nur Entwicklung · lokale Research-Review · keine Produktionsdatenbank
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Leave-In Research Lab</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
                Prüfe alle {summary.products} Produkte über zwei Batches — Batch 1 Gold-Set
                (Kalibrierungsschlüssel) und Batch 2 Unseen-Test — Eigenschaft für Eigenschaft. Jede
                Zeile trägt Wert, Konfidenz, Evidenzlevel und die wörtliche Begründung aus der
                Evidenzkette. Keine Katalogfreigabe, keine Product-Intake-Aktion.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
                Dieser Lauf ist der Runde-3-Record, <strong>projiziert</strong> auf das getrimmte
                v0.4-Modell (T1–T12) und <strong>fortgeschrieben</strong> um die Adjudikationen
                T13–T17. Einzelne Werte weichen dadurch von Runde 3 ab (u. a. Redken, Olaplex,
                GLISS-Fokus); jede Abweichung trägt eine datierte Regelbegründung im Ledger (§21.3).
              </p>
              <p className="mt-2 text-xs text-stone-500">
                Key {data.meta.keyVersion} · abgeleitet aus {data.meta.derivedFromRun} · Standard{" "}
                {data.meta.standardVersion} · Modell {data.meta.modelVersion} · Packet{" "}
                {data.meta.packetVersion} · erzeugt {data.meta.generatedAt}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Review-Fortschritt
              </p>
              <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                <div className="rounded-md border bg-white px-3 py-2">
                  <strong className="block text-lg">{summary.reviewCounts.needsReview}</strong>
                  <span>offen</span>
                </div>
                <div className="rounded-md border bg-white px-3 py-2">
                  <strong className="block text-lg">{summary.reviewCounts.reworkOpen}</strong>
                  <span>in Nacharbeit</span>
                </div>
                <div className="rounded-md border bg-white px-3 py-2">
                  <strong className="block text-lg">{summary.reviewCounts.approved}</strong>
                  <span>freigegeben</span>
                </div>
                <div className="rounded-md border bg-white px-3 py-2">
                  <strong className="block text-lg">{summary.reviewCounts.excluded}</strong>
                  <span>G0 bestätigt</span>
                </div>
              </div>
              {reviewCountsByBatch.length > 1 ? (
                <div className="mt-3 space-y-1 text-xs text-stone-600">
                  {reviewCountsByBatch.map((group) => (
                    <p key={group.batch}>
                      <span className="font-semibold text-stone-800">
                        {BATCH_LABELS[group.batch]}:
                      </span>{" "}
                      {group.needsReview} offen · {group.reworkOpen} in Nacharbeit ·{" "}
                      {group.approved} freigegeben · {group.excluded} G0 bestätigt (von{" "}
                      {group.total})
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <p className="rounded-md border border-stone-200 bg-white p-3 text-xs leading-5 text-stone-600">
            {data.meta.stopCondition}
          </p>
        </header>

        {data.openAdjudications.length ? (
          <section className="rounded-md border border-rose-200 bg-rose-50 p-4">
            <h2 className="font-semibold text-rose-950">
              Offene Adjudikationspunkte ({data.openAdjudications.length})
            </h2>
            <p className="mt-1 text-sm leading-6 text-rose-950">
              Diese Punkte sind im Record bewusst offen. Sie erscheinen zusätzlich direkt an der
              betroffenen Eigenschaft, damit du sie im Kontext entscheiden kannst.
            </p>
            <ul className="mt-3 space-y-2">
              {data.openAdjudications.map((entry) => (
                <li key={entry.id} className="rounded-md border border-rose-200 bg-white p-3">
                  <h3 className="font-semibold text-rose-950">{entry.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-800">{entry.note}</p>
                  <p className="mt-1 text-xs text-stone-500">Quelle: {entry.source}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {summary.rationaleGaps > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            {summary.rationaleGaps} Eigenschaft(en) tragen keine auffindbare Begründung im
            Evidenz-Markdown (rationale_extraction_gap). Es wurde kein Text erfunden.
          </p>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-3">
            <h2 className="text-lg font-semibold">Research-Queue</h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Queue filtern">
              {(Object.keys(LANE_LABELS) as QueueLane[]).map((lane) => (
                <button
                  key={lane}
                  type="button"
                  role="radio"
                  aria-checked={activeLane === lane}
                  disabled={pending}
                  onClick={() => selectLane(lane)}
                  className={`rounded-md border px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${activeLane === lane ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-800"}`}
                >
                  <span className="block text-base">{laneCounts[lane]}</span>
                  {LANE_LABELS[lane]}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              {visibleItemsByBatch.map((group) => (
                <div key={group.batch} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {BATCH_LABELS[group.batch]} ({group.items.length})
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 lg:block lg:space-y-3 lg:overflow-visible">
                    {group.items.map((item) => (
                      <article
                        key={item.productId}
                        data-leave-in-queue-card={item.productId}
                        className={`min-w-[280px] flex-1 rounded-md border bg-white p-4 lg:min-w-0 ${item.productId === selectedId ? "border-stone-950 ring-1 ring-stone-950" : "border-stone-200"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{item.productName}</h3>
                            <p className="mt-1 text-sm text-stone-600">
                              Slot {item.slot} · {item.brandName}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(item.reviewStatus)}`}
                          >
                            {item.statusLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-stone-600">{item.archetypeRole}</p>
                        <p className="mt-2 text-xs text-stone-700">
                          {item.openProperties} von {item.propertyCount} Eigenschaften offen · G0:{" "}
                          {item.g0State}
                        </p>
                        {item.openAdjudicationIds.length ? (
                          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-900">
                            {item.openAdjudicationIds.length} offene(r) Adjudikationspunkt(e)
                          </p>
                        ) : null}
                        {item.uncertainFields.length ? (
                          <p className="mt-2 text-xs text-stone-600">
                            Unsicher: {item.uncertainFields.join(" · ")}
                          </p>
                        ) : null}
                        {item.staleReview ? (
                          <p className="mt-2 text-xs font-medium text-amber-900">
                            Vorherige Entscheidung ist veraltet.
                          </p>
                        ) : null}
                        <button
                          type="button"
                          aria-pressed={item.productId === selectedId}
                          disabled={pending}
                          onClick={() => void selectItem(item.productId)}
                          className="mt-3 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Produkt prüfen
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
              {visibleItems.length === 0 ? (
                <div className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-700">
                  In dieser Queue sind aktuell keine Produkte.
                </div>
              ) : null}
            </div>
          </aside>
          {selectedDetail ? (
            <DetailPanel
              key={selectedDetail.productId}
              detail={selectedDetail}
              comment={comment}
              setComment={setComment}
              pending={pending}
              onAction={(action, path) => void submit(action, path)}
            />
          ) : (
            <section className="rounded-md border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
              {feedback ?? "Wähle links ein Produkt aus, um den Audit zu öffnen."}
            </section>
          )}
        </section>

        {feedback ? (
          <div
            role="status"
            aria-atomic="true"
            className="fixed bottom-5 left-4 right-4 z-50 max-w-md rounded-md border border-stone-300 bg-stone-950 px-4 py-3 text-sm font-medium text-white shadow-lg sm:left-auto sm:right-5"
          >
            {feedback}
          </div>
        ) : null}
      </main>
    </div>
  )
}
