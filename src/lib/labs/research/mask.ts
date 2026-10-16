import "server-only"

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import {
  getMaskResearchLabData,
  getMaskResearchProductDetail,
  type MaskProductDetail,
} from "../mask-research-access"
import {
  compactName,
  compactPackSize,
  completionActions,
  evidence,
  nativeStatus,
  propertyActions,
  sealDetail,
  shortOriginal,
} from "./adapter-helpers"
import approvedCopy from "./approved-mask-copy.json"
import {
  researchValue,
  type ResearchLabData,
  type ResearchLane,
  type ResearchQueueItem,
} from "./model"

const ROOT = join(process.cwd(), "data/research/mask-inci/v1.0")
const fieldSchema = z
  .object({
    value: z.union([z.string(), z.boolean(), z.array(z.string())]),
    confidence: z.string().nullish(),
    rationale: z.string().nullish(),
  })
  .passthrough()
const laneSchema = z
  .object({
    productId: z.string(),
    standardVersion: z.string(),
    g0: fieldSchema,
    profile: z.record(z.string(), fieldSchema).optional(),
    attestation: z
      .object({ inputsRead: z.array(z.string()) })
      .passthrough()
      .optional(),
    identity: z.object({ rawInciSha256: z.string() }).passthrough().optional(),
  })
  .passthrough()
const packetSchema = z.object({ productId: z.string(), rawInci: z.string() }).passthrough()

function sha(text: string) {
  return createHash("sha256").update(text).digest("hex")
}
function readLane(directory: string, id: string) {
  const raw = readFileSync(join(ROOT, directory, `${id}.json`), "utf8")
  return { record: laneSchema.parse(JSON.parse(raw)), hash: sha(raw) }
}

function comparison(detail: MaskProductDetail) {
  let reference: ReturnType<typeof readLane> | null = null
  try {
    reference = readLane("reference-key-v1", detail.productId)
    const blind = readLane("blind-lane-v1", detail.productId)
    const packetPath = `data/research/mask-inci/v1.0/blind-packets/${detail.productId}.json`
    const packet = packetSchema.parse(
      JSON.parse(readFileSync(join(process.cwd(), packetPath), "utf8")),
    )
    const formulaHash = sha(detail.identity.rawInci)
    if (
      reference.record.productId !== detail.productId ||
      blind.record.productId !== detail.productId ||
      packet.productId !== detail.productId ||
      reference.record.identity?.rawInciSha256 !== formulaHash ||
      sha(packet.rawInci) !== formulaHash ||
      !blind.record.attestation?.inputsRead.includes(packetPath)
    ) {
      return {
        reference,
        blind: null,
        error: "Blindlauf: Produkt- oder Formelbindung nicht bestätigt; kein direkter Vergleich.",
      }
    }
    return { reference, blind, error: null }
  } catch {
    return {
      reference,
      blind: null,
      error: "Blindlauf fehlt oder ist nicht sicher lesbar; kein direkter Vergleich.",
    }
  }
}

function queueItem(
  item: ReturnType<typeof getMaskResearchLabData>["queueItems"][number],
): ResearchQueueItem {
  return {
    id: item.productId,
    name:
      item.productId === approvedCopy.productId
        ? "Argan Oil Haarkur"
        : compactName(item.productName, item.brandName),
    fullName: item.productName,
    brand: item.brandName,
    packSize: compactPackSize(item.packSize),
    status: item.runStatus === "pending" ? "pending" : nativeStatus(item.reviewStatus),
    openCount: item.openProperties,
    totalCount: item.propertyCount,
    hint: item.staleReview
      ? "Geänderte Formel erneut prüfen"
      : item.uncertainFields.length
        ? `${item.uncertainFields.length} Prüfhinweise`
        : item.excluded
          ? "Produktform-Ausschluss prüfen"
          : null,
  }
}

function mapDetail(detail: MaskProductDetail) {
  const sources = comparison(detail)
  const copyA =
    detail.productId === approvedCopy.productId &&
    sources.reference?.hash === approvedCopy.referenceSha256
  const copyB =
    detail.productId === approvedCopy.productId && sources.blind?.hash === approvedCopy.blindSha256
  const blindVersion = sources.blind?.record.standardVersion
  const sameVersion = blindVersion === detail.standardVersion
  const referenceIdentity = sources.reference?.record.identity
  const extra = { recordFingerprint: detail.recordFingerprint }
  return sealDetail({
    ...queueItem(detail),
    standard: detail.standardVersion,
    valueAuthority: "A · Referenz",
    notices: [
      ...(detail.staleReview
        ? ["Gespeicherte Freigaben passen nicht mehr zum aktuellen Datensatz. Bitte erneut prüfen."]
        : []),
      ...(referenceIdentity?.identityState === "provisional_identity_conflict"
        ? ["Identität vorläufig · Quellenkonflikt in der Produktakte"]
        : []),
      ...(String(referenceIdentity?.formulaSource ?? "")
        .toLowerCase()
        .includes("fallback")
        ? ["INCI aus Ersatzquelle"]
        : []),
      ...(sources.error
        ? [sources.error]
        : !sameVersion
          ? [
              `Methodenversionen verschieden: Referenz ${detail.standardVersion}, Blindlauf ${blindVersion}. Ergebnisse werden nicht als gleicher Lauf verglichen.`,
            ]
          : []),
    ],
    properties: detail.properties.map((property) => {
      const key = property.path.replace(/^profile\./, "")
      const copy = approvedCopy.fields[key as keyof typeof approvedCopy.fields]
      const refField =
        key === "g0" ? sources.reference?.record.g0 : sources.reference?.record.profile?.[key]
      const blindField =
        key === "g0" ? sources.blind?.record.g0 : sources.blind?.record.profile?.[key]
      const reasoning = copyA && copy ? copy.reason : property.reasoningShort
      const lanes: ResearchLane[] = [
        {
          id: "A",
          label: "Referenz",
          value: researchValue(refField?.value ?? property.value),
          confidence: property.confidence,
          reasoning,
          provenance: `reference-key-v1 · ${detail.standardVersion}`,
          comparable: true,
          original: refField ?? property,
        },
        {
          id: "B",
          label: "Blindlauf",
          value: blindField ? researchValue(blindField.value) : null,
          confidence: blindField?.confidence ?? null,
          reasoning: copyB && copy ? copy.b : shortOriginal(blindField?.rationale),
          provenance: `blind-lane-v1 · ${blindVersion ?? "Version nicht verfügbar"}`,
          comparable: Boolean(blindField) && sameVersion,
          ...(!blindField
            ? { unavailableReason: sources.error ?? "Dieses Feld fehlt im Blindlauf." }
            : {}),
          original: blindField ?? null,
        },
      ]
      return {
        id: property.path,
        label: key === "g0" ? "Produktform" : property.label,
        value: researchValue(refField?.value ?? property.value),
        valueLabel: "Referenz",
        confidence: property.confidence,
        reasoning,
        warning:
          copyA && copy?.warning
            ? copy.warning
            : detail.uncertainFields.includes(key)
              ? "Prüfhinweis im Referenzdatensatz; Originalbelege beachten."
              : null,
        status: nativeStatus(property.humanReviewStatus),
        lanes,
        comparisonNote: copyA && copyB && copy ? copy.comparisonNote : undefined,
        annotations: property.derivedAnnotations.map(
          (entry) => `${entry.label}: ${researchValue(entry.value)}`,
        ),
        evidence: [
          evidence("Original aus A · Referenz", refField ?? property),
          evidence("Weitere Ableitungen", property.derivedAnnotations),
          {
            title: "Gegensignale und Grenzen",
            items: [...property.counterSignals, ...property.limitations],
          },
        ],
        actions: propertyActions({
          itemId: detail.productId,
          propertyId: property.path,
          approved: property.humanReviewStatus === "approved",
          enabled: detail.runStatus === "completed",
          extra,
        }),
      }
    }),
    evidence: [
      evidence("Produktakte · INCI & Quellen", {
        originalName: detail.productName,
        ...detail.identity,
        referenceIdentity,
      }),
      evidence("Prüfhinweise und Entscheidungen", {
        routing: detail.reviewRoutingNotes,
        adjudications: detail.adjudicationPoints,
        assumptions: detail.assumptionNotes,
      }),
      evidence("Historische Projektion · keine aktuelle Katalogfreigabe", detail.projectedOutputs),
      {
        title: "Vergleichsgrundlage",
        text: "Zwei gespeicherte Ergebnis-Lanes, keine live laufenden Agenten. Der Blindlauf nutzte einen Standard mit teils offengelegten Kohortenbeispielen; er ist auf diesen Feldern keine vollständig unabhängige Bestätigung.",
        original: {
          referenceHash: sources.reference?.hash ?? null,
          blindHash: sources.blind?.hash ?? null,
          referenceRun: "reference-key-v1",
          blindRun: "blind-lane-v1",
          report: "docs/research/mask-inci/v1.0/calibration-round-2-report.md",
        },
      },
    ],
    actions: completionActions({
      itemId: detail.productId,
      canApprove: detail.canApproveProduct,
      canApproveBoundary: detail.canApproveBoundary,
      excluded: detail.excluded,
      openCount: detail.openProperties,
      extra,
    }),
    blockers: detail.reviewBlockers,
    lastDecision: detail.lastReviewDecision
      ? `${detail.lastReviewDecision.savedAt} · ${detail.lastReviewDecision.comment ?? detail.lastReviewDecision.action}`
      : null,
  })
}

export function getMaskSharedLab(itemId?: string): ResearchLabData {
  const data = getMaskResearchLabData()
  const detail = itemId ? getMaskResearchProductDetail(itemId) : data.initialDetail
  if (!detail) throw new Error("Produkt nicht in der Masken-Kohorte gefunden.")
  return {
    category: "mask",
    categoryLabel: "Masken",
    dataset: "default",
    legacyHref: "/labs/mask-research",
    standard: detail.standardVersion,
    queue: data.queueItems.map(queueItem),
    detail: mapDetail(detail),
    evidence: [evidence("Kohorte und methodische Herkunft", data.meta)],
  }
}
