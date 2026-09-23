import type { ScanMaskedVerdictResult } from "../src/lib/scan/masked-alternative"
import type {
  ScanAlternativePresentation,
  ScanProductHeader,
  ScanResolvedVerdictResult,
} from "../src/lib/scan/types"
import type { ScanVerdictResult } from "../src/lib/scan/verdict-access"

/**
 * The verdict states `ScanResultCard` renders, as data.
 *
 * They exist for the extraction's parity net (`tests/scan-result-card-parity.test.tsx`):
 * the card's rendered HTML was captured from these cases BEFORE `ScanVerdictSections` /
 * `ScanAlternativesList` were split out of it, and the golden file it was written to is
 * compared against the live components afterwards. Anything that changes what the scan
 * sheet renders — a wrapper, a class, a reordered section — fails there.
 *
 * Every image URL is a plain catalog URL or null, so `ScanProductThumb` never takes its
 * `next/image` branch (which needs an image-config provider to render).
 */

const PRODUCT: ScanProductHeader = {
  productId: "p-scanned",
  name: "Lab Shampoo Alpha",
  brand: "Chaarlie Lab",
  category: "shampoo",
  categoryLabel: "Shampoo",
  imageUrl: "https://catalog.example/alpha.jpg",
  priceLabel: "12,99 €",
  purchaseUrl: "https://shop.example/alpha",
}

const IN_CATALOG_BASE = {
  kind: "in_catalog" as const,
  verdict: "mismatch" as const,
  verdictLabel: "Passt nicht",
  verdictTitle: "Passt nicht zu deinem Haar",
  status: "danger" as const,
  subtitle: "1 von 3 Zielbereichen getroffen",
  evaluatedRole: null,
  evaluatedRoleLabel: null,
  dimensions: [],
  criteria: [],
  coverage: null,
  fitNarrative: null,
  product: PRODUCT,
  snapshotSource: "refined" as const,
  savedState: { state: null, managedByScan: false },
}

const ALTERNATIVE_WITH_LINK: ScanAlternativePresentation = {
  productId: "p-alternative-a",
  displayName: "Lab Shampoo Gamma",
  imageUrl: "https://catalog.example/gamma.jpg",
  priceLabel: "9,99 €",
  netContentLabel: "250 ml",
  verdict: "ideal",
  verdictLabel: "Passt",
  brand: "Chaarlie Lab",
  purchaseUrl: "https://shop.example/gamma",
}

const ALTERNATIVE_WITHOUT_LINK: ScanAlternativePresentation = {
  productId: "p-alternative-b",
  displayName: "Lab Shampoo Delta",
  imageUrl: null,
  priceLabel: null,
  netContentLabel: null,
  verdict: "supportive",
  verdictLabel: "Passt mit Einschränkung",
  brand: null,
  purchaseUrl: null,
}

export const SCAN_PARITY_ALTERNATIVES: ScanAlternativePresentation[] = [
  ALTERNATIVE_WITH_LINK,
  ALTERNATIVE_WITHOUT_LINK,
]

const PREMIUM_WITH_ALTERNATIVES: ScanResolvedVerdictResult = {
  ...IN_CATALOG_BASE,
  criteria: [
    {
      criterionId: "cleansing",
      label: "Reinigungsstärke",
      result: "pass",
      explanation: "Reinigt mild genug für deine Kopfhaut.",
    },
    {
      criterionId: "silicones",
      label: "Silikone",
      result: "fail",
      explanation: "Enthält Silikone, die deine Längen beschweren.",
    },
  ],
  alternatives: SCAN_PARITY_ALTERNATIVES,
}

const PREMIUM_WITH_DIMENSIONS: ScanResolvedVerdictResult = {
  ...IN_CATALOG_BASE,
  verdict: "ideal",
  verdictLabel: "Passt",
  verdictTitle: "Passt zu deinem Haar",
  status: "ok",
  subtitle: "3 von 3 Zielbereichen getroffen",
  evaluatedRole: "shampoo_everyday",
  evaluatedRoleLabel: "Hauptreinigung",
  dimensions: [
    {
      dimensionId: "care_weight",
      label: "Pflegegewicht",
      stops: [
        { stopId: "light", label: "leicht" },
        { stopId: "medium", label: "mittel" },
        { stopId: "rich", label: "reichhaltig" },
      ],
      targetStopIds: ["light"],
      productStopIds: ["light"],
      state: "in_target",
    },
  ],
  coverage: { matches: 3, total: 3 },
  fitNarrative: {
    productCriteria: "Leichte Reinigung ohne Silikone.",
    fit: "Passt zu einem Ansatz, der schnell nachfettet.",
  },
  alternatives: [ALTERNATIVE_WITH_LINK],
}

const MASKED: ScanMaskedVerdictResult = {
  ...IN_CATALOG_BASE,
  alternatives: [
    {
      verdict: "ideal",
      verdictLabel: "Passt",
      comparison: {
        rows: [
          { rowId: "care_weight", label: "Pflegegewicht", state: "match" },
          { rowId: "cleansing", label: "Reinigungsstärke", state: "match" },
          { rowId: "silicones", label: "Silikone", state: "partial" },
          { rowId: "protein", label: "Protein", state: "unknown" },
        ],
        summaryScore: 0.5,
      },
    },
  ],
  freeRevealAvailable: true,
}

const NOT_NEEDED: ScanVerdictResult = {
  kind: "not_needed",
  mode: "not_needed",
  status: "neutral",
  headline: "Brauchst du gerade nicht",
  subtitle: "Dein Plan deckt diesen Schritt schon ab.",
  reasons: ["Deine Längen sind nicht strapaziert.", "Dein Conditioner übernimmt das bereits."],
  dimensions: [
    {
      dimensionId: "care_weight",
      label: "Pflegegewicht",
      stops: [
        { stopId: "light", label: "leicht" },
        { stopId: "rich", label: "reichhaltig" },
      ],
      targetStopIds: [],
      productStopIds: ["rich"],
      state: "no_target",
    },
  ],
  coveredBy: [
    { label: "Conditioner", detail: "Feuchtigkeitspflege" },
    { label: "Leave-in", detail: null },
  ],
  product: { ...PRODUCT, category: "mask", categoryLabel: "Maske", name: "Lab Maske Beta" },
  snapshotSource: "refined",
  savedState: { state: null, managedByScan: false },
}

export type ScanResultCardParityCase = {
  name: string
  props: {
    result: ScanVerdictResult
    revealedAlternatives?: ScanAlternativePresentation[] | null
    revealAnimates?: boolean
    revealPending?: boolean
    revealUnavailable?: boolean
  }
}

/**
 * One entry per branch of the card's alternatives logic plus the two payload kinds —
 * the five states the plan names (premium, masked, revealed, `not_needed`,
 * with-alternatives), split where a branch has more than one rendering.
 */
export const SCAN_RESULT_CARD_PARITY_CASES: ScanResultCardParityCase[] = [
  { name: "premium_with_alternatives", props: { result: PREMIUM_WITH_ALTERNATIVES } },
  { name: "premium_with_dimensions", props: { result: PREMIUM_WITH_DIMENSIONS } },
  {
    name: "premium_without_alternatives",
    props: { result: { ...PREMIUM_WITH_ALTERNATIVES, alternatives: [] } },
  },
  { name: "masked", props: { result: MASKED } },
  { name: "masked_reveal_pending", props: { result: MASKED, revealPending: true } },
  {
    name: "masked_reveal_unavailable",
    props: { result: { ...MASKED, freeRevealAvailable: false }, revealUnavailable: true },
  },
  {
    name: "revealed_animating",
    props: { result: MASKED, revealedAlternatives: SCAN_PARITY_ALTERNATIVES },
  },
  {
    name: "revealed_static",
    props: {
      result: MASKED,
      revealedAlternatives: SCAN_PARITY_ALTERNATIVES,
      revealAnimates: false,
    },
  },
  { name: "revealed_empty", props: { result: MASKED, revealedAlternatives: [] } },
  { name: "not_needed", props: { result: NOT_NEEDED } },
  {
    name: "not_needed_without_sections",
    props: { result: { ...NOT_NEEDED, reasons: [], coveredBy: [] } as ScanVerdictResult },
  },
]

export const SCAN_PARITY_PRODUCT = PRODUCT
export const SCAN_PARITY_PREMIUM_RESULT = PREMIUM_WITH_ALTERNATIVES
export const SCAN_PARITY_DIMENSION_RESULT = PREMIUM_WITH_DIMENSIONS
export const SCAN_PARITY_MASKED_RESULT = MASKED
export const SCAN_PARITY_NOT_NEEDED_RESULT = NOT_NEEDED
