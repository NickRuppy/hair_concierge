import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import PlanStartPage from "../src/app/plan-start/page"
import {
  NeedCard,
  PlanStartFlow,
  PlanStartLoading,
  PlanStartRetryableError,
  PlanStartTransition,
  PlanStartUnavailable,
  adaptInitialNeedSnapshotToPlanStartViewModel,
  interpretPlanStartApiResponse,
  type NeedCardViewModel,
  type PlanStartReadyViewModel,
} from "../src/components/personal-plan-start"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import type { InitialNeedPlanSnapshot, InitialProductPreview } from "../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

const baseDetailBlocks: NeedCardViewModel["detailBlocks"] = [
  {
    title: "Worauf es beim Produkt ankommt",
    body: "Sanft und zuverlässig reinigen, ohne stark entfettend zu sein.",
  },
  {
    title: "Warum das zu deinem Haar passt",
    body: "Deine Kopfhaut reagiert empfindlich und braucht eine sanfte Reinigungsrichtung.",
  },
  { title: "Empfohlener Rhythmus", body: "Zwei- bis dreimal pro Woche." },
]

function card(overrides: Partial<NeedCardViewModel> = {}): NeedCardViewModel {
  return {
    id: "shampoo",
    tone: "basis",
    categoryLabel: "Shampoo",
    statusLabel: "Basis",
    targetType: "Sanft reinigend",
    purpose: "Entfernt Talg und Rückstände, ohne deine empfindliche Kopfhaut unnötig zu reizen.",
    pills: ["sanft", "sensible Kopfhaut"],
    frequency: "2-3x pro Woche",
    imageUrl:
      "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/test.webp",
    detailBlocks: baseDetailBlocks,
    ...overrides,
  }
}

const readyPlan: PlanStartReadyViewModel = {
  basis: {
    kind: "basis",
    overline: "Dein persönlicher Plan",
    title: "Deine Basis",
    lead: "Basierend auf deinem Quiz sind das die Grundlagen für deine Routine.",
    sectionTitle: "Von uns klar empfohlen",
    countLabel: "2 Kategorien",
    progress: 50,
    cards: [card(), card({ id: "conditioner", categoryLabel: "Conditioner", imageUrl: null })],
  },
  optional: {
    kind: "optional",
    overline: "Optionale Empfehlungen",
    title: "Zusätzlich sinnvoll",
    lead: "Basierend auf deinem Quiz können diese Ergänzungen deine Ziele zusätzlich unterstützen.",
    sectionTitle: "Für deine Ziele",
    countLabel: "1 Vorschlag",
    progress: 100,
    cards: [
      card({
        id: "dry-shampoo",
        tone: "optional",
        categoryLabel: "Trockenshampoo",
        statusLabel: "Pausiert",
        targetType: "Aktuell nicht anwenden",
        paused: true,
        initiallyOpen: true,
        frequency: "später: bei Bedarf",
      }),
    ],
  },
}

function computedSnapshot(
  answers: PersonalPlanQuizSubmissionEnvelope["answers"] = COMPLETE_V3_PLAN_ENVELOPE.answers,
): InitialNeedPlanSnapshot {
  const result = computeNeedPlan({
    rawEnvelope: { ...COMPLETE_V3_PLAN_ENVELOPE, answers },
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready Stage-1 snapshot")
  return result.snapshot
}

function withPreviews(
  snapshot: InitialNeedPlanSnapshot,
  productPreviews: InitialProductPreview[],
): InitialNeedPlanSnapshot {
  return { ...snapshot, productPreviews }
}

test("renders the signed-off Basis shell with folded cards and absent-preview geometry", () => {
  const html = renderToStaticMarkup(<PlanStartFlow state="ready" plan={readyPlan} />)

  assert.match(html, /data-plan-start-screen="basis"/)
  assert.match(html, /Deine Basis/)
  assert.match(html, /Basierend auf deinem Quiz sind das die Grundlagen/)
  assert.match(html, /Optionale Empfehlungen/)
  assert.match(html, /data-plan-start-card-preview="selected"/)
  assert.match(html, /data-plan-start-card-preview="absent"/)
  assert.match(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /Zusätzlich sinnvoll/)
})

test("omits the Optional page and progress step when no optional categories exist", () => {
  const html = renderToStaticMarkup(
    <PlanStartFlow
      state="ready"
      plan={{ basis: { ...readyPlan.basis, progress: 100 }, optional: null }}
    />,
  )

  assert.match(html, /data-plan-start-has-optional="false"/)
  assert.match(html, /Plan wirklich zu meinem machen/)
  assert.doesNotMatch(html, /Optionale Empfehlungen/)
})

test("renders paused cards as visible included categories with Anforderungsprofil details", () => {
  const html = renderToStaticMarkup(<NeedCard card={readyPlan.optional!.cards[0]!} />)

  assert.match(html, /data-plan-start-card-paused="true"/)
  assert.match(html, /Pausiert/)
  assert.match(html, /Aktuell nicht anwenden/)
  assert.match(html, /Dein Anforderungsprofil/)
  assert.match(html, /aria-expanded="true"/)
})

test("renders loading, retry and transition states without questions or legacy destinations", () => {
  const loading = renderToStaticMarkup(<PlanStartLoading />)
  const retry = renderToStaticMarkup(<PlanStartRetryableError />)
  const transition = renderToStaticMarkup(<PlanStartTransition onBack={() => {}} />)

  assert.match(loading, /Dein Bedarfsplan entsteht/)
  assert.match(retry, /Dein Plan lädt gerade nicht/)
  assert.match(retry, /Erneut versuchen/)
  assert.match(transition, /Deine Grundlage steht/)
  assert.match(transition, /Jetzt machen wir sie zu deiner/)
  assert.doesNotMatch(`${loading}${retry}${transition}`, /Frage|Quiz starten|Chat|Routine/)
})

test("the production transition enables its Stage 2 entry only when a customer callback is injected", () => {
  const disabled = renderToStaticMarkup(<PlanStartTransition onBack={() => {}} />)
  const enabled = renderToStaticMarkup(
    <PlanStartTransition onBack={() => {}} onContinue={() => {}} />,
  )

  assert.match(disabled, /Produkte abgleichen/)
  assert.match(disabled, /disabled=""/)
  assert.match(enabled, /Produkte abgleichen/)
  assert.doesNotMatch(enabled, /disabled=""/)
})

test("renders compact unavailable state H with profile and support exits", () => {
  const html = renderToStaticMarkup(<PlanStartUnavailable />)

  assert.match(html, /data-plan-start-state="unavailable"/)
  assert.match(html, /Dieser Planbereich ist gerade nicht verfügbar/)
  assert.match(html, /href="\/profile"/)
  assert.match(html, /Zum Profil/)
  assert.match(html, /href="\/kontakt"/)
  assert.match(html, /Support kontaktieren/)
  assert.doesNotMatch(html, /\/chat|\/routine|\/onboarding|\/quiz/)
})

test("the flag-off production page renders unavailable H instead of redirecting or loading data", () => {
  const previous = process.env.PERSONAL_PLAN_APP_V1_ENABLED
  delete process.env.PERSONAL_PLAN_APP_V1_ENABLED
  try {
    const html = renderToStaticMarkup(<PlanStartPage />)
    assert.match(html, /Dieser Planbereich ist gerade nicht verfügbar/)
    assert.match(html, /Zum Profil/)
    assert.doesNotMatch(html, /redirect|permanentRedirect|\/chat|\/routine|\/onboarding/)
  } finally {
    if (previous === undefined) {
      delete process.env.PERSONAL_PLAN_APP_V1_ENABLED
    } else {
      process.env.PERSONAL_PLAN_APP_V1_ENABLED = previous
    }
  }
})

test("the enabled production gate maps ineligible API responses to unavailable H", () => {
  assert.equal(
    interpretPlanStartApiResponse(404, { error: "personal_plan_not_available" }).state,
    "unavailable",
  )
  assert.equal(
    interpretPlanStartApiResponse(409, { error: "activation_pending" }).state,
    "retryable_error",
  )
  assert.equal(
    interpretPlanStartApiResponse(503, { error: "temporarily_unavailable" }).state,
    "retryable_error",
  )
  assert.equal(
    interpretPlanStartApiResponse(200, { status: "completed", outputSnapshot: {} }).state,
    "retryable_error",
  )
})

test("adapts a valid saved Stage-1 snapshot into the signed Basis and Optional view", () => {
  const snapshot = withPreviews(
    computedSnapshot({
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      scalpOiliness: "oily",
      scalpConcerns: ["irritated"],
    }),
    [
      {
        category: "conditioner",
        state: "absent",
        reason: "image_missing",
        selectionRuleIds: ["test.absent"],
        selectionVersion: "test-v1",
      },
      {
        category: "shampoo",
        state: "selected",
        productId: "product-shampoo",
        productName: "Salthouse Anti-Juckreiz Shampoo",
        imageUrl:
          "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/test-shampoo.webp",
        previewRole: "shampoo_everyday",
        verdict: "ideal",
        selectionRuleIds: ["test.selected"],
        selectionVersion: "test-v1",
      },
    ],
  )

  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)
  assert.ok(plan)
  assert.equal(plan.basis.title, "Deine Basis")
  assert.ok(plan.basis.cards.some((item) => item.categoryLabel === "Shampoo" && item.imageUrl))
  assert.ok(
    plan.basis.cards.some((item) => item.categoryLabel === "Conditioner" && item.imageUrl === null),
  )
  assert.ok(plan.optional)
  assert.equal(plan.optional.title, "Zusätzlich sinnvoll")

  const interpreted = interpretPlanStartApiResponse(200, {
    status: "completed",
    outputSnapshot: snapshot,
  })
  assert.equal(interpreted.state, "ready")
  if (interpreted.state !== "ready") return
  const html = renderToStaticMarkup(<PlanStartFlow state="ready" plan={interpreted.plan} />)
  assert.match(html, /Deine Basis/)
  assert.match(html, /data-plan-start-card-preview="selected"/)
  assert.match(html, /data-plan-start-card-preview="absent"/)
})

test("adapts Basis-only snapshots without an empty Optional page", () => {
  const snapshot = computedSnapshot({
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    texture: "straight",
    thickness: "normal",
    density: "medium",
    goals: ["scalp_balance"],
    currentConcerns: [],
    concernRecurrence: undefined,
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)

  assert.ok(plan)
  assert.equal(plan.optional, null)
  assert.equal(plan.basis.progress, 100)
  const html = renderToStaticMarkup(<PlanStartFlow state="ready" plan={plan} />)
  assert.match(html, /Plan wirklich zu meinem machen/)
  assert.doesNotMatch(html, /Optionale Empfehlungen/)
})

test("preserves paused included categories from the saved snapshot", () => {
  const snapshot = computedSnapshot({
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    scalpOiliness: "oily",
    scalpConcerns: ["irritated"],
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)

  assert.ok(plan?.optional)
  const paused = plan.optional.cards.find((item) => item.paused)
  assert.ok(paused)
  assert.equal(paused.statusLabel, "Pausiert")
  assert.equal(paused.targetType, "Aktuell nicht anwenden")
})

test("invalid or unsupported snapshots fail closed to retryable error", () => {
  assert.equal(adaptInitialNeedSnapshotToPlanStartViewModel({}), null)
  assert.equal(
    adaptInitialNeedSnapshotToPlanStartViewModel({
      ...computedSnapshot(),
      schemaVersion: 999,
    }),
    null,
  )
  assert.equal(
    interpretPlanStartApiResponse(200, {
      status: "completed",
      outputSnapshot: { ...computedSnapshot(), snapshotKind: "unexpected" },
    }).state,
    "retryable_error",
  )
})

test("mobile containment is guarded by fixed card tracks and bounded text", () => {
  const cardSource = readFileSync("src/components/personal-plan-start/need-card.tsx", "utf8")
  const screenSource = readFileSync(
    "src/components/personal-plan-start/need-plan-screen.tsx",
    "utf8",
  )
  const componentSource = readFileSync(
    "src/components/personal-plan-start/plan-start-flow.tsx",
    "utf8",
  )
  const adapterSource = readFileSync(
    "src/components/personal-plan-start/snapshot-adapter.ts",
    "utf8",
  )
  const pageSource = readFileSync("src/app/plan-start/page.tsx", "utf8")

  assert.match(cardSource, /grid-cols-\[66px_minmax\(0,1fr\)_16px\]/)
  assert.match(cardSource, /max-\[360px\]:h-\[76px\]/)
  assert.match(cardSource, /line-clamp-2/)
  assert.match(cardSource, /truncate/)
  assert.match(screenSource, /max-w-\[430px\]/)
  assert.match(screenSource, /fixed inset-x-0 bottom-0/)
  assert.doesNotMatch(screenSource, /segmented|tablist|Basis\/Optional/)
  assert.doesNotMatch(pageSource, /stage-1\/route|handleStage1LoadOrCreate|computeNeedPlan/)
  assert.match(pageSource, /PlanStartProductionGate/)
  assert.doesNotMatch(
    `${componentSource}${adapterSource}`,
    /labs\/personal-plan|STAGE1_STAGE2|fixture/i,
  )
})
