import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  createDiscoveryEnrollment,
  listDiscoveryEnrollments,
  revokeDiscoveryEnrollment,
  rotateDiscoveryEnrollment,
  type DiscoveryEnrollmentRow as DiscoveryEnrollmentServiceRow,
} from "../src/lib/discovery/enrollment"
import {
  assignDiscoveryIntakeItemProduct,
  filterDiscoveryEligibleProductIds,
  isResolvedDiscoverySubmissionStatus,
  loadDiscoveryReconcileTargets,
  loadDiscoverySubmissionOutcomes,
  type DiscoveryPendingIntakeItem,
  type DiscoveryReconcileScope,
  type DiscoveryReconcileTarget,
  type DiscoverySubmissionOutcome,
} from "../src/lib/discovery/reconcile"
import {
  discoveryEnrollmentSigningSecret,
  projectDiscoveryEnrollmentCredential,
} from "../src/lib/discovery/token"
import { createAdminClient } from "../src/lib/supabase/admin"

const PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const WRITE_GATE = "ALLOW_DISCOVERY_PRODUCTION_WRITE"
const CONFIRM_PROJECT = `--confirm-project=${PROJECT_ID}`
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type DiscoveryCommand =
  | { action: "list" }
  | { action: "create"; apply: boolean; name: string; email: string }
  | { action: "revoke" | "rotate"; apply: boolean; enrollmentId: string }
  | { action: "reconcile"; apply: boolean; scope: DiscoveryReconcileScope }

/** The enrollment service owns the row shape; the CLI only projects receipts from it. */
export type DiscoveryEnrollmentRow = DiscoveryEnrollmentServiceRow

export type DiscoveryEnrollmentStatus = "invited" | "claimed" | "revoked"

export type DiscoveryEnrollmentReceipt = {
  enrollmentId: string
  name: string
  email: string
  status: DiscoveryEnrollmentStatus
  tokenVersion: number
  url: string
  message: string
}

/**
 * The write surface the CLI needs. Every command goes through it, so the
 * production gate can be proven to refuse before anything reaches the database.
 */
export type DiscoveryEnrollmentGateway = {
  list: () => Promise<DiscoveryEnrollmentRow[]>
  create: (input: { name: string; email: string }) => Promise<DiscoveryEnrollmentRow>
  revoke: (enrollmentId: string) => Promise<DiscoveryEnrollmentRow>
  rotate: (enrollmentId: string) => Promise<DiscoveryEnrollmentRow>
}

/** The reconciliation service owns these shapes; the CLI ports and projects them. */
export type {
  DiscoveryPendingIntakeItem,
  DiscoveryReconcileScope,
  DiscoveryReconcileTarget,
  DiscoverySubmissionOutcome,
}

/**
 * The read/write surface `reconcile` needs, split from the enrollment gateway so
 * the production gate can be proven to refuse before any of it runs. Its
 * behaviour lives in `src/lib/discovery/reconcile.ts`.
 */
export type DiscoveryReconcileGateway = {
  loadTargets: (scope: DiscoveryReconcileScope) => Promise<DiscoveryReconcileTarget[]>
  loadSubmissionOutcomes: (
    submissionIds: readonly string[],
  ) => Promise<Map<string, DiscoverySubmissionOutcome>>
  filterEligibleProductIds: (productIds: readonly string[]) => Promise<Set<string>>
  assignProductId: (input: { itemId: string; productId: string }) => Promise<boolean>
}

/**
 * - `reconciled` — the submission RESOLVED onto an eligible catalog product, so the
 *   item now carries a `product_id` (in a dry run: it would).
 * - `research_pending` — no approved product yet; the research is still open.
 * - `submission_not_approved` — a product id is on the submission, but its status is
 *   not one of `DISCOVERY_RESOLVED_SUBMISSION_STATUSES`: the review moved back to
 *   `needs_more_info`, or rejected/cancelled it, without clearing the id it once had.
 *   Reported rather than written, because the id no longer states a verdict.
 * - `approved_but_ineligible` — resolved, but the product is deactivated or
 *   disposition-quarantined. Deliberately NOT written: the capture gate would
 *   have refused the same product.
 * - `already_assigned` — the row was claimed between the plan and the write.
 *
 * `productId` on the receipt is always what THIS run wrote (or, in a dry run,
 * would write) — never the row's current value. It is null for every outcome but
 * `reconciled`.
 */
export type DiscoveryReconcileOutcome =
  | "reconciled"
  | "research_pending"
  | "submission_not_approved"
  | "approved_but_ineligible"
  | "already_assigned"

export type DiscoveryReconcileItemReceipt = {
  itemId: string
  category: string
  source: string
  product: string | null
  submissionId: string
  submissionStatus: string | null
  productId: string | null
  outcome: DiscoveryReconcileOutcome
}

export type DiscoveryReconcileParticipantReceipt = {
  enrollmentId: string
  name: string
  email: string
  intakeId: string
  finalizedAt: string | null
  items: DiscoveryReconcileItemReceipt[]
}

export type DiscoveryReconcileReceipt = {
  action: "reconcile"
  mode: "dry-run" | "apply"
  writes: boolean
  scope: DiscoveryReconcileScope
  totals: Record<DiscoveryReconcileOutcome, number>
  participants: DiscoveryReconcileParticipantReceipt[]
}

function value(args: readonly string[], name: string) {
  const prefix = `${name}=`
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

export function parseDiscoveryCommand(args: readonly string[]): DiscoveryCommand {
  const [action] = args
  if (action === "list") return { action }
  if (action === "create") {
    const name = value(args, "--name")?.trim()
    const email = value(args, "--email")?.trim().toLowerCase()
    if (!name || name.length > 120) throw new Error("create requires --name=<name>")
    if (!email || !EMAIL.test(email) || email.length > 320) {
      throw new Error("create requires a valid --email=<email>")
    }
    return { action, apply: args.includes("--apply"), name, email }
  }
  if (action === "revoke" || action === "rotate") {
    const enrollmentId = value(args, "--enrollment")
    if (!enrollmentId) throw new Error(`${action} requires --enrollment=<uuid>`)
    return { action, apply: args.includes("--apply"), enrollmentId }
  }
  if (action === "reconcile") {
    return { action, apply: args.includes("--apply"), scope: parseDiscoveryReconcileScope(args) }
  }
  throw new Error(
    "Usage: list | create --name=<name> --email=<email> | revoke|rotate --enrollment=<uuid>" +
      " | reconcile --enrollment=<uuid>|--email=<email>|--all",
  )
}

/** Exactly one scope — an ambiguous run is a refusal, never a silent precedence rule. */
export function parseDiscoveryReconcileScope(args: readonly string[]): DiscoveryReconcileScope {
  const enrollmentId = value(args, "--enrollment")?.trim()
  const email = value(args, "--email")?.trim().toLowerCase()
  const all = args.includes("--all")
  const chosen = [enrollmentId, email, all ? "--all" : undefined].filter(Boolean)
  if (chosen.length !== 1) {
    throw new Error("reconcile requires exactly one of --enrollment=<uuid>, --email=<email>, --all")
  }
  if (all) return { kind: "all" }
  if (enrollmentId) return { kind: "enrollment", enrollmentId }
  if (!email || !EMAIL.test(email)) throw new Error("reconcile requires a valid --email=<email>")
  return { kind: "email", email }
}

export function canApplyDiscoveryWrite(
  args: readonly string[],
  environment: Record<string, string | undefined>,
) {
  let projectId: string | null = null
  try {
    projectId = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0]
  } catch {
    projectId = null
  }
  return (
    args.includes("--apply") &&
    args.includes(CONFIRM_PROJECT) &&
    environment[WRITE_GATE]?.trim() === "1" &&
    projectId === PROJECT_ID
  )
}

export function deriveDiscoveryEnrollmentStatus(
  row: Pick<DiscoveryEnrollmentRow, "claimed_at" | "revoked_at">,
): DiscoveryEnrollmentStatus {
  if (row.revoked_at) return "revoked"
  return row.claimed_at ? "claimed" : "invited"
}

/**
 * The WhatsApp-ready invite. The credential travels in the URL fragment so it
 * never reaches a server log, a Referer header or an analytics query string.
 */
export function projectDiscoveryInvitation(input: {
  enrollmentId: string
  name: string
  tokenVersion: number
  secret: string
  siteUrl: string
}) {
  const credential = projectDiscoveryEnrollmentCredential(
    { enrollmentId: input.enrollmentId, tokenVersion: input.tokenVersion },
    input.secret,
  )
  const url = `${input.siteUrl.replace(/\/+$/, "")}/beratung/einladung#code=${encodeURIComponent(credential)}`
  const firstName = input.name.trim().split(/\s+/)[0] || input.name
  return {
    credential,
    url,
    message: [
      `Hi ${firstName}, hier ist dein persönlicher Link für unser Gespräch:`,
      url,
      "Konto anlegen, Fragebogen ausfüllen, Produkte eintragen – dauert etwa 10 Minuten.",
    ].join("\n"),
  }
}

function projectReceipt(
  row: DiscoveryEnrollmentRow,
  context: { secret: string; siteUrl: string },
): DiscoveryEnrollmentReceipt {
  const invitation = projectDiscoveryInvitation({
    enrollmentId: row.id,
    name: row.display_name,
    tokenVersion: row.token_version,
    secret: context.secret,
    siteUrl: context.siteUrl,
  })
  return {
    enrollmentId: row.id,
    name: row.display_name,
    email: row.normalized_email,
    status: deriveDiscoveryEnrollmentStatus(row),
    tokenVersion: row.token_version,
    url: invitation.url,
    message: invitation.message,
  }
}

/** The participant's own words, which the cockpit shows while research is open. */
function describePendingItem(item: DiscoveryPendingIntakeItem) {
  const label = [item.brandText, item.productNameText].filter(Boolean).join(" ").trim()
  return label || null
}

/**
 * Pure: decides, per pending item, what should happen — and NEVER returns
 * `reconciled` without an eligible `productId` to write.
 *
 * Two independent conditions have to hold before an id is a candidate, and they fail
 * into two different outcomes so the receipt says WHICH one blocked it: the submission
 * must be in a genuinely resolved status (`submission_not_approved` otherwise), and the
 * product must still pass scan eligibility (`approved_but_ineligible` otherwise).
 */
export function planDiscoveryReconciliation(input: {
  targets: readonly DiscoveryReconcileTarget[]
  outcomes: Map<string, DiscoverySubmissionOutcome>
  eligible: ReadonlySet<string>
}): DiscoveryReconcileParticipantReceipt[] {
  return input.targets.map((target) => ({
    enrollmentId: target.enrollmentId,
    name: target.name,
    email: target.email,
    intakeId: target.intakeId,
    finalizedAt: target.finalizedAt,
    items: target.items.map((item) => {
      const submission = input.outcomes.get(item.productSubmissionId)
      const approved = submission?.approvedProductId ?? null
      const resolved = approved !== null && isResolvedDiscoverySubmissionStatus(submission?.status)
      const eligible = resolved && input.eligible.has(approved)
      const outcome: DiscoveryReconcileOutcome = !approved
        ? "research_pending"
        : !resolved
          ? "submission_not_approved"
          : eligible
            ? "reconciled"
            : "approved_but_ineligible"
      return {
        itemId: item.itemId,
        category: item.category,
        source: item.source,
        product: describePendingItem(item),
        submissionId: item.productSubmissionId,
        submissionStatus: submission?.status ?? null,
        productId: outcome === "reconciled" ? approved : null,
        outcome,
      } satisfies DiscoveryReconcileItemReceipt
    }),
  }))
}

function totalDiscoveryReconcileOutcomes(participants: DiscoveryReconcileParticipantReceipt[]) {
  const totals: Record<DiscoveryReconcileOutcome, number> = {
    reconciled: 0,
    research_pending: 0,
    submission_not_approved: 0,
    approved_but_ineligible: 0,
    already_assigned: 0,
  }
  for (const participant of participants) {
    for (const item of participant.items) totals[item.outcome] += 1
  }
  return totals
}

/**
 * Reads what is pending, decides, and — only with `apply` — writes. The read is
 * the same in both modes, so the dry run is the plan that `--apply` executes.
 */
async function runDiscoveryReconcile(input: {
  scope: DiscoveryReconcileScope
  apply: boolean
  gateway: DiscoveryReconcileGateway
}): Promise<DiscoveryReconcileReceipt> {
  const targets = await input.gateway.loadTargets(input.scope)
  const submissionIds = targets.flatMap((target) =>
    target.items.map((item) => item.productSubmissionId),
  )
  const outcomes = await input.gateway.loadSubmissionOutcomes(submissionIds)
  // Only a RESOLVED submission's id is a candidate, so only those are worth an
  // eligibility lookup — an id left behind by a reverted review is not asked about.
  const approvedIds = [...outcomes.values()]
    .filter((outcome) => isResolvedDiscoverySubmissionStatus(outcome.status))
    .map((outcome) => outcome.approvedProductId)
    .filter((id): id is string => id !== null)
  const eligible = await input.gateway.filterEligibleProductIds(approvedIds)

  const participants = planDiscoveryReconciliation({ targets, outcomes, eligible })
  if (input.apply) {
    for (const participant of participants) {
      for (const item of participant.items) {
        if (item.outcome !== "reconciled" || !item.productId) continue
        // Re-asked per item, immediately before the write, rather than trusted from
        // the batch read above. A sweep over 100 participants is a long-running run,
        // and deactivating or quarantining a product is exactly the kind of thing that
        // happens DURING one. The batch answer is what makes the dry run a plan; this
        // is what keeps `--apply` from writing against a stale one.
        const stillEligible = await input.gateway.filterEligibleProductIds([item.productId])
        if (!stillEligible.has(item.productId)) {
          item.outcome = "approved_but_ineligible"
          item.productId = null
          continue
        }
        const written = await input.gateway.assignProductId({
          itemId: item.itemId,
          productId: item.productId,
        })
        if (written) continue
        // `productId` is what this run wrote, never what the row now holds — and
        // this run wrote nothing. Leaving the discarded candidate in would read
        // as the item's current product, which it provably is not.
        item.outcome = "already_assigned"
        item.productId = null
      }
    }
  }
  return {
    action: "reconcile",
    mode: input.apply ? "apply" : "dry-run",
    writes: input.apply,
    scope: input.scope,
    totals: totalDiscoveryReconcileOutcomes(participants),
    participants,
  }
}

function publicSiteUrl(explicit?: string) {
  const site = explicit ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://chaarlie.de"
  return site.replace(/\/$/, "")
}

/**
 * The gateway is the production write surface; its behaviour lives in
 * `src/lib/discovery/enrollment.ts` so the app routes and this CLI share one
 * implementation. `revoke` in particular must be the stamp-clearing one: a
 * `revoked_at` timestamp alone leaves a claimed participant inside the
 * JWT-gated middleware until their token refreshes.
 */
function adminGateway(): DiscoveryEnrollmentGateway {
  return {
    list: () => listDiscoveryEnrollments(),
    create: (input) => createDiscoveryEnrollment(input),
    revoke: (enrollmentId) => revokeDiscoveryEnrollment(enrollmentId),
    rotate: (enrollmentId) => rotateDiscoveryEnrollment(enrollmentId),
  }
}

/** One service-role client for the whole reconcile run, built only when it runs. */
function adminReconcileGateway(): DiscoveryReconcileGateway {
  let client: ReturnType<typeof createAdminClient> | null = null
  const admin = () => (client ??= createAdminClient())
  return {
    loadTargets: (scope) => loadDiscoveryReconcileTargets(scope, admin()),
    loadSubmissionOutcomes: (ids) => loadDiscoverySubmissionOutcomes(ids, admin()),
    filterEligibleProductIds: (ids) => filterDiscoveryEligibleProductIds(ids, admin()),
    assignProductId: (assignment) => assignDiscoveryIntakeItemProduct(assignment, admin()),
  }
}

export async function runDiscoveryCommand(input: {
  args: readonly string[]
  environment: Record<string, string | undefined>
  gateway?: DiscoveryEnrollmentGateway
  reconcileGateway?: DiscoveryReconcileGateway
  secret?: string
  siteUrl?: string
  log?: (value: unknown) => void
}) {
  const command = parseDiscoveryCommand(input.args)
  const log = input.log ?? console.log
  // Resolved only where a link is actually projected, so a missing secret can
  // never mask the production-gate refusal below.
  const context = () => ({
    secret: discoveryEnrollmentSigningSecret(input.secret),
    siteUrl: publicSiteUrl(input.siteUrl),
  })
  const gateway = input.gateway ?? adminGateway()

  if (command.action === "list") {
    const rows = await gateway.list()
    log(rows.map((row) => projectReceipt(row, context())))
    return
  }
  // The gate is checked before anything else a write command touches — including
  // `reconcile`'s reads, which would otherwise soften a refusal into a report.
  if (command.apply && !canApplyDiscoveryWrite(input.args, input.environment)) {
    throw new Error(
      `Writes require ${WRITE_GATE}=1, ${CONFIRM_PROJECT}, --apply, and the matching Supabase URL`,
    )
  }
  if (command.action === "reconcile") {
    log(
      await runDiscoveryReconcile({
        scope: command.scope,
        apply: command.apply,
        gateway: input.reconcileGateway ?? adminReconcileGateway(),
      }),
    )
    return
  }
  if (!command.apply) {
    log({ mode: "dry-run", writes: false, ...command })
    return
  }
  if (command.action === "create") {
    log(projectReceipt(await gateway.create(command), context()))
    return
  }
  log(projectReceipt(await gateway[command.action](command.enrollmentId), context()))
}

async function main() {
  loadEnv({ path: resolve(process.cwd(), ".env.local") })
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment is not configured")
  }
  await runDiscoveryCommand({ args: process.argv.slice(2), environment: process.env })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
