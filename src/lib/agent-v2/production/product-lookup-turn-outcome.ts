import {
  AgentV2CareCategorySchema,
  type AgentV2SafetyMode,
  type AgentV2TerminalAnswer,
  type AgentV2Trace,
} from "@/lib/agent-v2/contracts"
import {
  getAgentV2NamedProductCategoryReferenceTerms,
  type AgentV2NamedProductContext,
} from "@/lib/agent-v2/named-product-context"
import { agentV2ProductLookupStatusHasClarificationCard } from "@/lib/agent-v2/product-lookup-policy"
import {
  buildActiveProductContextFromLookup,
  buildActiveProductContextFromIntakeOffer,
  buildActiveProductContextFromTrustedSelection,
  buildPrimaryResolvedProductContext,
  buildStoredProjectionForTrustedSelectedProduct,
  mergeActiveProductContexts,
  type AgentV2ActiveProductContext,
  type AgentV2ActiveResolvedProductContext,
  type AgentV2StoredProductProjection,
  type AgentV2TrustedSelectedProductContext,
} from "@/lib/agent-v2/resolved-product-selection-adapter"
import {
  lookupProductCandidate,
  type ProductLookupCatalog,
  type ProductLookupResult,
} from "@/lib/product-intake/product-lookup"
import {
  resolveBrandFromText,
  type BrandResolutionCatalogInput,
  type ProductIdentityBrand,
} from "@/lib/product-identity/brand-resolution"
import type {
  ProductIntakeCategoryKey,
  ProductIntakeOffer,
  ProductLookupClarification,
} from "@/lib/types"

export type ProductLookupExecutionInput = {
  category: string | null
  brand_text: string | null
  product_name_text: string | null
}

export type ProductLookupExecution = {
  input: ProductLookupExecutionInput
  result: ProductLookupResult
}

export type ProductLookupCatalogLoader = () => Promise<{
  catalog: ProductLookupCatalog
  brandCatalog: BrandResolutionCatalogInput
}>

export type ProductLookupTurnOutcome = {
  answer: AgentV2TerminalAnswer
  visibleFailure: boolean
  productIntakeOffer: ProductIntakeOffer | null
  productLookupClarification: ProductLookupClarification | null
  nextActiveProductContexts: AgentV2ActiveProductContext[]
  nextActiveResolvedProductContext: AgentV2ActiveResolvedProductContext | null
  trustedSelectedProductProjection: AgentV2StoredProductProjection | null
}

const PRODUCT_INTAKE_VISIBLE_FAILURE_COPY =
  "Das konkrete Produkt haben wir noch nicht in unserer Datenbank. Wenn du magst, gib es kurz hier ein, dann prüfen wir es für dich."

export function normalizeProductLookupExecutionInput(input: {
  category?: unknown
  brand_text?: unknown
  product_name_text?: unknown
}): ProductLookupExecutionInput {
  return {
    category: typeof input.category === "string" ? input.category : null,
    brand_text: typeof input.brand_text === "string" ? input.brand_text : null,
    product_name_text: typeof input.product_name_text === "string" ? input.product_name_text : null,
  }
}

export async function buildProductLookupTurnOutcome(params: {
  productIntakeEnabled: boolean
  safetyMode: AgentV2SafetyMode
  activeProductContexts?: readonly AgentV2ActiveProductContext[]
  activeResolvedProductContext: AgentV2ActiveResolvedProductContext | null
  trustedSelectedProductContext?: AgentV2TrustedSelectedProductContext | null
  namedProductContext: AgentV2NamedProductContext | null
  executions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  finalAnswer: AgentV2TerminalAnswer
  latestUserMessage: string
  loadProductLookupCatalogs: ProductLookupCatalogLoader
  requestId: string
}): Promise<ProductLookupTurnOutcome> {
  const latestMessageNamesNewProduct = Boolean(
    params.namedProductContext && params.namedProductContext.named_product_intent !== "background",
  )
  const suppressStaleLookupActions =
    Boolean(params.activeResolvedProductContext) && !latestMessageNamesNewProduct
  const productLookupActionsAllowed =
    params.safetyMode === "normal" && params.productIntakeEnabled && !suppressStaleLookupActions
  const pendingReviewFallbackAllowed = params.safetyMode === "normal"
  const deterministicLookupFallback = productLookupActionsAllowed
    ? await buildDeterministicNamedProductLookupFallback({
        namedProductContext: params.namedProductContext,
        existingExecutions: params.executions,
        trace: params.trace,
        loadProductLookupCatalogs: params.loadProductLookupCatalogs,
        requestId: params.requestId,
      })
    : null
  const categorylessLookupFallback =
    productLookupActionsAllowed && !deterministicLookupFallback
      ? await buildCategorylessKnownBrandLookupFallback({
          finalAnswer: params.finalAnswer,
          namedProductContext: params.namedProductContext,
          existingExecutions: params.executions,
          trace: params.trace,
          latestUserMessage: params.latestUserMessage,
          loadProductLookupCatalogs: params.loadProductLookupCatalogs,
          requestId: params.requestId,
        })
      : null
  const executionsWithFallback = deterministicLookupFallback
    ? [...params.executions, deterministicLookupFallback.execution]
    : categorylessLookupFallback
      ? [...params.executions, categorylessLookupFallback.execution]
      : [...params.executions]
  const foundExactLookupRepairFallback =
    productLookupActionsAllowed && !deterministicLookupFallback && !categorylessLookupFallback
      ? buildFoundExactLookupRepairFallback({
          namedProductContext: params.namedProductContext,
          executions: executionsWithFallback,
          trace: params.trace,
          finalAnswer: params.finalAnswer,
          latestUserMessage: params.latestUserMessage,
        })
      : null
  const pendingReviewProductLookupFailureFallback = pendingReviewFallbackAllowed
    ? buildPendingReviewProductLookupFailureFallback({
        activeProductContexts: params.activeProductContexts ?? [],
        executions: executionsWithFallback,
        trace: params.trace,
        latestUserMessage: params.latestUserMessage,
      })
    : null
  const pendingReviewCategoryFollowupFallback =
    pendingReviewFallbackAllowed && !pendingReviewProductLookupFailureFallback
      ? buildPendingReviewCategoryFollowupFallback({
          activeProductContexts: params.activeProductContexts ?? [],
          executions: executionsWithFallback,
          trace: params.trace,
          latestUserMessage: params.latestUserMessage,
        })
      : null
  const recoveredNotFoundLookupFailureFallback =
    productLookupActionsAllowed &&
    !pendingReviewProductLookupFailureFallback &&
    !pendingReviewCategoryFollowupFallback
      ? buildRecoveredNotFoundProductLookupFailureFallback({
          namedProductContext: params.namedProductContext,
          executions: executionsWithFallback,
          trace: params.trace,
          latestUserMessage: params.latestUserMessage,
        })
      : null
  const latestMessageNamesActionableProduct = Boolean(
    params.namedProductContext && params.namedProductContext.named_product_intent !== "background",
  )
  const nowIso = new Date().toISOString()

  const baseAnswer =
    deterministicLookupFallback?.answer ??
    categorylessLookupFallback?.answer ??
    foundExactLookupRepairFallback ??
    pendingReviewProductLookupFailureFallback ??
    pendingReviewCategoryFollowupFallback ??
    recoveredNotFoundLookupFailureFallback ??
    params.finalAnswer
  const answerDefersUnknownProductForIntake =
    productLookupActionsAllowed && answerDefersUnknownProductToIntake(baseAnswer)
  const visibleFailure =
    params.trace.failure_stage !== null &&
    !deterministicLookupFallback &&
    !foundExactLookupRepairFallback &&
    !pendingReviewProductLookupFailureFallback &&
    !pendingReviewCategoryFollowupFallback &&
    !recoveredNotFoundLookupFailureFallback
  const productIntakeOffer =
    productLookupActionsAllowed &&
    !pendingReviewProductLookupFailureFallback &&
    !pendingReviewCategoryFollowupFallback
      ? selectProductIntakeOfferForAnswer(
          baseAnswer,
          executionsWithFallback,
          params.latestUserMessage,
          {
            allowFallbackIntake: visibleFailure,
            allowConcreteLatestMessageFallback:
              latestMessageNamesActionableProduct || answerDefersUnknownProductForIntake,
            allowUnmatchedAnswerIntakeFallback:
              visibleFailure || answerDefersUnknownProductForIntake,
          },
        )
      : null
  const answer =
    visibleFailure && productIntakeOffer
      ? withProductIntakeVisibleFailureCopy(baseAnswer, {
          executions: executionsWithFallback,
          productIntakeOffer,
        })
      : answerDefersUnknownProductForIntake && productIntakeOffer
        ? withProductIntakeActionIntroCopy(baseAnswer, {
            executions: executionsWithFallback,
            productIntakeOffer,
          })
        : baseAnswer
  const executionsForClarification =
    productLookupActionsAllowed &&
    !pendingReviewProductLookupFailureFallback &&
    !pendingReviewCategoryFollowupFallback
      ? await recoverProductLookupClarificationExecutionsFromTrace({
          trace: params.trace,
          existingExecutions: executionsWithFallback,
          loadProductLookupCatalogs: params.loadProductLookupCatalogs,
          requestId: params.requestId,
        })
      : executionsWithFallback
  const productLookupClarification = productLookupActionsAllowed
    ? selectProductLookupClarificationForAnswer(
        answer,
        executionsForClarification,
        params.latestUserMessage,
        {
          allowFallbackClarification:
            visibleFailure || Boolean(deterministicLookupFallback || categorylessLookupFallback),
        },
      )
    : null
  const nextContextsForTurn = [
    buildActiveProductContextFromTrustedSelection(params.trustedSelectedProductContext, nowIso),
    ...executionsWithFallback.map((execution) =>
      buildActiveProductContextFromLookup({
        result: execution.result,
        inputCategory: execution.input.category,
        inputBrandText: execution.input.brand_text,
        inputProductNameText: execution.input.product_name_text,
        originalUserMessage: params.latestUserMessage,
        displayName:
          params.namedProductContext?.display_name ?? execution.result.product?.name ?? null,
        nowIso,
      }),
    ),
    buildActiveProductContextFromIntakeOffer(productIntakeOffer, params.latestUserMessage, nowIso),
  ].filter((context): context is AgentV2ActiveProductContext => Boolean(context))
  const nextActiveProductContexts = visibleFailure
    ? [...(params.activeProductContexts ?? [])].slice(-3)
    : mergeActiveProductContexts({
        previous: params.activeProductContexts ?? [],
        next: nextContextsForTurn,
        latestMessageNamesActionableProduct:
          latestMessageNamesActionableProduct &&
          !pendingReviewProductLookupFailureFallback &&
          !pendingReviewCategoryFollowupFallback,
      })
  const nextActiveResolvedProductContext =
    buildPrimaryResolvedProductContext(nextActiveProductContexts)
  const trustedSelectedProductProjection = buildStoredProjectionForTrustedSelectedProduct(
    params.trustedSelectedProductContext,
  )

  return {
    answer,
    visibleFailure,
    productIntakeOffer,
    productLookupClarification,
    nextActiveProductContexts,
    nextActiveResolvedProductContext,
    trustedSelectedProductProjection,
  }
}

function withProductIntakeVisibleFailureCopy(
  answer: AgentV2TerminalAnswer,
  params: {
    executions: readonly ProductLookupExecution[]
    productIntakeOffer: ProductIntakeOffer
  },
): AgentV2TerminalAnswer {
  const displayName = selectVisibleFailureProductIdentity(params)
  const userFacingAnswer = displayName
    ? `Ich weiß, dass du **${displayName}** meinst. ${PRODUCT_INTAKE_VISIBLE_FAILURE_COPY}`
    : PRODUCT_INTAKE_VISIBLE_FAILURE_COPY

  switch (answer.answer_mode) {
    case "product_recommendation":
    case "product_assessment":
    case "routine":
    case "general_advice":
    case "clarification":
    case "constraint_blocked":
    case "social":
      return {
        ...answer,
        payload: {
          ...answer.payload,
          user_facing_answer_de: userFacingAnswer,
        },
      } as AgentV2TerminalAnswer
    case "safety_boundary":
    case "domain_boundary":
      return answer
  }

  const exhaustive: never = answer
  return exhaustive
}

function withProductIntakeActionIntroCopy(
  answer: AgentV2TerminalAnswer,
  params: {
    executions: readonly ProductLookupExecution[]
    productIntakeOffer: ProductIntakeOffer
  },
): AgentV2TerminalAnswer {
  const currentText = userFacingAnswerText(answer).trim()
  if (!currentText || productIntakeActionIsIntroduced(currentText)) return answer

  const displayName = selectVisibleFailureProductIdentity(params)
  const intro = displayName
    ? `Ich habe **${displayName}** noch nicht in unserer Datenbank. Gib es bitte unten kurz ein, dann kann ich es genauer für dich prüfen.`
    : "Das konkrete Produkt haben wir noch nicht in unserer Datenbank. Gib es bitte unten kurz ein, dann kann ich es genauer für dich prüfen."
  const roughGuidance = buildCoarseFallbackGuidanceText(currentText, displayName)
  const userFacingAnswer = roughGuidance ? `${intro}\n\n${roughGuidance}` : intro

  switch (answer.answer_mode) {
    case "product_recommendation":
    case "product_assessment":
    case "routine":
    case "general_advice":
    case "clarification":
    case "constraint_blocked":
    case "social":
      return {
        ...answer,
        payload: {
          ...answer.payload,
          user_facing_answer_de: userFacingAnswer,
        },
      } as AgentV2TerminalAnswer
    case "safety_boundary":
    case "domain_boundary":
      return answer
  }

  const exhaustive: never = answer
  return exhaustive
}

function productIntakeActionIsIntroduced(text: string): boolean {
  const firstParagraph = splitProductIntakeParagraphs(text)[0] ?? text
  return (
    /\b(?:unten|hier|karte|formular|foto|daten)\b/iu.test(firstParagraph) &&
    /\b(?:gib|eingeben|hochladen|einreichen|hinzuf(?:ue|ü)gen|prüfen|pruefen)\b/iu.test(
      firstParagraph,
    )
  )
}

function buildCoarseFallbackGuidanceText(text: string, displayName: string | null): string {
  const paragraphs = splitProductIntakeParagraphs(text)
  const remaining = paragraphs.filter(
    (paragraph, index) =>
      !isRedundantProductIntakeDeferralParagraph(paragraph, {
        displayName,
        allowDisplayNameAgnosticDrop: index === 0,
      }),
  )
  const normalized = remaining.join("\n\n").trim()
  if (!normalized) return ""
  if (/^was ich dir schon grob sagen kann\b/iu.test(normalized)) return normalized
  return `Was ich dir schon grob sagen kann: ${normalized}`
}

function splitProductIntakeParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function isRedundantProductIntakeDeferralParagraph(
  paragraph: string,
  options: { displayName: string | null; allowDisplayNameAgnosticDrop?: boolean },
): boolean {
  if (!paragraph) return false
  const normalizedParagraph = normalizeProductLookupText(paragraph)
  const normalizedDisplayName = options.displayName
    ? normalizeProductLookupText(options.displayName)
    : ""
  const mentionsDisplayName = Boolean(
    normalizedDisplayName && normalizedParagraph.includes(normalizedDisplayName),
  )
  const hasCoarseProfileOrCategoryGuidance =
    /\b(?:haarprofil|profil|frizz|wellig(?:es|e|er|em|en)?|lockig(?:es|e|er|em|en)?|gef(?:ae|ä)rbt(?:es|e|er|em|en)?|fein(?:es|e|er|em|en)?|trocken(?:es|e|er|em|en)?|fettig(?:es|e|er|em|en)?|ansatz|l(?:ae|ä)ngen|kopfhaut|profitiert|leichter?|schwerer?|eher\s+von)\b/iu.test(
      paragraph,
    )
  const defersExactProduct =
    /\b(?:nicht|noch nicht)\b[\s\S]{0,120}\b(?:sicher zuordnen|zuordnen|bewerte|bewerten|verifiziert|verifizierte|produktdaten|datenbank|katalog)\b/iu.test(
      paragraph,
    ) || /\b(?:bewerte|bewerten)\b[\s\S]{0,80}\b(?:nicht|nichts)\b/iu.test(paragraph)
  return (
    defersExactProduct &&
    (mentionsDisplayName || Boolean(options.allowDisplayNameAgnosticDrop)) &&
    !hasCoarseProfileOrCategoryGuidance &&
    !productIntakeActionIsIntroduced(paragraph)
  )
}

function selectVisibleFailureProductIdentity(params: {
  executions: readonly ProductLookupExecution[]
  productIntakeOffer: ProductIntakeOffer
}): string | null {
  const eligible = params.executions.filter(
    (execution) => execution.result.status === "not_found" && execution.result.intake_offer,
  )
  const matching =
    eligible.find(
      (execution) => execution.result.intake_offer?.id === params.productIntakeOffer.id,
    ) ?? (eligible.length === 1 ? eligible[0] : null)
  if (!matching) return null

  return buildLookupInputDisplayName(matching.input)
}

function buildLookupInputDisplayName(input: ProductLookupExecutionInput): string | null {
  const brand = input.brand_text?.trim() || null
  const productName = input.product_name_text?.trim() || null
  if (brand && productName) {
    if (normalizeProductLookupText(productName).includes(normalizeProductLookupText(brand))) {
      return productName
    }
    return `${brand} ${productName}`
  }
  return productName ?? brand
}

function selectProductIntakeOfferForAnswer(
  answer: AgentV2TerminalAnswer,
  executions: readonly ProductLookupExecution[],
  latestUserMessage: string,
  options: {
    allowFallbackIntake?: boolean
    allowConcreteLatestMessageFallback?: boolean
    allowUnmatchedAnswerIntakeFallback?: boolean
  } = {},
): ProductLookupResult["intake_offer"] {
  const eligible = executions.filter(
    (execution) => execution.result.status === "not_found" && execution.result.intake_offer,
  )
  if (eligible.length === 0) return null

  const matchingOffer =
    eligible.find((execution) =>
      productLookupExecutionMatchesAnswer(execution, answer, latestUserMessage),
    )?.result.intake_offer ?? null

  if (answerSupportsProductIntakeOffer(answer)) {
    return (
      matchingOffer ??
      (options.allowUnmatchedAnswerIntakeFallback &&
      singleConcreteNotFoundLookupMatchesLatestMessage(eligible, latestUserMessage)
        ? (eligible[0]?.result.intake_offer ?? null)
        : null)
    )
  }

  if (
    options.allowFallbackIntake ||
    (options.allowConcreteLatestMessageFallback &&
      singleConcreteNotFoundLookupMatchesLatestMessage(eligible, latestUserMessage))
  ) {
    return (
      matchingOffer ?? (eligible.length === 1 ? (eligible[0]?.result.intake_offer ?? null) : null)
    )
  }

  return null
}

function singleConcreteNotFoundLookupMatchesLatestMessage(
  eligible: readonly ProductLookupExecution[],
  latestUserMessage: string,
) {
  if (eligible.length !== 1) return false
  const execution = eligible[0]
  if (!execution) return false
  if (!execution.input.product_name_text) return false

  const normalizedMessage = normalizeProductLookupText(latestUserMessage)
  const productName = normalizeProductLookupText(execution.input.product_name_text)
  if (!productName) return false

  if (execution.input.brand_text) {
    const brand = normalizeProductLookupText(execution.input.brand_text)
    if (!brand) return false
    return (
      normalizedMessage.includes(brand) &&
      normalizedProductLookupTokensMatch(productName, normalizedMessage)
    )
  }

  return normalizedProductTextOverlaps(productName, normalizedMessage)
}

const LOW_VALUE_LOOKUP_MATCH_TOKENS = new Set([
  "shampoo",
  "conditioner",
  "spulung",
  "spuelung",
  "maske",
  "kur",
  "oel",
  "ol",
  "oil",
  "produkt",
])

function normalizedProductLookupTokensMatch(
  normalizedProductName: string,
  normalizedMessage: string,
): boolean {
  if (normalizedMessage.includes(normalizedProductName)) return true
  const productTokens = normalizedProductName
    .split(" ")
    .filter((token) => token.length > 1 && !LOW_VALUE_LOOKUP_MATCH_TOKENS.has(token))
  if (productTokens.length === 0) return false
  const messageTokens = new Set(normalizedMessage.split(" "))
  return productTokens.every((token) => messageTokens.has(token))
}

const PRODUCT_LOOKUP_CATEGORY_LABELS: Record<ProductIntakeCategoryKey, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  mask: "Maske/Kur",
  oil: "Öl",
  dry_shampoo: "Trockenshampoo",
  deep_cleansing_shampoo: "Tiefenreinigungsshampoo",
  bondbuilder: "Bondbuilder",
}

function isProductIntakeCategoryKey(value: string | null): value is ProductIntakeCategoryKey {
  return Object.prototype.hasOwnProperty.call(PRODUCT_LOOKUP_CATEGORY_LABELS, value ?? "")
}

function productLookupCandidateCategory(candidate: ProductLookupResult["candidates"][number]) {
  return candidate.product.categoryKey ?? candidate.product.category_key ?? null
}

function productLookupCandidateName(candidate: ProductLookupResult["candidates"][number]) {
  return candidate.product.cleanName ?? candidate.product.name
}

function selectProductLookupClarificationForAnswer(
  answer: AgentV2TerminalAnswer,
  executions: readonly ProductLookupExecution[],
  latestUserMessage: string,
  options: { allowFallbackClarification?: boolean } = {},
): ProductLookupClarification | null {
  if (!options.allowFallbackClarification && !answerSupportsProductIntakeOffer(answer)) return null

  const eligibleExecutions = executions.filter(
    (candidate) =>
      agentV2ProductLookupStatusHasClarificationCard(candidate.result.status) &&
      candidate.result.candidates.length > 0,
  )
  const execution =
    eligibleExecutions.find((candidate) =>
      productLookupExecutionMatchesAnswer(candidate, answer, latestUserMessage),
    ) ?? (eligibleExecutions.length === 1 ? eligibleExecutions[0] : null)
  if (!execution) return null
  if (answerIsGroundedAlternativesRecommendation(answer, latestUserMessage)) return null

  const candidateCategories = execution.result.candidates
    .map((candidate) => productLookupCandidateCategory(candidate))
    .filter(isProductIntakeCategoryKey)
  const uniqueCandidateCategories = [...new Set(candidateCategories)]
  const sameCandidateCategory =
    uniqueCandidateCategories.length === 1 ? uniqueCandidateCategories[0] : null
  const category = isProductIntakeCategoryKey(execution.result.category)
    ? execution.result.category
    : sameCandidateCategory

  const kind =
    execution.result.status === "category_mismatch" ? "category_mismatch" : "variant_selection"
  const candidates = execution.result.candidates.slice(0, 3).map((candidate) => {
    const candidateCategory = productLookupCandidateCategory(candidate)
    const reason =
      category && candidateCategory && candidateCategory !== category
        ? "category_mismatch"
        : "same_brand_same_category"
    return {
      product_id: candidate.productId,
      name: productLookupCandidateName(candidate),
      category: candidateCategory,
      category_label_de: isProductIntakeCategoryKey(candidateCategory)
        ? PRODUCT_LOOKUP_CATEGORY_LABELS[candidateCategory]
        : "Produkt",
      reason,
    } satisfies ProductLookupClarification["candidates"][number]
  })

  const categoryLabel = sameCandidateCategory
    ? PRODUCT_LOOKUP_CATEGORY_LABELS[sameCandidateCategory]
    : null
  const firstCandidateCategoryLabel = candidates[0]?.category_label_de ?? "einer anderen Kategorie"
  const prompt =
    kind === "category_mismatch"
      ? `Wir haben es als ${firstCandidateCategoryLabel} gefunden. Meinst du dieses Produkt?`
      : !categoryLabel
        ? "Meinst du eines dieser Produkte?"
        : candidates.length === 1
          ? `Meinst du dieses ${categoryLabel}?`
          : `Meinst du eines dieser ${categoryLabel}?`

  return {
    id: `product-lookup-${execution.result.intake_offer?.id ?? crypto.randomUUID()}`,
    kind,
    source: "chat",
    original_user_message: latestUserMessage,
    query: {
      brand_text: execution.input.brand_text,
      product_name_text: execution.input.product_name_text,
      category,
    },
    copy: {
      prompt_de: prompt,
    },
    candidates,
    none_action: {
      label_de: "Nein, mein Produkt hinzufügen",
      product_intake_offer: execution.result.intake_offer ?? {
        id: `product-intake-${crypto.randomUUID()}`,
        source: "chat",
        reason: "product_lookup_not_found",
        category,
        missing_fields: category ? [] : ["Kategorie"],
        extracted_identity: {
          ...(execution.input.brand_text ? { brand_text: execution.input.brand_text } : {}),
          ...(execution.input.product_name_text
            ? { product_name_text: execution.input.product_name_text }
            : {}),
        },
      },
    },
  }
}

function answerIsGroundedAlternativesRecommendation(
  answer: AgentV2TerminalAnswer,
  latestUserMessage: string,
): boolean {
  if (answer.answer_mode !== "product_recommendation") return false
  if (answer.request_interpretation.product_request_kind !== "specific_products") return false
  if (!answer.tool_grounding.used_product_tool) return false

  const recommendationProductIds = answer.payload.recommendations
    .map((recommendation) => recommendation.product_id)
    .filter((productId): productId is string => Boolean(productId))
  if (recommendationProductIds.length === 0) return false

  const groundedProductIds = new Set(answer.tool_grounding.product_ids)
  if (groundedProductIds.size > 0) {
    const allRecommendationsGrounded = recommendationProductIds.every((productId) =>
      groundedProductIds.has(productId),
    )
    if (!allRecommendationsGrounded) return false
  }

  const requestText = normalizeProductLookupText(
    [
      latestUserMessage,
      answer.request_interpretation.evidence_quote,
      answer.payload.user_facing_answer_de,
    ].join(" "),
  )
  return /\b(?:alternative|alternativen|alternativ|andere|anderen|sonst|weitere|weiteren|statt|ersetzen|ersatz)\b/u.test(
    requestText,
  )
}

function productLookupExecutionHasClarificationCandidates(execution: ProductLookupExecution) {
  return (
    agentV2ProductLookupStatusHasClarificationCard(execution.result.status) &&
    execution.result.candidates.length > 0
  )
}

function traceLookupCallCanRecoverClarification(call: AgentV2Trace["tool_calls"][number]): boolean {
  if (call.name !== "lookup_product_candidate") return false
  return (
    call.output_summary === "product_lookup:ambiguous" ||
    call.output_summary === "product_lookup:needs_variant_selection" ||
    call.output_summary === "product_lookup:category_mismatch"
  )
}

function readProductLookupInputFromTraceCall(
  call: AgentV2Trace["tool_calls"][number],
): ProductLookupExecutionInput | null {
  if (call.name !== "lookup_product_candidate") return null
  const args = call.arguments
  if (!args || typeof args !== "object" || Array.isArray(args)) return null
  const input = normalizeProductLookupExecutionInput(args)
  if (!input.category && !input.brand_text && !input.product_name_text) return null
  return input
}

async function recoverProductLookupClarificationExecutionsFromTrace(params: {
  trace: AgentV2Trace
  existingExecutions: readonly ProductLookupExecution[]
  loadProductLookupCatalogs: ProductLookupCatalogLoader
  requestId: string
}): Promise<ProductLookupExecution[]> {
  if (params.existingExecutions.some(productLookupExecutionHasClarificationCandidates)) {
    return [...params.existingExecutions]
  }

  const calls = params.trace.tool_calls.filter(traceLookupCallCanRecoverClarification)
  if (calls.length === 0) return [...params.existingExecutions]

  const recoveredExecutions: ProductLookupExecution[] = []
  const { catalog, brandCatalog } = await params.loadProductLookupCatalogs()
  for (const call of calls) {
    const input = readProductLookupInputFromTraceCall(call)
    if (!input) continue
    // The chat-pipeline loader returns an already user-visible catalog. Keep intake_dedupe
    // here so recovered cards can reuse the scoped catalog without filtering out owned products.
    const result = lookupProductCandidate({
      input,
      catalog,
      brandCatalog,
      offerId: `product-intake-${params.requestId}`,
      eligibilityMode: "intake_dedupe",
    })
    if (productLookupExecutionHasClarificationCandidates({ input, result })) {
      recoveredExecutions.push({ input, result })
    }
  }

  if (recoveredExecutions.length === 0) return [...params.existingExecutions]
  return [...params.existingExecutions, ...recoveredExecutions]
}

async function buildCategorylessKnownBrandLookupFallback(params: {
  finalAnswer: AgentV2TerminalAnswer
  namedProductContext: AgentV2NamedProductContext | null
  existingExecutions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  latestUserMessage: string
  loadProductLookupCatalogs: ProductLookupCatalogLoader
  requestId: string
}): Promise<{ answer: AgentV2TerminalAnswer; execution: ProductLookupExecution } | null> {
  if (params.namedProductContext?.named_product_intent === "background") return null
  if (
    params.existingExecutions.length > 0 &&
    !params.existingExecutions.every((execution) =>
      productLookupExecutionLooksOverSpecificForLatestMessage(execution, params.latestUserMessage),
    )
  ) {
    return null
  }
  if (
    params.existingExecutions.length === 0 &&
    params.trace.tool_calls.some((call) => call.name === "lookup_product_candidate")
  ) {
    return null
  }
  if (
    !answerCanUseCategorylessKnownBrandFallback(params.finalAnswer) &&
    !latestMessageCanUseCategorylessKnownBrandFallback(params.latestUserMessage)
  ) {
    return null
  }

  const { catalog, brandCatalog } = await params.loadProductLookupCatalogs()
  const input = buildCategorylessKnownBrandLookupInput(params.latestUserMessage, brandCatalog)
  if (!input) return null

  // The chat-pipeline loader returns an already user-visible catalog. Keep intake_dedupe
  // here so deterministic fallback can reuse the scoped catalog without filtering out owned products.
  const result = lookupProductCandidate({
    input,
    catalog,
    brandCatalog,
    offerId: `product-intake-${params.requestId}`,
    eligibilityMode: "intake_dedupe",
  })
  const execution = { input, result }
  if (!productLookupExecutionHasClarificationCandidates(execution)) return null

  return {
    execution,
    answer: buildCategorylessKnownBrandClarificationAnswer({
      input,
      usedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
    }),
  }
}

function productLookupExecutionLooksOverSpecificForLatestMessage(
  execution: ProductLookupExecution,
  latestUserMessage: string,
): boolean {
  if (execution.result.status !== "found_exact") return false
  if (!execution.input.product_name_text) return false

  const identity = [execution.input.brand_text, execution.input.product_name_text]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
  if (!identity) return false

  const normalizedMessage = normalizeProductLookupText(latestUserMessage)
  const normalizedIdentity = normalizeProductLookupText(identity)
  if (!normalizedMessage || !normalizedIdentity) return false
  if (normalizedMessage.includes(normalizedIdentity)) return false

  const normalizedBrand = execution.input.brand_text
    ? normalizeProductLookupText(execution.input.brand_text)
    : ""
  return Boolean(normalizedBrand && normalizedMessage.includes(normalizedBrand))
}

function answerCanUseCategorylessKnownBrandFallback(answer: AgentV2TerminalAnswer): boolean {
  if (!answer.request_interpretation.specific_product_candidate) return false
  const kind = answer.request_interpretation.product_request_kind
  return kind === "product_detail" || kind === "specific_products" || kind === "compare_products"
}

function latestMessageCanUseCategorylessKnownBrandFallback(latestUserMessage: string): boolean {
  return /\b(?:ich\s+(?:nutze|benutze|verwende)|was\s+h(?:ae|ä)ltst\s+du|passt\s+(?:das|dieses|der|die|er|sie|es)|bewerten|beurteilen|einsch(?:ae|ä)tzen)\b/iu.test(
    latestUserMessage,
  )
}

function answerDefersUnknownProductToIntake(answer: AgentV2TerminalAnswer): boolean {
  const text = userFacingAnswerText(answer)
  if (!text) return false
  const mentionsMissingDatabase =
    /\b(?:nicht|noch nicht)\b[\s\S]{0,100}\b(?:datenbank|produktdaten|katalog)\b/iu.test(text)
  const mentionsUnverifiedProduct =
    /\b(?:nicht|noch nicht)\b[\s\S]{0,120}\b(?:verifizieren|verifiziert|verifizierte|verifizierter|best(?:ae|ä)tigen|bewerten|einsch(?:ae|ä)tzen)\b/iu.test(
      text,
    ) ||
    /\b(?:verifizierte|verifizierter|best(?:ae|ä)tigte|best(?:ae|ä)tigter)\b[\s\S]{0,80}\b(?:zuordnung|produktdaten|produkt)\b/iu.test(
      text,
    )
  const mentionsProductReview =
    /\b(?:prüfen|pruefen|hinzuf(?:ue|ü)gen|einreichen|verifizieren|verifiziert|verifizierte|verifizierter)\b/iu.test(
      text,
    )
  return (mentionsMissingDatabase || mentionsUnverifiedProduct) && mentionsProductReview
}

function userFacingAnswerText(answer: AgentV2TerminalAnswer): string {
  const payload = answer.payload as { user_facing_answer_de?: unknown }
  return typeof payload.user_facing_answer_de === "string" ? payload.user_facing_answer_de : ""
}

function buildCategorylessKnownBrandLookupInput(
  latestUserMessage: string,
  brandCatalog: BrandResolutionCatalogInput,
): ProductLookupExecutionInput | null {
  const tokenStarts = Array.from(
    latestUserMessage.matchAll(/[\p{L}\p{M}\p{N}&'.-]+/gu),
    (match) => match.index ?? 0,
  )

  for (const start of tokenStarts) {
    const source = latestUserMessage.slice(start)
    const resolved = resolveBrandFromText(source, brandCatalog)
    if (!resolved.brand || !resolved.matchedText) continue

    const productName = cleanupCategorylessKnownBrandProductName(
      source.slice(resolved.matchedText.length),
    )
    if (!productName) continue

    return {
      category: null,
      brand_text: resolved.matchedText || productIdentityBrandName(resolved.brand),
      product_name_text: productName,
    }
  }

  return null
}

function productIdentityBrandName(brand: ProductIdentityBrand): string {
  return brand.canonical_name ?? brand.canonicalName ?? brand.name ?? brand.key ?? brand.id ?? ""
}

function cleanupCategorylessKnownBrandProductName(value: string): string | null {
  const withoutLeadingSeparator = value.replace(/^[^\p{L}\p{N}]+/u, "")
  const firstSentence = withoutLeadingSeparator.split(/[.?!]/u)[0] ?? ""
  const withoutQuestionTail = firstSentence
    .replace(
      /\b(?:passt|ist|kann|soll|sollte|was|h(?:ae|ä)ltst|haelst|hältst|zu|f(?:ue|ü)r|mit|und)\b[\s\S]*$/iu,
      "",
    )
    .trim()
  const normalized = normalizeProductLookupText(withoutQuestionTail)
  if (!normalized || normalized === "produkt") return null
  if (!/[\p{L}\p{N}]{2,}/u.test(withoutQuestionTail)) return null
  return withoutQuestionTail
}

function buildCategorylessKnownBrandClarificationAnswer(params: {
  input: ProductLookupExecutionInput
  usedGuidancePackageIds: readonly string[]
}): AgentV2TerminalAnswer {
  const displayName = [params.input.brand_text, params.input.product_name_text]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
  const userFacingAnswer = `Ich finde zu ${displayName} mehrere mögliche Varianten und möchte nichts Falsches bewerten. Welche genaue Variante meinst du?`

  return {
    answer_mode: "clarification",
    interpreted_intent:
      "Deterministic category-less named-product lookup fallback after model skipped lookup.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: displayName,
      specific_product_candidate: true,
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: {
      hair_concerns: [],
      goals: [],
      product_categories: [],
      budget_eur: null,
      avoid_ingredients: [],
      allergies: [],
      preferences: [],
      routine_layer: null,
      raw_constraints: [displayName],
    },
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [...params.usedGuidancePackageIds],
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: ["product.variant_selection_required"],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: "none",
      return_path: [],
    },
    pending_followup_action: null,
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: userFacingAnswer,
      question_de: "Welche genaue Variante meinst du?",
      missing_keys: ["product_variant"],
    },
  }
}

async function buildDeterministicNamedProductLookupFallback(params: {
  namedProductContext: AgentV2NamedProductContext | null
  existingExecutions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  loadProductLookupCatalogs: ProductLookupCatalogLoader
  requestId: string
}): Promise<{ answer: AgentV2TerminalAnswer; execution: ProductLookupExecution } | null> {
  const context = params.namedProductContext
  if (!context || context.named_product_intent === "background") return null
  if (params.existingExecutions.length > 0) return null
  if (params.trace.tool_calls.some((call) => call.name === "lookup_product_candidate")) return null
  if (!isProductIntakeCategoryKey(context.category)) return null

  const { catalog, brandCatalog } = await params.loadProductLookupCatalogs()
  const input = buildLookupInputFromNamedProductContext(context, brandCatalog)
  if (!input) return null

  // The chat-pipeline loader returns an already user-visible catalog. Keep intake_dedupe
  // here so deterministic fallback can reuse the scoped catalog without filtering out owned products.
  const result = lookupProductCandidate({
    input,
    catalog,
    brandCatalog,
    offerId: `product-intake-${params.requestId}`,
    eligibilityMode: "intake_dedupe",
  })
  if (result.status === "insufficient_identity" || result.status === "unsupported_category") {
    return null
  }

  return {
    execution: { input, result },
    answer: buildDeterministicNamedProductFallbackAnswer({
      context,
      lookupResult: result,
      usedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
    }),
  }
}

function buildFoundExactLookupRepairFallback(params: {
  namedProductContext: AgentV2NamedProductContext | null
  executions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  finalAnswer: AgentV2TerminalAnswer
  latestUserMessage: string
}): AgentV2TerminalAnswer | null {
  const context = params.namedProductContext
  if (!context || context.named_product_intent === "background") return null
  if (params.trace.failure_stage === null) return null

  const execution = params.executions.find(
    (candidate) =>
      candidate.result.status === "found_exact" &&
      Boolean(candidate.result.product) &&
      productLookupExecutionMatchesAnswer(candidate, params.finalAnswer, params.latestUserMessage),
  )
  if (!execution) return null

  return buildDeterministicNamedProductFallbackAnswer({
    context,
    lookupResult: execution.result,
    usedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
  })
}

function buildPendingReviewProductLookupFailureFallback(params: {
  activeProductContexts: readonly AgentV2ActiveProductContext[]
  executions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  latestUserMessage: string
}): AgentV2TerminalAnswer | null {
  const context = findPendingReviewProductContextForNotFoundLookup({
    activeProductContexts: params.activeProductContexts,
    executions: params.executions,
  })
  if (!context) return null

  return buildPendingReviewProductAnswer({ context, trace: params.trace })
}

function buildPendingReviewCategoryFollowupFallback(params: {
  activeProductContexts: readonly AgentV2ActiveProductContext[]
  executions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  latestUserMessage: string
}): AgentV2TerminalAnswer | null {
  const pendingContexts = params.activeProductContexts.filter(
    (context) => context.status === "pending_review" && context.category,
  )
  const matchingContexts = pendingContexts.filter((context) => {
    if (
      !latestMessageLooksLikePendingProductFollowupForCategory({
        latestUserMessage: params.latestUserMessage,
        category: context.category,
      })
    ) {
      return false
    }
    if (
      hasNewerResolvedProductContextForCategory(params.activeProductContexts, context) &&
      !latestMessageMentionsPendingProductContext(context, params.latestUserMessage)
    ) {
      return false
    }
    if (
      params.executions.some((execution) =>
        productLookupExecutionNamesDifferentProductForPendingContext(context, execution),
      )
    ) {
      return false
    }
    return true
  })
  if (matchingContexts.length !== 1) return null

  return buildPendingReviewProductAnswer({
    context: matchingContexts[0],
    trace: params.trace,
  })
}

function buildPendingReviewProductAnswer(params: {
  context: AgentV2ActiveProductContext
  trace: AgentV2Trace
}): AgentV2TerminalAnswer {
  const category = AgentV2CareCategorySchema.safeParse(params.context.category)
  const careCategory = category.success ? category.data : "unknown"
  const displayName = params.context.display_name
  const userFacingAnswer = `${displayName} ist bei uns noch in Prüfung. Sobald wir es geprüft haben, melden wir uns hier im Chat. Bis dahin will ich dazu nichts erfinden.`

  return {
    answer_mode: "constraint_blocked",
    interpreted_intent:
      "User asks for a product-specific assessment of an already submitted product that is still under review.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: careCategory,
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: displayName,
      specific_product_candidate: true,
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: {
      hair_concerns: [],
      goals: [],
      product_categories: careCategory === "unknown" ? [] : [careCategory],
      budget_eur: null,
      avoid_ingredients: [],
      allergies: [],
      preferences: [],
      routine_layer: null,
      raw_constraints: [displayName],
    },
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [...params.trace.loaded_guidance_package_ids],
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: ["product.pending_review"],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: careCategory,
      return_path: [],
    },
    pending_followup_action: null,
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: userFacingAnswer,
      blocking_constraints: ["product_pending_review"],
      safe_alternative_de: "Du kannst in der Zwischenzeit einfach mit anderen Fragen weitermachen.",
    },
  }
}

function latestMessageLooksLikePendingProductFollowupForCategory(params: {
  latestUserMessage: string
  category: string | null
}): boolean {
  if (!params.category) return false
  const parsedCategory = AgentV2CareCategorySchema.safeParse(params.category)
  if (!parsedCategory.success) return false
  if (!isProductIntakeCategoryKey(parsedCategory.data)) return false

  const normalized = normalizeProductLookupText(params.latestUserMessage)
  if (!normalized) return false
  const categoryTerms = [
    PRODUCT_LOOKUP_CATEGORY_LABELS[parsedCategory.data],
    ...getAgentV2NamedProductCategoryReferenceTerms(parsedCategory.data),
  ]
    .map(normalizeProductLookupText)
    .filter(Boolean)
  if (!categoryTerms.some((term) => normalized.includes(term))) return false
  if (/\bwelche\b.{0,80}\bempf(?:iehl|ehl)/iu.test(params.latestUserMessage)) return false

  return /\b(?:wie oft|benutzen|verwenden|anwenden|nehmen|passt|bewerten|beurteilen|einsch(?:ae|ä)tzen|h(?:ae|ä)ltst)\b/iu.test(
    params.latestUserMessage,
  )
}

function hasNewerResolvedProductContextForCategory(
  contexts: readonly AgentV2ActiveProductContext[],
  pendingContext: AgentV2ActiveProductContext,
): boolean {
  if (!pendingContext.category) return false
  const pendingUpdatedAt = activeProductContextUpdatedAtMs(pendingContext)
  return contexts.some(
    (context) =>
      context.status === "resolved" &&
      context.category === pendingContext.category &&
      activeProductContextUpdatedAtMs(context) > pendingUpdatedAt,
  )
}

function activeProductContextUpdatedAtMs(context: AgentV2ActiveProductContext): number {
  const parsed = Date.parse(context.updated_at)
  return Number.isFinite(parsed) ? parsed : 0
}

function latestMessageMentionsPendingProductContext(
  context: AgentV2ActiveProductContext,
  latestUserMessage: string,
): boolean {
  const identityParts = [
    context.brand_text && context.product_name_text
      ? `${context.brand_text} ${context.product_name_text}`
      : null,
    context.product_name_text,
    context.display_name,
  ].filter((part): part is string => Boolean(part?.trim()))

  return identityParts.some((identity) =>
    normalizedProductTextOverlaps(identity, latestUserMessage, context.brand_text),
  )
}

function productLookupExecutionNamesDifferentProductForPendingContext(
  context: AgentV2ActiveProductContext,
  execution: ProductLookupExecution,
): boolean {
  if (
    execution.input.category &&
    context.category &&
    execution.input.category !== context.category
  ) {
    return false
  }

  const lookupIdentityParts = [
    execution.input.brand_text && execution.input.product_name_text
      ? `${execution.input.brand_text} ${execution.input.product_name_text}`
      : null,
    execution.input.product_name_text,
  ].filter((part): part is string => Boolean(part?.trim()))
  if (lookupIdentityParts.length === 0) return false

  const contextIdentityParts = [
    context.brand_text && context.product_name_text
      ? `${context.brand_text} ${context.product_name_text}`
      : null,
    context.product_name_text,
    context.display_name,
  ].filter((part): part is string => Boolean(part?.trim()))

  return !lookupIdentityParts.some((lookupIdentity) =>
    contextIdentityParts.some((contextIdentity) =>
      normalizedProductTextOverlaps(
        lookupIdentity,
        contextIdentity,
        execution.input.brand_text ?? context.brand_text,
      ),
    ),
  )
}

function findPendingReviewProductContextForNotFoundLookup(params: {
  activeProductContexts: readonly AgentV2ActiveProductContext[]
  executions: readonly ProductLookupExecution[]
}): AgentV2ActiveProductContext | null {
  const pendingContexts = params.activeProductContexts.filter(
    (context) => context.status === "pending_review",
  )
  if (pendingContexts.length === 0) return null

  const notFoundExecutions = params.executions.filter(
    (execution) => execution.result.status === "not_found",
  )
  for (const execution of notFoundExecutions) {
    const matchingContext = pendingContexts.find((context) =>
      pendingReviewContextMatchesLookupExecution(context, execution),
    )
    if (matchingContext) return matchingContext
  }

  return null
}

function pendingReviewContextMatchesLookupExecution(
  context: AgentV2ActiveProductContext,
  execution: ProductLookupExecution,
): boolean {
  if (
    execution.input.category &&
    context.category &&
    execution.input.category !== context.category
  ) {
    return false
  }

  const lookupIdentityParts = [
    execution.input.brand_text && execution.input.product_name_text
      ? `${execution.input.brand_text} ${execution.input.product_name_text}`
      : null,
    execution.input.product_name_text,
  ].filter((part): part is string => Boolean(part?.trim()))
  if (lookupIdentityParts.length === 0) return false

  const contextIdentityParts = [
    context.brand_text && context.product_name_text
      ? `${context.brand_text} ${context.product_name_text}`
      : null,
    context.product_name_text,
    context.display_name,
  ].filter((part): part is string => Boolean(part?.trim()))

  return lookupIdentityParts.some((lookupIdentity) =>
    contextIdentityParts.some((contextIdentity) =>
      normalizedProductTextOverlaps(
        lookupIdentity,
        contextIdentity,
        execution.input.brand_text ?? context.brand_text,
      ),
    ),
  )
}

function buildRecoveredNotFoundProductLookupFailureFallback(params: {
  namedProductContext: AgentV2NamedProductContext | null
  executions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  latestUserMessage: string
}): AgentV2TerminalAnswer | null {
  const context = params.namedProductContext
  if (!context || context.named_product_intent === "background") return null
  if (!params.trace.failure_stage) return null

  const eligibleExecutions = params.executions.filter(
    (execution) => execution.result.status === "not_found" && execution.result.intake_offer,
  )
  if (eligibleExecutions.length === 0) return null

  const matchingExecution =
    eligibleExecutions.find((execution) =>
      productLookupExecutionMatchesNamedProductContext(
        execution,
        context,
        params.latestUserMessage,
      ),
    ) ?? (eligibleExecutions.length === 1 ? eligibleExecutions[0] : null)
  if (!matchingExecution) return null

  return buildDeterministicNamedProductFallbackAnswer({
    context,
    lookupResult: matchingExecution.result,
    usedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
  })
}

function productLookupExecutionMatchesNamedProductContext(
  execution: ProductLookupExecution,
  context: AgentV2NamedProductContext,
  latestUserMessage: string,
): boolean {
  const category = AgentV2CareCategorySchema.safeParse(execution.input.category)
  if (category.success && category.data !== context.category) return false

  const identityParts = [
    execution.input.brand_text && execution.input.product_name_text
      ? `${execution.input.brand_text} ${execution.input.product_name_text}`
      : null,
    execution.input.product_name_text,
  ].filter((part): part is string => Boolean(part?.trim()))
  if (identityParts.length === 0) return false

  const evidenceParts = [context.display_name, latestUserMessage].filter((part) =>
    Boolean(part.trim()),
  )
  return identityParts.some((identity) =>
    evidenceParts.some((evidence) =>
      normalizedProductTextOverlaps(identity, evidence, execution.input.brand_text),
    ),
  )
}

function buildLookupInputFromNamedProductContext(
  context: AgentV2NamedProductContext,
  brandCatalog: BrandResolutionCatalogInput,
): ProductLookupExecutionInput | null {
  if (!isProductIntakeCategoryKey(context.category)) return null

  const category = context.category
  const categoryProductName = getFallbackProductNameForCategory(category)
  const displayName = context.display_name.trim()
  const displayWithoutCategory = stripTrailingCategoryTerm(displayName, category)
  if (!displayWithoutCategory) return null

  const knownBrandPrefix = findKnownBrandPrefix(displayWithoutCategory, brandCatalog)
  if (knownBrandPrefix) {
    const productNameRemainder = displayWithoutCategory.slice(knownBrandPrefix.raw.length).trim()
    return {
      category,
      brand_text: knownBrandPrefix.raw,
      product_name_text: [productNameRemainder, categoryProductName].filter(Boolean).join(" "),
    }
  }

  const tokens = Array.from(
    displayWithoutCategory.matchAll(/[\p{L}\p{M}\p{N}&'.-]+/gu),
    (match) => match[0],
  )
  if (tokens.length === 0) return null
  if (tokens.some((token) => token === "&")) {
    return {
      category,
      brand_text: displayWithoutCategory,
      product_name_text: categoryProductName,
    }
  }
  if (tokens.length >= 3) {
    return {
      category,
      brand_text: tokens.slice(0, 2).join(" "),
      product_name_text: [...tokens.slice(2), categoryProductName].join(" "),
    }
  }

  return {
    category,
    brand_text: displayWithoutCategory,
    product_name_text: categoryProductName,
  }
}

function stripTrailingCategoryTerm(displayName: string, category: ProductIntakeCategoryKey) {
  const terms = [
    PRODUCT_LOOKUP_CATEGORY_LABELS[category],
    ...getAgentV2NamedProductCategoryReferenceTerms(category),
  ]
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)

  const normalizedDisplay = normalizeProductLookupText(displayName)
  for (const term of terms) {
    const normalizedTerm = normalizeProductLookupText(term)
    if (normalizedDisplay === normalizedTerm || normalizedDisplay.endsWith(` ${normalizedTerm}`)) {
      const rawSuffixStart = findRawSuffixStartByNormalizedTerm(displayName, normalizedTerm)
      return displayName.slice(0, rawSuffixStart ?? displayName.length - term.length).trim()
    }
  }
  return displayName
}

function findRawSuffixStartByNormalizedTerm(text: string, normalizedTerm: string): number | null {
  for (let start = 0; start < text.length; start += 1) {
    if (start > 0 && !/\s/u.test(text[start - 1] ?? "")) continue
    if (normalizeProductLookupText(text.slice(start)) === normalizedTerm) return start
  }
  return null
}

function findRawPrefixByNormalizedTerm(text: string, normalizedTerm: string): string | null {
  for (let end = 1; end <= text.length; end += 1) {
    const normalizedSlice = normalizeProductLookupText(text.slice(0, end))
    if (normalizedSlice === normalizedTerm) {
      const remainder = text.slice(end)
      if (!remainder || /^\s/u.test(remainder)) return text.slice(0, end).trim()
    }
    if (normalizedSlice.length > normalizedTerm.length + 2) return null
  }
  return null
}

function findKnownBrandPrefix(
  text: string,
  brandCatalog: BrandResolutionCatalogInput,
): { raw: string; normalizedLength: number } | null {
  const candidates = [
    ...brandCatalog.brands.map(
      (brand) => brand.canonical_name ?? brand.canonicalName ?? brand.name,
    ),
    ...(brandCatalog.brandAliases ?? []).map((alias) => alias.alias),
  ]
    .filter((candidate): candidate is string => Boolean(candidate?.trim()))
    .sort((left, right) => right.length - left.length)

  const normalizedText = normalizeProductLookupText(text)
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeProductLookupText(candidate)
    if (
      normalizedText === normalizedCandidate ||
      normalizedText.startsWith(`${normalizedCandidate} `)
    ) {
      const rawPrefix = findRawPrefixByNormalizedTerm(text, normalizedCandidate)
      return { raw: rawPrefix ?? candidate, normalizedLength: normalizedCandidate.length }
    }
  }
  return null
}

function getFallbackProductNameForCategory(category: ProductIntakeCategoryKey) {
  switch (category) {
    case "mask":
      return "Maske"
    case "oil":
      return "Öl"
    case "deep_cleansing_shampoo":
      return "Tiefenreinigungsshampoo"
    case "dry_shampoo":
      return "Trockenshampoo"
    default:
      return PRODUCT_LOOKUP_CATEGORY_LABELS[category]
  }
}

function buildDeterministicNamedProductFallbackAnswer(params: {
  context: AgentV2NamedProductContext
  lookupResult: ProductLookupResult
  usedGuidancePackageIds: readonly string[]
}): AgentV2TerminalAnswer {
  const category = params.context.category
  const displayName = params.context.display_name
  const baseAnswer = {
    interpreted_intent: "Deterministic named-product lookup fallback after model skipped lookup.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: category,
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: displayName,
      specific_product_candidate: true,
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: {
      hair_concerns: [],
      goals: [],
      product_categories: [category],
      budget_eur: null,
      avoid_ingredients: [],
      allergies: [],
      preferences: [],
      routine_layer: null,
      raw_constraints: [displayName],
    },
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [...params.usedGuidancePackageIds],
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: ["product.no_uncatalogued_products"],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category,
      return_path: [],
    },
    pending_followup_action: null,
    session_memory_writes: [],
  } satisfies Omit<AgentV2TerminalAnswer, "answer_mode" | "payload">

  if (params.lookupResult.status === "found_exact" && params.lookupResult.product) {
    const productName = chooseRicherResolvedProductName(
      params.lookupResult.product.name,
      displayName,
    )
    const userFacingAnswer = `Ich habe ${productName} in unserer Produktdatenbank gefunden und nutze ab jetzt genau diesen Produktdatensatz als Bezug. Damit ist klar, welches Produkt du meinst.`
    return {
      ...baseAnswer,
      answer_mode: "general_advice",
      payload: {
        user_facing_answer_de: userFacingAnswer,
        category_or_topic: category,
        key_points_de: [userFacingAnswer],
        next_step_offer_de: null,
      },
    }
  }

  if (params.lookupResult.status !== "not_found") {
    const userFacingAnswer = `Ich habe ${displayName} noch nicht eindeutig gefunden. Bitte wähle kurz die passende Variante aus oder füge dein Produkt hinzu, damit ich nichts Falsches bewerte.`
    return {
      ...baseAnswer,
      answer_mode: "clarification",
      payload: {
        user_facing_answer_de: userFacingAnswer,
        question_de: "Welche Variante meinst du?",
        missing_keys: ["product_variant"],
      },
    }
  }

  const userFacingAnswer = `Ich habe ${displayName} noch nicht in unserer Datenbank. Wenn du magst, füge es kurz hinzu, dann prüfen wir es konkret für dich.`

  return {
    ...baseAnswer,
    answer_mode: "constraint_blocked",
    payload: {
      user_facing_answer_de: userFacingAnswer,
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: "Du kannst das Produkt hinzufügen, damit wir es konkret prüfen können.",
    },
  }
}

function chooseRicherResolvedProductName(
  catalogName: string | null | undefined,
  displayName: string,
) {
  const cleanCatalogName = catalogName?.trim()
  if (!cleanCatalogName) return displayName
  if (normalizedTokenCount(cleanCatalogName) >= normalizedTokenCount(displayName)) {
    return cleanCatalogName
  }
  return displayName
}

function normalizedTokenCount(value: string) {
  const normalized = normalizeProductLookupText(value)
  return normalized ? normalized.split(/\s+/u).filter(Boolean).length : 0
}

function answerSupportsProductIntakeOffer(answer: AgentV2TerminalAnswer): boolean {
  if (!answer.request_interpretation.specific_product_candidate) return false
  const { product_request_kind: productRequestKind, routine_intent: routineIntent } =
    answer.request_interpretation
  if (
    productRequestKind === "specific_products" ||
    productRequestKind === "compare_products" ||
    productRequestKind === "product_detail"
  ) {
    return true
  }
  return routineIntent === "modify" || routineIntent === "replace_product"
}

function productLookupExecutionMatchesAnswer(
  execution: ProductLookupExecution,
  answer: AgentV2TerminalAnswer,
  latestUserMessage: string,
): boolean {
  if (
    answerNeedsLookupCategoryTargetMatch(answer) &&
    !lookupCategoryMatchesAnswer(execution, answer)
  ) {
    return false
  }

  const identityParts = [
    execution.input.brand_text && execution.input.product_name_text
      ? `${execution.input.brand_text} ${execution.input.product_name_text}`
      : null,
    !execution.input.brand_text ? execution.input.product_name_text : null,
    execution.result.product?.name,
  ].filter((part): part is string => Boolean(part?.trim()))

  if (identityParts.length === 0) return true

  const evidenceParts = [answer.request_interpretation.evidence_quote, latestUserMessage].filter(
    (part): part is string => Boolean(part?.trim()),
  )
  return identityParts.some((identity) =>
    evidenceParts.some(
      (evidence) =>
        normalizedProductTextOverlaps(identity, evidence, execution.input.brand_text) &&
        lookupCategoryMatchesEvidence(execution.input.category, evidence, answer),
    ),
  )
}

function answerNeedsLookupCategoryTargetMatch(answer: AgentV2TerminalAnswer): boolean {
  return (
    answer.request_interpretation.product_request_kind === "specific_products" ||
    answer.request_interpretation.product_request_kind === "compare_products"
  )
}

function lookupCategoryMatchesAnswer(
  execution: ProductLookupExecution,
  answer: AgentV2TerminalAnswer,
): boolean {
  const lookupCategory = AgentV2CareCategorySchema.safeParse(execution.input.category)
  if (
    !lookupCategory.success ||
    lookupCategory.data === "none" ||
    lookupCategory.data === "unknown"
  ) {
    return false
  }
  const answerCategory = answer.request_interpretation.care_category
  if (answerCategory === "none" || answerCategory === "unknown") return false
  return lookupCategory.data === answerCategory
}

function lookupCategoryMatchesEvidence(
  category: string | null,
  evidence: string,
  answer?: AgentV2TerminalAnswer,
): boolean {
  if (!category) return true
  const parsedCategory = AgentV2CareCategorySchema.safeParse(category)
  if (!parsedCategory.success) return true
  if (
    answer &&
    parsedCategory.data !== "none" &&
    parsedCategory.data !== "unknown" &&
    answer.request_interpretation.care_category === parsedCategory.data
  ) {
    return true
  }
  const categoryTerms = getAgentV2NamedProductCategoryReferenceTerms(parsedCategory.data)
  if (categoryTerms.length === 0) return true
  const normalizedEvidence = normalizeProductLookupText(evidence)
  return categoryTerms.some((term) => normalizedEvidence.includes(normalizeProductLookupText(term)))
}

function normalizedProductTextOverlaps(
  a: string,
  b: string,
  requiredBrand?: string | null,
): boolean {
  const normalizedA = normalizeProductLookupText(a)
  const normalizedB = normalizeProductLookupText(b)
  if (!normalizedA || !normalizedB) return false
  const normalizedRequiredBrand = requiredBrand ? normalizeProductLookupText(requiredBrand) : ""
  if (normalizedRequiredBrand && !normalizedB.includes(normalizedRequiredBrand)) return false
  return (
    normalizedA === normalizedB ||
    normalizedA.includes(normalizedB) ||
    normalizedB.includes(normalizedA)
  )
}

function normalizeProductLookupText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}
