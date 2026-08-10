import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config as loadEnv } from "dotenv"

import {
  PERSONAL_PLAN_FIELD_TEST_ACCESS_DURATION_HOURS,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS,
} from "../src/lib/personal-plan-field-test/constants"
import { issuePersonalPlanFieldTestToken } from "../src/lib/personal-plan-field-test/token"

const EXPECTED_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const WRITE_GATE = "ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE"
const CONFIRM_PROJECT = `--confirm-project=${EXPECTED_PROJECT_ID}`

type Command =
  | { action: "create"; apply: boolean; name: string }
  | { action: "inspect"; campaignId: string }
  | { action: "revoke"; apply: boolean; campaignId: string }

export function parseFieldTestCampaignCommand(args: readonly string[]): Command {
  const [action] = args
  if (action === "create") {
    return {
      action,
      apply: args.includes("--apply"),
      name: value(args, "--name") ?? "Personal Plan Feldtest 2026-08",
    }
  }
  if (action === "inspect") {
    const campaignId = value(args, "--campaign")
    if (!campaignId) throw new Error("inspect requires --campaign=<uuid>")
    return { action, campaignId }
  }
  if (action === "revoke") {
    const campaignId = value(args, "--campaign")
    if (!campaignId) throw new Error("revoke requires --campaign=<uuid>")
    return { action, campaignId, apply: args.includes("--apply") }
  }
  throw new Error("Usage: create|inspect|revoke [--campaign=<uuid>] [--apply]")
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
        "id,name,status,starts_at,expires_at,max_activations,access_duration_hours,revoked_at,created_at",
      )
      .eq("id", command.campaignId)
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
              lifetime_days: PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS,
              max_activations: PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS,
              access_duration_hours: PERSONAL_PLAN_FIELD_TEST_ACCESS_DURATION_HOURS,
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
    const { data, error } = await input.admin.rpc("revoke_personal_plan_field_test_campaign", {
      p_campaign_id: command.campaignId,
    })
    if (error) throw error
    if (data !== true) throw new Error("Active campaign not found")
    log({ campaign_id: command.campaignId, status: "revoked" })
    return
  }

  const issued = issuePersonalPlanFieldTestToken()
  const startsAt = new Date()
  const expiresAt = new Date(
    startsAt.getTime() + PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS * 24 * 60 * 60 * 1000,
  )
  const { data, error } = await input.admin
    .from("personal_plan_test_campaigns")
    .insert({
      name: command.name,
      token_hash: issued.tokenHash,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      max_activations: PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS,
      access_duration_hours: PERSONAL_PLAN_FIELD_TEST_ACCESS_DURATION_HOURS,
    })
    .select("id,name,status,starts_at,expires_at,max_activations,access_duration_hours")
    .single()
  if (error) throw error
  log({
    ...data,
    link: `https://chaarlie.de/test/haarplan/${issued.token}`,
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
