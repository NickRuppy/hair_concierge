import { z } from "zod"

import type { CustomerIoServerProperties, CustomerIoServerResult } from "./server"

const offerSectionIds = [
  "hero",
  "personalized_analysis",
  "mini_routine",
  "locked_routine",
  "unlock_explanation",
  "product_story_chat",
  "product_story_routine",
  "product_story_products",
  "testimonials",
  "subscription_explanation",
  "pricing",
  "guarantee",
  "faq",
  "final_cta",
] as const

const optionalShortText = z.string().trim().max(160).nullable().optional()
const optionalUuid = z.string().uuid().nullable().optional()

export const customerIoOfferEngagementSchema = z
  .object({
    analyticsConsent: z.literal(true),
    conditionerModuleId: optionalShortText,
    distinctSectionCount: z.number().int().min(0).max(offerSectionIds.length),
    entryContext: z.enum(["quiz_completion", "saved_result", "routine_return", "result_email"]),
    focusRoutine: z.boolean(),
    funnelEventId: optionalUuid,
    funnelPackageKey: optionalShortText,
    funnelSessionId: optionalUuid,
    leadId: z.string().uuid(),
    needLane: z.string().trim().min(1).max(80),
    offerRevision: z.string().trim().min(1).max(80),
    offerVariant: z.string().trim().min(1).max(80),
    offerViewId: z.string().uuid(),
    reason: z.enum(["cta_clicked", "faq_opened", "section_depth"]),
    shampooModuleId: optionalShortText,
    sourceSection: z.enum(offerSectionIds).optional(),
    suggestedCategory: optionalShortText,
  })
  .strict()

export type CustomerIoOfferEngagementInput = z.infer<typeof customerIoOfferEngagementSchema>

export type CustomerIoOfferEngagementDelivery = {
  event: "offer_engaged"
  messageId: string
  properties: CustomerIoServerProperties
  userId: string
}

export function buildCustomerIoOfferEngagementDelivery(
  input: CustomerIoOfferEngagementInput,
  email: string,
): CustomerIoOfferEngagementDelivery {
  return {
    userId: email.trim().toLowerCase(),
    event: "offer_engaged",
    messageId: `offer_engaged:${input.funnelEventId ?? input.offerViewId}`,
    properties: {
      conditioner_module_id: input.conditionerModuleId,
      distinct_section_count: input.distinctSectionCount,
      entry_context: input.entryContext,
      focus_routine: input.focusRoutine,
      funnel_event_id: input.funnelEventId,
      funnel_package_key: input.funnelPackageKey,
      funnel_session_id: input.funnelSessionId,
      lead_id: input.leadId,
      need_lane: input.needLane,
      offer_revision: input.offerRevision,
      offer_variant: input.offerVariant,
      offer_view_id: input.offerViewId,
      reason: input.reason,
      shampoo_module_id: input.shampooModuleId,
      source_section: input.sourceSection,
      suggested_category: input.suggestedCategory,
    },
  }
}

export async function deliverCustomerIoOfferEngagement(
  input: CustomerIoOfferEngagementInput,
  dependencies: {
    findLeadEmail: (leadId: string) => Promise<string | null>
    track: (delivery: CustomerIoOfferEngagementDelivery) => Promise<CustomerIoServerResult>
  },
) {
  const email = await dependencies.findLeadEmail(input.leadId)
  if (!email) return { ok: false as const, reason: "lead_not_found" as const }

  const delivery = buildCustomerIoOfferEngagementDelivery(input, email)
  const result = await dependencies.track(delivery)
  if (!result.ok && !result.skipped) {
    return { ok: false as const, reason: "delivery_failed" as const, result }
  }

  return { ok: true as const, result }
}
