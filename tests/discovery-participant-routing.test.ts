import assert from "node:assert/strict"
import test from "node:test"

import { getPreparationResultPath } from "../src/components/quiz/quiz-preparation"
import { classifyRoute } from "../src/lib/auth/route-classification"
import { getUnauthenticatedRedirectTarget } from "../src/lib/auth/unauthenticated-redirect"
import {
  buildDiscoveryChecklistPath,
  hasDiscoveryEnrollmentStamp,
  parseDiscoveryQuizContextPayload,
  readDiscoveryEnrollmentStamp,
  DISCOVERY_ACCESS_KIND,
  DISCOVERY_CHECKLIST_PATH,
  DISCOVERY_ENROLLMENT_METADATA_KEY,
} from "../src/lib/discovery/participant"
import { hasLockedLeadIdentity } from "../src/lib/quiz/lead-capture-mode"
import { getQuizHistoryScreenOrder } from "../src/lib/quiz/screen-order"

const environment = { nodeEnv: "test", localDevLoginEnabled: false }
const enrollmentId = "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e"

// --- Route classification ----------------------------------------------------

test("the two invite surfaces are public, exactly and only them", () => {
  assert.equal(classifyRoute("/beratung/einladung", environment), "public")
  assert.equal(classifyRoute("/beratung/weiter", environment), "public")
  // A descendant must not inherit the exact carve-out.
  assert.equal(classifyRoute("/beratung/einladung/extra", environment), "protected")
  assert.equal(classifyRoute("/beratung/weiter/extra", environment), "protected")
})

test("the rest of the discovery journey requires a session", () => {
  for (const pathname of [
    "/beratung",
    "/beratung/produkte",
    "/api/beratung",
    "/api/beratung/quiz-context",
    "/api/beratung/intake",
  ]) {
    assert.equal(classifyRoute(pathname, environment), "protected", pathname)
  }
})

test("the two claim-time APIs are public because no session exists yet", () => {
  assert.equal(classifyRoute("/api/beratung/claim", environment), "public")
  assert.equal(classifyRoute("/api/beratung/resolve", environment), "public")
  // Nothing deeper is public by inheritance.
  assert.equal(classifyRoute("/api/beratung/claim/anything", environment), "protected")
})

test("an unauthenticated checklist request goes to sign-in, not into the quiz", () => {
  assert.equal(
    getUnauthenticatedRedirectTarget("/beratung/produkte", "", false),
    "/auth?next=%2Fberatung%2Fprodukte",
  )
  assert.equal(
    getUnauthenticatedRedirectTarget("/beratung/produkte", "?lead=abc", false),
    "/auth?next=%2Fberatung%2Fprodukte%3Flead%3Dabc",
  )
})

// --- The `app_metadata` stamp ------------------------------------------------

test("the stamp is only read when it is a real enrollment id", () => {
  const stamped = { app_metadata: { [DISCOVERY_ENROLLMENT_METADATA_KEY]: enrollmentId } }
  assert.equal(readDiscoveryEnrollmentStamp(stamped), enrollmentId)
  assert.equal(hasDiscoveryEnrollmentStamp(stamped), true)

  for (const user of [
    null,
    undefined,
    {},
    { app_metadata: null },
    { app_metadata: "discovery" },
    { app_metadata: { access_kind: DISCOVERY_ACCESS_KIND } },
    { app_metadata: { [DISCOVERY_ENROLLMENT_METADATA_KEY]: "" } },
    { app_metadata: { [DISCOVERY_ENROLLMENT_METADATA_KEY]: "not-a-uuid" } },
    { app_metadata: { [DISCOVERY_ENROLLMENT_METADATA_KEY]: 42 } },
  ]) {
    assert.equal(hasDiscoveryEnrollmentStamp(user as never), false, JSON.stringify(user))
  }
})

// --- Quiz navigation ---------------------------------------------------------

test("discovery:false keeps quiz navigation byte-identical", () => {
  const cases = [
    { leadId: "lead-1", mode: null, returnTo: null },
    { leadId: "lead-1", mode: "retake", returnTo: "/profile" },
    { leadId: "lead 2/3", mode: "retake", returnTo: null },
    { leadId: null, mode: null, returnTo: null },
  ]
  for (const input of cases) {
    // Omitted and explicitly false must both behave like the pre-discovery code.
    assert.equal(
      getPreparationResultPath(input),
      getPreparationResultPath({ ...input, discovery: false }),
      JSON.stringify(input),
    )
  }
  assert.equal(
    getPreparationResultPath({ leadId: "lead-1", mode: null, returnTo: null }),
    "/result/lead-1?entry=quiz_completion",
  )
  assert.equal(
    getPreparationResultPath({ leadId: "lead-1", mode: "retake", returnTo: "/profile" }),
    "/result/lead-1?entry=quiz_completion&mode=retake&returnTo=%2Fprofile",
  )
})

test("a discovery participant's quiz ends on their checklist, never on the paid result", () => {
  assert.equal(
    getPreparationResultPath({
      leadId: "lead-1",
      mode: "retake",
      returnTo: "/profile",
      discovery: true,
    }),
    `${DISCOVERY_CHECKLIST_PATH}?lead=lead-1`,
  )
  // No lead, no destination — the recovery screen owns that state.
  assert.equal(
    getPreparationResultPath({ leadId: null, mode: null, returnTo: null, discovery: true }),
    null,
  )
  assert.equal(buildDiscoveryChecklistPath("a/b"), `${DISCOVERY_CHECKLIST_PATH}?lead=a%2Fb`)
  assert.equal(buildDiscoveryChecklistPath(null), DISCOVERY_CHECKLIST_PATH)
})

test("discovery is a locked identity and runs the same screens as partner", () => {
  assert.equal(hasLockedLeadIdentity("discovery"), true)
  assert.equal(hasLockedLeadIdentity("partner"), true)
  assert.equal(hasLockedLeadIdentity("regular"), false)

  for (const packageKey of [null, "scan_v1"]) {
    assert.deepEqual(
      getQuizHistoryScreenOrder(packageKey, "discovery"),
      getQuizHistoryScreenOrder(packageKey, "partner"),
      `${packageKey}`,
    )
    // The regular order is untouched and still longer by the two identity screens.
    const regular = getQuizHistoryScreenOrder(packageKey, "regular")
    assert.equal(regular.length - getQuizHistoryScreenOrder(packageKey, "discovery").length, 2)
    assert.ok(regular.some((entry) => entry.leadCaptureSubStep === "name"))
    assert.ok(
      !getQuizHistoryScreenOrder(packageKey, "discovery").some(
        (entry) => entry.leadCaptureSubStep === "name",
      ),
    )
  }
})

// --- Quiz-context payload ----------------------------------------------------

test("the quiz-context payload only accepts a complete participant identity", () => {
  assert.deepEqual(
    parseDiscoveryQuizContextPayload({ status: "participant", name: " Lea ", email: "LEA@A.test" }),
    { status: "participant", name: "Lea", email: "lea@a.test" },
  )
  assert.deepEqual(parseDiscoveryQuizContextPayload({ status: "regular" }), { status: "regular" })
  for (const payload of [
    null,
    "participant",
    [],
    { status: "participant", name: "Lea" },
    { status: "participant", name: "  ", email: "lea@a.test" },
    { status: "participant", name: "Lea", email: "nope" },
    { status: "creator", name: "Lea", email: "lea@a.test" },
  ]) {
    assert.equal(
      parseDiscoveryQuizContextPayload(payload).status,
      "unavailable",
      JSON.stringify(payload),
    )
  }
})
