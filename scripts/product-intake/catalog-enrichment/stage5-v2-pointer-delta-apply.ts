import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { promisify } from "node:util"

import { isStage5V2ProductionWriteAuthorized } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import {
  STAGE5_V2_ARTIFACT_PATH,
  STAGE5_V2_POINTER_DELTA_DEFAULT_FILE,
  buildStage5V2PointerDelta,
  parseStage5V2PointerDeltaApplyArgs,
  preflightStage5V2PointerDelta,
} from "@/lib/product-intake/catalog-enrichment/stage5-v2-pointer-delta"
import { loadLocalEnv, printJson } from "../cli"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

/**
 * Guarded pointer-delta apply. Without `--apply` this is a dry run that writes
 * nothing. With `--apply` every guard must hold: the explicit production env
 * gate, the exact project, the caller-supplied fingerprint, and an exact clean
 * reviewed head — the same posture the retired `stage5-v2-apply.ts` had, applied
 * to a one-item reviewed list instead of the whole registry.
 */

async function gitState() {
  const [head, status] = await Promise.all([
    promisify(execFile)("git", ["rev-parse", "HEAD"]),
    promisify(execFile)("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: status.stdout.trim().length === 0 }
}

async function main() {
  loadLocalEnv()
  const argv = process.argv.slice(2)
  const args = parseStage5V2PointerDeltaApplyArgs(argv)
  const file =
    argv.find((argument) => argument.startsWith("--file="))?.slice("--file=".length) ??
    STAGE5_V2_POINTER_DELTA_DEFAULT_FILE

  const built = buildStage5V2PointerDelta({
    delta: JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")),
    artifactText: readFileSync(resolve(process.cwd(), STAGE5_V2_ARTIFACT_PATH), "utf8"),
  })
  const adapters = stage5ProtocolClientAdapters()
  const preflight = await preflightStage5V2PointerDelta({ built, read: adapters.read })

  if (!args.apply) {
    printJson({ mode: "dry-run", writes: false, file, ...preflight })
    process.exitCode = preflight.ok ? 0 : 1
    return
  }
  if (!preflight.ok) {
    throw new Error(`Stage 5 V2 pointer delta preflight blocked: ${preflight.blockers.join(",")}`)
  }
  if (!isStage5V2ProductionWriteAuthorized(process.env)) {
    throw new Error(
      "Stage 5 V2 pointer delta write requires ALLOW_PERSONAL_PLAN_STAGE5_V2_PRODUCTION_WRITE=1 and the production project URL",
    )
  }
  if (built.fingerprint !== args.expectedFingerprint) {
    throw new Error("Stage 5 V2 pointer delta fingerprint does not match the reviewed delta")
  }
  const state = await gitState()
  if (!state.clean || state.head !== args.reviewedHead) {
    throw new Error("Stage 5 V2 pointer delta apply requires the exact clean reviewed head")
  }

  const applyResult = await adapters.v2.applyPointerDelta(built.canonical_json, built.fingerprint)

  // Post-apply verification re-reads the live rows: the RPC's own return value is
  // not evidence that the pointer is now readable by the runtime adapter.
  const verification = await preflightStage5V2PointerDelta({ built, read: adapters.read })
  const unwritten = verification.items.filter((item) => item.status !== "already_applied")
  if (!verification.ok || unwritten.length > 0) {
    throw new Error(
      `Stage 5 V2 pointer delta post-apply verification failed: ${[
        ...verification.blockers,
        ...unwritten.map((item) => `${item.key}:${item.status}`),
      ].join(",")}`,
    )
  }

  printJson({
    mode: "applied",
    file,
    batch_id: built.delta.batch_id,
    fingerprint: built.fingerprint,
    preflight: preflight.observed,
    applyResult,
    verified: verification.observed,
  })
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
