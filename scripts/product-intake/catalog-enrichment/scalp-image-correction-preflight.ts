import {
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
      "Scalp image correction preflight requires --reviewed-head=<40-char-sha> --expect-migration=absent|applied",
    )
  const result = await preflightScalpImageCorrection({
    read: scalpImageCorrectionAdapters().read,
    release: {
      reviewedHead: args.reviewed_head,
      projectId:
        process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ??
        "",
      expectMigration: args.expect_migration,
    },
    gitState: scalpImageCorrectionGitState,
  })
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", ...result }, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
