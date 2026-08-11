import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  buildStage5ProtocolApplyBatch,
  parseStage5ProtocolApplyArgs,
  preflightStage5ProtocolApplyBatch,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocols"
import { loadProtocolResearchManifestFile } from "./stage5-protocol-research"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

export async function loadStage5ProtocolBatch(batchId: string) {
  const file = resolve(
    process.cwd(),
    "data/catalog-enrichment/personal-plan-stage5-v1/protocol-research",
    `${batchId}.json`,
  )
  const manifest = await loadProtocolResearchManifestFile(file)
  if (manifest.batch_id !== batchId) throw new Error("Stage 5 batch filename/header mismatch")
  return buildStage5ProtocolApplyBatch(manifest)
}

async function main() {
  const args = parseStage5ProtocolApplyArgs(process.argv.slice(2))
  const built = await loadStage5ProtocolBatch(args.batchId)
  const result = await preflightStage5ProtocolApplyBatch(built, stage5ProtocolClientAdapters().read)
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", ...result }, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
