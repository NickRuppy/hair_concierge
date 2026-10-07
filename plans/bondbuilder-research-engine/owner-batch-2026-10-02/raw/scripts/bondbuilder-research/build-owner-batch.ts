import { createHash } from "node:crypto"
import { constants, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  bondbuilderResearchProfileSchema,
  BOND_RESEARCH_PROPERTIES,
  type BondbuilderResearchProfile,
} from "../../src/lib/bondbuilder-research/contracts"
import {
  BOND_METHOD_PINS,
  BOND_OWNER_REGISTRY,
  BOND_REFERENCE_KEYS,
} from "../../src/lib/bondbuilder-research/registry"
import {
  bondbuilderProfileSha256,
  projectBondbuilderForProduction,
} from "../../src/lib/bondbuilder-research/production-adapter"
import { projectBondbuilderProtocol } from "../../src/lib/bondbuilder-research/protocol-projection"
import { projectBondbuilderCadence } from "../../src/lib/bondbuilder-research/cadence-projection"

const PLAN = "plans/bondbuilder-research-engine/"
const RUN = "data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/"
const FROZEN = "data/research/bondbuilder-inci/v1.0/validation-2026-10-02-v0.4/"
const CONSOLIDATION = "owner-reviewed-consolidation-2026-10-02"
const SOURCE_FILES = [
  `${PLAN}lab-preview/snapshot.json`,
  `${PLAN}lab-preview/review-values.en.json`,
  `${PLAN}owner-review-2026-09-30.md`,
  `${PLAN}remaining-facts-2026-09-30.md`,
  `${PLAN}application-review-2026-09-30.md`,
  `${PLAN}application-followup-2026-10-01.md`,
  `${PLAN}live-catalog-reconciliation-2026-10-02.json`,
  ...[
    "evidence-packet.v0.3.json",
    "blind-packet.v0.3.json",
    "adjudication.json",
    "lane-a/records.json",
    "lane-b/records.json",
    "lane-a/blind-records.json",
    "lane-b/blind-records.json",
    "freeze-receipt.v0.3.json",
    "final-seal.json",
  ].map((f) => RUN + f),
  ...[
    "freeze-receipt.json",
    "method/standard.md",
    "method/runbook.md",
    "method/researcher-prompt.md",
    "method/blind-instructions.md",
  ].map((f) => FROZEN + f),
  "src/lib/bondbuilder-research/registry.ts",
  "scripts/bondbuilder-research/build-owner-batch.ts",
]
type Source = {
  id: string
  url: string
  kind: string
  access: string
  scope: string
  facts?: string
  limits?: string
  affiliation?: string
  retrieval_date?: string
}
type Product = {
  pilot_id: string
  raw_inci_capture: string
  normalized_ingredients: string[]
  evidence_ids: string[]
  source: { id: string }
  alternative_capture?: {
    raw_inci_capture: string
    normalized_ingredients: string[]
    source_id: string
  }
  prior_source_record?: { raw_inci_capture: string; source: { id: string } }
  limitations: string[]
}
type Lab = {
  id: string
  benefit: string
  trustReason: string
  science: string
  practice: string
  format: string
  state: string
  area: string
  amount: string
  time: string
  cadence: string
  conditioner: string
  weight: string
  role: string
  gaps: string[]
  cadenceNote?: string
  historicalConfidence?: Record<string, string>
}
type Historical = {
  pilot_id: string
  counterevidence: string[]
  limitations: string[]
  applicability_bridge: string
  confidence_by_property: Record<string, string>
  assessed_benefit: string
}
type CatalogueRow = { id: string; name: string; [key: string]: unknown }
const read = <T>(root: string, file: string): T =>
  JSON.parse(readFileSync(path.join(root, file), "utf8")) as T
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex")
const unique = <T>(values: T[]) => [...new Set(values)]
const unknown = (reason: string) => ({
  value: null,
  source_ids: [],
  confidence: "low" as const,
  rationale: reason,
  limitations: [],
  unknown_reason: reason,
})
const known = <T>(
  value: T,
  source_ids: string[],
  rationale = "Transcribed from the selected inspected source and reviewed application record.",
) => ({
  value,
  source_ids,
  confidence: "high" as const,
  rationale,
  limitations: ["Source-version finding; supplied pack remains separately unverified."],
  unknown_reason: null,
})
type App = BondbuilderResearchProfile["application"]
type Timing = NonNullable<App["timing"]["value"]>
const exact = (
  seconds: number,
  purpose: "contact" | "wait_before_next_step" = "contact",
): Timing => ({ kind: "exact_seconds", seconds, purpose })
const range: Timing = {
  kind: "range_seconds",
  minimum_seconds: 300,
  maximum_seconds: 600,
  purpose: "contact",
}
const directionId: Record<string, string> = {
  P01: "R12",
  P02: "R11",
  P03: "N05",
  P04: "R01",
  P05: "R09",
  P06: "F02",
  P07: "F01",
  P08: "N01",
}
const markerMap: Record<string, string[]> = {
  sulfur_targeting_dimaleate: ["bis-aminopropyl diglycol dimaleate"],
  designed_peptide: ["sh-oligopeptide-78"],
  maleate_ester: ["diethylhexyl maleate"],
  acid_calcium_management: ["citric acid"],
  gluconamide_gluconate: ["hydroxypropylgluconamide", "hydroxypropylammonium gluconate"],
}

function application(id: string, en: Lab): App {
  const source = directionId[id],
    refs = [source]
  const timing: Timing =
    id === "P01"
      ? exact(180)
      : id === "P02"
        ? exact(240, "wait_before_next_step")
        : id === "P03"
          ? { kind: "minimum_seconds", minimum_seconds: 600, purpose: "contact" }
          : id === "P05" || id === "P07"
            ? range
            : id === "P06"
              ? { kind: "overnight", purpose: "contact" }
              : exact(300, id === "P08" ? "wait_before_next_step" : "contact")
  const fact = <T>(value: T) => known(value, refs)
  const step = (
    action: NonNullable<App["sequence"]["value"]>[number]["action"],
    note: string,
    optional = false,
    time: Timing | null = null,
  ) => ({ action, note, optional, timing: time, source_ids: refs })
  const app: App = {
    direction_source_ids: [...refs],
    source_market: id === "P06" ? "UK" : id === "P03" ? "global" : "DE",
    market_applicability:
      id === "P06" ? "unresolved" : id === "P03" ? "cross_market_complement" : "exact_market",
    applicability_note:
      id === "P06"
        ? "UK producer directions retained; applicability to supplied DE pack is unresolved."
        : id === "P03"
          ? "Official global intended-bottle instructions; exact DE starter/refill kit binding remains open."
          : "Selected exact DE source-version; physical pack and catalogue formula remain separate checks.",
    placement:
      id === "P06"
        ? unknown("Bedtime use does not establish pre- or post-shampoo placement.")
        : fact(id === "P02" ? "post_shampoo" : "pre_shampoo"),
    applied_format:
      id === "P02" || id === "P08"
        ? unknown(
            "Treatment role is known; applicable physical texture descriptor is unestablished.",
          )
        : fact(
            id === "P03"
              ? "liquid_spray"
              : id === "P06"
                ? "serum"
                : id === "P07"
                  ? "gel_cream"
                  : "cream",
          ),
    treatment_role: fact(
      id === "P02" || id === "P06" ? "leave_in_treatment" : "pre_shampoo_treatment",
    ),
    hair_state: fact(
      id === "P01" || id === "P08"
        ? "wet"
        : id === "P03"
          ? "pre_wash_dry"
          : id === "P07"
            ? "dry"
            : id === "P06"
              ? "either"
              : "damp",
    ),
    state_modifiers:
      id === "P02"
        ? fact(["thoroughly_towel_dried"])
        : id === "P03"
          ? fact(["unwashed"])
          : id === "P06"
            ? fact(["at_bedtime"])
            : unknown("No additional state modifier selected."),
    application_area:
      id === "P02"
        ? unknown("DE directions describe distribution and dose, not an exact anatomical area.")
        : fact(
            id === "P01" || id === "P04" || id === "P07"
              ? "root_to_tip"
              : id === "P05" || id === "P08"
                ? "lengths_ends"
                : id === "P06"
                  ? "ends_upward"
                  : "hair",
          ),
    distribution: fact(
      id === "P03"
        ? "Fully saturate dry hair."
        : id === "P06"
          ? "Rub a small amount between hands, then distribute evenly from the ends upward."
          : id === "P08"
            ? "Massage into wet lengths."
            : en.area,
    ),
    timing: fact(timing),
    longer_wear:
      id === "P03" || id === "P06"
        ? fact({ overnight_allowed: true, maximum_seconds: null })
        : unknown(
            "No additional longer-wear permission or maximum established for this selected source.",
          ),
    amount:
      id === "P01" || id === "P04"
        ? fact({ kind: "qualitative", instruction: "Generous coverage." })
        : id === "P02"
          ? fact({
              kind: "starting_dose",
              amount: { quantity: 1, unit: "pump" },
              add_as_needed: true,
            })
          : id === "P03"
            ? fact({ kind: "qualitative", instruction: "Saturate hair fully." })
            : id === "P06"
              ? fact({ kind: "qualitative", instruction: "Small amount; rub between hands first." })
              : unknown(
                  id === "P08"
                    ? "15–25 ml DE FAQ is an unbound complement; selected exact local directions have no dose."
                    : "No selected quantitative or qualitative dose established.",
                ),
    dilution:
      id === "P03"
        ? fact({
            concentrate: { quantity: 1, unit: "vial" },
            finished_volume_ml: 150,
            intended_container: "Intended epres spray bottle",
            method:
              "Add one vial; fill with water to the intended bottle mark and shake. 150 ml is finished mixture, not additional water. Never double concentrate.",
            mixed_use_by_days: null,
          })
        : unknown("No preparation/dilution requirement established in the selected directions."),
    conditioner:
      id === "P06"
        ? unknown(
            "Brand routine context does not require same-day washing or a new conditioner step for bedtime use.",
          )
        : fact({
            before: id === "P02" ? "not_allowed" : "not_stated",
            after: id === "P02" ? "optional" : "recommended",
            minimum_wait_seconds: id === "P02" ? 240 : null,
            guidance_reference:
              id === "P02" ? "application-review-2026-09-30:k18-optional-after" : null,
          }),
    sequence: fact(
      id === "P02"
        ? [
            step("shampoo", "Shampoo without conditioner beforehand."),
            step("towel_dry", "Towel-dry thoroughly."),
            step("apply_treatment", "Start with one pump and add as needed."),
            step("wait", "Wait the full four minutes before further products.", false, timing),
            step(
              "apply_conditioner",
              "Optional usual conditioner after the wait; if rinse-out, rinse that conditioner as usual, not K18 alone.",
              true,
            ),
            step(
              "style",
              "Continue the chosen care and styling sequence without compulsory redosing.",
            ),
          ]
        : id === "P06"
          ? [
              step(
                "apply_treatment",
                "At bedtime, distribute a small amount from ends upward on damp or dry hair.",
              ),
              step(
                "wait",
                "Leave overnight without rinsing; no same-day wash required.",
                false,
                timing,
              ),
            ]
          : [
              ...(id === "P03"
                ? [
                    step(
                      "dilute",
                      "Prepare one vial to 150 ml finished mixture in the intended bottle.",
                    ),
                  ]
                : []),
              step("apply_treatment", en.area),
              step("wait", en.time ?? "Observe the source-backed contact interval.", false, timing),
              ...(id === "P01" || id === "P04" || id === "P05" || id === "P07"
                ? [step("rinse", "Rinse the treatment before shampoo.")]
                : []),
              step(
                id === "P08" ? "layer_shampoo" : "shampoo",
                id === "P08"
                  ? "Layer shampoo over the treatment without rinsing first."
                  : "Shampoo within the normal washing routine.",
              ),
              ...(id === "P08" ? [step("rinse", "Rinse shampoo and treatment together.")] : []),
              step(
                "apply_conditioner",
                id === "P08"
                  ? "Follow with conditioner or mask; brand partner is recommended, not proven exclusive."
                  : "Follow with normal conditioner/care.",
              ),
            ],
    ),
    rinse: fact({
      treatment_mode: id === "P02" || id === "P06" ? "leave_in" : "rinse_out",
      standalone_treatment_rinse: ["P01", "P04", "P05", "P07"].includes(id),
    }),
    cadence: ["P04", "P05", "P08"].includes(id)
      ? unknown(
          "No binding cadence stated for the selected exact DE source-version; cross-market/editorial complements are not imported.",
        )
      : fact(
          id === "P07"
            ? {
                status: "source_stated_conditional",
                initial: null,
                maintenance: null,
                branches: [
                  {
                    condition:
                      "Manufacturer mild–moderate damage; overlaps the other branch at moderate.",
                    initial: null,
                    maintenance: { kind: "times_per_week", minimum: 1, maximum: 1 },
                    timing: null,
                    source_ids: refs,
                  },
                  {
                    condition:
                      "Manufacturer moderate–severe damage; no universal default selected.",
                    initial: null,
                    maintenance: { kind: "every_n_washes", minimum: 1, maximum: 1 },
                    timing: null,
                    source_ids: refs,
                  },
                ],
              }
            : {
                status: "source_stated",
                initial: id === "P02" ? { kind: "consecutive_washes", count: 4 } : null,
                maintenance:
                  id === "P01"
                    ? { kind: "every_n_washes", minimum: 1, maximum: 3 }
                    : id === "P02"
                      ? { kind: "every_n_washes", minimum: 4, maximum: 4 }
                      : { kind: "times_per_week", minimum: 1, maximum: 2 },
                branches: [],
              },
        ),
    partners:
      id === "P08"
        ? fact([
            {
              name: "Première Bain shampoo",
              requirement: "recommended",
              exclusivity_established: false,
              source_ids: refs,
            },
          ])
        : id === "P05"
          ? fact([
              {
                name: "Redken shampoo/conditioner regimen",
                requirement: "recommended",
                exclusivity_established: false,
                source_ids: refs,
              },
            ])
          : unknown(
              "No exclusively required branded companion established; retain normal care directions separately.",
            ),
    source_variants: [],
  }
  if (id === "P02")
    app.source_variants.push({
      source_ids: ["R06"],
      market: "global",
      differences:
        "Global 1–3 pumps, initial 4–6 washes and maintenance as needed; not merged with DE one-pump start and first-four/every-fourth course.",
      selected: false,
    })
  if (id === "P03") {
    app.direction_source_ids.push("R07")
    app.longer_wear = known({ overnight_allowed: true, maximum_seconds: null }, ["R07"])
    app.source_variants.push({
      source_ids: ["N05"],
      market: "global",
      differences:
        "Mixed solution use-by is two months, retained as a calendar duration; not silently converted to 60 days.",
      selected: true,
    })
  }
  if (id === "P04")
    app.source_variants.push({
      source_ids: ["A-ELVITAL-EDITORIAL", "A-ELVITAL-WEEKLY"],
      market: "DE",
      differences:
        "Older/ambiguous Rescue editorial frequency and dry-hair 5–10-minute directions are not selected for current Plus.",
      selected: false,
    })
  if (id === "P05")
    app.source_variants.push({
      source_ids: ["A-REDKEN-AU"],
      market: "AU",
      differences:
        "2–3 times weekly is manufacturer cross-market advice; matching ingredient order does not bind the DE cadence, dose or roots/wet/lather instructions.",
      selected: false,
    })
  if (id === "P08")
    app.source_variants.push({
      source_ids: ["A-PREMIERE-DE", "A-PREMIERE-US"],
      market: "DE/US",
      differences:
        "DE FAQ 15–25 ml by length and damp/towel-dried variants; US brand professional weekly advice. Neither changes selected local wet-lengths/no-dose/no-cadence facts.",
      selected: false,
    })
  return app
}

function supplementarySources(en: Lab[]): Source[] {
  const product = (id: string) => en.find((p) => p.id === id)!
  return [
    {
      id: "A-REDKEN-AU",
      url: "https://www.redken.com.au/products/haircare/acidic-bonding-concentrate/acidic-bonding-concentrate-intensive-treatment",
      kind: "manufacturer",
      access: "product directions inspected 2026-10-01",
      scope: "AU product directions, not DE pack",
      facts:
        "AU manufacturer recommends 2–3 uses weekly. Ingredient order corroborates selected 16-ingredient formula but roots/wet/lather prose differs from selected Douglas directions.",
      limits: "Cross-market complement; no concentration equality or binding DE cadence.",
      retrieval_date: "2026-10-01",
    },
    {
      id: "A-PREMIERE-DE",
      url: "https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html",
      kind: "manufacturer",
      access: "FAQ and directions inspected 2026-10-01",
      scope: "DE manufacturer complement with format/formula applicability limits",
      facts:
        "FAQ gives 15–25 ml by hair length and shampoo layering after five minutes; current page names travel format. Manufacturer damp/towel-dried variants differ from selected local wet-lengths wording.",
      limits:
        "Displayed formula block was mismatched; quantitative dose remains complementary pending exact pack binding.",
      retrieval_date: "2026-10-01",
    },
    {
      id: "A-PREMIERE-US",
      url: "https://www.kerastase-usa.com/collections/premiere/concentre-decalcifiant-repairing-pre-shampoo.html",
      kind: "brand_professional",
      access: "named brand education manager advice inspected 2026-09-30",
      scope: "Commercially affiliated US professional usage advice",
      facts: product("P08").practice,
      limits: "Not independent efficacy testing or a binding DE pack schedule.",
      affiliation: "Kérastase brand education manager",
      retrieval_date: "2026-09-30",
    },
    {
      id: "A-JUUT",
      url: "https://juut.com/blog/damaged-hair-repair/",
      kind: "commercial_professional",
      access: "named stylist experiences inspected 2026-09-30",
      scope: "Aveda product practice",
      facts: product("P07").practice,
      limits:
        "Commercially connected to Aveda; sensory/manageability accounts do not establish measured structural repair.",
      affiliation: "JUUT / Aveda",
      retrieval_date: "2026-09-30",
    },
    {
      id: "A-REDKEN-CREATOR",
      url: "https://www.youtube.com/watch?v=bkEPoi_Fxvs",
      kind: "creator_original_video_lead",
      access: "product listing inspected; detailed verdict uninspected",
      scope: "Redken treatment listing only",
      facts:
        "Abbey's own video listing names the treatment; no detailed product verdict was inspected.",
      limits: "No positive long-term or efficacy conclusion may be extracted.",
      retrieval_date: "2026-09-30",
    },
    {
      id: "A-ELVITAL-EDITORIAL",
      url: "https://www.loreal-paris.de/tipps-und-trends/haarpflege/protein-behandlung-fuer-haare",
      kind: "manufacturer",
      access: "editorial applicability inspected 2026-09-30",
      scope: "Ambiguous Rescue editorial guidance",
      facts:
        "Editorial twice-weekly initially then weekly advice includes conflicting dry-hair 5–10-minute directions; not selected for current Plus.",
      limits:
        "Older/ambiguous version; unrelated protein-frequency assertions do not become Bondbuilder rules.",
      retrieval_date: "2026-09-30",
    },
    {
      id: "A-ELVITAL-WEEKLY",
      url: "https://www.loreal-paris.de/tipps-und-trends/haarpflege/hitzegeschaedigtes-haar-reparieren",
      kind: "manufacturer",
      access: "editorial applicability inspected 2026-09-30",
      scope: "Ambiguous Rescue weekly advice",
      facts:
        "Editorial weekly advice is retained as a source variant, not selected for exact current Plus.",
      limits: "Exact product-version applicability is unresolved; do not impose weekly use.",
      retrieval_date: "2026-09-30",
    },
  ]
}

function sourceProfile(s: Source): BondbuilderResearchProfile["sources"][number] {
  const kind = s.kind.toLowerCase()
  const authority = kind.includes("peer_reviewed")
    ? "peer_reviewed"
    : kind.includes("supplier")
      ? "supplier"
      : kind.includes("patent")
        ? "patent"
        : kind.includes("retailer")
          ? "retailer"
          : kind.includes("distributor")
            ? "distributor"
            : kind.includes("creator") || kind.includes("first_person")
              ? "creator"
              : kind.includes("professional")
                ? "professional"
                : "manufacturer"
  const scope = ["E01", "E02", "E03", "E04", "E06", "E07", "N07"].includes(s.id)
    ? "technology"
    : ["E05", "N06"].includes(s.id)
      ? "predecessor"
      : ["N08", "N09", "N10", "N11", "N12", "A-JUUT", "A-PREMIERE-US", "A-REDKEN-CREATOR"].includes(
            s.id,
          )
        ? "practice"
        : "product"
  const access =
    s.id === "N09" || s.id === "A-REDKEN-CREATOR"
      ? "uninspected"
      : s.access.includes("abstract")
        ? "abstract"
        : ["E05", "N06", "N12"].includes(s.id)
          ? "full_text"
          : "inspected_excerpt"
  return {
    id: s.id,
    url: s.url,
    checked_date: s.retrieval_date ?? (s.id.startsWith("F") ? "2026-10-01" : "2026-09-30"),
    authority,
    type: s.kind,
    scope,
    access,
    author: s.id === "N12" ? "Kara" : null,
    affiliation: s.affiliation ?? null,
    commercial_context:
      s.affiliation ??
      (authority === "manufacturer" ||
      authority === "distributor" ||
      authority === "retailer" ||
      authority === "supplier" ||
      authority === "patent"
        ? "Commercially affiliated source; not independent retail efficacy evidence."
        : null),
    observation: s.facts ?? s.scope,
    limitations: [s.scope, s.access, ...(s.limits ? [s.limits] : [])],
  }
}

export function buildBondbuilderOwnerBatch(repoRoot: string) {
  const packet = read<{ products: Product[]; sources: Source[] }>(
    repoRoot,
    RUN + "evidence-packet.v0.3.json",
  )
  const snapshot = read<{ products: Lab[]; sources: Source[] }>(
    repoRoot,
    PLAN + "lab-preview/snapshot.json",
  )
  const overlay = read<{ products: Lab[]; followupSources: Source[] }>(
    repoRoot,
    PLAN + "lab-preview/review-values.en.json",
  )
  const history = read<{ records: Historical[] }>(repoRoot, RUN + "adjudication.json")
  const catalogue = read<{ rows: CatalogueRow[] }>(
    repoRoot,
    PLAN + "live-catalog-reconciliation-2026-10-02.json",
  )
  const rawSources = [
    ...packet.sources,
    ...snapshot.sources.filter((s) => !packet.sources.some((p) => p.id === s.id)),
    ...overlay.followupSources,
    ...supplementarySources(overlay.products),
  ]
  const sources = rawSources.map(sourceProfile)
  const receipt = SOURCE_FILES.map((file) => {
    const bytes = readFileSync(path.join(repoRoot, file))
    return {
      source_file: file,
      retained_file: `raw/${file}`,
      sha256: digest(bytes),
      bytes: bytes.length,
    }
  })
  const items = BOND_OWNER_REGISTRY.map((owner) => {
    const id = owner.research_key,
      product = packet.products.find((p) => p.pilot_id === id)!,
      en = overlay.products.find((p) => p.id === id)!,
      de = snapshot.products.find((p) => p.id === id)!,
      historical = history.records.find((p) => p.pilot_id === id)!
    if (!product || !en || !de || !historical)
      throw new Error(`Missing complete source material: ${id}`)
    const raw =
      id === "P05" ? product.alternative_capture!.raw_inci_capture : product.raw_inci_capture
    const formulaId = id === "P05" ? "R09" : product.source.id
    const scientific =
      id === "P01"
        ? ["E03", "E05", "N06"]
        : id === "P02"
          ? ["E04", "E05", "N06"]
          : id === "P03"
            ? ["E07"]
            : ["P06", "P07"].includes(id)
              ? ["E02", "E06"]
              : ["E01", "N07"]
    const practical =
      id === "P01"
        ? ["N10", "N11"]
        : id === "P03"
          ? ["N12", "N08"]
          : id === "P07"
            ? ["A-JUUT"]
            : id === "P08"
              ? ["A-PREMIERE-US"]
              : []
    const app = application(id, en)
    const evidenceIds = unique([formulaId, ...scientific, ...practical, directionId[id]])
    const reasons = Object.fromEntries(
      BOND_RESEARCH_PROPERTIES.map((property) => [
        property,
        {
          confidence:
            property === "fit_assessment"
              ? "low"
              : [
                    "claim_trust_level",
                    "trust_basis",
                    "technology_family",
                    "boundary_status",
                  ].includes(property)
                ? "high"
                : "moderate",
          rationale:
            property === "claim_trust_level" || property === "trust_basis"
              ? en.trustReason
              : property === "fit_assessment"
                ? "Independent diameter suitability remains unestablished; existing approvals are preserved separately."
                : property === "technology_family" || property === "boundary_status"
                  ? "Complete selected source-version formula has the specific marker and targeted at-home treatment role; no molecular efficacy is inferred."
                  : property === "supported_outcome"
                    ? en.benefit
                    : property === "evidence_profile"
                      ? en.science
                      : property === "intended_role"
                        ? en.role
                        : "Selected source-backed application facts are retained independently of current runtime compatibility.",
          source_ids:
            property === "fit_assessment"
              ? []
              : property === "application_facts" ||
                  property === "application_mode" ||
                  property === "product_format" ||
                  property === "treatment_mode" ||
                  property === "intended_role"
                ? [directionId[id]]
                : evidenceIds,
          limitations:
            property === "fit_assessment"
              ? [en.weight]
              : [
                  "Owner grade is a reviewed practical trust policy, not scientific certainty or catalogue approval.",
                ],
          assumptions: [],
        },
      ]),
    )
    const reference = BOND_OWNER_REGISTRY.find(
      (r) =>
        BOND_REFERENCE_KEYS.some((k) => k === r.research_key) &&
        r.technology_family === owner.technology_family,
    )!
    const conflicts =
      id === "P05"
        ? [
            {
              source_ids: ["R02"],
              raw_inci: product.raw_inci_capture,
              reason:
                "Owner selected the exact Douglas DE 190 ml sixteen-ingredient source-version on 2026-09-30; displaced manufacturer list retained without merging.",
              resolved: true,
            },
          ]
        : product.prior_source_record && product.prior_source_record.raw_inci_capture !== raw
          ? [
              {
                source_ids: [product.prior_source_record.source.id],
                raw_inci: product.prior_source_record.raw_inci_capture,
                reason:
                  "Displaced historical source retained; the reviewed selected source-version is not a claim of cross-market equality.",
                resolved: true,
              },
            ]
          : []
    const fitReason =
      "No independently established fine/normal/coarse suitability from this research pass. Manufacturer positioning is attributed evidence; existing catalogue approval is preserved separately."
    const protocolHolds =
      id === "P06"
        ? [
            {
              code: "uk_directions_de_pack_unverified",
              reason:
                "UK bedtime directions do not establish a binding DE protocol or mandatory post-wash placement.",
              field: "application",
              source_ids: ["F02"],
            },
          ]
        : []
    const profile = bondbuilderResearchProfileSchema.parse({
      version: "bondbuilder-research-profile-v1",
      method: {
        ...BOND_METHOD_PINS,
        run_reference: CONSOLIDATION,
        artifact_reference: `${PLAN}owner-batch-2026-10-02/${id}.json`,
        output_sha256: "0".repeat(64),
      },
      identity: {
        research_key: id,
        product_name: owner.product_name,
        brand: owner.brand,
        market: owner.market,
        size: owner.size,
        source_version: owner.source_version,
        gtin: null,
        status: "resolved",
        product_id: null,
      },
      formula: {
        raw_inci: raw,
        normalized_ingredients: [...owner.normalized_ingredients],
        raw_sha256: digest(raw),
        normalized_sha256: digest(JSON.stringify(owner.normalized_ingredients)),
        normalization_version: "bondbuilder-inci-normalization-v1",
        status: "complete",
        source_ids: [formulaId],
        conflicts,
        markers: markerMap[owner.technology_family].map((literal) => ({
          literal,
          family: owner.technology_family,
          source_ids: [formulaId],
        })),
        candidate_families: [owner.technology_family],
        candidate_to_final_trace: [
          "Existing sealed formula observations carried forward; this is manual source/owner consolidation, not fresh blinded classification.",
          id === "P05"
            ? "Historical v0.3 R02/R09 identity hold is superseded for this exact research target by the owner-selected Douglas source; raw historical hold remains archived."
            : "Exact owner registry binds selected raw and ordered normalized formula; source-version findings do not verify a supplied physical pack.",
        ],
      },
      assessment: {
        boundary_status: "in_scope",
        technology_family: owner.technology_family,
        claim_trust_level: owner.claim_trust_level,
        trust_basis: owner.trust_basis,
        classification_confidence: "moderate",
        limiting_factors: [
          "Manual consolidation of existing reviewed research; provisional method remains unlocked.",
          en.weight,
        ],
        policy_reference: owner.policy_reference,
        reasoning: reasons,
      },
      technology_reference: {
        status: "matched",
        research_key: reference.research_key,
        product_id: null,
        formula_sha256: reference.normalized_sha256,
        source_version: reference.source_version,
        shared_markers: markerMap[owner.technology_family],
        source_ids: [formulaId],
        limitation:
          "Comparable marker family only; concentration, supplier, efficacy, owner tier and protocol never transfer from the reference.",
      },
      application: app,
      evidence: {
        supported_outcome: en.benefit,
        summary: en.science,
        detail: [
          en.trustReason,
          en.science,
          en.practice,
          en.role,
          "Historical v0.3 evidence observations (owner grades and selected Redken source now follow the later owner decision):",
          ...historical.counterevidence,
          ...historical.limitations,
        ].join("\n\n"),
        scientific: {
          supporting_source_ids: scientific,
          counter_source_ids:
            id === "P01" ? ["E03", "E05", "N06"] : id === "P02" ? ["E05", "N06"] : [],
          limitations: unique(historical.counterevidence),
        },
        practical: {
          supporting_source_ids: practical,
          counter_source_ids: [],
          limitations: [
            en.practice,
            "Unavailable creator videos are leads only; absent access is neutral, not evidence of no effect.",
          ],
        },
        applicability: [
          ...scientific.map((source) => ({
            scope:
              id === "P02" && ["E05", "N06"].includes(source)
                ? "product"
                : sources.find((s) => s.id === source)!.scope,
            source_ids: [source],
            bridge: sources.find((s) => s.id === source)!.observation,
            limitations: sources.find((s) => s.id === source)!.limitations,
          })),
          ...(practical.length
            ? [
                {
                  scope: "practice",
                  source_ids: practical,
                  bridge: en.practice,
                  limitations: [
                    "Commercial affiliation and sensory endpoints remain visible; no structural result inferred.",
                  ],
                },
              ]
            : []),
          {
            scope: "product",
            source_ids: unique([formulaId, directionId[id]]),
            bridge:
              "Exact selected product source and separately selected directions; physical pack/catalogue binding remains unverified.",
            limitations: en.gaps,
          },
          ...(["P06", "P04", "P05", "P08"].includes(id)
            ? [
                {
                  scope: "system",
                  source_ids: [id === "P06" ? "R03" : formulaId],
                  bridge:
                    "System or regimen claims are not isolated treatment efficacy and do not establish exclusive brand dependence.",
                  limitations: [en.science],
                },
              ]
            : []),
        ],
        manufacturer_positioning: [
          en.role,
          ...(["P01", "P02", "P04"].includes(id) ? [en.weight] : []),
          ...(id === "P07"
            ? [
                "F01 manufacturer lists fine/normal/coarse; not an independent fit or weightlessness assessment.",
              ]
            : []),
        ],
        cautions: [en.weight, ...en.gaps],
      },
      explanations_de: {
        concise: de.trustReason,
        deeper: [de.science, de.practice, de.weight].join("\n\n"),
      },
      sources: sources.map((source) =>
        id === "P02" && ["E05", "N06"].includes(source.id)
          ? { ...source, scope: "product" }
          : source,
      ),
      fit: { fine: unknown(fitReason), normal: unknown(fitReason), coarse: unknown(fitReason) },
      holds: {
        identity: [],
        boundary: [],
        claim_trust: [],
        protocol: protocolHolds,
        fit: [
          {
            code: "independent_fit_unestablished",
            reason: fitReason,
            field: "fit",
            source_ids: [],
          },
        ],
      },
      review: {
        checked_date: "2026-10-02",
        reviewed_date: null,
        profile_sha256: "0".repeat(64),
        decision_references: [
          owner.policy_reference,
          "application-review-2026-09-30",
          "application-followup-2026-10-01",
        ],
      },
    })
    profile.method.output_sha256 = profile.review.profile_sha256 = bondbuilderProfileSha256(profile)
    const envelope = { version: "bondbuilder-research-envelope-v1", submission_id: null, profile }
    const projection = projectBondbuilderForProduction(envelope)
    if (projection.status !== "projected") throw new Error(`${id}: ${projection.errors.join("; ")}`)
    const candidate =
      catalogue.rows.find((r) => r.name.toLowerCase() === owner.product_name.toLowerCase()) ?? null
    const protocol = candidate
      ? projectBondbuilderProtocol(profile, candidate.id)
      : { status: "hold" as const, reasons: ["no_reconciled_catalogue_product_id"] }
    const blockers = [
      "provisional_method_not_locked",
      "physical_pack_formula_binding_unverified",
      "reviewed_preimage_and_guarded_apply_not_approved",
      "german_lab_explanations_require_customer_copy_review",
      ...profile.holds.protocol.map((hold) => hold.code),
      ...(profile.application.cadence.value === null
        ? ["selected_local_cadence_unestablished"]
        : profile.application.cadence.value.status === "source_stated_conditional"
          ? ["conditional_cadence_has_no_universal_default"]
          : []),
      ...(candidate
        ? ["candidate_existing_row_not_authorized_for_update"]
        : [
            "no_existing_row_found_in_bounded_snapshot",
            "new_row_origin_and_publication_mode_require_review",
          ]),
      ...(protocol.status === "hold"
        ? protocol.reasons
        : protocol.cadenceHold
          ? [protocol.cadenceHold]
          : []),
      ...(owner.claim_trust_level === "low" ? ["owner_low_not_curated_promotion_candidate"] : []),
      "new_research_fit_not_established",
    ]
    return {
      research_key: id,
      stage: "review_only_no_apply" as const,
      envelope,
      property_projection: projection,
      protocol_projection: protocol,
      label_cadence: projectBondbuilderCadence(profile),
      catalogue_candidate_id: candidate?.id ?? null,
      catalogue_preimage: candidate,
      catalogue_binding_verified: false,
      item_readiness: {
        property_projection_ready: true,
        candidate_protocol_projected: protocol.status === "resolved",
        catalog_intake_ready: false,
        global_recommendation_ready: false,
        publish_ready: false,
      },
      blockers,
      raw_research_references: receipt.map((r) => ({
        source_file: r.source_file,
        sha256: r.sha256,
      })),
      historical_confidence: {
        snapshot: de.historicalConfidence,
        adjudication: historical.confidence_by_property,
      },
    }
  })
  return {
    version: "bondbuilder-owner-batch-v1",
    consolidation: CONSOLIDATION,
    method_locked: false,
    new_classification_run: false,
    apply_authorized: false,
    source_receipt: receipt,
    items,
  }
}

export function writeBondbuilderOwnerBatch(repoRoot: string, output: string) {
  const batch = buildBondbuilderOwnerBatch(repoRoot)
  // Exclusive mkdir rejects even an existing empty directory. Historical outputs are never replaced.
  mkdirSync(output, { recursive: false })
  for (const receipt of batch.source_receipt) {
    const destination = path.join(output, receipt.retained_file)
    mkdirSync(path.dirname(destination), { recursive: true })
    copyFileSync(path.join(repoRoot, receipt.source_file), destination, constants.COPYFILE_EXCL)
  }
  for (const item of batch.items)
    writeFileSync(
      path.join(output, `${item.research_key}.json`),
      JSON.stringify(item, null, 2) + "\n",
      { flag: "wx" },
    )
  writeFileSync(
    path.join(output, "manifest.json"),
    JSON.stringify(
      {
        ...batch,
        items: batch.items.map(
          ({ research_key, item_readiness, blockers, catalogue_candidate_id }) => ({
            research_key,
            file: `${research_key}.json`,
            item_readiness,
            blockers,
            catalogue_candidate_id,
          }),
        ),
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  )
  return batch
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  if (process.argv.length !== 4 || process.argv[2] !== "--output")
    throw new Error("Usage: --output <nonexistent-local-directory>")
  const batch = writeBondbuilderOwnerBatch(root, path.resolve(process.argv[3]))
  console.log(
    JSON.stringify({
      items: batch.items.length,
      property_ready: batch.items.filter((i) => i.item_readiness.property_projection_ready).length,
      publish_ready: 0,
    }),
  )
}
