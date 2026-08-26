import assert from "node:assert/strict"
import test from "node:test"

import { PERSONAL_PLAN_NAV_SURFACES } from "../src/lib/personal-plan/lifecycle/repository"
import { PERSONAL_PLAN_NAVIGATION_ITEM_KEYS } from "../src/lib/personal-plan/navigation-access"

/**
 * `PersonalPlanNavSurface` (lifecycle/repository.ts) and
 * `PersonalPlanNavigationItem["key"]` (navigation-access.ts) are declared
 * independently — the lifecycle module has no reason to import the nav
 * module — but they name the exact same set of tabs: the lifecycle store
 * marks visits per nav-item-key, and the nav renderer decides dots per
 * lifecycle-tracked surface. If someone adds/renames a tab in one place and
 * forgets the other, the nav-dot feature silently mismatches: an
 * unrecognized subject read back from the DB is quietly dropped in
 * `loadVisitedNavSurfaces`, so a mismatch never throws — it just leaves a
 * tab permanently dotted (or a dead subject checked against forever). This
 * test is the guard the Task 2.9 brief asked for: run it and a drift
 * surfaces as a failing assertion, not a silent product bug.
 */
test("the lifecycle nav-surface union and the navigation-access item-key union name exactly the same tabs", () => {
  assert.deepEqual(
    [...PERSONAL_PLAN_NAV_SURFACES].sort(),
    [...PERSONAL_PLAN_NAVIGATION_ITEM_KEYS].sort(),
  )
})
