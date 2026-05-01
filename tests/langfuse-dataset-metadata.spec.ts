import assert from "node:assert/strict"
import test from "node:test"

import { mapProductionTraceCandidateFromRow } from "../scripts/langfuse/shared"

test("maps Trace Schema V2 metadata for production dataset review", () => {
  const selectedProduct = {
    id: "product-1",
    name: "Leichter Conditioner",
    brand: "Testbrand",
    category: "conditioner",
    score: 0.82,
    recommendation_meta: {
      category: "conditioner",
      score: 0.82,
      matched_weight: "light",
      matched_profile: {
        thickness: "fine",
      },
    },
  }
  const leaveInProduct = {
    id: "product-2",
    name: "Leave-in Spray",
    brand: "Testbrand",
    category: "leave_in",
    score: 0.76,
    recommendation_meta: {
      category: "leave_in",
      score: 0.76,
      need_bucket: "frizz_control",
      styling_context: "heat_style",
      conditioner_relationship: "booster_only",
      product_format: "spray",
      heat_protection_need: "high",
      styling_prep_need: "smooth_control",
      provides_heat_protection: true,
      matched_profile: {
        hair_texture: "wavy",
        thickness: "fine",
      },
    },
  }

  const candidate = mapProductionTraceCandidateFromRow(
    {
      assistant_message_id: "message-2",
      langfuse_trace_id: "trace-1",
      created_at: "2026-04-30T10:00:00.000Z",
      trace: {
        trace_version: 2,
        conversation_id: "conversation-1",
        user_message: "Welche Spuelung passt?",
        intent: "product_recommendation",
        product_category: "conditioner",
        router_decision: {
          retrieval_mode: "hybrid",
          response_mode: "answer_direct",
        },
        prompt_refs: {
          synthesis: {
            version: 12,
            label: "production",
            is_fallback: false,
          },
        },
        prompt: {
          kind: "response_plan_render",
        },
        response_composition: {
          path: "response_plan",
        },
        decision_context: {
          engine_trace: {
            damage: {
              overallLevel: "moderate",
              repairPriority: "medium",
            },
            categories: {
              conditioner: {
                relevant: true,
                action: "add",
                planReasonCodes: ["dry_lengths", "fine_hair"],
                targetProfile: {
                  weight: "light",
                  balance: "moisture",
                },
              },
              oil: {
                relevant: false,
                action: null,
                planReasonCodes: [],
                targetProfile: null,
              },
            },
          },
          matched_products: [selectedProduct, leaveInProduct],
        },
        response: {
          assistant_content: "Ich wuerde eine leichte Spuelung nehmen.",
        },
        user_feedback: {
          failure_bucket: "product_fit_mismatch",
        },
      },
    },
    -1,
  )

  assert.ok(candidate)
  assert.equal(candidate.langfuseTraceId, "trace-1")
  assert.equal(candidate.feedbackScore, -1)
  assert.equal(candidate.traceVersion, 2)
  assert.equal(candidate.responseCompositionPath, "response_plan")
  assert.equal(candidate.promptKind, "response_plan_render")
  assert.equal(candidate.engineDamageLevel, "moderate")
  assert.equal(candidate.engineRepairPriority, "medium")
  assert.deepEqual(candidate.selectedProducts, [
    {
      id: "product-1",
      name: "Leichter Conditioner",
      brand: "Testbrand",
      category: "conditioner",
      score: 0.82,
      recommendation_meta: {
        category: "conditioner",
        score: 0.82,
        fit_status: null,
        matched_concern_code: null,
        matched_scalp_route: null,
        cleansing_intensity: null,
        matched_bucket: null,
        matched_weight: "light",
        matched_repair_level: null,
        matched_balance_need: null,
        need_bucket: null,
        styling_context: null,
        conditioner_relationship: null,
        product_format: null,
        heat_protection_need: null,
        styling_prep_need: null,
        provides_heat_protection: null,
        product_weight: null,
        product_repair_level: null,
        product_balance_direction: null,
        matched_subtype: null,
        use_mode: null,
        purpose_fit: null,
        adjunct_scalp_support: null,
        scalp_caution: null,
        density_weight_caution: null,
        overload_caution: null,
        mask_type: null,
        need_strength: null,
        role: null,
        product_concentration: null,
        matched_intensity: null,
        application_mode: null,
        scalp_type_focus: null,
        reset_need_level: null,
        peeling_type: null,
      },
    },
    {
      id: "product-2",
      name: "Leave-in Spray",
      brand: "Testbrand",
      category: "leave_in",
      score: 0.76,
      recommendation_meta: {
        category: "leave_in",
        score: 0.76,
        fit_status: null,
        matched_concern_code: null,
        matched_scalp_route: null,
        cleansing_intensity: null,
        matched_bucket: null,
        matched_weight: null,
        matched_repair_level: null,
        matched_balance_need: null,
        need_bucket: "frizz_control",
        styling_context: "heat_style",
        conditioner_relationship: "booster_only",
        product_format: "spray",
        heat_protection_need: "high",
        styling_prep_need: "smooth_control",
        provides_heat_protection: true,
        product_weight: null,
        product_repair_level: null,
        product_balance_direction: null,
        matched_subtype: null,
        use_mode: null,
        purpose_fit: null,
        adjunct_scalp_support: null,
        scalp_caution: null,
        density_weight_caution: null,
        overload_caution: null,
        mask_type: null,
        need_strength: null,
        role: null,
        product_concentration: null,
        matched_intensity: null,
        application_mode: null,
        scalp_type_focus: null,
        reset_need_level: null,
        peeling_type: null,
      },
    },
  ])
  assert.equal(candidate.failureBucket, "product_fit_mismatch")
  assert.deepEqual(candidate.engineActions, {
    conditioner: {
      relevant: true,
      action: "add",
      reason_codes: ["dry_lengths", "fine_hair"],
      has_target_profile: true,
    },
    oil: {
      relevant: false,
      action: null,
      reason_codes: [],
      has_target_profile: false,
    },
  })
})

test("keeps legacy production traces null-safe", () => {
  const candidate = mapProductionTraceCandidateFromRow(
    {
      langfuse_trace_id: "trace-legacy",
      created_at: "2026-04-29T10:00:00.000Z",
      trace: {
        conversation_id: "conversation-legacy",
        user_message: "Hilf mir mit Frizz.",
        router_decision: {
          needs_clarification: true,
        },
        response: {
          assistant_content: "Welche Haarstruktur hast du?",
        },
      },
    },
    null,
  )

  assert.ok(candidate)
  assert.equal(candidate.responseMode, "clarify_only")
  assert.equal(candidate.needsClarification, true)
  assert.equal(candidate.traceVersion, null)
  assert.equal(candidate.responseCompositionPath, null)
  assert.equal(candidate.promptKind, null)
  assert.equal(candidate.engineDamageLevel, null)
  assert.equal(candidate.engineRepairPriority, null)
  assert.equal(candidate.engineActions, null)
  assert.deepEqual(candidate.selectedProducts, [])
  assert.equal(candidate.failureBucket, null)
})
