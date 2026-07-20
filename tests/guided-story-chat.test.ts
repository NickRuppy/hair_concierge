import assert from "node:assert/strict"
import fs from "node:fs/promises"
import test from "node:test"

import {
  GUIDED_STORY_CHAT_EXCHANGES,
  selectGuidedStoryChatExchange,
} from "../src/lib/quiz/guided-story-chat"
import type { QuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"
import type { GuidedStoryPriority } from "../src/lib/quiz/guided-story-priorities"
import type { OfferPreviewCategory } from "../src/lib/quiz/offer-preview-types"

type Priority = Pick<GuidedStoryPriority, "family" | "isFallback">

function preview({
  priorities,
  categories = ["shampoo", "conditioner"],
  scalpRoute = "balanced",
  thickness = "normal",
  extra = null,
}: {
  priorities: Priority[]
  categories?: OfferPreviewCategory[]
  scalpRoute?: QuizGuidedStoryPreview["needs"]["shampoo"]["scalpRoute"]
  thickness?: QuizGuidedStoryPreview["needs"]["shampoo"]["thickness"]
  extra?: QuizGuidedStoryPreview["needs"]["extra"]
}): Pick<QuizGuidedStoryPreview, "priorities" | "needs" | "products"> {
  return {
    priorities: priorities.map((priority) => ({ ...priority })) as GuidedStoryPriority[],
    needs: {
      shampoo: { scalpRoute, thickness, cleansingIntensity: "regular", cadence: { label: "" } },
      conditioner: { weight: "medium", balance: "balanced", cadence: { label: "" } },
      extra,
    },
    products: categories.map((category) => ({ category })) as QuizGuidedStoryPreview["products"],
  }
}

const priority = (family: GuidedStoryPriority["family"], isFallback = false): Priority => ({
  family,
  ...(isFallback ? { isFallback } : {}),
})

test("keeps the complete approved closed roster with the two product-safe mask corrections", () => {
  assert.equal(GUIDED_STORY_CHAT_EXCHANGES.length, 12)
  assert.deepEqual(
    GUIDED_STORY_CHAT_EXCHANGES.map((exchange) => exchange.id),
    [
      "dandruff_shampoo",
      "dry_scalp_shampoo",
      "oily_scalp_shampoo",
      "bond_care",
      "protein_mask",
      "moisture_mask",
      "leave_in",
      "curl_leave_in",
      "hair_oil",
      "fine_hair_conditioner",
      "base_order",
      "safe_fallback",
    ],
  )
  for (const id of ["protein_mask", "moisture_mask"] as const) {
    const answer = GUIDED_STORY_CHAT_EXCHANGES.find((exchange) => exchange.id === id)?.answer ?? ""
    assert.match(answer, /gelegentlich/)
    assert.match(answer, /Produktangabe/)
    assert.doesNotMatch(answer, /zwei bis drei|Danach folgt dein Conditioner/)
  }
})

test("selects each routable approved exchange from its linked priority and selected routine step", () => {
  const cases: Array<{
    id: string
    input: Parameters<typeof preview>[0]
  }> = [
    {
      id: "dandruff_shampoo",
      input: { priorities: [priority("scalp_flakes")], scalpRoute: "dandruff" },
    },
    {
      id: "dry_scalp_shampoo",
      input: { priorities: [priority("scalp_comfort")], scalpRoute: "dry" },
    },
    {
      id: "oily_scalp_shampoo",
      input: { priorities: [priority("scalp_comfort")], scalpRoute: "oily" },
    },
    {
      id: "bond_care",
      input: {
        priorities: [priority("strength_damage")],
        categories: ["shampoo", "conditioner", "bondbuilder"],
        extra: { category: "bondbuilder", cadence: { label: "" } },
      },
    },
    {
      id: "protein_mask",
      input: {
        priorities: [priority("strength_damage")],
        categories: ["shampoo", "conditioner", "protein_mask"],
        extra: { category: "protein_mask", cadence: { label: "" } },
      },
    },
    {
      id: "moisture_mask",
      input: {
        priorities: [priority("moisture_dryness")],
        categories: ["shampoo", "conditioner", "moisture_mask"],
        extra: { category: "moisture_mask", cadence: { label: "" } },
      },
    },
    {
      id: "leave_in",
      input: {
        priorities: [priority("surface_manageability")],
        categories: ["shampoo", "conditioner", "leave_in"],
        extra: { category: "leave_in", cadence: { label: "" }, variant: "general" },
      },
    },
    {
      id: "curl_leave_in",
      input: {
        priorities: [priority("definition")],
        categories: ["shampoo", "conditioner", "leave_in"],
        extra: { category: "leave_in", cadence: { label: "" }, variant: "curl" },
      },
    },
    {
      id: "hair_oil",
      input: {
        priorities: [priority("ends_protection")],
        categories: ["shampoo", "conditioner", "oil"],
        extra: { category: "oil", cadence: { label: "" } },
      },
    },
    {
      id: "fine_hair_conditioner",
      input: { priorities: [priority("volume_weight")], thickness: "fine" },
    },
  ]

  for (const { id, input } of cases) {
    assert.equal(selectGuidedStoryChatExchange(preview(input)).id, id)
  }
})

test("uses the first approved pair for the highest safe ordered priority", () => {
  const selected = selectGuidedStoryChatExchange(
    preview({
      priorities: [priority("moisture_dryness"), priority("strength_damage")],
      categories: ["shampoo", "conditioner", "protein_mask", "moisture_mask"],
      extra: { category: "moisture_mask", cadence: { label: "" } },
    }),
  )

  assert.equal(selected.id, "moisture_mask")
})

test("honors scalp route, selected category, routine variant, and required known facts", () => {
  assert.equal(
    selectGuidedStoryChatExchange(
      preview({ priorities: [priority("scalp_flakes")], scalpRoute: "oily" }),
    ).id,
    "base_order",
  )
  assert.equal(
    selectGuidedStoryChatExchange(
      preview({
        priorities: [priority("strength_damage")],
        categories: ["shampoo", "conditioner"],
      }),
    ).id,
    "base_order",
  )
  assert.equal(
    selectGuidedStoryChatExchange(
      preview({
        priorities: [priority("surface_manageability")],
        categories: ["shampoo", "conditioner", "leave_in"],
        extra: { category: "leave_in", cadence: { label: "" }, variant: "curl" },
      }),
    ).id,
    "curl_leave_in",
  )
  assert.equal(
    selectGuidedStoryChatExchange(
      preview({ priorities: [priority("volume_weight")], thickness: "normal" }),
    ).id,
    "base_order",
  )
})

test("uses the explicit base order for color and the safe fallback for sparse or legacy previews", () => {
  assert.equal(
    selectGuidedStoryChatExchange(preview({ priorities: [priority("color_protection")] })).id,
    "base_order",
  )
  assert.equal(selectGuidedStoryChatExchange(preview({ priorities: [] })).id, "safe_fallback")
  assert.equal(
    selectGuidedStoryChatExchange(
      preview({ priorities: [priority("scalp_comfort", true), priority("volume_weight", true)] }),
    ).id,
    "safe_fallback",
  )
})

test("has no live chat, model, request, or AgentV2 dependency", async () => {
  const source = await fs.readFile(
    new URL("../src/lib/quiz/guided-story-chat.ts", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(source, /agent-v2|AgentV2|fetch\(|axios|openai|model|request/i)
})
