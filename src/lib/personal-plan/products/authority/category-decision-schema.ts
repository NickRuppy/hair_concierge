import { z } from "zod"

import { PRODUCT_FREQUENCIES } from "@/lib/vocabulary/frequencies"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  PLAN_PRODUCT_ROLES,
  type PersonalPlanCategory,
} from "../contracts"
import { CATEGORY_ROLE_POLICIES } from "../authorities"

const role = z.enum(PLAN_PRODUCT_ROLES)
const productFrequency = z.enum(PRODUCT_FREQUENCIES)
const tier = z.enum(["basis", "optional", "not_needed"])
const includedTier = z.enum(["basis", "optional"])
const careWeight = z.enum(["light", "medium", "rich"])
const careDirection = z.enum(["moisture", "balanced", "protein"])
const repairSupport = z.enum(["low", "medium", "high"])
const priority = z.union([z.literal(1), z.literal(2), z.literal(3)])
const ownership = z.enum(["primary", "supporting", "required"])

const reasonSchema = z
  .object({
    id: z.string().min(1),
    salience: z.enum(["primary", "secondary", "detail"]),
    evidence: z.array(
      z
        .object({
          source: z.enum(["quiz", "post_plan_onboarding", "assessment"]),
          key: z.string().min(1),
        })
        .strict(),
    ),
    values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  })
  .strict()

const functionalNeed = <T extends [string, ...string[]]>(values: T, key: "need" | "function") =>
  z
    .object({
      [key]: z.enum(values),
      priority,
      ownership,
    })
    .strict()

const benefitSchema = z
  .object({
    benefit: z.enum(["shine", "smoothing_frizz_control", "slip_manageability"]),
    priority,
    ownership,
  })
  .strict()

const targetSchema = z.discriminatedUnion("category", [
  z
    .object({
      category: z.literal("shampoo"),
      roles: z.array(z.enum(["shampoo_everyday", "shampoo_dandruff"])),
      scalpRoute: z.enum(["oily", "balanced", "dry"]),
      everydayConstraint: z.enum([
        "standard",
        "gentle_dry_scalp",
        "irritation_compatible",
        "gentle_dry_scalp_and_irritation_compatible",
      ]),
      requiresTargetedDandruffCapability: z.boolean(),
    })
    .strict(),
  z
    .object({
      category: z.literal("conditioner"),
      roles: z.array(z.literal("conditioner_rinse_out")),
      weight: careWeight,
      careDirection,
      repairSupportLevel: repairSupport,
      functionalNeeds: z.array(
        functionalNeed(
          [
            "volume_support",
            "frizz_smoothing",
            "shine",
            "detangling_slip",
            "definition_support",
            "color_protection",
          ],
          "need",
        ),
      ),
    })
    .strict(),
  z
    .object({
      category: z.literal("leave_in"),
      roles: z.array(z.enum(["post_wash_leave_in", "pre_heat_application"])),
      weight: careWeight,
      careDirection,
      repairSupportLevel: repairSupport,
      functions: z.array(
        functionalNeed(
          [
            "detangle",
            "moisture_softness",
            "smooth_anti_frizz",
            "heat_protect",
            "repair_support",
            "curl_shape_support",
            "shine_support",
          ],
          "function",
        ),
      ),
      conditionerReplacementEligible: z.boolean(),
    })
    .strict(),
  z
    .object({
      category: z.literal("mask"),
      roles: z.array(z.literal("intensive_conditioning_mask")),
      needStrength: z.enum(["standard", "high"]).nullable(),
      weight: careWeight,
      careDirection,
      repairSupportLevel: repairSupport,
      functionalNeeds: z.array(
        functionalNeed(["smoothing_frizz_control", "detangling_slip", "shine"], "need"),
      ),
    })
    .strict(),
  z
    .object({
      category: z.literal("oil"),
      roles: z.array(
        z.enum(["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"]),
      ),
      roleTargets: z.array(
        z
          .object({
            role: z.enum(["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"]),
            tier: includedTier,
            weight: careWeight.nullable(),
            functionalBenefits: z.array(benefitSchema),
          })
          .strict(),
      ),
    })
    .strict(),
  z
    .object({
      category: z.literal("deep_cleansing_shampoo"),
      roles: z.array(z.enum(["residue_reset", "mineral_reset"])),
    })
    .strict(),
  z
    .object({
      category: z.literal("dry_shampoo"),
      roles: z.array(z.literal("root_refresh_bridge")),
      cadenceAdjustment: z.enum(["keep", "decrease_frequency"]),
    })
    .strict(),
  z
    .object({
      category: z.literal("heat_protectant"),
      roles: z.array(z.literal("pre_heat_protection")),
      qualifyingRoutes: z.array(z.enum(["airflow_shaping", "direct_contact_heat"])),
      carrierPolicy: z.literal("integrated_or_separate_verified_binary_capability"),
    })
    .strict(),
  z
    .object({
      category: z.literal("bondbuilder"),
      roles: z.array(z.literal("specialized_bond_treatment")),
      requiredFunction: z.literal("support_stressed_hair_resilience"),
      mechanismTarget: z.literal("mechanism_neutral"),
    })
    .strict(),
  z
    .object({
      category: z.literal("scalp_care"),
      roles: z.array(
        z.enum([
          "scalp_comfort",
          "scalp_flake_oil_adjunct",
          "density_claim_tonic",
          "scalp_exfoliant",
        ]),
      ),
      roleTargets: z.array(
        z
          .object({
            role: z.enum([
              "scalp_comfort",
              "scalp_flake_oil_adjunct",
              "density_claim_tonic",
              "scalp_exfoliant",
            ]),
            coverage: ownership,
            evidenceLevel: z.literal("limited_evidence").optional(),
          })
          .strict(),
      ),
    })
    .strict(),
])

const frequencySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("wet_wash_total"),
      mode: z.enum(["quiz_starting_target", "retained_current", "nearest_boundary"]),
      target: productFrequency,
      allowedRange: z.object({ min: productFrequency, max: productFrequency }).strict(),
      specialWashSubstitution: z.literal(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("after_each_eligible_wash"),
      roles: z.array(z.enum(["conditioner_rinse_out", "post_wash_leave_in"])),
      dependsOn: z.literal("wet_wash_total"),
      placementState: z.enum(["known_after_refined_wash_cadence", "known"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("event_based"),
      role: z.enum(["pre_heat_protection", "pre_heat_application"]),
      eventRoutes: z.array(z.enum(["airflow_shaping", "direct_contact_heat"])),
      occurrence: z.literal("before_every_qualifying_event"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("every_nth_wash"),
      roles: z.array(z.enum(["residue_reset", "mineral_reset"])),
      every: z.union([z.literal(3), z.literal(4)]),
      substitutesRegularShampoo: z.literal(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unscheduled_as_needed"),
      roles: z.array(
        z.enum([
          "residue_reset",
          "root_refresh_bridge",
          "intensive_conditioning_mask",
          "scalp_comfort",
          "scalp_exfoliant",
        ]),
      ),
      boundary: z.enum([
        "bei_bedarf",
        "between_washes_max_twice_before_next_wash",
        "optional_intensive_care_template",
        "according_to_product_protocol",
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("mask_regular_interval"),
      role: z.literal("intensive_conditioning_mask"),
      needStrength: z.enum(["standard", "high"]),
      baseInterval: z.enum(["weekly_1x", "biweekly_1x", "every_3_weeks"]),
      placementState: z.enum(["blocked_until_wash_frequency_known", "placed_on_eligible_wash"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("role_based_wash_linked"),
      roleFrequencies: z.array(
        z
          .object({
            role: z.enum(["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"]),
            tier: includedTier,
            cadence: z.enum([
              "before_every_compatible_wash",
              "after_every_compatible_wash",
              "finish_after_every_compatible_wash",
              "optional_allocation_deferred_to_day_type",
            ]),
          })
          .strict(),
      ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("product_protocol_course"),
      role: z.literal("specialized_bond_treatment"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("role_keyed_product_protocol"),
      roleFrequencies: z.array(
        z
          .object({
            role: z.enum([
              "scalp_comfort",
              "scalp_flake_oil_adjunct",
              "density_claim_tonic",
              "scalp_exfoliant",
            ]),
            cadence: z.enum([
              "as_needed_according_to_product",
              "regular_according_to_product",
              "occasional_according_to_product",
            ]),
          })
          .strict(),
      ),
    })
    .strict(),
])

const decisionSchema = z
  .object({
    category: z.enum(PERSONAL_PLAN_PRODUCT_CATEGORIES),
    resolution: z.enum(["resolved", "partially_resolved", "deferred_until_post_plan_onboarding"]),
    needTier: tier.nullable(),
    roles: z.array(role),
    target: targetSchema.nullable(),
    frequency: frequencySchema.nullable(),
    reasons: z.array(reasonSchema),
    executionState: z.enum(["available", "paused"]),
    executionPauseReason: reasonSchema.nullable(),
    deferredFacts: z.array(
      z.enum([
        "shampoo_frequency",
        "current_product_load",
        "heat_tool_use",
        "dry_shampoo_bridge_preference",
        "scalp_irritation_detail",
      ]),
    ),
  })
  .strict()
  .superRefine((decision, context) => {
    const category = decision.category as PersonalPlanCategory
    const allowedRoles = new Set<string>(CATEGORY_ROLE_POLICIES[category].allowedRoles)
    if (decision.roles.some((candidate) => !allowedRoles.has(candidate))) {
      context.addIssue({ code: "custom", message: "role is not allowed for category" })
    }
    if (!hasUniqueValues(decision.roles)) {
      context.addIssue({ code: "custom", message: "decision roles must be unique" })
    }
    if (decision.target) {
      if (decision.target.category !== category) {
        context.addIssue({ code: "custom", message: "target category does not match decision" })
      }
      if (
        !hasUniqueValues(decision.target.roles) ||
        !sameValueSet(decision.roles, decision.target.roles)
      ) {
        context.addIssue({ code: "custom", message: "target roles do not match decision" })
      }
      if ("roleTargets" in decision.target) {
        const targetRoles = decision.target.roleTargets.map((item) => item.role)
        if (!hasUniqueValues(targetRoles) || !sameValueSet(decision.target.roles, targetRoles)) {
          context.addIssue({ code: "custom", message: "role targets do not match target roles" })
        }
      }
    }
    if (decision.frequency) {
      const roles = frequencyRoles(decision.frequency)
      const decisionRoles = new Set<string>(decision.roles)
      if (
        !hasUniqueValues(roles) ||
        roles.some((frequencyRole) => !decisionRoles.has(frequencyRole))
      ) {
        context.addIssue({ code: "custom", message: "frequency roles do not match decision roles" })
      }
    }
    if ((decision.executionState === "paused") !== (decision.executionPauseReason !== null)) {
      context.addIssue({ code: "custom", message: "pause reason does not match execution state" })
    }
  })

export function isValidPersistedCategoryDecision(value: unknown): boolean {
  return decisionSchema.safeParse(value).success
}

function frequencyRoles(frequency: z.infer<typeof frequencySchema>): string[] {
  if ("roles" in frequency) return frequency.roles
  if ("role" in frequency) return [frequency.role]
  if ("roleFrequencies" in frequency) return frequency.roleFrequencies.map((item) => item.role)
  return []
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function sameValueSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value))
}
