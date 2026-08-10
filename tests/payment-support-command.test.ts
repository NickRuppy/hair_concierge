import assert from "node:assert/strict"
import test from "node:test"

import {
  PaymentSupportCommandError,
  parsePaymentSupportCommandArgs,
  runPaymentSupportCommand,
  type PaymentSupportCommandDependencies,
  type PaymentSupportOperatorCase,
} from "../scripts/billing/payment-support-cases"

const reportCode = "PAY-7K2M9ABC"
const caseRow: PaymentSupportOperatorCase = {
  reportCode,
  recipient: "lea@example.com",
  status: "open",
  resolutionOutcome: null,
  resolutionNote: null,
  resolutionDeliveryStatus: null,
  resolvedAt: null,
  createdAt: "2026-08-10T09:00:00.000Z",
}

function fakeDependencies(row: PaymentSupportOperatorCase = caseRow) {
  const calls: string[] = []
  const dependencies: PaymentSupportCommandDependencies = {
    listCases: async () => {
      calls.push("list")
      return [row]
    },
    getCase: async (code) => {
      calls.push(`get:${code}`)
      return row
    },
    sendResolution: async () => {
      calls.push("send-resolution")
      return { status: "sent", deliveryId: "cio-delivery-1" }
    },
    checkDelivery: async () => {
      calls.push("check-delivery")
      return "sent"
    },
    finalizeDelivery: async () => {
      calls.push("finalize")
    },
    rearmDelivery: async () => {
      calls.push("re-arm")
    },
    cleanupResolvedBefore: async () => {
      calls.push("cleanup")
      return 2
    },
  }
  return { dependencies, calls }
}

test("list is dry-run by default and masks recipients", async () => {
  const { dependencies, calls } = fakeDependencies()
  const receipt = await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs(["--list"]),
    dependencies,
  )

  assert.equal(receipt.mode, "dry-run")
  assert.deepEqual(calls, ["list"])
  assert.equal(JSON.stringify(receipt).includes("lea@example.com"), false)
  assert.equal(JSON.stringify(receipt).includes("l***@example.com"), true)
})

test("resolution dry-run previews the exact German email without sending or closing", async () => {
  const { dependencies, calls } = fakeDependencies()
  const receipt = await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs([
      "--resolve",
      `--case=${reportCode}`,
      "--outcome=payment_checked",
      "--note=Wir haben deine Zahlung geprüft. Bitte versuche es erneut.",
    ]),
    dependencies,
  )

  assert.equal(receipt.mode, "dry-run")
  assert.deepEqual(calls, [`get:${reportCode}`])
  assert.ok(receipt.preview)
  assert.equal(receipt.preview.recipient, "l***@example.com")
  assert.equal(
    receipt.preview.email,
    "Hallo,\n\nzu deinem gemeldeten Zahlungsproblem mit dem Code PAY-7K2M9ABC: Wir haben deine Zahlung geprüft. Bitte versuche es erneut.\n\nViele Grüße\nChaarlie",
  )
})

test("a mutation rejects a missing or mismatched exact PAY confirmation before any case lookup", async () => {
  for (const confirmCode of [undefined, "PAY-AAAAAAAA"]) {
    const { dependencies, calls } = fakeDependencies()
    const argv = [
      "--resolve",
      `--case=${reportCode}`,
      "--outcome=payment_checked",
      "--note=Wir haben deine Zahlung geprüft.",
      "--apply",
      ...(confirmCode ? [`--confirm-code=${confirmCode}`] : []),
    ]
    await assert.rejects(
      runPaymentSupportCommand(parsePaymentSupportCommandArgs(argv), dependencies),
      (error: unknown) =>
        error instanceof PaymentSupportCommandError && error.code === "apply_confirmation_mismatch",
    )
    assert.deepEqual(calls, [])
  }
})

test("confirmed resolution sends once and resolves only after a definitive delivery receipt", async () => {
  const { dependencies, calls } = fakeDependencies()
  const receipt = await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs([
      "--resolve",
      `--case=${reportCode}`,
      "--outcome=payment_checked",
      "--note=Wir haben deine Zahlung geprüft.",
      "--apply",
      `--confirm-code=${reportCode}`,
    ]),
    dependencies,
  )
  assert.equal(receipt.mode, "apply")
  assert.equal(receipt.result, "resolved")
  assert.deepEqual(calls, [`get:${reportCode}`, "send-resolution"])
})

test("ambiguous delivery remains open and is never retried, finalized, or re-armed automatically", async () => {
  const { dependencies, calls } = fakeDependencies()
  dependencies.sendResolution = async () => {
    calls.push("send-resolution")
    return { status: "delivery_uncertain" }
  }
  const receipt = await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs([
      "--resolve",
      `--case=${reportCode}`,
      "--outcome=payment_checked",
      "--note=Wir haben deine Zahlung geprüft.",
      "--apply",
      `--confirm-code=${reportCode}`,
    ]),
    dependencies,
  )
  assert.equal(receipt.result, "delivery_uncertain")
  assert.deepEqual(calls, [`get:${reportCode}`, "send-resolution"])
})

test("delivery check is read-only; explicit matching confirmation is required to finalize or re-arm", async () => {
  const uncertain = { ...caseRow, resolutionDeliveryStatus: "delivery_uncertain" as const }
  const check = fakeDependencies(uncertain)
  const checkReceipt = await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs(["--delivery-check", `--case=${reportCode}`]),
    check.dependencies,
  )
  assert.equal(checkReceipt.mode, "dry-run")
  assert.deepEqual(check.calls, [`get:${reportCode}`, "check-delivery"])

  const finalize = fakeDependencies(uncertain)
  await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs([
      "--finalize",
      `--case=${reportCode}`,
      "--apply",
      `--confirm-code=${reportCode}`,
    ]),
    finalize.dependencies,
  )
  assert.deepEqual(finalize.calls, [`get:${reportCode}`, "finalize"])

  const rearm = fakeDependencies(uncertain)
  await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs([
      "--re-arm",
      `--case=${reportCode}`,
      "--apply",
      `--confirm-code=${reportCode}`,
    ]),
    rearm.dependencies,
  )
  assert.deepEqual(rearm.calls, [`get:${reportCode}`, "re-arm"])
})

test("cleanup is preview-only by default and requires its fixed confirmation phrase to mutate", async () => {
  const preview = fakeDependencies()
  const previewReceipt = await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs(["--cleanup"]),
    preview.dependencies,
  )
  assert.equal(previewReceipt.mode, "dry-run")
  assert.deepEqual(preview.calls, ["list"])

  const rejected = fakeDependencies()
  await assert.rejects(
    runPaymentSupportCommand(
      parsePaymentSupportCommandArgs(["--cleanup", "--apply"]),
      rejected.dependencies,
    ),
    (error: unknown) =>
      error instanceof PaymentSupportCommandError && error.code === "cleanup_confirmation_mismatch",
  )
  assert.deepEqual(rejected.calls, [])

  const applied = fakeDependencies()
  const receipt = await runPaymentSupportCommand(
    parsePaymentSupportCommandArgs([
      "--cleanup",
      "--apply",
      "--confirm-cleanup=DELETE_RESOLVED_PAYMENT_SUPPORT_CASES",
    ]),
    applied.dependencies,
  )
  assert.equal(receipt.deletedCount, 2)
  assert.deepEqual(applied.calls, ["cleanup"])
})
