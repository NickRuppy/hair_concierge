import "server-only"

import {
  getLeaveInResearchLabData,
  getLeaveInResearchProductDetail,
  type LeaveInResearchProductDetail,
  type LeaveInResearchQueueItem,
} from "../leave-in-research-access"
import {
  compactName,
  compactPackSize,
  completionActions,
  evidence,
  nativeStatus,
  propertyActions,
  sealDetail,
} from "./adapter-helpers"
import { researchValue, type ResearchLabData, type ResearchQueueItem } from "./model"

function queueItem(item: LeaveInResearchQueueItem): ResearchQueueItem {
  return {
    id: item.productId,
    name: compactName(item.productName, item.brandName),
    fullName: item.productName,
    brand: item.brandName,
    packSize: compactPackSize(item.packSize),
    status: nativeStatus(item.reviewStatus),
    openCount: item.openProperties,
    totalCount: item.propertyCount,
    hint: `${item.batch === "gold-set" ? "Gold-Set" : "Unbekannte Testprodukte"}${item.staleReview ? " · erneut prüfen" : item.uncertainFields.length ? ` · ${item.uncertainFields.length} Prüfhinweise` : ""}`,
  }
}
function mapDetail(detail: LeaveInResearchProductDetail) {
  return sealDetail({
    ...queueItem(detail),
    standard: detail.effectiveStandard,
    valueAuthority: "Gespeichertes Ergebnis · effektiver Standard mit Overlay",
    notices: [
      ...(detail.staleReview
        ? ["Geänderte Felder wurden erneut geöffnet. Passende Einzel-Freigaben bleiben erhalten."]
        : []),
      ...detail.cautionsDe,
      ...(detail.excluded ? [detail.g0.rationale] : []),
    ],
    properties: detail.properties.map((property) => ({
      id: property.path,
      label: property.label,
      value: researchValue(property.value),
      valueLabel: "Referenz",
      confidence: property.confidence,
      reasoning: property.reasoningShort,
      warning: property.rationaleExtractionGap
        ? "Vollständige Begründung fehlt im extrahierten Datensatz; keine zusätzliche Begründung erfunden."
        : property.adjudication
          ? `Offener Prüfpunkt: ${property.adjudication.title}`
          : null,
      status: nativeStatus(property.humanReviewStatus),
      lanes: [
        {
          id: "R",
          label: detail.batch === "gold-set" ? "Referenz" : "Unseen-Test · Lane A",
          value: researchValue(property.value),
          confidence: property.confidence,
          reasoning: property.reasoningShort,
          provenance: `${property.rationaleSource} · ${detail.effectiveStandard}`,
          comparable: true,
          original: property,
        },
      ],
      comparisonNote:
        "Der aktuelle Lab-Datensatz stellt ein Ergebnis bereit. Frühere Revisionen werden nicht als zusätzliche Agenten gezählt.",
      annotations: [
        ...(property.echo
          ? [
              `${property.echo.label}: ${researchValue(property.echo.value)} · wird mit dieser Eigenschaft geprüft`,
            ]
          : []),
        ...(property.informational
          ? ["Informativ · Bestandteil der bestehenden Formelprüfung"]
          : []),
      ],
      evidence: [
        evidence("Originalbegründung und Evidenz", {
          rationale: property.rationale,
          source: property.rationaleSource,
          observations: property.observations,
          counters: property.counterSignals,
          derivedFrom: property.derivedFrom,
          note: property.reviewNote,
          adjudication: property.adjudication,
          evidenceLevel: property.evidenceLevel,
          evidenceScope: property.evidenceScope,
        }),
      ],
      actions: propertyActions({
        itemId: detail.productId,
        propertyId: property.path,
        approved: property.humanReviewStatus === "approved",
        enabled: true,
      }),
    })),
    evidence: [
      evidence("Produktakte · INCI, Anwendung & Quellen", {
        originalName: detail.productName,
        ...detail.identity,
      }),
      evidence("Kategoriegrenze und Review-Routing", {
        g0: detail.g0,
        reviewRouting: detail.reviewRouting,
      }),
      evidence("Formelversion und Freigabebindung", {
        formulaFingerprint: detail.formulaFingerprint,
        productFingerprint: detail.productFingerprint,
        propertyFingerprints: detail.propertyFingerprints,
        approvalStandardKey: detail.standardVersion,
        effectiveStandard: detail.effectiveStandard,
        keyVersion: detail.keyVersion,
      }),
    ],
    actions: completionActions({
      itemId: detail.productId,
      excluded: detail.excluded,
      canApprove: detail.canApproveProduct,
      canApproveBoundary: detail.canApproveBoundary,
      openCount: detail.openProperties,
    }),
    blockers: detail.reviewBlockers,
    lastDecision: detail.lastReviewDecision
      ? `${detail.lastReviewDecision.savedAt} · ${detail.lastReviewDecision.comment ?? detail.lastReviewDecision.action}`
      : null,
  })
}

export function getLeaveInSharedLab(itemId?: string): ResearchLabData {
  const data = getLeaveInResearchLabData()
  const detail = itemId ? getLeaveInResearchProductDetail(itemId) : data.initialDetail
  if (!detail) throw new Error("Leave-in-Produkt nicht gefunden.")
  return {
    category: "leave-in",
    categoryLabel: "Leave-in",
    dataset: "default",
    legacyHref: "/labs/leave-in-research",
    standard: data.meta.effectiveStandard,
    queue: data.queueItems.map(queueItem),
    detail: mapDetail(detail),
    evidence: [
      evidence("Kohorte, Methoden-Overlay und gespeicherte Prüfentscheidungen", {
        meta: data.meta,
        openAdjudications: data.openAdjudications,
      }),
    ],
  }
}
