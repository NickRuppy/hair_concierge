import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { promisify } from "node:util"

import {
  isStage5V2ProductionWriteAuthorized,
  parseStage5V2ApplicationApplyArgs,
  preflightStage5V2ApplicationArtifact,
  stage5V2ArtifactFingerprint,
  verifyStage5V2AppliedArtifact,
} from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import { loadLocalEnv } from "../cli"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

const ARTIFACT_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json"

async function gitState() {
  const [head, status] = await Promise.all([
    promisify(execFile)("git", ["rev-parse", "HEAD"]),
    promisify(execFile)("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: status.stdout.trim().length === 0 }
}

async function main() {
  loadLocalEnv()
  const args = parseStage5V2ApplicationApplyArgs(process.argv.slice(2))
  const artifactText = readFileSync(resolve(process.cwd(), ARTIFACT_PATH), "utf8")
  const artifact = JSON.parse(artifactText)
  const fingerprint = stage5V2ArtifactFingerprint(artifactText)
  const adapters = stage5ProtocolClientAdapters()
  const preflight = await preflightStage5V2ApplicationArtifact(artifact, adapters.read)

  if (!args.apply) {
    process.stdout.write(
      `${JSON.stringify({ mode: "dry-run", fingerprint, ...preflight }, null, 2)}\n`,
    )
    process.exitCode = preflight.ok ? 0 : 1
    return
  }
  if (!preflight.ok)
    throw new Error(`Stage 5 V2 preflight blocked: ${preflight.blockers.join(",")}`)
  if (!isStage5V2ProductionWriteAuthorized(process.env)) {
    throw new Error(
      "Stage 5 V2 production write requires ALLOW_PERSONAL_PLAN_STAGE5_V2_PRODUCTION_WRITE=1 and the production project URL",
    )
  }
  if (fingerprint !== args.expectedFingerprint) {
    throw new Error("Stage 5 V2 artifact fingerprint does not match the reviewed artifact")
  }
  const state = await gitState()
  if (!state.clean || state.head !== args.reviewedHead) {
    throw new Error("Stage 5 V2 apply requires the exact clean reviewed head")
  }

  const applyResult = await adapters.v2.apply(artifactText, fingerprint)
  const verification = await verifyStage5V2AppliedArtifact(artifact, adapters.v2)
  if (!verification.ok) {
    throw new Error(`Stage 5 V2 post-apply verification failed: ${verification.blockers.join(",")}`)
  }
  process.stdout.write(
    `${JSON.stringify(
      { mode: "applied", fingerprint, preflight: preflight.observed, applyResult, verification },
      null,
      2,
    )}\n`,
  )
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
