import { createHash } from "node:crypto"
import { z } from "zod"
import {
  bondbuilderResearchProfileSchema,
  type BondbuilderResearchProfile,
} from "../bondbuilder-research/contracts"
import { BOND_OWNER_REGISTRY } from "../bondbuilder-research/registry"
import {
  projectBondbuilderForProduction,
  validateBondbuilderResearchProfile,
} from "../bondbuilder-research/production-adapter"
import { canonicalizeGtin } from "../product-identity/normalize"

const text = z.string().min(1)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const https = z
  .string()
  .url()
  .regex(/^https:\/\//)
export const BOND_CATALOGUE_ASSET_BASE =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"

/** Staged internal catalogue rows only. No publication/fit/owner-submission authority. */
export const bondbuilderInternalAdmissionSchema = z
  .object({
    version: z.literal("bondbuilder-internal-admission-v1"),
    product: z
      .object({
        canonical_brand: text,
        product_line: text.nullable(),
        clean_name: text,
        affiliate_link: https,
        image_url: https,
        canonical_image_sha256: hash,
        thumbnail_image_url: https,
        price_eur: z.number().positive().max(99999999.99),
        currency: z.literal("EUR"),
        purchase_link_status: z.literal("available"),
        purchase_link_checked_at: z.iso.datetime({ offset: true }),
        price_checked_at: z.iso.datetime({ offset: true }),
        net_content_value: z.number().positive().nullable(),
        net_content_unit: z.enum(["ml", "g"]).nullable(),
      })
      .strict(),
    identifiers: z
      .array(
        z
          .object({
            type: z.enum(["gtin", "retailer_url", "manufacturer_sku"]),
            value: text,
            source: text,
          })
          .strict(),
      )
      .min(1)
      .max(20),
    category_specs: z
      .object({
        product_bondbuilder_specs: z
          .object({
            technology_family: z.enum([
              "sulfur_targeting_dimaleate",
              "designed_peptide",
              "maleate_ester",
              "acid_calcium_management",
              "gluconamide_gluconate",
            ]),
            claim_trust_level: z.enum(["low", "medium", "high"]),
            trust_basis: z.enum(["owner_anchor", "owner_calibration", "owner_default"]),
            research_profile: bondbuilderResearchProfileSchema,
            application_mode: z
              .enum(["pre_shampoo", "post_wash_leave_in", "bedtime_leave_in"])
              .optional(),
            treatment_mode: z.enum(["rinse_out", "leave_in"]).optional(),
            product_format: z.enum(["cream_treatment", "spray_treatment"]).optional(),
          })
          .strict(),
      })
      .strict(),
    image: z
      .object({
        source_page_url: https,
        source_image_url: https.nullable(),
        source_type: z.enum(["brand", "retailer"]),
        processing_method: z.enum(["local", "third_party", "manual"]),
      })
      .strict(),
    review: z
      .object({
        reviewed_by: z.literal("nick"),
        package_sha256: hash,
        profile_sha256: hash,
        image_sha256: hash,
        thumbnail_sha256: hash,
      })
      .strict(),
  })
  .strict()
export type BondbuilderInternalAdmissionRequest = z.infer<typeof bondbuilderInternalAdmissionSchema>

/** SQL stores the same strict shape; semantic/source/owner checks remain independent. */
export function bondbuilderInternalAdmissionJsonSchema() {
  return z.toJSONSchema(bondbuilderInternalAdmissionSchema)
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    )
  return value
}
export function bondbuilderInternalAdmissionSha256(
  request: BondbuilderInternalAdmissionRequest,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(request)))
    .digest("hex")
}

/** Exact source spelling stays immutable. Only the two approved pilot presentations map. */
export function bondbuilderCatalogueIdentityMatches(
  profile: BondbuilderResearchProfile,
  name: string,
  brand: string,
): boolean {
  if (profile.identity.product_name === name && profile.identity.brand === brand) return true
  const alias =
    profile.identity.research_key === "P03"
      ? { brand: "Epres", name: "Epres Bond Repair Treatment" }
      : profile.identity.research_key === "P04"
        ? {
            brand: "L'Oréal Paris",
            name: "L'Oréal Paris Elvital Bond Repair Plus Keratin-Festigendes Pre-Shampoo",
          }
        : null
  if (!alias || name !== alias.name || brand !== alias.brand) return false
  return BOND_OWNER_REGISTRY.some(
    (r) =>
      r.research_key === profile.identity.research_key &&
      r.product_name === profile.identity.product_name &&
      r.brand === profile.identity.brand &&
      r.market === profile.identity.market &&
      r.size === profile.identity.size &&
      r.source_version === profile.identity.source_version &&
      r.raw_sha256 === profile.formula.raw_sha256 &&
      r.normalized_sha256 === profile.formula.normalized_sha256 &&
      profile.formula.source_ids.some((id) =>
        profile.sources.some((s) => s.id === id && s.url === r.source_url),
      ),
  )
}

export function validateBondbuilderInternalAdmission(
  input: unknown,
):
  | { success: true; request: BondbuilderInternalAdmissionRequest }
  | { success: false; errors: string[] } {
  const parsed = bondbuilderInternalAdmissionSchema.safeParse(input)
  if (!parsed.success)
    return {
      success: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    }
  const request = parsed.data,
    errors: string[] = [],
    p = request.product
  const spec = request.category_specs.product_bondbuilder_specs,
    profile = spec.research_profile
  const valid = validateBondbuilderResearchProfile(profile)
  if (!valid.success) errors.push(...valid.errors)
  if (profile.identity.product_id !== null) errors.push("new_admission_requires_unbound_profile")
  const name = [p.canonical_brand, p.product_line, p.clean_name].filter((v) => v !== null).join(" ")
  if (!bondbuilderCatalogueIdentityMatches(profile, name, p.canonical_brand))
    errors.push("catalogue_identity_mismatch")
  if ([p.canonical_brand, p.product_line, p.clean_name].some((v) => v !== null && v.trim() !== v))
    errors.push("untrimmed_catalogue_identity")
  const projection = projectBondbuilderForProduction({
    version: "bondbuilder-research-envelope-v1",
    submission_id: null,
    profile,
  })
  if (
    !projection.productionProjection ||
    JSON.stringify(canonical(spec)) !==
      JSON.stringify(
        canonical(projection.productionProjection.category_specs.product_bondbuilder_specs),
      )
  )
    errors.push("fresh_production_projection_mismatch")
  if (request.review.profile_sha256 !== profile.review.profile_sha256)
    errors.push("profile_approval_mismatch")
  if (request.review.image_sha256 !== p.canonical_image_sha256)
    errors.push("image_approval_mismatch")
  if (
    !p.image_url.startsWith(BOND_CATALOGUE_ASSET_BASE) ||
    !/^[a-zA-Z0-9/_-]+\.webp$/.test(p.image_url.slice(BOND_CATALOGUE_ASSET_BASE.length)) ||
    !p.image_url.endsWith(`-${p.canonical_image_sha256.slice(0, 12)}.webp`)
  )
    errors.push("canonical_image_storage_binding_invalid")
  if (
    p.thumbnail_image_url !==
    `${BOND_CATALOGUE_ASSET_BASE}thumbnails/search-v1/${p.canonical_image_sha256}.webp`
  )
    errors.push("thumbnail_source_hash_mismatch")
  if ((p.net_content_value === null) !== (p.net_content_unit === null))
    errors.push("partial_net_content")
  if (Math.abs(p.price_eur * 100 - Math.round(p.price_eur * 100)) > 1e-6)
    errors.push("price_requires_exact_cents")
  const seen = new Set<string>()
  for (const id of request.identifiers) {
    const canonicalValue = id.type === "gtin" ? canonicalizeGtin(id.value) : id.value
    if (!canonicalValue) errors.push("invalid_gtin")
    const key = `${id.type}:${canonicalValue}`
    if (seen.has(key)) errors.push("duplicate_identifier")
    seen.add(key)
    if (
      id.type === "retailer_url" &&
      !z
        .string()
        .url()
        .regex(/^https:\/\//)
        .safeParse(id.value).success
    )
      errors.push("invalid_retailer_url")
  }
  if (
    profile.identity.gtin !== null &&
    !request.identifiers.some(
      (id) =>
        id.type === "gtin" &&
        canonicalizeGtin(id.value) === canonicalizeGtin(profile.identity.gtin!),
    )
  )
    errors.push("profile_gtin_unbound")
  return errors.length ? { success: false, errors } : { success: true, request }
}
