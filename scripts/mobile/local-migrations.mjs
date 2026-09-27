import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

const schemaChange = /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE)\s/im

function replaceBlocks(sql, markers, replacement, message) {
  for (const marker of markers) {
    const block = new RegExp("DO \\$" + marker + "\\$[\\s\\S]*?\\$" + marker + "\\$;")
    if (!block.test(sql)) throw new Error(message)
    sql = sql.replace(block, replacement)
  }
  return sql
}

// Repository migrations as replayed on a fresh local database: the untracked legacy
// baseline is added and reviewed historical catalog DML (absent curated rows) is
// omitted. Schema/function changes are always retained. Returns files in apply order.
export function localReplayMigrations(root) {
  const dir = resolve(root, "supabase/migrations")
  const files = new Map(
    readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [file, readFileSync(resolve(dir, file), "utf8")]),
  )
  files.set(
    "00002_local_legacy_baseline.sql",
    readFileSync(resolve(root, "scripts/mobile/legacy-local-baseline.sql"), "utf8"),
  )
  files.set(
    "00003_local_legacy_rls.sql",
    readFileSync(resolve(root, "scripts/mobile/legacy-local-rls.sql"), "utf8"),
  )
  // Historical data corrections depend on curated rows absent from repository seeds.
  // Keep their version visible while omitting only reviewed DML in this local stack.
  for (const file of [
    "20260609204000_hai_124_product_metadata_corrections.sql",
    "20260810203501_personal_plan_mask_catalog_identity_corrections.sql",
    "20260814121000_personal_plan_leave_in_use_case_coverage.sql",
    "20260817121500_shampoo_coarse_oily_monday_coverage.sql",
    "20260901090000_k18_molecular_repair_hair_mist_readiness.sql",
    "20260901160000_personal_plan_stage5_v2_oil_authority_reconciliation.sql",
  ]) {
    if (schemaChange.test(files.get(file)))
      throw new Error("Excluded historical data migration now contains schema changes: " + file)
    files.set(
      file,
      "-- Local only: historical catalog DML omitted; absent curated source rows.\nSELECT 1;\n",
    )
  }
  const closure = "20260813085151_personal_plan_catalog_closure.sql"
  const retirement = /DO \$retire_no0\$[\s\S]*?\$retire_no0\$;/
  const retirementSQL = files.get(closure).match(retirement)?.[0]
  if (!retirementSQL || schemaChange.test(retirementSQL))
    throw new Error("Historical catalog retirement block changed")
  files.set(
    closure,
    files
      .get(closure)
      .replace(
        retirement,
        "-- Local only: omitted absent OLAPLEX retirement DML; ALL schema/functions below retained.",
      ),
  )
  // Keep the third block: it changes the executor function definition.
  const reconciliation =
    "20260814191843_20260814122000_personal_plan_stage5_v2_authority_reconciliation.sql"
  files.set(
    reconciliation,
    replaceBlocks(
      files.get(reconciliation),
      ["reconcile_reviewed_v1_authority", "reconcile_reviewed_family_authority"],
      "-- Local only: absent reviewed catalog data omitted.",
      "Historical reconciliation block changed",
    ),
  )
  const convergence = "20260816180000_catalog_authority_retire_legacy_sync_and_validate.sql"
  files.set(
    convergence,
    replaceBlocks(
      files.get(convergence),
      ["neqi"],
      "-- Local only: absent Neqi projection DML omitted; schema validations retained.",
      "Historical Neqi data block changed",
    ),
  )
  const oil = "20260903083832_simplify_oil_heat_capability.sql"
  files.set(
    oil,
    replaceBlocks(
      files.get(oil),
      ["preflight", "postflight"],
      "-- Local only: absent exact Oil catalog cohort check omitted.",
      "Historical Oil data guard changed",
    ),
  )
  return [...files.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([file, sql]) => ({ file, sql }))
}
