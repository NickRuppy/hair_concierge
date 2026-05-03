import { appendAgentCompareJudgmentLog } from "@/lib/agent/compare/judgment-log"
import { GUIDANCE_IDS, SELECTABLE_PRODUCT_CATEGORIES } from "@/lib/agent/contracts"
import type { AgentCompareJudgmentRecord } from "@/lib/agent/compare/types"
import { SUPPORTED_PRODUCT_CLAIM_FIELDS } from "@/lib/agent/tools/select-products"
import {
  ACTIVE_PROFILE_SIGNAL_FIELDS,
  ACTIVE_SIGNAL_SELECTION_EFFECTS,
} from "@/lib/agent/orchestrator/route-packet"
import { NextResponse } from "next/server"
import { z } from "zod"

const selectableProductCategorySchema = z.enum(SELECTABLE_PRODUCT_CATEGORIES)
const guidanceIdSchema = z.enum(GUIDANCE_IDS)
const userJobSchema = z.enum([
  "product_pick",
  "compare_or_decide",
  "routine_structure",
  "troubleshoot",
  "usage",
  "unsupported_or_unclear",
])
const concernSchema = z.enum([
  "oily_roots",
  "dry_lengths",
  "dandruff_or_flakes",
  "irritation",
  "frizz",
])
const routeToolSchema = z.enum(["select_products", "build_or_fix_routine"])
const activeProfileSignalFieldSchema = z.enum(ACTIVE_PROFILE_SIGNAL_FIELDS)
const activeSignalSelectionEffectSchema = z.enum(ACTIVE_SIGNAL_SELECTION_EFFECTS)
const supportedProductClaimFieldSchema = z.enum(SUPPORTED_PRODUCT_CLAIM_FIELDS)
const productResponsePolicySchema = z.enum([
  "recommend",
  "explain_then_recommend",
  "redirect_to_better_lever",
  "caution_without_products",
  "needs_more_info",
  "no_catalog_match",
])

const missingInfoKeySchema = z.enum([
  "thickness",
  "scalp_type",
  "scalp_condition",
  "hair_texture",
  "density",
  "care_signal",
  "styling_signal",
  "oil_purpose",
  "protein_moisture_balance",
  "recommendation_goal",
])

const missingInfoLabelSchema = z.enum([
  "Haardicke",
  "Kopfhaut-Typ",
  "Kopfhaut-Beschwerden",
  "Haarmuster",
  "Haardichte",
  "Pflegebedarf",
  "Styling-Kontext",
  "Oel-Zweck",
  "Protein-/Feuchtigkeitsbalance",
  "Einsatzziel",
])

const unsupportedRequestedSignalSchema = z.object({
  field: z.union([activeProfileSignalFieldSchema, z.literal("ingredient_preference")]),
  value: z.string(),
  reason: z.enum(["no_structured_product_data", "not_a_shampoo_fit_axis", "safety_caution"]),
  user_message: z.string(),
})

const productTraceSchema = z.object({
  category: selectableProductCategorySchema.nullable(),
  decision: z.enum(["recommended", "needs_more_info", "not_recommended", "no_catalog_match"]),
  product_response_policy: productResponsePolicySchema,
  policy_reason: z.string(),
  profile_basis: z.array(z.string()),
  category_guidance: z.string(),
  products: z.array(
    z.object({
      rank: z.number().int(),
      product_id: z.string(),
      name: z.string(),
      brand: z.string().nullable(),
      price_eur: z.number().nullable().default(null),
      currency: z.string().nullable().default(null),
      fit_reason: z.string(),
      caveat: z.string().nullable(),
      supported_claims: z
        .array(
          z.object({
            field: z.union([activeProfileSignalFieldSchema, supportedProductClaimFieldSchema]),
            value: z.string(),
            evidence: z.enum(["product_spec", "category_decision", "profile_match"]),
            label: z.string(),
          }),
        )
        .default([]),
      unsupported_requested_signals: z.array(unsupportedRequestedSignalSchema).default([]),
    }),
  ),
  comparison_facts: z.record(z.string(), z.array(z.string())).nullable(),
  missing_info: z.array(
    z.object({
      key: missingInfoKeySchema,
      label: missingInfoLabelSchema,
      blocking: z.boolean(),
      detail: z.string(),
    }),
  ),
  unsupported_requested_signals: z.array(unsupportedRequestedSignalSchema).default([]),
})

const routeTraceSchema = z.object({
  user_job: userJobSchema,
  product_category: selectableProductCategorySchema.nullable(),
  requested_overlay_ids: z.array(guidanceIdSchema),
  requested_topic_ids: z.array(guidanceIdSchema),
  requested_routine_id: guidanceIdSchema.nullable(),
  concerns: z.array(concernSchema),
  active_profile_signals: z
    .array(
      z.object({
        field: activeProfileSignalFieldSchema,
        value: z.string(),
        source: z.literal("message"),
        selection_effect: activeSignalSelectionEffectSchema,
        evidence: z.string(),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  ambiguity: z.string().nullable(),
  required_playbook_id: guidanceIdSchema.nullable(),
  guidance_ids: z.array(guidanceIdSchema),
  tool_plan: z.array(routeToolSchema),
  routine_objective: z.enum(["build_routine", "fix_routine"]).nullable(),
  validation_warnings: z.array(z.string()),
})

const compareRunResultSchema = z.object({
  system: z.enum(["current", "agent"]),
  answer: z.string(),
  latency_ms: z.number().int().nullable(),
  debug_lines: z.array(z.string()),
  matched_products: z.array(
    z.object({
      name: z.string(),
      category: z.string().nullable(),
    }),
  ),
  product_trace: productTraceSchema.nullable().optional(),
  route_trace: routeTraceSchema.nullable().optional(),
  error: z.string().nullable(),
})

const judgmentRecordSchema = z.object({
  createdAt: z.string().datetime(),
  user: z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    full_name: z.string().nullable(),
  }),
  prompt: z.string().min(1),
  context: z.object({
    user_id: z.string().min(1),
    derived_signals: z.array(z.string()),
    routine_inventory: z.array(
      z.object({
        category: z.string(),
        product_name: z.string().nullable(),
        frequency_range: z.string().nullable(),
      }),
    ),
    relevant_memory: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        content: z.string(),
      }),
    ),
  }),
  results: z.object({
    current: compareRunResultSchema,
    agent: compareRunResultSchema,
  }),
  judgment: z.object({
    winner: z.enum(["current", "agent", "tie"]),
    primary_reason: z.enum([
      "natuerlicher",
      "nuetzlicher",
      "vorsichtiger",
      "personalisierter",
      "anderes",
    ]),
    note: z.string(),
  }),
})

interface JudgmentRouteDeps {
  appendJudgmentLog: (record: AgentCompareJudgmentRecord) => Promise<void>
}

const defaultDeps: JudgmentRouteDeps = {
  appendJudgmentLog: appendAgentCompareJudgmentLog,
}

function createDevOnlyResponse() {
  return NextResponse.json({ error: "Nur lokal in development verfuegbar." }, { status: 404 })
}

export async function handleAgentCompareJudgmentRequest(
  body: unknown,
  deps: JudgmentRouteDeps = defaultDeps,
) {
  if (process.env.NODE_ENV !== "development") {
    return createDevOnlyResponse()
  }

  const parsed = judgmentRecordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltiges Compare-Urteil", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    await deps.appendJudgmentLog(parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Compare-Urteil konnte nicht gespeichert werden.",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungueltiges Compare-Urteil" }, { status: 400 })
  }

  return handleAgentCompareJudgmentRequest(body)
}
