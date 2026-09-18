import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
const leadId = "11111111-1111-4111-8111-111111111111"
const session = {
  sessionId: "22222222-2222-4222-8222-222222222222",
  visitorId: "33333333-3333-4333-8333-333333333333",
  packageKey: "customerio_scan_return_v1",
  offerVariant: "scan-regal-v1",
  issuedAt: 1,
  testKind: null,
  fieldTestCampaignId: null,
}

// Execute the real server page; replace framework, auth, and database I/O only.
function fixture(
  options: {
    quizKind?: "legacy" | "personal_plan"
    lookup?: "missing" | "unavailable" | "wrong_package" | "wrong_visitor"
    cookie?: boolean
    enabled?: boolean
    refinement?: boolean
    complete?: boolean
    trialMode?: "public" | "restricted" | "disabled"
  } = {},
) {
  const calls: unknown[][] = []
  const lead = {
    id: leadId,
    user_id: null,
    name: "Lea",
    quiz_kind: options.quizKind ?? "legacy",
    moderator_campaign_id: null,
    partner_access_invitation_id: null,
    quiz_answers: options.complete
      ? {
          structure: "wavy",
          thickness: "fine",
          density: "medium",
          hair_length: "long",
          fingertest: "rau",
          pulltest: "stretches_bounces",
          scalp_type: "trocken",
          has_scalp_issue: false,
          treatment: ["natur"],
          concerns: ["frizz"],
          goals: ["shine"],
        }
      : { structure: "wavy" },
  }
  const mocks: Record<string, unknown> = {
    "next/headers": {
      cookies: async () => ({ get: () => ({ value: "signed-cookie" }), getAll: () => [] }),
    },
    "next/navigation": {
      notFound: () => {
        throw new Error("NOT_FOUND")
      },
      redirect: (url: string) => {
        throw new Error(`REDIRECT:${url}`)
      },
    },
    "@supabase/ssr": {
      createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        from: (table: string) => {
          const query = {
            select: () => query,
            eq: () => query,
            order: () => query,
            limit: () => query,
            maybeSingle: async () => ({ data: table === "leads" ? lead : null, error: null }),
          }
          return query
        },
      }),
    },
    "@/lib/funnel/server": {
      resolveFunnelCookieContext: async () => (options.cookie === false ? null : session),
      lookupFunnelContextForLead: async (...args: unknown[]) => {
        calls.push(args)
        if (options.lookup === "unavailable") return { kind: "unavailable" }
        return {
          kind: "resolved",
          context:
            options.lookup === "missing"
              ? null
              : {
                  ...session,
                  ...(options.lookup === "wrong_package" ? { packageKey: "default_organic" } : {}),
                  ...(options.lookup === "wrong_visitor" ? { visitorId: "different-visitor" } : {}),
                },
        }
      },
      resolveFunnelContextForLead: async () => null,
      resolveOrganicOfferMediaExperiment: async () => "organic-plan-v1",
      resolvePersonalPlanPricingExperiment: async () => "personal-plan-v1",
      recordFunnelEvent: async () => {},
    },
    "@/lib/funnel/flags": {
      isQuizEmailReturnEnabled: () => options.enabled !== false,
      isFunnelAttributionEnabled: () => true,
      isPersonalPlanResultReturnEnabled: () => false,
      isPersonalPlanLaunchPricingEnabled: () => false,
    },
    "@/lib/funnel/scanner-refinement": {
      isScannerFunnelRefinementEnabled: () => options.refinement !== false,
    },
    "@/lib/personal-plan-field-test/moderator-journey": {
      loadPersonalPlanResultFunnel: async () => ({ kind: "loaded", context: null }),
    },
    "@/lib/personal-plan-field-test": {
      hasPersonalPlanFieldTestOfferIntent: async () => false,
      resolvePersonalPlanFieldTestOfferAuthorization: async () => null,
      hasRegularQuizFieldTestOfferIntent: async () => false,
      resolveRegularQuizFieldTestOfferAuthorization: async () => null,
      isRegularQuizFieldTestEnabled: () => false,
    },
    "@/lib/billing/trial-runtime": {
      ...require(path.resolve("src/lib/billing/trial-runtime.ts")),
      readTrialRuntime: () => ({
        enrollmentMode: options.trialMode ?? "public",
        allowedEmails: [],
        catalog: { monthPriceId: "price_month", yearPriceId: "price_year", annualCouponId: null },
      }),
    },
  }
  const filename = path.resolve("src/app/result/[leadId]/page.tsx")
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const module = {
    exports: {} as {
      default: (
        props: unknown,
      ) => Promise<{ props: { children: { props: Record<string, unknown> } } }>
    },
  }
  const localRequire = (id: string) =>
    id in mocks
      ? mocks[id]
      : require(
          id.startsWith("@/")
            ? path.resolve("src", id.slice(2))
            : id.startsWith(".")
              ? path.resolve(path.dirname(filename), id)
              : id,
        )
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console, process, crypto })(
    localRequire,
    module,
    module.exports,
  )
  return {
    calls,
    run: () =>
      module.exports.default({
        params: Promise.resolve({ leadId }),
        searchParams: Promise.resolve({}),
      }),
  }
}

for (const quizKind of ["legacy", "personal_plan"] as const) {
  test(`exact lead-bound email session routes incomplete ${quizKind} to scanner`, async () => {
    const f = fixture({ quizKind })
    const result = await f.run()
    const props = result.props.children.props
    assert.deepEqual(f.calls, [[leadId, session.sessionId]])
    assert.equal(props.returningScannerOffer, true)
    assert.equal(props.returningProfileIncomplete, true)
    assert.equal(props.offerVariant, "scan-regal-v1")
    assert.equal(
      (props.offerTracking as { funnelSessionId: string }).funnelSessionId,
      session.sessionId,
    )
    assert.equal((props.trialOfferPricing as { trialDays: number }).trialDays, 7)
  })
}

test("a complete legacy return retains its personalized diagnostic presentation", async () => {
  const result = await fixture({ complete: true }).run()
  assert.equal(result.props.children.props.returningProfileIncomplete, false)
})

test("missing, wrong-lead, wrong-package and wrong-visitor sessions cannot relax legacy parsing", async () => {
  for (const options of [
    { cookie: false },
    { enabled: false },
    { lookup: "missing" },
    { lookup: "wrong_package" },
    { lookup: "wrong_visitor" },
  ] as const) {
    await assert.rejects(fixture(options).run(), /NOT_FOUND/)
  }
})

test("session database failure cannot silently select an ordinary offer", async () => {
  await assert.rejects(fixture({ lookup: "unavailable" }).run(), /Email return session unavailable/)
})

test("stopped trial or refinement rollout offers recovery without evaluating incomplete diagnostics", async () => {
  for (const options of [
    { refinement: false },
    { trialMode: "restricted" },
    { trialMode: "disabled" },
  ] as const) {
    const result = await fixture(options).run()
    assert.equal("children" in result.props, false)
    assert.equal((result.props as unknown as { leadId: string }).leadId, leadId)
  }
})
