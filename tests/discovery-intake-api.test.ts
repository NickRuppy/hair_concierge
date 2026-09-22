import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createDiscoveryIdentifyHandler } from "../src/app/api/beratung/identify/route"
import { createDiscoveryIntakeItemsHandler } from "../src/app/api/beratung/intake/items/route"
import { createDiscoveryIntakeItemDeleteHandler } from "../src/app/api/beratung/intake/items/[itemId]/route"
import { createDiscoveryIntakeSubmitHandler } from "../src/app/api/beratung/intake/submit/route"
import {
  DISCOVERY_INTAKE_CATEGORIES,
  type DiscoveryIntake,
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

function baseDeps(overrides: Deps = {}): Deps {
  return {
    flagEnabled: () => true,
    getUserId: async () => ids.user,
    loadEnrollment: enrollmentLoader(enrollment),
    createAdminClient: () => ({}) as never,
    getOrCreateIntake: async () => draftIntake,
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
  const cleared: unknown[] = []
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      clearCategory: async (input: unknown) => {
        cleared.push(input)
      },
      insertItem: async () => storedItem,
    }),
  )(itemsRequest(validCapture))

  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { item: storedItem })
  assert.deepEqual(cleared, [{ intakeId: ids.intake, category: "shampoo", sources: ["none"] }])
})

test("„benutze ich nicht“ replaces the whole category", async () => {
  const cleared: unknown[] = []
  const response = await createDiscoveryIntakeItemsHandler(
    baseDeps({
      clearCategory: async (input: unknown) => {
        cleared.push(input)
      },
      insertItem: async () => ({ ...storedItem, source: "none" as const }),
    }),
  )(itemsRequest({ category: "mask", capture: { source: "none" } }))

  assert.equal(response.status, 201)
  assert.deepEqual(cleared, [{ intakeId: ids.intake, category: "mask" }])
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
