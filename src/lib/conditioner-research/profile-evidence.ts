export type ConditionerProfileEvidenceBasis =
  | "formula_inference"
  | "formula_inference_with_policy_fallback"
  | "policy_derivation"

export type ConditionerProfileFieldEvidence = {
  rationale: string
  evidenceBasis: ConditionerProfileEvidenceBasis
  evidenceSignals: string[]
  derivation: string
  thresholdReasoning: string[]
  limitations: string[]
}

type Profile = {
  conditioningLevel: string
  weightPotential: string
  careDirection: string
  repairSupportLevel: string
  primaryFocus: string
  secondaryFocus: string[]
  hairThicknessFit: string[]
  damageFit: string[]
  textureFit: string[]
  assumptionNotes: string[]
}

type DirectProperties = {
  conditioningDepositionPotential: string
  wetSlipDetanglingPotential: string
  dryCombabilityPotential: string
  smoothingFrizzControlPotential: string
  weightDepositionPotential: string
  bodyLightnessPotential: string
  repairLubricationProtection: string
  repairSurfaceFilm: string
  bondSpecificSupport: string
  colorChemicalDamageProtection: string
  rationale: string
  routes: string[]
}

type Input = {
  productId: string
  rawInci: string
  profile: Profile
  direct: DirectProperties
}

const INGREDIENT_FAMILIES = {
  fattyAlcohols: ["Cetyl Alcohol", "Cetearyl Alcohol", "Myristyl Alcohol", "Stearyl Alcohol"],
  cationicConditioners: [
    "Cetrimonium Chloride",
    "Behentrimonium Chloride",
    "Behentrimonium Methosulfate",
    "Distearoylethyl Hydroxyethylmonium Methosulfate",
    "Dicocoylethyl Hydroxyethylmonium Methosulfate",
    "Stearamidopropyl Dimethylamine",
    "Behenamidopropyl Dimethylamine",
  ],
  cationicPolymers: [
    "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride",
    "Polyquaternium-7",
    "Polyquaternium-10",
    "Polyquaternium-11",
  ],
  silicones: ["Amodimethicone", "Dimethicone"],
  lipidsAndEmollients: [
    "Dicaprylyl Ether",
    "Isopropyl Palmitate",
    "Isopropyl Myristate",
    "Coco-Caprylate/Caprate",
    "Cetyl Esters",
    "Triheptanoin",
    "Neopentyl Glycol Diheptanoate",
    "Helianthus Annuus Seed Oil",
    "Cocos Nucifera Oil",
    "Olea Europaea Fruit Oil",
    "Ricinus Communis Seed Oil",
    "Avena Sativa Kernel Oil",
    "Glycine Soja Oil",
    "Butyrospermum Parkii Butter",
    "Ceramide NG",
  ],
  temporaryFilm: ["Avena Sativa Oat Peptide", "Hydrolyzed Collagen", "Polyester-11"],
  proteinPeptides: ["Avena Sativa Oat Peptide", "Hydrolyzed Collagen", "Hydrolyzed Keratin"],
  humectants: [
    "Glycerin",
    "Propylene Glycol",
    "Dipropylene Glycol",
    "Panthenol",
    "Betaine",
    "Sodium Hyaluronate",
    "Aloe Barbadensis Leaf Juice",
    "Chondrus Crispus Extract",
  ],
  bondCandidate: ["Hydroxypropylgluconamide", "Hydroxypropylammonium Gluconate"],
  colorCandidate: ["Benzophenone-4"],
} as const

type IngredientFamily = keyof typeof INGREDIENT_FAMILIES

function inciEntries(rawInci: string) {
  return rawInci
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function signalsFor(entries: string[], families: IngredientFamily[]) {
  const candidates = families.flatMap((family) => INGREDIENT_FAMILIES[family])
  return entries.flatMap((entry, index) =>
    candidates.some((candidate) => {
      const normalizedEntry = entry.toLocaleLowerCase()
      const normalizedCandidate = candidate.toLocaleLowerCase()
      return (
        normalizedEntry === normalizedCandidate ||
        normalizedEntry.startsWith(`${normalizedCandidate} `) ||
        normalizedEntry.startsWith(`${normalizedCandidate}(`) ||
        normalizedEntry.startsWith(`${normalizedCandidate}/`)
      )
    })
      ? [`${entry} (INCI #${index + 1})`]
      : [],
  )
}

function unique(signals: string[]) {
  return [...new Set(signals)]
}

function formulaLimitation() {
  return [
    "INCI evidence supports formula potential (E2), not measured finished-product performance.",
    "Ingredient order does not reveal exact percentages; ingredients below 1% may appear in any order.",
  ]
}

function policyLimitation() {
  return [
    "This is a broad matching prior derived from upstream product properties, not direct evidence of universal suitability.",
    "Dose, routine, hair condition, and desired finish can change the practical result.",
  ]
}

function focusSignals(focus: string, groups: Record<IngredientFamily, string[]>) {
  switch (focus) {
    case "lightness":
      return unique([...groups.fattyAlcohols, ...groups.cationicConditioners])
    case "detangling":
      return unique([
        ...groups.fattyAlcohols,
        ...groups.cationicConditioners,
        ...groups.cationicPolymers,
      ])
    case "smoothing":
    case "shine":
      return unique([
        ...groups.silicones,
        ...groups.cationicPolymers,
        ...groups.lipidsAndEmollients,
        ...groups.fattyAlcohols,
        ...groups.cationicConditioners,
      ])
    case "repair":
      return unique([
        ...groups.temporaryFilm,
        ...groups.bondCandidate,
        ...groups.cationicConditioners,
      ])
    case "curl_support":
      return unique([
        ...groups.fattyAlcohols,
        ...groups.cationicConditioners,
        ...groups.cationicPolymers,
        ...groups.lipidsAndEmollients,
      ])
    case "color_care":
      return unique([
        ...groups.colorCandidate,
        ...groups.cationicConditioners,
        ...groups.lipidsAndEmollients,
      ])
    default:
      return unique([
        ...groups.fattyAlcohols,
        ...groups.cationicConditioners,
        ...groups.cationicPolymers,
      ])
  }
}

function focusDecisionReason(focus: string) {
  switch (focus) {
    case "lightness":
      return "The compact architecture and low-weight prior distinguish lightness more strongly than baseline conditioning."
    case "detangling":
      return "The wet-slip and combability route is clearer than competing specialist routes."
    case "smoothing":
      return "The surface, dry-combability, and lubrication route goes beyond a conventional R1 base."
    case "repair":
      return "A distinct temporary-film or bond-candidate route distinguishes repair from ordinary smoothing."
    case "shine":
      return "A distinct optical or alignment route is more useful than shine as a mere side effect of smoothing."
    case "curl_support":
      return "High slip plus a compatible weight and body architecture meet the curl-support threshold."
    case "color_care":
      return "A color or UV-protection candidate plus exact product positioning form the strongest specialist route."
    default:
      return "The formula is a capable conventional conditioner architecture, but no specialist route exceeds the general threshold."
  }
}

function signalSummary(signals: string[], limit = 4) {
  const shown = signals.slice(0, limit)
  const remainder = signals.length - shown.length
  const remainderLabel =
    remainder === 1
      ? " and 1 additional listed signal"
      : remainder > 1
        ? ` and ${remainder} additional listed signals`
        : ""
  return `${shown.join(", ")}${remainderLabel}`
}

function conditioningThresholdReasoning(level: string, directLevel: string, signals: string[]) {
  const ingredients = signalSummary(signals)
  if (level === "low") {
    return [
      `${ingredients} provide only a limited conditioning route, so conditioning_level=low.`,
      `Why not moderate: moderate requires at least one coherent, clearly identifiable conditioning or deposition base; the direct trace remains ${directLevel}.`,
    ]
  }
  if (level === "moderate") {
    return [
      `${ingredients} form one coherent conditioning base. That is enough for moderate. Why not low: this is more than a limited or weakly identifiable conditioning route.`,
      `Why not high: the direct trace remains ${directLevel}; no additional compatible deposition route through a cationic polymer, silicone, rich emollient, or film former is sufficiently supported beyond the base.`,
    ]
  }
  return [
    `${ingredients} combine a prominent conditioning base with additional compatible deposition routes; the direct trace is ${directLevel}. Therefore high rather than moderate.`,
    "Moderate would describe a conventional base alone; it would understate the additional cationic-polymer, emollient, silicone, or film routes present here. High remains a formula-potential classification, not a measured performance claim.",
  ]
}

function weightThresholdReasoning(input: {
  value: string
  directValue: string
  signals: string[]
  neqiFallback: boolean
}) {
  const ingredients = signalSummary(input.signals)
  if (input.neqiFallback) {
    return [
      `${ingredients} rule out low and support weight_deposition_potential=higher in the detailed trace.`,
      "Why moderate rather than high: the exact volume positioning is a material unresolved counter-signal, and finished-product evidence for the deposited weight is unavailable. The lean fallback therefore remains moderate instead of excluding fine hair with an uncertain high.",
    ]
  }
  if (input.value === "low") {
    return [
      `${ingredients} form a compact base without a clear additional silicone, polymer, or rich-lipid stack; therefore low rather than moderate.`,
      "Moderate or high would require a broader or robust additional deposition route that is not visible in this INCI.",
    ]
  }
  if (input.value === "moderate") {
    return [
      `${ingredients} show more than a compact low-weight base and rule out low; the overall trace is therefore moderate.`,
      `Why not high: weight_deposition_potential=${input.directValue}, and the pattern does not show an unambiguous strong base-plus-additional-deposition stack without a material counter-signal.`,
    ]
  }
  return [
    `${ingredients} combine a clear conditioning base with additional compatible film, polymer, silicone, or lipid deposition; therefore high rather than moderate.`,
    "Moderate would understate the additional deposition stack. High is the top lean class but still does not claim a measured heavy finish.",
  ]
}

function careDirectionThresholdReasoning(input: {
  value: string
  proteinSignals: string[]
  moistureSignals: string[]
}) {
  const protein = signalSummary(input.proteinSignals)
  const moisture = signalSummary(input.moistureSignals)
  if (input.value === "protein") {
    return [
      `${protein} provide a specific protein or peptide route that is more direction-defining than the accompanying humectant/emollient support; therefore care_direction=protein.`,
      `Why not balanced or moisture: ${moisture} provide supporting care, but they do not equal the early, identifiable protein/peptide route as the formula's comparative direction. This is a product direction, not a diagnosed user deficiency.`,
    ]
  }
  if (input.value === "balanced") {
    return [
      `${protein} provide a meaningful protein-film route while ${moisture} provide comparably central humectant/emollient support; therefore care_direction=balanced.`,
      "Why not protein or moisture alone: neither supported route is merely incidental, and selecting one would hide the other material formula direction. Balanced is a positive mixed-route classification, not an uncertainty fallback.",
    ]
  }
  return [
    `${moisture} form the formula's supported humectant/emollient care direction; therefore care_direction=moisture.`,
    "Why not protein or balanced: no meaningful hydrolyzed protein, peptide, or keratin route is visible. Ordinary cationic conditioning, amino acids, vitamins, polymers, bond candidates, or product naming do not create a protein direction.",
  ]
}

function repairSupportThresholdReasoning(input: {
  value: string
  ordinarySignals: string[]
  proteinSignals: string[]
  bondSignals: string[]
}) {
  if (input.value === "high") {
    return [
      `${signalSummary(input.bondSignals)} form a distinct paired bond-chemistry candidate beyond ordinary conditioning; therefore repair_support_level=high within the comparative formula-potential scale.`,
      "Why not medium: this is a materially stronger and more specific damage-targeted route than a temporary protein film alone. High remains E2 formula potential and does not prove bond repair or finished-product performance.",
    ]
  }
  if (input.value === "medium") {
    return [
      `${signalSummary(input.proteinSignals)} form a distinct temporary protein/peptide film route beyond ordinary lubrication; therefore repair_support_level=medium.`,
      "Why not low or high: the route is specific enough to exceed baseline conditioning, but without paired bond chemistry visible in the reviewed formula it does not clear the high threshold.",
    ]
  }
  return [
    `${signalSummary(input.ordinarySignals)} support ordinary conditioning, lubrication, and cosmetic manageability; therefore repair_support_level=low.`,
    "Why not medium or high: no distinct protein/peptide/keratin film or paired bond chemistry is present. Oils, silicones, ceramides, panthenol, vitamins, generic polymers, amino acids, repair naming, and positioning alone remain baseline support.",
  ]
}

function primaryFocusThresholdReasoning(input: {
  focus: string
  secondaryFocus: string[]
  signals: string[]
  direct: DirectProperties
}) {
  const ingredients = signalSummary(input.signals)
  const alternatives = input.secondaryFocus.length
    ? input.secondaryFocus.join(" and ")
    : "the other focus options"
  switch (input.focus) {
    case "lightness":
      return [
        `${ingredients} sit in a compact architecture with Body=${input.direct.bodyLightnessPotential}; lightness therefore clears the differentiation threshold.`,
        `Why not ${alternatives} as primary: baseline slip is present, but the low-weight and body direction distinguishes this product more strongly than ordinary conditioner function.`,
      ]
    case "smoothing":
      if (
        input.direct.smoothingFrizzControlPotential === "moderate" &&
        input.direct.wetSlipDetanglingPotential === "higher"
      ) {
        return [
          `${ingredients} support a coherent smoothing and dry-surface route (Smoothing=${input.direct.smoothingFrizzControlPotential}, Dry Combability=${input.direct.dryCombabilityPotential}); smoothing is therefore the research headline.`,
          `Why not ${alternatives} as primary: Wet Slip=${input.direct.wetSlipDetanglingPotential} is stronger and remains a secondary capability. Smoothing is not a stronger individual measurement here; it is the more specific formula route for product comparison.`,
        ]
      }
      return [
        `${ingredients} support Smoothing=${input.direct.smoothingFrizzControlPotential} and Dry Combability=${input.direct.dryCombabilityPotential}; smoothing therefore wins.`,
        `Why not ${alternatives} as primary: those endpoints remain useful, but the coherent dry-surface and frizz route is more dominant or complete for comparison.`,
      ]
    case "detangling":
      return [
        `${ingredients} support Wet Slip=${input.direct.wetSlipDetanglingPotential} and Dry Combability=${input.direct.dryCombabilityPotential}; detangling therefore clears the differentiation threshold and becomes the research headline.`,
        `Why not ${alternatives} as primary: those endpoints remain useful, but the wet-combing and manageability route is the more direct differentiator for this product.`,
      ]
    case "repair":
      return [
        `${ingredients} form a film or bond-candidate route distinct from baseline conditioning (Repair Film=${input.direct.repairSurfaceFilm}, Bond Support=${input.direct.bondSpecificSupport}); therefore repair.`,
        `Why not ${alternatives} or smoothing as primary: slip and smoothing are shared conditioner endpoints, while the separate repair-candidate route supplies the stronger differentiator.`,
      ]
    case "curl_support":
      return [
        `${ingredients} combine Wet Slip=${input.direct.wetSlipDetanglingPotential} with a compatible weight and body architecture; curl_support therefore reaches the specialist threshold.`,
        `Why not ${alternatives} as primary: smoothing and detangling remain capabilities, but their combined pattern is classified more specifically here as curl support.`,
      ]
    case "color_care":
      return [
        `${ingredients} support a distinct color-support route (${input.direct.colorChemicalDamageProtection}); therefore color_care.`,
        `Why not ${alternatives} or smoothing as primary: slip, smoothing, and shine may share the same film; the color-protection candidate is the more specific comparison anchor.`,
      ]
    case "shine":
      return [
        `${ingredients} support a coherent optical-surface and alignment route alongside Smoothing=${input.direct.smoothingFrizzControlPotential}; shine therefore becomes the research headline.`,
        `Why not ${alternatives} as primary: shine is selected only when optical alignment is the more useful differentiator; ordinary smoothing alone would not clear this branch.`,
      ]
    case "general":
      return [
        `${ingredients} demonstrate a capable conventional conditioning base, but no specialist route exceeds the differentiation threshold; therefore general.`,
        `Why not ${alternatives} as primary: these endpoints remain secondary capabilities instead of turning shared baseline conditioning into an artificial specialist focus.`,
      ]
    default:
      return [
        `Unsupported primary_focus=${input.focus}; the classification requires rework before review.`,
        "No adjacent-class comparison is valid until the primary-focus value is part of the controlled vocabulary.",
      ]
  }
}

function secondaryFocusThresholdReasoning(input: {
  primaryFocus: string
  secondaryFocus: string[]
  signals: string[]
}) {
  const ingredients = signalSummary(input.signals)
  const selected = input.secondaryFocus.join(" and ")
  const hierarchyReason =
    input.primaryFocus === "general"
      ? "general remains the comparison headline because no specialist route reaches the differentiation threshold"
      : `${input.primaryFocus} remains the strongest differentiator`
  return [
    `${ingredients} support the additional endpoints ${selected}; they remain secondary focuses rather than an empty extra classification.`,
    `Why not primary or another focus: ${hierarchyReason}; additional slots would double-count the same conditioner effect without a distinct route.`,
  ]
}

function thicknessThresholdReasoning(value: string, weight: string, signals: string[]) {
  const ingredients = signalSummary(signals)
  if (weight === "low") {
    return [
      `${ingredients} support weight_potential=low; the rule maps that to ${value}.`,
      "Why not coarse in the broad prior: the light architecture primarily distinguishes fine and medium hair. This does not claim that coarse hair can never use the product.",
    ]
  }
  if (weight === "high") {
    return [
      `${ingredients} support weight_potential=high; therefore ${value} rather than a prior that includes fine hair.`,
      "Fine hair is not included in the broad prior because the deposition-rich architecture is more likely to weigh it down; dose can still change individual use.",
    ]
  }
  return [
    `${ingredients} support weight_potential=moderate; therefore the broad prior includes ${value}.`,
    "Why neither the low nor high restriction: the mixed pattern is not clearly light enough for only fine and medium hair, and not robustly rich enough to exclude fine hair categorically.",
  ]
}

function damageThresholdReasoning(input: {
  value: string
  conditioningLevel: string
  signals: string[]
  specialistFilmSignals: string[]
  bondSignals: string[]
  direct: DirectProperties
}) {
  const ingredients = signalSummary(input.signals)
  if (input.bondSignals.length > 0) {
    const bondIngredients = signalSummary(input.bondSignals)
    return [
      `${bondIngredients} form a distinct bond-chemistry candidate beyond the ordinary conditioner base; combined with conditioning_level=${input.conditioningLevel}, this supports ${input.value}.`,
      "Why not healthy in the comparative prior: the named bond-candidate pair is a separate specialist route. This remains E2 formula potential, not proof of structural repair or finished-product performance.",
    ]
  }
  if (input.specialistFilmSignals.length > 0) {
    const filmIngredients = signalSummary(input.specialistFilmSignals)
    const route = input.specialistFilmSignals.some((signal) => /peptide/i.test(signal))
      ? "peptide film route"
      : "protein film route"
    return [
      `${filmIngredients} form a distinct ${route} beyond the ordinary conditioner base; combined with conditioning_level=${input.conditioningLevel}, this supports ${input.value}.`,
      `Why not healthy in the comparative prior: the identifiable ${route} clears the specialist threshold. It supports temporary surface-film potential only, not structural repair or a measured finished-product result.`,
    ]
  }
  if (input.conditioningLevel === "low") {
    return [
      `${ingredients} support conditioning_level=low; therefore ${input.value}.`,
      "Why not moderately_damaged or highly_damaged in the broad prior: the formula lacks both sufficient conditioning intensity and a distinct protein, peptide, keratin, bond, or tested damage-specialist route.",
    ]
  }
  if (input.conditioningLevel === "moderate") {
    return [
      `${ingredients} support conditioning_level=moderate; therefore ${input.value}.`,
      "Why not highly_damaged in the broad prior: the rule requires high conditioning plus a distinct protein, peptide, keratin, bond, exceptional corroborated protection, or finished-product damage route; none is visible here.",
    ]
  }
  return [
    `${ingredients} support conditioning_level=${input.conditioningLevel} and ordinary general conditioning, but no qualifying protein, peptide, keratin, bond, exceptional corroborated protection, or finished-product damage route; therefore ${input.value}.`,
    `Why not highly_damaged in the comparative prior: generic lubrication (${input.direct.repairLubricationProtection}), a generic film label (${input.direct.repairSurfaceFilm}), silicones, oils, panthenol, ceramides, cationic polymers, or repair naming alone do not clear the specialist threshold.`,
  ]
}

function textureThresholdReasoning(input: {
  value: string
  weight: string
  signals: string[]
  direct: DirectProperties
}) {
  const ingredients = signalSummary(input.signals)
  if (input.value.includes("coily") && !input.value.includes("straight")) {
    const comparison =
      input.weight === "moderate"
        ? "Why not straight in the broad prior: the high-slip and detailed deposition direction distinguishes the product more strongly for wavy through coily hair. The moderate Lean-Weight-Fallback remains a separately documented uncertainty."
        : "Why not straight in the broad prior: the high-slip and richer deposition direction distinguishes the product more strongly for wavy through coily hair; the high-weight prior supports this boundary further."
    return [
      `${ingredients} combine Wet Slip=${input.direct.wetSlipDetanglingPotential} with the detailed deposition and body trace; therefore ${input.value}.`,
      comparison,
    ]
  }
  if (input.value === "straight, wavy") {
    return [
      `${ingredients} form a light architecture with Weight=${input.weight}; therefore ${input.value}.`,
      "Why not curly or coily in the broad prior: the rule does not see a high-slip or deposition architecture that would support that adjacent range.",
    ]
  }
  return [
    `${ingredients} form a balanced slip and weight architecture; therefore ${input.value}.`,
    "Why neither only straight and wavy nor wavy through coily: the pattern is neither clearly light nor robustly rich, so the middle broad texture prior remains.",
  ]
}

export function conditionerProfileFieldEvidence(
  input: Input,
): Record<string, ConditionerProfileFieldEvidence> {
  const entries = inciEntries(input.rawInci)
  const groups = Object.fromEntries(
    (Object.keys(INGREDIENT_FAMILIES) as IngredientFamily[]).map((family) => [
      family,
      signalsFor(entries, [family]),
    ]),
  ) as Record<IngredientFamily, string[]>
  const conditioningSignals = unique([
    ...groups.fattyAlcohols,
    ...groups.cationicConditioners,
    ...groups.cationicPolymers,
  ])
  const conditioningEvidenceSignals = unique([
    ...conditioningSignals,
    ...groups.silicones,
    ...groups.lipidsAndEmollients,
    ...groups.temporaryFilm,
  ])
  const depositionSignals = unique([
    ...conditioningSignals,
    ...groups.silicones,
    ...groups.lipidsAndEmollients,
    ...groups.temporaryFilm,
  ])
  const damageSignals = unique([
    ...conditioningSignals,
    ...groups.silicones,
    ...groups.lipidsAndEmollients,
    ...groups.temporaryFilm,
    ...groups.bondCandidate,
  ])
  const damageSpecialistFilmSignals = groups.temporaryFilm.filter((signal) =>
    /Avena Sativa Oat Peptide|Hydrolyzed Collagen|Keratin/i.test(signal),
  )
  const primarySignals = focusSignals(input.profile.primaryFocus, groups)
  const secondarySignals = unique(
    input.profile.secondaryFocus.flatMap((focus) => focusSignals(focus, groups)),
  )
  const neqiFallback =
    input.productId === "952a4834-e451-4dc3-ba19-ebb8927eb5e4" &&
    input.direct.weightDepositionPotential === "higher" &&
    input.profile.weightPotential === "moderate"
  const compactLightnessPattern =
    input.direct.weightDepositionPotential === "lower" &&
    groups.silicones.length === 0 &&
    groups.cationicPolymers.length === 0 &&
    groups.lipidsAndEmollients.length === 0
  const proteinDirectionSignals = groups.proteinPeptides
  const moistureDirectionSignals = unique([...groups.humectants, ...groups.lipidsAndEmollients])
  const repairOrdinarySignals = unique([
    ...conditioningSignals,
    ...groups.silicones,
    ...groups.lipidsAndEmollients,
    ...groups.humectants,
  ])
  return {
    conditioning_level: {
      rationale: `The ${input.profile.conditioningLevel} conditioning level follows from the listed cationic base plus the additional deposition and lubrication routes in this exact formula.`,
      evidenceBasis: "formula_inference" as const,
      evidenceSignals: conditioningEvidenceSignals,
      derivation: `The direct property conditioning_deposition_potential=${input.direct.conditioningDepositionPotential} maps to conditioning_level=${input.profile.conditioningLevel}. Routes: ${input.direct.routes.join(", ")}.`,
      thresholdReasoning: conditioningThresholdReasoning(
        input.profile.conditioningLevel,
        input.direct.conditioningDepositionPotential,
        conditioningEvidenceSignals,
      ),
      limitations: formulaLimitation(),
    },
    weight_potential: {
      rationale: neqiFallback
        ? "The detailed formula trace remains higher: the base is deposition-rich and additional film routes are visible. The lean profile uses moderate as an explicit policy fallback because the exact volume positioning is an unresolved counter-signal."
        : `The ${input.profile.weightPotential} weight potential follows from the complete deposition pattern of this formula, not from one supposedly heavy ingredient.`,
      evidenceBasis: neqiFallback
        ? ("formula_inference_with_policy_fallback" as const)
        : ("formula_inference" as const),
      evidenceSignals: depositionSignals,
      derivation: neqiFallback
        ? "The direct value weight_deposition_potential=higher remains; standard v1.4 conservatively maps it to weight_potential=moderate instead of excluding fine hair with an uncertain high."
        : compactLightnessPattern
          ? `weight_deposition_potential=lower maps to weight_potential=${input.profile.weightPotential}: a compact R1 base without a visible silicone, cationic-polymer, or rich-lipid route.`
          : `weight_deposition_potential=${input.direct.weightDepositionPotential} maps to weight_potential=${input.profile.weightPotential}; the base and additional deposition routes are evaluated as one architecture.`,
      thresholdReasoning: weightThresholdReasoning({
        value: input.profile.weightPotential,
        directValue: input.direct.weightDepositionPotential,
        signals: depositionSignals,
        neqiFallback,
      }),
      limitations: formulaLimitation(),
    },
    care_direction: {
      rationale: `The ${input.profile.careDirection} care direction is the formula's comparative product direction, derived from the relative prominence of specific protein/peptide routes and humectant/emollient support. It is not a user diagnosis.`,
      evidenceBasis: "formula_inference" as const,
      evidenceSignals:
        input.profile.careDirection === "protein"
          ? unique([...proteinDirectionSignals, ...moistureDirectionSignals])
          : input.profile.careDirection === "balanced"
            ? unique([...proteinDirectionSignals, ...moistureDirectionSignals])
            : moistureDirectionSignals,
      derivation: `Standard v1.6 compares the exact formula's protein/peptide route (${proteinDirectionSignals.length} listed signals) with its humectant/emollient route (${moistureDirectionSignals.length} listed signals) and assigns care_direction=${input.profile.careDirection}.`,
      thresholdReasoning: careDirectionThresholdReasoning({
        value: input.profile.careDirection,
        proteinSignals: proteinDirectionSignals,
        moistureSignals: moistureDirectionSignals,
      }),
      limitations: formulaLimitation(),
    },
    repair_support_level: {
      rationale: `The ${input.profile.repairSupportLevel} repair-support level describes the strength of a distinct damage-support route beyond ordinary conditioning; it is separate from the broad damage_fit prior.`,
      evidenceBasis: "formula_inference" as const,
      evidenceSignals:
        input.profile.repairSupportLevel === "high"
          ? unique([...groups.bondCandidate, ...repairOrdinarySignals])
          : input.profile.repairSupportLevel === "medium"
            ? unique([...proteinDirectionSignals, ...repairOrdinarySignals])
            : repairOrdinarySignals,
      derivation: `Standard v1.6 maps ordinary conditioning to low, a distinct temporary protein/peptide film route to medium, and a materially stronger paired bond route visible in the formula to high; this formula maps to repair_support_level=${input.profile.repairSupportLevel}.`,
      thresholdReasoning: repairSupportThresholdReasoning({
        value: input.profile.repairSupportLevel,
        ordinarySignals: repairOrdinarySignals,
        proteinSignals: proteinDirectionSignals,
        bondSignals: groups.bondCandidate,
      }),
      limitations: formulaLimitation(),
    },
    primary_focus: {
      rationale: `The primary focus ${input.profile.primaryFocus} is this product's forced comparison headline. ${focusDecisionReason(input.profile.primaryFocus)}`,
      evidenceBasis: "formula_inference" as const,
      evidenceSignals: primarySignals,
      derivation: `The focus hierarchy compares Wet Slip=${input.direct.wetSlipDetanglingPotential}, Dry Combability=${input.direct.dryCombabilityPotential}, Smoothing=${input.direct.smoothingFrizzControlPotential}, Body=${input.direct.bodyLightnessPotential}, Repair Film=${input.direct.repairSurfaceFilm}, Bond Support=${input.direct.bondSpecificSupport}, and Color Support=${input.direct.colorChemicalDamageProtection}; baseline conditioning is excluded before ${input.profile.primaryFocus} wins.`,
      thresholdReasoning: primaryFocusThresholdReasoning({
        focus: input.profile.primaryFocus,
        secondaryFocus: input.profile.secondaryFocus,
        signals: primarySignals,
        direct: input.direct,
      }),
      limitations: formulaLimitation(),
    },
    secondary_focus: {
      rationale: `The secondary focuses ${input.profile.secondaryFocus.join(" + ")} retain supported comparison endpoints that remain useful after ${input.profile.primaryFocus} wins. The listed formula signals support those endpoints without double-counting them as independent technologies.`,
      evidenceBasis: "formula_inference" as const,
      evidenceSignals: secondarySignals,
      derivation:
        "Each secondary focus must add a useful endpoint; the same smoothing film is not counted again as independent shine or structural-repair evidence without its own route.",
      thresholdReasoning: secondaryFocusThresholdReasoning({
        primaryFocus: input.profile.primaryFocus,
        secondaryFocus: input.profile.secondaryFocus,
        signals: secondarySignals,
      }),
      limitations: formulaLimitation(),
    },
    hair_thickness_fit: {
      rationale: `The hair-thickness fit ${input.profile.hairThicknessFit.join(" + ")} is derived from weight_potential=${input.profile.weightPotential}; it is not a separate ingredient claim.`,
      evidenceBasis: "policy_derivation" as const,
      evidenceSignals: depositionSignals,
      derivation: `Standard v1.4 maps the product-specific weight prior ${input.profile.weightPotential} to the broad hair-thickness set ${input.profile.hairThicknessFit.join(", ")}.`,
      thresholdReasoning: thicknessThresholdReasoning(
        input.profile.hairThicknessFit.join(", "),
        input.profile.weightPotential,
        depositionSignals,
      ),
      limitations: policyLimitation(),
    },
    damage_fit: {
      rationale: `The damage fit ${input.profile.damageFit.join(" + ")} is a comparative prior derived from conditioning_level=${input.profile.conditioningLevel} plus the presence or absence of a distinct damage-specialist route; it does not prove structural repair.`,
      evidenceBasis: "policy_derivation" as const,
      evidenceSignals: damageSignals,
      derivation: `Standard v1.5 maps low conditioning to healthy, moderate or general high conditioning to healthy + moderately_damaged, and high conditioning plus a qualifying protein/peptide/keratin film, bond, exceptional corroborated protection, or finished-product damage route to moderately_damaged + highly_damaged. Generic lubrication alone does not qualify.`,
      thresholdReasoning: damageThresholdReasoning({
        value: input.profile.damageFit.join(", "),
        conditioningLevel: input.profile.conditioningLevel,
        signals: damageSignals,
        specialistFilmSignals: damageSpecialistFilmSignals,
        bondSignals: groups.bondCandidate,
        direct: input.direct,
      }),
      limitations: policyLimitation(),
    },
    texture_fit: {
      rationale: `The texture fit ${input.profile.textureFit.join(" + ")} is a broad prior derived from the slip, weight, and surface-deposition architecture; curl positioning alone cannot create it.`,
      evidenceBasis: "policy_derivation" as const,
      evidenceSignals: unique([
        ...conditioningSignals,
        ...groups.silicones,
        ...groups.lipidsAndEmollients,
      ]),
      derivation: `The rule combines Wet-Slip Potential=${input.direct.wetSlipDetanglingPotential}, weight_potential=${input.profile.weightPotential}, and body_lightness_potential=${input.direct.bodyLightnessPotential} into the set ${input.profile.textureFit.join(", ")}.`,
      thresholdReasoning: textureThresholdReasoning({
        value: input.profile.textureFit.join(", "),
        weight: input.profile.weightPotential,
        signals: unique([
          ...conditioningSignals,
          ...groups.silicones,
          ...groups.lipidsAndEmollients,
        ]),
        direct: input.direct,
      }),
      limitations: policyLimitation(),
    },
  } satisfies Record<string, ConditionerProfileFieldEvidence>
}
