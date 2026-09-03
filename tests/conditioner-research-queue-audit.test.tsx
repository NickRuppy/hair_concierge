import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ConditionerCalibrationClient } from "../src/app/labs/conditioner-research/calibration-client"
import { ConditionerResearchLabClient } from "../src/app/labs/conditioner-research/research-lab-client"

const profileFields = [
  ["conditioning_level", "hoch"],
  ["weight_potential", "hoch"],
  ["care_direction", "moisture"],
  ["repair_support_level", "low"],
  ["primary_focus", "detangling"],
  ["secondary_focus", "smoothing · curl_support"],
  ["hair_thickness_fit", "mittel · grob"],
  ["damage_fit", "moderat · stark"],
  ["texture_fit", "wellig · lockig · kraus"],
].map(([path, value]) => ({
  path,
  label: path,
  value,
  reviewStatus: "vollständig",
  rationale: `${path} rationale`,
  evidenceBasis: "formula_inference" as const,
  evidenceSignals: ["Cetearyl Alcohol (INCI #3)", "Stearamidopropyl Dimethylamine (INCI #7)"],
  derivation: `${path} is derived from the product-specific formula pattern.`,
  thresholdReasoning: [
    `Cetearyl Alcohol (INCI #3) supports the selected value for ${path}.`,
    `The complete pattern rules out the adjacent class for ${path}.`,
  ],
  limitations: ["INCI supports formula potential, not measured finished-product performance."],
  acceptedValue: value,
  blindValue: path === "primary_focus" ? "curl_support" : value,
}))

const labData = {
  summary: {
    completeProfiles: 11,
    sourceConflicts: 0,
    excluded: 1,
    reviewCounts: { approved: 0, reworkOpen: 0, needsReview: 11, excluded: 1 },
  },
  queueItems: [
    {
      productId: "hair-food",
      productName: "Hair Food Aloe Vera Feuchtigkeits-Spülung",
      brandName: "Garnier Fructis",
      market: "DE",
      packSize: "200 ml",
      statusLabel: "Fokus prüfen",
      summary: "Vollständiges Pilotprofil",
      uncertainFields: ["Primärer Fokus"],
      sourceConflict: false,
      excluded: false,
      formulaStatus: "verifiziert",
      profileStatus: "vollständig",
      reviewStatus: "needs_review",
      priorityGroup: "priority",
    },
    {
      productId: "bali",
      productName: "Bali Curls Reisegröße",
      brandName: "Bali Curls",
      market: "DE",
      packSize: "50 ml",
      statusLabel: "Formel geklärt",
      summary: "Hersteller plus Exact-EAN-Retailer lösen die Bali-Formelautorität.",
      uncertainFields: [],
      sourceConflict: false,
      excluded: false,
      formulaStatus: "verifiziert",
      profileStatus: "vollständig",
      reviewStatus: "needs_review",
      priorityGroup: "standard",
    },
    {
      productId: "cantu",
      productName: "Cantu Leave-In Repair Cream",
      brandName: "Cantu",
      market: "DE",
      packSize: null,
      statusLabel: "Ausgeschlossen",
      summary: "Leave-in-Produkt; Gate G0 stoppt die Conditioner-Klassifikation.",
      uncertainFields: [],
      sourceConflict: false,
      excluded: true,
      formulaStatus: "G0",
      profileStatus: "kein Profil",
      reviewStatus: "excluded",
      priorityGroup: "boundary",
    },
  ],
  initialDetail: {
    productId: "hair-food",
    productName: "Hair Food Aloe Vera Feuchtigkeits-Spülung",
    brandName: "Garnier Fructis",
    sourceConflict: false,
    boundaryExplanation: null,
    identity: {
      gtinEan: "3600542398022",
      market: "DE",
      packSize: "200 ml",
      formulaVersion: "v1.2-rc1",
      formulaStatus: "verifiziert",
    },
    formula: {
      rawInci: "Aqua / Water, Glycerin, Cetearyl Alcohol",
      normalizedInci: ["aqua", "glycerin", "cetearyl alcohol"],
    },
    directions: {
      raw: "Nach dem Waschen in die Längen geben und ausspülen.",
      normalized: "Ausspülen · Längen und Spitzen",
    },
    sources: [
      {
        id: "garnier",
        type: "official",
        market: "DE",
        locator: "garnier.de/haarpflege/feuchtigkeits-spuelung",
      },
    ],
    profile: {
      statusLabel: "vollständig",
      uncertainFields: ["primary_focus"],
      fields: profileFields,
    },
    uncertaintyNotes: ["Primärer Fokus wurde nach Blind-Review kalibriert."],
    reviewStatus: "needs_review",
    propertyStatuses: Object.fromEntries(profileFields.map((field) => [field.path, "unreviewed"])),
    canApproveProduct: true,
    canApproveBoundary: false,
    reviewBlockers: [],
    staleReview: false,
    lastReviewDecision: null,
    profileFingerprint: "b".repeat(64),
    standardVersion: "1.6",
  },
  calibration: {
    preAdjudication: { exactCells: 94, totalCells: 99 },
    postAdjudication: { exactCells: 85, totalCells: 99 },
    nonFocusAgreement: { exactCells: 68, totalCells: 77 },
    damageFitDistribution: { healthyOnly: 0, healthyModerate: 8, moderateHigh: 3 },
    semanticDifferences: [
      "Conditioner Cream · primary_focus: akzeptiert curl_support; Blind-Review smoothing.",
      "Conditioner Cream · secondary_focus: akzeptiert detangling + smoothing; Blind-Review repair.",
      "Colorglow · secondary_focus: akzeptiert detangling + shine; Blind-Review detangling.",
      "Bali Curls · primary_focus: akzeptiert curl_support; Blind-Review smoothing.",
      "Bali Curls · secondary_focus: akzeptiert detangling + smoothing; Blind-Review curl_support.",
      "NEQI Volume Victory · weight_potential: akzeptiert moderate; Blind-Review high.",
      "NEQI Volume Victory · hair_thickness_fit: akzeptiert fine + medium + coarse; Blind-Review medium + coarse.",
    ],
    remainingDifferences: [
      "Conditioner Cream · primary_focus: akzeptiert curl_support; Blind-Review smoothing.",
      "Conditioner Cream · secondary_focus: akzeptiert detangling + smoothing; Blind-Review repair.",
      "Colorglow · secondary_focus: akzeptiert detangling + shine; Blind-Review detangling.",
      "Bali Curls · primary_focus: akzeptiert curl_support; Blind-Review smoothing.",
      "Bali Curls · secondary_focus: akzeptiert detangling + smoothing; Blind-Review curl_support.",
      "NEQI Volume Victory · weight_potential: akzeptiert moderate; Blind-Review high.",
      "NEQI Volume Victory · hair_thickness_fit: akzeptiert fine + medium + coarse; Blind-Review medium + coarse.",
    ],
    focusDecisions: [
      "Cantu und Bali behalten Curl Support primär.",
      "Colorglow behält Shine sekundär.",
      "Die Repair-Grenze bleibt bestehen.",
    ],
    evidenceCaveats: [
      "NEQI Volume Victory Conditioner · The detailed formula trace retains higher deposition potential, but the exact Volume positioning is a material unresolved counter-signal.",
      "Guhl Bond+ Reparatur Spülung · Repair wins from the recognized gluconamide/gluconate bond-chemistry candidate; without product-level substantiation it remains candidate-level.",
      "Guhl Bond+ Reparatur Spülung · The three-value care-direction taxonomy has no bond-specific value. Moisture is the best-supported non-protein direction.",
    ],
    stress: "5/5",
  },
}

test("conditioner route keeps the local development guard and bounded error copy", () => {
  const source = readFileSync(
    new URL("../src/app/labs/conditioner-research/page.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /isConditionerResearchLabEnabled\(process\.env\)/)
  assert.match(source, /notFound\(\)/)
  assert.match(source, /Conditioner-Research-Artefakte konnten nicht geladen werden/)
})

test("conditioner research lab renders all nine comparative fields with operational review actions", () => {
  const html = renderToStaticMarkup(<ConditionerResearchLabClient data={labData} />)

  assert.match(html, /Conditioner Research Lab/)
  assert.match(html, /Research Queue &amp; Produkt-Audit/)
  assert.match(html, /Kalibrierung &amp; Unsicherheiten/)
  assert.match(html, /11[\s\S]*Zu prüfen/)
  assert.match(html, /0[\s\S]*Rework offen/)
  assert.match(html, /0[\s\S]*Freigegeben/)
  assert.match(html, /1[\s\S]*G0-Grenzfall/)
  assert.match(html, /0[\s\S]*G0 bestätigt/)
  assert.match(html, /data-conditioner-queue-card=/)
  assert.match(html, /Hair Food Aloe Vera Feuchtigkeits-Spülung/)
  assert.match(html, /Arbeitsqueue filtern/)
  assert.match(html, /Zuerst prüfen/)
  assert.match(html, /Standardprüfung/)
  assert.match(html, /Rework offen/)
  assert.match(html, /Freigegeben/)
  assert.match(html, /G0-Grenzfall/)
  assert.equal(html.match(/data-conditioner-queue-card=/g)?.length, 1)
  assert.doesNotMatch(html, /Bali Curls Reisegröße/)
  assert.doesNotMatch(html, /Cantu Leave-In Repair Cream/)
  assert.match(html, /Kompakter Überblick aus dem INCI-Audit/)
  assert.match(html, /Annahmen &amp; offene Grenzen/)
  assert.match(html, /Primärer Fokus wurde nach Blind-Review kalibriert/)
  assert.match(html, /Reviewstatus/)
  assert.match(html, /Audit-Evidenz/)
  assert.match(html, /Alle neun Vergleichseigenschaften bleiben sichtbar/)
  assert.match(html, /Pflegerichtung/)
  assert.match(html, /Repair-Unterstützung/)

  for (const field of profileFields) {
    assert.match(html, new RegExp(field.path))
  }
  assert.doesNotMatch(html, /usage_role|scalp_application_fit/)
  assert.doesNotMatch(html, /rinseability|Rinseability|Rinse-Prognosen|Rinse-out/i)

  assert.match(html, /Original-INCI/)
  assert.match(html, /Normalisierte Formelzeichenfolge/)
  assert.match(html, /Original-INCI bewahrt die Zutaten-Grenzen/)
  assert.match(html, /Anwendung/)
  assert.match(html, /Gesamtes Produkt freigeben/)
  assert.match(html, /Eigenschaft freigeben/)
  assert.match(html, /Rework anfordern/)
  assert.match(html, /Reviewer-Kommentar/)
  assert.match(html, /Formula signals/)
  assert.match(html, /Derivation/)
  assert.match(html, /Why this exact classification\?/)
  assert.match(html, /Evidence ceiling/)
  assert.match(html, /Cetearyl Alcohol \(INCI #3\)/)
  assert.match(html, /Formula deposition signal/)
  assert.match(html, /conditioning material.*after rinsing/i)
  assert.doesNotMatch(html, /Aus Formel- und Anwendungsprofil abgeleitet\./)
  assert.match(html, /Keine Katalogfreigabe/)

  const approveIndex = html.indexOf("Gesamtes Produkt freigeben")
  const overviewIndex = html.indexOf("Vorgeschlagene Conditioner-Klassifikation")
  const comparisonIndex = html.indexOf("supports the selected value for conditioning_level")
  const commentIndex = html.indexOf("Reviewer-Kommentar")
  const evidenceIndex = html.indexOf("Audit-Evidenz")
  assert.ok(approveIndex > -1 && approveIndex < overviewIndex)
  assert.ok(comparisonIndex > overviewIndex && comparisonIndex < commentIndex)
  assert.ok(overviewIndex > -1 && overviewIndex < evidenceIndex)
})

test("conditioner review client only replaces counters from a successful response summary", () => {
  const source = readFileSync(
    new URL("../src/app/labs/conditioner-research/queue-audit-client.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /const \[items, setItems\] = useState\(queueItems\)/)
  assert.match(source, /\[currentSummary, setCurrentSummary\] = useState\(summary\)/)
  assert.match(source, /if \(payload\.data\.summary\)/)
  assert.match(source, /setCurrentSummary\(payload\.data\.summary as ConditionerResearchSummary\)/)
  assert.match(source, /if \(!response\.ok \|\| !payload\.detail \|\| !payload\.data\) \{/)
  assert.match(source, /Array\.isArray\(payload\.blockers\)/)
})

test("conditioner queue surfaces resolved Bali authority and G0 exclusion states", () => {
  const baliData = {
    ...labData,
    initialDetail: {
      ...labData.initialDetail,
      productId: "bali",
      productName: "Bali Curls Reisegröße",
      brandName: "Bali Curls",
    },
  }
  const baliHtml = renderToStaticMarkup(<ConditionerResearchLabClient data={baliData} />)
  const baliCard = baliHtml.match(
    /<article data-conditioner-queue-card="bali"[\s\S]*?<\/article>/,
  )?.[0]

  assert.match(baliHtml, /Bali Curls Reisegröße/)
  assert.ok(baliCard)
  assert.match(baliCard, /Formel geklärt/)
  assert.match(baliCard, /Hersteller plus Exact-EAN-Retailer/)
  assert.doesNotMatch(baliCard, /Quellenkonflikt|vorläufige Felder|Formelkonflikt/)

  const boundaryData = {
    ...labData,
    initialDetail: {
      ...labData.initialDetail,
      productId: "cantu",
      productName: "Cantu Leave-In Repair Cream",
      brandName: "Cantu",
      excluded: true,
      categoryBoundaryStatus: "excluded_product_form" as const,
      boundaryExplanation: "Leave-in-Produkt; Gate G0 stoppt die Conditioner-Klassifikation.",
      profile: null,
      canApproveProduct: false,
      canApproveBoundary: true,
    },
  }
  const boundaryHtml = renderToStaticMarkup(<ConditionerResearchLabClient data={boundaryData} />)
  assert.match(boundaryHtml, /Cantu Leave-In Repair Cream/)
  assert.match(boundaryHtml, /Gate G0/)
  assert.match(boundaryHtml, /G0-Ausschluss bestätigen/)
})

test("conditioner calibration tab renders agreement, retained uncertainty, and stress metrics", () => {
  const html = renderToStaticMarkup(
    <ConditionerCalibrationClient calibration={labData.calibration} />,
  )

  assert.match(html, /85\/99/)
  assert.match(html, /85\.9%/)
  assert.match(html, /94\/99/)
  assert.match(html, /5 retained Focus-Differenzen/)
  assert.match(html, /68\/77/)
  assert.match(html, /22\/22 exact/)
  assert.match(html, /8 general-care fits/)
  assert.match(html, /3 specialist-route fits/)
  assert.match(html, /Reviewer G/)
  assert.match(html, /not a[\s\S]*full v1\.6[\s\S]*repeatability/i)
  assert.match(html, /NEQI[\s\S]*OGX[\s\S]*Bond\+/)
  assert.match(html, /Bali Formelautorität/)
  assert.match(html, /akzeptiert curl_support; Blind-Review smoothing/)
  assert.match(html, /Adjudizierter Fallback &amp; Evidenz-Caveat/)
  assert.match(html, /higher deposition potential/)
  assert.match(html, /three-value care-direction taxonomy/)
  assert.doesNotMatch(html, /usage_role|scalp_application_fit/)
  assert.doesNotMatch(
    html,
    /99\/99|fünf initiale Unterschiede|verbleibende Bali-Differenz|Quellenkonflikt|hard block|Hard Block/,
  )
  assert.match(html, /Stressproben · historisch v1\.2/)
  assert.match(html, /zwei neuen v1\.6-Felder noch nicht/)
  assert.match(html, /5\/5/)
})
