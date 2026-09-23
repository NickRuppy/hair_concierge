import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createDiscoveryIdentifyHandler } from "../src/app/api/beratung/identify/route"
import { createDiscoveryIntakeItemsHandler } from "../src/app/api/beratung/intake/items/route"
import { createDiscoveryIntakeItemDeleteHandler } from "../src/app/api/beratung/intake/items/[itemId]/route"
import { createDiscoveryIntakeSubmitHandler } from "../src/app/api/beratung/intake/submit/route"
import {
  DISCOVERY_INTAKE_CATEGORIES,
  checkDiscoveryIntakeItemIdentity,
  clearDiscoveryIntakeCoexistingNone,
  loadDiscoverySubmissionCategory,
  type DiscoveryAdminClient,
  type DiscoveryIntake,
  type DiscoveryIntakeIdentityDependencies,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/intake"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"

/**
 * The authorization contract every intake endpoint shares. Each test drives the
 * REAL guard (`resolveDiscoveryIntakeContext`) with injected loaders rather than
 * stubbing the guard out, so the ordering — session, then live enrollment, then
 * ownership — is what is actually under test.
 *
 * `discovery_intakes.user_id` has no database link to the enrollment's
 * `claimed_user_id`; that pairing exists only in code, which is exactly why it
 * gets its own test here.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  otherUser: "20000000-0000-4000-8000-000000000003",
  product: "20000000-0000-4000-8000-000000000009",
  item: "50000000-0000-4000-8000-000000000005",
}

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lea Sommer",
  email: "lea@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-22T10:00:00.000Z",
  createdAt: "2026-09-22T09:00:00.000Z",
}

const draftIntake: DiscoveryIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "draft",
  submittedAt: null,
}

/**
 * Stands in for `loadDiscoveryEnrollmentForUser`, reproducing its two predicates
 * (`revoked_at IS NULL`, `claimed_user_id = userId`) over one in-memory row — the
 * SQL itself is covered by the enrollment-service suite.
 */
function enrollmentLoader(row: (DiscoveryEnrollment & { revoked?: boolean }) | null) {
  return async (userId: string) => {
    if (!row) return null
    if (row.revoked) return null
    if (row.claimedUserId !== userId) return null
    const { revoked: _revoked, ...enrollmentRow } = row
    return enrollmentRow
  }
}

type Deps = Record<string, unknown>

/**
 * The REAL `checkDiscoveryIntakeItemIdentity`, driven through injected catalog
 * reads — so what the route's 422s are proven against is the rule itself, not a
 * stand-in for it. The defaults say yes to everything, which is what makes an
 * override below the single reason a given test refuses.
 */
function checkIdentityWith(overrides: Partial<DiscoveryIntakeIdentityDependencies> = {}) {
  const deps: DiscoveryIntakeIdentityDependencies = {
    filterEligibleProductIds: async (_client, productIds) => new Set(productIds),
    loadProductCategory: async () => "shampoo",
    // Models ONE stored submission, owned by the participant — and the read is
    // scoped, so it answers nothing for any other account.
    loadSubmissionCategory: async (_client, _submissionId, userId) =>
      userId === ids.user ? "shampoo" : null,
    ...overrides,
  }
  return (
    input: Parameters<typeof checkDiscoveryIntakeItemIdentity>[0],
    client: DiscoveryAdminClient,
  ) => checkDiscoveryIntakeItemIdentity(input, client, deps)
}

function baseDeps(overrides: Deps = {}): Deps {
  return {
    flagEnabled: () => true,
    getUserId: async () => ids.user,
    loadEnrollment: enrollmentLoader(enrollment),
    createAdminClient: () => ({}) as never,
    getOrCreateIntake: async () => draftIntake,
    checkIdentity: checkIdentityWith(),
    ...overrides,
  }
}

function itemsRequest(body: unknown) {
  return new NextRequest("https://chaarlie.de/api/beratung/intake/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function identifyRequest(body: unknown) {
  return new NextRequest("https://chaarlie.de/api/beratung/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest() {
  return new NextRequest("https://chaarlie.de/api/beratung/intake/items/x", { method: "DELETE" })
}

const params = { params: Promise.resolve({ itemId: ids.item }) }

const storedItem: DiscoveryIntakeItem = {
  id: ids.item,
  category: "shampoo",
  source: "catalog_search",
  brandText: "Elvital",
  productNameText: "Hyaluron Pure",
  barcodeIdentifier: null,
  productId: ids.product,
  productSubmissionId: null,
}

const validCapture = {
  category: "shampoo",
  capture: {
    source: "catalog_search",
    productId: ids.product,
    brandText: "Elvital",
    productNameText: "Hyaluron Pure",
  },
}

// --- The shared guard, proven on every endpoint ------------------------------

const endpoints: Array<{ name: string; call: (deps: Deps) => Promise<Response> }> = [
  {
    name: "POST /api/beratung/intake/items",
    call: (deps) => createDiscoveryIntakeItemsHandler(deps)(itemsRequest(validCapture)),
  },
  {
    name: "DELETE /api/beratung/intake/items/<id>",
    call: (deps) => createDiscoveryIntakeItemDeleteHandler(deps)(deleteRequest(), params),
  },
  {
    name: "POST /api/beratung/intake/submit",
    call: (deps) => createDiscoveryIntakeSubmitHandler(deps)(),
  },
  {
    name: "POST /api/beratung/identify",
    call: (deps) =>
      createDiscoveryIdentifyHandler(deps)(identifyRequest({ identifier: "4005808858149" })),
  },
]

for (const endpoint of endpoints) {
  test(`${endpoint.name} refuses a signed-out caller with 401`, async () => {
    const response = await endpoint.call(baseDeps({ getUserId: async () => null }))
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { code: "unauthenticated" })
  })

  test(`${endpoint.name} answers 404 for an account with no enrollment`, async () => {
    const response = await endpoint.call(baseDeps({ loadEnrollment: enrollmentLoader(null) }))
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { code: "not_enrolled" })
  })

  test(`${endpoint.name} refuses a REVOKED participant, stamp or no stamp`, async () => {
    const response = await endpoint.call(
      baseDeps({ loadEnrollment: enrollmentLoader({ ...enrollment, revoked: true }) }),
    )
    assert.equal(response.status, 404)
  })

  test(`${endpoint.name} answers 403 when the intake belongs to another account`, async () => {
    const response = await endpoint.call(
      baseDeps({
        getOrCreateIntake: async () => ({ ...draftIntake, userId: ids.otherUser }),
      }),
    )
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { code: "forbidden" })
  })

  test(`${endpoint.name} answers 403 for an enrollment claimed by someone else`, async () => {
    // The loader is user-scoped, so this can only happen if it ever stops being
    // — the route re-checks the pairing itself rather than trusting the query.
    const response = await endpoint.call(
      baseDeps({ loadEnrollment: async () => ({ ...enrollment, claimedUserId: ids.otherUser }) }),
    )
    assert.equal(response.status, 403)
  })

  test(`${endpoint.name} is inert while the kill switch is off`, async () => {
    const response = await endpoint.call(baseDeps({ flagEnabled: () => false }))
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { code: "unavailable" })
  })

  test(`${endpoint.name} answers 503 when the enrollment lookup itself fails`, async () => {
    const response = await endpoint.call(
      baseDeps({
        loadEnrollment: async () => {
          throw new Error("database is down")
        },
      }),
    )
    assert.equal(response.status, 503)
  })
}

// --- The submitted intake is frozen ------------------------------------------

const submittedIntake: DiscoveryIntake = {
  ...draftIntake,
  state: "submitted",
  submittedAt: "2026-09-22T12:00:00.000Z",
}

test("a submitted intake accepts no further item writes", async () => {
  const deps = baseDeps({
    getOrCreateIntake: async () => submittedIntake,
    insertItem: async () => {
      throw new Error("must not be reached")
    },
    clearCategory: async () => {
      throw new Error("must not be reached")
    },
  })
  const response = await createDiscoveryIntakeItemsHandler(deps)(itemsRequest(validCapture))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { code: "already_submitted" })
})

test("a submitted intake accepts no deletes either", async () => {
  const response = await createDiscoveryIntakeItemDeleteHandler(
    baseDeps({
      getOrCreateIntake: async () => submittedIntake,
      deleteItem: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(deleteRequest(), params)
  assert.equal(response.status, 409)
})

test("a submitted intake cannot be submitted twice", async () => {
  const response = await createDiscoveryIntakeSubmitHandler(
    baseDeps({
      getOrCreateIntake: async () => submittedIntake,
      submitIntake: async () => {
        throw new Error("must not be reached")
      },
    }),
  )()
  assert.equal(response.status, 409)
})

// --- Item writes --------------------------------------------------------------

test("a product write clears only a standing „benutze ich nicht“, never the other products", async () => {
  const order: string[] = []
  const cleared: unknown[] = []
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      clearCategory: async (input: unknown) => {
        order.push("clear")
        cleared.push(input)
      },
      insertItem: async () => {
        order.push("insert")
        return storedItem
      },
    }),
  )(itemsRequest(validCapture))

  // The insert comes FIRST: a clear that ran first and an insert that then failed
  // would leave the category with no answer at all.
  assert.deepEqual(order, ["insert", "clear"])
  assert.equal(response.status, 201)
  // The response is the browser projection, not the stored row: the identity columns
  // the checklist never renders do not leave the server.
  assert.deepEqual(await response.json(), {
    item: {
      id: storedItem.id,
      category: storedItem.category,
      source: storedItem.source,
      brandText: storedItem.brandText,
      productNameText: storedItem.productNameText,
      barcodeIdentifier: storedItem.barcodeIdentifier,
    },
  })
  assert.deepEqual(cleared, [
    {
      intakeId: ids.intake,
      category: "shampoo",
      sources: ["none"],
      exceptItemId: storedItem.id,
    },
  ])
})

test("„benutze ich nicht“ replaces the whole category, except the row it just wrote", async () => {
  const order: string[] = []
  const cleared: unknown[] = []
  const noneItem = {
    ...storedItem,
    id: "50000000-0000-4000-8000-00000000000n",
    source: "none" as const,
  }
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      clearCategory: async (input: unknown) => {
        order.push("clear")
        cleared.push(input)
      },
      insertItem: async () => {
        order.push("insert")
        return noneItem
      },
    }),
  )(itemsRequest({ category: "mask", capture: { source: "none" } }))

  assert.equal(response.status, 201)
  // A `none` answer is the one capture with a clear BEFORE the insert too — the
  // partial unique index allows a single one per category, so a re-tap would
  // collide. That pre-clear drops only `none` rows, which carry no information the
  // replacement does not; the products are still only touched after the insert.
  assert.deepEqual(order, ["clear", "insert", "clear"])
  assert.deepEqual(cleared, [
    { intakeId: ids.intake, category: "mask", sources: ["none"] },
    { intakeId: ids.intake, category: "mask", exceptItemId: noneItem.id },
  ])
})

// --- Fix 5: a failed insert must never cost the previous answer ---------------

test("an insert that fails leaves the category's products untouched", async () => {
  const cleared: unknown[] = []
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      clearCategory: async (input: unknown) => {
        cleared.push(input)
      },
      insertItem: async () => {
        throw new Error("postgres is down")
      },
    }),
  )(itemsRequest(validCapture))

  assert.equal(response.status, 503)
  // Nothing was deleted at all: the participant's standing answer in this category
  // — „benutze ich nicht" or a product she captured earlier — is still there.
  assert.deepEqual(cleared, [])
})

test("a „benutze ich nicht“ whose insert fails deletes no products either", async () => {
  const cleared: unknown[] = []
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      clearCategory: async (input: unknown) => {
        cleared.push(input)
      },
      insertItem: async () => {
        throw new Error("postgres is down")
      },
    }),
  )(itemsRequest({ category: "mask", capture: { source: "none" } }))

  assert.equal(response.status, 503)
  // Only the information-free pre-clear ran, and it is scoped to `none` rows.
  assert.deepEqual(cleared, [{ intakeId: ids.intake, category: "mask", sources: ["none"] }])
})

test("a clear that fails AFTER a successful insert still reports the stored answer", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      clearCategory: async () => {
        throw new Error("postgres is down")
      },
      insertItem: async () => storedItem,
    }),
  )(itemsRequest(validCapture))

  // The row IS in the table, so telling the participant to try again would be a
  // lie. The two answers coexist until submit heals them.
  assert.equal(response.status, 201)
  assert.deepEqual((await response.json()).item.id, storedItem.id)
})

// --- Fix 4: the ids the client supplies are re-established server-side --------

test("a product that is not scan-eligible is a 422 and reaches no write", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      checkIdentity: checkIdentityWith({ filterEligibleProductIds: async () => new Set() }),
      clearCategory: async () => {
        throw new Error("must not be reached")
      },
      insertItem: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(itemsRequest(validCapture))

  assert.equal(response.status, 422)
  const body = await response.json()
  assert.equal(body.code, "unknown_product")
  assert.match(body.error, /Produkt/)
})

test("a product filed under the wrong category is a 422, eligible or not", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      // Eligible — the catalog simply says it is a mask, and the request says shampoo.
      checkIdentity: checkIdentityWith({ loadProductCategory: async () => "mask" }),
      insertItem: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(itemsRequest(validCapture))

  assert.equal(response.status, 422)
  assert.deepEqual((await response.json()).code, "category_mismatch")
})

test("a product with no catalog category at all is a mismatch, not a pass", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      checkIdentity: checkIdentityWith({ loadProductCategory: async () => null }),
      insertItem: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(itemsRequest(validCapture))
  assert.equal(response.status, 422)
  assert.deepEqual((await response.json()).code, "category_mismatch")
})

const submissionCapture = {
  category: "shampoo",
  capture: {
    source: "name_research",
    productSubmissionId: "30000000-0000-4000-8000-000000000004",
    brandText: "Kérastase",
    productNameText: "Bain Satin 2",
  },
}

test("a submission id that exists nowhere is a 422 and reaches no write", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      checkIdentity: checkIdentityWith({ loadSubmissionCategory: async () => null }),
      insertItem: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(itemsRequest(submissionCapture))

  assert.equal(response.status, 422)
  assert.deepEqual((await response.json()).code, "unknown_submission")
})

test("a submission opened for another category is a 422", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      checkIdentity: checkIdentityWith({ loadSubmissionCategory: async () => "oil" }),
      insertItem: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(itemsRequest(submissionCapture))

  assert.equal(response.status, 422)
  assert.deepEqual((await response.json()).code, "category_mismatch")
})

test("another account's submission is a 422, told apart from nothing at all", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      checkIdentity: checkIdentityWith({
        // The row exists and is in the right category — it just belongs to someone
        // else, so the account-scoped read answers nothing for this participant.
        loadSubmissionCategory: async (_client, _submissionId, userId) =>
          userId === ids.otherUser ? "shampoo" : null,
      }),
      insertItem: async () => {
        throw new Error("must not be reached")
      },
      clearCategory: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(itemsRequest(submissionCapture))

  assert.equal(response.status, 422)
  const body = await response.json()
  // Same code and same sentence as a missing submission: the refusal must not tell a
  // prober that the id exists under another account.
  assert.equal(body.code, "unknown_submission")
  assert.equal(body.error, "Diese Produktanfrage kennen wir nicht. Versuch es bitte nochmal.")
})

test("the participant's own submission still passes, and is read with HER user id", async () => {
  const asked: Array<[string, string]> = []
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      checkIdentity: checkIdentityWith({
        loadSubmissionCategory: async (_client, submissionId, userId) => {
          asked.push([submissionId, userId])
          return userId === ids.user ? "shampoo" : null
        },
      }),
      clearCategory: async () => {},
      insertItem: async () => ({ ...storedItem, source: "name_research" as const }),
    }),
  )(itemsRequest(submissionCapture))

  assert.equal(response.status, 201)
  // The id comes from the guard's session, never from the request body.
  assert.deepEqual(asked, [[submissionCapture.capture.productSubmissionId, ids.user]])
})

test("the submission read carries the ownership predicate in the query itself", async () => {
  const calls: Array<Record<string, unknown>> = []
  const client = {
    from: (table: string) => {
      const call: Record<string, unknown> = { table }
      calls.push(call)
      const chain = {
        select: (columns: string) => {
          call.select = columns
          return chain
        },
        eq: (column: string, value: unknown) => {
          call[`eq_${column}`] = value
          return chain
        },
        maybeSingle: async () => ({ data: { category: "shampoo" }, error: null }),
      }
      return chain
    },
  } as unknown as DiscoveryAdminClient

  assert.equal(
    await loadDiscoverySubmissionCategory(
      client,
      submissionCapture.capture.productSubmissionId,
      ids.user,
    ),
    "shampoo",
  )
  // A foreign row is never returned to be compared — it is filtered out in Postgres.
  assert.deepEqual(calls, [
    {
      table: "product_submissions",
      select: "category",
      eq_id: submissionCapture.capture.productSubmissionId,
      eq_user_id: ids.user,
    },
  ])
})

test("„benutze ich nicht“ carries no ids, so it asks the catalog nothing", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      checkIdentity: checkIdentityWith({
        filterEligibleProductIds: async () => {
          throw new Error("must not be reached")
        },
        loadProductCategory: async () => {
          throw new Error("must not be reached")
        },
        loadSubmissionCategory: async () => {
          throw new Error("must not be reached")
        },
      }),
      clearCategory: async () => {},
      insertItem: async () => ({ ...storedItem, source: "none" as const }),
    }),
  )(itemsRequest({ category: "mask", capture: { source: "none" } }))

  assert.equal(response.status, 201)
})

test("a resolved, correctly-filed product is stored exactly as before", async () => {
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({ clearCategory: async () => {}, insertItem: async () => storedItem }),
  )(itemsRequest(validCapture))
  assert.equal(response.status, 201)
  assert.deepEqual((await response.json()).item.id, storedItem.id)
})

test("a malformed capture is a 400 and never reaches the table", async () => {
  const deps = baseDeps({
    clearCategory: async () => {
      throw new Error("must not be reached")
    },
    insertItem: async () => {
      throw new Error("must not be reached")
    },
  })
  const handler = createDiscoveryIntakeItemsHandler(deps)

  for (const capture of [
    // Blank text: the column's own `btrim(...) <> ''` CHECK, enforced up front.
    { source: "name_research", brandText: "Balea", productNameText: "" },
    // A dm row without the gtin it is identified by.
    { source: "dm_search", brandText: "Balea", productNameText: "Balea Öl" },
    { source: "invented", productId: ids.product },
  ]) {
    const response = await handler(itemsRequest({ category: "shampoo", capture }))
    assert.equal(response.status, 400, JSON.stringify(capture))
    assert.deepEqual(await response.json(), { code: "invalid_body" })
  }
})

test("an item id that is not in this intake deletes nothing and answers 404", async () => {
  const response = await createDiscoveryIntakeItemDeleteHandler(
    baseDeps({ deleteItem: async () => false }),
  )(deleteRequest(), params)
  assert.equal(response.status, 404)
})

test("deleting an own item answers 200 and is scoped to the caller's intake", async () => {
  const seen: unknown[] = []
  const response = await createDiscoveryIntakeItemDeleteHandler(
    baseDeps({
      deleteItem: async (input: unknown) => {
        seen.push(input)
        return true
      },
    }),
  )(deleteRequest(), params)
  assert.equal(response.status, 200)
  assert.deepEqual(seen, [{ intakeId: ids.intake, itemId: ids.item }])
})

// --- Submit completeness ------------------------------------------------------

const everyCategory = DISCOVERY_INTAKE_CATEGORIES.map((category) => ({
  ...storedItem,
  category,
}))

test("submitting an incomplete checklist is refused and names the open categories", async () => {
  const response = await createDiscoveryIntakeSubmitHandler(
    baseDeps({
      loadItems: async () => everyCategory.filter((item) => item.category !== "oil"),
      submitIntake: async () => {
        throw new Error("must not be reached")
      },
    }),
  )()
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { code: "incomplete", missing: ["oil"] })
})

test("completeness is decided from the stored rows, not from the client", async () => {
  let submittedId: string | null = null
  const response = await createDiscoveryIntakeSubmitHandler(
    baseDeps({
      loadItems: async () => everyCategory,
      submitIntake: async (intakeId: string) => {
        submittedId = intakeId
        return submittedIntake
      },
    }),
  )()
  assert.equal(response.status, 200)
  assert.equal(submittedId, ids.intake)
  assert.deepEqual(await response.json(), {
    state: "submitted",
    submittedAt: "2026-09-22T12:00:00.000Z",
  })
})

// --- Fix 5: the coexistence the items route tolerates is healed on submit -----

test("a category holding BOTH answers loses its „benutze ich nicht“ before the freeze", async () => {
  const order: string[] = []
  const healed: unknown[] = []
  // `mask` carries the contradiction: a product AND a standing `none`, the state an
  // items write leaves behind when its post-insert clear failed.
  const items = [
    ...everyCategory,
    { ...storedItem, id: "x", category: "mask" as const, source: "none" as const },
  ]

  const response = await createDiscoveryIntakeSubmitHandler(
    baseDeps({
      loadItems: async () => items,
      clearCoexistingNone: async (input: unknown) => {
        order.push("heal")
        healed.push(input)
        return ["mask"]
      },
      submitIntake: async () => {
        order.push("submit")
        return submittedIntake
      },
    }),
  )()

  assert.equal(response.status, 200)
  // Healed BEFORE the freeze — afterwards every write endpoint answers 409.
  assert.deepEqual(order, ["heal", "submit"])
  assert.deepEqual(healed, [{ intakeId: ids.intake, items }])
})

test("an incomplete checklist is refused before anything is healed", async () => {
  const response = await createDiscoveryIntakeSubmitHandler(
    baseDeps({
      loadItems: async () => everyCategory.filter((item) => item.category !== "oil"),
      clearCoexistingNone: async () => {
        throw new Error("must not be reached")
      },
      submitIntake: async () => {
        throw new Error("must not be reached")
      },
    }),
  )()
  assert.equal(response.status, 400)
})

test("the heal itself deletes only the contradicted categories' none rows", async () => {
  const deletes: Array<Record<string, unknown>> = []
  const client = {
    from: (table: string) => {
      const call: Record<string, unknown> = { table }
      const chain = {
        delete: () => {
          call.delete = true
          return chain
        },
        eq: (column: string, value: unknown) => {
          call[`eq_${column}`] = value
          return chain
        },
        in: (column: string, values: readonly unknown[]) => {
          call[`in_${column}`] = [...values]
          return chain
        },
        then: (resolve: (result: { error: null }) => unknown) => {
          deletes.push(call)
          return Promise.resolve({ error: null }).then(resolve)
        },
      }
      return chain
    },
  } as unknown as DiscoveryAdminClient

  const contradicted = await clearDiscoveryIntakeCoexistingNone(
    {
      intakeId: ids.intake,
      items: [
        { category: "shampoo", source: "catalog_search" },
        { category: "shampoo", source: "none" },
        // `mask` answered „none" and nothing else — not a contradiction, left alone.
        { category: "mask", source: "none" },
        // `oil` has products only — nothing to heal.
        { category: "oil", source: "dm_search" },
      ],
    },
    client,
  )

  assert.deepEqual(contradicted, ["shampoo"])
  assert.deepEqual(deletes, [
    {
      table: "discovery_intake_items",
      delete: true,
      eq_intake_id: ids.intake,
      eq_source: "none",
      in_category: ["shampoo"],
    },
  ])
})

test("a consistent checklist is healed with no write at all", async () => {
  const client = {
    from: () => {
      throw new Error("must not be reached")
    },
  } as unknown as DiscoveryAdminClient
  assert.deepEqual(
    await clearDiscoveryIntakeCoexistingNone(
      {
        intakeId: ids.intake,
        items: [
          { category: "shampoo", source: "catalog_search" },
          { category: "mask", source: "none" },
        ],
      },
      client,
    ),
    [],
  )
})

// --- Identify -----------------------------------------------------------------

test("identify refuses a value that is not a valid EAN before touching the catalog", async () => {
  const response = await createDiscoveryIdentifyHandler(
    baseDeps({
      lookupCatalogProductByIdentifier: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(identifyRequest({ identifier: "1234" }))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { code: "invalid_identifier" })
})

test("identify answers identity only — no verdict, no commerce", async () => {
  const response = await createDiscoveryIdentifyHandler(
    baseDeps({
      lookupCatalogProductByIdentifier: async () => ({
        productId: ids.product,
        category: "shampoo" as const,
      }),
      filterScanEligibleProductIds: async () => new Set([ids.product]),
      loadProductIdentity: async () => ({ name: "Hyaluron Pure", brand: "Elvital" }),
    }),
  )(identifyRequest({ identifier: "4005808858149" }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    kind: "catalog",
    productId: ids.product,
    category: "shampoo",
    name: "Hyaluron Pure",
    brand: "Elvital",
  })
})

test("an ineligible catalog hit is reported as unknown, not as a product", async () => {
  const response = await createDiscoveryIdentifyHandler(
    baseDeps({
      lookupCatalogProductByIdentifier: async () => ({
        productId: ids.product,
        category: "shampoo" as const,
      }),
      // Quarantined or deactivated: `filterScanEligibleProductIds` drops it.
      filterScanEligibleProductIds: async () => new Set<string>(),
      loadProductIdentity: async () => {
        throw new Error("must not be reached")
      },
    }),
  )(identifyRequest({ identifier: "4005808858149" }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { kind: "unknown" })
})

test("a barcode the catalog does not know is unknown", async () => {
  const response = await createDiscoveryIdentifyHandler(
    baseDeps({ lookupCatalogProductByIdentifier: async () => null }),
  )(identifyRequest({ identifier: "4005808858149" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { kind: "unknown" })
})
