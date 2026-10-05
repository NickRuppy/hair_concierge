import assert from "node:assert/strict"
import test from "node:test"

import {
  ROUTINE_PLAN_UPDATED_PARAM,
  consumeRoutinePlanUpdatedPending,
  hasRoutinePlanUpdatedSignal,
  markRoutinePlanUpdatedPending,
  withoutRoutinePlanUpdatedSignal,
  withRoutinePlanUpdatedSignal,
} from "../src/lib/personal-plan/routine/plan-updated-signal"

test("withRoutinePlanUpdatedSignal appends the signal to a bare path", () => {
  assert.equal(withRoutinePlanUpdatedSignal("/routine"), "/routine?planUpdated=1")
  assert.equal(ROUTINE_PLAN_UPDATED_PARAM, "planUpdated")
})

test("withRoutinePlanUpdatedSignal preserves an existing query string", () => {
  assert.equal(withRoutinePlanUpdatedSignal("/routine?foo=bar"), "/routine?foo=bar&planUpdated=1")
})

test("hasRoutinePlanUpdatedSignal reads the param from a URLSearchParams-like object", () => {
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("planUpdated=1")), true)
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("")), false)
  // Any other value is not the signal — only the exact "1" the writer emits.
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("planUpdated=0")), false)
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("planUpdated=true")), false)
})

test("round-trips through a real href", () => {
  const href = withRoutinePlanUpdatedSignal("/routine")
  const [, query] = href.split("?")
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams(query)), true)
})

test("withoutRoutinePlanUpdatedSignal strips only the signal, keeping other params (consume-once half)", () => {
  assert.equal(
    withoutRoutinePlanUpdatedSignal("/routine", new URLSearchParams("planUpdated=1")),
    "/routine",
  )
  assert.equal(
    withoutRoutinePlanUpdatedSignal("/routine", new URLSearchParams("foo=bar&planUpdated=1")),
    "/routine?foo=bar",
  )
})

test("consume-once: reading the signal, stripping it, then reading again from the stripped URL never re-signals", () => {
  const initial = new URLSearchParams("planUpdated=1")
  assert.equal(hasRoutinePlanUpdatedSignal(initial), true)

  const strippedHref = withoutRoutinePlanUpdatedSignal("/routine", initial)
  assert.equal(strippedHref, "/routine")

  // Simulates a reload/remount reading the URL the browser is now at.
  const [, query = ""] = strippedHref.split("?")
  const afterReload = new URLSearchParams(query)
  assert.equal(hasRoutinePlanUpdatedSignal(afterReload), false)
})

// --- one-shot pending mark (sessionStorage; Haar-Check editor -> Routine tab) ---

type WindowStub = { sessionStorage: Storage }

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size
    },
  } as Storage
}

function withWindow<T>(windowValue: WindowStub | undefined, run: () => T): T {
  const globals = globalThis as unknown as { window?: WindowStub }
  const previous = globals.window
  if (windowValue === undefined) delete globals.window
  else globals.window = windowValue
  try {
    return run()
  } finally {
    if (previous === undefined) delete globals.window
    else globals.window = previous
  }
}

const PENDING_KEY = "chaarlie_plan_updated_pending"

test("pending mark: mark(A) then consume(A) returns true once, then false", () => {
  const sessionStorage = memoryStorage()
  withWindow({ sessionStorage }, () => {
    markRoutinePlanUpdatedPending("user-a")
    assert.equal(sessionStorage.getItem(PENDING_KEY), "user-a")
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), true)
    assert.equal(sessionStorage.getItem(PENDING_KEY), null)
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
  })
})

test("pending mark: a marker set by A is discarded, not shown, for B (and gone for A afterwards)", () => {
  const sessionStorage = memoryStorage()
  withWindow({ sessionStorage }, () => {
    markRoutinePlanUpdatedPending("user-a")
    assert.equal(consumeRoutinePlanUpdatedPending("user-b"), false)
    assert.equal(sessionStorage.getItem(PENDING_KEY), null)
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
  })
})

test('pending mark: a legacy unbound "1" marker is discarded and yields false', () => {
  const sessionStorage = memoryStorage()
  sessionStorage.setItem(PENDING_KEY, "1")
  withWindow({ sessionStorage }, () => {
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
    assert.equal(sessionStorage.getItem(PENDING_KEY), null)
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
  })
})

test("pending mark: consume without a mark is false", () => {
  withWindow({ sessionStorage: memoryStorage() }, () => {
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
  })
})

test("pending mark: marking twice is still one signal; the latest owner wins", () => {
  const sessionStorage = memoryStorage()
  withWindow({ sessionStorage }, () => {
    markRoutinePlanUpdatedPending("user-a")
    markRoutinePlanUpdatedPending("user-a")
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), true)
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)

    markRoutinePlanUpdatedPending("user-a")
    markRoutinePlanUpdatedPending("user-b")
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
  })
})

test("pending mark: an empty user id never marks", () => {
  const sessionStorage = memoryStorage()
  withWindow({ sessionStorage }, () => {
    markRoutinePlanUpdatedPending("")
    assert.equal(sessionStorage.getItem(PENDING_KEY), null)
    assert.equal(consumeRoutinePlanUpdatedPending(""), false)
  })
})

test("pending mark: safe without a window (server render)", () => {
  withWindow(undefined, () => {
    assert.doesNotThrow(() => markRoutinePlanUpdatedPending("user-a"))
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
  })
})

test("pending mark: safe when sessionStorage throws (blocked storage)", () => {
  const throwing = {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("blocked")
    },
    removeItem: () => {
      throw new Error("blocked")
    },
  } as unknown as Storage
  withWindow({ sessionStorage: throwing }, () => {
    assert.doesNotThrow(() => markRoutinePlanUpdatedPending("user-a"))
    assert.equal(consumeRoutinePlanUpdatedPending("user-a"), false)
  })
})
