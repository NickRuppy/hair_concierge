import { createPersonalPlanOneTimeQaToken } from "@/lib/funnel/personal-plan-pricing-qa-token"

function value(name: string): string {
  const index = process.argv.indexOf(name)
  const result = index >= 0 ? process.argv[index + 1] : undefined
  if (!result || result.startsWith("--")) throw new Error(`Missing ${name}`)
  return result
}

function main() {
  const secret = process.env.PERSONAL_PLAN_ONE_TIME_QA_SIGNING_SECRET
  if (!secret) throw new Error("PERSONAL_PLAN_ONE_TIME_QA_SIGNING_SECRET is required")
  const ttlSeconds = process.argv.includes("--ttl-seconds") ? Number(value("--ttl-seconds")) : 300
  const token = createPersonalPlanOneTimeQaToken({
    secret,
    leadId: value("--lead-id"),
    sessionId: value("--session-id"),
    packageKey: "meta_personal_plan_v1",
    arm: "personal-plan-one-time-v1",
    ttlSeconds,
  })
  process.stdout.write(token)
}

main()
