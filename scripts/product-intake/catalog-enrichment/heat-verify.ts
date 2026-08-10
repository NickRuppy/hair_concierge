import {
  assertHeatBatchSelection,
  heatProjectIdFromUrl,
  parseHeatApplyArgs,
  preflightHeat,
  verifyHeatRelations,
} from "@/lib/product-intake/catalog-enrichment/heat"
import { heatClientAdapters, heatGitState } from "./heat-client"

async function main() {
  const argv = process.argv.slice(2)
  assertHeatBatchSelection(argv)
  const args = parseHeatApplyArgs(argv)
  if (!args.reviewed_head || args.expect_migration !== "applied")
    throw new Error("Heat verify requires --reviewed-head <40-char-sha> --expect-migration=applied")
  const adapters = heatClientAdapters()
  const preflight = await preflightHeat({
    read: adapters.read,
    mode: "post_apply",
    release: {
      reviewedHead: args.reviewed_head,
      projectId: heatProjectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ?? "",
      expectMigration: "applied",
    },
    gitState: heatGitState,
  })
  if (!preflight.ok || !preflight.package)
    throw new Error(`Heat verifier preflight blocked: ${preflight.blockers.join("; ")}`)
  const result = await verifyHeatRelations(adapters.read, preflight.package)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main()
