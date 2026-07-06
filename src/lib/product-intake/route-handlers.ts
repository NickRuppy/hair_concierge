import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import { isProductIntakeEnabled } from "@/lib/product-intake/config"
import {
  chatProductIntakeSubmissionSchema,
  type ChatProductIntakeSubmissionInput,
  onboardingProductIntakeCancelSchema,
  onboardingProductIntakeSubmissionSchema,
} from "@/lib/product-intake/schemas"
import type { ProductIntakeSubmissionResult } from "@/lib/product-intake/types"
import {
  cancelProductIntakeUsage,
  ProductIntakeConflictError,
  ProductIntakeOwnershipError,
  submitProductIntake,
  type ProductIntakeRepository,
} from "@/lib/product-intake/submissions"
import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import { ProductIntakeUserInputError } from "@/lib/product-intake/errors"
import {
  loadAgentV2ConversationStateForUser,
  persistConversationStateTransition,
} from "@/lib/chat-runtime/conversation-state-store"
import {
  AGENT_V2_PRODUCTION_ENGINE,
  type AgentV2ConversationStateTransition,
} from "@/lib/agent-v2/production/persisted-session-state"
import {
  buildPrimaryResolvedProductContext,
  mergeActiveProductContexts,
  type AgentV2ActiveProductContext,
} from "@/lib/agent-v2/resolved-product-selection-adapter"

type ProductIntakeRouteSource = "onboarding" | "chat"

type ProductIntakePostHandlerDeps = {
  createServerClient?: typeof createClient
  createAdminClient?: typeof createAdminClient
  isEnabled?: () => boolean
  createRepository?: (admin: ReturnType<typeof createAdminClient>) => ProductIntakeRepository
  loadConversationState?: typeof loadAgentV2ConversationStateForUser
  persistConversationStateTransition?: typeof persistConversationStateTransition
  now?: () => string
}

const DISABLED_RESPONSE = {
  error: "Produktaufnahme ist aktuell deaktiviert.",
  code: "product_intake_disabled",
}

export function createProductIntakePostHandler(
  source: ProductIntakeRouteSource,
  overrides: ProductIntakePostHandlerDeps = {},
) {
  const deps = {
    createServerClient: createClient,
    createAdminClient,
    isEnabled: isProductIntakeEnabled,
    createRepository: createSupabaseProductIntakeRepository,
    loadConversationState: loadAgentV2ConversationStateForUser,
    persistConversationStateTransition,
    now: () => new Date().toISOString(),
    ...overrides,
  }

  return async function productIntakePostHandler(request: Request) {
    if (!deps.isEnabled()) {
      return NextResponse.json(DISABLED_RESPONSE, { status: 503 })
    }

    const supabase = await deps.createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
    }

    const body = await request.json()
    const schema =
      source === "chat"
        ? chatProductIntakeSubmissionSchema
        : onboardingProductIntakeSubmissionSchema
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = deps.createAdminClient()
    const repository = deps.createRepository(admin)

    try {
      const result = await submitProductIntake({
        userId: user.id,
        source,
        input: parsed.data,
        repository,
      })

      if (source === "chat") {
        await persistChatProductIntakeContext({
          admin,
          userId: user.id,
          input: parsed.data as ChatProductIntakeSubmissionInput,
          result,
          loadConversationState: deps.loadConversationState,
          persistConversationStateTransition: deps.persistConversationStateTransition,
          now: deps.now,
        })
        await persistChatProductIntakeOfferSubmission({
          admin,
          userId: user.id,
          input: parsed.data as ChatProductIntakeSubmissionInput,
          result,
        })
      }

      return NextResponse.json(result, { status: result.status === "matched" ? 200 : 202 })
    } catch (error) {
      if (error instanceof ProductIntakeConflictError) {
        return NextResponse.json(
          {
            error: error.message,
            code: "product_category_already_filled",
            category: error.category,
            existing_usage_id: error.existingUsageId,
          },
          { status: 409 },
        )
      }

      if (error instanceof ProductIntakeOwnershipError) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }

      if (error instanceof ProductIntakeUserInputError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        )
      }

      console.error("[product-intake] submission failed", error)
      return NextResponse.json(
        { error: "Produkt konnte nicht gespeichert werden." },
        { status: 500 },
      )
    }
  }
}

type OfferSubmissionMessageRow = {
  id: string
  conversation_id: string
  rag_context: Record<string, unknown> | null
}

async function persistChatProductIntakeOfferSubmission(params: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
  input: ChatProductIntakeSubmissionInput
  result: ProductIntakeSubmissionResult
}): Promise<void> {
  const conversationId = params.input.source_conversation_id ?? null
  const messageId = params.input.source_message_id ?? null
  const offerId = params.input.offer_id ?? null
  if (!conversationId || !messageId || !offerId) return

  const submittedStatus = params.result.status === "matched" ? "matched" : "pending_review"
  const submissionId = params.result.submission?.id ?? null
  if (submittedStatus === "pending_review" && !submissionId) return

  try {
    const { data: conversation } = await params.admin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", params.userId)
      .maybeSingle()
    if (!conversation) return

    const { data } = await params.admin
      .from("messages")
      .select("id, conversation_id, rag_context")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .maybeSingle()
    const message = data as OfferSubmissionMessageRow | null
    if (!message) return

    const rag = (message.rag_context ?? {}) as {
      product_intake_offer?: { id?: string } & Record<string, unknown>
      product_lookup_clarification?: {
        none_action?: { product_intake_offer?: { id?: string } & Record<string, unknown> }
      } & Record<string, unknown>
    }
    const submissionFields = {
      ...(submissionId ? { submission_id: submissionId } : {}),
      submitted_status: submittedStatus,
    }

    let nextRag: Record<string, unknown> | null = null
    if (rag.product_intake_offer?.id === offerId) {
      nextRag = {
        ...rag,
        product_intake_offer: { ...rag.product_intake_offer, ...submissionFields },
      }
    } else if (
      rag.product_lookup_clarification?.none_action?.product_intake_offer?.id === offerId
    ) {
      const clarification = rag.product_lookup_clarification
      nextRag = {
        ...rag,
        product_lookup_clarification: {
          ...clarification,
          none_action: {
            ...clarification.none_action,
            product_intake_offer: {
              ...clarification.none_action?.product_intake_offer,
              ...submissionFields,
            },
          },
        },
      }
    }
    if (!nextRag) return

    const { error } = await params.admin
      .from("messages")
      .update({ rag_context: nextRag })
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
    if (error) {
      console.error("[product-intake] failed to persist offer submission linkage", error)
    }
  } catch (error) {
    console.error("[product-intake] failed to persist offer submission linkage", error)
  }
}

async function persistChatProductIntakeContext(params: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
  input: ChatProductIntakeSubmissionInput
  result: ProductIntakeSubmissionResult
  loadConversationState: typeof loadAgentV2ConversationStateForUser
  persistConversationStateTransition: typeof persistConversationStateTransition
  now: () => string
}) {
  const conversationId = params.input.source_conversation_id ?? null
  if (!conversationId) return

  const activeContext = buildActiveProductContextFromChatSubmission({
    input: params.input,
    result: params.result,
    nowIso: params.now(),
  })
  if (!activeContext) return

  try {
    const previousState = await params.loadConversationState(params.admin, {
      conversationId,
      userId: params.userId,
    })
    const activeProductContexts = mergeActiveProductContexts({
      previous: previousState.agent_v2.active_product_contexts,
      next: [activeContext],
      latestMessageNamesActionableProduct: true,
    })
    const nextState = {
      ...previousState,
      agent_v2: {
        ...previousState.agent_v2,
        active_product_contexts: activeProductContexts,
        active_resolved_product_context: buildPrimaryResolvedProductContext(activeProductContexts),
      },
    }
    const transition: AgentV2ConversationStateTransition = {
      previous_state: previousState,
      next_state: nextState,
      reason: "product_intake_submission_context",
      changed_fields: [
        "agent_v2.active_product_contexts",
        "agent_v2.active_resolved_product_context",
      ],
      classifier_override: null,
      updated_by_engine: AGENT_V2_PRODUCTION_ENGINE,
    }
    const persistence = await params.persistConversationStateTransition(params.admin, {
      conversationId,
      userId: params.userId,
      transition,
    })

    if (persistence.status === "failed") {
      console.error("[product-intake] failed to persist chat product context", persistence.error)
    }
  } catch (error) {
    console.error("[product-intake] failed to persist chat product context", error)
  }
}

function buildActiveProductContextFromChatSubmission(params: {
  input: ChatProductIntakeSubmissionInput
  result: ProductIntakeSubmissionResult
  nowIso: string
}): AgentV2ActiveProductContext | null {
  const productNameText = params.input.product_name_text?.trim() || null
  if (!productNameText) return null

  const brandText = params.input.brand_text?.trim() || null
  const displayName = [brandText, productNameText].filter(Boolean).join(" ").trim()
  const isMatched = params.result.status === "matched" && params.result.matched_product_id

  return {
    status: isMatched ? "resolved" : "pending_review",
    product_id: isMatched ? params.result.matched_product_id : null,
    submission_id: isMatched ? null : (params.result.submission?.id ?? null),
    category: params.result.category,
    brand_text: brandText,
    product_name_text: productNameText,
    display_name: displayName,
    original_user_message: `Ich habe ${displayName} eingereicht.`,
    source: "product_intake_submission",
    updated_at: params.nowIso,
  }
}

export function createProductIntakeCancelHandler(overrides: ProductIntakePostHandlerDeps = {}) {
  const deps = {
    createServerClient: createClient,
    createAdminClient,
    isEnabled: isProductIntakeEnabled,
    createRepository: createSupabaseProductIntakeRepository,
    ...overrides,
  }

  return async function productIntakeCancelHandler(request: Request) {
    if (!deps.isEnabled()) {
      return NextResponse.json(DISABLED_RESPONSE, { status: 503 })
    }

    const supabase = await deps.createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
    }

    const body = await request.json()
    const parsed = onboardingProductIntakeCancelSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = deps.createAdminClient()
    const repository = deps.createRepository(admin)

    try {
      const cancelled = []
      for (const category of parsed.data.categories) {
        cancelled.push(
          await cancelProductIntakeUsage({
            userId: user.id,
            category,
            repository,
          }),
        )
      }

      return NextResponse.json({ cancelled }, { status: 200 })
    } catch (error) {
      console.error("[product-intake] usage cancellation failed", error)
      return NextResponse.json({ error: "Produkt konnte nicht entfernt werden." }, { status: 500 })
    }
  }
}
