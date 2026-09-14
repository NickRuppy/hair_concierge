import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  STAGE5_V2_ARTIFACT_PATH,
  STAGE5_V2_POINTER_DELTA_DEFAULT_FILE,
  buildStage5V2PointerDelta,
  preflightStage5V2PointerDelta,
} from "@/lib/product-intake/catalog-enrichment/stage5-v2-pointer-delta"
import { loadLocalEnv, printJson } from "../cli"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

/** Read-only. Classifies each reviewed delta item against the live catalog. */
function deltaPath(argv: readonly string[]) {
  return (
    argv.find((argument) => argument.startsWith("--file="))?.slice("--file=".length) ??
    STAGE5_V2_POINTER_DELTA_DEFAULT_FILE
  )
}

async function main() {
  loadLocalEnv()
  const file = deltaPath(process.argv.slice(2))
  const built = buildStage5V2PointerDelta({
    delta: JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")),
    artifactText: readFileSync(resolve(process.cwd(), STAGE5_V2_ARTIFACT_PATH), "utf8"),
  })
  const result = await preflightStage5V2PointerDelta({
    built,
    read: stage5ProtocolClientAdapters().read,
  })
  printJson({ mode: "read-only", file, ...result })
  process.exitCode = result.ok ? 0 : 1
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
