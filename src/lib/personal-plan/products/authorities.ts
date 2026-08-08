import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { PersonalPlanCategory } from "./contracts"

export type Stage3RoleMultiplicity = "single_product_per_role" | "multiple_products_per_role"

export type CategoryRolePolicy = {
  category: PersonalPlanCategory
  authorityVersion: string
  allowsMultiple: boolean
  allowedRoles: readonly PlanProductRole[]
  roleMultiplicity: Partial<Record<PlanProductRole, Stage3RoleMultiplicity>>
}

const single = "single_product_per_role" as const

export const CATEGORY_ROLE_POLICIES = {
  shampoo: {
    category: "shampoo",
    authorityVersion: "personal-plan.shampoo.v1",
    allowsMultiple: true,
    allowedRoles: ["shampoo_everyday", "shampoo_dandruff"],
    roleMultiplicity: { shampoo_everyday: single, shampoo_dandruff: single },
  },
  conditioner: {
    category: "conditioner",
    authorityVersion: "personal-plan.conditioner.v1",
    allowsMultiple: true,
    allowedRoles: ["conditioner_rinse_out"],
    roleMultiplicity: { conditioner_rinse_out: "multiple_products_per_role" },
  },
  leave_in: {
    category: "leave_in",
    authorityVersion: "personal-plan.leave-in.v1",
    allowsMultiple: true,
    allowedRoles: ["post_wash_leave_in", "pre_heat_application"],
    roleMultiplicity: { post_wash_leave_in: single, pre_heat_application: single },
  },
  heat_protectant: {
    category: "heat_protectant",
    authorityVersion: "personal-plan.heat-protectant.v1",
    allowsMultiple: true,
    allowedRoles: ["pre_heat_protection"],
    roleMultiplicity: { pre_heat_protection: single },
  },
  oil: {
    category: "oil",
    authorityVersion: "personal-plan.oil.v1",
    allowsMultiple: true,
    allowedRoles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
    roleMultiplicity: {
      pre_wash_fibre_treatment: single,
      leave_on_fibre_conditioning: single,
      dry_finish: single,
    },
  },
  mask: {
    category: "mask",
    authorityVersion: "personal-plan.mask.v1",
    allowsMultiple: true,
    allowedRoles: ["intensive_conditioning_mask"],
    roleMultiplicity: { intensive_conditioning_mask: single },
  },
  scalp_care: {
    category: "scalp_care",
    authorityVersion: "personal-plan.scalp-care.v1",
    allowsMultiple: true,
    allowedRoles: [
      "scalp_comfort",
      "scalp_flake_oil_adjunct",
      "density_claim_tonic",
      "scalp_exfoliant",
    ],
    roleMultiplicity: {
      scalp_comfort: single,
      scalp_flake_oil_adjunct: single,
      density_claim_tonic: single,
      scalp_exfoliant: single,
    },
  },
  dry_shampoo: {
    category: "dry_shampoo",
    authorityVersion: "personal-plan.dry-shampoo.v1",
    allowsMultiple: true,
    allowedRoles: ["root_refresh_bridge"],
    roleMultiplicity: { root_refresh_bridge: single },
  },
  bondbuilder: {
    category: "bondbuilder",
    authorityVersion: "personal-plan.bondbuilder.v1",
    allowsMultiple: true,
    allowedRoles: ["specialized_bond_treatment"],
    roleMultiplicity: { specialized_bond_treatment: single },
  },
  deep_cleansing_shampoo: {
    category: "deep_cleansing_shampoo",
    authorityVersion: "personal-plan.deep-cleansing.v1",
    allowsMultiple: true,
    allowedRoles: ["residue_reset", "mineral_reset"],
    roleMultiplicity: { residue_reset: single, mineral_reset: single },
  },
} as const satisfies Record<PersonalPlanCategory, CategoryRolePolicy>

export function getCategoryRolePolicy(category: PersonalPlanCategory): CategoryRolePolicy {
  return CATEGORY_ROLE_POLICIES[category]
}

export function roleAllowedForCategory(
  category: PersonalPlanCategory,
  role: PlanProductRole,
): boolean {
  return CATEGORY_ROLE_POLICIES[category].allowedRoles.includes(role as never)
}

export function allowsMultipleProductsForRole(
  category: PersonalPlanCategory,
  role: PlanProductRole,
): boolean {
  return (
    (
      CATEGORY_ROLE_POLICIES[category].roleMultiplicity as Partial<
        Record<PlanProductRole, Stage3RoleMultiplicity>
      >
    )[role] === "multiple_products_per_role"
  )
}
