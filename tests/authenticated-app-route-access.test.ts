import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveScanRouteAccess,
  resolveTrackerRouteAccess,
  type ScanRouteAccessDependencies,
  type TrackerRouteAccessDependencies,
} from "../src/lib/auth/authenticated-app-route-access"

const completeQuizProfile = {
  hair_texture: "wavy",
  thickness: "normal",
  density: "medium",
  cuticle_condition: "slightly_rough",
  protein_moisture_balance: "stretches_stays",
  scalp_type: "dry",
  scalp_condition: "dry_flakes",
  chemical_treatment: ["colored"],
  concerns: ["dryness"],
}

function dependencies(overrides: Partial<TrackerRouteAccessDependencies> = {}) {
  return {
    getUser: async () => ({ id: "user-1" }),
    ...overrides,
  } satisfies TrackerRouteAccessDependencies
}

function scanDependencies(overrides: Partial<ScanRouteAccessDependencies> = {}) {
  return {
    getUser: async () => ({ id: "user-1" }),
    getHairProfile: async () => completeQuizProfile,
    ...overrides,
  } satisfies ScanRouteAccessDependencies
}

test("tracker boundary only checks the authenticated user", async () => {
  const result = await resolveTrackerRouteAccess(dependencies())
  assert.deepEqual(result, { kind: "allow" })
})

test("tracker boundary fails closed without an authenticated user", async () => {
  const result = await resolveTrackerRouteAccess(dependencies({ getUser: async () => null }))
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})

test("tracker boundary fails closed when the authenticated-user read is unavailable", async () => {
  const result = await resolveTrackerRouteAccess(
    dependencies({
      getUser: async () => {
        throw new Error("auth unavailable")
      },
    }),
  )
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})

test("scan boundary allows an authenticated user with a completed quiz", async () => {
  const result = await resolveScanRouteAccess(scanDependencies())
  assert.deepEqual(result, { kind: "allow" })
})

test("scan boundary redirects without an authenticated user", async () => {
  const result = await resolveScanRouteAccess(scanDependencies({ getUser: async () => null }))
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})

test("scan boundary redirects when the quiz diagnostics are incomplete", async () => {
  const result = await resolveScanRouteAccess(
    scanDependencies({ getHairProfile: async () => null }),
  )
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})

test("scan boundary redirects when a single quiz field is missing", async () => {
  const result = await resolveScanRouteAccess(
    scanDependencies({
      getHairProfile: async () => ({ ...completeQuizProfile, density: null }),
    }),
  )
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})

test("scan boundary fails closed when the authenticated-user read is unavailable", async () => {
  const result = await resolveScanRouteAccess(
    scanDependencies({
      getUser: async () => {
        throw new Error("auth unavailable")
      },
    }),
  )
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})

test("scan boundary fails closed when the hair-profile read is unavailable", async () => {
  const result = await resolveScanRouteAccess(
    scanDependencies({
      getHairProfile: async () => {
        throw new Error("profile unavailable")
      },
    }),
  )
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})
