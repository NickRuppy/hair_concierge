"use client"

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react"

export type MaskPropertyReviewStatus = "unreviewed" | "rework_open" | "approved"
export type MaskReviewStatus = "needs_review" | "rework_open" | "approved" | "excluded"
export type MaskRunStatus = "pending" | "completed"
type ReviewAction = "approve_property" | "request_rework" | "approve_product" | "approve_boundary"
type QueueLane = "offen" | "nacharbeit" | "freigegeben" | "g0_bestaetigt"

export type MaskAdjudicationPoint = {
  id: string
  title: string
  body: string
  source: string
}

export type MaskAgreementCell = {
  productId: string
  field: string
  key: string | null
  blind: string | null
  match: boolean | null
}

// A derived profile field (hairThicknessFit, damageFit, textureFit) shown as
// a compact "→ ergibt:" annotation on its driving row instead of its own
// reviewable row (R9 "echo fields", T8 pattern — ported from the leave-in lab).
export type MaskDerivedAnnotation = {
  field: string
  label: string
  fieldLabel: string
  value: string
  note: string | null
  disagreement: MaskAgreementCell | null
}

export type MaskProperty = {
  path: string
  kind: "g0" | "profile"
  label: string
  value: string
  confidence: string | null
  evidenceLevel: string | null
  evidenceScope: string | null
  rationale: string | null
  evidenceSignals: string[]
  derivation: string | null
  thresholdReasoning: string[]
  counterSignals: string[]
  limitations: string[]
  modeScoped: boolean | null
  multiUse: boolean | null
  disagreement: MaskAgreementCell | null
  humanReviewStatus: MaskPropertyReviewStatus
  derivedAnnotations: MaskDerivedAnnotation[]
}

export type MaskReviewDecision = {
  action: string
  propertyPath: string | null
  comment: string | null
  savedAt: string
} | null

export type MaskQueueItem = {
  productId: string
  slot: number | string
  productName: string
  brandName: string
  archetypeRole: string
  archetypeSlots: string[]
  market: string
  packSize: string
  gtin: string | null
  runStatus: MaskRunStatus
  g0Value: string | null
  statusLabel: string
  uncertainFields: string[]
  excluded: boolean
  categoryBoundaryStatus: "eligible" | "excluded_product_form" | "pending"
  reviewStatus: MaskReviewStatus
  openProperties: number
  propertyCount: number
  openAdjudicationIds: string[]
  staleReview: boolean
  lastReviewDecision: MaskReviewDecision
}

export type MaskDetail = MaskQueueItem & {
  identity: {
    gtin: string | null
    market: string
    packSize: string
    rawInci: string
    normalizedIngredients: string[]
    tailMarkerRank: number | null
    tailMarkerIngredient: string | null
    tailMarkerAnomalyNote: string | null
    directionsText: string | null
    directionsContactTime: string | null
    directionsConfidence: string | null
    claims: string[]
    conflicts: Array<{ type: string; description: string; resolution?: string }>
  }
  reviewRoutingNotes: string[]
  adjudicationPoints: MaskAdjudicationPoint[]
  assumptionNotes: string[]
  properties: MaskProperty[]
  propertyStatuses: Record<string, MaskPropertyReviewStatus>
  recordFingerprint: string
  standardVersion: string
  projectedOutputs: {
    concentration: string | null
    weight: string | null
    balanceDirection: string | null
    repairSupportLevel: string | null
    functionalBenefits: string[]
    suitableThicknesses: string[]
  } | null
  canApproveProduct: boolean
  canApproveBoundary: boolean
  reviewBlockers: string[]
}

export type MaskLabData = {
  meta: {
    cohortId: string
    standardVersion: string
    frozen: string
    referenceKeyVersion: string
    charter: string
    approval: string
  }
  summary: {
    products: number
    pending: number
    excluded: number
    reviewCounts: {
      approved: number
      reworkOpen: number
      needsReview: number
      excluded: number
    }
  }
  openG0Question: string | null
  openAdjudications: MaskAdjudicationPoint[]
  queueItems: MaskQueueItem[]
  initialDetail: MaskDetail
}

const LANE_LABELS: Record<QueueLane, string> = {
  offen: "offen",
  nacharbeit: "in Nacharbeit",
  freigegeben: "freigegeben",
  g0_bestaetigt: "G0 bestätigt",
}

const COLUMN_COUNT = 5

function laneOf(item: MaskQueueItem): QueueLane {
  if (item.reviewStatus === "approved") return "freigegeben"
  if (item.reviewStatus === "rework_open") return "nacharbeit"
  if (item.reviewStatus === "excluded") return "g0_bestaetigt"
  return "offen"
}

function statusTone(item: MaskQueueItem) {
  if (item.reviewStatus === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-900"
  if (item.reviewStatus === "rework_open") return "border-amber-200 bg-amber-50 text-amber-900"
  if (item.reviewStatus === "excluded") return "border-stone-300 bg-stone-100 text-stone-800"
  if (item.runStatus === "pending") return "border-stone-300 bg-stone-100 text-stone-600"
  return "border-sky-200 bg-sky-50 text-sky-900"
}

function propertyStatusLabel(status: MaskPropertyReviewStatus) {
  return status === "approved"
    ? "freigegeben"
    : status === "rework_open"
      ? "in Nacharbeit"
      : "offen"
}

/* --------------------------------------------------------------------------
 * Rationale rendering — evidence text renders as-is (English) but the source
 * strings are markdown-ish. A small line-based parser turns them into clean
 * React blocks so raw `###`, `**` or backtick characters never reach screen.
 * Ported from the leave-in research lab client.
 * ------------------------------------------------------------------------ */

type RationaleBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "separator"; label: string }

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/
const BULLET_PATTERN = /^[-*]\s+(.*)$/
const SEPARATOR_PATTERN = /^—(?:\s*—){2,}/

function parseRationale(text: string): RationaleBlock[] {
  const blocks: RationaleBlock[] = []
  let paragraph: string[] = []
  let list: string[] | null = null

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
  const flushAll = () => {
    flushParagraph()
    flushList()
  }

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim()
    if (!line) {
      flushAll()
      continue
    }
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

function ListSection({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: "neutral" | "amber"
}) {
  if (!items.length) return null
  const wrapClass = tone === "amber" ? "rounded-md border border-amber-200 bg-amber-50 p-3" : ""
  const titleClass =
    tone === "amber"
      ? "text-[11px] font-semibold uppercase tracking-wide text-amber-900"
      : "text-[11px] font-semibold uppercase tracking-wide text-stone-600"
  const listClass =
    tone === "amber"
      ? "mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-amber-950"
      : "mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-stone-800"
  return (
    <div className={wrapClass}>
      <h6 className={titleClass}>{title}</h6>
      <ul className={listClass}>
        {items.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  )
}

function PropertyDetailPanel({ property }: { property: MaskProperty }) {
  return (
    <div className="space-y-3 border-l-4 border-l-stone-300 bg-stone-50 px-4 py-3">
      {property.disagreement ? (
        <div className="rounded-md border-l-4 border-l-rose-500 border-y border-r border-rose-200 bg-rose-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">
            Blind-/Key-Lane-Abweichung
          </p>
          <p className="mt-1 text-[13px] leading-6 text-rose-950">
            Key: <span className="font-semibold">{property.disagreement.key ?? "—"}</span> · Blind:{" "}
            <span className="font-semibold">{property.disagreement.blind ?? "—"}</span>
          </p>
        </div>
      ) : null}
      {property.rationale ? (
        renderRationale(property.rationale)
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] leading-6 text-amber-950">
          Keine Begründung im Record hinterlegt.
        </p>
      )}
      <ListSection title="Evidenzsignale" items={property.evidenceSignals} tone="neutral" />
      {property.derivation ? (
        <p className="text-[13px] leading-6 text-stone-700">
          <span className="font-semibold">Herleitung:</span> {property.derivation}
        </p>
      ) : null}
      <ListSection
        title="Schwellenwert-Begründung"
        items={property.thresholdReasoning}
        tone="neutral"
      />
      <ListSection title="Gegensignale" items={property.counterSignals} tone="amber" />
      <ListSection title="Einschränkungen" items={property.limitations} tone="neutral" />
    </div>
  )
}

function IdentityHeader({ detail }: { detail: MaskDetail }) {
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
            <dt className="inline font-medium">Archetyp: </dt>
            <dd className="inline">{detail.archetypeRole}</dd>
          </div>
          {detail.archetypeSlots.length ? (
            <div>
              <dt className="inline font-medium">Archetyp-Slots: </dt>
              <dd className="inline">{detail.archetypeSlots.join(" · ")}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-2 break-all text-xs leading-5 text-stone-500">
          Record: {detail.recordFingerprint}
          <br />
          Standard: {detail.standardVersion}
        </p>
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">Anwendung</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {detail.identity.directionsText ?? "nicht erfasst"}
        </p>
        {detail.identity.directionsContactTime ? (
          <p className="mt-2 text-xs text-stone-600">
            Einwirkzeit: {detail.identity.directionsContactTime}
            {detail.identity.directionsConfidence
              ? ` · Konfidenz: ${detail.identity.directionsConfidence}`
              : ""}
          </p>
        ) : null}
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-4 lg:col-span-2">
        <h3 className="font-semibold">Original-INCI</h3>
        <ol className="mt-2 space-y-0.5 text-sm leading-6 text-stone-700">
          {detail.identity.normalizedIngredients.map((ingredient, index) => {
            const rank = index + 1
            const isTailMarker = detail.identity.tailMarkerRank === rank
            return (
              <li
                key={`${rank}-${ingredient}`}
                className={
                  isTailMarker
                    ? "rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-950"
                    : undefined
                }
              >
                <span className="mr-2 inline-block w-7 text-right font-mono text-xs text-stone-400">
                  {rank}.
                </span>
                {ingredient}
                {isTailMarker ? (
                  <span className="ml-2 rounded-full border border-rose-300 bg-rose-100 px-1.5 py-px text-[10px] font-semibold text-rose-900">
                    Tail-Marker
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>
        {detail.identity.tailMarkerAnomalyNote ? (
          <p className="mt-2 text-xs leading-5 text-stone-600">
            Anomalie-Hinweis: {detail.identity.tailMarkerAnomalyNote}
          </p>
        ) : null}
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-4 lg:col-span-2">
        <h3 className="font-semibold">Eingefrorene Claims ({detail.identity.claims.length})</h3>
        {detail.identity.claims.length === 0 ? (
          <p className="mt-2 text-sm text-stone-700">Keine Claims eingefroren.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-800">
            {detail.identity.claims.map((claim) => (
              <li key={claim}>„{claim}“</li>
            ))}
          </ul>
        )}
      </div>
      {detail.identity.conflicts.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 lg:col-span-2">
          <h3 className="font-semibold text-amber-950">
            Identitäts-/Formel-Konflikte ({detail.identity.conflicts.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {detail.identity.conflicts.map((conflict) => (
              <li
                key={`${conflict.type}-${conflict.description.slice(0, 24)}`}
                className="text-sm leading-6 text-amber-950"
              >
                <span className="font-semibold">{conflict.type}:</span> {conflict.description}
                {conflict.resolution ? (
                  <span className="block text-xs text-amber-800">
                    Lösung: {conflict.resolution}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
  detail: MaskDetail
  comment: string
  setComment: (value: string) => void
  pending: boolean
  onAction: (action: ReviewAction, path?: string) => void
}) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set<string>())
  const [reworkPath, setReworkPath] = useState<string | null>(null)

  const g0Row = detail.properties.filter((property) => property.kind === "g0")
  const profileRows = detail.properties.filter((property) => property.kind === "profile")

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

  function renderPropertyRow(property: MaskProperty) {
    const status = detail.propertyStatuses[property.path] ?? property.humanReviewStatus
    const isExpanded = expandedPaths.has(property.path)
    return (
      <Fragment key={property.path}>
        <tr data-mask-property={property.path} className="border-b border-stone-200/70 align-top">
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
              {property.modeScoped ? (
                <span className="inline-flex rounded-full border border-stone-300 bg-stone-100 px-1.5 py-px text-[10px] font-semibold text-stone-700">
                  mode-scoped
                </span>
              ) : null}
              {property.multiUse ? (
                <span className="inline-flex rounded-full border border-stone-300 bg-stone-100 px-1.5 py-px text-[10px] font-semibold text-stone-700">
                  Mehrfachnutzung
                </span>
              ) : null}
              {property.disagreement ? (
                <button
                  type="button"
                  data-mask-disagreement={property.path}
                  title="Blind-/Key-Lane-Abweichung"
                  aria-label="Blind-/Key-Lane-Abweichung"
                  onClick={() => toggleExpanded(property.path)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-px text-[10px] font-semibold text-rose-900"
                >
                  <span aria-hidden="true">●</span> Abweichung
                </button>
              ) : null}
              {property.derivedAnnotations
                .filter((annotation) => annotation.disagreement)
                .map((annotation) => (
                  <button
                    key={annotation.field}
                    type="button"
                    data-mask-disagreement={`${property.path}→${annotation.field}`}
                    title={`Blind-/Key-Lane-Abweichung: ${annotation.fieldLabel}`}
                    aria-label={`Blind-/Key-Lane-Abweichung: ${annotation.fieldLabel}`}
                    onClick={() => toggleExpanded(property.path)}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-px text-[10px] font-semibold text-rose-900"
                  >
                    <span aria-hidden="true">●</span> Abweichung: {annotation.fieldLabel}
                  </button>
                ))}
            </span>
            <p className="mt-0.5 font-mono text-[11px] text-stone-500">{property.path}</p>
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
            {property.derivedAnnotations.map((annotation) => (
              <p
                key={annotation.field}
                className="mt-1 text-[11px] leading-5 text-stone-500"
                data-mask-derived-annotation={annotation.field}
                title="Deterministische Projektion dieser Eigenschaft — wird mit ihr freigegeben, nicht separat geprüft."
              >
                → ergibt: {annotation.label}:{" "}
                <span className="font-medium text-stone-700">{annotation.value}</span>
                {annotation.note ? (
                  <span className="block text-stone-500">{annotation.note}</span>
                ) : null}
              </p>
            ))}
          </td>
          <td className="px-3 py-2 text-[13px] leading-6 text-stone-800">
            {property.rationale
              ? property.rationale.length > 220
                ? `${property.rationale.slice(0, 220)}…`
                : property.rationale
              : "Keine Begründung hinterlegt."}
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
          <tr data-mask-property-rework={property.path} className="border-b border-stone-200/70">
            <td colSpan={COLUMN_COUNT} className="p-0">
              <div className="border-l-4 border-l-amber-400 bg-amber-50 px-4 py-3">
                <label
                  htmlFor="mask-review-comment"
                  className="text-xs font-semibold text-amber-950"
                >
                  Nacharbeit für „{property.label}“ — bitte konkret begründen
                </label>
                <textarea
                  id="mask-review-comment"
                  autoFocus
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="mt-2 min-h-20 w-full rounded-md border border-amber-300 bg-white p-3 text-sm"
                  placeholder="Zum Beispiel: primaryFocus bitte gegen die Kur-Kontaktzeit neu prüfen."
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
          <tr data-mask-property-detail={property.path} className="border-b border-stone-200/70">
            <td colSpan={COLUMN_COUNT} className="p-0">
              <PropertyDetailPanel property={property} />
            </td>
          </tr>
        ) : null}
      </Fragment>
    )
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
          {detail.runStatus === "completed" ? (
            <p className="mt-1 text-sm text-stone-600">
              {detail.openProperties} von {detail.propertyCount} Eigenschaften sind noch offen · G0:{" "}
              {detail.g0Value}
            </p>
          ) : null}
        </div>
        <div className="ml-auto w-full max-w-sm text-left sm:text-right">
          {detail.runStatus === "pending" ? (
            <span className="inline-flex rounded-md border border-stone-300 bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-600">
              Lauf ausstehend
            </span>
          ) : detail.excluded ? (
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
            {detail.runStatus === "pending"
              ? "Der Klassifizierungslauf für dieses Produkt steht noch aus."
              : detail.excluded
                ? detail.canApproveBoundary
                  ? "Bestätigt die G0-Entscheidung für diesen exakten Record. Keine Katalogfreigabe."
                  : "Der G0-Ausschluss ist bereits bestätigt."
                : (detail.reviewBlockers[0] ??
                  "Gibt den gesamten Record für diese exakte Formelversion frei. Keine Katalogfreigabe.")}
          </p>
        </div>
      </div>

      {detail.staleReview ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          Der Record hat sich geändert. Alle Freigaben sind wieder offen.
        </p>
      ) : null}

      {detail.runStatus === "pending" ? (
        <section className="mt-5 rounded-md border border-stone-200 bg-white p-4">
          <h3 className="font-semibold">Lauf ausstehend</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Für dieses Produkt liegt noch kein Reference-Key-Record unter{" "}
            <code className="rounded bg-stone-100 px-1 text-xs">
              reference-key-v0/{detail.productId}.json
            </code>{" "}
            vor. Identität, INCI und Anwendung sind bereits aus der eingefrorenen Kohorte verfügbar;
            das Property-Audit erscheint, sobald der Klassifizierungslauf abgeschlossen ist.
          </p>
        </section>
      ) : null}

      {detail.excluded && detail.runStatus === "completed" ? (
        <section className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Gate G0 · {detail.g0Value} · kein Profil</h3>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            Dieser Record hat kein Lean-Matching-Profil — die G0-Grenzevidenz steht in der
            Eigenschaftentabelle unten.
          </p>
        </section>
      ) : null}

      {detail.reviewRoutingNotes.length ? (
        <section className="mt-5 rounded-md border border-sky-200 bg-sky-50 p-4">
          <h3 className="font-semibold text-stone-950">Review-Routing-Hinweise</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-800">
            {detail.reviewRoutingNotes.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.adjudicationPoints.length ? (
        <section className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4">
          <h3 className="font-semibold text-rose-950">
            Offene Adjudikationspunkte an diesem Produkt ({detail.adjudicationPoints.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {detail.adjudicationPoints.map((entry) => (
              <li key={entry.id} className="rounded-md border border-rose-200 bg-white p-3">
                <h4 className="font-semibold text-rose-950">{entry.title}</h4>
                <p className="mt-1 text-sm leading-6 text-stone-800">{entry.body}</p>
                <p className="mt-1 text-xs text-stone-500">Quelle: {entry.source}</p>
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

      {detail.projectedOutputs ? (
        <section
          className="mt-5 rounded-md border border-stone-200 bg-white p-4"
          data-mask-projected-outputs="true"
        >
          <h3 className="font-semibold">Projizierte Ausgaben</h3>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            Deterministische Folge der oben geprüften Feldwerte. Wird angezeigt, nicht separat
            freigegeben — wer einer Ausgabe widerspricht, widerspricht dem Feld, das sie treibt.
          </p>
          <dl className="mt-3 grid gap-2 text-sm text-stone-800 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">Konzentration: </dt>
              <dd className="inline">{detail.projectedOutputs.concentration ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Gewicht: </dt>
              <dd className="inline">{detail.projectedOutputs.weight ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Balance-Richtung: </dt>
              <dd className="inline">{detail.projectedOutputs.balanceDirection ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Reparatur-Unterstützung: </dt>
              <dd className="inline">{detail.projectedOutputs.repairSupportLevel ?? "—"}</dd>
            </div>
          </dl>
          {detail.projectedOutputs.functionalBenefits.length ? (
            <p className="mt-2 text-sm text-stone-700">
              <span className="font-semibold">Funktionale Vorteile:</span>{" "}
              {detail.projectedOutputs.functionalBenefits.join(" · ")}
            </p>
          ) : null}
          {detail.projectedOutputs.suitableThicknesses.length ? (
            <p className="mt-2 text-sm text-stone-700">
              <span className="font-semibold">Passende Haardicken:</span>{" "}
              {detail.projectedOutputs.suitableThicknesses.join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {detail.assumptionNotes.length ? (
        <section className="mt-5 rounded-md border border-stone-200 bg-white p-4">
          <h3 className="font-semibold">Annahmen</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-800">
            {detail.assumptionNotes.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {reworkPath === null ? (
        <details className="mt-5 rounded-md border border-stone-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">
            Reviewer-Kommentar
          </summary>
          <div className="px-4 pb-4">
            <label htmlFor="mask-review-comment" className="text-sm text-stone-700">
              Für Nacharbeit ist ein konkreter Kommentar erforderlich. Für Freigaben ist er
              optional.
            </label>
            <textarea
              id="mask-review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-md border border-stone-300 p-3 text-sm"
              placeholder="Zum Beispiel: primaryFocus bitte gegen die Kur-Kontaktzeit neu prüfen."
            />
          </div>
        </details>
      ) : null}

      {detail.runStatus === "completed" ? (
        <>
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
              <tbody>
                <tr>
                  <th
                    colSpan={COLUMN_COUNT}
                    scope="colgroup"
                    className="border-y border-stone-200 bg-[#f7efe6] px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-700"
                  >
                    G0 — Produktform-Gate
                  </th>
                </tr>
                {g0Row.map((property) => renderPropertyRow(property))}
                {profileRows.length ? (
                  <tr>
                    <th
                      colSpan={COLUMN_COUNT}
                      scope="colgroup"
                      className="border-y border-stone-200 bg-[#f7efe6] px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-700"
                    >
                      Profil ({profileRows.length} Merkmale)
                    </th>
                  </tr>
                ) : null}
                {profileRows.map((property) => renderPropertyRow(property))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}

export function MaskResearchLabClient({ data }: { data: MaskLabData }) {
  const [items, setItems] = useState(data.queueItems)
  const [summary, setSummary] = useState(data.summary)
  const [selectedDetail, setSelectedDetail] = useState<MaskDetail | null>(data.initialDetail)
  const [selectedId, setSelectedId] = useState<string | null>(data.initialDetail.productId)
  const [comment, setComment] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [activeLane, setActiveLane] = useState<QueueLane>(laneOf(data.initialDetail))
  const requestSequence = useRef(0)

  const laneCounts = useMemo(
    () =>
      items.reduce(
        (counts, item) => {
          counts[laneOf(item)] += 1
          return counts
        },
        { offen: 0, nacharbeit: 0, freigegeben: 0, g0_bestaetigt: 0 } as Record<QueueLane, number>,
      ),
    [items],
  )
  const visibleItems = useMemo(
    () => items.filter((item) => laneOf(item) === activeLane),
    [activeLane, items],
  )

  async function selectItem(productId: string) {
    const sequence = ++requestSequence.current
    setSelectedId(productId)
    setSelectedDetail(null)
    setFeedback("Audit wird geladen …")
    try {
      const response = await fetch(
        `/api/labs/mask-research/queue?productId=${encodeURIComponent(productId)}`,
      )
      const payload = await response.json()
      if (!response.ok || !payload.detail)
        throw new Error(payload.error ?? "Mask-Audit konnte nicht geladen werden.")
      if (requestSequence.current === sequence) {
        setSelectedDetail(payload.detail as MaskDetail)
        setFeedback(null)
        setComment("")
      }
    } catch (error) {
      if (requestSequence.current === sequence)
        setFeedback(
          error instanceof Error ? error.message : "Mask-Audit konnte nicht geladen werden.",
        )
    }
  }

  async function submit(action: ReviewAction, propertyPath?: string) {
    if (!selectedDetail || pending) return
    if (action === "request_rework" && !comment.trim()) {
      setFeedback("Bitte begründe die Nacharbeit im Reviewer-Kommentar.")
      document.getElementById("mask-review-comment")?.focus()
      return
    }
    const sequence = ++requestSequence.current
    const reviewedProductId = selectedDetail.productId
    const reviewedProductName = selectedDetail.productName
    setPending(true)
    setFeedback("Entscheidung wird gespeichert …")
    try {
      const response = await fetch("/api/labs/mask-research/review", {
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
      const nextItems = (payload.data.queueItems ?? []) as MaskQueueItem[]
      setItems(nextItems)
      if (payload.data.summary) setSummary(payload.data.summary as MaskLabData["summary"])
      if (requestSequence.current === sequence) {
        setSelectedDetail(payload.detail as MaskDetail)
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
              <h1 className="text-3xl font-semibold">Mask Research Lab</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
                Prüfe alle {summary.products} Gold-Set-Produkte der Kalibrierungskohorte Eigenschaft
                für Eigenschaft. Jede Zeile trägt Wert, Konfidenz, Evidenzlevel und die Begründung
                aus der Evidenzkette. Keine Katalogfreigabe, keine Product-Intake-Aktion.
              </p>
              <p className="mt-2 text-xs text-stone-500">
                Standard {data.meta.standardVersion} · Kohorte {data.meta.cohortId} · Key{" "}
                {data.meta.referenceKeyVersion} · Kohorte eingefroren {data.meta.frozen}
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
            </div>
          </div>
          {summary.pending > 0 ? (
            <p className="rounded-md border border-stone-200 bg-white p-3 text-xs leading-5 text-stone-600">
              {summary.pending} Produkt(e) warten noch auf den Klassifizierungslauf (kein
              Reference-Key-Record unter{" "}
              <code className="rounded bg-stone-100 px-1">reference-key-v0/</code>).
            </p>
          ) : null}
        </header>

        {data.openG0Question ? (
          <section className="rounded-md border border-rose-200 bg-rose-50 p-4">
            <h2 className="font-semibold text-rose-950">Offene G0-Frage der Kohorte</h2>
            <p className="mt-1 text-sm leading-6 text-rose-950">{data.openG0Question}</p>
          </section>
        ) : null}

        {data.openAdjudications.length ? (
          <section className="rounded-md border border-rose-200 bg-rose-50 p-4">
            <h2 className="font-semibold text-rose-950">
              Offene Adjudikationspunkte ({data.openAdjudications.length})
            </h2>
            <p className="mt-1 text-sm leading-6 text-rose-950">
              Diese Punkte sind in den Records bewusst offen. Sie erscheinen zusätzlich direkt am
              betroffenen Produkt, damit du sie im Kontext entscheiden kannst.
            </p>
            <ul className="mt-3 space-y-2">
              {data.openAdjudications.map((entry) => (
                <li key={entry.id} className="rounded-md border border-rose-200 bg-white p-3">
                  <h3 className="font-semibold text-rose-950">{entry.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-800">{entry.body}</p>
                  <p className="mt-1 text-xs text-stone-500">Quelle: {entry.source}</p>
                </li>
              ))}
            </ul>
          </section>
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
            <div className="flex gap-3 overflow-x-auto pb-2 lg:block lg:space-y-3 lg:overflow-visible">
              {visibleItems.map((item) => (
                <article
                  key={item.productId}
                  data-mask-queue-card={item.productId}
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
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(item)}`}
                    >
                      {item.statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-600">{item.archetypeRole}</p>
                  {item.runStatus === "completed" ? (
                    <p className="mt-2 text-xs text-stone-700">
                      {item.openProperties} von {item.propertyCount} Eigenschaften offen · G0:{" "}
                      {item.g0Value}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-stone-500">Lauf ausstehend</p>
                  )}
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
