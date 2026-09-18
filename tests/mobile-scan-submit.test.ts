import assert from "node:assert/strict"
import test from "node:test"
import {
  mobileScanSubmitSchema,
  submitMobileScan,
  type MobileScanSubmitDependencies,
} from "../src/lib/mobile/scan-submit-service"
import { validateEanInput } from "../src/lib/scan/identifier-lookup"
import type { MobileScanResolveResult } from "../src/lib/mobile/scan-contracts"

const owner = "11111111-1111-4111-8111-111111111111",
  product = "22222222-2222-4222-8222-222222222222",
  submission = "33333333-3333-4333-8333-333333333333"
const input = {
  identifier: { type: "ean" as const, value: "96385074" },
  category: "shampoo" as const,
}
const pending = {
  kind: "pending_review" as const,
  category: "shampoo" as const,
  submission: { id: submission, status: "pending_review" as const, category: "shampoo" as const },
  match: { status: "insufficient_identity" } as never,
}
function deps(
  overrides: Partial<MobileScanSubmitDependencies> = {},
): Partial<MobileScanSubmitDependencies> {
  return {
    loadProfile: async () => ({ status: "ready", context: {} }) as never,
    findOpen: async () => null,
    markMobileResultRequested: async () => undefined,
    createRepository: () => ({}) as never,
    save: async () => true,
    submit: async () => pending,
    ...overrides,
  }
}
test("mobile submit preserves category and exact History barcode while canonicalizing intake EAN spelling", async () => {
  for (const barcode of ["96385074", "0000096385074"]) {
    const calls: unknown[] = []
    const result = await submitMobileScan(
      {} as never,
      owner,
      { ...input, identifier: { type: "ean", value: barcode } },
      deps({
        submit: async (params) => {
          assert.equal(params.userId, owner)
          assert.equal(params.input.category, "shampoo")
          assert.equal(params.input.scannedIdentifier?.value, "0000096385074")
          assert.equal(validateEanInput(params.input.scannedIdentifier!.value).ok, true)
          assert.equal(params.input.frequency_range, null)
          return pending
        },
        save: async (_client, ...args) => {
          calls.push(args)
          return false
        },
      }),
    )
    assert.deepEqual(result, {
      contractVersion: 1,
      kind: "pending_submission",
      submissionId: submission,
      headline: "In Prüfung",
      historySaved: false,
    })
    assert.deepEqual(calls, [[owner, barcode, null, submission]])
  }
})
test("failed intake is not a confirmed request; existing owner request is reused without resubmission", async () => {
  let saved = 0,
    submitted = 0
  const shared = deps({
    save: async () => {
      saved++
      return true
    },
    submit: async () => {
      submitted++
      throw new Error("intake_failed")
    },
  })
  await assert.rejects(submitMobileScan({} as never, owner, input, shared), /intake_failed/)
  assert.equal(saved, 0)
  const result = await submitMobileScan({} as never, owner, input, {
    ...shared,
    findOpen: async () => submission,
  })
  assert.equal(result.kind, "pending_submission")
  assert.equal(submitted, 1)
  assert.equal(saved, 1)
})
test("mobile pending submissions mark durable result intent before returning, including an existing request", async () => {
  const marks: Array<[string, string]> = []
  const markMobileResultRequested: MobileScanSubmitDependencies["markMobileResultRequested"] =
    async (_client, userId, submissionId) => {
      marks.push([userId, submissionId])
    }

  await submitMobileScan({} as never, owner, input, deps({ markMobileResultRequested }))
  await submitMobileScan(
    {} as never,
    owner,
    input,
    deps({ findOpen: async () => submission, markMobileResultRequested }),
  )
  assert.deepEqual(marks, [
    [owner, submission],
    [owner, submission],
  ])
})
test("mobile submit fails retryably when durable result intent cannot be marked", async () => {
  let saved = 0
  const dependencies = deps()
  delete dependencies.markMobileResultRequested
  await assert.rejects(
    submitMobileScan({ rpc: async () => ({ data: false, error: null }) } as never, owner, input, {
      ...dependencies,
      save: async () => {
        saved++
        return true
      },
    }),
    /temporarily_unavailable/,
  )
  assert.equal(saved, 0)
})
test("catalog identity is not assessment readiness; missing product facts still submit and transient failure does not", async () => {
  let current: MobileScanResolveResult = {
    contractVersion: 1,
    kind: "submission_required",
    productId: product,
    missingFacts: ["missing_product_facts"],
  }
  const dependencies = deps({
    eligible: async () => new Set([product]),
    resolve: async () => current,
    submit: async (params) => {
      return (await params.isMatchScanEligible(product))
        ? {
            kind: "already_in_catalog",
            productId: product,
            category: "shampoo",
            match: {} as never,
          }
        : pending
    },
  })
  assert.equal(
    (await submitMobileScan({} as never, owner, input, dependencies)).kind,
    "pending_submission",
  )
  current = {
    contractVersion: 1,
    kind: "authority_unavailable",
    productId: product,
    reason: "temporarily_unavailable",
    missingFacts: ["authority"],
  }
  await assert.rejects(
    submitMobileScan({} as never, owner, input, dependencies),
    /temporarily_unavailable/,
  )
  current = { ...current, reason: "personal_target_unavailable" }
  assert.equal(
    (await submitMobileScan({} as never, owner, input, dependencies)).kind,
    "already_in_catalog",
  )
})
test("already catalogued products do not request a future research result", async () => {
  let marked = 0
  const result = await submitMobileScan(
    {} as never,
    owner,
    input,
    deps({
      eligible: async () => new Set([product]),
      resolve: async () =>
        ({ contractVersion: 1, kind: "not_needed", product: { id: product } }) as never,
      submit: async () => ({
        kind: "already_in_catalog",
        productId: product,
        category: "shampoo",
        match: {} as never,
      }),
      markMobileResultRequested: async () => {
        marked++
      },
    }),
  )
  assert.equal(result.kind, "already_in_catalog")
  assert.equal(marked, 0)
})
test("mobile submit rejects invalid barcode, unsupported category and incomplete profile before intake", async () => {
  assert.equal(
    mobileScanSubmitSchema.safeParse({ ...input, category: "styling_gel" }).success,
    false,
  )
  assert.equal(mobileScanSubmitSchema.safeParse({ ...input, userId: owner }).success, false)
  await assert.rejects(
    submitMobileScan(
      {} as never,
      owner,
      { ...input, identifier: { type: "ean", value: "96385075" } },
      deps({ submit: async () => assert.fail() }),
    ),
    /invalid_identifier/,
  )
  await assert.rejects(
    submitMobileScan(
      {} as never,
      owner,
      input,
      deps({
        loadProfile: async () => ({ status: "profile_required" }),
        submit: async () => assert.fail(),
      }),
    ),
    /profile_required/,
  )
})
