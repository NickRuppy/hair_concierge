import {
  assertScalpBatchSelection,
  preflightScalp,
  scalpProjectIdFromUrl,
  parseScalpApplyArgs,
} from "@/lib/product-intake/catalog-enrichment/scalp"
import { scalpClientAdapters, scalpGitState } from "./scalp-client"

async function main() {
  const argv = process.argv.slice(2)
  assertScalpBatchSelection(argv)
  const args = parseScalpApplyArgs(argv)
  if (!args.reviewed_head || !args.expect_scalp_migration)
    throw new Error(
      "Scalp preflight requires --reviewed-head <40-char-sha> --expect-scalp-migration=absent|applied",
    )
  const result = await preflightScalp({
    read: scalpClientAdapters().read,
    release: {
      reviewedHead: args.reviewed_head,
      projectId: scalpProjectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ?? "",
      expectScalpMigration: args.expect_scalp_migration,
    },
    gitState: scalpGitState,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main()
