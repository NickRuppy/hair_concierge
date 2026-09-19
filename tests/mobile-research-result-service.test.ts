import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveMobileResearchResult,
  type MobileResearchResultDependencies,
} from "@/lib/mobile/research-result-service"

const owner = "11111111-1111-4111-8111-111111111111"
const submissionId = "33333333-3333-4333-8333-333333333333"
const productId = "66666666-6666-4666-8666-666666666666"
const submission = {
  id: submissionId,
  source: "scan",
  status: "approved",
  scanned_identifier_value: "4012345678901",
  approved_product_id: productId,
  mobile_result_requested_at: "2026-09-18T12:00:00Z",
}

function deps(
  overrides: Partial<MobileResearchResultDependencies> = {},
): Partial<MobileResearchResultDependencies> {
  return {
    loadSubmission: async () => submission,
    loadProfile: async () => ({ status: "ready", context: {} }) as never,
    resolve: async () => ({ kind: "assessment", product: { id: productId } }) as never,
    ...overrides,
  }
}

test("only the owning, marked mobile submission yields a freshly resolved assessment", async () => {
  let resolved = 0
  const result = await resolveMobileResearchResult(
    {} as never,
    owner,
    submissionId,
    deps({
      loadSubmission: async (_client, userId, id) => {
        assert.equal(userId, owner)
        assert.equal(id, submissionId)
        return submission
      },
      resolve: async (_client, _context, input) => {
        assert.equal(input.identifier?.value, submission.scanned_identifier_value)
        resolved++
        return { kind: "assessment", product: { id: productId } } as never
      },
    }),
  )
  assert.equal(result.kind, "ready")
  assert.equal(resolved, 1)
  assert.equal(
    (
      await resolveMobileResearchResult(
        {} as never,
        owner,
        submissionId,
        deps({
          resolve: async () => ({ kind: "not_needed", product: { id: productId } }) as never,
        }),
      )
    ).kind,
    "ready",
  )
})

test("unowned, unmarked and unapproved submissions never resolve or leak a result", async () => {
  let resolved = 0
  const noResolve = {
    resolve: async () => {
      resolved++
      throw new Error("must not resolve")
    },
  }
  assert.equal(
    (
      await resolveMobileResearchResult(
        {} as never,
        owner,
        submissionId,
        deps({
          ...noResolve,
          loadSubmission: async () => null,
        }),
      )
    ).kind,
    "not_found",
  )
  for (const changed of [
    { mobile_result_requested_at: null },
    { source: "chat" },
    { status: "pending_review" },
    { scanned_identifier_value: "bad" },
    { approved_product_id: null },
  ]) {
    assert.equal(
      (
        await resolveMobileResearchResult(
          {} as never,
          owner,
          submissionId,
          deps({
            ...noResolve,
            loadSubmission: async () => ({ ...submission, ...changed }),
          }),
        )
      ).kind,
      "not_ready",
    )
  }
  assert.equal(resolved, 0)
})

test("withdrawn, mismapped and profile-incomplete results remain ineligible", async () => {
  assert.equal(
    (
      await resolveMobileResearchResult(
        {} as never,
        owner,
        submissionId,
        deps({
          loadProfile: async () => ({ status: "profile_required" }) as never,
        }),
      )
    ).kind,
    "not_ready",
  )
  for (const result of [
    { kind: "assessment", product: { id: "77777777-7777-4777-8777-777777777777" } },
    { kind: "submission_required" },
    { kind: "authority_unavailable", reason: "temporarily_unavailable" },
    { kind: "profile_decision_deferred" },
  ]) {
    assert.equal(
      (
        await resolveMobileResearchResult(
          {} as never,
          owner,
          submissionId,
          deps({
            resolve: async () => result as never,
          }),
        )
      ).kind,
      "not_ready",
    )
  }
})
