// Reduces the read-only prod schema dump (capture/schema.sql output, extracted to
// JSON) to the closure the Slice 1 migration touches and writes
// fixtures/prod-schema-2026-10-11.json. Run once after a fresh capture:
//   node plans/catalog-completeness-fill/slice1/capture/build-schema-fixture.mjs <dump.json>
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const dump = JSON.parse(readFileSync(process.argv[2], "utf8"))

// Tables the migration writes or guards, created with their full constraint,
// index and trigger set. Everything their triggers' functions reference is
// pulled in transitively.
const CATALOG_TABLES = [
  "products",
  "product_categories",
  "product_leave_in_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_eligibility",
  "product_application_protocols",
  "product_identifiers",
  "product_relationships",
  "personal_plan_product_search_dispositions",
  "personal_plan_catalog_fact_evidence",
  "catalog_enrichment_applied_items",
  "product_mask_specs",
  "product_scalp_care_specs",
  "product_oil_specs",
  "product_oil_eligibility",
  "product_thickness_eligibility",
  "product_concern_eligibility",
  "product_bondbuilder_specs",
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  // F01 (Codex review): the shared rinse-off scalp template is retired / republished.
  "application_guidance_protocols",
]
// Member reference rows the Neqi recategorisation moves (F04): full columns,
// constraints and indexes, but only the triggers that fire on the columns the
// migration writes (category / the two link columns / updated_at). The
// research-job, mobile-delivery and user_products sync triggers fire only on
// INSERT or on status / approved_product_id / mobile_result_requested_at,
// which the migration never writes; generate.ts asserts that list.
const LINK_TABLES = {
  product_submissions: [
    "set_updated_at_product_submissions",
    "validate_product_submission_foundation",
    "validate_product_submission_status_link",
  ],
  user_product_usage: [
    "protect_user_product_usage_review_fields",
    "validate_user_product_usage_submission_link",
  ],
}
// Tables the migration only LOCKs / reads for reference proofs: columns only
// (their own triggers belong to other features and are never fired here).
const REFERENCE_TABLES = [
  "user_products",
  "personal_plan_product_drafts",
  "personal_plan_routine_versions",
  "personal_plan_routine_proposals",
  "personal_plan_portfolio_versions",
  "personal_plans",
  "personal_plan_refinement_drafts",
  "profiles",
]

const tables = new Map(dump.tables.map((t) => [t.name, t]))
const fns = new Map()
for (const f of dump.functions) {
  if (!fns.has(f.name)) fns.set(f.name, [])
  fns.get(f.name).push(f)
}
const triggerName = (def) => /^CREATE (?:CONSTRAINT )?TRIGGER (\S+)/.exec(def)[1]
const linkTable = (name) => {
  const t = tables.get(name)
  const allowed = new Set(LINK_TABLES[name])
  const triggers = (t.triggers ?? []).filter((def) => allowed.has(triggerName(def)))
  if (triggers.length !== allowed.size) throw new Error(`${name}: missing allowed trigger`)
  return { ...t, triggers }
}
const tableDef = (name) => (name in LINK_TABLES ? linkTable(name) : tables.get(name))

const T = new Set([...CATALOG_TABLES, ...Object.keys(LINK_TABLES)])
// Functions no trigger reaches but a later migration in the prerequisite chain
// rewrites (#660 step 2, 20261011120000_bondbuilder_retire_bond_repair_intensity):
// the rehearsal applies that real migration on top of the capture.
const CHAIN_FUNCTIONS = ["bondbuilder_write_spec_v1", "bondbuilder_research_enrich_v1"]
const F = new Set(CHAIN_FUNCTIONS)
// Chain functions are captured as-is (never called here), not traversed.
const queue = [...T].map((name) => ["t", name])
const ident = /[a-z_][a-z0-9_]*/g
while (queue.length) {
  const [kind, name] = queue.shift()
  let text
  if (kind === "t") {
    const t = tableDef(name)
    if (!t) throw new Error(`missing table ${name}`)
    text = [
      ...(t.triggers ?? []),
      ...(t.columns ?? []).map((c) => c.default ?? ""),
      ...(t.constraints ?? []).map((c) => c.def),
      ...(t.indexes ?? []),
    ].join("\n")
  } else {
    text = fns.get(name).map((f) => f.def).join("\n")
  }
  for (const word of new Set(text.toLowerCase().match(ident) ?? [])) {
    if (fns.has(word) && !F.has(word)) {
      F.add(word)
      queue.push(["f", word])
    }
    if (kind === "f" && tables.has(word) && !T.has(word) && !REFERENCE_TABLES.includes(word)) {
      T.add(word)
      queue.push(["t", word])
    }
  }
}

const fixture = {
  captured_at: dump.captured_at,
  source: "prod pqdkhefxsxkyeqelqegq read-only catalog query (capture/schema.sql)",
  server_version: dump.server_version,
  // The applied production migration ledger at capture time (prerequisite-chain proof).
  migrations: dump.migrations,
  tables: [...T].sort().map((name) => tableDef(name)),
  reference_tables: REFERENCE_TABLES.map((name) => ({
    name,
    columns: tables.get(name).columns,
  })),
  functions: [...F].sort().flatMap((name) => fns.get(name)),
  product_categories: dump.product_categories.map((c) => ({
    key: c.key,
    display_name_de: c.display_name_de,
    is_catalog_supported: c.is_catalog_supported,
    is_intake_supported: c.is_intake_supported,
    sort_order: c.sort_order,
  })),
}
writeFileSync(
  resolve(HERE, "../fixtures/prod-schema-2026-10-11.json"),
  `${JSON.stringify(fixture, null, 1)}\n`,
)
console.log({ tables: fixture.tables.length, functions: fixture.functions.length })
