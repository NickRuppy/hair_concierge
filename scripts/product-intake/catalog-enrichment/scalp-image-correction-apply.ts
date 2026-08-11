import { readFile } from "node:fs/promises"

import {
  SCALP_IMAGE_CORRECTION,
  applyScalpImageCorrection,
  parseScalpImageCorrectionArgs,
  preflightScalpImageCorrection,
} from "@/lib/product-intake/catalog-enrichment/scalp-image-correction"
import {
  scalpImageCorrectionAdapters,
  scalpImageCorrectionGitState,
} from "./scalp-image-correction-client"

async function main() {
  const args = parseScalpImageCorrectionArgs(process.argv.slice(2))
  if (!args.reviewed_head || !args.expect_migration)
    throw new Error(
      "Scalp image correction apply requires --reviewed-head=<40-char-sha> --expect-migration=applied",
    )
  const adapters = scalpImageCorrectionAdapters()
  const preflightInput = {
    read: adapters.read,
    release: {
      reviewedHead: args.reviewed_head,
      projectId:
        process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ??
        "",
      expectMigration: args.expect_migration,
    },
    gitState: scalpImageCorrectionGitState,
    mode: args.apply ? ("apply" as const) : ("pre_apply" as const),
  }
  const preflight = await preflightScalpImageCorrection(preflightInput)
  if (!args.apply) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", preflight }, null, 2)}\n`)
    process.exitCode = preflight.ok ? 0 : 1
    return
  }
  const result = await applyScalpImageCorrection({
    args,
    preflight,
    preflightInput,
    image: {
      bytes: new Uint8Array(await readFile(SCALP_IMAGE_CORRECTION.new_asset.local_asset_path)),
    },
    write: adapters.write,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
