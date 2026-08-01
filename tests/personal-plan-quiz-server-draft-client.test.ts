import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY,
  buildPersonalPlanQuizResumeUrl,
  buildPersonalPlanQuizServerDraftPayload,
  choosePersonalPlanQuizResumeDraft,
  clearPersonalPlanQuizDraft,
  createPersonalPlanQuizServerDraftSession,
  hasPersonalPlanQuizDurableAnswer,
  interpretPersonalPlanQuizServerDraftResponse,
  loadPersonalPlanQuizDraft,
  pushPersonalPlanQuizHistoryState,
  replacePersonalPlanQuizResumeTokenInCurrentUrl,
  savePersonalPlanQuizDraft,
  shouldFlushPersonalPlanQuizDraftOnPageHide,
  stripPersonalPlanQuizResumeTokenFromCurrentUrl,
  type PersonalPlanQuizDraft,
  type PersonalPlanQuizServerSnapshot,
} from "../src/lib/personal-plan-quiz"

const DRAFT_ID = "0b670f15-faad-4eb2-a888-4ace59680bb0"

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

type MockResponse = ReturnType<typeof response>
type MockFetch = (_input?: unknown, init?: RequestInit) => Promise<MockResponse>

function appendDraftRequest(
  requests: Array<{
    allowRevisionCatchup?: true
    keepalive?: boolean
    expectedRevision?: number
    screen?: string
  }>,
  body: { allowRevisionCatchup?: true; expectedRevision?: number; screen?: string },
  init?: RequestInit,
) {
  requests.push({
    ...(body.allowRevisionCatchup === true ? { allowRevisionCatchup: true } : {}),
    ...(init?.keepalive !== undefined ? { keepalive: init.keepalive } : {}),
    ...(body.expectedRevision !== undefined ? { expectedRevision: body.expectedRevision } : {}),
    ...(body.screen ? { screen: body.screen } : {}),
  })
}

function fakeWindow(href = "https://chaarlie.example/lp/haarplan?utm_source=meta#quiz") {
  const calls: Array<{ method: "replaceState" | "pushState"; state: unknown; url: string }> = []
  const historyState: { state: unknown } = { state: { ppq: 2 } }
  const win = {
    location: { href },
    history: {
      get state() {
        return historyState.state
      },
      set state(value: unknown) {
        historyState.state = value
      },
      replaceState(state: unknown, _title: string, url?: string | URL | null) {
        const nextUrl = String(url)
        calls.push({ method: "replaceState", state, url: nextUrl })
        win.location.href = nextUrl
        this.state = state
      },
      pushState(state: unknown, _title: string, url?: string | URL | null) {
        const nextUrl = String(url)
        calls.push({ method: "pushState", state, url: nextUrl })
        win.location.href = nextUrl
        this.state = state
      },
    },
    fetch: (async () => response(404)) as MockFetch,
  }
  return { win, calls }
}

test("v3 local drafts remain compatible while carrying optional server metadata", () => {
  const storage = new MemoryStorage()
  savePersonalPlanQuizDraft(
    {
      screen: "goals",
      history: ["texture", "thickness"],
      answers: { texture: "wavy" },
      serverDraftId: DRAFT_ID,
      serverRevision: 7,
      browserGeneration: 3,
    },
    storage,
  )

  assert.deepEqual(loadPersonalPlanQuizDraft(storage), {
    screen: "goals",
    history: ["texture", "thickness"],
    answers: { texture: "wavy" },
    serverDraftId: DRAFT_ID,
    serverRevision: 7,
    browserGeneration: 3,
  })

  storage.setItem(
    PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 3,
      screen: "texture",
      history: [],
      answers: { texture: "coily" },
    }),
  )
  assert.deepEqual(loadPersonalPlanQuizDraft(storage), {
    screen: "texture",
    history: [],
    answers: { texture: "coily" },
  })

  clearPersonalPlanQuizDraft(storage)
  assert.equal(loadPersonalPlanQuizDraft(storage), null)
})

test("resume reconciliation keeps equal local drafts and accepts only demonstrably newer server snapshots", () => {
  const local: PersonalPlanQuizDraft = {
    screen: "goals",
    history: ["texture", "thickness"],
    answers: { texture: "wavy" },
    serverDraftId: DRAFT_ID,
    serverRevision: 4,
    browserGeneration: 2,
  }
  const equalServer: PersonalPlanQuizServerSnapshot = {
    draftId: DRAFT_ID,
    revision: 4,
    browserGeneration: 2,
    draft: {
      screen: "thickness",
      history: ["texture"],
      answers: { texture: "straight" },
    },
  }
  const newerServer: PersonalPlanQuizServerSnapshot = {
    ...equalServer,
    revision: 5,
    draft: {
      screen: "density",
      history: ["texture", "thickness"],
      answers: { texture: "curly", thickness: "fine" },
    },
  }

  assert.equal(choosePersonalPlanQuizResumeDraft(local, equalServer).source, "local")
  assert.deepEqual(choosePersonalPlanQuizResumeDraft(null, equalServer), {
    source: "server",
    draft: {
      screen: "thickness",
      history: ["texture"],
      answers: { texture: "straight" },
      serverDraftId: DRAFT_ID,
      serverRevision: 4,
      browserGeneration: 2,
    },
  })
  assert.deepEqual(choosePersonalPlanQuizResumeDraft(local, newerServer), {
    source: "server",
    draft: {
      screen: "density",
      history: ["texture", "thickness"],
      answers: { texture: "curly", thickness: "fine" },
      serverDraftId: DRAFT_ID,
      serverRevision: 5,
      browserGeneration: 2,
    },
  })

  assert.equal(
    choosePersonalPlanQuizResumeDraft(
      {
        screen: "goals",
        history: ["texture"],
        answers: { texture: "coily" },
      },
      equalServer,
    ).source,
    "server",
  )
})

test("server draft payload is versioned, partial-safe, and durable-only", () => {
  const payload = buildPersonalPlanQuizServerDraftPayload(
    {
      screen: "plan_loading",
      history: ["texture", "daily_time", "plan_loading"],
      answers: {
        texture: "wavy",
        email: "lea@example.com",
        marketingConsent: true,
        dailyTime: "10_minutes",
        microcommitments: ["understand"],
      } as never,
    },
    9,
  )

  assert.deepEqual(payload, {
    version: 3,
    screen: "plan_loading",
    history: ["texture", "daily_time", "plan_loading"],
    answers: { texture: "wavy" },
    expectedRevision: 9,
  })
  assert.equal(hasPersonalPlanQuizDurableAnswer({}), false)
  assert.equal(hasPersonalPlanQuizDurableAnswer({ texture: "wavy" }), true)

  assert.deepEqual(
    buildPersonalPlanQuizServerDraftPayload(
      { screen: "texture", history: [], answers: { texture: "wavy" } },
      9,
      { allowRevisionCatchup: true },
    ),
    {
      version: 3,
      screen: "texture",
      history: [],
      answers: { texture: "wavy" },
      expectedRevision: 9,
      allowRevisionCatchup: true,
    },
  )
})

test("resume token URL helpers preserve state, query, and fragments", () => {
  assert.equal(
    buildPersonalPlanQuizResumeUrl(
      "https://chaarlie.example/lp/haarplan?utm_source=meta#quiz",
      "opaque",
    ),
    "https://chaarlie.example/lp/haarplan?utm_source=meta&resume_token=opaque#quiz",
  )
  assert.equal(
    buildPersonalPlanQuizResumeUrl(
      "https://chaarlie.example/lp/haarplan?utm_source=meta&resume_token=old#quiz",
      null,
    ),
    "https://chaarlie.example/lp/haarplan?utm_source=meta#quiz",
  )

  const { win, calls } = fakeWindow()
  replacePersonalPlanQuizResumeTokenInCurrentUrl("opaque", win)
  pushPersonalPlanQuizHistoryState({ ppq: 3 }, win)
  stripPersonalPlanQuizResumeTokenFromCurrentUrl(win)

  assert.deepEqual(calls, [
    {
      method: "replaceState",
      state: { ppq: 2 },
      url: "https://chaarlie.example/lp/haarplan?utm_source=meta&resume_token=opaque#quiz",
    },
    {
      method: "pushState",
      state: { ppq: 3 },
      url: "https://chaarlie.example/lp/haarplan?utm_source=meta&resume_token=opaque#quiz",
    },
    {
      method: "replaceState",
      state: { ppq: 3 },
      url: "https://chaarlie.example/lp/haarplan?utm_source=meta#quiz",
    },
  ])
})

test("server draft responses normalize flag-off, retryable, stale, and saved states", async () => {
  assert.deepEqual(await interpretPersonalPlanQuizServerDraftResponse(response(404)), {
    status: "disabled",
  })
  assert.deepEqual(await interpretPersonalPlanQuizServerDraftResponse(response(202)), {
    status: "retryable",
  })
  assert.deepEqual(await interpretPersonalPlanQuizServerDraftResponse(response(409)), {
    status: "stale",
  })
  assert.deepEqual(
    await interpretPersonalPlanQuizServerDraftResponse(
      response(200, {
        status: "saved",
        draftId: DRAFT_ID,
        revision: 3,
        browserGeneration: 2,
        resumeToken: "next",
      }),
    ),
    {
      status: "saved",
      draftId: DRAFT_ID,
      revision: 3,
      browserGeneration: 2,
      resumeToken: "next",
    },
  )
})

test("server draft session disables on 404 and strips stale tokens on 409", async () => {
  const fetchStatuses = [404, 409]
  const { win, calls } = fakeWindow(
    "https://chaarlie.example/lp/haarplan?resume_token=stale&utm_source=meta#quiz",
  )
  win.fetch = async () => response(fetchStatuses.shift() ?? 200)

  const disabledSession = createPersonalPlanQuizServerDraftSession({
    bootstrap: { enabled: true, snapshot: null },
    win,
  })
  disabledSession.queueSave({ screen: "texture", history: [], answers: { texture: "wavy" } })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(disabledSession.enabled, false)
  assert.equal(calls.at(-1)?.url, "https://chaarlie.example/lp/haarplan?utm_source=meta#quiz")

  replacePersonalPlanQuizResumeTokenInCurrentUrl("stale", win)
  const staleSession = createPersonalPlanQuizServerDraftSession({
    bootstrap: { enabled: true, snapshot: null },
    win,
  })
  staleSession.queueSave({ screen: "texture", history: [], answers: { texture: "curly" } })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(staleSession.stale, true)
  assert.equal(calls.at(-1)?.url, "https://chaarlie.example/lp/haarplan?utm_source=meta#quiz")
})

test("server draft session contains network failures and retries with bounded backoff", async () => {
  const { win } = fakeWindow()
  let attempts = 0
  win.fetch = async () => {
    attempts += 1
    throw new Error("offline")
  }

  const session = createPersonalPlanQuizServerDraftSession({
    bootstrap: { enabled: true, snapshot: null },
    win,
  })
  session.queueSave({ screen: "texture", history: [], answers: { texture: "wavy" } })

  await new Promise((resolve) => setTimeout(resolve, 850))
  assert.equal(attempts, 3)
  assert.equal(session.enabled, true)
  assert.equal(session.stale, false)
})

test("server draft session publishes draft identity and revision after a successful create", async () => {
  const { win } = fakeWindow()
  win.fetch = async () =>
    response(200, {
      status: "created",
      draftId: DRAFT_ID,
      revision: 1,
      browserGeneration: 1,
      resumeToken: "opaque",
    })
  let metadata: { draftId: string; revision: number; browserGeneration: number } | null = null
  const session = createPersonalPlanQuizServerDraftSession({
    bootstrap: { enabled: true, snapshot: null },
    onMetadata: (next) => {
      metadata = next
    },
    win,
  })

  session.queueSave({ screen: "texture", history: [], answers: { texture: "wavy" } })
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(metadata, { draftId: DRAFT_ID, revision: 1, browserGeneration: 1 })
  assert.deepEqual(session.getMetadata(), metadata)
})

test("pagehide helper skips bfcache restores and keeps non-persisted unload flushing", () => {
  assert.equal(shouldFlushPersonalPlanQuizDraftOnPageHide({ persisted: true }), false)
  assert.equal(shouldFlushPersonalPlanQuizDraftOnPageHide({ persisted: false }), true)
})

test("non-persisted pagehide keepalive is the terminal server write for that heap", async () => {
  const { win } = fakeWindow()
  const requests: Array<{
    allowRevisionCatchup?: true
    keepalive?: boolean
    expectedRevision?: number
  }> = []
  win.fetch = async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      allowRevisionCatchup?: true
      expectedRevision?: number
    }
    appendDraftRequest(requests, body, init)
    if (init?.keepalive) {
      return response(200, {
        status: "saved",
        draftId: DRAFT_ID,
        revision: 2,
        browserGeneration: 1,
      })
    }
    return response(200, {
      status: "saved",
      draftId: DRAFT_ID,
      revision: 3,
      browserGeneration: 1,
    })
  }

  const session = createPersonalPlanQuizServerDraftSession({
    bootstrap: {
      enabled: true,
      snapshot: {
        draftId: DRAFT_ID,
        revision: 1,
        browserGeneration: 1,
        draft: { screen: "texture", history: [], answers: { texture: "wavy" } },
      },
    },
    win,
  })

  session.flushKeepalive({
    screen: "thickness",
    history: ["texture"],
    answers: { texture: "wavy" },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  session.queueSave({
    screen: "goals",
    history: ["texture", "thickness"],
    answers: { texture: "wavy", thickness: "fine" },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(requests, [
    { allowRevisionCatchup: true, keepalive: true, expectedRevision: 1, screen: "thickness" },
  ])
  assert.equal(session.stale, false)
  assert.deepEqual(session.getMetadata(), {
    draftId: DRAFT_ID,
    revision: 2,
    browserGeneration: 1,
  })
})

test("normal autosave first then freshest catch-up keepalive persists without latching stale", async () => {
  const { win } = fakeWindow()
  const requests: Array<{
    allowRevisionCatchup?: true
    keepalive?: boolean
    expectedRevision?: number
    screen?: string
  }> = []
  let resolveNormal: ((value: MockResponse) => void) | null = null
  let resolveKeepalive: ((value: MockResponse) => void) | null = null
  win.fetch = async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      allowRevisionCatchup?: true
      expectedRevision?: number
      screen?: string
    }
    appendDraftRequest(requests, body, init)
    if (init?.keepalive) {
      return new Promise((resolve) => {
        resolveKeepalive = resolve
      })
    }
    return new Promise((resolve) => {
      resolveNormal = resolve
    })
  }

  const session = createPersonalPlanQuizServerDraftSession({
    bootstrap: {
      enabled: true,
      snapshot: {
        draftId: DRAFT_ID,
        revision: 1,
        browserGeneration: 1,
        draft: { screen: "texture", history: [], answers: { texture: "wavy" } },
      },
    },
    win,
  })

  session.queueSave({
    screen: "thickness",
    history: ["texture"],
    answers: { texture: "wavy" },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  session.queueSave({
    screen: "goals",
    history: ["texture", "thickness"],
    answers: { texture: "wavy", thickness: "fine" },
  })
  session.flushKeepalive({
    screen: "goals",
    history: ["texture", "thickness"],
    answers: { texture: "wavy", thickness: "fine" },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.ok(resolveNormal)
  assert.ok(resolveKeepalive)
  ;(resolveNormal as (value: MockResponse) => void)(
    response(200, {
      status: "saved",
      draftId: DRAFT_ID,
      revision: 2,
      browserGeneration: 1,
    }),
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  ;(resolveKeepalive as (value: MockResponse) => void)(
    response(200, {
      status: "saved",
      draftId: DRAFT_ID,
      revision: 3,
      browserGeneration: 1,
    }),
  )
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(requests, [
    { expectedRevision: 1, screen: "thickness" },
    { allowRevisionCatchup: true, keepalive: true, expectedRevision: 1, screen: "goals" },
  ])
  assert.equal(session.stale, false)
  assert.deepEqual(session.getMetadata(), {
    draftId: DRAFT_ID,
    revision: 3,
    browserGeneration: 1,
  })
})

test("catch-up keepalive first then older normal stale response is ignored", async () => {
  const { win } = fakeWindow()
  const requests: Array<{
    allowRevisionCatchup?: true
    keepalive?: boolean
    expectedRevision?: number
    screen?: string
  }> = []
  let resolveNormal: ((value: MockResponse) => void) | null = null
  let resolveKeepalive: ((value: MockResponse) => void) | null = null
  win.fetch = async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      allowRevisionCatchup?: true
      expectedRevision?: number
      screen?: string
    }
    appendDraftRequest(requests, body, init)
    if (init?.keepalive) {
      return new Promise((resolve) => {
        resolveKeepalive = resolve
      })
    }
    return new Promise((resolve) => {
      resolveNormal = resolve
    })
  }

  const session = createPersonalPlanQuizServerDraftSession({
    bootstrap: {
      enabled: true,
      snapshot: {
        draftId: DRAFT_ID,
        revision: 1,
        browserGeneration: 1,
        draft: { screen: "texture", history: [], answers: { texture: "wavy" } },
      },
    },
    win,
  })

  session.queueSave({
    screen: "thickness",
    history: ["texture"],
    answers: { texture: "wavy" },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  session.queueSave({
    screen: "goals",
    history: ["texture", "thickness"],
    answers: { texture: "wavy", thickness: "fine" },
  })
  session.flushKeepalive({
    screen: "goals",
    history: ["texture", "thickness"],
    answers: { texture: "wavy", thickness: "fine" },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.ok(resolveNormal)
  assert.ok(resolveKeepalive)
  ;(resolveKeepalive as (value: MockResponse) => void)(
    response(200, {
      status: "saved",
      draftId: DRAFT_ID,
      revision: 2,
      browserGeneration: 1,
    }),
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  ;(resolveNormal as (value: MockResponse) => void)(response(409))
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(requests, [
    { expectedRevision: 1, screen: "thickness" },
    { allowRevisionCatchup: true, keepalive: true, expectedRevision: 1, screen: "goals" },
  ])
  assert.equal(session.stale, false)
  assert.deepEqual(session.getMetadata(), {
    draftId: DRAFT_ID,
    revision: 2,
    browserGeneration: 1,
  })
})

test("server route and migration wire unload catch-up without weakening browser generation", () => {
  const parser = readFileSync("src/lib/personal-plan-quiz/server-draft.ts", "utf8")
  const route = readFileSync("src/app/api/quiz/personal-plan-draft/route.ts", "utf8")
  const migration = readFileSync(
    "supabase/migrations/20260731124000_add_personal_plan_quiz_drafts.sql",
    "utf8",
  )

  assert.match(parser, /allowRevisionCatchup: z\.literal\(true\)\.optional\(\)/)
  assert.match(route, /p_allow_revision_catchup: parsed\.allowRevisionCatchup === true/)
  assert.match(migration, /p_allow_revision_catchup boolean DEFAULT false/)
  assert.match(migration, /d\.browser_generation = p_browser_generation/)
  assert.match(migration, /d\.revision = p_expected_revision/)
  assert.match(
    migration,
    /p_allow_revision_catchup IS TRUE[\s\S]{0,120}d\.revision = p_expected_revision \+ 1/,
  )
})
