import {
  assertHeatBatchSelection,
  heatProjectIdFromUrl,
  parseHeatApplyArgs,
  preflightHeat,
} from "@/lib/product-intake/catalog-enrichment/heat"
import { heatClientAdapters, heatGitState } from "./heat-client"

async function main() {
  const argv = process.argv.slice(2)
  assertHeatBatchSelection(argv)
  const args = parseHeatApplyArgs(argv)
  if (!args.reviewed_head || !args.expect_migration)
    throw new Error(
      "Heat preflight requires --reviewed-head <40-char-sha> --expect-migration=absent|applied",
    )
  const result = await preflightHeat({
    read: heatClientAdapters().read,
    release: {
      reviewedHead: args.reviewed_head,
      projectId: heatProjectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ?? "",
      expectMigration: args.expect_migration,
    },
    gitState: heatGitState,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main()
