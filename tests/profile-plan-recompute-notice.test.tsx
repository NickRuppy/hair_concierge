import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { HaarCheckEditor } from "../src/components/profile/haar-check-editor"
import {
  ProfileRoutineAccessProvider,
  useProfileHasPersonalPlan,
  useProfileRoutineAccess,
} from "../src/components/profile/profile-routine-access"
import { createHaarCheckDraft } from "../src/lib/profile/haar-check-draft"

/**
 * Central profile PR2: sentence A („Beim Speichern berechnen wir deinen Plan mit den neuen
 * Angaben neu.“) sits above the button row of both profile editors, only for users who have a
 * Personal Plan. The Haar-Check editor is presentational (flag in as a prop); the Ziele editor
 * reads the layout context itself (its router hook needs a mounted app, so its wiring is
 * asserted on source, the repo's convention for such components).
 */

const SENTENCE = "Beim Speichern berechnen wir deinen Plan mit den neuen Angaben neu."

function renderEditor(showPlanRecomputeNotice?: boolean): string {
  const draft = createHaarCheckDraft(null)
  return renderToStaticMarkup(
    <HaarCheckEditor
      draft={draft}
      initialDraft={draft}
      onDraftChange={() => {}}
      saving={false}
      onSave={() => {}}
      onCancel={() => {}}
      registerField={() => {}}
      showPlanRecomputeNotice={showPlanRecomputeNotice}
    />,
  )
}

test("HaarCheckEditor shows sentence A above the save button when the user has a plan", () => {
  const html = renderEditor(true)
  const sentenceAt = html.indexOf(SENTENCE)
  const saveAt = html.indexOf("Haar-Check speichern")
  assert.ok(sentenceAt >= 0, "sentence A is rendered")
  assert.ok(saveAt >= 0, "save button is rendered")
  assert.ok(sentenceAt < saveAt, "sentence A comes before the save button")
  assert.match(html, /<p class="mt-6 text-sm text-muted-foreground">Beim Speichern/)
  assert.match(html, /<div class="mt-3 flex flex-wrap gap-2">/)
  assert.doesNotMatch(html, /<div class="mt-6 flex flex-wrap gap-2">/)
})

test("HaarCheckEditor shows no sentence without a plan (prop false or absent)", () => {
  for (const html of [renderEditor(false), renderEditor()]) {
    assert.ok(!html.includes(SENTENCE))
    assert.match(html, /<div class="mt-6 flex flex-wrap gap-2">/)
  }
})

test("the profile layout context reports hasPersonalPlan and defaults to false", () => {
  function Probe() {
    return (
      <span>
        {String(useProfileHasPersonalPlan())}/{String(useProfileRoutineAccess())}
      </span>
    )
  }
  assert.match(renderToStaticMarkup(<Probe />), />false\/false</)
  assert.match(
    renderToStaticMarkup(
      <ProfileRoutineAccessProvider hasRoutineAccess={false} hasPersonalPlan>
        <Probe />
      </ProfileRoutineAccessProvider>,
    ),
    />true\/false</,
  )
  // Existing callers that pass only hasRoutineAccess keep working.
  assert.match(
    renderToStaticMarkup(
      <ProfileRoutineAccessProvider hasRoutineAccess>
        <Probe />
      </ProfileRoutineAccessProvider>,
    ),
    />false\/true</,
  )
})

test("the Ziele editor reads the flag from the layout context and renders sentence A above its save button", () => {
  const source = readFileSync("src/components/profile/edit-goals-flow.tsx", "utf8")
  assert.match(source, /const hasPersonalPlan = useProfileHasPersonalPlan\(\)/)
  assert.ok(source.includes(SENTENCE))
  assert.ok(source.indexOf(SENTENCE) < source.indexOf("Speichern und zurück zum Profil"))
  assert.match(source, /plan\?\.outcome === "applied"/)
  // The marker is bound to the signed-in user (W04): no user id, no mark.
  assert.match(source, /const \{ user \} = useAuth\(\)/)
  assert.match(source, /const userId = user\?\.id \?\? null/)
  assert.match(
    source,
    /if \(body\?\.plan\?\.outcome === "applied" && userId\) markRoutinePlanUpdatedPending\(userId\)/,
  )
})

test("the profile page passes the flag to the Haar-Check editor and marks the plan update on `applied`", () => {
  const page = readFileSync("src/app/profile/page.tsx", "utf8")
  assert.match(page, /showPlanRecomputeNotice=\{hasPersonalPlan\}/)
  assert.match(page, /const hasPersonalPlan = useProfileHasPersonalPlan\(\)/)
  assert.match(page, /plan\?\.outcome === "applied"/)
  assert.match(
    page,
    /if \(body\.plan\?\.outcome === "applied" && userId\) markRoutinePlanUpdatedPending\(userId\)/,
  )
})

test("the layout resolves hasPersonalPlan tier-independently (W05), not from the synthetic free-tier navigation", () => {
  const layout = readFileSync("src/app/profile/layout.tsx", "utf8")
  assert.match(
    layout,
    /const \[hasPersonalPlan\] = await Promise\.all\(\[\s*loadProfileHasPersonalPlan\(navigation\),/,
  )
  assert.match(layout, /hasPersonalPlan=\{hasPersonalPlan\}/)
  assert.doesNotMatch(layout, /hasPersonalPlanRecord/)
})

test("the Routine client consumes the pending mark in an effect, not during render", () => {
  const source = readFileSync(
    "src/components/routine/personal-plan/personal-plan-routine-client.tsx",
    "utf8",
  )
  // Bound to the signed-in user (W04) and read only once the auth session has resolved — the
  // user id is not known at first mount — so it lives in its own effect.
  assert.match(
    source,
    /const pending = consumeRoutinePlanUpdatedPending\(authUserId\)\s+if \(pending && !arrivedWithPlanUpdatedSignal\.current\) setShowPlanUpdatedToast\(true\)/,
  )
  assert.match(source, /const \{ user, loading: authLoading \} = useAuth\(\)/)
  assert.match(
    source,
    /if \(pendingMarkConsumed\.current \|\| authLoading \|\| !authUserId\) return/,
  )
  // The lazy initial state still only reads the URL param.
  assert.match(source, /useState\(\(\) =>\s*hasRoutinePlanUpdatedSignal\(searchParams\),?\s*\)/)
})
