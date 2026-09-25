import assert from "node:assert/strict"
import test from "node:test"

import { createDiscoveryQuizContextGetHandler } from "../src/app/api/beratung/quiz-context/route"
import { createQuizLeadPostHandler } from "../src/app/api/quiz/lead/route"
import { resolveDiscoveryJourney } from "../src/lib/discovery/journey"
import { DISCOVERY_ENROLLMENT_METADATA_KEY } from "../src/lib/discovery/participant"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  user: "20000000-0000-4000-8000-000000000002",
  lead: "40000000-0000-4000-8000-000000000004",
}

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lea Sommer",
  email: "lea@example.test",
  tokenVersion: 2,
  claimedUserId: ids.user,
  claimedAt: "2026-09-22T10:00:00.000Z",
  createdAt: "2026-09-22T10:00:00.000Z",
}

const stampedUser = {
  id: ids.user,
  app_metadata: { access_kind: "discovery", [DISCOVERY_ENROLLMENT_METADATA_KEY]: ids.enrollment },
}

const quizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["dryness"],
  treatment: ["natur"],
  goals: ["shine"],
} as const

// --- resolveDiscoveryJourney -------------------------------------------------

test("an unstamped or signed-out visitor resolves none without reading the table", async () => {
  let reads = 0
  const loadEnrollment = async () => {
    reads += 1
    return enrollment
  }
  assert.deepEqual(await resolveDiscoveryJourney({ getUser: async () => null, loadEnrollment }), {
    kind: "none",
  })
  assert.deepEqual(
    await resolveDiscoveryJourney({
      getUser: async () => ({ id: ids.user, app_metadata: {} }),
      loadEnrollment,
    }),
    { kind: "none" },
  )
  assert.equal(reads, 0)
})

test("a revoked participant resolves none even while their JWT still carries the stamp", async () => {
  assert.deepEqual(
    await resolveDiscoveryJourney({
      getUser: async () => stampedUser,
      // The loader requires `revoked_at IS NULL` and the matching binding.
      loadEnrollment: async () => null,
    }),
    { kind: "none" },
  )
})

test("a read failure fails closed, and only for a stamped account", async () => {
  const resolution = await resolveDiscoveryJourney({
    getUser: async () => stampedUser,
    loadEnrollment: async () => {
      throw new Error("table unavailable")
    },
  })
  assert.deepEqual(resolution, { kind: "unavailable" })
})

// --- The quiz-context endpoint ----------------------------------------------

test("quiz-context hands the quiz the enrollment's identity", async () => {
  const response = await createDiscoveryQuizContextGetHandler({
    flagEnabled: () => true,
    resolveDiscoveryJourney: async () => ({ kind: "authorized", userId: ids.user, enrollment }),
  })()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: "participant",
    name: "Lea Sommer",
    email: "lea@example.test",
  })
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
})

test("quiz-context is regular with the flag off and never resolves anything", async () => {
  let resolved = 0
  const response = await createDiscoveryQuizContextGetHandler({
    flagEnabled: () => false,
    resolveDiscoveryJourney: async () => {
      resolved += 1
      return { kind: "authorized", userId: ids.user, enrollment }
    },
  })()
  assert.deepEqual(await response.json(), { status: "regular" })
  assert.equal(resolved, 0)
})

test("quiz-context refuses a revoked participant and a broken lookup", async () => {
  const revoked = await createDiscoveryQuizContextGetHandler({
    flagEnabled: () => true,
    resolveDiscoveryJourney: async () => ({ kind: "none" }),
  })()
  assert.deepEqual(await revoked.json(), { status: "regular" })

  const broken = await createDiscoveryQuizContextGetHandler({
    flagEnabled: () => true,
    resolveDiscoveryJourney: async () => {
      throw new Error("boom")
    },
  })()
  assert.deepEqual(await broken.json(), { status: "unavailable" })
})

// --- The quiz lead branch ----------------------------------------------------

type LeadCall = { table: string; values: Record<string, unknown> }

function leadHandler({
  discoveryEnabled = true,
  discovery = { kind: "authorized" as const, userId: ids.user, enrollment },
  inserts,
  selects,
  recent = [],
  filters,
}: {
  discoveryEnabled?: boolean
  discovery?: Awaited<ReturnType<typeof resolveDiscoveryJourney>>
  inserts?: LeadCall[]
  selects?: string[]
  recent?: Array<{ id: string; quiz_answers: Record<string, unknown> }>
  filters?: Array<[string, unknown]>
} = {}) {
  const admin = {
    from(table: string) {
      return {
        insert(values: Record<string, unknown>) {
          inserts?.push({ table, values })
          return {
            select: () => ({ single: async () => ({ data: { id: ids.lead }, error: null }) }),
          }
        },
        select() {
          selects?.push(table)
          const chain: Record<string, unknown> = new Proxy(
            {},
            {
              get: (_target, property) =>
                property === "then"
                  ? undefined
                  : (column: string, value: unknown) => {
                      if (property === "eq" || property === "is") filters?.push([column, value])
                      return property === "limit" ? { data: recent, error: null } : chain
                    },
            },
          )
          return chain
        },
      }
    },
  }

  return createQuizLeadPostHandler({
    discoveryEnabled: () => discoveryEnabled,
    resolveDiscoveryJourney: async () => discovery,
    // Everything downstream of the discovery branch, stubbed so a leak past it
    // is loud rather than silent.
    resolvePartnerJourney: async () => ({ kind: "none" }),
    resolveModeratorJourney: (async () => ({ kind: "none" })) as never,
    checkRateLimit: async () => ({ allowed: true }) as never,
    checkEmailDeliverability: async () => {
      throw new Error("deliverability must not run for a discovery participant")
    },
    recordEmailDeliverabilityOutcome: () => {},
    createAdminClient: (() => admin) as never,
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => null,
    syncQuizLeadToCustomerIo: async () => {
      throw new Error("Customer.io must not run for a discovery participant")
    },
    enqueueMetaLead: () => {
      throw new Error("Meta CAPI must not run for a discovery participant")
    },
    scheduleAfter: () => {
      throw new Error("no deferred commercial work for a discovery participant")
    },
  })
}

function leadRequest(body: Record<string, unknown>, origin: string | null = "https://chaarlie.de") {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin) headers.origin = origin
  return new Request("https://chaarlie.de/api/quiz/lead", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

test("a participant's lead is saved under the enrollment identity, not the submitted one", async () => {
  const inserts: LeadCall[] = []
  const selects: string[] = []
  const response = await leadHandler({ inserts, selects })(
    leadRequest({
      // Client-supplied identity that must be ignored.
      name: "Tippfehler",
      email: "lea@example.test",
      marketingConsent: true,
      quizAnswers,
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId: ids.lead, journey: "discovery" })
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0].table, "leads")
  assert.equal(inserts[0].values.name, "Lea Sommer")
  assert.equal(inserts[0].values.email, "lea@example.test")
  assert.equal(inserts[0].values.marketing_consent, true)
  assert.equal(inserts[0].values.status, "captured")
  // Only the narrow replay guard reads the table (batch 8 review) — never the dedupe pool.
  assert.deepEqual(selects, ["leads"])
})

test("a retry whose first response was lost gets her own lead back, not a duplicate", async () => {
  const inserts: LeadCall[] = []
  const filters: Array<[string, unknown]> = []
  const replayed = "30000000-0000-4000-8000-000000000009"
  const body = {
    name: "Lea Sommer",
    email: "lea@example.test",
    marketingConsent: false,
    quizAnswers,
  }
  const response = await leadHandler({
    inserts,
    filters,
    recent: [{ id: replayed, quiz_answers: quizAnswers as Record<string, unknown> }],
  })(leadRequest(body))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId: replayed, journey: "discovery" })
  assert.deepEqual(inserts, [], "no second row")
  // Scoped to her enrollment identity and to rows no other journey owns.
  assert.deepEqual(
    filters.filter(([column]) => column !== "created_at"),
    [
      ["email", "lea@example.test"],
      ["name", "Lea Sommer"],
      ["marketing_consent", false],
      ["partner_access_invitation_id", null],
      ["moderator_campaign_id", null],
    ],
  )
})

test("a recent row with different answers is a new profile and is inserted", async () => {
  const inserts: LeadCall[] = []
  const response = await leadHandler({
    inserts,
    recent: [{ id: "30000000-0000-4000-8000-000000000009", quiz_answers: { structure: "coily" } }],
  })(
    leadRequest({
      name: "Lea Sommer",
      email: "lea@example.test",
      marketingConsent: false,
      quizAnswers,
    }),
  )
  assert.deepEqual(await response.json(), { leadId: ids.lead, journey: "discovery" })
  assert.equal(inserts.length, 1)
})

test("an identity mismatch fails closed, exactly like the partner analogue", async () => {
  const inserts: LeadCall[] = []
  const response = await leadHandler({ inserts })(
    leadRequest({
      name: "Lea Sommer",
      email: "jemand.anderes@example.test",
      marketingConsent: true,
      quizAnswers,
    }),
  )

  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), {
    code: "invited_email_mismatch",
    error: "Bitte verwende die E-Mail-Adresse deiner Einladung.",
  })
  assert.deepEqual(inserts, [])
})

test("a cross-origin participant submission is refused before persistence", async () => {
  const inserts: LeadCall[] = []
  const response = await leadHandler({ inserts })(
    leadRequest(
      { name: "Lea Sommer", email: "lea@example.test", marketingConsent: true, quizAnswers },
      "https://evil.test",
    ),
  )
  assert.equal(response.status, 403)
  assert.deepEqual(inserts, [])
})

test("an unreadable enrollment fails closed rather than falling into the paid funnel", async () => {
  const inserts: LeadCall[] = []
  const response = await leadHandler({ inserts, discovery: { kind: "unavailable" } })(
    leadRequest({
      name: "Lea Sommer",
      email: "lea@example.test",
      marketingConsent: true,
      quizAnswers,
    }),
  )
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "Deine Einladung ist nicht verfügbar" })
  assert.deepEqual(inserts, [])
})

test("with the flag off the resolver is never called, so an ordinary lead is untouched", async () => {
  let resolved = 0
  const handler = createQuizLeadPostHandler({
    discoveryEnabled: () => false,
    resolveDiscoveryJourney: async () => {
      resolved += 1
      return { kind: "unavailable" }
    },
    resolvePartnerJourney: async () => ({ kind: "none" }),
    resolveModeratorJourney: (async () => ({ kind: "none" })) as never,
    checkRateLimit: async () => ({ allowed: true }) as never,
    // Reaching this proves the discovery branch stepped aside completely.
    checkEmailDeliverability: async () => {
      throw new Error("ORDINARY_PATH_REACHED")
    },
    recordEmailDeliverabilityOutcome: () => {},
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => null,
  })
  const response = await handler(
    leadRequest({
      name: "Lea Sommer",
      email: "lea@example.test",
      marketingConsent: true,
      quizAnswers,
    }),
  )
  assert.equal(resolved, 0)
  // The ordinary path threw inside the handler's own catch, which answers 400.
  assert.equal(response.status, 400)
})
