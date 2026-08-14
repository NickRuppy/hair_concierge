import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { buildReviewedLeaveInUseCases } from "@/lib/product-intake/catalog-enrichment/leave-in-use-case-manifest"
import { buildLeaveInUseCasePointerDelta } from "@/lib/product-intake/catalog-enrichment/leave-in-use-case-delta"
import { stage5V2SourceFingerprint } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import {
  compileApplicationViewV2 as compileApplicationViewV2Impl,
  composeProductApplicationProtocolsV2,
} from "@/lib/routines/personal-plan/application/compiler-v2"
import { APPLICATION_DAY_TYPE_KEYS } from "@/lib/routines/personal-plan/application/contracts"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "@/lib/routines/personal-plan/application/shared-templates-v2"

const compileApplicationViewV2 = (
  args: Omit<Parameters<typeof compileApplicationViewV2Impl>[0], "useCaseCoverageEnabled">,
) => compileApplicationViewV2Impl({ ...args, useCaseCoverageEnabled: true })

const BASELINE_ARTIFACT =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json"
const FINAL_ARTIFACT =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json"
const MANIFEST =
  "data/catalog-enrichment/personal-plan-stage5-v2/leave-in-use-cases-2026-08-14.json"

test("reviewed Leave-in manifest covers the full cohort and records universal between-wash methods", async () => {
  const artifactText = await readFile(BASELINE_ARTIFACT, "utf8")
  const result = buildReviewedLeaveInUseCases(
    JSON.parse(await readFile(MANIFEST, "utf8")),
    JSON.parse(artifactText),
    createHash("sha256").update(artifactText).digest("hex"),
  )

  assert.equal(result.reviewedProductCount, 41)
  assert.equal(result.changedProductCount, 16)
  assert.deepEqual(result.betweenWashPolicy, {
    eligibility: "all_true_leave_ins",
    methods: ["between_wash_damp_refresh", "between_wash_dry_care"],
    preferred_method: "between_wash_damp_refresh",
    adaptation_facts: ["format", "thickness", "density"],
    source_urls: [
      "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/leave-in-conditioner-tips",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC9921463/",
    ],
  })
  const moneyMist = result.products.find(
    ({ product_name }) => product_name === "Color WOW Money Mist",
  )
  assert.deepEqual(
    moneyMist?.uses.map(({ source_role, application_family }) => [source_role, application_family]),
    [
      ["post_wash_leave_in", "post_wash_damp_conditioning"],
      ["pre_heat_protection", "pre_heat_damp"],
    ],
  )
  assert.deepEqual(
    moneyMist?.candidate_dispositions
      .filter(({ use_case }) => use_case.startsWith("between_wash"))
      .map(({ use_case, status }) => [use_case, status]),
    [
      ["between_wash_damp", "supported"],
      ["between_wash_dry", "supported"],
    ],
  )
  assert.deepEqual(
    result.products
      .find(({ product_name }) => product_name === "Kevin Murphy Young Again")
      ?.uses.map(({ application_family }) => application_family),
    [
      "post_wash_damp_conditioning",
      "between_wash_dry_care",
      "post_style_finish",
      "either_state_protection",
    ],
  )
})

test("every current reviewed Leave-in compiles one grouped dry and damp refresh card", async () => {
  const baselineText = await readFile(BASELINE_ARTIFACT, "utf8")
  const artifact = JSON.parse(await readFile(FINAL_ARTIFACT, "utf8"))
  const reviewed = buildReviewedLeaveInUseCases(
    JSON.parse(await readFile(MANIFEST, "utf8")),
    JSON.parse(baselineText),
    createHash("sha256").update(baselineText).digest("hex"),
  )

  for (const product of reviewed.products) {
    const pointers = artifact.items
      .filter((item: { product_id: string }) => item.product_id === product.product_id)
      .map((item: { guidance_payload_v2: unknown }) => item.guidance_payload_v2)
    const leaveInPointer = pointers.find(
      (pointer: { role?: string }) => pointer.role === "leave_in",
    ) as { sourceRole: string; facts: { applicationArea: string } } | undefined
    const heatPointer = pointers.find(
      (pointer: { role?: string }) => pointer.role === "heat_protection",
    ) as { sourceRole: string } | undefined
    assert.ok(leaveInPointer, `${product.product_name}:conventional Leave-in pointer`)
    const result = compileApplicationViewV2({
      input: {
        routineItems: [
          {
            itemId: `item-${product.product_id}`,
            productId: product.product_id,
            productName: product.product_name,
            category: "leave_in",
            role: "leave_in",
            sourceRoutineRole: leaveInPointer.sourceRole,
            inclusion: "included",
            availability: "owned",
            executable: true,
            applicationInstanceKey: `item-${product.product_id}`,
            catalogFacts: { format: "spray" },
          },
          ...(heatPointer
            ? [
                {
                  itemId: `heat-${product.product_id}`,
                  productId: product.product_id,
                  productName: product.product_name,
                  category: "leave_in" as const,
                  role: "heat_protection" as const,
                  sourceRoutineRole: heatPointer.sourceRole,
                  inclusion: "included" as const,
                  availability: "owned" as const,
                  executable: true,
                  applicationInstanceKey: `heat-${product.product_id}`,
                  catalogFacts: { format: "spray" },
                },
              ]
            : []),
        ],
        unresolvedRoutineItems: [],
        profile: {
          heatEvents: [{ id: "airflow", route: "airflow_shaping", tool: "hair_dryer" }],
        },
        dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({
          key,
          sortOrder: index + 1,
        })),
      },
      familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
      productPointers: pointers as never,
    })
    const blocks =
      result.days
        .find(({ key }) => key === "refresh_day")
        ?.productBlocks.filter(
          ({ productId, roles }) => productId === product.product_id && roles.includes("leave_in"),
        ) ?? []
    assert.equal(blocks.length, 1, product.product_name)
    assert.deepEqual(
      blocks[0]?.steps.filter(({ action }) => action === "section").map(({ copyDe }) => copyDe),
      ["Nach dem Anfeuchten (empfohlen)", "Auf trockenem Haar"],
      product.product_name,
    )
    if (leaveInPointer.facts.applicationArea === "hair_ends") {
      const copy = blocks[0]?.steps.map(({ copyDe }) => copyDe).join(" ") ?? ""
      assert.match(copy, /Spitzen/, product.product_name)
      assert.doesNotMatch(copy, /Längen/, product.product_name)
    }
    if (heatPointer) {
      assert.equal(
        result.days
          .find(({ key }) => key === "refresh_day")
          ?.productBlocks.some(({ roles }) => roles.includes("heat_protection")),
        true,
        `${product.product_name}:heat protection survives grouped refresh guidance`,
      )
      assert.equal(
        result.days
          .find(({ key }) => key === "refresh_day")
          ?.outerSequence.some(
            (entry) =>
              entry.kind === "unresolved_product" && entry.block.productId === product.product_id,
          ),
        false,
        `${product.product_name}:no multi-role collision`,
      )
    }
  }
})

test("reviewed Leave-in changes produce only composable, explicit pointer inserts and corrections", async () => {
  const artifactText = await readFile(BASELINE_ARTIFACT, "utf8")
  const artifact = JSON.parse(artifactText)
  const reviewed = buildReviewedLeaveInUseCases(
    JSON.parse(await readFile(MANIFEST, "utf8")),
    artifact,
    createHash("sha256").update(artifactText).digest("hex"),
  )
  const delta = buildLeaveInUseCasePointerDelta(reviewed, artifact)
  const migration = await readFile(
    "supabase/migrations/20260814121000_personal_plan_leave_in_use_case_coverage.sql",
    "utf8",
  )
  const finalArtifact = JSON.parse(await readFile(FINAL_ARTIFACT, "utf8"))

  assert.equal(delta.inserts.length, 18)
  assert.deepEqual(delta.deletes, [
    {
      product_id: "39ec1b2d-4aa0-4c4e-b581-9b6d5efea530",
      source_role: "post_wash_leave_in",
      application_family: "between_wash_damp_refresh",
    },
  ])
  for (const row of delta.inserts) {
    assert.match(
      migration,
      new RegExp(
        `${row.product_id.replaceAll("-", "\\-")}[^\\n]+${row.source_role}[^\\n]+${row.application_family}`,
      ),
      `migration identity ${row.product_name}:${row.application_family}`,
    )
    assert.equal(
      composeProductApplicationProtocolsV2(row.guidance_payload_v2, SHARED_APPLICATION_TEMPLATES_V2)
        .status,
      "resolved",
      `${row.product_name}:${row.application_family}`,
    )
    const finalItem = finalArtifact.items.find(
      (item: {
        product_id: string
        source_role: string
        guidance_payload_v2: { applicationFamily: string }
      }) =>
        item.product_id === row.product_id &&
        item.source_role === row.source_role &&
        item.guidance_payload_v2.applicationFamily === row.application_family,
    )
    assert.equal(
      finalItem?.source_fingerprint,
      stage5V2SourceFingerprint(row.source_role, row.guidance_payload),
      `final artifact source ${row.product_name}:${row.application_family}`,
    )
  }
  assert.equal(
    finalArtifact.items.some(
      (item: {
        product_id: string
        source_role: string
        guidance_payload_v2: { applicationFamily: string }
      }) =>
        item.product_id === delta.deletes[0]?.product_id &&
        item.source_role === delta.deletes[0]?.source_role &&
        item.guidance_payload_v2.applicationFamily === delta.deletes[0]?.application_family,
    ),
    false,
  )
})

test("reviewed Leave-in manifest fails closed when its source artifact drifts", async () => {
  const artifactText = await readFile(BASELINE_ARTIFACT, "utf8")
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"))
  assert.throws(
    () => buildReviewedLeaveInUseCases(manifest, JSON.parse(artifactText), "0".repeat(64)),
    /baseline_fingerprint_mismatch/,
  )
})
