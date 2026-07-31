import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { NextRequest } from "next/server"

import {
  createPersonalPlanQuizResumeCredential,
  decodePersonalPlanQuizDraftCookie,
  encodePersonalPlanQuizDraftCookie,
  hashPersonalPlanQuizResumeCredential,
  isPersonalPlanQuizDraftCookieSecretConfigured,
  parsePersonalPlanQuizServerDraft,
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
  PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY,
  personalPlanQuizDraftCookieOptions,
  resolvePersonalPlanQuizDraftLandingState,
  shouldExchangePersonalPlanQuizResumeToken,
} from "../src/lib/personal-plan-quiz/server-draft"
import { POST as postDraft } from "../src/app/api/quiz/personal-plan-draft/route"
import {
  cleanRedirect,
  GET as getResume,
} from "../src/app/api/quiz/personal-plan-draft/resume/route"

process.env.PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET = "test-only-resume-cookie-secret-32-plus"

const minimalDraft = {
  version: 3,
  screen: "texture",
  history: [],
  answers: { texture: "wavy" },
} as const

test("server quiz drafts accept partial durable answers but reject unknown and ephemeral fields", () => {
  assert.deepEqual(parsePersonalPlanQuizServerDraft(minimalDraft), {
    draft: { screen: "texture", history: [], answers: { texture: "wavy" } },
    expectedRevision: undefined,
  })
  assert.equal(
    parsePersonalPlanQuizServerDraft({
      ...minimalDraft,
      answers: { texture: "wavy", email: "a@b.de" },
    }),
    null,
  )
  assert.equal(parsePersonalPlanQuizServerDraft({ ...minimalDraft, dailyTime: "5_minutes" }), null)
  assert.equal(
    parsePersonalPlanQuizServerDraft({ ...minimalDraft, answers: { texture: "not-a-value" } }),
    null,
  )
  assert.equal(
    parsePersonalPlanQuizServerDraft({
      ...minimalDraft,
      answers: { goals: ["moisture", "not-a-goal"] },
    }),
    null,
  )
  assert.equal(
    parsePersonalPlanQuizServerDraft({
      ...minimalDraft,
      answers: { goals: ["moisture", "moisture"] },
    }),
    null,
  )
  assert.deepEqual(
    parsePersonalPlanQuizServerDraft({
      ...minimalDraft,
      answers: { currentConcerns: [], scalpConcerns: [] },
    })?.draft.answers,
    { currentConcerns: [], scalpConcerns: [] },
  )
})

test("resume credentials have independent 256-bit values and cookies are signed", () => {
  const first = createPersonalPlanQuizResumeCredential()
  const second = createPersonalPlanQuizResumeCredential()
  assert.equal(first.resumeToken.length >= 43, true)
  assert.notEqual(first.resumeToken, second.resumeToken)
  assert.equal(first.resumeTokenHash, hashPersonalPlanQuizResumeCredential(first.resumeToken))
  const encoded = encodePersonalPlanQuizDraftCookie({
    draftId: "0b670f15-faad-4eb2-a888-4ace59680bb0",
    browserGeneration: 2,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  assert.ok(encoded)
  assert.equal(decodePersonalPlanQuizDraftCookie(encoded)?.browserGeneration, 2)
  assert.equal(decodePersonalPlanQuizDraftCookie(`${encoded}x`), null)
  assert.equal(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE, "chaarlie_personal_plan_quiz_draft")
  assert.equal(PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY, "resume_token")
  assert.equal(personalPlanQuizDraftCookieOptions.httpOnly, true)
  assert.equal(personalPlanQuizDraftCookieOptions.path, "/")
  assert.equal(isPersonalPlanQuizDraftCookieSecretConfigured("short"), false)
  assert.equal(isPersonalPlanQuizDraftCookieSecretConfigured("x".repeat(32)), true)
  const snapshot = {
    draftId: "0b670f15-faad-4eb2-a888-4ace59680bb0",
    draft: { screen: "texture" as const, history: [], answers: {} },
    revision: 1,
    browserGeneration: 1,
  }
  assert.equal(
    shouldExchangePersonalPlanQuizResumeToken({
      snapshot,
      resumeToken: first.resumeToken,
      storedTokenHash: first.resumeTokenHash,
    }),
    false,
  )
  assert.equal(
    shouldExchangePersonalPlanQuizResumeToken({
      snapshot,
      resumeToken: first.resumeToken,
      storedTokenHash: second.resumeTokenHash,
    }),
    true,
  )

  const source = readFileSync(
    new URL("../src/lib/personal-plan-quiz/server-draft.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /createPersonalPlanClaimCredential/)
  assert.match(source, /hashPersonalPlanClaimToken/)
  assert.doesNotMatch(source, /randomBytes|createHash/)
})

test("landing recovery degrades to a clean snapshot when its read RPC throws", async () => {
  const result = await resolvePersonalPlanQuizDraftLandingState(
    { cookieValue: "ignored", resumeToken: "x".repeat(43) },
    { readSnapshotState: async () => Promise.reject(new Error("database unavailable")) },
  )
  assert.deepEqual(result, { snapshot: null, shouldExchange: true })
})

test("draft handlers reject disabled and cross-origin requests before database work", async () => {
  const originalFlag = process.env.PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED
  try {
    delete process.env.PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED
    const disabled = await postDraft(
      new NextRequest("https://chaarlie.de/api/quiz/personal-plan-draft", {
        method: "POST",
        headers: { Origin: "https://chaarlie.de", "Content-Type": "application/json" },
        body: JSON.stringify(minimalDraft),
      }),
    )
    assert.equal(disabled.status, 404)
    assert.equal(disabled.headers.get("cache-control"), "no-store, private")

    process.env.PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED = "true"
    const crossOrigin = await postDraft(
      new NextRequest("https://chaarlie.de/api/quiz/personal-plan-draft", {
        method: "POST",
        headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
        body: JSON.stringify(minimalDraft),
      }),
    )
    assert.equal(crossOrigin.status, 400)

    delete process.env.PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED
    const resume = await getResume(
      new NextRequest("https://chaarlie.de/api/quiz/personal-plan-draft/resume?resume_token=x"),
    )
    assert.equal(resume.status, 307)
    assert.equal(new URL(resume.headers.get("location")!).pathname, "/lp/haarplan")
  } finally {
    if (originalFlag === undefined)
      delete process.env.PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED
    else process.env.PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED = originalFlag
  }
})

test("replayed resume fallback preserves a valid stale draft cookie but clears absent or invalid cookies", () => {
  const validCookie = encodePersonalPlanQuizDraftCookie({
    draftId: "0b670f15-faad-4eb2-a888-4ace59680bb0",
    browserGeneration: 1,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  assert.ok(validCookie)

  const preserved = cleanRedirect(
    new NextRequest(
      "https://chaarlie.de/api/quiz/personal-plan-draft/resume?resume_token=replayed",
      {
        headers: { Cookie: `${PERSONAL_PLAN_QUIZ_DRAFT_COOKIE}=${validCookie}` },
      },
    ),
  )
  assert.equal(preserved.headers.get("set-cookie"), null)

  const absent = cleanRedirect(
    new NextRequest(
      "https://chaarlie.de/api/quiz/personal-plan-draft/resume?resume_token=replayed",
    ),
  )
  assert.match(absent.headers.get("set-cookie") ?? "", new RegExp(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE))
  assert.match(absent.headers.get("set-cookie") ?? "", /Max-Age=0/)

  const invalid = cleanRedirect(
    new NextRequest(
      "https://chaarlie.de/api/quiz/personal-plan-draft/resume?resume_token=replayed",
      {
        headers: { Cookie: `${PERSONAL_PLAN_QUIZ_DRAFT_COOKIE}=tampered` },
      },
    ),
  )
  assert.match(invalid.headers.get("set-cookie") ?? "", /Max-Age=0/)
})

test("migration keeps recovery state private, bounded, and atomically generation-aware", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260731124000_add_personal_plan_quiz_drafts.sql",
      import.meta.url,
    ),
    "utf8",
  )
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.personal_plan_quiz_drafts FROM anon, authenticated, public/,
  )
  assert.match(migration, /resume_token_hash text NOT NULL UNIQUE/)
  assert.match(migration, /expires_at <= created_at \+ interval '7 days'/)
  assert.match(migration, /FOR UPDATE/)
  assert.match(migration, /browser_generation = saved\.browser_generation \+ 1/)
  assert.match(migration, /d\.revision = p_expected_revision/)
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.exchange_personal_plan_quiz_draft\(text, text\) TO service_role/,
  )
})
