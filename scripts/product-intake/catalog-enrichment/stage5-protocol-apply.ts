import { execFile } from "node:child_process"
import { promisify } from "node:util"

import {
  parseStage5ProtocolApplyArgs,
  preflightStage5ProtocolApplyBatch,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocols"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"
import { loadStage5ProtocolBatch } from "./stage5-protocol-preflight"

async function gitState() {
  const [head, status] = await Promise.all([
    promisify(execFile)("git", ["rev-parse", "HEAD"]),
    promisify(execFile)("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: status.stdout.trim().length === 0 }
}

async function main() {
  const args = parseStage5ProtocolApplyArgs(process.argv.slice(2))
  const built = await loadStage5ProtocolBatch(args.batchId)
  const adapters = stage5ProtocolClientAdapters()
  const preflight = await preflightStage5ProtocolApplyBatch(built, adapters.read)
  if (!args.apply) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", ...preflight }, null, 2)}\n`)
    process.exitCode = preflight.ok ? 0 : 1
    return
  }
  if (!preflight.ok) throw new Error(`Stage 5 preflight blocked: ${preflight.blockers.join(",")}`)
  if (built.fingerprint !== args.expectedFingerprint) {
    throw new Error("Stage 5 approved fingerprint does not match the reviewed batch")
  }
  const state = await gitState()
  if (!state.clean || state.head !== args.reviewedHead) {
    throw new Error("Stage 5 apply requires the exact clean reviewed head")
  }
  const rows = await adapters.apply(built.canonicalJson, built.fingerprint)
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "applied",
        batchId: args.batchId,
        fingerprint: built.fingerprint,
        rowCount: rows.length,
      },
      null,
      2,
    )}\n`,
  )
}

void main()
