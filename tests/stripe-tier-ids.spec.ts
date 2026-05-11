import { expect, test } from "@playwright/test"
import { getStripeTierIds, resetStripeTierIdsCacheForTests } from "../src/lib/stripe/tier-ids"

function supabaseWithResponses(responses: Array<{ data?: unknown; error?: { message: string } }>) {
  let calls = 0

  return {
    get calls() {
      return calls
    },
    client: {
      from(table: string) {
        expect(table).toBe("subscription_tiers")
        return {
          async select(columns: string) {
            expect(columns).toBe("id, slug")
            const response = responses[calls]
            calls += 1
            return response ?? responses.at(-1)
          },
        }
      },
    } as any,
  }
}

test.beforeEach(() => {
  resetStripeTierIdsCacheForTests()
})

test("getStripeTierIds retries after a transient subscription tier lookup failure", async () => {
  const supabase = supabaseWithResponses([
    { error: { message: "temporary timeout" } },
    {
      data: [
        { id: "tier-free", slug: "free" },
        { id: "tier-premium", slug: "premium" },
      ],
    },
  ])

  await expect(getStripeTierIds(supabase.client)).rejects.toThrow(
    "failed to load subscription_tiers: temporary timeout",
  )
  await expect(getStripeTierIds(supabase.client)).resolves.toEqual({
    freeTierId: "tier-free",
    premiumTierId: "tier-premium",
  })
  expect(supabase.calls).toBe(2)
})

test("getStripeTierIds caches successful subscription tier lookup", async () => {
  const supabase = supabaseWithResponses([
    {
      data: [
        { id: "tier-free", slug: "free" },
        { id: "tier-premium", slug: "premium" },
      ],
    },
  ])

  await expect(getStripeTierIds(supabase.client)).resolves.toEqual({
    freeTierId: "tier-free",
    premiumTierId: "tier-premium",
  })
  await expect(getStripeTierIds(supabase.client)).resolves.toEqual({
    freeTierId: "tier-free",
    premiumTierId: "tier-premium",
  })
  expect(supabase.calls).toBe(1)
})
