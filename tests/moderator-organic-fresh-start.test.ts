import assert from "node:assert/strict"
import test from "node:test"

import {
  consumeModeratorOrganicFreshStart,
  parseModeratorOrganicStartResponse,
  prepareModeratorOrganicFreshStart,
} from "../src/lib/quiz/moderator-fresh-start"
import { QUIZ_DRAFT_STORAGE_KEY } from "../src/lib/quiz/draft"

function storage(values = new Map<string, string>()) {
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}

test("new organic moderator start clears the legacy quiz draft once before restore", () => {
  const local = storage(new Map([[QUIZ_DRAFT_STORAGE_KEY, "old answers"]]))
  const session = storage()
  const browser = { local, session }

  assert.equal(prepareModeratorOrganicFreshStart("session-1", true, browser), "fresh")
  assert.equal(local.getItem(QUIZ_DRAFT_STORAGE_KEY), null)
  local.setItem(QUIZ_DRAFT_STORAGE_KEY, "new answers")
  assert.equal(prepareModeratorOrganicFreshStart("session-1", true, browser), "resume")
  assert.equal(local.getItem(QUIZ_DRAFT_STORAGE_KEY), "new answers")
  assert.equal(consumeModeratorOrganicFreshStart(browser), true)
  assert.equal(prepareModeratorOrganicFreshStart("session-1", true, browser), "resume")
  assert.equal(local.getItem(QUIZ_DRAFT_STORAGE_KEY), "new answers")
  assert.equal(consumeModeratorOrganicFreshStart(browser), false)
})

test("blocked browser storage fails closed", () => {
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
  }
  assert.equal(
    prepareModeratorOrganicFreshStart("session-1", true, { local: throwing, session: throwing }),
    "failed",
  )
  assert.equal(consumeModeratorOrganicFreshStart({ local: throwing, session: throwing }), true)
})

test("a failed first boundary can be safely initialized from the reused server session", () => {
  const local = storage(new Map([[QUIZ_DRAFT_STORAGE_KEY, "stale answers"]]))
  const blockedSession = {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("blocked")
    },
    removeItem: () => {
      throw new Error("blocked")
    },
  }
  assert.equal(
    prepareModeratorOrganicFreshStart("session-1", true, { local, session: blockedSession }),
    "failed",
  )
  assert.equal(
    prepareModeratorOrganicFreshStart("session-1", true, { local, session: storage() }),
    "fresh",
  )
  assert.equal(local.getItem(QUIZ_DRAFT_STORAGE_KEY), null)
})

test("response parsing allows an active return without a quiz session id", () => {
  assert.deepEqual(parseModeratorOrganicStartResponse({ destination: "/plan-start" }), {
    kind: "active",
  })
  assert.equal(parseModeratorOrganicStartResponse({ destination: "/quiz" }), null)
})

test("server-confirmed resume does not clear a current quiz draft in a new tab", () => {
  const parsed = parseModeratorOrganicStartResponse({
    destination: "/quiz",
    funnelSessionId: "30000000-0000-4000-8000-000000000003",
    freshStart: false,
  })
  assert(parsed?.kind === "quiz")
  assert.equal(parsed.freshStart, false)
  const local = storage(new Map([[QUIZ_DRAFT_STORAGE_KEY, "current answers"]]))
  const session = storage()

  assert.equal(
    prepareModeratorOrganicFreshStart(parsed.funnelSessionId, parsed.freshStart, {
      local,
      session,
    }),
    "resume",
  )
  assert.equal(local.getItem(QUIZ_DRAFT_STORAGE_KEY), "current answers")
  assert.equal(session.values.size, 0)
})

test("quiz response requires an explicit fresh-start flag", () => {
  assert.equal(
    parseModeratorOrganicStartResponse({
      destination: "/quiz",
      funnelSessionId: "30000000-0000-4000-8000-000000000003",
    }),
    null,
  )
})
