import "server-only"

import {
  getConditionerResearchLabData,
  getConditionerResearchProductDetail,
  type ConditionerResearchProductDetail,
  type ConditionerResearchQueueItem,
} from "../conditioner-research-access"
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
import { researchValue, type ResearchLabData, type ResearchQueueItem } from "./model"

const LABELS: Record<string, string> = {
  conditioning_level: "Pflegelevel",
  weight_potential: "Gewichtspotenzial",
  care_direction: "Pflegerichtung",
  repair_support_level: "Reparatur-Unterstützung",
  primary_focus: "Primärer Fokus",
  secondary_focus: "Sekundärer Fokus",
  hair_thickness_fit: "Passung Haardicke",
  damage_fit: "Passung Schadenslevel",
  texture_fit: "Passung Textur",
}
function queueItem(
  item: ConditionerResearchQueueItem,
  detail: ConditionerResearchProductDetail,
): ResearchQueueItem {
  const statuses = Object.values(detail.propertyStatuses)
  return {
    id: item.productId,
    name: compactName(item.productName, item.brandName),
    fullName: item.productName,
    brand: item.brandName,
    packSize: compactPackSize(item.packSize),
    status: nativeStatus(item.reviewStatus),
    openCount: statuses.filter((status) => status !== "approved").length,
    totalCount: statuses.length,
    hint: item.sourceConflict
      ? "Quellenkonflikt"
      : item.excluded
        ? "Produktform-Ausschluss prüfen"
        : item.uncertaintyCount
          ? `${item.uncertaintyCount} Prüfhinweise`
          : null,
  }
}
function mapDetail(detail: ConditionerResearchProductDetail) {
  const queue = queueItem(detail, detail)
  return sealDetail({
    ...queue,
    standard: detail.standardVersion,
    valueAuthority: "Akzeptiertes Profil · historischer Blind-Review separat",
    notices: [
      ...(detail.staleReview
        ? ["Geänderte Formel oder Felder: Betroffene Freigaben wurden erneut geöffnet."]
        : []),
      ...(detail.conflictExplanation ? [detail.conflictExplanation] : []),
      ...(detail.excluded
        ? [
            detail.boundaryExplanation ??
              "Diese Produktform gehört nicht zur Conditioner-Kategorie.",
          ]
        : []),
      "Für diese Kalibrierungswerte wurde keine Konfidenz gespeichert. Begründungen bleiben in der Originalsprache.",
    ],
    properties: (detail.profile?.fields ?? []).map((field) => ({
      id: field.path,
      label: LABELS[field.path] ?? field.label,
      value: researchValue(field.acceptedValue),
      valueLabel: "Referenz",
      confidence: null,
      reasoning: shortOriginal(field.thresholdReasoning[0] ?? field.rationale),
      warning: detail.uncertainFields.includes(field.path)
        ? "Vorläufiges Feld: Prüfhinweise und Grenzen beachten."
        : null,
      status: nativeStatus(field.humanReviewStatus),
      lanes: [
        {
          id: "K",
          label: "Akzeptiertes Profil",
          value: researchValue(field.acceptedValue),
          confidence: null,
          reasoning: shortOriginal(field.rationale),
          provenance: `Akzeptierter Schlüssel · ${detail.standardVersion}`,
          comparable: false,
          original: field,
        },
        {
          id: "G",
          label: "Blind-Review · Kalibrierung",
          value: field.blindValue ? researchValue(field.blindValue) : null,
          confidence: null,
          reasoning: null,
          provenance:
            "Historischer Kalibrierungsabgleich · keine separate Feldbegründung im Loader",
          comparable: false,
          ...(!field.blindValue
            ? { unavailableReason: "Kein Blind-Review-Wert gespeichert." }
            : {}),
          original: { value: field.blindValue },
        },
      ],
      comparisonNote:
        "K ist das akzeptierte Profil, G der historische Blind-Review. Das sind keine zwei aktuellen Agenten-Voten. Konfidenzen und separate G-Begründungen sind hier nicht gespeichert.",
      annotations:
        field.evidenceBasis === "policy_derivation"
          ? ["Regelbasiert abgeleitet · im Conditioner-Lab separat reviewbar"]
          : [],
      evidence: [
        evidence("Vollständige Feldbegründung · Original", field),
        { title: "Grenzen", items: field.limitations },
      ],
      actions: propertyActions({
        itemId: detail.productId,
        propertyId: field.path,
        approved: field.humanReviewStatus === "approved",
        enabled: !detail.excluded,
      }),
    })),
    evidence: [
      evidence("Produktakte · INCI & Quellen", {
        originalName: detail.productName,
        identity: detail.identity,
        formula: detail.formula,
        directions: detail.directions,
        sources: detail.sources,
      }),
      evidence("Unsicherheit und Kategoriegrenze", {
        notes: detail.uncertaintyNotes,
        boundary: detail.boundaryExplanation,
        formulaFingerprint: detail.formulaFingerprint,
        profileFingerprint: detail.profileFingerprint,
        fieldFingerprints: detail.fieldFingerprints,
      }),
    ],
    actions: completionActions({
      itemId: detail.productId,
      excluded: detail.excluded,
      canApprove: detail.canApproveProduct,
      canApproveBoundary: detail.canApproveBoundary,
      openCount: queue.openCount,
    }),
    blockers: detail.reviewBlockers,
    lastDecision: detail.lastReviewDecision
      ? `${detail.lastReviewDecision.savedAt} · ${detail.lastReviewDecision.comment ?? detail.lastReviewDecision.action}`
      : null,
  })
}

export function getConditionerSharedLab(itemId?: string): ResearchLabData {
  const data = getConditionerResearchLabData()
  const detail = itemId ? getConditionerResearchProductDetail(itemId) : data.initialDetail
  if (!detail) throw new Error("Conditioner-Produkt nicht gefunden.")
  const queue = data.queueItems.map((item) => {
    const full = getConditionerResearchProductDetail(item.productId)
    if (!full) throw new Error("Conditioner-Queue unvollständig.")
    return queueItem(item, full)
  })
  return {
    category: "conditioner",
    categoryLabel: "Conditioner",
    dataset: "default",
    legacyHref: "/labs/conditioner-research",
    standard: detail.standardVersion,
    queue,
    detail: mapDetail(detail),
    evidence: [
      evidence("Kalibrierung · Übereinstimmung, Entscheidungen und Stresstest", data.calibration),
    ],
  }
}
