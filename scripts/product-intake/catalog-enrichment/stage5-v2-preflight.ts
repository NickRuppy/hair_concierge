import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { preflightStage5V2ApplicationArtifact } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

async function main() {
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
