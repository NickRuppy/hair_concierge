import assert from "node:assert/strict"
import test from "node:test"

import {
  isModuleBannerDismissed,
  isNavSurfaceVisited,
  loadModuleBannerDismissals,
  loadVisitedNavSurfaces,
  PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE,
  type PersonalPlanLifecycleClient,
  recordModuleBannerDismissal,
  recordNavSurfaceVisited,
  shouldShowNavUnvisitedDot,
} from "../src/lib/personal-plan/lifecycle/repository"

type StoredRow = { user_id: string; kind: string; subject: string; marked_at: string }

/**
 * A minimal in-memory stand-in for the Supabase query builder: `.from(table)`
 * returns a thenable chain (`.select().eq().eq()` resolves like the real
 * client does when awaited directly), and `.upsert()` writes keyed on the
 * table's real primary key (user_id, kind, subject) so a repeat dismissal
 * overwrites rather than duplicates.
 */
function createInMemoryLifecycleClient(): {
  client: PersonalPlanLifecycleClient
  rows: () => StoredRow[]
} {
  const rows = new Map<string, StoredRow>()

  const client: PersonalPlanLifecycleClient = {
    from(table: string) {
      assert.equal(table, PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE)
      const filters: Record<string, unknown> = {}
      const query = {
        select() {
          return query
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return query
        },
        async upsert(row: Record<string, unknown>) {
          const key = `${row.user_id}|${row.kind}|${row.subject}`
          rows.set(key, row as StoredRow)
          return { error: null }
        },
        then(
          onFulfilled: (value: { data: StoredRow[]; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          const data = [...rows.values()].filter((row) =>
            Object.entries(filters).every(([column, value]) => (row as never)[column] === value),
          )
          return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
        },
      }
      return query as unknown as ReturnType<PersonalPlanLifecycleClient["from"]>
    },
  }

  return { client, rows: () => [...rows.values()] }
}

/** A client whose reads always fail, e.g. `42P01 undefined_table` pre-migration. */
function createFailingReadClient(errorCode: string): PersonalPlanLifecycleClient {
  return {
    from(table: string) {
      assert.equal(table, PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE)
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        async upsert() {
          return { error: { code: errorCode, message: "relation does not exist" } }
        },
        then(
          onFulfilled: (value: { data: null; error: { code: string } }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve({
            data: null,
            error: { code: errorCode, message: "relation does not exist" },
          }).then(onFulfilled, onRejected)
        },
      }
      return query as unknown as ReturnType<PersonalPlanLifecycleClient["from"]>
    },
  }
}

/** A client that throws synchronously, e.g. a broken connection. */
function createThrowingClient(): PersonalPlanLifecycleClient {
  return {
    from() {
      throw new Error("connection lost")
    },
  }
}

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER_USER = "22222222-2222-4222-8222-222222222222"
const NOW = "2026-08-25T12:00:00.000Z"

// --- Module banner dismissal ------------------------------------------------

test("recording a module banner dismissal and reading it back reports that module dismissed", async () => {
  const { client } = createInMemoryLifecycleClient()

  await recordModuleBannerDismissal(client, { userId: USER, module: "products", dismissedAt: NOW })
  const state = await loadModuleBannerDismissals(client, USER)

  assert.equal(isModuleBannerDismissed(state, "products"), true)
})

test("dismissing one module leaves the other module's banner un-dismissed (per-module independence, i.e. the reappear-once mechanism)", async () => {
  const { client } = createInMemoryLifecycleClient()

  await recordModuleBannerDismissal(client, { userId: USER, module: "products", dismissedAt: NOW })
  const state = await loadModuleBannerDismissals(client, USER)

  assert.equal(isModuleBannerDismissed(state, "products"), true)
  assert.equal(isModuleBannerDismissed(state, "habits"), false)
})

test("dismissing the same module twice is idempotent: exactly one stored row, still dismissed", async () => {
  const { client, rows } = createInMemoryLifecycleClient()

  await recordModuleBannerDismissal(client, { userId: USER, module: "products", dismissedAt: NOW })
  await recordModuleBannerDismissal(client, {
    userId: USER,
    module: "products",
    dismissedAt: "2026-08-25T13:00:00.000Z",
  })

  const state = await loadModuleBannerDismissals(client, USER)
  assert.equal(isModuleBannerDismissed(state, "products"), true)
  assert.equal(
    rows().filter((row) => row.kind === "module_banner_dismissed" && row.subject === "products")
      .length,
    1,
  )
})

test("dismissals are scoped per user: another user's dismissal never hides this user's banner", async () => {
  const { client } = createInMemoryLifecycleClient()

  await recordModuleBannerDismissal(client, {
    userId: OTHER_USER,
    module: "products",
    dismissedAt: NOW,
  })
  const state = await loadModuleBannerDismissals(client, USER)

  assert.equal(isModuleBannerDismissed(state, "products"), false)
})

test("a user with no dismissals reads as no modules dismissed", async () => {
  const { client } = createInMemoryLifecycleClient()
  const state = await loadModuleBannerDismissals(client, USER)
  assert.deepEqual([...state.dismissedModules], [])
})

test("module dismissal read degrades to 'no dismissals' (banner visible) when the table/columns are absent", async () => {
  const client = createFailingReadClient("42P01")
  const state = await loadModuleBannerDismissals(client, USER)
  assert.equal(isModuleBannerDismissed(state, "products"), false)
  assert.equal(isModuleBannerDismissed(state, "habits"), false)
})

test("module dismissal read degrades to 'no dismissals' when the client throws synchronously", async () => {
  const state = await loadModuleBannerDismissals(createThrowingClient(), USER)
  assert.deepEqual([...state.dismissedModules], [])
})

test("a stored subject outside the known module set is ignored rather than crashing the read", async () => {
  const { client } = createInMemoryLifecycleClient()
  // Simulates a row left over from a renamed/retired module.
  await recordModuleBannerDismissal(client, {
    userId: USER,
    // Cast through unknown: exercising defensive filtering of unexpected stored data.
    module: "legacy_module" as unknown as "products",
    dismissedAt: NOW,
  })
  const state = await loadModuleBannerDismissals(client, USER)
  assert.deepEqual([...state.dismissedModules], [])
})

test("recording a module banner dismissal surfaces a write error to the caller", async () => {
  const client = createFailingReadClient("42P01")
  await assert.rejects(() =>
    recordModuleBannerDismissal(client, { userId: USER, module: "products", dismissedAt: NOW }),
  )
})

// --- Nav-surface visited -----------------------------------------------------

test("recording a nav surface visit and reading it back reports that surface visited", async () => {
  const { client } = createInMemoryLifecycleClient()

  await recordNavSurfaceVisited(client, { userId: USER, surface: "profile", visitedAt: NOW })
  const state = await loadVisitedNavSurfaces(client, USER)

  assert.equal(state.available, true)
  assert.equal(isNavSurfaceVisited(state, "profile"), true)
  assert.equal(isNavSurfaceVisited(state, "application"), false)
})

test("a user with no visits reads as available with nothing visited (every non-routine tab dots)", async () => {
  const { client } = createInMemoryLifecycleClient()
  const state = await loadVisitedNavSurfaces(client, USER)

  assert.equal(state.available, true)
  assert.deepEqual([...state.visitedSurfaces], [])
  assert.equal(shouldShowNavUnvisitedDot(state, "chat"), true)
  assert.equal(shouldShowNavUnvisitedDot(state, "profile"), true)
})

test("routine is never dotted, visited or not", async () => {
  const { client } = createInMemoryLifecycleClient()
  const neverVisited = await loadVisitedNavSurfaces(client, USER)
  assert.equal(shouldShowNavUnvisitedDot(neverVisited, "routine"), false)

  await recordNavSurfaceVisited(client, { userId: USER, surface: "routine", visitedAt: NOW })
  const visited = await loadVisitedNavSurfaces(client, USER)
  assert.equal(shouldShowNavUnvisitedDot(visited, "routine"), false)
})

test("a visited surface no longer shows the unvisited dot", async () => {
  const { client } = createInMemoryLifecycleClient()
  await recordNavSurfaceVisited(client, { userId: USER, surface: "chat", visitedAt: NOW })
  const state = await loadVisitedNavSurfaces(client, USER)

  assert.equal(shouldShowNavUnvisitedDot(state, "chat"), false)
  assert.equal(shouldShowNavUnvisitedDot(state, "profile"), true)
})

test("visiting the same nav surface twice is idempotent: exactly one stored row", async () => {
  const { client, rows } = createInMemoryLifecycleClient()

  await recordNavSurfaceVisited(client, { userId: USER, surface: "application", visitedAt: NOW })
  await recordNavSurfaceVisited(client, {
    userId: USER,
    surface: "application",
    visitedAt: "2026-08-25T13:00:00.000Z",
  })

  assert.equal(
    rows().filter((row) => row.kind === "nav_surface_visited" && row.subject === "application")
      .length,
    1,
  )
})

test("nav-visited state is independent per module-banner state: the two kinds never leak into each other", async () => {
  const { client } = createInMemoryLifecycleClient()

  await recordModuleBannerDismissal(client, { userId: USER, module: "products", dismissedAt: NOW })
  await recordNavSurfaceVisited(client, { userId: USER, surface: "profile", visitedAt: NOW })

  const dismissals = await loadModuleBannerDismissals(client, USER)
  const visited = await loadVisitedNavSurfaces(client, USER)

  assert.deepEqual([...dismissals.dismissedModules], ["products"])
  assert.deepEqual([...visited.visitedSurfaces], ["profile"])
})

test("nav-visited read degrades to unavailable — no dots anywhere, NOT a dot on every tab — when the table is absent", async () => {
  const client = createFailingReadClient("42P01")
  const state = await loadVisitedNavSurfaces(client, USER)

  assert.equal(state.available, false)
  assert.equal(isNavSurfaceVisited(state, "chat"), false)
  // The naive reading of an empty visited-set ("nothing visited" => dot
  // everywhere) is exactly what this feature must NOT do pre-migration.
  assert.equal(shouldShowNavUnvisitedDot(state, "chat"), false)
  assert.equal(shouldShowNavUnvisitedDot(state, "profile"), false)
})

test("nav-visited read degrades to unavailable when the client throws synchronously", async () => {
  const state = await loadVisitedNavSurfaces(createThrowingClient(), USER)
  assert.equal(state.available, false)
  assert.equal(shouldShowNavUnvisitedDot(state, "chat"), false)
})

test("recording a nav surface visit surfaces a write error to the caller", async () => {
  const client = createFailingReadClient("42P01")
  await assert.rejects(() =>
    recordNavSurfaceVisited(client, { userId: USER, surface: "routine", visitedAt: NOW }),
  )
})
