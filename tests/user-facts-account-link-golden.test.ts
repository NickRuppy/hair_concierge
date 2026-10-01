import assert from "node:assert/strict"
import test from "node:test"

import { projectArtifactToFacts, projectLegacyLeadToFacts } from "../src/lib/user-facts"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import {
  buildProfileDataFromPersonalPlanCanonicalProfile,
  buildProfileDataFromQuizAnswers,
} from "../src/lib/quiz/link-to-profile"
import {
  normalizeStoredQuizAnswers,
  projectQuizAnswersToLegacyVocabulary,
} from "../src/lib/quiz/normalization"
import { buildPersonalPlanPreparedArtifact } from "../src/lib/personal-plan-quiz/prepared-plan"
import type { QuizAnswers } from "../src/lib/quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Task 5a golden test (pure TS, no DB): the two account-link writers now
 * project through `@/lib/user-facts` (task 1) + `deriveDiagnosticsColumns`
 * (task 2) instead of the pre-PR1 `buildProfileDataFromQuizAnswers` /
 * `buildProfileDataFromPersonalPlanCanonicalProfile` legacy-column writers.
 * Both pre-PR1 functions are still exported from `src/lib/quiz/link-to-profile`
 * (other call sites — `readiness.ts`'s candidate validity gate, and several
 * existing tests — still use them for THAT purpose), so this compares against
 * the real functions directly rather than a frozen copy.
 *
 * Any difference beyond a deliberately plan-allowed cap removal is a finding,
 * not an adjustment to the expectation below.
 */

// Within today's caps (<=3 concerns, <=5 goals), density present — same fixture
// long-established elsewhere in this suite (see COMPLETE_LEGACY_ANSWERS in
// tests/personal-plan-ready-readiness.test.ts and tests/free-registration-provenance.test.ts).
const LEGACY_ANSWERS: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "low",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "trocken",
  has_scalp_issue: false,
  treatment: ["gefaerbt"],
  concerns: ["frizz"],
  goals: ["moisture"],
}

test("golden: legacy lead projection derives the same legacy columns today's writer produces", () => {
  const { diagnostics } = projectLegacyLeadToFacts({
    leadId: "lead-1",
    quizAnswers: LEGACY_ANSWERS,
  })
  const derived = deriveDiagnosticsColumns(diagnostics)

  const todayAnswers = normalizeStoredQuizAnswers(LEGACY_ANSWERS)
  const today = buildProfileDataFromQuizAnswers(todayAnswers)
  // `buildProfileDataFromQuizAnswers` itself never derives goals (the deleted
  // `prepareLegacyProfileProjection` wrapper called this separately and only
  // conditionally attached them) — today's equivalent for the goals column.
  const todayGoals = projectQuizAnswersToLegacyVocabulary(todayAnswers).goals

  assert.equal(derived.hair_texture, today.hair_texture ?? null)
  assert.equal(derived.thickness, today.thickness ?? null)
  assert.equal(derived.density, today.density ?? null)
  assert.equal(derived.hair_length, today.hair_length ?? null)
  assert.equal(derived.cuticle_condition, today.cuticle_condition ?? null)
  assert.equal(derived.protein_moisture_balance, today.protein_moisture_balance ?? null)
  assert.equal(derived.scalp_type, today.scalp_type ?? null)
  assert.equal(derived.scalp_condition, today.scalp_condition ?? null)
  assert.deepEqual(derived.chemical_treatment, today.chemical_treatment ?? null)
  assert.deepEqual(derived.concerns, today.concerns ?? null)
  assert.deepEqual(derived.goals, todayGoals.length > 0 ? todayGoals : null)
})

test("golden: v3 artifact projection derives the same legacy columns today's writer produces", () => {
  const { diagnostics } = projectArtifactToFacts({
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-1",
    leadId: "lead-1",
  })
  const derived = deriveDiagnosticsColumns(diagnostics)

  // Built the same way the artifact pipeline does: `canonical_profile` is
  // `buildPersonalPlanPreparedArtifact(envelope).canonicalProfile`.
  const canonicalProfile =
    buildPersonalPlanPreparedArtifact(COMPLETE_V3_PLAN_ENVELOPE).canonicalProfile
  const today = buildProfileDataFromPersonalPlanCanonicalProfile(canonicalProfile)

  assert.equal(derived.hair_texture, today.hair_texture ?? null)
  assert.equal(derived.thickness, today.thickness ?? null)
  assert.equal(derived.density, today.density ?? null)
  assert.equal(derived.hair_length, today.hair_length ?? null)
  assert.equal(derived.cuticle_condition, today.cuticle_condition ?? null)
  assert.equal(derived.protein_moisture_balance, today.protein_moisture_balance ?? null)
  assert.equal(derived.scalp_type, today.scalp_type ?? null)
  assert.equal(derived.scalp_condition, today.scalp_condition ?? null)
  assert.deepEqual(derived.chemical_treatment, today.chemical_treatment ?? null)
  assert.deepEqual(derived.concerns, today.concerns ?? null)

  // FINDING (task 5a, not a cap difference — reported, not silently adjusted):
  // today's writer sources goals from `canonicalProfile.goals`, which
  // `adaptPersonalPlanAnswersForOffer` enriches with CONCERN-DERIVED implicit
  // goals (e.g. a `split_ends` concern adds `less_split_ends` even though the
  // user never picked it as a goal). `projectArtifactToFacts` reads
  // `envelope.answers.goals` verbatim (F26: diagnostics stores raw answers,
  // not offer-adapter-enriched presentation state), so it does NOT carry that
  // enrichment. For this fixture, today's writer yields
  // ["moisture","shine","less_split_ends"] (the last one concern-derived, not
  // user-selected) while the new projection yields exactly the user's own
  // goals, ["moisture","shine"]. Left as an explicit, asserted difference
  // rather than forcing equality.
  assert.deepEqual(today.goals, ["moisture", "shine", "less_split_ends"])
  assert.deepEqual(derived.goals, ["moisture", "shine"])
})
