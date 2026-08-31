import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import QuizPage from "../src/app/quiz/page"
import { createMigrationQuizContextGetHandler } from "../src/app/api/personal-plan/migration-quiz-context/route"
import {
  deriveMigrationQuizPrefillState,
  fallbackMigrationQuizContextPayload,
  isMigrationQuizRecoverySearch,
  parseMigrationQuizContextPayload,
  resolveLeadCaptureRecoveryNextHref,
  resolveLeadCaptureServerNextHref,
} from "../src/lib/quiz/migration-prefill-init"
import {
  createMigrationQuizContextCookie,
  MIGRATION_QUIZ_CONTEXT_COOKIE,
} from "../src/lib/personal-plan/migration-quiz-context"
import { Button } from "../src/components/ui/button"
import { useQuizStore } from "../src/lib/quiz/store"

const userId = "50000000-0000-4000-8000-000000000005"
const otherUserId = "50000000-0000-4000-8000-000000000099"
const enrollmentId = "60000000-0000-4000-8000-000000000006"
const leadId = "10000000-0000-4000-8000-000000000001"
const secret = "migration-quiz-context-secret-32-plus"
const now = Date.UTC(2026, 7, 28, 12, 0, 0)

const rawLegacyAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "medium",
  fingertest: "leicht_uneben",
  pulltest: "elastisch",
  scalp: "unauffaellig",
  concerns: ["dryness", "unknown"],
  treatment: ["natur"],
  goals: ["shine"],
}

function signedCookie(input: { userId?: string; enrollmentId?: string } = {}) {
  const value = createMigrationQuizContextCookie(
    {
      userId: input.userId ?? userId,
      enrollmentId: input.enrollmentId ?? enrollmentId,
    },
    secret,
    now,
  )
  assert.ok(value)
  return value
}

function cookieStore(value: string | null = signedCookie()) {
  return {
    get: (name: string) =>
      name === MIGRATION_QUIZ_CONTEXT_COOKIE && value ? { value } : undefined,
  }
}

function adminClient({
  admissionStatus = "ready",
  quizSourceKind = "legacy",
  planRow = null,
  leadRow = {
    id: leadId,
    user_id: userId,
    quiz_kind: "legacy",
    quiz_answers: rawLegacyAnswers,
  },
}: {
  admissionStatus?: "pending_source" | "ready" | "ineligible"
  quizSourceKind?: "legacy" | "personal_plan"
  planRow?: unknown
  leadRow?: unknown
} = {}) {
  const calls: string[] = []
  const client = {
    calls,
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push(`rpc:${name}:${JSON.stringify(args)}`)
      if (admissionStatus === "ineligible") {
        return { data: { status: "ineligible" }, error: null }
      }
      if (admissionStatus === "pending_source") {
        return {
          data: {
            status: "pending_source",
            enrollment_id: enrollmentId,
            admitted_at: "2026-08-28T12:00:00.000Z",
            admission_kind: "one_time_purchase",
            admission_source_id: "70000000-0000-4000-8000-000000000007",
            lead_id: null,
            quiz_source_kind: null,
          },
          error: null,
        }
      }
      return {
        data: {
          status: "ready",
          enrollment_id: enrollmentId,
          admitted_at: "2026-08-28T12:00:00.000Z",
          admission_kind: "one_time_purchase",
          admission_source_id: "70000000-0000-4000-8000-000000000007",
          lead_id: leadId,
          quiz_source_kind: quizSourceKind,
        },
        error: null,
      }
    },
    from: (table: string) => {
      calls.push(`from:${table}`)
      if (table === "personal_plans") {
        return selectable(planRow)
      }
      if (table === "leads") {
        return selectable(leadRow)
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return client
}

function selectable(row: unknown) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  }
}

test("migration quiz context route recovers missing recovery cookie without admin lookup", async () => {
  let adminCreated = false
  const get = createMigrationQuizContextGetHandler({
    cookies: async () => cookieStore(null),
    createClient: async () => {
      throw new Error("ordinary quiz starts must not require auth")
    },
    createAdminClient: () => {
      adminCreated = true
      return adminClient()
    },
    cookieSecret: () => secret,
    now: () => now,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "recover" })
  assert.equal(adminCreated, false)
})

test("migration quiz context route returns canonical legacy answers only for the signed user's bound unused source", async () => {
  const admin = adminClient()
  const get = createMigrationQuizContextGetHandler({
    cookies: async () => cookieStore(),
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    }),
    createAdminClient: () => admin,
    cookieSecret: () => secret,
    now: () => now,
    migrationEnabled: () => true,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  assert.deepEqual(await response.json(), {
    status: "prefill",
    answers: {
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
    },
  })
  assert.ok(
    admin.calls.some((call) => call.startsWith("rpc:personal_plan_resolve_migration_admission")),
  )
  assert.ok(admin.calls.includes("from:personal_plans"))
  assert.ok(admin.calls.includes("from:leads"))
})

test("migration quiz context route uses a fresh blank quiz for pending source without guessing another draft", async () => {
  const admin = adminClient({ admissionStatus: "pending_source" })
  const get = createMigrationQuizContextGetHandler({
    cookies: async () => cookieStore(),
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    }),
    createAdminClient: () => admin,
    cookieSecret: () => secret,
    now: () => now,
    migrationEnabled: () => true,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "fresh_blank" })
  assert.equal(admin.calls.includes("from:leads"), false)
})

test("migration quiz context route uses a fresh blank quiz for a ready personal-plan source", async () => {
  const admin = adminClient({ quizSourceKind: "personal_plan" })
  const get = createMigrationQuizContextGetHandler({
    cookies: async () => cookieStore(),
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    }),
    createAdminClient: () => admin,
    cookieSecret: () => secret,
    now: () => now,
    migrationEnabled: () => true,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "fresh_blank" })
  assert.equal(admin.calls.includes("from:leads"), false)
})

test("migration quiz context route recovers when pending source belongs to a different enrollment", async () => {
  const admin = adminClient({ admissionStatus: "pending_source" })
  const get = createMigrationQuizContextGetHandler({
    cookies: async () =>
      cookieStore(signedCookie({ enrollmentId: "60000000-0000-4000-8000-000000000099" })),
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    }),
    createAdminClient: () => admin,
    cookieSecret: () => secret,
    now: () => now,
    migrationEnabled: () => true,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "recover" })
  assert.equal(admin.calls.includes("from:leads"), false)
})

test("migration quiz context route does not prefill after an existing plan has consumed the source", async () => {
  const get = createMigrationQuizContextGetHandler({
    cookies: async () => cookieStore(),
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    }),
    createAdminClient: () =>
      adminClient({
        planRow: {
          id: "80000000-0000-4000-8000-000000000008",
          current_initial_need_version_id: "n1",
        },
      }),
    cookieSecret: () => secret,
    now: () => now,
    migrationEnabled: () => true,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "recover" })
})

test("migration quiz context route recovers mismatched signed context without leaking data", async () => {
  let adminCreated = false
  const get = createMigrationQuizContextGetHandler({
    cookies: async () => cookieStore(signedCookie({ userId: otherUserId })),
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    }),
    createAdminClient: () => {
      adminCreated = true
      return adminClient()
    },
    cookieSecret: () => secret,
    now: () => now,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "recover" })
  assert.equal(adminCreated, false)
})

test("migration quiz context route reports unavailable for transient authoritative lookup failures", async () => {
  const get = createMigrationQuizContextGetHandler({
    cookies: async () => cookieStore(),
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    }),
    createAdminClient: () => ({
      rpc: async () => {
        throw new Error("database unavailable")
      },
      from: () => {
        throw new Error("must not continue after failed resolver")
      },
    }),
    cookieSecret: () => secret,
    now: () => now,
    migrationEnabled: () => true,
  })

  const response = await get()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "unavailable" })
})

test("migration quiz init helper resumes at the first missing prefilled question and ignores active work", () => {
  const parsed = parseMigrationQuizContextPayload({
    status: "prefill",
    answers: { structure: "curly", thickness: "normal" },
  })

  assert.deepEqual(parsed, {
    status: "prefill",
    answers: { structure: "curly", thickness: "normal" },
  })
  assert.deepEqual(
    deriveMigrationQuizPrefillState({
      currentStep: 2,
      currentAnswers: {},
      payload: parsed,
    }),
    {
      status: "prefill",
      step: 13,
      answers: { structure: "curly", thickness: "normal" },
    },
  )
  assert.deepEqual(
    deriveMigrationQuizPrefillState({
      currentStep: 3,
      currentAnswers: { structure: "wavy" },
      payload: parsed,
    }),
    { status: "ignore" },
  )
  assert.deepEqual(
    deriveMigrationQuizPrefillState({
      currentStep: 3,
      currentAnswers: { structure: "wavy" },
      payload: { status: "recover" },
    }),
    { status: "recover" },
  )
  assert.deepEqual(
    deriveMigrationQuizPrefillState({
      currentStep: 3,
      currentAnswers: { structure: "wavy" },
      payload: { status: "unavailable" },
    }),
    { status: "unavailable" },
  )
  assert.deepEqual(
    deriveMigrationQuizPrefillState({
      currentStep: 2,
      currentAnswers: {},
      payload: { status: "fresh_blank" },
    }),
    { status: "fresh_blank" },
  )
})

test("migration quiz init helper fails fresh-blank only for the exact server-issued recovery URL", () => {
  assert.equal(isMigrationQuizRecoverySearch("?mode=retake&returnTo=%2Fplan-bereit"), true)
  assert.equal(isMigrationQuizRecoverySearch("?returnTo=%2Fplan-bereit&mode=retake"), true)
  assert.equal(isMigrationQuizRecoverySearch("?mode=retake&returnTo=/plan-bereit"), true)
  assert.equal(isMigrationQuizRecoverySearch("?mode=retake&returnTo=%2Fonboarding"), false)
  assert.equal(isMigrationQuizRecoverySearch("?mode=regular&returnTo=%2Fplan-bereit"), false)
  assert.equal(isMigrationQuizRecoverySearch(""), false)

  assert.deepEqual(fallbackMigrationQuizContextPayload(true), { status: "unavailable" })
  assert.deepEqual(fallbackMigrationQuizContextPayload(false), { status: "inactive" })
  assert.deepEqual(parseMigrationQuizContextPayload(null), { status: "unavailable" })
})

test("lead capture only accepts the exact server-approved migration completion href", () => {
  assert.equal(resolveLeadCaptureServerNextHref({ nextHref: "/plan-bereit" }), "/plan-bereit")
  assert.equal(resolveLeadCaptureServerNextHref({ nextHref: "/onboarding" }), null)
  assert.equal(
    resolveLeadCaptureServerNextHref({ nextHref: "https://chaarlie.de/plan-bereit" }),
    null,
  )
  assert.equal(resolveLeadCaptureServerNextHref({}), null)

  assert.equal(
    resolveLeadCaptureRecoveryNextHref(
      { ok: false, status: 403 },
      { error: "Migration nicht verfügbar", nextHref: "/plan-bereit" },
    ),
    "/plan-bereit",
  )
  assert.equal(
    resolveLeadCaptureRecoveryNextHref(
      { ok: false, status: 503 },
      { error: "Migration nicht verfügbar", nextHref: "/plan-bereit" },
    ),
    null,
  )
})

test("migration quiz page retry rechecks context in place without losing live answers", async (t) => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window
  const previousFetch = globalThis.fetch
  const assigned: string[] = []
  let reloads = 0
  let fetchCalls = 0
  const storage = new Map<string, string>()

  ;(globalThis as unknown as { window: unknown }).window = {
    location: {
      search: "?mode=retake&returnTo=%2Fplan-bereit",
      assign: (href: string) => assigned.push(href),
      reload: () => {
        reloads += 1
      },
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    history: { pushState: () => undefined },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  globalThis.fetch = (async () => {
    fetchCalls += 1
    const body =
      fetchCalls === 1
        ? { status: "unavailable" }
        : { status: "prefill", answers: { structure: "curly", thickness: "coarse" } }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  t.after(() => {
    ;(globalThis as unknown as { window?: unknown }).window = previousWindow
    globalThis.fetch = previousFetch
    useQuizStore.getState().reset()
  })

  useQuizStore.setState({
    step: 3,
    answers: { structure: "wavy" },
    leadCaptureSubStep: "name",
    lead: { name: "", email: "", marketingConsent: false },
    leadId: null,
  })

  const harness = createClientStateHarness(() => QuizPage())
  let tree = await renderSettled(harness)
  assert.equal(fetchCalls, 1)
  assert.equal(reloads, 0)
  assert.deepEqual(assigned, [])
  assert.equal(elementRole(tree), "status")
  assert.match(textContent(tree), /Angaben konnten gerade nicht geladen werden/)

  const retry = findByType<React.ComponentProps<typeof Button>>(tree, Button)
  assert.equal(textContent(retry), "Erneut versuchen")
  retry?.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>)

  tree = await renderSettled(harness)
  assert.ok(fetchCalls >= 2, "retry should recheck the migration context in place")
  assert.equal(reloads, 0)
  assert.deepEqual(assigned, [])
  assert.deepEqual(useQuizStore.getState().answers, { structure: "wavy" })
  assert.equal(useQuizStore.getState().step, 3)
  assert.doesNotMatch(textContent(tree), /Angaben konnten gerade nicht geladen werden/)
})

type ReactDispatcherInternals = {
  H: unknown
}

type EffectRecord = {
  deps: unknown[] | undefined
  cleanup?: () => void
}

type HookMemoRecord<T> = {
  deps: unknown[] | undefined
  value: T
}

type ClientStateHarness = {
  render: () => Promise<ReactElement | null>
}

function createClientStateHarness(renderComponent: () => ReactElement | null): ClientStateHarness {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0
  let pendingEffects: Array<() => void | (() => void) | Promise<void | (() => void)>> = []

  function depsChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
    return (
      !previous ||
      !next ||
      previous.length !== next.length ||
      next.some((dep, index) => dep !== previous[index])
    )
  }

  const dispatcher = {
    useCallback<T extends (...args: never[]) => unknown>(callback: T, deps?: unknown[]): T {
      return this.useMemo(() => callback, deps)
    },
    useEffect(effect: () => void | (() => void) | Promise<void | (() => void)>, deps?: unknown[]) {
      const stateIndex = cursor
      cursor += 1
      const previous = hookValues[stateIndex] as EffectRecord | undefined
      if (depsChanged(previous?.deps, deps)) {
        previous?.cleanup?.()
        hookValues[stateIndex] = { deps } satisfies EffectRecord
        pendingEffects.push(effect)
      }
    },
    useLayoutEffect(
      effect: () => void | (() => void) | Promise<void | (() => void)>,
      deps?: unknown[],
    ) {
      this.useEffect(effect, deps)
    },
    useMemo<T>(factory: () => T, deps?: unknown[]): T {
      const stateIndex = cursor
      cursor += 1
      const previous = hookValues[stateIndex] as HookMemoRecord<T> | undefined
      if (previous && !depsChanged(previous.deps, deps)) return previous.value
      const value = factory()
      hookValues[stateIndex] = { deps, value } satisfies HookMemoRecord<T>
      return value
    },
    useRef<T>(initialValue: T): { current: T } {
      const stateIndex = cursor
      cursor += 1
      if (!hookValues[stateIndex]) hookValues[stateIndex] = { current: initialValue }
      return hookValues[stateIndex] as { current: T }
    },
    useState<T>(initialState: T | (() => T)): [T, (nextState: T | ((previous: T) => T)) => void] {
      const stateIndex = cursor
      cursor += 1

      if (hookValues.length <= stateIndex) {
        hookValues[stateIndex] =
          typeof initialState === "function" ? (initialState as () => T)() : initialState
      }

      return [
        hookValues[stateIndex] as T,
        (nextState) => {
          hookValues[stateIndex] =
            typeof nextState === "function"
              ? (nextState as (previous: T) => T)(hookValues[stateIndex] as T)
              : nextState
        },
      ]
    },
    useSyncExternalStore<T>(
      _subscribe: (listener: () => void) => () => void,
      getSnapshot: () => T,
    ): T {
      cursor += 1
      return getSnapshot()
    },
    useDebugValue() {},
  }

  return {
    async render() {
      cursor = 0
      pendingEffects = []
      reactInternals.H = dispatcher
      try {
        const tree = renderComponent()
        const effects = pendingEffects
        pendingEffects = []
        for (const effect of effects) {
          const cleanup = await effect()
          if (typeof cleanup === "function") {
            const effectIndex = hookValues.findIndex((value) => {
              const record = value as EffectRecord | undefined
              return record?.cleanup === undefined && record?.deps !== undefined
            })
            if (effectIndex >= 0) {
              ;(hookValues[effectIndex] as EffectRecord).cleanup = cleanup
            }
          }
        }
        await Promise.resolve()
        return tree
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

async function renderSettled(harness: ClientStateHarness): Promise<ReactElement | null> {
  await harness.render()
  await new Promise<void>((resolve) => setTimeout(resolve, 5))
  await harness.render()
  await new Promise<void>((resolve) => setTimeout(resolve, 5))
  return harness.render()
}

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode }>
  return React.Children.toArray(element.props.children)
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  return childrenOf(node)
    .map((child) => textContent(child))
    .join("")
}

function findByType<P>(node: ReactNode, type: ReactElement<P>["type"]): ReactElement<P> | null {
  if (!React.isValidElement(node)) return null
  const element = node as ReactElement<P & { children?: ReactNode }>
  if (element.type === type) return element as ReactElement<P>
  for (const child of childrenOf(element)) {
    const match = findByType<P>(child, type)
    if (match) return match
  }
  return null
}

function elementRole(node: ReactNode): string | undefined {
  if (!React.isValidElement(node)) return undefined
  return (node as ReactElement<{ role?: string }>).props.role
}
