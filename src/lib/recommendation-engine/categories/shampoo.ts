import {
  deriveScalpTypeBucket,
  deriveShampooBucket,
  type ShampooBucket,
} from "@/lib/shampoo/constants"
import type {
  CategoryFitEvaluation,
  NormalizedProfile,
  InterventionPlan,
  ShampooCategoryDecision,
} from "@/lib/recommendation-engine/types"
import { getPlannedStep } from "@/lib/recommendation-engine/categories/shared"

export interface ShampooFitSpec {
  shampoo_bucket: ShampooBucket | null
  scalp_route: "oily" | "balanced" | "dry" | "dandruff" | "dry_flakes" | "irritated" | null
  cleansing_intensity: "gentle" | "regular" | "clarifying" | null
}

function mapBucketToScalpRoute(
  bucket: ShampooBucket | null,
): ShampooCategoryDecision["targetProfile"] extends infer T
  ? T extends { scalpRoute: infer R }
    ? R
    : never
  : never {
  switch (bucket) {
    case "dehydriert-fettig":
      return "oily"
    case "normal":
      return "balanced"
    case "trocken":
      return "dry"
    case "schuppen":
      return "dandruff"
    case "irritationen":
      return "irritated"
    default:
      return null
  }
}

function deriveCleansingIntensity(
  shampooBucket: ShampooBucket | null,
): ShampooCategoryDecision["targetProfile"] extends infer T
  ? T extends { cleansingIntensity: infer C }
    ? C
    : never
  : never {
  switch (shampooBucket) {
    case "trocken":
    case "irritationen":
      return "gentle"
    case "schuppen":
    case "normal":
    case "dehydriert-fettig":
      return "regular"
    default:
      return null
  }
}

export function buildShampooCategoryDecision(
  profile: NormalizedProfile,
  plan: InterventionPlan,
): ShampooCategoryDecision {
  const step = getPlannedStep(plan, "shampoo")

  if (!step) {
    return {
      category: "shampoo",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.shampoo,
      targetProfile: null,
      notes: [],
    }
  }

  const shampooBucket = deriveShampooBucket(profile.scalpType, profile.scalpCondition)
  const notes: string[] = []

  if (!profile.thickness) {
    notes.push("shampoo_route_needs_thickness_for_matching")
  }

  if (!shampooBucket) {
    notes.push("shampoo_route_needs_scalp_inputs")
  }

  return {
    category: "shampoo",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.shampoo,
    targetProfile: {
      scalpRoute: mapBucketToScalpRoute(shampooBucket),
      shampooBucket,
      secondaryBucket:
        profile.scalpCondition === "dandruff" ? deriveScalpTypeBucket(profile.scalpType) : null,
      cleansingIntensity: deriveCleansingIntensity(shampooBucket),
    },
    notes,
  }
}

export function evaluateShampooFit(
  decision: ShampooCategoryDecision,
  spec: ShampooFitSpec | null,
): CategoryFitEvaluation {
  if (!decision.relevant || !decision.targetProfile) {
    return {
      status: "not_applicable",
      reasonCodes: [],
      missingFields: [],
    }
  }

  const target = decision.targetProfile

  if (!spec) {
    return {
      status: "unknown",
      reasonCodes: ["shampoo_specs_missing"],
      missingFields: ["shampoo_bucket", "scalp_route", "cleansing_intensity"],
    }
  }

  if (spec.shampoo_bucket && spec.shampoo_bucket === target.shampooBucket) {
    if (!target.cleansingIntensity || !spec.cleansing_intensity) {
      return {
        status: "supportive",
        reasonCodes: ["shampoo_bucket_exact_match", "shampoo_cleansing_intensity_missing"],
        missingFields: target.cleansingIntensity ? ["cleansing_intensity"] : [],
      }
    }

    if (target.cleansingIntensity !== spec.cleansing_intensity) {
      return {
        status: "mismatch",
        reasonCodes: ["shampoo_bucket_exact_match", "shampoo_cleansing_intensity_mismatch"],
        missingFields: [],
      }
    }

    return {
      status: "ideal",
      reasonCodes: ["shampoo_bucket_exact_match", "shampoo_cleansing_intensity_exact_match"],
      missingFields: [],
    }
  }

  if (
    spec.shampoo_bucket &&
    target.secondaryBucket &&
    spec.shampoo_bucket === target.secondaryBucket
  ) {
    return {
      status: "supportive",
      reasonCodes: ["shampoo_secondary_bucket_partial_match"],
      missingFields: target.cleansingIntensity ? ["cleansing_intensity"] : [],
    }
  }

  const resolvedRoute = spec.scalp_route ?? mapBucketToScalpRoute(spec.shampoo_bucket)

  if (!target.scalpRoute) {
    return {
      status: "unknown",
      reasonCodes: ["shampoo_target_route_missing"],
      missingFields: ["scalp_route"],
    }
  }

  if (!resolvedRoute) {
    return {
      status: "unknown",
      reasonCodes: ["shampoo_fit_missing_bucket_or_scalp_route"],
      missingFields: ["shampoo_bucket", "scalp_route"],
    }
  }

  if (target.scalpRoute !== resolvedRoute) {
    return {
      status: "mismatch",
      reasonCodes: ["shampoo_scalp_route_mismatch"],
      missingFields: [],
    }
  }

  if (!target.cleansingIntensity || !spec.cleansing_intensity) {
    return {
      status: "supportive",
      reasonCodes: ["shampoo_scalp_route_exact_match", "shampoo_cleansing_intensity_missing"],
      missingFields: target.cleansingIntensity ? ["cleansing_intensity"] : [],
    }
  }

  if (target.cleansingIntensity !== spec.cleansing_intensity) {
    return {
      status: "mismatch",
      reasonCodes: ["shampoo_scalp_route_exact_match", "shampoo_cleansing_intensity_mismatch"],
      missingFields: [],
    }
  }

  return {
    status: "ideal",
    reasonCodes: ["shampoo_scalp_route_exact_match", "shampoo_cleansing_intensity_exact_match"],
    missingFields: [],
  }
}
