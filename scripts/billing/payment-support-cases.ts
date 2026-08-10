import { pathToFileURL } from "node:url"
import { randomUUID } from "node:crypto"

import { createAdminClient } from "../../src/lib/supabase/admin"
import { sendPaymentSupportResolution } from "../../src/lib/customerio/payment-support"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "../../src/lib/customerio/transactional"

export const PAYMENT_SUPPORT_CLEANUP_CONFIRMATION = "DELETE_RESOLVED_PAYMENT_SUPPORT_CASES"
const REPORT_CODE = /^PAY-[23456789ABCDEFGHJKMNPQRSTUVWXYZ_]{8}$/
const RESOLVED_RETENTION_DAYS = 90

export type PaymentSupportAction =
  | "list"
  | "resolve"
  | "delivery-check"
  | "finalize"
  | "re-arm"
  | "cleanup"

export type PaymentSupportCommandRequest = {
  action: PaymentSupportAction
  apply: boolean
  caseCode?: string
  confirmCode?: string
  confirmCleanup?: string
  outcome?: string
  note?: string
}

export type PaymentSupportOperatorCase = {
  reportCode: string
  recipient: string
  status: "open" | "resolving" | "resolved"
  resolutionOutcome: string | null
  resolutionNote: string | null
  resolutionDeliveryStatus: "pending" | "sending" | "sent" | "failed" | "delivery_uncertain" | null
  resolvedAt: string | null
  createdAt: string
}

export type PaymentSupportDeliveryResult = {
  status: "sent" | "failed" | "delivery_uncertain"
  deliveryId?: string
}

export type PaymentSupportCommandDependencies = {
  listCases: () => Promise<PaymentSupportOperatorCase[]>
  getCase: (reportCode: string) => Promise<PaymentSupportOperatorCase | null>
  sendResolution: (
    paymentCase: PaymentSupportOperatorCase,
    input: { outcome: string; note: string; email: string },
  ) => Promise<PaymentSupportDeliveryResult>
  checkDelivery: (
    paymentCase: PaymentSupportOperatorCase,
  ) => Promise<PaymentSupportDeliveryResult["status"]>
  finalizeDelivery: (paymentCase: PaymentSupportOperatorCase) => Promise<void>
  rearmDelivery: (paymentCase: PaymentSupportOperatorCase) => Promise<void>
  cleanupResolvedBefore: (olderThan: string) => Promise<number>
}

export type PaymentSupportCommandReceipt = {
  ok: true
  mode: "dry-run" | "apply"
  action: PaymentSupportAction
  applyGuardSatisfied: boolean
  cases?: Array<ReturnType<typeof previewCase>>
  preview?: { recipient: string; email: string; outcome: string }
  result?: "preview" | "resolved" | "failed" | "delivery_uncertain" | "finalized" | "re-armed"
  deliveryStatus?: PaymentSupportDeliveryResult["status"]
  deletedCount?: number
}

export class PaymentSupportCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "PaymentSupportCommandError"
  }
}

export function parsePaymentSupportCommandArgs(argv: string[]): PaymentSupportCommandRequest {
  let action: PaymentSupportAction | undefined
  let apply = false
  let caseCode: string | undefined
  let confirmCode: string | undefined
  let confirmCleanup: string | undefined
  let outcome: string | undefined
  let note: string | undefined

  for (const arg of argv) {
    const [key, rawValue] = splitArg(arg)
    switch (key) {
      case "--list":
        action = setAction(action, "list", rawValue)
        break
      case "--resolve":
        action = setAction(action, "resolve", rawValue)
        break
      case "--delivery-check":
        action = setAction(action, "delivery-check", rawValue)
        break
      case "--finalize":
        action = setAction(action, "finalize", rawValue)
        break
      case "--re-arm":
        action = setAction(action, "re-arm", rawValue)
        break
      case "--cleanup":
        action = setAction(action, "cleanup", rawValue)
        break
      case "--case":
        caseCode = requireValue(key, rawValue)
        break
      case "--confirm-code":
        confirmCode = requireValue(key, rawValue)
        break
      case "--confirm-cleanup":
        confirmCleanup = requireValue(key, rawValue)
        break
      case "--outcome":
        outcome = requireValue(key, rawValue)
        break
      case "--note":
        note = requireValue(key, rawValue)
        break
      case "--apply":
        if (rawValue)
          throw new PaymentSupportCommandError("invalid_apply", "--apply takes no value")
        apply = true
        break
      default:
        throw new PaymentSupportCommandError("unknown_argument", "Unknown payment support argument")
    }
  }
  if (!action)
    throw new PaymentSupportCommandError(
      "missing_action",
      "Choose exactly one payment support action",
    )
  if (caseCode && !REPORT_CODE.test(caseCode))
    throw new PaymentSupportCommandError("invalid_case_code", "--case must be a PAY report code")
  if (action === "list" || action === "cleanup") {
    if (caseCode || outcome || note || confirmCode)
      throw new PaymentSupportCommandError(
        "invalid_action_arguments",
        "This action does not accept case resolution arguments",
      )
  } else {
    if (!caseCode)
      throw new PaymentSupportCommandError("missing_case_code", "This action requires --case=PAY-…")
    if (confirmCleanup)
      throw new PaymentSupportCommandError(
        "invalid_action_arguments",
        "--confirm-cleanup is only valid for cleanup",
      )
  }
  if (action === "resolve" && (!outcome || !note))
    throw new PaymentSupportCommandError(
      "missing_resolution",
      "--resolve requires --outcome and --note",
    )
  if (outcome && !/^[a-z0-9_]{3,80}$/.test(outcome))
    throw new PaymentSupportCommandError(
      "invalid_outcome",
      "--outcome must be a closed lowercase token",
    )
  if (note && (note.trim() !== note || note.length > 600))
    throw new PaymentSupportCommandError(
      "invalid_note",
      "--note must be trimmed and at most 600 characters",
    )
  if (action !== "resolve" && (outcome || note))
    throw new PaymentSupportCommandError(
      "invalid_action_arguments",
      "Only --resolve accepts --outcome and --note",
    )
  if ((action === "list" || action === "delivery-check") && apply)
    throw new PaymentSupportCommandError(
      "read_only_action",
      "This action is read-only and cannot use --apply",
    )
  if (!apply && (confirmCode || confirmCleanup))
    throw new PaymentSupportCommandError(
      "confirm_without_apply",
      "A confirmation is only valid with --apply",
    )
  return { action, apply, caseCode, confirmCode, confirmCleanup, outcome, note }
}

export async function runPaymentSupportCommand(
  request: PaymentSupportCommandRequest,
  dependencies: PaymentSupportCommandDependencies,
): Promise<PaymentSupportCommandReceipt> {
  assertMutationConfirmation(request)
  const mode = request.apply ? "apply" : "dry-run"
  if (request.action === "list") {
    return {
      ok: true,
      mode,
      action: request.action,
      applyGuardSatisfied: false,
      cases: (await dependencies.listCases()).map(previewCase),
    }
  }
  if (request.action === "cleanup") {
    if (!request.apply) {
      const cutoff = cleanupCutoff()
      const cases = await dependencies.listCases()
      return {
        ok: true,
        mode,
        action: request.action,
        applyGuardSatisfied: false,
        cases: cases
          .filter(
            (paymentCase) =>
              paymentCase.status === "resolved" &&
              paymentCase.resolvedAt !== null &&
              paymentCase.resolvedAt < cutoff,
          )
          .map(previewCase),
        result: "preview",
      }
    }
    return {
      ok: true,
      mode,
      action: request.action,
      applyGuardSatisfied: true,
      deletedCount: await dependencies.cleanupResolvedBefore(cleanupCutoff()),
    }
  }

  const paymentCase = await requireCase(dependencies, request.caseCode!)
  if (request.action === "delivery-check") {
    const deliveryStatus = await dependencies.checkDelivery(paymentCase)
    return { ok: true, mode, action: request.action, applyGuardSatisfied: false, deliveryStatus }
  }
  if (request.action === "resolve") {
    const preview = resolutionPreview(paymentCase, request.outcome!, request.note!)
    if (!request.apply)
      return {
        ok: true,
        mode,
        action: request.action,
        applyGuardSatisfied: false,
        preview,
        result: "preview",
      }
    assertOpenForResolution(paymentCase)
    const delivery = await dependencies.sendResolution(paymentCase, {
      outcome: request.outcome!,
      note: request.note!,
      email: preview.email,
    })
    return {
      ok: true,
      mode,
      action: request.action,
      applyGuardSatisfied: true,
      preview,
      deliveryStatus: delivery.status,
      result: delivery.status === "sent" ? "resolved" : delivery.status,
    }
  }
  assertDeliveryUncertain(paymentCase)
  if (!request.apply)
    return { ok: true, mode, action: request.action, applyGuardSatisfied: false, result: "preview" }
  if (request.action === "finalize") {
    await dependencies.finalizeDelivery(paymentCase)
    return {
      ok: true,
      mode,
      action: request.action,
      applyGuardSatisfied: true,
      result: "finalized",
    }
  }
  await dependencies.rearmDelivery(paymentCase)
  return { ok: true, mode, action: request.action, applyGuardSatisfied: true, result: "re-armed" }
}

export function resolutionPreview(
  paymentCase: PaymentSupportOperatorCase,
  outcome: string,
  note: string,
) {
  return {
    recipient: maskRecipient(paymentCase.recipient),
    outcome,
    email: `Hallo,\n\nzu deinem gemeldeten Zahlungsproblem mit dem Code ${paymentCase.reportCode}: ${note}\n\nViele Grüße\nChaarlie`,
  }
}

export function maskRecipient(email: string): string {
  const [local, domain] = email.trim().split("@")
  if (!local || !domain) return "***"
  return `${local.slice(0, 1)}***@${domain}`
}

function previewCase(paymentCase: PaymentSupportOperatorCase) {
  return {
    reportCode: paymentCase.reportCode,
    recipient: maskRecipient(paymentCase.recipient),
    status: paymentCase.status,
    resolutionDeliveryStatus: paymentCase.resolutionDeliveryStatus,
    createdAt: paymentCase.createdAt,
  }
}

function assertMutationConfirmation(request: PaymentSupportCommandRequest) {
  if (!request.apply) return
  if (request.action === "cleanup") {
    if (request.confirmCleanup !== PAYMENT_SUPPORT_CLEANUP_CONFIRMATION)
      throw new PaymentSupportCommandError(
        "cleanup_confirmation_mismatch",
        "Cleanup requires the explicit fixed confirmation phrase",
      )
    return
  }
  if (
    request.action === "resolve" ||
    request.action === "finalize" ||
    request.action === "re-arm"
  ) {
    if (request.confirmCode !== request.caseCode)
      throw new PaymentSupportCommandError(
        "apply_confirmation_mismatch",
        "Apply requires --confirm-code to exactly match --case",
      )
  }
}

async function requireCase(dependencies: PaymentSupportCommandDependencies, reportCode: string) {
  const paymentCase = await dependencies.getCase(reportCode)
  if (!paymentCase)
    throw new PaymentSupportCommandError("case_not_found", "Payment support case was not found")
  return paymentCase
}
function assertOpenForResolution(paymentCase: PaymentSupportOperatorCase) {
  if (paymentCase.status !== "open")
    throw new PaymentSupportCommandError(
      "case_not_open",
      "Only an open payment support case can be resolved",
    )
}
function assertDeliveryUncertain(paymentCase: PaymentSupportOperatorCase) {
  if (paymentCase.resolutionDeliveryStatus !== "delivery_uncertain")
    throw new PaymentSupportCommandError(
      "delivery_not_ambiguous",
      "Finalize or re-arm requires delivery_uncertain",
    )
}
function cleanupCutoff() {
  return new Date(Date.now() - RESOLVED_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
function setAction(
  current: PaymentSupportAction | undefined,
  next: PaymentSupportAction,
  value: string | undefined,
) {
  if (value) throw new PaymentSupportCommandError("invalid_action", `${next} takes no value`)
  if (current)
    throw new PaymentSupportCommandError(
      "multiple_actions",
      "Choose exactly one payment support action",
    )
  return next
}
function splitArg(arg: string): [string, string | undefined] {
  const index = arg.indexOf("=")
  return index === -1 ? [arg, undefined] : [arg.slice(0, index), arg.slice(index + 1)]
}
function requireValue(key: string, value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed)
    throw new PaymentSupportCommandError("missing_argument_value", `${key} requires a value`)
  return trimmed
}
function sanitizedCliError(error: unknown) {
  return error instanceof PaymentSupportCommandError
    ? { code: error.code, type: error.name }
    : {
        code: "payment_support_command_failed",
        type: error instanceof Error ? error.name : "Error",
      }
}

type PaymentSupportCaseRow = {
  id: string
  report_code: string
  lead_id: string | null
  user_id: string | null
  status: PaymentSupportOperatorCase["status"]
  resolution_outcome: string | null
  resolution_note: string | null
  resolution_delivery_status: PaymentSupportOperatorCase["resolutionDeliveryStatus"]
  resolved_at: string | null
  created_at: string
}

async function resolveCaseRecipient(row: PaymentSupportCaseRow) {
  const admin = createAdminClient()
  if (row.lead_id) {
    const { data, error } = await admin
      .from("leads")
      .select("email")
      .eq("id", row.lead_id)
      .maybeSingle()
    if (error || typeof data?.email !== "string")
      throw new PaymentSupportCommandError("recipient_unavailable", "Lead recipient unavailable")
    return data.email
  }
  if (row.user_id) {
    const { data, error } = await admin.auth.admin.getUserById(row.user_id)
    if (error || typeof data.user?.email !== "string")
      throw new PaymentSupportCommandError("recipient_unavailable", "User recipient unavailable")
    return data.user.email
  }
  throw new PaymentSupportCommandError("identity_unavailable", "Case identity unavailable")
}

async function toOperatorCase(row: PaymentSupportCaseRow): Promise<PaymentSupportOperatorCase> {
  return {
    reportCode: row.report_code,
    recipient: await resolveCaseRecipient(row),
    status: row.status,
    resolutionOutcome: row.resolution_outcome,
    resolutionNote: row.resolution_note,
    resolutionDeliveryStatus: row.resolution_delivery_status,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  }
}

const CASE_COLUMNS =
  "id, report_code, lead_id, user_id, status, resolution_outcome, resolution_note, resolution_delivery_status, resolved_at, created_at"

function createLivePaymentSupportDependencies(): PaymentSupportCommandDependencies {
  const resolverUserId = () => {
    const value = process.env.PAYMENT_SUPPORT_RESOLVER_USER_ID?.trim()
    if (
      !value ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ) {
      throw new PaymentSupportCommandError(
        "resolver_identity_missing",
        "PAYMENT_SUPPORT_RESOLVER_USER_ID must identify the approving operator",
      )
    }
    return value
  }
  return {
    listCases: async () => {
      const { data, error } = await createAdminClient()
        .from("payment_support_cases")
        .select(CASE_COLUMNS)
        .in("status", ["open", "resolving"])
        .order("created_at", { ascending: true })
      if (error) throw error
      return Promise.all(((data ?? []) as unknown as PaymentSupportCaseRow[]).map(toOperatorCase))
    },
    getCase: async (reportCode) => {
      const { data, error } = await createAdminClient()
        .from("payment_support_cases")
        .select(CASE_COLUMNS)
        .eq("report_code", reportCode)
        .maybeSingle()
      if (error) throw error
      return data ? toOperatorCase(data as unknown as PaymentSupportCaseRow) : null
    },
    sendResolution: async (paymentCase, input) => {
      const admin = createAdminClient()
      const attemptId = randomUUID()
      const now = new Date().toISOString()
      const { data: claimed, error: claimError } = await admin
        .from("payment_support_cases")
        .update({
          status: "resolving",
          resolution_outcome: input.outcome,
          resolution_note: input.note,
          resolution_delivery_status: "sending",
          resolution_attempt_id: attemptId,
          resolution_sending_at: now,
          updated_at: now,
        })
        .eq("report_code", paymentCase.reportCode)
        .eq("status", "open")
        .or("resolution_delivery_status.is.null,resolution_delivery_status.eq.failed")
        .select("id")
        .maybeSingle()
      if (claimError) throw claimError
      if (!claimed)
        throw new PaymentSupportCommandError("resolution_claim_failed", "Case is no longer open")

      try {
        const receipt = await sendPaymentSupportResolution({
          email: paymentCase.recipient,
          reportCode: paymentCase.reportCode,
          attemptId,
          resolutionNote: input.note,
        })
        const resolvedAt = new Date().toISOString()
        const { data, error } = await admin
          .from("payment_support_cases")
          .update({
            status: "resolved",
            resolution_delivery_status: "sent",
            resolution_customerio_delivery_id: receipt.deliveryId,
            resolution_sent_at: resolvedAt,
            resolved_by: resolverUserId(),
            resolved_at: resolvedAt,
            updated_at: resolvedAt,
          })
          .eq("report_code", paymentCase.reportCode)
          .eq("resolution_attempt_id", attemptId)
          .eq("resolution_delivery_status", "sending")
          .select("id")
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error("resolution delivery claim was lost")
        return { status: "sent", deliveryId: receipt.deliveryId }
      } catch (error) {
        const ambiguous = error instanceof CustomerIoAmbiguousDeliveryError
        const definitive = error instanceof CustomerIoHttpError
        const status = ambiguous ? "delivery_uncertain" : "failed"
        const failedAt = new Date().toISOString()
        await admin
          .from("payment_support_cases")
          .update({
            status: ambiguous ? "resolving" : "open",
            resolution_delivery_status: status,
            resolution_failed_at: failedAt,
            updated_at: failedAt,
          })
          .eq("report_code", paymentCase.reportCode)
          .eq("resolution_attempt_id", attemptId)
          .eq("resolution_delivery_status", "sending")
        if (!ambiguous && !definitive) throw error
        return { status }
      }
    },
    checkDelivery: async (paymentCase) => {
      if (paymentCase.resolutionDeliveryStatus === "sent") return "sent"
      if (
        paymentCase.resolutionDeliveryStatus === "delivery_uncertain" ||
        paymentCase.resolutionDeliveryStatus === "sending"
      )
        return "delivery_uncertain"
      return "failed"
    },
    finalizeDelivery: async (paymentCase) => {
      const now = new Date().toISOString()
      const { data, error } = await createAdminClient()
        .from("payment_support_cases")
        .update({
          status: "resolved",
          resolution_delivery_status: "sent",
          resolution_sent_at: now,
          resolved_by: resolverUserId(),
          resolved_at: now,
          updated_at: now,
        })
        .eq("report_code", paymentCase.reportCode)
        .eq("status", "resolving")
        .eq("resolution_delivery_status", "delivery_uncertain")
        .select("id")
        .maybeSingle()
      if (error) throw error
      if (!data) throw new PaymentSupportCommandError("finalize_failed", "Case was not ambiguous")
    },
    rearmDelivery: async (paymentCase) => {
      const { data, error } = await createAdminClient()
        .from("payment_support_cases")
        .update({
          status: "open",
          resolution_delivery_status: null,
          resolution_attempt_id: null,
          resolution_sending_at: null,
          resolution_failed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("report_code", paymentCase.reportCode)
        .eq("status", "resolving")
        .eq("resolution_delivery_status", "delivery_uncertain")
        .select("id")
        .maybeSingle()
      if (error) throw error
      if (!data) throw new PaymentSupportCommandError("rearm_failed", "Case was not ambiguous")
    },
    cleanupResolvedBefore: async (olderThan) => {
      const { data, error } = await createAdminClient()
        .from("payment_support_cases")
        .delete()
        .eq("status", "resolved")
        .lt("resolved_at", olderThan)
        .select("id")
      if (error) throw error
      return data?.length ?? 0
    },
  }
}

async function main() {
  try {
    const request = parsePaymentSupportCommandArgs(process.argv.slice(2))
    const receipt = await runPaymentSupportCommand(request, createLivePaymentSupportDependencies())
    console.log(JSON.stringify(receipt, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: sanitizedCliError(error) }, null, 2))
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
