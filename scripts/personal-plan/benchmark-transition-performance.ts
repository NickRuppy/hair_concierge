import { performance } from "node:perf_hooks"

import { STAGE3_AUTHORITY_DECISION_BATCH_LIMIT } from "../../src/lib/personal-plan/products/authority/contracts"
import { loadPersonalPlanRoutineView } from "../../src/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "../../src/lib/personal-plan/routine/repository"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  active: "22222222-2222-4222-8222-222222222222",
  candidate: "33333333-3333-4333-8333-333333333333",
  proposal: "44444444-4444-4444-8444-444444444444",
  refined: "55555555-5555-4555-8555-555555555555",
}

function numberArgument(name: string, fallback: number) {
  const prefix = `--${name}=`
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`invalid_${name}`)
  return parsed
}

const latencyMs = numberArgument("latency-ms", 50)
const iterations = Math.floor(numberArgument("iterations", 5))
const stage3IntentCount = Math.floor(numberArgument("stage3-intents", 13))

function payload(versionId: string) {
  return {
    schemaVersion: 1,
    planId: ids.plan,
    versionId,
    parentVersionId: null,
    source: {
      refinedVersionId: ids.refined,
      productPortfolioVersionId: ids.active,
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: { schemaVersion: 1, categories: [] },
    sections: [
      { key: "basis", itemKeys: [] },
      { key: "optional", itemKeys: [] },
    ],
    items: [],
    createdAt: "2026-08-10T00:00:00.000Z",
  }
}

const delay = () => new Promise<void>((resolve) => setTimeout(resolve, latencyMs))

function delayedClient(calls: string[]): PersonalPlanRoutineReadClient {
  return {
    from(table) {
      const filters = new Map<string, string>()
      const query = {
        select() {
          return query
        },
        eq(column: string, value: string) {
          filters.set(column, value)
          return query
        },
        async maybeSingle() {
          calls.push(table)
          await delay()
          if (table === "personal_plans") {
            return {
              data: {
                id: ids.plan,
                revision: 4,
                source_revision: 7,
                active_routine_version_id: ids.active,
                pending_routine_proposal_id: ids.proposal,
              },
              error: null,
            }
          }
          if (table === "personal_plan_routine_proposals") {
            return {
              data: {
                id: ids.proposal,
                candidate_routine_version_id: ids.candidate,
                source_revision: 7,
                delta: {
                  schemaVersion: 1,
                  direct: [],
                  consequential: [],
                  unchangedItemCount: 0,
                },
              },
              error: null,
            }
          }
          if (table === "personal_plan_routine_versions") {
            const versionId = filters.get("id")
            return {
              data: versionId ? { id: versionId, payload: payload(versionId) } : null,
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

async function sample(includePendingProposal: boolean) {
  const calls: string[] = []
  const startedAt = performance.now()
  await loadPersonalPlanRoutineView({
    client: delayedClient(calls),
    userId: "benchmark-owner",
    enabled: true,
    includePendingProposal,
  })
  return { durationMs: performance.now() - startedAt, requestCount: calls.length }
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

async function runSamples(includePendingProposal: boolean) {
  const samples = []
  for (let index = 0; index < iterations; index += 1) {
    samples.push(await sample(includePendingProposal))
  }
  return {
    medianMs: Math.round(median(samples.map((sample) => sample.durationMs)) * 100) / 100,
    requestCount: samples[0]?.requestCount ?? 0,
  }
}

async function measure(operation: () => Promise<void>) {
  const startedAt = performance.now()
  await operation()
  return performance.now() - startedAt
}

async function runTransitionSamples(operation: () => Promise<void>) {
  const samples: number[] = []
  for (let index = 0; index < iterations; index += 1) samples.push(await measure(operation))
  return Math.round(median(samples) * 100) / 100
}

async function stage2RegularBefore() {
  for (let span = 0; span < 8; span += 1) await delay()
}

async function stage2RegularAfter() {
  await delay() // auth
  await delay() // entitlement
  await Promise.all([delay(), delay()]) // prepared artifact + plan
  for (let span = 0; span < 4; span += 1) await delay() // source, draft and CAS save
}

async function stage2FinalBefore() {
  await stage2RegularBefore()
  for (let span = 0; span < 8; span += 1) await delay() // second auth/access/load/complete request
}

async function stage2FinalAfter() {
  await stage2RegularAfter()
  await delay() // completion reuses the saved draft in the same gateway
}

async function stage3IndividualBefore() {
  for (let span = 0; span < 10; span += 1) await delay()
  for (let source = 0; source < 2; source += 1) {
    await delay()
    await delay()
  }
  await delay()
}

async function stage3IndividualAfter() {
  await delay() // auth
  await delay() // entitlement
  await Promise.all([delay(), delay()]) // prepared artifact + plan
  await Promise.all([delay(), delay()]) // refined source + current product draft
  await delay() // rate limit
  await delay() // canonical draft
  await delay() // requirements
  await Promise.all([delay(), delay()]) // current source id + refined snapshot
  await Promise.all([
    (async () => {
      await delay()
      await delay()
    })(),
    (async () => {
      await delay()
      await delay()
    })(),
  ]) // owned facts + recommendation facts
  await delay() // CAS save
}

async function main() {
  const [routineAfter, applicationAfter] = await Promise.all([runSamples(true), runSamples(false)])
  const [stage2RegularBeforeMs, stage2RegularAfterMs, stage2FinalBeforeMs, stage2FinalAfterMs] =
    await Promise.all([
      runTransitionSamples(stage2RegularBefore),
      runTransitionSamples(stage2RegularAfter),
      runTransitionSamples(stage2FinalBefore),
      runTransitionSamples(stage2FinalAfter),
    ])
  const [stage3IndividualBeforeMs, stage3IndividualAfterMs] = await Promise.all([
    runTransitionSamples(stage3IndividualBefore),
    runTransitionSamples(stage3IndividualAfter),
  ])

  const result = {
    assumptions: {
      independentRemoteReadLatencyMs: latencyMs,
      iterations,
      stage3IntentCount,
      note: "Routine after durations execute the current loader; Stage 2/3 durations execute the documented before/after dependency graphs with fixed-delay remote boundaries.",
    },
    routineLoader: {
      before: { modeledCriticalPathMs: latencyMs * 4, databaseRequestCount: 4 },
      after: {
        measuredMedianMs: routineAfter.medianMs,
        modeledCriticalPathMs: latencyMs * 3,
        databaseRequestCount: routineAfter.requestCount,
      },
    },
    applicationAcceptedRoutineLoader: {
      before: { modeledCriticalPathMs: latencyMs * 4, databaseRequestCount: 4 },
      after: {
        measuredMedianMs: applicationAfter.medianMs,
        modeledCriticalPathMs: latencyMs * 2,
        databaseRequestCount: applicationAfter.requestCount,
      },
    },
    personalPlanShell: {
      authenticatedUserReads: { before: 2, after: 1 },
      initialAttentionHttpRequests: { before: 1, after: 0 },
      knownStateAttentionRefreshHttpRequests: { before: 1, after: 0 },
      fallbackAttentionAdditionalPlanReads: { before: 1, after: 0 },
    },
    stage2AnswerToNextQuestion: {
      durability: "The next question becomes interactive only after the page save succeeds.",
      before: { measuredMedianMs: stage2RegularBeforeMs, httpRequestCount: 1 },
      after: {
        measuredMedianMs: stage2RegularAfterMs,
        httpRequestCount: 1,
        immediateFeedback: "full saving transition",
      },
    },
    stage2FinalAnswerToHandoff: {
      before: { measuredMedianMs: stage2FinalBeforeMs, httpRequestCount: 2 },
      after: { measuredMedianMs: stage2FinalAfterMs, httpRequestCount: 1 },
      recovery:
        "A completion error returns the already-durable saved session; a lost response is not acknowledged and reload reconciles canonical state.",
    },
    stage3IndividualDecisionToNextCard: {
      before: { measuredMedianMs: stage3IndividualBeforeMs, httpRequestCount: 1 },
      after: { measuredMedianMs: stage3IndividualAfterMs, httpRequestCount: 1 },
      note: "One individual UI action remains one authoritative CAS request; independent authority fact sources overlap.",
    },
    stage3GroupedDecision: {
      beforeHttpRequests: stage3IntentCount,
      afterHttpRequests: Math.ceil(stage3IntentCount / STAGE3_AUTHORITY_DECISION_BATCH_LIMIT),
      batchLimit: STAGE3_AUTHORITY_DECISION_BATCH_LIMIT,
      appliesOnlyWhen: "the UI displays one grouped clear-fit acceptance action",
    },
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

void main()
