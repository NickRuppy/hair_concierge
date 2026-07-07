import assert from "node:assert/strict"
import test from "node:test"

import {
  buildRoutineChatSeedMessage,
  clearRoutineTriggerSeed,
  createRoutineTriggerStorageKey,
  readRoutineTriggerSeed,
  launchRoutineChatTrigger,
  persistRoutineTriggerSeed,
  type RoutineChatTriggerInput,
} from "../src/lib/routines/chat-triggers"
import { createRoutineChatTriggerPostHandler } from "../src/app/api/chat/trigger/route"
import type { RoutineUiCard } from "../src/lib/routines/types"

function baseTrigger(overrides: Partial<RoutineChatTriggerInput> = {}): RoutineChatTriggerInput {
  return {
    type: "onboard_category",
    category: "mask",
    categoryLabel: "Haarkur",
    productName: "Repair Mask",
    brand: "Beispielmarke",
    currentFrequency: "1x pro Woche",
    targetFrequency: "1-2x pro Woche",
    reason: "meine Längen wirken trocken",
    ...overrides,
  }
}

function routineCard(overrides: Partial<RoutineUiCard> = {}): RoutineUiCard {
  return {
    id: "usage-1",
    kind: "verified_matches",
    tone: "green",
    category: "mask",
    categoryLabel: "Haarkur",
    productName: "Server Brand Server Mask",
    currentFrequency: "weekly_1x",
    frequencyTarget: {
      minFrequency: "biweekly_1x",
      maxFrequency: "weekly_1x",
      preferredFrequency: "weekly_1x",
      delta: "in_range",
    },
    careBalanceRow: null,
    usageRow: { id: "usage-1" } as never,
    product: { id: "product-1", brand: "Server Brand", name: "Server Mask" } as never,
    pendingSubmission: null,
    hasProductDrawer: true,
    isLegacyTextOnly: false,
    isTopProposal: false,
    ...overrides,
  }
}

type TriggerCall = { table: string; operation: string; payload?: unknown }

function createRecordingStateClient(
  calls: TriggerCall[],
  options: {
    upsertError?: { message?: string } | null
    updateError?: { message?: string } | null
  } = {},
) {
  return {
    from(table: "conversation_states" | "conversations") {
      if (table === "conversation_states") {
        return {
          upsert(payload: unknown, upsertOptions: unknown) {
            calls.push({ table, operation: "upsert", payload: { payload, options: upsertOptions } })
            return Promise.resolve({ error: options.upsertError ?? null })
          },
        }
      }

      return {
        update(payload: unknown) {
          calls.push({ table, operation: "update", payload })
          const query = {
            eq(column: string, value: string) {
              calls.push({ table, operation: `eq:${column}`, payload: value })
              return query
            },
            then(
              resolve: (value: { error: { message?: string } | null }) => unknown,
              reject?: (reason: unknown) => unknown,
            ) {
              return Promise.resolve({ error: options.updateError ?? null }).then(resolve, reject)
            },
          }
          return query
        },
      }
    },
  } as never
}

test("routine trigger seeds are German first-person messages with visible routine context", () => {
  const onboarding = buildRoutineChatSeedMessage(baseTrigger())
  assert.match(onboarding, /^Ich /)
  assert.match(onboarding, /Beispielmarke Repair Mask als Haarkur sinnvoll in meine Routine/)
  assert.match(onboarding, /warum diese Kategorie für mich sinnvoll sein könnte/)
  assert.match(onboarding, /Bitte noch keine konkreten Produktempfehlungen/)
  assert.match(onboarding, /aktuell nutze ich es 1x pro Woche/)
  assert.match(onboarding, /Chaarlies Ziel wäre 1-2x pro Woche/)
  assert.match(onboarding, /der Grund ist: meine Längen wirken trocken/)
  assert.doesNotMatch(onboarding, /TODO|placeholder|example/i)

  const product = buildRoutineChatSeedMessage(
    baseTrigger({
      type: "discuss_product",
      categoryLabel: "Leave-in",
      productName: "Curl Cream",
      brand: "Curl Co",
      currentFrequency: "nach jeder Wäsche",
      targetFrequency: null,
      reason: "ich bin unsicher, ob es zu schwer ist",
    }),
  )
  assert.match(product, /Ich benutze aktuell Curl Co Curl Cream als Leave-in/)
  assert.match(product, /aktuell nutze ich es nach jeder Wäsche/)
  assert.match(product, /der Grund ist: ich bin unsicher, ob es zu schwer ist/)

  const alternatives = buildRoutineChatSeedMessage(
    baseTrigger({
      type: "alternatives",
      categoryLabel: "Shampoo",
      productName: "Daily Wash",
      brand: "Clean Co",
      currentFrequency: "2x pro Woche",
      targetFrequency: null,
      reason: "ich suche eine passendere Alternative",
    }),
  )
  assert.match(alternatives, /Ich suche passende Alternativen/)
  assert.match(alternatives, /Clean Co Daily Wash/)
  assert.match(alternatives, /aktuell nutze ich es 2x pro Woche/)
  assert.match(alternatives, /der Grund ist: ich suche eine passendere Alternative/)
  assert.match(alternatives, /klare Kriterien/)
})

test("routine trigger storage helper persists seed under deterministic conversation key", () => {
  const writes = new Map<string, string>()
  const storage = {
    setItem(key: string, value: string) {
      writes.set(key, value)
    },
  }

  persistRoutineTriggerSeed("conversation-1", "Bitte prüfe meine Routine.", storage)

  assert.equal(createRoutineTriggerStorageKey("conversation-1"), "routine-trigger:conversation-1")
  assert.equal(writes.get("routine-trigger:conversation-1"), "Bitte prüfe meine Routine.")
})

test("routine trigger storage can read without deleting until send succeeds", () => {
  const values = new Map<string, string>([
    ["routine-trigger:conversation-1", "Bitte prüfe meine Routine."],
  ])
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }

  assert.equal(readRoutineTriggerSeed("conversation-1", storage), "Bitte prüfe meine Routine.")
  assert.equal(values.get("routine-trigger:conversation-1"), "Bitte prüfe meine Routine.")

  clearRoutineTriggerSeed("conversation-1", storage)

  assert.equal(values.has("routine-trigger:conversation-1"), false)
})

test("routine trigger launcher uses session storage by default", async () => {
  const writes = new Map<string, string>()
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        setItem(key: string, value: string) {
          writes.set(key, value)
        },
      },
    },
  })

  try {
    await launchRoutineChatTrigger(
      { type: "onboard_category", cardId: "suggestion-mask", category: "mask" },
      {
        fetch: async () =>
          new Response(
            JSON.stringify({
              conversationId: "conversation-1",
              seedMessage: "Bitte prüfe meine Routine.",
            }),
            { status: 200 },
          ),
        navigate: () => {},
      },
    )
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    })
  }

  assert.equal(writes.get("routine-trigger:conversation-1"), "Bitte prüfe meine Routine.")
})

test("routine trigger endpoint creates only a conversation and returns a server-derived seed", async () => {
  const calls: TriggerCall[] = []
  const loadCalls: Array<{ userId: string }> = []
  const handler = createRoutineChatTriggerPostHandler({
    createClient: async () => ({
      auth: {
        async getUser() {
          return { data: { user: { id: "user-1" } }, error: null }
        },
      },
      from(table: string) {
        assert.notEqual(table, "messages", "trigger endpoint must not touch messages")
        return {
          insert(payload: unknown) {
            calls.push({ table, operation: "insert", payload })
            return {
              select(columns: string) {
                calls.push({ table, operation: `select:${columns}` })
                return {
                  async single() {
                    return { data: { id: "conversation-1" }, error: null }
                  },
                }
              },
            }
          },
          upsert(payload: unknown, options: unknown) {
            calls.push({ table, operation: "upsert", payload: { payload, options } })
            return Promise.resolve({ error: null })
          },
        }
      },
    }),
    createStateClient: () => createRecordingStateClient(calls),
    loadRoutineArtifactData: async (params) => {
      loadCalls.push(params)
      return {
        userId: params.userId,
        hairProfile: null,
        usageRows: [],
        pendingSubmissionsById: new Map(),
        activeDismissedCategories: new Set(),
        runtime: { careBalance: { rows: [] } },
      } as never
    },
    shapeRoutineForUi: () => ({ hairProfile: null, cards: [routineCard()] }),
  })

  const response = await handler(
    new Request("https://app.test/api/chat/trigger", {
      method: "POST",
      body: JSON.stringify(
        baseTrigger({
          type: "alternatives",
          cardId: "usage-1",
          categoryLabel: "Client Spoof",
          productName: "Client Product",
          brand: "Client Brand",
          reason: "client reason",
        }),
      ),
    }),
  )
  const body = (await response.json()) as { conversationId?: string; seedMessage?: string }

  assert.equal(response.status, 200)
  assert.equal(body.conversationId, "conversation-1")
  assert.match(body.seedMessage ?? "", /Ich suche passende Alternativen/)
  assert.match(body.seedMessage ?? "", /Server Brand Server Mask/)
  assert.doesNotMatch(
    body.seedMessage ?? "",
    /Client Spoof|Client Product|Client Brand|client reason/,
  )
  assert.deepEqual(loadCalls, [{ userId: "user-1" }])
  assert.deepEqual(calls[0], {
    table: "conversations",
    operation: "insert",
    payload: {
      user_id: "user-1",
      title: "Alternativen · Server Brand Server Mask",
      is_active: true,
    },
  })
  const stateUpsert = calls.find(
    (call) => call.table === "conversation_states" && call.operation === "upsert",
  )
  assert.equal(stateUpsert, undefined)
  assert.equal(
    calls.some((call) => call.table === "messages"),
    false,
  )
})

test("routine trigger endpoint seeds routine inventory product context for product discussions", async () => {
  const calls: TriggerCall[] = []
  const handler = createRoutineChatTriggerPostHandler({
    createClient: async () => ({
      auth: {
        async getUser() {
          return { data: { user: { id: "user-1" } }, error: null }
        },
      },
      from(table: string) {
        return {
          insert(payload: unknown) {
            calls.push({ table, operation: "insert", payload })
            return {
              select(columns: string) {
                calls.push({ table, operation: `select:${columns}` })
                return {
                  async single() {
                    return { data: { id: "conversation-1" }, error: null }
                  },
                }
              },
            }
          },
          upsert(payload: unknown, options: unknown) {
            calls.push({ table, operation: "upsert", payload: { payload, options } })
            return Promise.resolve({ error: null })
          },
        }
      },
    }),
    createStateClient: () => createRecordingStateClient(calls),
    loadRoutineArtifactData: async (params) =>
      ({
        userId: params.userId,
        hairProfile: null,
        usageRows: [],
        pendingSubmissionsById: new Map(),
        activeDismissedCategories: new Set(),
        runtime: { careBalance: { rows: [] } },
      }) as never,
    shapeRoutineForUi: () => ({ hairProfile: null, cards: [routineCard()] }),
  })

  const response = await handler(
    new Request("https://app.test/api/chat/trigger", {
      method: "POST",
      body: JSON.stringify(baseTrigger({ type: "discuss_product", cardId: "usage-1" })),
    }),
  )

  const body = (await response.json()) as { conversationId?: string; seedMessage?: string }
  assert.equal(response.status, 200)
  assert.equal(body.conversationId, "conversation-1")
  assert.match(body.seedMessage ?? "", /Ich benutze aktuell Server Brand Server Mask als Haarkur/)

  const stateUpsert = calls.find(
    (call) => call.table === "conversation_states" && call.operation === "upsert",
  )
  assert.ok(stateUpsert)
  assert.equal(
    (stateUpsert.payload as { payload: { conversation_id: string } }).payload.conversation_id,
    "conversation-1",
  )
  assert.equal(
    (
      stateUpsert.payload as {
        payload: {
          state: {
            agent_v2: {
              active_resolved_product_context: { product_id: string; source: string }
            }
          }
        }
      }
    ).payload.state.agent_v2.active_resolved_product_context.product_id,
    "product-1",
  )
  assert.equal(
    (
      stateUpsert.payload as {
        payload: {
          state: {
            agent_v2: {
              active_resolved_product_context: { product_id: string; source: string }
            }
          }
        }
      }
    ).payload.state.agent_v2.active_resolved_product_context.source,
    "routine_inventory",
  )
  assert.equal(
    calls.some((call) => call.table === "messages"),
    false,
  )
})

test("routine trigger endpoint deactivates the created conversation if context seeding fails", async () => {
  const calls: TriggerCall[] = []
  const handler = createRoutineChatTriggerPostHandler({
    createClient: async () => ({
      auth: {
        async getUser() {
          return { data: { user: { id: "user-1" } }, error: null }
        },
      },
      from(table: string) {
        return {
          insert(payload: unknown) {
            calls.push({ table, operation: "insert", payload })
            return {
              select(columns: string) {
                calls.push({ table, operation: `select:${columns}` })
                return {
                  async single() {
                    return { data: { id: "conversation-1" }, error: null }
                  },
                }
              },
            }
          },
          upsert(payload: unknown, options: unknown) {
            calls.push({ table, operation: "upsert", payload: { payload, options } })
            return Promise.resolve({ error: null })
          },
        }
      },
    }),
    createStateClient: () =>
      createRecordingStateClient(calls, { upsertError: { message: "state write failed" } }),
    loadRoutineArtifactData: async (params) =>
      ({
        userId: params.userId,
        hairProfile: null,
        usageRows: [],
        pendingSubmissionsById: new Map(),
        activeDismissedCategories: new Set(),
        runtime: { careBalance: { rows: [] } },
      }) as never,
    shapeRoutineForUi: () => ({ hairProfile: null, cards: [routineCard()] }),
  })

  const response = await handler(
    new Request("https://app.test/api/chat/trigger", {
      method: "POST",
      body: JSON.stringify(baseTrigger({ type: "discuss_product", cardId: "usage-1" })),
    }),
  )

  assert.equal(response.status, 500)
  assert.ok(
    calls.find((call) => call.table === "conversation_states" && call.operation === "upsert"),
  )
  assert.deepEqual(
    calls.filter((call) => call.table === "conversations" && call.operation === "update"),
    [{ table: "conversations", operation: "update", payload: { is_active: false } }],
  )
  assert.ok(
    calls.find(
      (call) =>
        call.table === "conversations" &&
        call.operation === "eq:id" &&
        call.payload === "conversation-1",
    ),
  )
  assert.ok(
    calls.find(
      (call) =>
        call.table === "conversations" &&
        call.operation === "eq:user_id" &&
        call.payload === "user-1",
    ),
  )
})
