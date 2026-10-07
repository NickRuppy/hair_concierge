import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { preflightStage5V2ApplicationArtifact } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

/**
 * The write lane this preflight belonged to is RETIRED (see `stage5-v2-apply.ts`):
 * the frozen artifact no longer covers the live catalog, so this report cannot go
 * green and is kept only as the historical record of the 2026-08-12 registry.
 *
 * For an actionable pointer check use the delta lane and the coverage audit:
 *   npm run products:intake:stage5-v2-pointer-delta:preflight
 *   npm run personal-plan:pointer-coverage-audit
 */
const RETIREMENT_BANNER = [
  "NOTE: the full-registry Stage 5 V2 apply is RETIRED; this report is read-only history.",
  "Actionable lanes: products:intake:stage5-v2-pointer-delta:preflight,",
  "personal-plan:pointer-coverage-audit.",
].join(" ")

async function main() {
  console.error(RETIREMENT_BANNER)
  const artifactPath = resolve(
    process.cwd(),
    "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
  )
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"))
  const result = await preflightStage5V2ApplicationArtifact(
    artifact,
    stage5ProtocolClientAdapters().read,
  )
  process.stdout.write(`${JSON.stringify({ mode: "read-only", ...result }, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}

void main()
