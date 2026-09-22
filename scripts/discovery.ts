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
  discoveryEnrollmentSigningSecret,
  projectDiscoveryEnrollmentCredential,
} from "../src/lib/discovery/token"

const PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const WRITE_GATE = "ALLOW_DISCOVERY_PRODUCTION_WRITE"
const CONFIRM_PROJECT = `--confirm-project=${PROJECT_ID}`
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type DiscoveryCommand =
  | { action: "list" }
  | { action: "create"; apply: boolean; name: string; email: string }
  | { action: "revoke" | "rotate"; apply: boolean; enrollmentId: string }

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
  throw new Error(
    "Usage: list | create --name=<name> --email=<email> | revoke|rotate --enrollment=<uuid>",
  )
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

export async function runDiscoveryCommand(input: {
  args: readonly string[]
  environment: Record<string, string | undefined>
  gateway?: DiscoveryEnrollmentGateway
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
  if (!command.apply) {
    log({ mode: "dry-run", writes: false, ...command })
    return
  }
  if (!canApplyDiscoveryWrite(input.args, input.environment)) {
    throw new Error(
      `Writes require ${WRITE_GATE}=1, ${CONFIRM_PROJECT}, --apply, and the matching Supabase URL`,
    )
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
