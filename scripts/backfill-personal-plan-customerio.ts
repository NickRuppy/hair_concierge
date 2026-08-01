/**
 * Enqueues and attempts profile-only Customer.io sync for historical Personal Plan leads.
 * It never requests the completion event, so it cannot enter the new event-triggered campaign.
 */

import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import {
  dispatchCustomerIoProfileSyncForLead,
  parsePersonalPlanProfileSyncEnvelope,
} from "@/lib/personal-plan-quiz/customerio-outbox"
import { PERSONAL_PLAN_QUIZ_KIND } from "@/lib/personal-plan-quiz/types"

const TEST_EMAIL_PATTERNS = [
  "nickrupprechter",
  "hairconscierge.test",
  "hair-concierge-test",
  "personal.example.com",
  "@ascendaudience.com",
  "@influencerascension.com",
]
const THROTTLE_MS = 120

type LeadRow = {
  id: string
  email: string | null
  quiz_answers: unknown
}

export type PersonalPlanBackfillSummary = {
  selected: number
  delivered: number
  queuedForRetry: number
  failedToEnqueue: number
  skippedTest: number
  skippedNoAnswers: number
  skippedNoEmail: number
}

export function assertPersonalPlanBackfillExecutionSafe(input: {
  dryRun: boolean
  campaignsSafe: boolean
}) {
  if (!input.dryRun && !input.campaignsSafe) {
    throw new Error(
      "Live backfill requires --confirm-campaigns-safe after auditing active Customer.io segment and attribute-triggered campaigns",
    )
  }
}

export async function runPersonalPlanCustomerIoBackfill(input: {
  supabase: SupabaseClient
  dryRun: boolean
  onlyEmail?: string
  dispatch?: typeof dispatchCustomerIoProfileSyncForLead
  throttleMs?: number
  log?: (message: string) => void
}): Promise<PersonalPlanBackfillSummary> {
  const dispatch = input.dispatch ?? dispatchCustomerIoProfileSyncForLead
  const log = input.log ?? console.log
  const onlyEmail = input.onlyEmail?.trim().toLowerCase()
  let query = input.supabase
    .from("leads")
    .select("id,email,quiz_answers")
    .eq("quiz_kind", PERSONAL_PLAN_QUIZ_KIND)
    .order("created_at", { ascending: true })
  if (onlyEmail) query = query.eq("email", onlyEmail)

  const { data, error } = await query
  if (error) throw error

  const summary: PersonalPlanBackfillSummary = {
    selected: 0,
    delivered: 0,
    queuedForRetry: 0,
    failedToEnqueue: 0,
    skippedTest: 0,
    skippedNoAnswers: 0,
    skippedNoEmail: 0,
  }

  for (const lead of (data ?? []) as LeadRow[]) {
    if (!lead.email) {
      summary.skippedNoEmail += 1
      continue
    }
    if (!onlyEmail && isTestEmail(lead.email)) {
      summary.skippedTest += 1
      continue
    }
    if (!isSupportedEnvelope(lead.quiz_answers)) {
      summary.skippedNoAnswers += 1
      continue
    }

    summary.selected += 1
    if (input.dryRun) {
      log(`[dry] ${lead.email}`)
      continue
    }

    const enqueue = await input.supabase.rpc("request_customerio_profile_sync", {
      p_lead_id: lead.id,
    })
    if (enqueue.error) {
      summary.failedToEnqueue += 1
      log(`[failed-to-enqueue] ${lead.email}: ${errorMessage(enqueue.error)}`)
      continue
    }

    try {
      const outcome = await dispatch(input.supabase, lead.id)
      if (outcome === "delivered") summary.delivered += 1
      else summary.queuedForRetry += 1
    } catch (error) {
      summary.queuedForRetry += 1
      log(`[queued-for-retry] ${lead.email}: ${errorMessage(error)}`)
    }

    if ((input.throttleMs ?? THROTTLE_MS) > 0) {
      await new Promise((resolve) => setTimeout(resolve, input.throttleMs ?? THROTTLE_MS))
    }
  }

  return summary
}

function isSupportedEnvelope(value: unknown) {
  return Boolean(parsePersonalPlanProfileSyncEnvelope(value))
}

function isTestEmail(email: string) {
  const lower = email.toLowerCase()
  return TEST_EMAIL_PATTERNS.some((pattern) => lower.includes(pattern))
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Fehlende Env-Variable: ${name}`)
  return value
}

async function main() {
  loadLocalEnv()
  const dryRun = process.argv.includes("--dry-run")
  const campaignsSafe = process.argv.includes("--confirm-campaigns-safe")
  const emailIndex = process.argv.indexOf("--email")
  const onlyEmail = emailIndex >= 0 ? process.argv[emailIndex + 1] : undefined
  assertPersonalPlanBackfillExecutionSafe({ dryRun, campaignsSafe })
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  )
  if (!dryRun) requireEnv("CUSTOMERIO_SERVER_WRITE_KEY")

  console.log("Backfill Personal-Plan Profile nach Customer.io")
  console.log("Modus: Profilattribute ohne Completion-Event")
  if (dryRun) console.log("DRY RUN: keine Schreibvorgaenge")
  if (onlyEmail) console.log(`Nur: ${onlyEmail}`)

  const summary = await runPersonalPlanCustomerIoBackfill({
    supabase,
    dryRun,
    onlyEmail,
  })
  console.log(JSON.stringify(summary, null, 2))
  if (summary.failedToEnqueue > 0) process.exitCode = 1
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
