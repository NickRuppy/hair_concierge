import type { PersonalPlanCategory, Stage3SemanticRole } from "./contracts"

export type Stage3CatalogSupport = "live_catalog" | "fixture_only"
export type Stage3RoleMultiplicity = "single_product_per_role" | "multiple_products_per_role"

export type Stage3CategoryAuthorityStub = {
  category: PersonalPlanCategory
  authorityVersion: string
  allowsMultiple: boolean
  catalogSupport: Stage3CatalogSupport
  requiredRoles: Stage3SemanticRole[]
  roleMultiplicity: Partial<Record<Stage3SemanticRole, Stage3RoleMultiplicity>>
}

export const CATEGORY_AUTHORITY_STUBS = {
  shampoo: {
    category: "shampoo",
    authorityVersion: "stage3.fixture.shampoo.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["shampoo_primary"],
    roleMultiplicity: { shampoo_primary: "single_product_per_role" },
  },
  conditioner: {
    category: "conditioner",
    authorityVersion: "stage3.fixture.conditioner.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["category_coverage"],
    roleMultiplicity: { category_coverage: "multiple_products_per_role" },
  },
  leave_in: {
    category: "leave_in",
    authorityVersion: "stage3.fixture.leave_in.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["category_primary"],
    roleMultiplicity: { category_primary: "single_product_per_role" },
  },
  heat_protectant: {
    category: "heat_protectant",
    authorityVersion: "stage3.fixture.heat_protectant.v1",
    allowsMultiple: true,
    catalogSupport: "fixture_only",
    requiredRoles: ["heat_protection_hot_tools"],
    roleMultiplicity: { heat_protection_hot_tools: "single_product_per_role" },
  },
  oil: {
    category: "oil",
    authorityVersion: "stage3.fixture.oil.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"],
    roleMultiplicity: {
      prewash_lengths: "single_product_per_role",
      damp_leave_on: "single_product_per_role",
      dry_finish: "single_product_per_role",
      scalp: "single_product_per_role",
    },
  },
  mask: {
    category: "mask",
    authorityVersion: "stage3.fixture.mask.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["category_primary"],
    roleMultiplicity: { category_primary: "single_product_per_role" },
  },
  scalp_care: {
    category: "scalp_care",
    authorityVersion: "stage3.fixture.scalp_care.v1",
    allowsMultiple: true,
    catalogSupport: "fixture_only",
    requiredRoles: ["scalp_care_soothing"],
    roleMultiplicity: { scalp_care_soothing: "single_product_per_role" },
  },
  dry_shampoo: {
    category: "dry_shampoo",
    authorityVersion: "stage3.fixture.dry_shampoo.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["category_primary"],
    roleMultiplicity: { category_primary: "single_product_per_role" },
  },
  bondbuilder: {
    category: "bondbuilder",
    authorityVersion: "stage3.fixture.bondbuilder.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["category_primary"],
    roleMultiplicity: { category_primary: "single_product_per_role" },
  },
  deep_cleansing_shampoo: {
    category: "deep_cleansing_shampoo",
    authorityVersion: "stage3.fixture.deep_cleansing_shampoo.v1",
    allowsMultiple: true,
    catalogSupport: "live_catalog",
    requiredRoles: ["category_primary"],
    roleMultiplicity: { category_primary: "single_product_per_role" },
  },
} as const satisfies Record<PersonalPlanCategory, Stage3CategoryAuthorityStub>

export function getCategoryAuthority(category: PersonalPlanCategory): Stage3CategoryAuthorityStub {
  return CATEGORY_AUTHORITY_STUBS[category]
}

export function allowsMultipleProductsForRole(
  category: PersonalPlanCategory,
  role: Stage3SemanticRole,
): boolean {
  const roleMultiplicity = CATEGORY_AUTHORITY_STUBS[category].roleMultiplicity as Partial<
    Record<Stage3SemanticRole, Stage3RoleMultiplicity>
  >
  return roleMultiplicity[role] === "multiple_products_per_role"
}
