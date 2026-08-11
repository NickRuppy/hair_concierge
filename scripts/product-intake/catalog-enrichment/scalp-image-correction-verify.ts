import {
  parseScalpImageCorrectionArgs,
  preflightScalpImageCorrection,
  verifyScalpImageCorrection,
} from "@/lib/product-intake/catalog-enrichment/scalp-image-correction"
import {
  scalpImageCorrectionAdapters,
  scalpImageCorrectionGitState,
} from "./scalp-image-correction-client"

async function main() {
  const args = parseScalpImageCorrectionArgs(process.argv.slice(2))
  if (!args.reviewed_head || args.expect_migration !== "applied")
    throw new Error(
      "Scalp image correction verify requires --reviewed-head=<40-char-sha> --expect-migration=applied",
    )
  const adapters = scalpImageCorrectionAdapters()
  const preflight = await preflightScalpImageCorrection({
    read: adapters.read,
    release: {
      reviewedHead: args.reviewed_head,
      projectId:
        process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ??
        "",
      expectMigration: "applied",
    },
    gitState: scalpImageCorrectionGitState,
    mode: "post_apply",
  })
  if (!preflight.ok)
    throw new Error(
      `Scalp image correction verifier preflight blocked: ${preflight.blockers.join("; ")}`,
    )
  const result = await verifyScalpImageCorrection(adapters.read)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
