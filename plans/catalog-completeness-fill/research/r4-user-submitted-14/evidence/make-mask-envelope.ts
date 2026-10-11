import fs from "node:fs"
import crypto from "node:crypto"
import {
  maskFormulaFingerprintSha256,
  normalizeMaskInciTokens,
} from "/Users/nick/AI_work/hair_conscierge/.worktrees/catalog-completeness-fill/src/lib/mask-research/production-adapter"

const OUT = process.env.OUT!
const rawInci =
  "aqua, cetearyl alcohol, glycerin, isopropyl palmitate, parfum, cetrimonium chloride, helianthus annuus seed oil, hydrolyzed rice protein, behentrimonium methosulfate, glyceryl stearate se, avena strigosa seed extract, lecithin, glycine soja oil, phenoxyethanol, sodium benzoate, tetramethyl acetyloctahydronaphthalenes, glucomannan, potassium sorbate, limonene, tetrasodium iminodisuccinate, lactic acid, linalyl acetate, citrus limon peel oil, linalool, pinene, citric acid, pogostemon cablin oil, juniperus virginiana oil, citrus aurantium peel oil, benzoic acid, methyl benzoate, bht."
const rawInciSha = crypto.createHash("sha256").update(rawInci, "utf8").digest("hex")
const normalized = normalizeMaskInciTokens(rawInci)

const ev = (
  value: unknown,
  confidence: "low" | "moderate" | "high",
  rationale: string,
  evidenceSignals: string[],
  derivation: string,
  thresholdReasoning: string[],
  limitations: string[],
) => ({
  value,
  confidence,
  rationale,
  evidenceSignals,
  derivation,
  thresholdReasoning,
  limitations,
})

const E2 =
  "E2 ceiling: formula-only comparative potential; concentration, dose and finished-product efficacy are not established."
const MARKER =
  "tail marker: PARFUM r5 (first tail-class species). UNRESOLVED (§3.1.1 limb 1): the product's only cationics — CETRIMONIUM CHLORIDE r6 and BEHENTRIMONIUM METHOSULFATE r9 — sit after the marker, so the marker precedes the species that establish the conditioning base (same shape as cohort #02/#06). Reviewer-resolvable; the plausible-marker reading is recorded beside it."

const envelope = {
  version: "mask-research-envelope-v1.0",
  researchMethod: {
    policyId: "mask-classification-v1.0",
    modelVersion: "mask-inci-v1.0",
    policySha256: "d105ef3fdfc0e953591a54765004f59d107f049a9ea9007cf7c579dafa726ae0",
    lexiconSha256: "3dcaf54f8a7e4844f44d2731f30ca28c4a8565f17082d8fd0b27376ca3167ada",
  },
  identity: {
    researchId: "e5cfad78-ea22-49a5-911a-cb1f3109fa1c",
    market: "DE/EU",
    exactProductName: "Hair Mask Hydration Rosemary/Ginger, 200 ml",
    brand: "Jean&Len",
    gtin: "4262401735639",
    identityStatus: "verified_with_minor_source_difference",
    categoryBoundaryStatus: "eligible",
    exclusionReason: null,
    multiUse: false,
    uncoveredModes: [],
    confidence: "moderate",
    sourceIds: [
      "jeanlen.de/haarmaske-feuchtigkeit-rosemary-ginger (manufacturer DE, article 2900101127, captured 2026-10-09)",
      "docmorris.de / medpex.de / shop-apotheke.com EAN 4262401735639 listings (retailer corroboration of the EAN, search result 2026-10-09)",
    ],
  },
  formula: {
    status: "verified_with_minor_difference",
    rawInci,
    normalizedIngredients: normalized,
    formulaFingerprintSha256: maskFormulaFingerprintSha256(rawInci),
    rawInciSha256: rawInciSha,
    sourceIds: [
      "jeanlen.de/haarmaske-feuchtigkeit-rosemary-ginger (manufacturer DE INCI block, captured 2026-10-09; EN page identical)",
    ],
  },
  profile: {
    conditioningLevel: ev(
      "moderate",
      "moderate",
      "moderate on every admissible reading. Plausible-marker read: only S2 fires (CETEARYL ALCOHOL r2); S1 needs two cationics above the tail and both sit below PARFUM r5; S3 needs two non-fatty-alcohol lipids above the tail and only ISOPROPYL PALMITATE r4 qualifies. Ordinal read (marker unresolved): S1 (CETRIMONIUM CHLORIDE r6 + BEHENTRIMONIUM METHOSULFATE r9), S2 and S3 (ISOPROPYL PALMITATE r4, sunflower oil r7, soy oil r13) would all fire, i.e. the `high` pattern — but an unresolved marker is a material counter-signal and caps `high` at `moderate` (§9.1). " +
        E2,
      [
        MARKER,
        "S2: CETEARYL ALCOHOL r2 (long-chain fatty alcohol at rank 2-3)",
        "S1 only on the ordinal read: CETRIMONIUM CHLORIDE r6, BEHENTRIMONIUM METHOSULFATE r9",
        "S3 only on the ordinal read: ISOPROPYL PALMITATE r4, HELIANTHUS ANNUUS SEED OIL r7, GLYCINE SOJA OIL r13",
        "claims 'verbesserte Kämmbarkeit', 'seidig-weiches Gefühl' are E0 positioning and add nothing",
      ],
      "§9.1 thresholds: `high` needs S1 plus S2/S3 and no material counter-signal; tail_marker `unresolved` is a material counter-signal (closed list (a)) -> cap `moderate`; the plausible-marker read independently gives one signal -> `moderate`.",
      [
        "`high` is unavailable: the unresolved marker caps it at `moderate`.",
        "`low` does not apply: S2 fires on both readings.",
        "Both readings agree on `moderate`, so the value is robust to the marker question.",
      ],
      [
        "A three-step conditioning scale is at the edge of INCI support (method level confidence low-moderate).",
        "Single-lane application of Mask Standard v1.0 by a researcher agent on 2026-10-09; not a sealed independent lane.",
      ],
    ),
    weightPotential: ev(
      "moderate",
      "moderate",
      "moderate. `high` fails: no R4b heavy lipid (coconut/castor/butter/hydrogenated fat/occlusive hydrocarbon) exists above the marker or anywhere (sunflower r7 and soy r13 are mid-band oils, which E14 says never form the core). `low` is unavailable: the marker is unresolved (positive leanness test needs a readable segment), a mid-band triglyceride is present (conjunct 1 fails on the ordinal read) and the full list carries two distinct cationics (conjunct 3 fails, E7). " +
        E2,
      [
        MARKER,
        "No R4b heavy lipid at any rank",
        "Mid-band oils: HELIANTHUS ANNUUS SEED OIL r7, GLYCINE SOJA OIL r13 (block `low`, cannot make `high`)",
        "Light ester: ISOPROPYL PALMITATE r4",
        "Two cationics on the full list: CETRIMONIUM CHLORIDE r6, BEHENTRIMONIUM METHOSULFATE r9",
        "No silicone anywhere",
      ],
      "§9.2 anchors: `high` needs an R4b core; `low` is a three-conjunct positive test; everything else is `moderate`.",
      [
        "`high` does not apply: the heavy-lipid core is absent.",
        "`low` does not apply: conjunct 3 (single cationic on the full list) fails and the marker is unresolved.",
        "Positioning ('Feuchtigkeit', 'seidig-weich') does not move the value.",
      ],
      [
        "Formula-only deposition prior, not a prediction of visible weighing-down.",
        "Single-lane application of Mask Standard v1.0.",
      ],
    ),
    careDirection: ev(
      "moisture",
      "low",
      "moisture (the category default and the §1.1-conservative value), confidence low. The only protein species is HYDROLYZED RICE PROTEIN r8, which sits after PARFUM r5. On the plausible-marker read it is a tail species and the protein leg is closed (D6: protein naming with the protein only in the tail resolves to the architecture the formula carries; here a fatty-alcohol/ester/oil base with one humectant). On the ordinal read of an unresolved marker, a single R5 species within the first eight ranks would be a material protein route and read `protein`. Following the cohort precedent (#02: unresolved marker, uncertain upgrade left uncredited, call routed to review), the upgrade is NOT credited. " +
        E2,
      [
        MARKER,
        "HYDROLYZED RICE PROTEIN r8 — only R5 species, after the marker",
        "Humectants above the tail: GLYCERIN r3 only (no cluster, so `balanced` reading (a) is unavailable)",
        "No silicone/film system: `balanced` reading (b) unavailable",
        "Manufacturer positioning is moisture ('Feuchtigkeit'); claim is counter-context only (§9 constraint)",
      ],
      "§9.3: protein leg needs a material R5 route above the tail; with the marker unresolved the value is not auto-decided toward `protein` (§3.1.1 consequence 5) and the conservative value is kept.",
      [
        "`protein` is not credited: it rests on a single plain hydrolysate whose position relative to an unresolved marker is the only thing carrying it.",
        "`balanced` does not apply: no humectant cluster and no silicone film system.",
        "Reviewer alternative: ordinal read => `protein`, repair `medium`.",
      ],
      [
        "Confidence is `low` because the value rests on the marker boundary alone (§3.1.1 consequence 3).",
        "Routes to review under tail_marker_unresolved.",
      ],
    ),
    repairSupportLevel: ev(
      "low",
      "low",
      "low. No bond chemistry token exists anywhere in the INCI (bond_route none), so `high` is unreachable. `medium` would require the §9.3 material protein route (see care_direction); it is not credited because that route rests solely on a single hydrolyzed protein at r8, after an unresolved marker. Being a mask, dwell time ('Intensivpflege 30 Minuten') and 'Pflegeboost' carry zero repair credit (§9.4 mask delta). " +
        E2,
      [
        MARKER,
        "bond_route: none",
        "HYDROLYZED RICE PROTEIN r8 (single plain hydrolysate, after the marker)",
        "Contact time 5/30 min is protocol metadata only",
      ],
      "§9.4: low = ordinary conditioning; medium = distinct temporary protein-film route (same test as §9.3); high = named bond chemistry.",
      [
        "`high` does not apply: no named bond chemistry.",
        "`medium` is not credited for the reason given under care_direction; ordinal reading would give `medium`.",
      ],
      ["Comparative formula potential, never efficacy.", "Routes to review with care_direction."],
    ),
    focus: ev(
      { primary: "general", secondary: [] },
      "moderate",
      "general / no secondary. Step 3 special-purpose routes all fail: no bond chemistry and no label-strong protein route (E16 needs two distinct hydrolyzed proteins or a quaternized derivative above the marker; there is one plain hydrolysate); no curl positioning/slip architecture; no colour-care positioning. Step 4 `moisture` fails the D5 guard: one humectant above the tail (GLYCERIN r3), cluster of three needed. Step 5 `shine` has no optical film route (no silicone/cationic polymer above the tail). Step 6 `smoothing` has nothing beyond the ordinary mask base (no silicone, no substantive polymer). Step 7 `detangling`: slip is the category baseline. Step 8 `general`. " +
        E2,
      [
        "no R7 bond token",
        "HYDROLYZED RICE PROTEIN r8 single plain hydrolysate (E16: headline falls through)",
        "GLYCERIN r3 sole above-tail humectant (D5 criterion 1 needs >=3, >=2 non-glycerin)",
        "GLUCOMANNAN r17 tail film-former, no credit",
        "Positioning 'Feuchtigkeit/Glanz/Geschmeidigkeit' corroborates nothing: claims never create a route (§9.5.2 step 9)",
      ],
      "§9.5.2 hierarchy applied in order; step 8 `general` is the honest fallback for a capable conventional mask with no distinctive route.",
      [
        "`moisture` loses at the D5 cluster guard.",
        "`repair` loses at the E16 headline gate.",
        "A secondary slot is not spent: no independent route clears.",
      ],
      ["A focus is a statement of distinctive purpose, not an efficacy claim."],
    ),
    bondRoute: ev(
      "none",
      "high",
      "none. No named bond chemistry (maleate, gluconamide, peptide) appears at any rank of the complete INCI; the manufacturer makes no bond claim.",
      [
        "Complete INCI scanned for R7 tokens: none present",
        "Manufacturer copy: moisture/shine/combability only",
      ],
      "Trace-level, deterministic on named tokens (R7).",
      [
        "No R7 token at any rank -> `none`.",
        "Not a repair-or-bond claim product, so bond_claim_review does not apply.",
      ],
      ["Deterministic on the verified INCI; confidence tracks identity evidence."],
    ),
    hairThicknessFit: ev(
      ["fine", "normal", "coarse"],
      "moderate",
      "Echo field (R9): weight_potential `moderate` maps to the full set.",
      ["derived from weight_potential = moderate"],
      "§9.6 table row 2.",
      [
        "Clears {fine, normal, coarse}: the `moderate` row.",
        "{fine, normal} and {normal, coarse} require `low` / `high` weight.",
      ],
      ["Echo field under R9: approving weight_potential approves this projection."],
    ),
    damageFit: ev(
      ["healthy", "moderately_damaged"],
      "moderate",
      "Echo field (R9): conditioning_level `moderate` maps to healthy + moderately_damaged (§9.7 row 2).",
      ["derived from conditioning_level = moderate, repair_support_level = low, bond_route = none"],
      "§9.7 row 2; no qualifying specialist route.",
      [
        "Clears {healthy, moderately_damaged}.",
        "The specialist set requires conditioning_level `high` plus repair >= medium or a bond route; neither holds.",
      ],
      ["Echo field under R9; broad product prior, not a repair claim."],
    ),
    textureFit: ev(
      ["straight", "wavy", "curly"],
      "moderate",
      "Echo field (R9): weight_potential `moderate` selects the balanced architecture row.",
      ["derived from weight_potential = moderate"],
      "§9.8 row 2.",
      [
        "Clears {straight, wavy, curly}.",
        "{straight, wavy} requires `low`; {wavy, curly, coily} requires `high` plus a coherent high-slip route.",
      ],
      ["Research-only; no current consumer.", "Echo field under R9."],
    ),
    uncertainFields: [
      "conditioning_level",
      "weight_potential",
      "care_direction",
      "repair_support_level",
    ],
    assumptionNotes: [
      "tail_marker_unresolved: PARFUM r5 precedes the product's only cationics (r6, r9); review-state, not a shortcut. Plausible-marker and ordinal readings are both recorded; conditioning_level and weight_potential agree across them, care_direction/repair_support_level do not (moisture/low vs protein/medium).",
      "Directions (German manufacturer page, verbatim): 'Als Pflegeboost 5 Minuten und als Intensivpflege 30 Minuten im feuchten Haar einwirken lassen. Gründlich ausspülen.' plus 'Nach dem Waschen die Haarmaske Feuchtigkeit großzügig in Deine Haarlängen einmassieren, einwirken lassen und dann gründlich ausspülen.' G0: after cleansing + stated contact time + rinse -> eligible. Two stated dwell times (5 min / 30 min) are protocol metadata, not classification input.",
      "Single-lane application of Mask Standard v1.0 (not a sealed independent lane; mask engine is not wired into Product Intake).",
      "Live row's legacy comparison values (concentration high, balance_direction moisture, weight medium) were not used to decide anything (§9.9).",
    ],
  },
}
fs.mkdirSync(OUT + "/mask", { recursive: true })
fs.writeFileSync(OUT + "/mask/envelope.json", JSON.stringify(envelope, null, 2))
console.log("written", envelope.formula.formulaFingerprintSha256, rawInciSha, normalized.length)
