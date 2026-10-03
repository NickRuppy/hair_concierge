// Read-only review-artifact check, not a classifier, runtime schema or browser test.
// Owns the current English review's source closure and approved application facts.
// Frozen-history verification cannot catch edits to this subsequent display overlay.
// No production imports, writes, network, fixtures generated from a renderer, or seams.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const base = "plans/bondbuilder-research-engine/lab-preview/";
const snapshot = JSON.parse(read(base + "snapshot.json"));
const review = JSON.parse(read(base + "review-values.en.json"));
const issues = [];
const check = (condition, reason) => { if (!condition) issues.push(reason); };

new Script(read(base + "index.html").match(/<script>([\s\S]*?)<\/script>/)[1]);
check(review.locale === "en" && review.status === "review_proposal_not_persisted", "review-only English status");
check(snapshot.catalogConnected === false, "no catalog connection");
check(review.products.length === 8 && new Set(review.products.map((p) => p.id)).size === 8, "eight unique review identities");
const sourceList = [...snapshot.sources, ...review.followupSources];
const sources = new Set(sourceList.map((s) => s.id));
check(sources.size === sourceList.length, "unique source IDs");
for (const p of review.products) {
  const original = snapshot.products.find((s) => s.id === p.id);
  check(Boolean(original), p.id + ": matching original identity");
  for (const id of [...(original?.sources ?? []), ...(p.additionalSources ?? [])]) check(sources.has(id), p.id + ": unresolved source " + id);
  for (const fact of [p.protocolProposal, p.cadenceProposal, p.physicalFormatProposal, p.manufacturerFit].filter(Boolean)) check(sources.has(fact.source_id), p.id + ": unresolved fact source " + fact.source_id);
  check(!Object.hasOwn(p.databaseValues, "bond_repair_intensity"), p.id + ": intensity is not a new research property");
}
const product = (id) => review.products.find((p) => p.id === id);
const k18 = product("P02").protocolProposal;
check(k18.conditioner.before === "prohibited" && k18.conditioner.after === "optional" && k18.conditioner.minimum_wait_seconds === 240, "K18: no conditioner before, optional only after full four-minute wait");
const epres = product("P03").protocolProposal;
check(epres.dilution.finished_volume_ml === 150 && epres.contactTime.kind === "minimum_seconds" && epres.contactTime.minimumSeconds === 600 && epres.overnight_allowed === true, "epres: finished dilution, minimum time and optional overnight");
const aveda = product("P07").cadenceProposal;
check(aveda.status === "source_stated_conditional" && aveda.value.overlapping_damage_labels === true && aveda.value.universal_default === null, "Aveda: conditional overlapping cadence without universal default");
const ogx = product("P06").protocolProposal;
check(ogx.amount.value === "small_amount" && ogx.applicationArea === "ends_upward_even_distribution" && ogx.source_market === "UK", "OGX: sourced amount/distribution with UK applicability");
check(JSON.stringify(review.products.filter((p) => p.cadenceProposal.value === null).map((p) => p.id).sort()) === JSON.stringify(["P04", "P05", "P08"]), "three explicitly unknown local cadences");
check(review.newSubmissionPolicy.claim_trust_level === "low" && review.newSubmissionPolicy.trust_basis === "owner_default" && review.newSubmissionPolicy.is_chaarlie_recommended === false, "owner default, not automatic promotion");

const draft = "docs/research/bondbuilder-inci/draft-v0.5/";
const files = ["docs/research/README.md", ".agents/skills/product-research-engine/SKILL.md", ...readdirSync(resolve(root, draft)).filter((f) => f.endsWith(".md")).map((f) => draft + f), "docs/research/bondbuilder-inci/README.md", ...["validation-integration-handoff-2026-10-01.md", "application-followup-2026-10-01.md", "plan.md", "phase-1-rulings.md", "method-consolidation-2026-09-30.md"].map((f) => "plans/bondbuilder-research-engine/" + f)];
let links = 0;
for (const file of files) {
  for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    links += 1;
    check(existsSync(resolve(root, dirname(file), target)), file + ": missing local link " + target);
  }
}
check(!/olaplex|k18|epres|elvital|redken|kérastase|kerastase|ogx|aveda|abbey/i.test(read(draft + "blind-instructions.md")), "no named pilot data in blind guide");
console.log(JSON.stringify({ scope: "review_artifact_consistency_only", review_rows: review.products.length, files_checked: files.length, links_checked: links, issues, classification_run: false, production_write: false }, null, 2));
if (issues.length) process.exitCode = 1;
