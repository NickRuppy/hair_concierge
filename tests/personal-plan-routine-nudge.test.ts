import assert from "node:assert/strict"
import test from "node:test"

import {
  computeRoutineRefinementNudgeDismissedUntil,
  ROUTINE_REFINEMENT_NUDGE_HREF,
  ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS,
  shouldShowRoutineRefinementNudge,
} from "../src/lib/personal-plan/routine/nudge"
import { loadPersonalPlanRoutineView } from "../src/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "../src/lib/personal-plan/routine/repository"
import { parseRefineParam } from "../src/app/plan-start/page"

const NOW = Date.parse("2026-08-16T12:00:00.000Z")

test("nudge stays hidden once the Routine is no longer an unrefined direct accept", () => {
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: false,
      nudgeDismissedUntil: null,
      now: NOW,
    }),
    false,
  )
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: false,
      nudgeDismissedUntil: new Date(NOW - 1).toISOString(),
      now: NOW,
    }),
    false,
  )
})

test("nudge shows for an unrefined direct accept with no prior dismissal", () => {
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: null,
      now: NOW,
    }),
    true,
  )
})

test("nudge stays hidden while now is before the dismissed-until instant", () => {
  const dismissedUntil = new Date(NOW + 60_000).toISOString()
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW,
    }),
    false,
  )
})

test("nudge reappears once now reaches or passes the dismissed-until instant", () => {
  const dismissedUntil = new Date(NOW).toISOString()
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW,
    }),
    true,
  )
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW + 1,
    }),
    true,
  )
})

test("a malformed dismissed-until value is treated as not dismissed", () => {
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: "not-a-date",
      now: NOW,
    }),
    true,
  )
})

test("computeRoutineRefinementNudgeDismissedUntil snoozes exactly one day from the injected clock", () => {
  const dismissedUntil = computeRoutineRefinementNudgeDismissedUntil(NOW)
  assert.equal(Date.parse(dismissedUntil), NOW + ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS)
  assert.equal(ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS, 24 * 60 * 60 * 1000)

  // Round-tripping the computed value back through the visibility check
  // reproduces the dismiss/reappear boundary without any real time passing.
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW + ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS - 1,
    }),
    false,
  )
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW + ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS,
    }),
    true,
  )
})

/**
 * Deploy ordering must be non-load-bearing: the nudge columns ship in a
 * migration that can land AFTER the code. The Routine page's load-bearing read
 * therefore never selects them, and the separate nudge read degrades to "no
 * nudge" on any error (including `42703 undefined_column`).
 */
function planClientWithFailingNudgeRead(): {
  client: PersonalPlanRoutineReadClient
  selects: string[]
} {
  const selects: string[] = []
  const client: PersonalPlanRoutineReadClient = {
    from(table) {
      let columns = ""
      const query = {
        select(next: string) {
          columns = next
          if (table === "personal_plans") selects.push(next)
          return query
        },
        eq() {
          return query
        },
        async maybeSingle() {
          if (table !== "personal_plans") return { data: null, error: null }
          if (columns.includes("nudge_dismissed_until")) {
            return {
              data: null,
              error: { code: "42703", message: `column "nudge_dismissed_until" does not exist` },
            }
          }
          return {
            data: {
              id: "11111111-1111-4111-8111-111111111111",
              revision: 3,
              source_revision: 3,
              active_routine_version_id: null,
              pending_routine_proposal_id: null,
            },
            error: null,
          }
        },
      }
      return query as unknown as ReturnType<PersonalPlanRoutineReadClient["from"]>
    },
  }
  return { client, selects }
}

test("the Routine view still renders when the nudge read fails, with the nudge hidden", async () => {
  const { client, selects } = planClientWithFailingNudgeRead()

  const view = await loadPersonalPlanRoutineView({ client, userId: "owner-1", enabled: true })

  assert.notEqual(view.status, "no_personal_plan")
  if (view.status === "no_personal_plan") throw new Error("unreachable")
  assert.deepEqual(view.nudge, { unrefinedDirectAccept: false, nudgeDismissedUntil: null })
  assert.equal(
    shouldShowRoutineRefinementNudge({ ...view.nudge, now: NOW }),
    false,
    "a failed nudge read must never show the banner",
  )

  // The load-bearing plan read must not depend on the migration's columns.
  const baseSelect = selects.find((select) => select.includes("active_routine_version_id"))
  assert.ok(baseSelect)
  assert.equal(baseSelect.includes("unrefined_direct_accept"), false)
  assert.equal(baseSelect.includes("nudge_dismissed_until"), false)
})

test("the nudge read surfaces the stored state when the columns exist", async () => {
  const dismissedUntil = new Date(NOW + 1000).toISOString()
  const client: PersonalPlanRoutineReadClient = {
    from(table) {
      let columns = ""
      const query = {
        select(next: string) {
          columns = next
          return query
        },
        eq() {
          return query
        },
        async maybeSingle() {
          if (table !== "personal_plans") return { data: null, error: null }
          if (columns.includes("nudge_dismissed_until")) {
            return {
              data: { unrefined_direct_accept: true, nudge_dismissed_until: dismissedUntil },
              error: null,
            }
          }
          return {
            data: {
              id: "11111111-1111-4111-8111-111111111111",
              revision: 3,
              source_revision: 3,
              active_routine_version_id: null,
              pending_routine_proposal_id: null,
            },
            error: null,
          }
        },
      }
      return query as unknown as ReturnType<PersonalPlanRoutineReadClient["from"]>
    },
  }

  const view = await loadPersonalPlanRoutineView({ client, userId: "owner-1", enabled: true })
  if (view.status === "no_personal_plan") throw new Error("unreachable")
  assert.deepEqual(view.nudge, {
    unrefinedDirectAccept: true,
    nudgeDismissedUntil: dismissedUntil,
  })
})

/**
 * FINDING C, at the link level: the nudge CTA must carry `refine=1`, and
 * plan-start must map exactly that value to a Stage-2 re-entry.
 */
test("the nudge CTA links to an explicit Stage-2 re-entry", () => {
  const url = new URL(ROUTINE_REFINEMENT_NUDGE_HREF, "https://chaarlie.de")
  assert.equal(url.pathname, "/plan-start")
  assert.equal(url.searchParams.get("refine"), "1")
  assert.equal(parseRefineParam(url.searchParams.get("refine") ?? undefined), true)
})
