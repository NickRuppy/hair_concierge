import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildFrequencyControlModel,
  getRoutineCardVisual,
  routineCardStatusDescription,
} from "@/components/routine/routine-card-model"
import type { RoutineUiCard } from "@/lib/routines/types"

function read(path: string) {
  return readFileSync(path, "utf8")
}

function assertNear(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should be near ${expected}`)
}

function createCard(overrides: Partial<RoutineUiCard>): RoutineUiCard {
  return {
    id: "usage-1",
    kind: "verified_matches",
    tone: "green",
    category: "conditioner",
    categoryLabel: "Conditioner",
    productName: "Balea Feuchtigkeit Conditioner",
    currentFrequency: "weekly_1x",
    frequencyTarget: {
      minFrequency: "weekly_1x",
      maxFrequency: "weekly_3_4x",
      preferredFrequency: "weekly_2x",
      delta: "in_range",
    },
    careBalanceRow: null,
    usageRow: null,
    product: null,
    pendingSubmission: null,
    hasProductDrawer: false,
    isLegacyTextOnly: false,
    isTopProposal: false,
    ...overrides,
  }
}

test("routine card visuals map every shaped card kind to a state action", () => {
  assert.equal(getRoutineCardVisual(createCard({ kind: "verified_matches" })).action, "chevron")
  assert.equal(getRoutineCardVisual(createCard({ kind: "verified_swap" })).action, "swap")
  assert.equal(getRoutineCardVisual(createCard({ kind: "verified_swap" })).actionLabel, "Tausch")
  assert.equal(getRoutineCardVisual(createCard({ kind: "verified_unnecessary" })).action, "trash")
  assert.equal(
    getRoutineCardVisual(createCard({ kind: "verified_unnecessary" })).actionLabel,
    "Entfernen?",
  )
  assert.equal(getRoutineCardVisual(createCard({ kind: "verified_more_freq" })).action, "more")
  assert.equal(
    getRoutineCardVisual(createCard({ kind: "verified_more_freq" })).actionLabel,
    "Häufiger",
  )
  assert.equal(getRoutineCardVisual(createCard({ kind: "pending" })).action, "chevron")
  assert.equal(getRoutineCardVisual(createCard({ kind: "pending" })).dotClassName, null)
  assert.equal(getRoutineCardVisual(createCard({ kind: "suggestion" })).action, "chat")
  // Legacy text-only rows carry no Chaarlie signal: no dot, plain chevron.
  const legacy = getRoutineCardVisual(createCard({ kind: "verified_swap", isLegacyTextOnly: true }))
  assert.equal(legacy.action, "chevron")
  assert.equal(legacy.dotClassName, null)
})

test("routine card status descriptions stay German per kind", () => {
  assert.match(routineCardStatusDescription(createCard({ kind: "pending" })), /prüfen/i)
  assert.match(routineCardStatusDescription(createCard({ kind: "suggestion" })), /Routine/)
})

test("frequency model exposes stable slider stops, target band, and compact Chaarlie marker", () => {
  const model = buildFrequencyControlModel(
    createCard({
      currentFrequency: "weekly_1x",
      frequencyTarget: {
        minFrequency: "weekly_1x",
        maxFrequency: "weekly_3_4x",
        preferredFrequency: "weekly_2x",
        delta: "below",
      },
    }),
  )

  assert.equal(model.value, "weekly_1x")
  assert.equal(model.preferredLabel, "2×/Woche")
  assert.equal(model.deltaLabel, "Unter Chaarlies Zielbereich")
  assert.equal(model.markerLabel, "C")
  assert.ok(model.stops.length >= 8)
  assert.ok(model.band)
  assert.ok(model.preferred)
  assertNear(model.band.leftPercent, 42.857142857142854)
  assertNear(model.band.widthPercent, 28.571428571428573)
  assertNear(model.preferred.leftPercent, 57.14285714285714)
})

test("frequency model falls back to the preferred target when the user has no current value", () => {
  const model = buildFrequencyControlModel(
    createCard({
      currentFrequency: null,
      frequencyTarget: {
        minFrequency: "biweekly_1x",
        maxFrequency: "weekly_1x",
        preferredFrequency: "weekly_1x",
        delta: "missing",
      },
    }),
  )

  assert.equal(model.value, "weekly_1x")
  assert.equal(model.currentLabel, "Nicht gesetzt")
  assert.equal(model.preferredLabel, "1×/Woche")
  assert.equal(model.deltaLabel, "Noch nicht gesetzt")
})

test("routine product drawer receives loaded profile context", () => {
  const source = read("src/components/routine/routine-page-client.tsx")

  assert.match(source, /hairProfile=\{routine\.hairProfile\}/)
  assert.doesNotMatch(source, /hairProfile=\{null\}/)
})

test("routine trigger seeds are sent from session storage with the route conversation id", () => {
  const source = read("src/components/chat/chat-container.tsx")
  const hookSource = read("src/hooks/use-chat.ts")

  assert.match(source, /currentConversationId \?\? initialConversationId/)
  assert.match(
    source,
    /readRoutineTriggerSeed\(routineSeedConversationId, window\.sessionStorage\)/,
  )
  assert.match(source, /readRoutineTriggerSeed\(initialConversationId, window\.sessionStorage\)/)
  assert.match(source, /sendMessage\(seedMessage, \{ conversationId \}\)/)
  assert.match(source, /await loadConversation\(conversationId\)/)
  assert.match(source, /clearRoutineTriggerSeed\(conversationId, window\.sessionStorage\)/)
  assert.match(hookSource, /setCurrentConversationId\(targetConversationId\)/)
  assert.doesNotMatch(
    source,
    /readRoutineTriggerSeed\(currentConversationId, window\.localStorage\)/,
  )
})

test("chat product drawer hydrates routine membership before rendering the action", () => {
  const source = read("src/components/chat/chat-container.tsx")

  assert.match(source, /fetch\(\"\/api\/routine\"\)/)
  assert.match(source, /alreadyInRoutine: routineProductMembership\.has\(drawerProduct\.id\)/)
  assert.match(
    source,
    /existingUsageId: routineProductMembership\.get\(drawerProduct\.id\)\?\.usageId/,
  )
})
