import "server-only"
import {
  getOilNativeReview,
  oilLabSources,
  type OilLabSource,
  type OilLabDataset,
} from "../oil-research-access"
import { projectOilForProduction } from "../../oil-research/production-adapter"
import { compactName, evidence, propertyActions, sealDetail } from "./adapter-helpers"
import {
  researchValue,
  type ResearchLabData,
  type ResearchProperty,
  type ResearchQueueItem,
  type ResearchStatus,
} from "./model"

function stateFor(source: OilLabSource, propertyId: string): ResearchStatus {
  const decision = getOilNativeReview(source).decisions[propertyId]
  return decision?.status === "approved"
    ? "approved"
    : decision?.status === "rework"
      ? "rework"
      : "open"
}
function standardFor(source: OilLabSource): string {
  if (source.envelope?.version === "oil-research-envelope-v2") return "Öl-Standard v0.10"
  return source.dataset === "candidate" ? "Öl-Standard v0.9" : "Öl-Standard v0.8"
}
function item(source: OilLabSource): ResearchQueueItem {
  if (!source.envelope)
    return {
      id: source.id,
      name:
        source.dataset === "candidate" ? "Ungültiges Forschungspaket" : "Ungültiges Intake-Paket",
      fullName:
        source.malformedPackage?.fileName ??
        (source.dataset === "candidate" ? "Ungültiges Forschungspaket" : "Ungültiges Intake-Paket"),
      brand: source.dataset === "candidate" ? "Lokale Forschung" : "Lokaler Intake-Export",
      packSize: "—",
      status: "blocked",
      openCount: 0,
      totalCount: 0,
      hint:
        source.malformedPackage?.diagnostic ??
        (source.dataset === "candidate"
          ? "Lokales Forschungspaket prüfen und neu erzeugen"
          : "Intake-Paket prüfen und neu exportieren"),
    }
  const state = getOilNativeReview(source)
  const openCount = source.requiredPropertyIds.filter(
    (id) => state.decisions[id]?.status !== "approved",
  ).length
  return {
    id: source.id,
    name: compactName(source.envelope.identity.product, source.envelope.identity.brand),
    fullName: source.envelope.identity.product,
    brand: source.envelope.identity.brand,
    packSize:
      source.envelope.identity.package.size_text ??
      (source.envelope.identity.package.size_ml
        ? `${source.envelope.identity.package.size_ml} ml`
        : "Größe nicht angegeben"),
    status: source.blockers.length
      ? "blocked"
      : Object.values(state.decisions).some((d) => d.status === "rework")
        ? "rework"
        : state.completedAt
          ? "approved"
          : "open",
    openCount,
    totalCount: source.requiredPropertyIds.length,
    hint: state.handoff
      ? state.handoff.status === "handed_off"
        ? "An Intake übergeben · schreibgeschützt"
        : "Übergabe ausstehend · schreibgeschützt"
      : source.bundle
        ? "Intake-Paket · Matching manuell prüfen"
        : source.candidate
          ? "Neue Forschung · Matching manuell prüfen"
          : "Historische Forschung · nur lokal",
  }
}
function detail(source: OilLabSource) {
  if (!source.envelope) {
    const queueItem = item(source)
    return sealDetail({
      ...queueItem,
      standard: standardFor(source),
      valueAuthority:
        source.dataset === "candidate"
          ? "Kein gültiges lokales Forschungspaket"
          : "Kein gültiges Intake-Paket",
      notices: [
        source.dataset === "candidate"
          ? "Dieses lokale Forschungspaket wurde nicht geladen. Andere Forschungspakete bleiben prüfbar."
          : "Dieses lokale Intake-Paket wurde nicht geladen. Andere Pakete bleiben prüfbar.",
      ],
      properties: [],
      evidence: [
        evidence("Paketdiagnose", {
          file: source.malformedPackage?.fileName ?? null,
          diagnostic: source.malformedPackage?.diagnostic ?? null,
        }),
      ],
      actions: [],
      blockers: source.blockers,
      lastDecision: null,
    })
  }
  const envelope = source.envelope,
    profile = envelope.profile,
    state = getOilNativeReview(source)
  const projection = projectOilForProduction(envelope)
  const extra = {
    dataset: source.dataset,
    packageFingerprint: source.packageFingerprint,
    reviewRevision: state.revision,
  }
  const rows: ResearchProperty[] = []
  function matchingValue() {
    const packageWithMatching = source.bundle ?? source.candidate
    if (!packageWithMatching) return "Für historische Forschung nicht erstellt"
    const proposals = packageWithMatching.matchingSuggestions
    const eligibility = Array.isArray(proposals.product_oil_eligibility)
      ? (proposals.product_oil_eligibility as Record<string, unknown>[])
      : []
    return [
      `Haardicken: ${researchValue(proposals.suitable_thicknesses)}`,
      ...eligibility.map(
        (row) =>
          `${researchValue(row.thickness)}: ${researchValue(row.oil_subtype)}; Zweck: ${researchValue(row.oil_purpose)}; Zutaten-Tags: ${researchValue(row.ingredient_flags)}`,
      ),
    ]
  }
  function add(
    id: string,
    label: string,
    value: unknown,
    original: unknown,
    reason: string | null = null,
    confidence: string | null = null,
    group: ResearchProperty["group"] = "property",
    blocked = false,
  ) {
    const current = stateFor(source, id)
    const stored =
      original && typeof original === "object" ? (original as Record<string, unknown>) : {}
    const reasoning = reason ?? (typeof stored.reason === "string" ? stored.reason : null)
    const rowConfidence =
      confidence ?? (typeof stored.confidence === "string" ? stored.confidence : null)
    const reviewable = source.requiredPropertyIds.includes(id)
    const decision = state.decisions[id]
    rows.push({
      id,
      label,
      value: researchValue(value),
      valueLabel:
        group === "projection"
          ? "Ableitung"
          : id === "matching"
            ? "Manuell prüfen"
            : "Gespeicherte Forschung",
      confidence: rowConfidence,
      reasoning,
      warning: blocked
        ? "Vorschläge fehlen oder sind unvollständig. Keine automatische Ergänzung."
        : stored.estimate === true
          ? "Schätzung aus der gespeicherten Forschung; keine Messung am Haar."
          : null,
      status: blocked ? "blocked" : current,
      lanes:
        id === "matching" || group === "projection"
          ? []
          : [
              {
                id: "Befund",
                label: "Gespeicherter Befund",
                value: researchValue(value),
                confidence: rowConfidence,
                reasoning,
                provenance: `${standardFor(source)} · Quellenautorität im Originalbeleg`,
                comparable: false,
                original,
              },
            ],
      comparisonNote:
        id === "matching" || group === "projection"
          ? undefined
          : "Ein gespeicherter Befund; keine unabhängige zweite Bewertung ergänzt.",
      annotations: decision?.comment ? [`Nacharbeit: ${decision.comment}`] : [],
      evidence: [evidence("Vollständiger Originalbeleg", original)],
      actions: reviewable
        ? propertyActions({
            itemId: source.id,
            propertyId: id,
            approved: current === "approved" || current === "rework",
            enabled: !state.handoff && !blocked,
            extra,
          })
        : [],
      group,
    })
  }
  add("base", "Basis", profile.base.value, profile.base)
  if (envelope.version === "oil-research-envelope-v1") {
    const legacyProfile = envelope.profile
    add(
      "named_oils",
      "Benannte Öle und Anteil",
      legacyProfile.named_oils.map(
        (oil) => `${oil.hero_name}: ${researchValue(oil.prominence.value)}`,
      ),
      legacyProfile.named_oils,
    )
  }
  add("weight", "Gewicht auf dem Haar", profile.weight.value, profile.weight)
  if (envelope.version === "oil-research-envelope-v1") {
    const legacyProfile = envelope.profile
    add("dispenser", "Dosierung / Spender", legacyProfile.dispenser.value, legacyProfile.dispenser)
    add(
      "penetration_potential",
      "Eindringen oder Oberflächenpflege",
      legacyProfile.penetration_potential.value,
      legacyProfile.penetration_potential,
    )
  }
  add(
    "persistence_potential",
    "Persistenz bei Leave-on",
    profile.persistence_potential,
    envelope.persistence_trace,
    envelope.persistence_trace.reason,
  )
  add("supported_uses", "Unterstützte Anwendungen", profile.supported_uses, {
    ...profile.use_evidence,
    application_scenarios: profile.application_scenarios,
  })
  add(
    "provides_heat_protection",
    "Hitzeschutz",
    profile.provides_heat_protection.value,
    profile.provides_heat_protection,
  )
  add(
    "provides_uv_protection",
    "UV-Schutz",
    profile.provides_uv_protection.value,
    profile.provides_uv_protection,
  )
  const flags = {
    silicones: "Silikone",
    mineral_oil: "Mineralöl",
    drying_alcohol: "Austrocknender Alkohol",
    fragrance: "Duftstoffe",
    scalp_active_botanicals: "Kopfhautaktive Pflanzenstoffe",
  } as const
  for (const key of Object.keys(flags) as Array<keyof typeof flags>)
    add(
      `ingredient_flags.${key}`,
      flags[key],
      profile.ingredient_flags[key].value,
      profile.ingredient_flags[key],
    )
  if (envelope.version === "oil-research-envelope-v1") {
    const legacyProfile = envelope.profile
    add(
      "scenario_fit",
      "Bedingte Eignung nach Anwendung",
      "Szenarien und Bedingungen im Originalbeleg",
      { scenario_fit: envelope.scenario_fit, fit: legacyProfile.fit },
      "Bedingte Eignung bleibt an die jeweilige Anwendung gebunden und wird nicht zu Matching-Tags vereinfacht.",
    )
  }
  add(
    "projection",
    "Drei Produkteigenschaften",
    projection.status === "property_projection_ready"
      ? Object.entries(projection.category_specs.product_oil_specs).map(
          ([key, value]) =>
            `${({ weight: "Gewicht", role_support: "Anwendungen an der Haarfaser", provides_heat_protection: "Hitzeschutz" } as Record<string, string>)[key]}: ${researchValue(value)}`,
        )
      : "Ableitung blockiert",
    projection,
    "Die Öl-Engine liefert Gewicht, Anwendungen an der Haarfaser und Hitzeschutz.",
    null,
    "projection",
  )
  add(
    "matching",
    "Matching-Vorschläge · manuell prüfen",
    matchingValue(),
    (source.bundle ?? source.candidate)?.matchingSuggestions ?? null,
    source.bundle || source.candidate
      ? "Diese vorgeschlagenen Matching-Werte werden durch deine Freigabe bestätigt. Nacharbeit erfordert ein überarbeitetes Paket."
      : "Für diese historische Forschungsakte liegen keine Matching-Vorschläge vor. Die lokale Prüfung ist keine Intake-Freigabe.",
    null,
    "property",
    source.bundle || source.candidate ? source.blockers.length > 0 : false,
  )
  if (envelope.version === "oil-research-envelope-v1") {
    const fitRow = rows.find((row) => row.id === "scenario_fit")!
    fitRow.annotations = envelope.scenario_fit.flatMap((scenario) => [
      `${researchValue(scenario.role)} · Quelle: ${scenario.source_id} / ${scenario.direction_id}`,
      ...Object.entries(scenario.thickness).map(
        ([thickness, fit]) =>
          `${researchValue(thickness)}: ${researchValue(fit.value)}${fit.condition ? ` · ${fit.condition}` : ""}`,
      ),
    ])
  }
  const queueItem = item(source)
  const rework = Object.values(state.decisions).some((d) => d.status === "rework")
  const blockers = [
    ...source.blockers,
    ...(rework ? ["Offene Nacharbeit: überarbeitetes Paket laden und erneut prüfen."] : []),
    ...(state.handoff
      ? [
          state.handoff.status === "handed_off"
            ? "An Intake übergeben · dieser Prüfstand ist schreibgeschützt."
            : "Übergabe ausstehend · Ergebnis mit Intake abgleichen; dieser Prüfstand bleibt schreibgeschützt.",
        ]
      : []),
  ]
  return sealDetail({
    ...queueItem,
    standard: standardFor(source),
    valueAuthority: "Gespeicherte Forschung",
    notices: [
      "Öl-Eigenschaften recherchiert. Matching-Vorschläge werden manuell geprüft. Die Lab-Freigabe veröffentlicht kein Produkt.",
      ...(source.bundle || source.candidate
        ? []
        : [
            "Historische Forschungsakte: Freigaben gelten nur lokal und können nicht als Intake-Freigabe übernommen werden.",
          ]),
      ...(source.dataset === "default" &&
      profile.product_key === "oil-holdout-h04" &&
      profile.case_id === "H04"
        ? [
            "Gewicht: medium – vorläufige, von Nick bestätigte Schätzung für genau diese Formel. rich bleibt möglich.",
          ]
        : []),
      ...(state.completedAt ? ["Lokal geprüft · noch nicht im Katalog"] : []),
    ],
    properties: rows,
    evidence: [
      evidence("Produktakte · exakte INCI, Identität und Quellen", {
        identity: envelope.identity,
        formula: envelope.formula,
        sources: envelope.sources,
      }),
      evidence("Methodik und Herkunft", {
        research_method: envelope.research_method,
        provenance: envelope.provenance,
      }),
      evidence("Vollständiges Forschungsprofil", profile),
      ...(source.bundle
        ? [
            evidence(
              "Intake-Prüfumfang · Matching, Protokolle und Produktdaten",
              source.bundle.intakeReviewSnapshot,
            ),
          ]
        : source.candidate
          ? [
              evidence("Lokales Forschungspaket · Matching-Entwürfe und Quellenmanifest", {
                matchingSuggestions: source.candidate.matchingSuggestions,
                sourceManifest: source.candidate.sourceManifest,
              }),
            ]
          : []),
    ],
    actions: [
      {
        id: "complete",
        label: queueItem.openCount
          ? "Offene Eigenschaften freigeben und Prüfung abschließen"
          : "Produktprüfung abschließen",
        kind: "complete",
        enabled: !blockers.length && !state.completedAt,
        confirmation:
          source.bundle || source.candidate
            ? "Alle offenen Öl-Eigenschaften und Matching-Vorschläge für diesen Stand freigeben? Dies ist nur eine lokale Lab-Freigabe."
            : "Alle offenen Öl-Eigenschaften für diesen historischen Stand lokal freigeben? Dies ist keine Intake- oder Katalogfreigabe.",
        nativeBody: { itemId: source.id, action: "approve_product", ...extra },
      },
    ],
    blockers,
    lastDecision:
      state.completedAt ??
      Object.values(state.decisions)
        .map((d) => d.savedAt)
        .sort()
        .at(-1) ??
      null,
  })
}
export function getOilSharedLab(dataset: OilLabDataset, itemId?: string): ResearchLabData {
  const sources = oilLabSources(dataset)
  const selected = itemId ? sources.find((source) => source.id === itemId) : sources[0]
  if (!selected)
    throw new Error(
      dataset === "intake" && !sources.length
        ? "Noch kein Öl-Intake-Paket exportiert. Zuerst ein aktuelles Paket über die Intake-CLI exportieren."
        : dataset === "candidate" && !sources.length
          ? "Noch keine lokalen Öl-Forschungspakete vorbereitet. Quelldateien prüfen."
          : "Öl-Prüfstand nicht gefunden.",
    )
  return {
    category: "oil",
    categoryLabel: "Öle",
    dataset,
    legacyHref: "/labs/research?category=oil",
    standard: standardFor(selected),
    queue: sources.map(item),
    detail: detail(selected),
    evidence: [
      evidence("Datensatz", {
        dataset,
        count: sources.length,
        source:
          dataset === "default"
            ? "record-resolution-v0.1"
            : dataset === "intake"
              ? "Lokale, aktuelle Intake-Prüfpakete"
              : "Lokale europäische Forschungsprofile · v0.9",
      }),
    ],
  }
}
