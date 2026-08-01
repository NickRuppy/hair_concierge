/**
 * Backfill Personal-Plan Leads nach Customer.io
 *
 * Liest alle Leads mit quiz_kind = 'personal_plan' aus Supabase und schreibt
 * das vollstaendige Haarprofil als Customer.io-Profilattribute. Noetig fuer alle
 * Leads, die vor dem Sync-Fix erstellt wurden und dort nur 4 Attribute haben.
 *
 * Nutzt exakt dieselbe Funktion wie der Live-Pfad, damit es nur eine
 * Zuordnungslogik gibt.
 *
 * Benoetigte Env-Variablen (.env.local oder Umgebung):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CUSTOMERIO_SERVER_WRITE_KEY
 *
 * Usage:
 *   npm run customerio:backfill-personal-plan -- --dry-run
 *   npm run customerio:backfill-personal-plan
 *   npm run customerio:backfill-personal-plan -- --expires-from-created
 *   npm run customerio:backfill-personal-plan -- --email jemand@example.com
 */

import fs from "node:fs"
import path from "node:path"

import { createClient } from "@supabase/supabase-js"

import { syncPersonalPlanLeadToCustomerIo } from "@/lib/personal-plan-quiz/customerio"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"

const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

/** Adressen, die nie in eine Strecke laufen sollen. */
const TEST_EMAIL_PATTERNS = [
  "nickrupprechter",
  "hairconscierge.test",
  "hair-concierge-test",
  "personal.example.com",
  "@ascendaudience.com",
  "@influencerascension.com",
]

const PLAN_RETENTION_DAYS = 7
const THROTTLE_MS = 120

interface LeadRow {
  id: string
  email: string | null
  marketing_consent: boolean | null
  quiz_answers: unknown
  created_at: string
}

function isTestEmail(email: string) {
  const lower = email.toLowerCase()
  return TEST_EMAIL_PATTERNS.some((pattern) => lower.includes(pattern))
}

function asEnvelope(value: unknown): PersonalPlanQuizSubmissionEnvelope | undefined {
  if (!value || typeof value !== "object") return undefined
  const candidate = value as { answers?: unknown }
  if (!candidate.answers || typeof candidate.answers !== "object") return undefined
  return value as PersonalPlanQuizSubmissionEnvelope
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Fehlende Env-Variable: ${name}`)
    process.exit(1)
  }
  return value
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const expiresFromCreated = process.argv.includes("--expires-from-created")
  const emailIndex = process.argv.indexOf("--email")
  const onlyEmail = emailIndex >= 0 ? process.argv[emailIndex + 1]?.toLowerCase() : undefined

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  )
  requireEnv("CUSTOMERIO_SERVER_WRITE_KEY")

  console.log("=".repeat(64))
  console.log("Backfill Personal-Plan Leads nach Customer.io")
  if (dryRun) console.log("(DRY RUN, es wird nichts geschrieben)")
  if (onlyEmail) console.log(`Nur: ${onlyEmail}`)
  console.log(
    expiresFromCreated
      ? "plan_expires_at: 7 Tage ab Quiz-Datum"
      : "plan_expires_at: 7 Tage ab jetzt (Standard fuer Backfill)",
  )
  console.log("=".repeat(64))

  const { data, error } = await supabase
    .from("leads")
    .select("id, email, marketing_consent, quiz_answers, created_at")
    .eq("quiz_kind", "personal_plan")
    .order("created_at", { ascending: true })

  if (error || !data) {
    console.error("Konnte Leads nicht laden:", error?.message)
    process.exit(1)
  }

  const leads = data as LeadRow[]
  console.log(`${leads.length} Leads mit quiz_kind = personal_plan gefunden.\n`)

  const expiresFromNow = new Date()
  expiresFromNow.setUTCDate(expiresFromNow.getUTCDate() + PLAN_RETENTION_DAYS)
  const overrideExpiry = expiresFromCreated ? undefined : expiresFromNow.toISOString()

  let synced = 0
  let skippedTest = 0
  let skippedNoAnswers = 0
  let skippedNoEmail = 0
  let failed = 0

  for (const lead of leads) {
    if (!lead.email) {
      skippedNoEmail += 1
      continue
    }
    if (onlyEmail && lead.email.toLowerCase() !== onlyEmail) continue
    if (!onlyEmail && isTestEmail(lead.email)) {
      skippedTest += 1
      continue
    }

    const envelope = asEnvelope(lead.quiz_answers)
    if (!envelope) {
      skippedNoAnswers += 1
      console.warn(`  ohne verwertbare Antworten: ${lead.email}`)
      continue
    }

    if (dryRun) {
      const answers = envelope.answers
      console.log(
        `  [dry] ${lead.email.padEnd(38)} ${answers.texture}/${answers.thickness}/${answers.density} · Zugtest ${answers.elasticResponse}`,
      )
      synced += 1
      continue
    }

    try {
      await syncPersonalPlanLeadToCustomerIo({
        createdAt: lead.created_at,
        email: lead.email,
        leadId: lead.id,
        marketingConsent: lead.marketing_consent ?? false,
        quizAnswers: envelope,
        planExpiresAtOverride: overrideExpiry,
      })
      synced += 1
      if (synced % 25 === 0) console.log(`  ${synced} synchronisiert ...`)
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS))
    } catch (caught) {
      failed += 1
      console.error(`  FEHLER bei ${lead.email}:`, caught)
    }
  }

  console.log("\n" + "=".repeat(64))
  console.log(`Synchronisiert:            ${synced}`)
  console.log(`Uebersprungen (Testkonto): ${skippedTest}`)
  console.log(`Uebersprungen (Antworten): ${skippedNoAnswers}`)
  console.log(`Uebersprungen (Mail):      ${skippedNoEmail}`)
  console.log(`Fehlgeschlagen:            ${failed}`)
  console.log("=".repeat(64))

  if (failed > 0) process.exit(1)
}

main().catch((caught) => {
  console.error(caught)
  process.exit(1)
})
