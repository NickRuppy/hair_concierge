import "server-only"

import {
  loadShampooV14PilotReviewItems,
  resolveShampooV14ReviewDataset,
  type ShampooV14PilotReviewItem,
} from "../shampoo-v14-pilot-review"
import { compactName, evidence, nativeStatus, sealDetail, shortOriginal } from "./adapter-helpers"
import {
  researchValue,
  type ResearchAction,
  type ResearchLabData,
  type ResearchProperty,
  type ResearchQueueItem,
} from "./model"

const LABELS: Record<string, string> = {
  cleansingStrength: "Reinigungsstärke",
  conditioningLevel: "Pflegelevel",
  weightPotential: "Gewichtspotenzial",
  focusPrimary: "Primärer Fokus",
  focusSecondary: "Sekundärer Fokus",
  usageRole: "Nutzungsrolle",
  scalpComfortTarget: "Kopfhaut-Komfortziel",
  dandruffSupport: "Anti-Schuppen-Unterstützung",
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
function scopes(item: ShampooV14PilotReviewItem) {
  return [
    item.review.formula,
    ...item.properties.map((property) => item.review.properties[property.key]),
    item.review.projection,
  ]
}
function queueItem(item: ShampooV14PilotReviewItem): ResearchQueueItem {
  const identity = object(item.formula?.identity)
  const summary = object(item.projection?.outcome.summary)
  const fullName = String(identity.exact_current_de_name ?? summary.productName ?? item.id)
  const brand = String(identity.brand ?? "Marke offen")
  const statuses = scopes(item)
  return {
    id: item.id,
    name: compactName(fullName, brand),
    fullName,
    brand,
    packSize: String(
      object(identity.size).display ??
        identity.pack_size ??
        identity.packSize ??
        "Größe nicht angegeben",
    ),
    status:
      item.integrity.status === "blocked"
        ? "blocked"
        : item.review.product.status === "approved"
          ? "approved"
          : statuses.some((scope) => scope?.status === "rework_requested")
            ? "rework"
            : "open",
    openCount: statuses.filter((scope) => scope?.status !== "approved").length,
    totalCount: statuses.length,
    hint:
      item.integrity.status === "blocked"
        ? "Artefakte blockiert"
        : item.focusPolicy
          ? "Fokus v1.5 · Vergleichsläufe v1.4"
          : null,
  }
}
function mapDetail(item: ShampooV14PilotReviewItem, dataset: string) {
  const ready =
    item.integrity.status === "ready" && Boolean(item.formula) && Boolean(item.projection)
  const body = { productId: item.id, datasetId: dataset, expectedHash: item.integrity.hash }
  function actions(scope: string, approved: boolean): ResearchAction[] {
    const action =
      scope === "formula"
        ? "approve_formula"
        : scope === "projection"
          ? "approve_projection"
          : "approve_property"
    return [
      {
        id: `approve:${scope}`,
        label: "Freigeben",
        kind: "approve",
        propertyId: scope,
        enabled: ready && !approved,
        nativeBody: {
          ...body,
          action,
          ...(action === "approve_property" ? { property: scope } : {}),
        },
      },
      {
        id: `rework:${scope}`,
        label: "Nacharbeit",
        kind: "rework",
        propertyId: scope,
        enabled: ready,
        nativeBody: { ...body, action: "request_rework", scope },
      },
    ]
  }
  const properties: ResearchProperty[] = item.properties.map((property) => ({
    id: property.key,
    label: LABELS[property.key],
    value: researchValue(property.value),
    valueLabel: "Arbeitswert",
    confidence: property.confidence,
    reasoning: shortOriginal(property.rationale),
    warning: property.historicalAdjudication
      ? "Arbeitswert nach Fokus-Policy v1.5; A/B sind historische v1.4-Ergebnisse."
      : null,
    status: nativeStatus(item.review.properties[property.key]?.status ?? "pending"),
    lanes: [
      ["A", property.laneA],
      ["B", property.laneB],
    ].map(([id, lane]) => {
      const result = lane as typeof property.laneA
      return {
        id: id as string,
        label: `Lane ${id}`,
        value: researchValue(result.value),
        confidence: result.confidence,
        reasoning: null,
        provenance: `${dataset} · gespeicherter v1.4-Vergleich`,
        comparable: true,
        original: result,
      }
    }),
    comparisonNote:
      "Der Arbeitswert ist das entschiedene Ergebnis. Die Vergleichsdatei enthält für A/B Werte und Konfidenzen, aber keine separaten Begründungen.",
    annotations: [],
    evidence: [
      evidence("Entschiedene Begründung und Formelbefunde · Original", {
        rationale: property.rationale,
        facts: property.formulaFacts,
        counterSignal: property.counterSignal,
        neighboringAlternative: property.neighboringAlternative,
        evidenceRefs: property.evidenceRefs,
      }),
      evidence("Entscheidung und historischer Abgleich", {
        adjudication: property.adjudication,
        historical: property.historicalAdjudication ?? null,
      }),
    ],
    actions: actions(property.key, item.review.properties[property.key]?.status === "approved"),
  }))
  if (item.formula)
    properties.unshift({
      id: "formula",
      label: "Formel & Quellen",
      value: item.formula.status,
      valueLabel: "Prüfschritt",
      confidence: null,
      reasoning:
        "Die exakte Produktidentität, Formelquelle und aufgelöste Quellenkonflikte prüfen. Diese Freigabe ist ein eigener Schritt vor der Gesamtfreigabe.",
      warning: null,
      status: nativeStatus(item.review.formula.status),
      lanes: [],
      annotations: [],
      evidence: [evidence("Eingefrorene Formel und Quellennachweise", item.formula)],
      actions: actions("formula", item.review.formula.status === "approved"),
      group: "formula",
    })
  if (item.projection)
    properties.push({
      id: "projection",
      label: "Production-Light-Projektion",
      value: "Historisch · v1.4",
      valueLabel: "Prüfschritt",
      confidence: null,
      reasoning:
        "Die gespeicherte Projektion mit Haardicken-Passung, Spezifikationen und erforderlichen Anwendungsprotokollen prüfen. Sie bleibt ein eigener Freigabeschritt und aktiviert keinen Katalogeintrag.",
      warning: item.focusPolicy
        ? "Die historische Projektion bleibt von der neueren Fokus-Policy getrennt."
        : null,
      status: nativeStatus(item.review.projection.status),
      lanes: [],
      annotations: [],
      evidence: [evidence("Projektion · vollständige Zeilen und Begründungen", item.projection)],
      actions: actions("projection", item.review.projection.status === "approved"),
      group: "projection",
    })
  const blockers = !ready
    ? [item.integrity.diagnostic ?? "Formel oder Projektion ist nicht reviewbereit."]
    : scopes(item).every((scope) => scope?.status === "approved")
      ? []
      : ["Formel, alle acht Eigenschaften und die Projektion müssen zuerst freigegeben sein."]
  const last = item.review.history.at(-1)
  return sealDetail({
    ...queueItem(item),
    standard: "Shampoo v1.4 · Fokus-Policy v1.5",
    valueAuthority: "Entschiedener Arbeitswert; gespeicherte A/B-Ergebnisse separat",
    notices: [
      ...(item.integrity.previousReviewHash
        ? ["Artefakte geändert: Frühere Freigaben wurden archiviert."]
        : []),
      ...(!ready ? blockers : []),
    ],
    properties,
    evidence: [
      evidence("Produktakte · INCI & Quellen", item.formula ?? item.integrity),
      evidence("Fokus-Policy v1.5 · historische v1.4-Werte erhalten", item.focusPolicy),
      evidence("Review-Herkunft und frühere Freigaben", {
        hash: item.integrity.hash,
        history: item.review.history,
        archived: item.review.archived,
      }),
    ],
    actions: [
      {
        id: "complete",
        label: "Produktprüfung abschließen",
        kind: "complete",
        enabled: ready && blockers.length === 0 && item.review.product.status !== "approved",
        confirmation:
          "Formel, Eigenschaften und historische Projektion wurden einzeln freigegeben. Die Produktprüfung im lokalen Lab abschließen?",
        nativeBody: { ...body, action: "approve_product" },
      },
    ],
    blockers,
    lastDecision: last ? `${last.at} · ${last.comment ?? last.action}` : null,
  })
}

export function getShampooSharedLab(datasetId: string, itemId?: string): ResearchLabData {
  const dataset = resolveShampooV14ReviewDataset(datasetId === "default" ? "pilot" : datasetId)
  const items = loadShampooV14PilotReviewItems(dataset.options)
  const selected = itemId
    ? items.find((item) => item.id === itemId)
    : (items.find(
        (item) => item.integrity.status === "ready" && item.review.product.status !== "approved",
      ) ?? items[0])
  if (!selected) throw new Error("Shampoo-Produkt nicht gefunden.")
  return {
    category: "shampoo",
    categoryLabel: "Shampoo",
    dataset: dataset.id,
    legacyHref: `/labs/shampoo-research?dataset=${dataset.id}`,
    standard: "Shampoo v1.4 · Fokus-Policy v1.5",
    queue: items.map(queueItem),
    detail: mapDetail(selected, dataset.id),
    evidence: [],
  }
}
