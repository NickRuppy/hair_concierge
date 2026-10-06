import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  ORGANIC_OFFER_MEDIA_EXPERIMENT,
  assignOrganicOfferMediaExperimentVariant,
  isOrganicOfferMediaExperimentVariant,
} from "../src/lib/funnel/organic-offer-media-experiment"
import { isOrganicOfferMediaExperimentEnabled } from "../src/lib/funnel/flags"
import { resolveOrganicOfferMediaExperiment } from "../src/lib/funnel/server"

const resultPageSource = readFileSync(
  new URL("../src/app/result/[leadId]/page.tsx", import.meta.url),
  "utf8",
)

test("the no-access organic result resolves its media experiment before recording the offer view", () => {
  assert.match(resultPageSource, /resolveOrganicOfferMediaExperiment\(/)
  assert.match(
    resultPageSource,
    /excluded:\s*moderatorTest \|\|\s*partnerIntent \|\|\s*Boolean\(regularFieldTestState\.authorization\) \|\|\s*regularFieldTestState\.unavailable/,
  )
  assert.match(resultPageSource, /hasAccess\s*\? "organic-plan-v1"/)
  assert.ok(
    resultPageSource.indexOf("resolveOrganicOfferMediaExperiment") <
      resultPageSource.indexOf("await recordLeadOfferView(leadId, funnelContext, offerVariant)"),
  )
})

test("organic media allocation is deterministic and accepts exactly its two arms", () => {
  const arm = assignOrganicOfferMediaExperimentVariant("session-a")
  assert.equal(arm, assignOrganicOfferMediaExperimentVariant("session-a"))
  assert.equal(arm, ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant)
  assert.equal(
    assignOrganicOfferMediaExperimentVariant("session-b"),
    ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  )
  assert.ok(isOrganicOfferMediaExperimentVariant(arm))
  assert.ok(isOrganicOfferMediaExperimentVariant(ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant))
  assert.ok(isOrganicOfferMediaExperimentVariant(ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant))
  assert.equal(isOrganicOfferMediaExperimentVariant("unexpected-offer"), false)
})

test("organic media flag is enabled only by exact true", () => {
  const previous = process.env.ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED
  try {
    delete process.env.ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED
    assert.equal(isOrganicOfferMediaExperimentEnabled(), false)
    process.env.ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED = "TRUE"
    assert.equal(isOrganicOfferMediaExperimentEnabled(), false)
    process.env.ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED = "true"
    assert.equal(isOrganicOfferMediaExperimentEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED
    else process.env.ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED = previous
  }
})

type StoredSession = {
  offer_variant: string | null
}

function createAssignmentClient(input: {
  stored: string | null
  update?: "success" | "race" | "error"
  readBack?: string | null
}) {
  let stored = input.stored
  const writes: Array<{ value: string; guards: Array<[string, string | null] | [string, null]> }> =
    []
  const client = {
    from: () => ({
      update: (values: { offer_variant: string }) => ({
        eq: (column: string, value: string) => ({
          is: (isColumn: string, isValue: null) => ({
            eq: (variantColumn: string, variantValue: string) => ({
              select: () => ({
                maybeSingle: async (): Promise<{ data: StoredSession | null; error: unknown }> => {
                  writes.push({
                    value: values.offer_variant,
                    guards: [
                      [column, value],
                      [isColumn, isValue],
                      [variantColumn, variantValue],
                    ],
                  })
                  if (input.update === "error")
                    return { data: null, error: new Error("unavailable") }
                  if (input.update === "race") return { data: null, error: null }
                  stored = values.offer_variant
                  return { data: { offer_variant: stored }, error: null }
                },
              }),
            }),
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async (): Promise<{ data: StoredSession | null; error: unknown }> => ({
            data: { offer_variant: input.readBack ?? stored },
            error: null,
          }),
        }),
      }),
    }),
  }
  return { client, writes }
}

const baseSession = {
  sessionId: "20000000-0000-4000-8000-000000000002",
  packageKey: "default_organic",
  offerVariant: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  offerViewedAt: null,
}

test("enabled organic media assignment persists from the current video control before the offer is viewed", async () => {
  const { client, writes } = createAssignmentClient({
    stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  })
  const assigned = await resolveOrganicOfferMediaExperiment({
    enabled: true,
    session: baseSession,
    client: client as never,
  })
  assert.equal(assigned, assignOrganicOfferMediaExperimentVariant(baseSession.sessionId))
  assert.deepEqual(writes, [
    {
      value: assigned,
      guards: [
        ["id", baseSession.sessionId],
        ["offer_viewed_at", null],
        ["offer_variant", ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant],
      ],
    },
  ])
})

test("a deterministic control allocation does not rewrite the existing control row", async () => {
  const state = createAssignmentClient({ stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant })
  assert.equal(
    assignOrganicOfferMediaExperimentVariant("session-b"),
    ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  )
  assert.equal(
    await resolveOrganicOfferMediaExperiment({
      enabled: true,
      session: { ...baseSession, sessionId: "session-b" },
      client: state.client as never,
    }),
    ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  )
  assert.equal(state.writes.length, 0)
})

test("organic media resolver never reassigns a viewed or checkout-started video control", async () => {
  for (const session of [
    { ...baseSession, offerViewedAt: "2026-08-31T10:00:00Z" },
    { ...baseSession, checkoutStartedAt: "2026-08-31T10:00:00Z" },
  ]) {
    const state = createAssignmentClient({ stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant })
    assert.equal(
      await resolveOrganicOfferMediaExperiment({
        enabled: true,
        session,
        client: state.client as never,
      }),
      ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
    )
    assert.equal(state.writes.length, 0)
  }
})

test("disabled rollout leaves an unviewed video control untouched", async () => {
  const state = createAssignmentClient({ stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant })
  assert.equal(
    await resolveOrganicOfferMediaExperiment({
      enabled: false,
      session: baseSession,
      client: state.client as never,
    }),
    ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  )
  assert.equal(state.writes.length, 0)
})

test("organic media resolver uses concurrent persisted winners and fails closed on persistence errors", async () => {
  const race = createAssignmentClient({
    stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
    update: "race",
    readBack: ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant,
  })
  assert.equal(
    await resolveOrganicOfferMediaExperiment({
      enabled: true,
      session: baseSession,
      client: race.client as never,
    }),
    ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant,
  )

  let captured: { experimentId: string; packageKey: string | null | undefined } | null = null
  const failure = createAssignmentClient({
    stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
    update: "error",
  })
  assert.equal(
    await resolveOrganicOfferMediaExperiment({
      enabled: true,
      session: baseSession,
      client: failure.client as never,
      captureFailure: (_error, details) => {
        captured = { experimentId: details.experimentId, packageKey: details.packageKey }
      },
    }),
    ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  )
  assert.deepEqual(captured, {
    experimentId: "organic_offer_media_v1",
    packageKey: "default_organic",
  })
})

test("disabled rollout resets only unviewed image treatment and preserves viewed or checkout assignments", async () => {
  const reset = createAssignmentClient({ stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant })
  assert.equal(
    await resolveOrganicOfferMediaExperiment({
      enabled: false,
      session: { ...baseSession, offerVariant: ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant },
      client: reset.client as never,
    }),
    ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
  )
  assert.equal(reset.writes.length, 1)
  assert.deepEqual(reset.writes[0].guards.at(-1), [
    "offer_variant",
    ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant,
  ])

  for (const session of [
    {
      ...baseSession,
      offerVariant: ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant,
      offerViewedAt: "2026-08-31T10:00:00Z",
    },
    {
      ...baseSession,
      offerVariant: ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant,
      checkoutStartedAt: "2026-08-31T10:00:00Z",
    },
  ]) {
    assert.equal(
      await resolveOrganicOfferMediaExperiment({ enabled: false, session }),
      ORGANIC_OFFER_MEDIA_EXPERIMENT.treatmentVariant,
    )
  }
})

test("ineligible organic sessions force video without a mutation", async () => {
  for (const { session, excluded } of [
    { session: null, excluded: false },
    { session: { ...baseSession, packageKey: "meta_personal_plan_v1" }, excluded: false },
    { session: { ...baseSession, testKind: "field_test" }, excluded: false },
    { session: { ...baseSession, offerVariant: null }, excluded: false },
    { session: baseSession, excluded: true },
  ]) {
    const state = createAssignmentClient({ stored: ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant })
    assert.equal(
      await resolveOrganicOfferMediaExperiment({
        enabled: true,
        excluded,
        session,
        client: state.client as never,
      }),
      ORGANIC_OFFER_MEDIA_EXPERIMENT.baseVariant,
    )
    assert.equal(state.writes.length, 0)
  }
})

test("stored retired legacy arms remain attribution authority and are never enrolled", async () => {
  for (const offerVariant of ["default", "guided-story"]) {
    const state = createAssignmentClient({ stored: offerVariant })
    assert.equal(
      await resolveOrganicOfferMediaExperiment({
        enabled: true,
        session: { ...baseSession, offerVariant },
        client: state.client as never,
      }),
      offerVariant,
    )
    assert.equal(state.writes.length, 0)
  }
})
