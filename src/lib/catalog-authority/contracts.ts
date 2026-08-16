import { z } from "zod"

import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  personalPlanCategorySchema,
  type PersonalPlanCategory,
} from "@/lib/personal-plan/products/contracts"

export const CATALOG_AUTHORITY_SCHEMA_VERSION = 1 as const
export { PERSONAL_PLAN_PRODUCT_CATEGORIES }
export type { PersonalPlanCategory }

export const CATALOG_AUTHORITY_AUDIT_ISSUE_CODES = [
  "category_missing_or_invalid",
  "origin_invalid",
  "category_fact_product_mismatch",
  "required_spec_missing",
  "singleton_spec_duplicate",
  "contextual_matrix_empty",
  "contextual_matrix_incomplete",
  "legacy_category_divergence",
  "legacy_thickness_divergence",
  "legacy_concern_divergence",
  "required_protocol_missing",
  "exact_protocol_category_mismatch",
  "exact_protocol_scope_mismatch",
  "overlapping_product_guidance_authority",
  "overlapping_category_fact_authority",
  "provenance_missing",
  "publication_state_conflict",
  "publication_incomplete",
  "orphan_authority_row",
  "required_index_or_constraint_missing",
  "schema_inspection_missing",
] as const

export type CatalogAuthorityAuditIssueCode = (typeof CATALOG_AUTHORITY_AUDIT_ISSUE_CODES)[number]

export const catalogAuthorityOriginSchema = z.enum(["curated", "user_submitted"])
export type CatalogAuthorityOrigin = z.infer<typeof catalogAuthorityOriginSchema>

export const catalogAuditProductSchema = z.object({
  productId: z.string().uuid(),
  origin: z.string().min(1),
  categoryKey: personalPlanCategorySchema.nullable(),
  legacyCategory: z.string().nullable(),
  isActive: z.boolean(),
  lifecycleStatus: z.string().nullable(),
  recommendable: z.boolean(),
  suitableThicknesses: z.array(z.string()),
  suitableConcerns: z.array(z.string()),
  canonicalThicknesses: z.array(z.string()).nullable(),
  canonicalConcerns: z.array(z.string()).nullable(),
  requiredRoles: z.array(z.string()),
  dispositioned: z.boolean(),
  superseded: z.boolean().default(false),
})
export type CatalogAuditProduct = z.infer<typeof catalogAuditProductSchema>

export const catalogAuditFactRowSchema = z.object({
  table: z.string().min(1),
  productId: z.string().uuid(),
  expectedCategory: personalPlanCategorySchema,
  complete: z.boolean(),
  contextualKey: z.string().nullable(),
  thickness: z.string().nullable(),
  weight: z.string().nullable().optional(),
  conditionerRelationship: z.string().nullable().optional(),
  careBenefits: z.array(z.string()).nullable().optional(),
})
export type CatalogAuditFactRow = z.infer<typeof catalogAuditFactRowSchema>

export const catalogAuditProtocolRowSchema = z.object({
  productId: z.string().uuid(),
  category: z.string().nullable(),
  role: z.string().nullable(),
  scopeKind: z.string().nullable(),
  scopeProductId: z.string().nullable(),
  scopeCategory: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceText: z.string().nullable(),
  evidenceSourceUrls: z.array(z.string()),
  v1SchemaValid: z.boolean(),
  v2Complete: z.boolean(),
})
export type CatalogAuditProtocolRow = z.infer<typeof catalogAuditProtocolRowSchema>

export const catalogAuditGuidanceRowSchema = z.object({
  id: z.string(),
  scopeKind: z.string(),
  productId: z.string().uuid().nullable(),
  categoryKey: z.string(),
  roleKey: z.string().nullable(),
  status: z.string(),
})
export type CatalogAuditGuidanceRow = z.infer<typeof catalogAuditGuidanceRowSchema>

export const catalogAuditEvidenceRowSchema = z.object({
  productId: z.string().uuid(),
  factKey: z.string(),
  sourceUrl: z.string().nullable(),
  contentFingerprint: z.string().nullable(),
})
export type CatalogAuditEvidenceRow = z.infer<typeof catalogAuditEvidenceRowSchema>

export const catalogAuditSchemaObjectSchema = z.object({
  kind: z.enum(["constraint", "index"]),
  name: z.string(),
  valid: z.boolean(),
  definition: z.string().nullable(),
})
export type CatalogAuditSchemaObject = z.infer<typeof catalogAuditSchemaObjectSchema>

export const catalogAuthorityAuditSnapshotSchema = z.object({
  schemaVersion: z.literal(CATALOG_AUTHORITY_SCHEMA_VERSION),
  inspectedAt: z.string(),
  products: z.array(catalogAuditProductSchema),
  facts: z.array(catalogAuditFactRowSchema),
  protocols: z.array(catalogAuditProtocolRowSchema),
  guidance: z.array(catalogAuditGuidanceRowSchema),
  evidence: z.array(catalogAuditEvidenceRowSchema),
  rowCounts: z.record(z.string(), z.number().int().nonnegative()),
  schemaObjects: z.array(catalogAuditSchemaObjectSchema).nullable(),
})
export type CatalogAuthorityAuditSnapshot = z.infer<typeof catalogAuthorityAuditSnapshotSchema>

export type CatalogAuthorityAuditIssue = {
  code: CatalogAuthorityAuditIssueCode
  productId: string | null
  category: PersonalPlanCategory | null
  relation: string | null
  detail: string
}

export type CatalogAuthorityAuditReceipt = {
  schemaVersion: typeof CATALOG_AUTHORITY_SCHEMA_VERSION
  mode: "read_only"
  inspectedAt: string
  productCount: number
  countsByCategory: Partial<Record<PersonalPlanCategory, number>>
  countsByRelation: Record<string, number>
  issueCounts: Partial<Record<CatalogAuthorityAuditIssueCode, number>>
  issues: CatalogAuthorityAuditIssue[]
  clean: boolean
}

const CATALOG_AUTHORITY_CATEGORY_IDENTITY_TABLES = [
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_leave_in_specs",
  "product_leave_in_eligibility",
  "product_heat_protectant_specs",
  "product_oil_specs",
  "product_oil_eligibility",
  "product_mask_specs",
  "product_scalp_care_specs",
  "product_dry_shampoo_specs",
  "product_bondbuilder_specs",
  "product_deep_cleansing_shampoo_specs",
  "product_application_protocols",
] as const

export const CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS = [
  "products_origin_check",
  "products_category_key_fkey",
  "products_id_category_key_key",
  "products_category_key_not_null_check",
  "products_recommendable_requires_active_check",
  "product_thickness_eligibility_product_category_fkey",
  "product_concern_eligibility_product_category_fkey",
  "product_shampoo_specs_thickness_eligibility_fkey",
  "product_conditioner_specs_thickness_eligibility_fkey",
  "product_leave_in_eligibility_thickness_eligibility_fkey",
  "product_oil_eligibility_thickness_eligibility_fkey",
  ...CATALOG_AUTHORITY_CATEGORY_IDENTITY_TABLES.map((table) => `${table}_product_category_fkey`),
  ...CATALOG_AUTHORITY_CATEGORY_IDENTITY_TABLES.map((table) => `${table}_product_category_idx`),
] as const

// Task 2 installs the composite identity constraints as NOT VALID so they
// protect new writes before historical repair. Task 3 promotes them here once
// the audited backfill is clean and the constraints are validated.
export const CATALOG_AUTHORITY_REQUIRED_VALIDATED_SCHEMA_OBJECTS = [
  "products_origin_check",
  "products_category_key_fkey",
  "products_id_category_key_key",
  ...CATALOG_AUTHORITY_CATEGORY_IDENTITY_TABLES.map((table) => `${table}_product_category_fkey`),
  ...CATALOG_AUTHORITY_CATEGORY_IDENTITY_TABLES.map((table) => `${table}_product_category_idx`),
] as const

export const CATALOG_AUTHORITY_FORBIDDEN_SCHEMA_OBJECTS =
  CATALOG_AUTHORITY_CATEGORY_IDENTITY_TABLES.map((table) => `${table}_product_id_fkey`)
