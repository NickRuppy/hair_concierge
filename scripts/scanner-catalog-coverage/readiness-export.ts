import { createHash } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, sep } from "node:path"

import { config as loadEnv } from "dotenv"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { canonicalizeGtin } from "../../src/lib/product-identity/normalize"
import { loadScanProductFacts } from "../../src/lib/personal-plan/products/authority/catalog-facts"
import { buildScanVerdict } from "../../src/lib/scan/resolve-verdict"
import type { PersonalPlanCategory } from "../../src/lib/personal-plan/products/contracts"
import type { Stage3CategoryProductFacts } from "../../src/lib/personal-plan/products/authority/contracts"
import type { PlanCategoryDecision, PlanProductRole } from "../../src/lib/personal-plan/types"

const OUTPUT_PATH = "data/scanner-catalog-coverage/2026-08-26/readiness-baseline.json"
const PAGE_SIZE = 500
const BARCODE_TYPES = new Set(["ean", "gtin", "barcode"])
const SUPPORTED_CATEGORIES = new Set<PersonalPlanCategory>([
  "shampoo",
  "conditioner",
  "mask",
  "leave_in",
  "oil",
  "dry_shampoo",
  "heat_protectant",
  "deep_cleansing_shampoo",
  "scalp_care",
  "bondbuilder",
])

type Row = Record<string, unknown>
type Blocker =
  | "has_disposition"
  | "missing_presentation_image"
  | "missing_product_facts"
  | "missing_required_protocol"
  | "verdict_unknown"
  | "verdict_error"

export type ReadinessCandidate = {
  product_id: string
  category: PersonalPlanCategory
  has_barcode: false
  status: "ready_for_ean_research" | "blocked"
  blockers: Blocker[]
  verdicts: Array<{
    profile: "fine" | "normal" | "coarse"
    role: string
    verdict: "ideal" | "supportive" | "mismatch" | "unknown" | "error"
  }>
}

export type ReadinessProductAudit = {
  product_id: string
  category: PersonalPlanCategory
  has_barcode: boolean
  status: "scan_result_ready" | "ready_for_ean_research" | "blocked"
  blockers: Blocker[]
  verdicts: ReadinessCandidate["verdicts"]
}

export type ReadinessBaseline = {
  schema_version: 2
  exported_at: string
  source: {
    project_ref: string
    read_only: true
    identifier_canonicalization: "runtime_canonicalize_gtin14"
  }
  reconciliation: {
    active_supported_without_barcode: number
    ready_for_ean_research: number
    blocked: number
    by_category: Record<
      string,
      { candidates: number; ready_for_ean_research: number; blocked: number }
    >
  }
  full_catalog_reconciliation: {
    active_supported: number
    barcode_linked: number
    scan_result_ready: number
    ready_for_ean_research: number
    blocked: number
    by_category: Record<
      string,
      {
        products: number
        barcode_linked: number
        scan_result_ready: number
        ready_for_ean_research: number
        blocked: number
      }
    >
  }
  candidates: ReadinessCandidate[]
  products: ReadinessProductAudit[]
  content_fingerprint: string
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as Row)
        .sort()
        .map((key) => [key, stable((value as Row)[key])]),
    )
  return value
}
export function fingerprint(
  value: Omit<ReadinessBaseline, "exported_at" | "content_fingerprint">,
): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex")
}

/** A conservative pure seam: identity alone never bypasses the verdict-readiness oracle. */
export function classifyProductReadiness(
  input: Omit<ReadinessProductAudit, "status" | "blockers"> & {
    has_disposition: boolean
    image_url_present: boolean
    product_facts_present: boolean
    required_protocols_complete: boolean
  },
): ReadinessProductAudit {
  const blockers: Blocker[] = []
  if (input.has_disposition) blockers.push("has_disposition")
  if (!input.image_url_present) blockers.push("missing_presentation_image")
  if (!input.product_facts_present) blockers.push("missing_product_facts")
  if (!input.required_protocols_complete) blockers.push("missing_required_protocol")
  if (input.verdicts.some((item) => item.verdict === "unknown")) blockers.push("verdict_unknown")
  if (input.verdicts.some((item) => item.verdict === "error")) blockers.push("verdict_error")
  return {
    product_id: input.product_id,
    category: input.category,
    has_barcode: input.has_barcode,
    status:
      blockers.length > 0
        ? "blocked"
        : input.has_barcode
          ? "scan_result_ready"
          : "ready_for_ean_research",
    blockers,
    verdicts: [...input.verdicts].sort((a, b) =>
      `${a.profile}\u0000${a.role}`.localeCompare(`${b.profile}\u0000${b.role}`),
    ),
  }
}

/** Compatibility projection for the existing unlinked-product ledger. */
export function classifyCandidate(
  input: Omit<ReadinessCandidate, "status" | "blockers"> & {
    has_disposition: boolean
    image_url_present: boolean
    product_facts_present: boolean
    required_protocols_complete: boolean
  },
): ReadinessCandidate {
  const result = classifyProductReadiness(input)
  return {
    ...result,
    has_barcode: false,
    status: result.status === "blocked" ? "blocked" : "ready_for_ean_research",
  }
}

export function selectActiveSupportedProducts(products: Row[], identifiers: Row[]) {
  const barcodeProductIds = new Set(
    identifiers
      .filter(
        (row) =>
          BARCODE_TYPES.has(text(row.identifier_type) ?? "") &&
          canonicalizeGtin(text(row.identifier_value) ?? "") !== null,
      )
      .map((row) => String(row.product_id)),
  )
  return products
    .filter(
      (product) =>
        product.is_active === true &&
        text(product.lifecycle_status) === "active" &&
        SUPPORTED_CATEGORIES.has(text(product.category_key) as PersonalPlanCategory),
    )
    .map((row) => ({ row, has_barcode: barcodeProductIds.has(String(row.id)) }))
}

function primaryRoleFor(category: PersonalPlanCategory): PlanProductRole {
  return (
    {
      shampoo: "shampoo_everyday",
      conditioner: "conditioner_rinse_out",
      mask: "intensive_conditioning_mask",
      leave_in: "post_wash_leave_in",
      oil: "dry_finish",
      dry_shampoo: "root_refresh_bridge",
      heat_protectant: "pre_heat_protection",
      deep_cleansing_shampoo: "residue_reset",
      scalp_care: "scalp_comfort",
      bondbuilder: "specialized_bond_treatment",
    } as const
  )[category]
}

const KNOWN_ROLES = new Set<PlanProductRole>([
  "shampoo_everyday",
  "shampoo_dandruff",
  "conditioner_rinse_out",
  "post_wash_leave_in",
  "pre_heat_application",
  "pre_heat_protection",
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
  "intensive_conditioning_mask",
  "scalp_comfort",
  "scalp_flake_oil_adjunct",
  "density_claim_tonic",
  "scalp_exfoliant",
  "root_refresh_bridge",
  "residue_reset",
  "mineral_reset",
  "specialized_bond_treatment",
])

/** Runtime roles derive from the loaded authority facts, never a single category default. */
export function requiredRolesForFacts(facts: Stage3CategoryProductFacts): PlanProductRole[] {
  const declared = (values: ReadonlyArray<string | null> | null | undefined) =>
    (values ?? []).filter(
      (role): role is PlanProductRole =>
        typeof role === "string" && KNOWN_ROLES.has(role as PlanProductRole),
    )
  switch (facts.category) {
    case "shampoo":
      return facts.spec.shampooBucket === "schuppen"
        ? ["shampoo_everyday", "shampoo_dandruff"]
        : ["shampoo_everyday"]
    case "conditioner":
      return ["conditioner_rinse_out"]
    case "mask":
      return ["intensive_conditioning_mask"]
    case "dry_shampoo":
      return ["root_refresh_bridge"]
    case "heat_protectant":
      return ["pre_heat_protection"]
    case "bondbuilder":
      return ["specialized_bond_treatment"]
    case "deep_cleansing_shampoo":
      return facts.spec.supportedResetRoles ?? ["residue_reset"]
    case "scalp_care":
      return declared([facts.spec.primaryRole])[0]
        ? [declared([facts.spec.primaryRole])[0]!]
        : ["scalp_comfort"]
    case "leave_in": {
      const roles = new Set<PlanProductRole>(["post_wash_leave_in", ...declared(facts.spec.roles)])
      if (facts.spec.providesHeatProtection === true) roles.add("pre_heat_application")
      return [...roles].filter(
        (role) => role === "post_wash_leave_in" || role === "pre_heat_application",
      )
    }
    case "oil": {
      const roles = (
        Object.entries(facts.spec.roleSupport) as Array<[PlanProductRole, boolean | null]>
      )
        .filter(([role, supported]) => supported === true && role !== "pre_heat_protection")
        .map(([role]) => role)
      return roles.length > 0 ? roles : ["dry_finish"]
    }
  }
}

function targetFor(
  category: PersonalPlanCategory,
  role: PlanProductRole,
): PlanCategoryDecision["target"] {
  switch (category) {
    case "shampoo":
      return {
        category,
        roles: [role as "shampoo_everyday" | "shampoo_dandruff"],
        scalpRoute: "balanced",
        everydayConstraint: "standard",
        requiresTargetedDandruffCapability: role === "shampoo_dandruff",
      }
    case "conditioner":
      return {
        category,
        roles: [role as "conditioner_rinse_out"],
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      }
    case "mask":
      return {
        category,
        roles: [role as "intensive_conditioning_mask"],
        needStrength: "standard",
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      }
    case "leave_in":
      return {
        category,
        roles: [role as "post_wash_leave_in" | "pre_heat_application"],
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
        functions: [],
        conditionerReplacementEligible: false,
      }
    case "oil":
      return {
        category,
        roles: [role as "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"],
        roleTargets: [
          {
            role: role as "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish",
            tier: "optional",
            weight: "medium",
            functionalBenefits: [],
          },
        ],
      }
    case "dry_shampoo":
      return { category, roles: [role as "root_refresh_bridge"], cadenceAdjustment: "keep" }
    case "heat_protectant":
      return {
        category,
        roles: [role as "pre_heat_protection"],
        qualifyingRoutes: ["direct_contact_heat"],
        carrierPolicy: "integrated_or_separate_verified_binary_capability",
      }
    case "deep_cleansing_shampoo":
      return { category, roles: [role as "residue_reset"] }
    case "scalp_care":
      return {
        category,
        roles: [role as "scalp_comfort"],
        roleTargets: [{ role: role as "scalp_comfort", coverage: "primary" }],
      }
    case "bondbuilder":
      return {
        category,
        roles: [role as "specialized_bond_treatment"],
        requiredFunction: "support_stressed_hair_resilience",
        mechanismTarget: "mechanism_neutral",
      }
  }
}

function decisionFor(category: PersonalPlanCategory, role: PlanProductRole): PlanCategoryDecision {
  return {
    category,
    resolution: "resolved",
    needTier: "basis",
    roles: [role],
    target: targetFor(category, role),
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as PlanCategoryDecision
}

async function verdictsFor(
  client: SupabaseClient,
  category: PersonalPlanCategory,
  productId: string,
) {
  const verdicts: ReadinessCandidate["verdicts"] = []
  let factsPresent = true
  let protocolsComplete = true
  let roles: PlanProductRole[] = [primaryRoleFor(category)]
  try {
    const primary = await loadScanProductFacts(client, category, productId, {
      hairThickness: "normal",
      role: roles[0]!,
      shampooTarget: category === "shampoo" ? (targetFor(category, roles[0]!) as never) : null,
      conditionerTarget:
        category === "conditioner" ? (targetFor(category, roles[0]!) as never) : null,
    })
    if (!primary) factsPresent = false
    else roles = requiredRolesForFacts(primary)
  } catch {
    factsPresent = false
  }
  for (const role of roles)
    for (const profile of ["fine", "normal", "coarse"] as const) {
      try {
        const facts = await loadScanProductFacts(client, category, productId, {
          hairThickness: profile,
          role,
          shampooTarget: category === "shampoo" ? (targetFor(category, role) as never) : null,
          conditionerTarget:
            category === "conditioner" ? (targetFor(category, role) as never) : null,
        })
        if (!facts) {
          factsPresent = false
          verdicts.push({ profile, role, verdict: "error" })
          continue
        }
        if (
          facts.protocols.some(
            (protocol) => protocol.role === role && protocol.status !== "verified_complete",
          )
        )
          protocolsComplete = false
        const result = buildScanVerdict({
          category,
          decision: decisionFor(category, role),
          productFacts: facts,
          recommendationCandidates: [facts],
          coverage: [],
          hairThickness: profile,
          heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
          refinedVersionId: "scanner-readiness-v1",
          refinedInputHash: "scanner-readiness-v1",
        })
        verdicts.push({
          profile,
          role,
          verdict: result.kind === "in_catalog" ? result.verdict : "unknown",
        })
      } catch {
        verdicts.push({ profile, role, verdict: "error" })
      }
    }
  return { factsPresent, protocolsComplete, verdicts }
}

export async function buildReadinessBaseline(input: {
  client: SupabaseClient
  products: Row[]
  identifiers: Row[]
  dispositions: Row[]
  exportedAt: string
  projectRef: string
}): Promise<ReadinessBaseline> {
  const dispositionProductIds = new Set(input.dispositions.map((row) => String(row.product_id)))
  const sourceProducts = selectActiveSupportedProducts(input.products, input.identifiers)
  const products = await mapWithConcurrency(sourceProducts, 8, async ({ row, has_barcode }) => {
    const category = text(row.category_key) as PersonalPlanCategory
    const productId = String(row.id)
    const evaluated = await verdictsFor(input.client, category, productId)
    return classifyProductReadiness({
      product_id: productId,
      category,
      has_barcode,
      has_disposition: dispositionProductIds.has(productId),
      image_url_present: text(row.image_url) !== null,
      product_facts_present: evaluated.factsPresent,
      required_protocols_complete: evaluated.protocolsComplete,
      verdicts: evaluated.verdicts,
    })
  })
  products.sort((a, b) =>
    `${a.category}\u0000${a.product_id}`.localeCompare(`${b.category}\u0000${b.product_id}`),
  )
  const candidates = products
    .filter((item): item is ReadinessProductAudit & { has_barcode: false } => !item.has_barcode)
    .map(
      (item): ReadinessCandidate => ({
        ...item,
        has_barcode: false,
        status: item.status === "blocked" ? "blocked" : "ready_for_ean_research",
      }),
    )
  candidates.sort((a, b) =>
    `${a.category}\u0000${a.product_id}`.localeCompare(`${b.category}\u0000${b.product_id}`),
  )
  const by_category: ReadinessBaseline["reconciliation"]["by_category"] = {}
  for (const item of candidates) {
    const bucket = by_category[item.category] ?? {
      candidates: 0,
      ready_for_ean_research: 0,
      blocked: 0,
    }
    bucket.candidates++
    bucket[item.status]++
    by_category[item.category] = bucket
  }
  const full_by_category: ReadinessBaseline["full_catalog_reconciliation"]["by_category"] = {}
  for (const item of products) {
    const bucket = full_by_category[item.category] ?? {
      products: 0,
      barcode_linked: 0,
      scan_result_ready: 0,
      ready_for_ean_research: 0,
      blocked: 0,
    }
    bucket.products++
    if (item.has_barcode) bucket.barcode_linked++
    bucket[item.status]++
    full_by_category[item.category] = bucket
  }
  const content = {
    schema_version: 2 as const,
    source: {
      project_ref: input.projectRef,
      read_only: true as const,
      identifier_canonicalization: "runtime_canonicalize_gtin14" as const,
    },
    reconciliation: {
      active_supported_without_barcode: candidates.length,
      ready_for_ean_research: candidates.filter((item) => item.status === "ready_for_ean_research")
        .length,
      blocked: candidates.filter((item) => item.status === "blocked").length,
      by_category: Object.fromEntries(
        Object.entries(by_category).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    full_catalog_reconciliation: {
      active_supported: products.length,
      barcode_linked: products.filter((item) => item.has_barcode).length,
      scan_result_ready: products.filter((item) => item.status === "scan_result_ready").length,
      ready_for_ean_research: products.filter((item) => item.status === "ready_for_ean_research")
        .length,
      blocked: products.filter((item) => item.status === "blocked").length,
      by_category: Object.fromEntries(
        Object.entries(full_by_category).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    candidates,
    products,
  }
  return { exported_at: input.exportedAt, ...content, content_fingerprint: fingerprint(content) }
}

async function mapWithConcurrency<T, Result>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(values.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      for (;;) {
        const index = cursor++
        if (index >= values.length) return
        results[index] = await mapper(values[index]!)
      }
    }),
  )
  return results
}

function loadLocalEnv() {
  const cwd = process.cwd()
  const root = cwd.includes(`${sep}.worktrees${sep}`)
    ? cwd.slice(0, cwd.indexOf(`${sep}.worktrees${sep}`))
    : cwd
  for (const path of [join(root, ".env.local"), join(cwd, ".env.local")])
    if (existsSync(path)) loadEnv({ path, override: false })
}
async function readAll(
  client: SupabaseClient,
  table: string,
  columns: string,
  orderBy: string,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`readiness_read_failed:${table}:${error.message}`)
    rows.push(...((data ?? []) as unknown as Row[]))
    if ((data ?? []).length < PAGE_SIZE) return rows
  }
}
async function main() {
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("readiness_credentials_missing")
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [products, identifiers, dispositions] = await Promise.all([
    readAll(client, "products", "id,category_key,is_active,lifecycle_status,image_url", "id"),
    readAll(
      client,
      "product_identifiers",
      "product_id,identifier_type,identifier_value",
      "product_id",
    ),
    readAll(client, "personal_plan_product_search_dispositions", "product_id", "product_id"),
  ])
  const projectRef = new URL(url).hostname.split(".")[0] ?? "unknown"
  const baseline = await buildReadinessBaseline({
    client,
    products,
    identifiers,
    dispositions,
    exportedAt: new Date().toISOString(),
    projectRef,
  })
  const path = join(process.cwd(), OUTPUT_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`)
  process.stdout.write(
    `${JSON.stringify({ path: OUTPUT_PATH, unlinked: baseline.reconciliation, full_catalog: baseline.full_catalog_reconciliation, content_fingerprint: baseline.content_fingerprint })}\n`,
  )
}
if ((process.argv[1] ?? "").endsWith("readiness-export.ts"))
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
