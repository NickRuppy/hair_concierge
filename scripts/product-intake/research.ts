import { readFile } from "node:fs/promises"

import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import {
  buildResearchPayloadDraft,
  dryRunResearchedPayload,
  loadSubmission,
  saveResearchedPayload,
} from "./review-actions"

async function loadPayload(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>
}

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const submissionId = requireFlag(args, "submission-id")
  const payloadFile = flag(args, "payload-file")
  const markReady = flagBool(args, "mark-ready")
  const apply = flagBool(args, "apply")
  const submission = await loadSubmission(supabase, submissionId)

  const researchedPayload = payloadFile
    ? await loadPayload(payloadFile)
    : {
        ...(submission.researched_payload ?? {}),
        ...buildResearchPayloadDraft(submission),
      }

  const dryRun = dryRunResearchedPayload({
    submission,
    researchedPayload,
    markReady,
  })

  printJson(dryRun)

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to save the payload/status.")
    return
  }

  const saved = await saveResearchedPayload({
    supabase,
    submission,
    researchedPayload,
    markReady,
  })

  console.log(`Saved researched payload. New status: ${saved.next_status}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
