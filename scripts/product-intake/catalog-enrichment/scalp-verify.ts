import {
  assertScalpBatchSelection,
  parseScalpApplyArgs,
  preflightScalp,
  scalpProjectIdFromUrl,
  verifyScalpRelations,
} from "@/lib/product-intake/catalog-enrichment/scalp"
import { scalpClientAdapters, scalpGitState } from "./scalp-client"

async function main() {
  const argv = process.argv.slice(2)
  assertScalpBatchSelection(argv)
  const args = parseScalpApplyArgs(argv)
  if (!args.reviewed_head || args.expect_scalp_migration !== "applied")
    throw new Error(
      "Scalp verify requires --reviewed-head <40-char-sha> --expect-scalp-migration=applied",
    )
  const adapters = scalpClientAdapters()
  const preflight = await preflightScalp({
    read: adapters.read,
    mode: "post_apply",
    release: {
      reviewedHead: args.reviewed_head,
      projectId: scalpProjectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ?? "",
      expectScalpMigration: "applied",
    },
    gitState: scalpGitState,
  })
  if (!preflight.ok || !preflight.package)
    throw new Error(`Scalp verifier preflight blocked: ${preflight.blockers.join("; ")}`)
  const result = await verifyScalpRelations(adapters.read, preflight.package)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main()
