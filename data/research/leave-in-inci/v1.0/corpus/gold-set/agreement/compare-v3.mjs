// Field-level agreement diff between reference-key and blind-review lanes.
// Values only (confidence compared separately); evidence prose is adjudication reading, not diffable.
import { readFileSync, writeFileSync } from "node:fs";

const ref = JSON.parse(readFileSync(new URL("../reference-key-v3/reference-key.json", import.meta.url)));
const blind = JSON.parse(readFileSync(new URL("../blind-v3/blind-review.json", import.meta.url)));

const bySlot = (records) => Object.fromEntries(records.map((r) => [r.slot, r]));
const R = bySlot(ref.products);
const B = bySlot(blind.products);

const val = (x) => {
  if (x == null) return null;
  if (typeof x !== "object") return x;
  return x.value ?? x.v ?? x.state ?? null;
};
const conf = (x) => (x && typeof x === "object" ? x.confidence ?? x.conf ?? null : null);

const DIMS = ["FORM", "COND", "SLIP", "SFR", "WT", "PERS", "HOLD", "HEAT", "HUM", "R2", "DOSE", "EXPO", "ROLE"];

const REF_DIM_NAMES = {FORM:"product_form_architecture",COND:"conditioning_potential",SLIP:"slip_combability_potential",SFR:"ambient_smoothing_alignment_potential",WT:"weight_residue_potential",PERS:"persistence_removal_class",HOLD:"hold_route_state",HEAT:"heat_protection_evidence_state",HUM:"humidity_resistance_evidence_state",R2:"repair_surface_film",DOSE:"dose_sensitivity",EXPO:"fragrance_scalp_exposure",ROLE:"usage_role"};
const refDim = (r, d) => r.dimensions?.[d] ?? r.dimensions?.[REF_DIM_NAMES[d]];
const rows = [];
const push = (slot, field, a, b) => {
  const same = JSON.stringify(a) === JSON.stringify(b);
  rows.push({ slot, field, ref: a, blind: b, agree: same });
};

for (const slot of Object.keys(R).map(Number).sort((a, b) => a - b)) {
  const r = R[slot];
  const b = B[slot];
  if (!b) { rows.push({ slot, field: "_missing_blind", ref: "present", blind: null, agree: false }); continue; }
  push(slot, "g0", val(r.g0_state ?? r.g0), val(b.g0));
  const rEx = String(val(r.g0_state ?? r.g0)).startsWith("excluded");
  const bEx = String(val(b.g0)).startsWith("excluded");
  // When either lane excluded at G0, downstream fields are intentionally absent/informational:
  // the only substantive disagreement is g0 itself.
  if (rEx || bEx) continue;
  const sorted = (a) => (Array.isArray(a) ? [...a].sort() : a);
  for (const d of DIMS) push(slot, `dim.${d}`, sorted(val(refDim(r, d))), sorted(val(b.dimensions?.[d])));
  push(slot, "care_direction", val(r.care_direction), val(b.care_direction));
  const rp = r.profile ?? {};
  const bp = b.lean_profile ?? b.matching_profile ?? {};
  {
    for (const f of ["product_form", "conditioning_level", "weight_potential", "persistence", "hold_support", "scalp_application_fit"])
      push(slot, `profile.${f}`, val(rp[f]) ?? rp[f] ?? null, val(bp[f]) ?? bp[f] ?? null);
    push(slot, "profile.usage_role", sorted(val(rp.usage_role) ?? rp.usage_role ?? null), sorted(val(bp.usage_role) ?? bp.usage_role ?? null));
    push(slot, "focus.primary", rp.focus?.primary ?? val(rp.focus?.primary), bp.focus?.primary ?? val(bp.focus?.primary));
    push(slot, "focus.secondary", sorted(rp.focus?.secondary ?? []), sorted(bp.focus?.secondary ?? []));
    push(slot, "heat.binary", rp.specialist_functions?.provides_heat_protection, bp.specialist_functions?.provides_heat_protection);
    push(slot, "humidity", val(rp.specialist_functions?.humidity_resistance) ?? rp.specialist_functions?.humidity_resistance, val(bp.specialist_functions?.humidity_resistance) ?? bp.specialist_functions?.humidity_resistance);
    const META = new Set(["df", "note", "notes", "derived_from"]);
    for (const grp of ["hair_thickness_fit", "damage_fit", "texture_fit"]) {
      const rg = rp[grp] ?? {}, bg = bp[grp] ?? {};
      for (const k of new Set([...Object.keys(rg), ...Object.keys(bg)])) {
        if (META.has(k)) continue;
        push(slot, `${grp}.${k}`, val(rg[k]) ?? rg[k] ?? null, val(bg[k]) ?? bg[k] ?? null);
      }
    }
  }
  // confidence deltas on scored dims (informational)
  for (const d of DIMS) {
    const rc = conf(refDim(r, d)), bc = conf(b.dimensions?.[d]);
    if (rc && bc && rc !== bc) rows.push({ slot, field: `conf.${d}`, ref: rc, blind: bc, agree: false, confOnly: true });
  }
}

const substantive = rows.filter((r) => !r.confOnly);
const disagreements = substantive.filter((r) => !r.agree);
const stats = {
  compared_fields: substantive.length,
  agreements: substantive.length - disagreements.length,
  disagreements: disagreements.length,
  agreement_rate: ((substantive.length - disagreements.length) / substantive.length * 100).toFixed(1) + "%",
  by_slot: {},
  by_field: {},
};
for (const d of disagreements) {
  stats.by_slot[d.slot] = (stats.by_slot[d.slot] ?? 0) + 1;
  const f = d.field.replace(/\.(fine|medium|coarse|healthy|moderately_damaged|highly_damaged|straight|wavy|curly|coily)$/, ".*");
  stats.by_field[f] = (stats.by_field[f] ?? 0) + 1;
}

writeFileSync(new URL("./agreement-diff-v3.json", import.meta.url), JSON.stringify({ stats, disagreements, conf_deltas: rows.filter((r) => r.confOnly) }, null, 2));

let md = `# Agreement diff — reference key vs blind review (2026-09-03)\n\nCompared ${stats.compared_fields} value fields · ${stats.agreements} agree · **${stats.disagreements} disagree** (${stats.agreement_rate} agreement)\n\n| Slot | Field | Reference | Blind |\n|---|---|---|---|\n`;
for (const d of disagreements) md += `| ${d.slot} | ${d.field} | \`${JSON.stringify(d.ref)}\` | \`${JSON.stringify(d.blind)}\` |\n`;
md += `\nDisagreements by slot: ${JSON.stringify(stats.by_slot)}\nBy field: ${JSON.stringify(stats.by_field, null, 1)}\n`;
writeFileSync(new URL("./agreement-diff-v3.md", import.meta.url), md);
console.log(JSON.stringify(stats, null, 2));
