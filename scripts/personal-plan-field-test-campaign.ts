import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config as loadEnv } from "dotenv"
import { readFile } from "node:fs/promises"

import {
  PERSONAL_PLAN_FIELD_TEST_ACCESS_DURATION_HOURS,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS,
} from "../src/lib/personal-plan-field-test/constants"
import { issuePersonalPlanFieldTestToken } from "../src/lib/personal-plan-field-test/token"

const EXPECTED_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const WRITE_GATE = "ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE"
const CONFIRM_PROJECT = `--confirm-project=${EXPECTED_PROJECT_ID}`

type Flow = "personal-plan" | "regular-quiz"
type IdentityMode = "guest" | "email_bound"

type EmailBoundRosterMember = {
  user_id: string
  email: string
}

const EMAIL_BOUND_ROSTER_CAPACITY = 5
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Command =
  | {
      action: "create"
      apply: boolean
      name: string
      flow: Flow
      identityMode: IdentityMode
      accessDurationHours: number
      rosterFile?: string
    }
  | { action: "inspect"; campaignId: string; flow: Flow }
  | { action: "revoke"; apply: boolean; campaignId: string; flow: Flow }

function flow(args: readonly string[]): Flow {
  const selected = value(args, "--flow") ?? "personal-plan"
  if (selected === "personal-plan" || selected === "regular-quiz") return selected
  throw new Error("--flow must be personal-plan or regular-quiz")
}

function defaultName(selectedFlow: Flow) {
  return selectedFlow === "regular-quiz"
    ? "Regulärer Quiz Feldtest 2026-08"
    : "Personal Plan Feldtest 2026-08"
}

function campaignFlowKind(selectedFlow: Flow) {
  return selectedFlow === "regular-quiz" ? "regular_quiz" : "personal_plan"
}

function identityMode(args: readonly string[]): IdentityMode {
  const selected = value(args, "--identity-mode") ?? "guest"
  if (selected === "guest") return selected
  if (selected === "email-bound") return "email_bound"
  throw new Error("--identity-mode must be guest or email-bound")
}

function accessDurationHours(args: readonly string[], selectedIdentityMode: IdentityMode) {
  const raw = value(args, "--access-duration-hours")
  const defaultDuration =
    selectedIdentityMode === "email_bound"
      ? 90 * 24
      : PERSONAL_PLAN_FIELD_TEST_ACCESS_DURATION_HOURS
  if (!raw) return defaultDuration
  if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
    throw new Error("--access-duration-hours must be a positive integer")
  }
  return Number(raw)
}

function assertEmailBoundCreateOptions({
  selectedFlow,
  selectedIdentityMode,
  selectedAccessDurationHours,
  rosterFile,
}: {
  selectedFlow: Flow
  selectedIdentityMode: IdentityMode
  selectedAccessDurationHours: number
  rosterFile?: string
}) {
  if (selectedIdentityMode !== "email_bound") {
    if (rosterFile) throw new Error("--roster-file requires --identity-mode=email-bound")
    return
  }
  if (selectedFlow !== "personal-plan") {
    throw new Error("--identity-mode=email-bound is only available for --flow=personal-plan")
  }
  if (!rosterFile) throw new Error("--identity-mode=email-bound requires --roster-file=<json-file>")
  if (selectedAccessDurationHours !== 90 * 24) {
    throw new Error("email-bound campaigns require --access-duration-hours=2160")
  }
}

export function parseFieldTestCampaignCommand(args: readonly string[]): Command {
  const [action] = args
  const selectedFlow = flow(args)
  if (action === "create") {
    const selectedIdentityMode = identityMode(args)
    const rosterFile = value(args, "--roster-file")
    const selectedAccessDurationHours = accessDurationHours(args, selectedIdentityMode)
    assertEmailBoundCreateOptions({
      selectedFlow,
      selectedIdentityMode,
      selectedAccessDurationHours,
      rosterFile,
    })
    return {
      action,
      apply: args.includes("--apply"),
      name: value(args, "--name") ?? defaultName(selectedFlow),
      flow: selectedFlow,
      identityMode: selectedIdentityMode,
      accessDurationHours: selectedAccessDurationHours,
      rosterFile,
    }
  }
  if (action === "inspect") {
    const campaignId = value(args, "--campaign")
    if (!campaignId) throw new Error("inspect requires --campaign=<uuid>")
    return { action, campaignId, flow: selectedFlow }
  }
  if (action === "revoke") {
    const campaignId = value(args, "--campaign")
    if (!campaignId) throw new Error("revoke requires --campaign=<uuid>")
    return { action, campaignId, apply: args.includes("--apply"), flow: selectedFlow }
  }
  throw new Error(
    "Usage: create|inspect|revoke [--flow=personal-plan|regular-quiz] [--campaign=<uuid>] [--apply]",
  )
}

export async function loadEmailBoundRoster(rosterFile: string): Promise<EmailBoundRosterMember[]> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(rosterFile, "utf8"))
  } catch (error) {
    throw new Error(
      `Cannot read --roster-file: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("--roster-file must be a non-empty JSON array of { user_id, email }")
  }
  if (parsed.length > EMAIL_BOUND_ROSTER_CAPACITY) {
    throw new Error(
      `--roster-file supports at most ${EMAIL_BOUND_ROSTER_CAPACITY} email-bound members`,
    )
  }
  const normalizedUserIds = new Set<string>()
  const normalizedEmails = new Set<string>()
  const members = parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`--roster-file member ${index + 1} must be an object`)
    }
    const userId = (item as Record<string, unknown>).user_id
    const email = (item as Record<string, unknown>).email
    if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
      throw new Error(`--roster-file member ${index + 1} requires a UUID user_id`)
    }
    if (typeof email !== "string" || !email.trim() || !email.includes("@")) {
      throw new Error(`--roster-file member ${index + 1} requires email`)
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedUserIds.has(userId) || normalizedEmails.has(normalizedEmail)) {
      throw new Error("--roster-file must not repeat user_id or normalized email")
    }
    normalizedUserIds.add(userId)
    normalizedEmails.add(normalizedEmail)
    return { user_id: userId, email: normalizedEmail }
  })
  return members
}

export function canApplyFieldTestCampaign(
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
    projectId === EXPECTED_PROJECT_ID
  )
}

export async function runFieldTestCampaignCommand(input: {
  args: readonly string[]
  environment: Record<string, string | undefined>
  admin: SupabaseClient
  log?: (value: unknown) => void
}) {
  const command = parseFieldTestCampaignCommand(input.args)
  const log = input.log ?? console.log
  if (command.action === "inspect") {
    const { data, error } = await input.admin
      .from("personal_plan_test_campaigns")
      .select(
        "id,name,flow_kind,status,starts_at,expires_at,max_activations,access_duration_hours,revoked_at,created_at",
      )
      .eq("id", command.campaignId)
      .eq("flow_kind", campaignFlowKind(command.flow))
      .maybeSingle()
    if (error) throw error
    log(data ?? { status: "not_found" })
    return
  }

  if (!command.apply) {
    log({
      mode: "dry-run",
      action: command.action,
      defaults:
        command.action === "create"
          ? {
              name: command.name,
              flow: command.flow,
              identity_mode: command.identityMode,
              lifetime_days: PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS,
              max_activations:
                command.identityMode === "email_bound"
                  ? "roster member count"
                  : PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS,
              access_duration_hours: command.accessDurationHours,
              roster_file: command.rosterFile,
            }
          : undefined,
      campaign_id: command.action === "revoke" ? command.campaignId : undefined,
      writes: false,
    })
    return
  }
  if (!canApplyFieldTestCampaign(input.args, input.environment)) {
    throw new Error(
      `Writes require ${WRITE_GATE}=1, ${CONFIRM_PROJECT}, --apply, and the matching Supabase URL`,
    )
  }

  if (command.action === "revoke") {
    const { data: matchingCampaign, error: lookupError } = await input.admin
      .from("personal_plan_test_campaigns")
      .select("id,status")
      .eq("id", command.campaignId)
      .eq("flow_kind", campaignFlowKind(command.flow))
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!matchingCampaign) {
      throw new Error(`${command.flow} campaign not found`)
    }
    if (matchingCampaign.status === "revoked") {
      log({ campaign_id: command.campaignId, status: "already_revoked" })
      return
    }
    const { data, error } = await input.admin.rpc("revoke_personal_plan_field_test_campaign", {
      p_campaign_id: command.campaignId,
    })
    if (error) throw error
    if (data !== true) throw new Error("Active campaign not found")
    log({ campaign_id: command.campaignId, status: "revoked" })
    return
  }

  const roster =
    command.identityMode === "email_bound" && command.rosterFile
      ? await loadEmailBoundRoster(command.rosterFile)
      : []
  const issued = issuePersonalPlanFieldTestToken()
  const startsAt = new Date()
  const expiresAt = new Date(
    startsAt.getTime() + PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS * 24 * 60 * 60 * 1000,
  )
  if (command.identityMode === "email_bound") {
    const { data, error } = await input.admin.rpc("create_personal_plan_moderator_test_campaign", {
      p_name: command.name,
      p_token_hash: issued.tokenHash,
      p_roster: roster,
      p_starts_at: startsAt.toISOString(),
      p_expires_at: expiresAt.toISOString(),
    })
    if (error) throw error
    const campaign = Array.isArray(data) ? data[0] : data
    if (!campaign || typeof campaign.campaign_id !== "string") {
      throw new Error("Email-bound campaign creation returned no campaign id")
    }
    log({
      ...campaign,
      link: `https://chaarlie.de/test/haarplan/${issued.token}`,
      warning:
        "Der Link wird nur jetzt ausgegeben. Mitglieder bleiben bis zum unabhängig bestätigten Reset ausstehend. Sicher verwahren und nicht in Logs kopieren.",
    })
    return
  }
  const { data, error } = await input.admin
    .from("personal_plan_test_campaigns")
    .insert({
      name: command.name,
      flow_kind: campaignFlowKind(command.flow),
      token_hash: issued.tokenHash,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      max_activations: PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS,
      access_duration_hours: command.accessDurationHours,
      identity_mode: "guest",
    })
    .select("id,name,flow_kind,status,starts_at,expires_at,max_activations,access_duration_hours")
    .single()
  if (error) throw error
  log({
    ...data,
    link: `https://chaarlie.de/test/${command.flow === "regular-quiz" ? "quiz" : "haarplan"}/${issued.token}`,
    warning: "Der Link wird nur jetzt ausgegeben. Sicher verwahren und nicht in Logs kopieren.",
  })
}

function value(args: readonly string[], name: string) {
  return args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
}

async function main() {
  loadEnv({ path: ".env.local" })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) throw new Error("Supabase admin environment is missing")
  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await runFieldTestCampaignCommand({
    args: process.argv.slice(2),
    environment: process.env,
    admin,
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
