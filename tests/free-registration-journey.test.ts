import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"

import { createFreeRegistrationPostHandler } from "../src/app/api/auth/free-registration/route"
import { createAuthConfirmGetHandler } from "../src/app/auth/confirm/route"
import { createFreeSnapshotService } from "../src/lib/personal-plan/persistence/free-snapshot-service"
import { createFreeSnapshotSupabaseDependencies } from "../src/lib/personal-plan/persistence/free-snapshot-supabase"
import { loadScanEvaluationContext } from "../src/lib/scan/profile-context"
import {
  buildProfileDataFromPersonalPlanCanonicalProfile,
  canLinkDirectQuizLead,
} from "../src/lib/quiz/link-to-profile"
import { getAuthenticatedAppRedirect } from "../src/lib/auth/intake-state"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * T18 named journey test: quiz -> e-mail -> magic link -> /auth/confirm ->
 * /scan, with the prepared plan artifact intact (the scanner resolves without
 * `profile_missing`, and the Profil surface's `hair_profiles` row carries
 * quiz-derived content), plus the resend / correction / expired-link recovery
 * states.
 *
 * The real routes are driven end to end. Two seams are faked, both at the
 * transport boundary:
 *  - Supabase auth (`signInWithOtp` + `verifyOtp`): the "e-mail transport" the
 *    brief allows to be mocked. The fake creates the account on send, exactly
 *    like `shouldCreateUser: true`.
 *  - The database: an in-memory fake reused from the T6 acceptance test's
 *    shape, including the real idempotency rules of
 *    `personal_plan_create_or_reuse_initial_need`.
 * `linkQuizToProfile`'s own body constructs its admin client internally, so the
 * confirm route is handed a double that performs the SAME steps through the
 * fake: the real `canLinkDirectQuizLead` binding rule, the real
 * `link_personal_plan_artifact_to_user` RPC contract, and the real
 * `buildProfileDataFromPersonalPlanCanonicalProfile` projection.
 */

const ORIGIN = "https://app.test"

const CANONICAL_PROFILE = {
  structure: "wavy",
  thickness: "fine",
  density: "low",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "trocken",
  has_scalp_issue: false,
  treatment: ["gefaerbt"],
  concerns: ["frizz"],
  goals: ["moisture"],
}

type Row = Record<string, unknown>

function createJourneyDatabase() {
  const leads: Row[] = []
  const preparedArtifacts: Row[] = []
  const hairProfiles: Row[] = []
  const personalPlans = new Map<string, Row>()
  const needVersions = new Map<string, Row>()

  function seedQuizCompletion(email: string) {
    const leadId = randomUUID()
    leads.push({ id: leadId, email, quiz_kind: "personal_plan", user_id: null, status: "new" })
    preparedArtifacts.push({
      id: randomUUID(),
      lead_id: leadId,
      user_id: null,
      status: "attached_to_lead",
      quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
      canonical_profile: CANONICAL_PROFILE,
      attached_at: new Date().toISOString(),
    })
    return leadId
  }

  function linkArtifactToUser(leadId: string, userId: string) {
    const artifact = preparedArtifacts.find((row) => row.lead_id === leadId)
    if (!artifact) return { data: null, error: new Error("no artifact for lead") }
    artifact.user_id = userId
    artifact.status = "attached"
    artifact.attached_at = new Date().toISOString()
    return { data: [{ canonical_profile: artifact.canonical_profile }], error: null }
  }

  function rpcCreateOrReuseInitialNeed(args: Row) {
    const userId = args.p_user_id as string
    const enrollmentId = (args.p_enrollment_purchase_source_id ?? null) as string | null
    let plan = personalPlans.get(userId)
    if (!plan) {
      plan = {
        id: randomUUID(),
        user_id: userId,
        enrollment_purchase_source_id: enrollmentId,
        current_initial_need_version_id: null,
        current_refined_need_version_id: null,
      }
      personalPlans.set(userId, plan)
    }
    if (plan.enrollment_purchase_source_id !== enrollmentId) {
      return { data: { outcome: "invalid_source", reasonCode: "enrollment_mismatch" }, error: null }
    }
    const inputHash = args.p_input_hash as string
    let need = [...needVersions.values()].find(
      (row) =>
        row.personal_plan_id === plan!.id && row.kind === "initial" && row.input_hash === inputHash,
    )
    if (!need) {
      need = {
        id: randomUUID(),
        user_id: userId,
        personal_plan_id: plan.id,
        kind: "initial",
        input_hash: inputHash,
        output_snapshot: args.p_output_snapshot,
      }
      needVersions.set(need.id as string, need)
    }
    plan.current_initial_need_version_id = need.id
    return {
      data: {
        outcome: "completed",
        personalPlanId: plan.id,
        needVersionId: need.id,
        outputSnapshot: need.output_snapshot,
      },
      error: null,
    }
  }

  const admin = {
    from(table: string) {
      const filters: { op: "eq" | "is"; column: string; value: unknown }[] = []
      let mode: "select" | "update" = "select"
      let payload: Row = {}
      const matches = (row: Row) =>
        filters.every(({ op, column, value }) =>
          op === "is" ? (row[column] ?? null) === value : row[column] === value,
        )
      const table_rows = () => {
        if (table === "leads") return leads
        if (table === "personal_plan_prepared_artifacts") return preparedArtifacts
        if (table === "hair_profiles") return hairProfiles
        return []
      }
      const run = () => {
        if (mode === "update") {
          for (const row of table_rows().filter(matches)) Object.assign(row, payload)
          return { data: null, error: null }
        }
        return { data: table_rows().filter(matches), error: null }
      }
      const chain = {
        select: () => chain,
        update: (values: Row) => {
          mode = "update"
          payload = values
          return chain
        },
        eq: (column: string, value: unknown) => {
          filters.push({ op: "eq", column, value })
          return chain
        },
        is: (column: string, value: unknown) => {
          filters.push({ op: "is", column, value })
          return chain
        },
        order: () => chain,
        limit: () => chain,
        then: (resolve: (result: { data: unknown; error: unknown }) => void) => resolve(run()),
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return { data: personalPlans.get(filters[0]?.value as string) ?? null, error: null }
          }
          if (table === "personal_plan_need_versions") {
            return { data: [...needVersions.values()].find(matches) ?? null, error: null }
          }
          // Never seeded in this journey: the free-snapshot paid-access guard's
          // legacy-profile check and moderator roster reads resolve to "none".
          if (
            table === "profiles" ||
            table === "personal_plan_test_members" ||
            table === "personal_plan_test_enrollments"
          ) {
            return { data: null, error: null }
          }
          return { data: table_rows().filter(matches)[0] ?? null, error: null }
        },
      }
      return chain
    },
    async rpc(name: string, args: Row) {
      if (name === "personal_plan_create_or_reuse_initial_need") {
        return rpcCreateOrReuseInitialNeed(args)
      }
      if (name === "link_personal_plan_artifact_to_user") {
        return linkArtifactToUser(args.p_lead_id as string, args.p_user_id as string)
      }
      if (name === "get_personal_plan_one_time_access_state") return { data: "none", error: null }
      throw new Error(`unexpected rpc ${name}`)
    },
  }

  return { admin, leads, hairProfiles, preparedArtifacts, needVersions, seedQuizCompletion }
}

type SentLink = { email: string; emailRedirectTo: string; tokenHash: string }

function createAuthTransport() {
  const sent: SentLink[] = []
  const usersByEmail = new Map<string, { id: string; email: string }>()
  const tokens = new Map<string, string>()

  return {
    sent,
    /** `shouldCreateUser: true`: the account exists from the send onwards. */
    async sendMagicLink(input: { email: string; emailRedirectTo: string }) {
      const user = usersByEmail.get(input.email) ?? { id: randomUUID(), email: input.email }
      usersByEmail.set(input.email, user)
      const tokenHash = randomUUID().replace(/-/g, "")
      tokens.set(tokenHash, input.email)
      sent.push({ ...input, tokenHash })
      return { error: null }
    },
    consume(tokenHash: string) {
      const email = tokens.get(tokenHash)
      if (!email) return null
      tokens.delete(tokenHash)
      return usersByEmail.get(email) ?? null
    },
  }
}

function createJourney() {
  const db = createJourneyDatabase()
  const transport = createAuthTransport()
  const provisioned: { userId: string; email?: string }[] = []
  const linkCalls: { userId: string; email?: string; leadId?: string }[] = []

  const registration = createFreeRegistrationPostHandler({
    isEnabled: () => true,
    siteUrl: ORIGIN,
    checkRateLimit: async () => ({ allowed: true }),
    async loadLead(leadId) {
      const row = db.leads.find((lead) => lead.id === leadId)
      if (!row) return null
      return {
        id: row.id as string,
        email: row.email as string,
        quizKind: row.quiz_kind as "legacy" | "personal_plan",
        userId: (row.user_id as string | null) ?? null,
      }
    },
    async updateLeadEmail(leadId, email) {
      const row = db.leads.find((lead) => lead.id === leadId && lead.user_id === null)
      if (row) row.email = email
    },
    checkEmailDeliverability: async (email) => ({ ok: true, normalized: email }),
    sendMagicLink: transport.sendMagicLink,
  })

  /**
   * Mirrors `linkQuizToProfile` for a `personal_plan` lead: the same binding
   * rule, the same RPC, the same projection helper, the same lead-linking
   * write. Only the admin-client construction is replaced.
   */
  async function linkQuizToProfile(userId: string, email?: string, leadId?: string) {
    linkCalls.push({ userId, ...(email ? { email } : {}), ...(leadId ? { leadId } : {}) })
    if (!leadId) return
    const lead = db.leads.find((row) => row.id === leadId)
    if (!lead || lead.quiz_kind !== "personal_plan") return
    if (
      !canLinkDirectQuizLead(
        { email: lead.email as string, userId: (lead.user_id as string | null) ?? null },
        { ...(email ? { email } : {}), userId },
      )
    ) {
      return
    }
    const { data, error } = await db.admin.rpc("link_personal_plan_artifact_to_user", {
      p_lead_id: leadId,
      p_user_id: userId,
    })
    if (error) throw error
    const result = Array.isArray(data) ? data[0] : data
    const profileData = buildProfileDataFromPersonalPlanCanonicalProfile(
      (result as { canonical_profile: unknown }).canonical_profile,
    )
    profileData.user_id = userId
    db.hairProfiles.push(profileData)
    lead.user_id = userId
    lead.status = "linked"
  }

  const confirm = createAuthConfirmGetHandler({
    createClient: async () =>
      ({
        auth: {
          async exchangeCodeForSession() {
            return { error: new Error("no pkce code in this journey") }
          },
          async verifyOtp(input: { token_hash: string }) {
            currentUser = transport.consume(input.token_hash)
            return { error: currentUser ? null : new Error("otp_expired") }
          },
          async getUser() {
            return { data: { user: currentUser } }
          },
        },
      }) as never,
    linkQuizToProfile,
    loadJourneyAccess: async () => ({ kind: "legacy" }) as never,
    freemiumScannerFirstEnabled: () => flagEnabled,
    async provisionFreeSnapshot(input) {
      provisioned.push(input)
      return createFreeSnapshotService(
        createFreeSnapshotSupabaseDependencies(db.admin as never),
      ).provisionFreeInitialSnapshot(input)
    },
  })

  let currentUser: { id: string; email: string } | null = null
  let flagEnabled = true

  return {
    db,
    transport,
    provisioned,
    linkCalls,
    setFlag: (value: boolean) => {
      flagEnabled = value
    },
    async register(leadId: string, email?: string) {
      const response = await registration(
        new Request(`${ORIGIN}/api/auth/free-registration`, {
          method: "POST",
          body: JSON.stringify(email ? { leadId, email } : { leadId }),
        }),
      )
      return { status: response.status, body: (await response.json()) as Record<string, unknown> }
    },
    async openLink(link: SentLink) {
      const url = new URL(link.emailRedirectTo)
      url.searchParams.set("token_hash", link.tokenHash)
      url.searchParams.set("type", "magiclink")
      return confirm(new Request(url.toString()))
    },
    async openExpiredLink(link: SentLink) {
      const url = new URL(link.emailRedirectTo)
      url.searchParams.set("token_hash", "expired-token-hash")
      url.searchParams.set("type", "magiclink")
      return confirm(new Request(url.toString()))
    },
  }
}

test("JOURNEY: quiz -> e-mail -> magic link -> /scan with the quiz artifact intact", async () => {
  const journey = createJourney()
  const leadId = journey.db.seedQuizCompletion("lena@example.com")

  // 1. The quiz saved the lead; the registration screen asks for the link.
  const sent = await journey.register(leadId)
  assert.equal(sent.status, 200)
  assert.deepEqual(sent.body, { ok: true, email: "lena@example.com", corrected: false })
  assert.equal(journey.transport.sent.length, 1)

  // 2. The link binds the EXACT lead and lands on the scanner.
  const link = journey.transport.sent[0]
  assert.equal(link.email, "lena@example.com")
  const redirect = new URL(link.emailRedirectTo)
  assert.equal(redirect.pathname, "/auth/confirm")
  assert.equal(redirect.searchParams.get("lead"), leadId)
  assert.equal(redirect.searchParams.get("next"), "/scan")

  const response = await journey.openLink(link)
  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), `${ORIGIN}/scan`)

  // 3. The lead is claimed by the new account and its artifact came with it.
  const userId = journey.linkCalls[0].userId
  assert.equal(journey.db.leads[0].user_id, userId)
  assert.equal(journey.db.preparedArtifacts[0].user_id, userId)
  assert.equal(journey.db.preparedArtifacts[0].status, "attached")

  // 4. Profil shows quiz-derived content (the projection the profile reads).
  const profile = journey.db.hairProfiles.find((row) => row.user_id === userId)
  assert.ok(profile, "expected a hair_profiles row projected from the quiz")
  assert.equal(profile?.hair_texture, "wavy")
  assert.equal(profile?.thickness, "fine")
  assert.equal(profile?.scalp_type, "dry")
  assert.deepEqual(profile?.chemical_treatment, ["colored"])

  // 5. The scanner works immediately — no `profile_missing` 409.
  assert.deepEqual(journey.provisioned, [{ userId, email: "lena@example.com" }])
  const context = await loadScanEvaluationContext(journey.db.admin as never, userId)
  assert.ok(context, "expected a scan evaluation context — profile_missing must not fire")
  assert.equal(context?.snapshotSource, "initial")

  // 6. Middleware admits the free account on /scan without an intake bounce.
  assert.equal(
    getAuthenticatedAppRedirect("/scan", "needs_onboarding", {
      freemiumScannerFirstEnabled: true,
      personalPlanRoutineAccess: {
        hasActivePersonalPlanEntitlement: false,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: null,
      },
    }),
    null,
  )
})

test("RECOVERY resend: a second link works and the lead is still bound exactly once", async () => {
  const journey = createJourney()
  const leadId = journey.db.seedQuizCompletion("lena@example.com")

  await journey.register(leadId)
  const resend = await journey.register(leadId)
  assert.equal(resend.status, 200)
  assert.equal(journey.transport.sent.length, 2)
  assert.equal(journey.transport.sent[1].email, "lena@example.com")

  const response = await journey.openLink(journey.transport.sent[1])
  assert.equal(response.headers.get("location"), `${ORIGIN}/scan`)
  assert.equal(journey.db.hairProfiles.length, 1)
})

test("RECOVERY correction: a corrected address still lands on the same lead's artifact", async () => {
  const journey = createJourney()
  const leadId = journey.db.seedQuizCompletion("lena@examlpe.de")

  await journey.register(leadId)
  const corrected = await journey.register(leadId, "lena@example.de")
  assert.equal(corrected.status, 200)
  assert.deepEqual(corrected.body, { ok: true, email: "lena@example.de", corrected: true })

  const response = await journey.openLink(journey.transport.sent[1])
  assert.equal(response.headers.get("location"), `${ORIGIN}/scan`)

  const userId = journey.linkCalls.at(-1)!.userId
  assert.equal(journey.db.leads[0].email, "lena@example.de")
  assert.equal(journey.db.leads[0].user_id, userId)
  assert.equal(journey.db.preparedArtifacts[0].user_id, userId)
  assert.ok(await loadScanEvaluationContext(journey.db.admin as never, userId))
})

test("RECOVERY correction: without the lead rewrite the binding rule would reject the account", () => {
  // Pins WHY the correction path rewrites the lead: `canLinkDirectQuizLead`
  // only admits an account whose e-mail equals the unclaimed lead's.
  assert.equal(
    canLinkDirectQuizLead(
      { email: "lena@examlpe.de", userId: null },
      { email: "lena@example.de", userId: "user-1" },
    ),
    false,
  )
  assert.equal(
    canLinkDirectQuizLead(
      { email: "lena@example.de", userId: null },
      { email: "lena@example.de", userId: "user-1" },
    ),
    true,
  )
})

test("RECOVERY expired link: back to the registration screen, nothing provisioned", async () => {
  const journey = createJourney()
  const leadId = journey.db.seedQuizCompletion("lena@example.com")
  await journey.register(leadId)

  const response = await journey.openExpiredLink(journey.transport.sent[0])
  assert.equal(
    response.headers.get("location"),
    `${ORIGIN}/registrierung?lead=${leadId}&error=link_expired`,
  )
  assert.deepEqual(journey.provisioned, [])
  assert.equal(journey.db.hairProfiles.length, 0)

  // The recovery screen can request a fresh link for the same lead.
  const again = await journey.register(leadId)
  assert.equal(again.status, 200)
  const retry = await journey.openLink(journey.transport.sent[1])
  assert.equal(retry.headers.get("location"), `${ORIGIN}/scan`)
})

test("a lead that already belongs to an account cannot be re-registered", async () => {
  const journey = createJourney()
  const leadId = journey.db.seedQuizCompletion("lena@example.com")
  await journey.register(leadId)
  await journey.openLink(journey.transport.sent[0])

  const takeover = await journey.register(leadId, "angreifer@example.com")
  assert.equal(takeover.status, 409)
  assert.equal(takeover.body.code, "lead_claimed")
  assert.equal(journey.db.leads[0].email, "lena@example.com")
  assert.equal(journey.transport.sent.length, 1)
})

test("flag off: /auth/confirm ignores the free marker entirely (byte-identical legacy behaviour)", async () => {
  const journey = createJourney()
  const leadId = journey.db.seedQuizCompletion("lena@example.com")
  await journey.register(leadId)
  journey.setFlag(false)

  // Verified link: still lands on `next`, but never provisions a free snapshot.
  const verified = await journey.openLink(journey.transport.sent[0])
  assert.equal(verified.headers.get("location"), `${ORIGIN}/scan`)
  assert.deepEqual(journey.provisioned, [])

  // Expired link: the pre-existing `/auth?error=link_expired` destination.
  const second = createJourney()
  const otherLead = second.db.seedQuizCompletion("mara@example.com")
  await second.register(otherLead)
  second.setFlag(false)
  const expired = await second.openExpiredLink(second.transport.sent[0])
  assert.equal(expired.headers.get("location"), `${ORIGIN}/auth?error=link_expired&next=%2Fscan`)
})
