import assert from "node:assert/strict"
import test from "node:test"

import { createProgressiveEntryLoader } from "../src/components/personal-plan-quiz/progressive-entry-runtime"
import {
  consumeProgressiveEntryRecovery,
  persistProgressiveEntryRecovery,
  type ProgressiveEntryRecoveryStorage,
} from "../src/components/personal-plan-quiz/progressive-entry-recovery"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createHarness<T>(attempts: Array<ReturnType<typeof deferred<T>>>) {
  const timers: Array<{ callback: () => void; delayMs: number; cancelled: boolean }> = []
  let online = true
  let visible = true
  let loadCalls = 0
  const failures: Array<{ attempt: number; error: unknown }> = []
  const loader = createProgressiveEntryLoader<T>({
    loadModule: () => attempts[loadCalls++].promise,
    isOnline: () => online,
    isVisible: () => visible,
    schedule(callback, delayMs) {
      const timer = { callback, delayMs, cancelled: false }
      timers.push(timer)
      return timer
    },
    cancel(handle) {
      ;(handle as (typeof timers)[number]).cancelled = true
    },
    onAttemptFailure(error, attempt) {
      failures.push({ attempt, error })
    },
  })
  return {
    failures,
    loader,
    get loadCalls() {
      return loadCalls
    },
    setOnline(value: boolean) {
      online = value
    },
    setVisible(value: boolean) {
      visible = value
    },
    timers,
  }
}

test("progressive loader retries automatically and keeps one pending consumer promise", async () => {
  const first = deferred<{ name: string }>()
  const second = deferred<{ name: string }>()
  const harness = createHarness([first, second])

  const load = harness.loader.load()
  assert.equal(harness.loader.load(), load)
  assert.equal(harness.loadCalls, 1)

  const failure = new Error("chunk failed")
  first.reject(failure)
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(harness.failures, [{ attempt: 1, error: failure }])
  assert.equal(harness.timers.length, 1)
  assert.equal(harness.timers[0].delayMs, 500)

  harness.timers[0].callback()
  assert.equal(harness.loadCalls, 2)
  second.resolve({ name: "quiz" })
  assert.deepEqual(await load, { name: "quiz" })
})

test("progressive loader pauses offline and retries immediately when connectivity returns", async () => {
  const first = deferred<string>()
  const second = deferred<string>()
  const harness = createHarness([first, second])

  const load = harness.loader.load()
  assert.equal(harness.loadCalls, 1)
  harness.setOnline(false)
  first.reject(new Error("offline"))
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(harness.timers.length, 0)
  assert.equal(harness.loadCalls, 1)

  harness.setOnline(true)
  harness.loader.retryNow()
  assert.equal(harness.loadCalls, 2)
  second.resolve("ready")
  assert.equal(await load, "ready")
})

test("progressive loader pauses while hidden and caps exponential backoff at ten seconds", async () => {
  const attempts = Array.from({ length: 7 }, () => deferred<string>())
  const harness = createHarness(attempts)
  const load = harness.loader.load()

  for (let index = 0; index < 6; index += 1) {
    attempts[index].reject(new Error(`failure ${index + 1}`))
    await Promise.resolve()
    await Promise.resolve()
    const timer = harness.timers.at(-1)
    assert.ok(timer)
    assert.equal(timer.delayMs, Math.min(500 * 2 ** index, 10_000))
    timer.callback()
  }

  harness.setVisible(false)
  attempts[6].reject(new Error("hidden"))
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(harness.timers.length, 6)

  harness.setVisible(true)
  const final = deferred<string>()
  attempts.push(final)
  harness.loader.retryNow()
  final.resolve("ready")
  assert.equal(await load, "ready")
})

test("disposing the loader cancels scheduled recovery", async () => {
  const first = deferred<string>()
  const harness = createHarness([first])
  void harness.loader.load()
  first.reject(new Error("failed"))
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(harness.timers.length, 1)
  harness.loader.dispose()
  assert.equal(harness.timers[0].cancelled, true)
  harness.timers[0].callback()
  assert.equal(harness.loadCalls, 1)
})

test("automatic document recovery preserves the selected texture exactly once", () => {
  const values = new Map<string, string>()
  const storage: ProgressiveEntryRecoveryStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }

  persistProgressiveEntryRecovery(storage, {
    attempt: 1,
    kind: "selected",
    quizStarted: true,
    selectedAt: 1234,
    texture: "curly",
  })

  assert.deepEqual(consumeProgressiveEntryRecovery(storage), {
    attempt: 1,
    kind: "selected",
    quizStarted: true,
    selectedAt: 1234,
    texture: "curly",
  })
  assert.equal(consumeProgressiveEntryRecovery(storage), null)
})

test("automatic document recovery preserves local-draft authority", () => {
  const values = new Map<string, string>()
  const storage: ProgressiveEntryRecoveryStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }

  persistProgressiveEntryRecovery(storage, { attempt: 1, kind: "local_draft" })
  assert.deepEqual(consumeProgressiveEntryRecovery(storage), {
    attempt: 1,
    kind: "local_draft",
  })
})

test("automatic document recovery rejects malformed state", () => {
  const values = new Map<string, string>()
  const storage: ProgressiveEntryRecoveryStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }

  values.set("personal-plan-progressive-entry-recovery", JSON.stringify({ texture: "unknown" }))
  assert.equal(consumeProgressiveEntryRecovery(storage), null)
  assert.equal(values.size, 0)
})
