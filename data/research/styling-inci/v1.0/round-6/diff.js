#!/usr/bin/env node
'use strict';
// Round-4 method adapted for final r6: frozen 1:1 join, normalized field cells,
// field-specific evidence adjudication, same-product history, hold and coverage.
// No empirical count, agreement value, input classification, hash or verdict is
// hard-coded. Normative reference expectations and analyst interpretations are
// explicit below; they are not fabricated measured outputs or lane corrections.
// Usage: node data/research/styling-inci/v1.0/round-6/diff.js [--summary] [--dump]
// Writes ONLY sibling diff.json and report.md. Frozen inputs are never rewritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r6/results.json');
const B = read('blind-lane-B-r6/results.json');
const C = read('r6/cohort.json');
const C4 = read('r4/cohort.json');
const OLD = read('round-4/diff.json');
const A4 = read('blind-lane-A-r4/results.json');
const B4 = read('blind-lane-B-r4/results.json');
const R2 = read('round-2/diff.json');
const STANDARD = 'docs/research/styling-inci/v1.0/styling-classification-standard.md';
const LEDGER = 'plans/styling-concept/02-rulings.md';
const ADDENDUM = 'docs/research/leave-in-inci/v1.2/DRAFT-styling-border-addendum.md';
const text = v => v == null ? null : String(v).replace(/[“”„]/g, '"').replace(/\s+/g, ' ').trim();
const set = v => v == null ? null : [...new Set(v.map(x => typeof x === 'object' ? x.value : x))].sort();
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const eq = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const pct = (a, b) => b ? Math.round(a / b * 10000) / 100 : null;
const tally = (xs, key) => stable(xs.reduce((o, r) => { const k = typeof key === 'function' ? key(r) : r[key]; o[k] = (o[k] || 0) + 1; return o; }, {}));
const inciname = s => /^(fragrance|parfum)(\s*[/(].*)?$/i.test(text(s) || '') ? 'parfum' : text(s)?.toLowerCase() ?? null;
const marker = v => v == null ? null : { inci: inciname(v.inci), rank: v.rank ?? null, status: v.status ?? null };
const boundary = r => r.route === 'provisional_boundary' ? r.boundary_reason || r.reason_code || 'boundary_unnamed' : null;
const prof = r => r.route === 'styling' || boundary(r) === 'pending_leave_in_addendum';
const state = r => r.route === 'styling' ? 'committed' : boundary(r) === 'pending_leave_in_addendum' ? 'held' : r.route === 'provisional_boundary' ? `blocked:${boundary(r)}` : `route:${r.route}`;
const USER = ['route', 'subtype', 'hold_level', 'weight', 'finish', 'flexibility', 'target_zone', 'application_moment', 'primary_job', 'secondary_jobs', 'provides_heat_protection', 'heat_activated', 'alcohol_note', 'buildup_note', 'neutral_fact'];
const BASE_LOG = ['reason_code', 'rule_path', 'review_triggers', 'confidence', 'tail_T_S', 'tail_T_LI', 'ingredient_flags', 'd8b_flags', 'notes', 'identity_status', 'promise_class', 'result_mechanisms', 'hold_route'];
const handled = new Set([...USER, ...BASE_LOG, 'id', 'boundary_reason', 'confidence_internal', 'tail_markers']);
const EXTRA_LOG = [...new Set([...A.records, ...B.records].flatMap(r => Object.keys(r)))].filter(k => !handled.has(k)).sort();
const LOG = [...BASE_LOG, ...EXTRA_LOG];
const NORMALISATION = [
  'route is compared as {destination,boundary_reason}; boundary_reason is populated only for provisional_boundary. This retains evidence_gate, formula_conflict, mixed_promise, li_g0_provisional and pending_leave_in_addendum; committed and held are never folded together. Non-boundary pair/reason vocabulary remains calculation log.',
  'application_moment compares primary only: {primary,also[]} versus string. also[] is excluded as requested. provides_heat_protection compares the boolean value, not evidence wrappers; claim-only display is checked separately against captured C1/C2 heat claims.',
  'buildup/alcohol notes: {fired:false}, not_fired and does_not_fire -> does_not_fire; {fired:true}, fired and fires -> fires. null remains null.',
  'Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.',
  'neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.',
  'Empty secondary_jobs/d8b_flags collections and null are equivalent only when no Styling profile exists (§4.7). Only explicitly informational_and_non_authoritative historical properties are masked. Any unmarked forbidden value remains scoreable.',
  'confidence_internal is mapped to confidence; promise unknown/null -> not_assigned. Other lane-A-only fields are retained as schema-asymmetric calculation-log columns; missing is null. No user-facing disagreement is removed by adjudication.',
];
function normalize(r) {
  const o = {};
  for (const f of [...USER, ...LOG]) o[f] = r[f] ?? null;
  o.route = { destination: r.route, boundary_reason: boundary(r) };
  o.application_moment = r.application_moment && typeof r.application_moment === 'object' ? r.application_moment.primary ?? null : r.application_moment ?? null;
  o.provides_heat_protection = r.provides_heat_protection && typeof r.provides_heat_protection === 'object' ? r.provides_heat_protection.value ?? null : r.provides_heat_protection ?? null;
  for (const f of ['buildup_note', 'alcohol_note']) {
    let v = r[f];
    if (v && typeof v === 'object') v = 'fired' in v ? v.fired ? 'fires' : 'does_not_fire' : v.value;
    o[f] = v === 'fired' ? 'fires' : v === 'not_fired' ? 'does_not_fire' : v ?? null;
  }
  o.neutral_fact = text(r.neutral_fact)?.toLowerCase() ?? null;
  o.secondary_jobs = !prof(r) && !r.secondary_jobs?.length ? null : set(r.secondary_jobs);
  o.result_mechanisms = set(r.result_mechanisms);
  o.review_triggers = set(r.review_triggers);
  o.d8b_flags = !prof(r) && !r.d8b_flags?.length ? null : set(r.d8b_flags);
  o.confidence = r.confidence ?? r.confidence_internal ?? null;
  o.promise_class = r.promise_class == null || r.promise_class === 'unknown' ? 'not_assigned' : r.promise_class;
  o.tail_T_S = marker(r.tail_markers?.T_S);
  o.tail_T_LI = marker(r.tail_markers?.T_LI);
  if (r.ingredient_flags) {
    o.ingredient_flags = stable({ ...r.ingredient_flags, salt: r.ingredient_flags.salt === 'unknown' ? null : r.ingredient_flags.salt ?? null, fixative_family: set(r.ingredient_flags.fixative_family || []) });
  }
  if (r.informational_and_non_authoritative === true) {
    for (const f of USER.filter(f => !['route', 'subtype'].includes(f))) o[f] = null;
    o.result_mechanisms = o.hold_route = o.ingredient_flags = o.d8b_flags = null;
  }
  return o;
}
function mapRecords(lane, cohort, label) {
  const m = new Map(lane.records.map(r => [r.id, r]));
  const expected = new Set(cohort.records.map(r => r.sample_id));
  if (m.size !== lane.records.length || m.size !== expected.size || [...m.keys()].some(id => !expected.has(id))) throw Error(`${label}: duplicate/missing/extra IDs`);
  return m;
}
const am = mapRecords(A, C, 'A6'), bm = mapRecords(B, C, 'B6');
const a4m = mapRecords(A4, C4, 'A4'), b4m = mapRecords(B4, C4, 'B4');
const idm = new Map(C.id_map.map(r => [r.sample_id, r]));
const c4m = new Map(C4.records.map(r => [r.sample_id, r]));
if (idm.size !== C.records.length || new Set(C.records.map(r => r.source_slug)).size !== C.records.length) throw Error('cohort map is not bijective');
const packet = (kind, id) => read(`r6/packets/${kind}/${id}.json`);
const rows = C.records.map(c => {
  const m = idm.get(c.sample_id), old = c4m.get(m?.round4_sample_id);
  if (m?.source_slug !== c.source_slug || old?.source_slug !== c.source_slug) throw Error(`r4/r6 source_slug mapping broken: ${c.source_slug}`);
  const rawA = am.get(c.sample_id), rawB = bm.get(c.sample_id);
  return { id: c.sample_id, slug: c.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role, round4_id: m.round4_sample_id, rawA, rawB, A: normalize(rawA), B: normalize(rawB), oldA: normalize(a4m.get(m.round4_sample_id)), oldB: normalize(b4m.get(m.round4_sample_id)), s0: packet('s0', c.sample_id), claims: packet('claims', c.sample_id) };
}).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySlug = new Map(rows.map(r => [r.slug, r]));
const trace = (r, f) => ({ rule_path: r.rule_path ?? null, pair_rule: r.pair_rule ?? null, reason_code: r.reason_code ?? null, boundary_reason: r.boundary_reason ?? null, hold_basis: f === 'hold_level' ? r.hold_basis ?? null : null, notes: r.notes ?? null });
const source = (section, lines) => `${STANDARD}:${lines} (${section})`;
const jobRule = source('§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)', '716-719');
const strengthRule = source('§7.4', '804-823');
function decision(category, right_lane, rule, explanation, extra = {}) { return { classification: category, right_lane, rule, explanation, ...extra }; }
// Evidence-conditioned analyst rules. Values and affected records are always
// selected from actual disagreements and packets, never from preset counts.
function adjudicate(r, field) {
  const claims = r.claims.claims.filter(c => /^C[12]/.test(c.tier || ''));
  const t = claims.map(c => c.text).join(' | ');
  const name = r.s0.product.confirmed_name;
  if (field === 'route' && /Frizz Ease.*Smooth.*Salon Blow-Out/i.test(name)) return decision('d', null, source('§4.2 name job counting / slogan rule; §4.3 3.3', '415-430'), 'A treats Frizz Ease as a product-line prefix and Smooth as the sole sleek job, reaching Leave-in. B counts/skips the name differently and takes the first job-bearing C2 line, protection from heat and humidity, reaching Heat Protectant. The standard exempts Salon Blow-Out slogans and Nutri- from care ties, but never settles whether a functional line prefix such as Frizz Ease counts as a job.', { question: 'For John Frieda “Frizz Ease Unendlich Smooth Salon Blow-Out Spray”, does the range name Frizz Ease count as an anti-frizz job alongside Smooth, or should it be ignored as a range prefix?', recommendation: 'Count explicit job-bearing line wording consistently unless the standard expressly exempts that named range. Frizz Ease plus Smooth then gives two jobs; the protection-leading sentence routes Heat Protectant (B). Generic Styling-Spray alone is a form noun, not an independent coequal styling job. This proposed owner decision is not a proven B-correct lane error.', proposed_fix: 'Confirmed-name job counting includes functional words in a product-range prefix unless an explicit range exemption is listed; Frizz Ease states anti-frizz, Smooth states sleek, and Salon Blow-Out names no job. A dispensing/form noun such as Styling-Spray does not itself make a protection lead mixed.' });
  if (field === 'target_zone') {
    const d = r.s0.directions.text;
    if (/ansatz/i.test(d) && /Für mehr Textur.*Haarlängen/i.test(d)) return decision('b', null, source('§6.12 RG-9 / RG2-10 / RG3-20', '732'), 'Directions first prescribe roots, then a conditional lengths application for more texture. The first-named rule supports A roots; the concluding only-application-site sentence supports B all. Pair/range examples do not resolve a separate conditional use.', { proposed_fix: 'Required application across multiple sites, including sequential roots then whole hair, is all. A distinct optional or conditional use for a different effect does not widen the primary target zone: classify the primary instruction and record the alternative separately. First-named applies to independent alternatives, not a required multi-site sequence.', recommendation: 'Under this proposed clarification, A roots is the primary zone for this packet.' });
    if (/Schritt 1.*Ansatz.*Schritt 2.*gesamte Haar/s.test(d)) return decision('b', null, source('§6.12 RG-9 / RG2-10 / RG3-20', '732'), 'The main sequence applies first to roots and then to the whole hair. B all is the stronger reading, but §6.12 also expressly assigns roots to the first-named site. Its exception covers sites named together and ranges, not sequential steps; the final only-site sentence contradicts the opening first-named sentence. This is the same target-zone rule gap as the conditional Balea use, not a proven lane error.', { proposed_fix: 'Determine the zone across the main required application sequence. Roots followed by application across the whole hair is all. A separate conditional or optional use does not broaden the selected main-use zone. First-named applies to genuine alternative uses, not required sequential sites. Apply the only-site requirement within the selected main use.', recommendation: 'B all under the proposed clarification.' });
  }
  if (['primary_job', 'secondary_jobs'].includes(field) && /Sleek Stick Brows & Edges/i.test(name)) return decision('a', 'B', jobRule, '§6.10 explicitly reserves sleek for the whole style and maps baby-hair/flyaway taming to frizz_control. This is an edges/brows-only product. B primary frizz_control is correct; its only secondary is hold_fix. A uses forbidden local sleek as primary and consequently retains the true primary as a secondary.');
  if (field === 'secondary_jobs') {
    if (/natürlich definierten Look.*Strand/i.test(t)) return decision('b', null, `${jobRule}; ${LEDGER}:133 (R4-Q2)`, 'The beach name is unambiguously texture, but the later “natürlich definierten Look, wie frisch vom Strand” remains under-specified: an adjectival defined-look result can be read as a definition job or as a texture/look description. R4-Q2 settles Beach Waves, and §6.8 excludes it as a finish grade, but neither settles this secondary-job adjective.', { proposed_fix: 'In §6.10, definiert/definierende states definition only as an explicit promise to define or shape curls/waves. A generic adjectival result phrase such as “definierter Look” alone states no definition job.', recommendation: 'B empty secondary list under the proposed wording; retain the texture primary.' });
    if (/Lockenstylings mit Hot Tools/i.test(t)) return decision('a', 'A', jobRule, '“Lockenstylings mit Hot Tools” names a usage/look without a curl-shaping or setting verb. §6.10 RG2-5 requires that verb for definition. A retains hold_fix; B adds unsupported definition.');
    if (/Surfer-Styles/i.test(t)) return decision('a', 'A', `${jobRule}; ${LEDGER}:133 (R4-Q2)`, '“Surfer-Styles” is not an explicit texture job or a named Beach Waves/Strandwellen/beachy phrase. A empty list is correct; B extrapolates texture from a style association. The name/hold job already supplies the primary.');
    if (/Ideal für Sleek-Looks & Locken/i.test(t)) return decision('a', 'A', jobRule, 'Sleek-Looks explicitly supplies sleek. Bare “Locken” is an application target without the required shaping/setting verb; B incorrectly adds definition.');
    if (/statische Aufladung/i.test(t)) return decision('a', 'A', jobRule, 'The static-charge-control line is typed humidity and contains no explicit anti-frizz/flyaway job word. Humidity lines do not state jobs unless explicit anti-frizz wording is present; B adds frizz_control without it.');
    const aa = r.A.secondary_jobs || [], bb = r.B.secondary_jobs || [];
    const diff = [...new Set([...aa, ...bb])].filter(x => aa.includes(x) !== bb.includes(x));
    if (diff.length === 1 && diff[0] === 'hold_fix') {
      const hold = claims.filter(c => c.type === 'hold');
      const number = hold.some(c => c.number != null || /(?:Halt|Haltegrad|Haltestufe)\s*:?\s*\d/i.test(c.text));
      // Use claim evidence, never either lane's emitted level as the oracle.
      const strength = hold.some(c => /\b(?:leicht\w*|sanft\w*|soft|weich\w*|mittel\w*|normal\w*|stark\w*|strong|extra|ultra|mega|extrem\w*|maximal\w*|max|power|krass\w*)\b/i.test(c.words || c.text));
      const valid = number || strength;
      const right = aa.includes('hold_fix') === valid ? 'A' : 'B';
      return decision('a', right, `${jobRule}; ${strengthRule}`, valid ? 'A captured C1/C2 brand-number hold claim explicitly qualifies for the §6.10 hold_fix secondary and the formula gate passes. The lane omitting hold_fix is wrong.' : 'The captured hold text has no strength word or brand number: perceptible/natural hold, duration and flexibility are not hold-strength evidence (§7.4). No fixing verb supplies an alternative candidate. The lane adding hold_fix is wrong.', { evidence_hold_claims: hold.map(c => c.text) });
    }
  }
  throw Error(`Unadjudicated USER-FACING difference ${r.slug}::${field}`);
}
const discrepancies = [];
for (const r of rows) for (const f of USER) if (!eq(r.A[f], r.B[f])) discrepancies.push({ slug: r.slug, id: r.id, name: r.name, role: r.role, field: f, A: r.A[f], B: r.B[f], A_rule_path: trace(r.rawA, f), B_rule_path: trace(r.rawB, f), packet_evidence: { name: r.s0.product, directions: r.s0.directions, claims: r.claims.claims }, ...adjudicate(r, f) });
const calculationDifferences = [];
for (const r of rows) for (const f of LOG) if (!eq(r.A[f], r.B[f])) calculationDifferences.push({ slug: r.slug, id: r.id, name: r.name, field: f, A: r.A[f], B: r.B[f], blocks_lock: false });
function agreement(rs, fields) {
  const field_agreement = fields.map(field => {
    const agrees = rs.filter(r => eq(r.A[field], r.B[field])).length;
    const active = rs.filter(r => r.A[field] != null || r.B[field] != null);
    const emittedAgree = active.filter(r => eq(r.A[field], r.B[field])).length;
    return { field, records: rs.length, agree: agrees, disagree: rs.length - agrees, percent: pct(agrees, rs.length), emitted_by_either: active.length, agree_where_emitted: emittedAgree, percent_where_emitted: pct(emittedAgree, active.length) };
  });
  const cells = rs.length * fields.length, agrees = field_agreement.reduce((n, x) => n + x.agree, 0);
  const all = rs.filter(r => fields.every(f => eq(r.A[f], r.B[f])));
  return { fields: fields.length, records: rs.length, cells, agreeing_cells: agrees, percent_cells: pct(agrees, cells), products_fully_agreeing: all.length, percent_products: pct(all.length, rs.length), fully_agreeing_slugs: all.map(r => r.slug), field_agreement };
}
const userAgreement = agreement(rows, USER), logAgreement = agreement(rows, LOG);
const classified = Object.fromEntries(['a', 'b', 'c', 'd'].map(k => [k, discrepancies.filter(d => d.classification === k).length]));
const byRole = Object.fromEntries([...new Set(rows.map(r => r.role))].sort().map(role => [role, { records: rows.filter(r => r.role === role).length, user_facing: agreement(rows.filter(r => r.role === role), USER), calculation_log: agreement(rows.filter(r => r.role === role), LOG) }]));
const holdRows = rows.filter(r => r.rawA.hold_level != null || r.rawB.hold_level != null);
const holdMismatches = holdRows.filter(r => !eq(r.rawA.hold_level ?? null, r.rawB.hold_level ?? null)).map(r => ({ slug: r.slug, name: r.name, A: r.rawA.hold_level ?? null, B: r.rawB.hold_level ?? null, A_rule_path: trace(r.rawA, 'hold_level'), B_rule_path: trace(r.rawB, 'hold_level') }));
const hold = { products_where_either_emits_a_level: holdRows.length, identical: holdRows.length - holdMismatches.length, mismatches: holdMismatches.length, mismatch_list: holdMismatches, raw_unmasked_check: true };
const standardText = fs.readFileSync(path.join(REPO, STANDARD), 'utf8');
const subtypeTable = standardText.split('## 5. Subtype assignment')[1].split('## 6. Properties')[0];
const subtypes = [...new Set(subtypeTable.split('\n').map(line => line.split('|')[2]?.trim().match(/^`([a-z_]+)`$/)?.[1]).filter(Boolean))];
if (!subtypes.length) throw Error('No normative subtypes parsed');
const coverage = subtypes.map(subtype => {
  const commit = rows.filter(r => state(r.rawA) === 'committed' && state(r.rawB) === 'committed' && r.A.subtype === subtype && r.B.subtype === subtype);
  const held = rows.filter(r => state(r.rawA) === 'held' && state(r.rawB) === 'held' && r.A.subtype === subtype && r.B.subtype === subtype);
  const all = [...commit, ...held];
  return { subtype, committed_agreed: commit.length, held_agreed: held.length, total_agreed: all.length, meets_5_including_held: all.length >= 5, below_5_flag: all.length < 5, committed_slugs: commit.map(r => r.slug), held_slugs: held.map(r => r.slug), all_user_fields_agreeing: all.filter(r => USER.every(f => eq(r.A[f], r.B[f]))).length, round4_total_agreed: OLD.coverage_per_subtype_agreed.find(x => x.subtype === subtype)?.total_agreed ?? null };
});
const oldDiffs = [];
for (const r of rows) for (const f of [...USER, ...LOG]) if (!eq(r.oldA[f], r.oldB[f])) oldDiffs.push({ slug: r.slug, name: r.name, field: f, scope: USER.includes(f) ? 'user_facing' : 'calculation_log', A: r.oldA[f], B: r.oldB[f] });
const currentKey = new Set([...discrepancies, ...calculationDifferences].map(d => `${d.slug}::${d.field}`));
const oldKeys = new Set(oldDiffs.map(d => `${d.slug}::${d.field}`));
const historical = { method: 'R4 lane bytes are re-normalized with the same primary-only, boundary-aware r6 scorer; source_slug joins verified via r6 id_map.round4_sample_id and r4 cohort. Original r4 register entries are also preserved below, including its formerly supplementary secondary_jobs. Field persistence means same product+field, not necessarily same values or root cause.', gone: oldDiffs.filter(d => !currentKey.has(`${d.slug}::${d.field}`)), persisting: oldDiffs.filter(d => currentKey.has(`${d.slug}::${d.field}`)).map(d => ({ ...d, round6_A: bySlug.get(d.slug).A[d.field], round6_B: bySlug.get(d.slug).B[d.field] })), new_in_round6: [...discrepancies, ...calculationDifferences].filter(d => !oldKeys.has(`${d.slug}::${d.field}`)).map(d => ({ slug: d.slug, name: d.name, field: d.field, scope: USER.includes(d.field) ? 'user_facing' : 'calculation_log', A: d.A, B: d.B })), original_round4_register: OLD.disagreements.map(d => { const r = bySlug.get(d.slug); if (!r) throw Error(`missing historical product ${d.slug}`); const f = d.field === 'tail_markers' ? null : d.field; const persists = f ? !eq(r.A[f], r.B[f]) : !eq([r.A.tail_T_S, r.A.tail_T_LI], [r.B.tail_T_S, r.B.tail_T_LI]); return { slug: d.slug, name: r.name, field: d.field, round4_A: d.A, round4_B: d.B, round4_classification: d.classification, round4_cause: d.root_cause, status: persists ? 'persists' : 'gone', round6_A: f ? r.A[f] ?? null : [r.A.tail_T_S, r.A.tail_T_LI], round6_B: f ? r.B[f] ?? null : [r.B.tail_T_S, r.B.tail_T_LI], user_facing: USER.includes(d.field) }; }) };

// Expected reference values below are normative examples from the cited owner
// rulings, not empirical agreement constants. Both lane values are read afresh.
const CHECKS = [
  ['R4-Q1', 'american-crew-fiber', { route: 'styling', subtype: 'molding', primary_job: 'hold_fix' }],
  ['R4-Q1', 'kerastase-curl-manifesto-refresh-absolu', { route: 'leave_in' }],
  ['R4-Q1/P4-1', 'american-crew-pomade', { route: 'provisional_boundary', boundary_reason: 'evidence_gate' }],
  ['R4-Q1', 'langhaarmaedchen-lockenspray-halt-sprungkraft', { route: 'provisional_boundary', boundary_reason: 'evidence_gate' }],
  ['R4-Q1/P4-1', 'redken-styling-beach-spray', { route: 'provisional_boundary', boundary_reason: 'evidence_gate' }],
  ['R4-Q2', 'alverde-beach-waves-spray-seaside-balance', { route: 'styling', subtype: 'salt_spray', primary_job: 'texture' }],
  ['R4-Q2', 'syoss-glaze-topcoat', { route: 'styling', subtype: 'shine_finish', primary_job: 'shine' }],
  ['R4-Q2/RG4-4 (slogan context)', 'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray', { route: 'dry_shampoo' }],
  ['R4-Q3', 'aussie-leave-in-creme-work-that-curl', { route: 'leave_in' }],
  ['R4-Q3 (unchanged example)', 'redken-one-united-all-in-one-multi-benefit-treatment', { route: 'leave_in' }],
  ['R4-Q3 (unchanged example)', 'wella-eimi-smooth-perfect-me', { route: 'leave_in' }],
  ['R4-Q3 (unchanged example)', 'wella-eimi-nutricurls-fresh-up', { route: 'leave_in' }],
  ['R4-Q4', 'balea-glattspray-anti-frizz', { route: 'provisional_boundary', boundary_reason: 'pending_leave_in_addendum', subtype: 'smoothing_styler' }],
  ['R4-Q5', 'bali-curls-strong-hold-flaxseed-gel', { route: 'provisional_boundary', boundary_reason: 'pending_leave_in_addendum', subtype: 'gel' }],
  ['R4-Q5', 'kevin-murphy-killer-curls', { route: 'provisional_boundary', boundary_reason: 'pending_leave_in_addendum', subtype: 'curl_cream' }],
  ['R4-Q5', 'john-frieda-frizz-ease-traumlocken-lockencreme', { route: 'provisional_boundary', boundary_reason: 'pending_leave_in_addendum', subtype: 'curl_cream' }],
  ['R4-Q6', 'hask-lockencreme-curl-care', { route: 'leave_in' }],
  ['R4-Q6', 'loreal-men-expert-barber-club-styling-pomade', { route: 'styling', subtype: 'molding' }],
  ['R4-Q6', 'redken-wax-spray', { route: 'styling', subtype: 'texture_spray' }],
  ['R4-Q6', 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat', { route: 'styling', subtype: 'shine_finish' }],
  ['R4-Q6', 'balea-finishing-spray-glow-und-care', { route: 'styling', subtype: 'shine_finish' }],
  ['R4-Q6', 'john-frieda-traumlocken-belebender-wellenauffrischer', { route: 'provisional_boundary', boundary_reason: 'mixed_promise' }],
  ['R4-Q7', 'schwarzkopf-taft-gel-wax-glanz-halt-2', { route: 'styling', subtype: 'molding', primary_job: 'hold_fix', finish: 'glänzend' }],
  ['R4-Q7', 'got2b-styling-paste-istyler-texture-clay', { route: 'styling', subtype: 'molding', primary_job: 'hold_fix', secondary_jobs: ['texture'] }],
  ['R4-Q7 (compound qualifier)', 'balea-haarwachs-glow-wax', { route: 'styling', subtype: 'molding', primary_job: 'hold_fix' }],
  ['R4-H(4)/R4-Q1', 'bumble-and-bumble-brilliantine', { route: 'styling', subtype: 'shine_finish', primary_job: 'shine' }],
  ['R4-H(5)', 'balea-men-pomade-haar-bart-2in1', { primary_job: 'hold_fix', secondary_jobs: [] }],
];
const reference = (r, lane, f) => f === 'route' ? r[lane].route.destination : f === 'boundary_reason' ? r[lane].route.boundary_reason : r[lane][f];
const rulingEffects = CHECKS.map(([ruling, slug, expected]) => {
  const r = bySlug.get(slug); if (!r) throw Error(`Missing ruling example ${slug}`);
  const values = lane => Object.fromEntries(Object.keys(expected).map(f => [f, reference(r, lane, f)]));
  const av = values('A'), bv = values('B');
  return { ruling, slug, id: r.id, name: r.name, expected, A: av, B: bv, A_landed: eq(expected, av), B_landed: eq(expected, bv), A_rule_path: trace(r.rawA), B_rule_path: trace(r.rawB), remaining_user_disagreements: discrepancies.filter(d => d.slug === slug).map(d => d.field), source: `${LEDGER}:132-140; ${STANDARD} §4.1/4.2/4.6/6.10/13.4` };
});
// Discover all Wella scale cases from the actual claims, not a fixed product list.
const wellaChecks = rows.filter(r => /wella/i.test(r.s0.product.brand) && r.claims.claims.some(c => /^C[12]/.test(c.tier || '') && /Halte(?:grad|stufe)/i.test(c.text))).map(r => {
  const cs = r.claims.claims.filter(c => /^C[12]/.test(c.tier || '') && /Halte(?:grad|stufe)/i.test(c.text));
  const levels = cs.map(c => { const m = c.text.match(/Halte(?:grad|stufe)\s*:?\s*([1-4])(?:\+)?/i); const n = c.number ?? (m ? Number(m[1]) : null); if (n == null) throw Error(`Unreadable Wella scale ${r.slug}`); return n <= 2 ? 1 : n === 3 ? 3 : 4; }).sort((a, b) => a - b);
  const claimLevel = Math.ceil((levels[Math.floor((levels.length - 1) / 2)] + levels[Math.ceil((levels.length - 1) / 2)]) / 2);
  const applicable = prof(r.rawA) || prof(r.rawB);
  const expected = applicable ? claimLevel : null;
  return { ruling: 'R3-H5', slug: r.slug, id: r.id, name: r.name, captured_claims: cs, normalized_claim_level: claimLevel, applies_to_styling_profile: applicable, profile_state_A: state(r.rawA), profile_state_B: state(r.rawB), expected_hold_level: expected, A: r.A.hold_level, B: r.B.hold_level, A_landed: eq(expected, r.A.hold_level), B_landed: eq(expected, r.B.hold_level), scope_note: applicable ? 'Emitted Styling/held profile level must use R3-H5.' : 'No Styling profile: §4.7 withholds Styling hold_level. Captured scale can be normalized for audit, but cannot fabricate an emitted Styling value.', source: `${LEDGER}:123; ${STANDARD} §7.3/4.7` };
});
const taft = bySlug.get('schwarzkopf-taft-gel-wax-glanz-halt-2');
const housekeeping = [
  { ruling: 'R4-H(1)', status: 'text/schema check; outcome example HASK in ruling table', met: rows.every(r => !('registry_row' in r.s0) && !('registry_row' in r.claims)) && /no opaque.*registry_row/.test(standardText), evidence: 'No opaque registry_row introduced. HASK matches by brand + confirmed name in both lanes. This does not independently prove every registry-match mechanism.' },
  { ruling: 'R4-H(2)', status: 'internal flag present; not a user-facing lock field', met: [taft.rawA, taft.rawB].every(r => r.d8b_flags.some(f => /^claim_formula_conflict/.test(f))) && !USER.includes('d8b_flags'), slug: taft.slug, A: taft.A.d8b_flags, B: taft.B.d8b_flags, evidence: 'Annotation suffix differs in A, but both retain the internal conflict flag; user-facing molding/finish outcome is checked under R4-Q7.' },
  { ruling: 'R4-H(3)', status: 'operational confirmation; no isolated counterfactual', met: /first C1 line in packet order/.test(standardText), examples: rows.filter(r => ['wella-eimi-smooth-thermal-image', 'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray'].includes(r.slug)).map(r => ({ slug: r.slug, name: r.name, positions: r.s0.promise_claims_c1_c2.map(c => c.position), A: r.A.route, B: r.B.route, A_rule_path: trace(r.rawA), B_rule_path: trace(r.rawB) })), evidence: 'Unknown-position promise lines retain packet order. Both lanes use the first job-bearing sentence for these examples; registry/tie rules also contribute, so this is application evidence rather than proof of a uniquely H3-caused change.' },
  { ruling: 'R4-H(4)', status: 'product output checked in ruling table', met: rulingEffects.filter(r => r.ruling.startsWith('R4-H(4)')).every(r => r.A_landed && r.B_landed), evidence: 'Brilliantine primary shine in both; §11.8 C row still says jobs empty (latent editorial residue).' },
  { ruling: 'R4-H(5)', status: 'product output checked in ruling table', met: rulingEffects.filter(r => r.ruling === 'R4-H(5)').every(r => r.A_landed && r.B_landed), evidence: 'Balea MEN Pomade excludes definition from a typed hold entry in both lanes; §11.9 worked row still has definition (latent editorial residue).' },
];

// A's record notes are free prose; identify explicitly signposted ambiguities,
// not every occurrence of the legitimate hold_route value "ambiguous".
function latentFields(note) {
  if (/name alone.*jobs empty/i.test(note)) return ['primary_job', 'secondary_jobs'];
  if (/user-facing secondary_jobs/i.test(note)) return ['secondary_jobs'];
  if (/user-facing route|name.*one shine job|co-equal.*mixed_promise|mixed_promise.*§4\.2/i.test(note)) return ['route'];
  if (/user-facing primary_job/i.test(note)) return ['primary_job', 'secondary_jobs'];
  if (/could be read as all|lengths \(ambiguous/i.test(note)) return ['target_zone'];
  if (/first sentence frames|Not second_day/i.test(note)) return ['application_moment'];
  if (/flexib.*ambiguous|flex.*feel phrase/i.test(note)) return ['flexibility'];
  if (/words-only row.*both give/i.test(note)) return ['hold_level'];
  if (/primary would be shine|Primary from the name/i.test(note)) return ['primary_job'];
  return ['secondary_jobs'];
}
const latent = [], reported = [];
for (const r of rows) {
  const note = typeof r.rawA.notes === 'string' ? r.rawA.notes : (r.rawA.notes || []).join(' | ');
  const ambiguityText = note.replace(/hold_route\s+ambiguous\b/gi, 'hold_route_unresolved');
  if (!/\bambiguity\b|\bambiguous\b/i.test(ambiguityText)) continue;
  const fields = latentFields(note);
  const differing = fields.filter(f => !eq(r.A[f], r.B[f]));
  reported.push({ lane: 'A', slug: r.slug, name: r.name, fields, report: note, caused_disagreement_in_reported_fields: differing });
  if (!differing.length) latent.push({ lane: 'A', slug: r.slug, name: r.name, fields, A: Object.fromEntries(fields.map(f => [f, r.A[f]])), B: Object.fromEntries(fields.map(f => [f, r.B[f]])), report: note, blocks_lock: false, handling: /jobs empty|§11\.9/.test(note) ? 'Settled by R4-Q1/R4-H; stale worked example, align text without another confirmation round.' : 'Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L.' });
}
for (const ambiguity of B.ambiguous_rules || []) {
  if (ambiguity.classification !== 'user_facing') continue;
  for (const id of ambiguity.ids || ambiguity.affected_ids || []) {
    const r = rows.find(r => r.id === id); if (!r) throw Error(`Unmapped ambiguity ${id}`);
    const fields = /Brilliantine/.test(ambiguity.ambiguity) ? ['primary_job'] : /Pomade/.test(ambiguity.ambiguity) ? ['secondary_jobs'] : ['primary_job', 'secondary_jobs'];
    const differing = fields.filter(f => !eq(r.A[f], r.B[f]));
    reported.push({ lane: 'B', slug: r.slug, name: r.name, fields, report: ambiguity, caused_disagreement_in_reported_fields: differing });
    if (!differing.length) latent.push({ lane: 'B', slug: r.slug, name: r.name, fields, A: Object.fromEntries(fields.map(f => [f, r.A[f]])), B: Object.fromEntries(fields.map(f => [f, r.B[f]])), report: ambiguity, blocks_lock: false, handling: 'Settled by the cited owner ruling; residual worked-example wording should be synchronized, without another blind round.' });
  }
}
const addendumExists = fs.existsSync(path.join(REPO, ADDENDUM));
const unseen = R2.lock_criteria.find(c => /unseen/i.test(c.criterion));
if (!unseen) throw Error('Missing historical unseen criterion');
const unresolved = discrepancies.filter(d => d.classification !== 'a');
const criteria = [
  { criterion: '(a) Every normative subtype >=5, committed + held where route state and subtype agree', met: coverage.every(c => c.meets_5_including_held), evidence: { passing: coverage.filter(c => c.meets_5_including_held).length, subtypes: coverage.length, below_5: coverage.filter(c => c.below_5_flag) } },
  { criterion: '(b) Every user-facing difference resolved; final confirmation has only proven lane errors and no new user-facing rule gap (R3-L/R4-L)', met: unresolved.length === 0, evidence: { classification_cells: classified, blocking_cells: unresolved.length, blocking_products: new Set(unresolved.map(d => d.slug)).size } },
  { criterion: '(c) Hold levels resolved (raw identical levels where either lane emits, or proven error/closed gap)', met: hold.mismatches === 0 || holdMismatches.every(h => discrepancies.find(d => d.slug === h.slug && d.field === 'hold_level' && d.classification === 'a')), evidence: hold },
  { criterion: '(d) Unseen criterion already met in round 2; not retested in r6', met: unseen.met === true, evidence: { source: 'data/research/styling-inci/v1.0/round-2/diff.json lock_criteria', historical_criterion: unseen, retested: false, round6_new_unseen: C.records.filter(r => r.cohort_role === 'unseen').length } },
  { criterion: '(e) Leave-in addendum draft exists at the requested path', met: addendumExists, evidence: { path: ADDENDUM, exists: addendumExists, status: addendumExists ? fs.readFileSync(path.join(REPO, ADDENDUM), 'utf8').split('\n').find(l => l.startsWith('Status:')) : null, existence_is_not_approval_or_activation: true } },
];
const verdict = criteria.every(c => c.met) ? 'PASS' : 'FAIL';
const inputPaths = ['blind-lane-A-r6/results.json', 'blind-lane-B-r6/results.json', 'r6/cohort.json', 'r6/FREEZE-NOTES.md', 'r6/artifact-manifest.json', 'blind-lane-A-r4/results.json', 'blind-lane-B-r4/results.json', 'r4/cohort.json', 'round-4/diff.js', 'round-4/diff.json', 'round-4/report.md', 'round-2/diff.json'].map(p => path.join(ROOT, p));
for (const kind of ['s0', 'fu', 'claims']) for (const r of rows) inputPaths.push(path.join(ROOT, `r6/packets/${kind}/${r.id}.json`));
inputPaths.push(...[STANDARD, LEDGER, 'docs/research/styling-inci/v1.0/02_evidence_lexicon.v0.5.md'].map(p => path.join(REPO, p)));
if (addendumExists) inputPaths.push(path.join(REPO, ADDENDUM));
const manifest = inputPaths.sort().map(p => ({ path: path.relative(REPO, p), sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') }));
const heatDisplay = rows.filter(r => prof(r.rawA) || prof(r.rawB)).filter(r => r.claims.claims.some(c => c.type === 'heat_protection' && /^C[12]/.test(c.tier || ''))).map(r => {
  const shownA = typeof r.rawA.provides_heat_protection === 'object' ? r.rawA.provides_heat_protection?.shown : null;
  const notesB = Array.isArray(r.rawB.notes) ? r.rawB.notes.join(' | ') : r.rawB.notes || '';
  return { slug: r.slug, name: r.name, A_value: r.A.provides_heat_protection, B_value: r.B.provides_heat_protection, A_shown_metadata: shownA ?? null, B_claim_only_display_in_notes: /Hitzeschutz laut Hersteller/.test(notesB), claim_only_text: 'Hitzeschutz laut Hersteller', note: 'Display permission comes from the shared C1/C2 heat claim (§6.7); lane wrapper/note placement is calculation log, not a separate lane profile field.' };
});
const output = {
  generated_by: 'data/research/styling-inci/v1.0/round-6/diff.js',
  method: 'Frozen final confirmation r6, amended v0.5, R3-L/R4-L. A=Claude Opus; B=Codex. Raw outputs preserved; adjudication does not change agreement counts. No production writes.',
  inputs: manifest, normalisation: NORMALISATION,
  counts: { records: rows.length, by_role: tally(rows, 'role'), user_facing_disagreement_cells: discrepancies.length, user_facing_disagreement_products: new Set(discrepancies.map(d => d.slug)).size, by_classification: classified, lane_error_cells_by_wrong_lane: tally(discrepancies.filter(d => d.classification === 'a'), d => d.right_lane === 'A' ? 'B' : 'A'), calculation_log_disagreement_cells: calculationDifferences.length, latent_reports: latent.length, latent_products: new Set(latent.map(x => x.slug)).size },
  user_facing_agreement: userAgreement, calculation_log_agreement: logAgreement, agreement_by_role: byRole,
  disagreements: discrepancies, calculation_log_disagreements: calculationDifferences,
  owner_questions: discrepancies.filter(d => d.classification === 'd'), rule_gaps: discrepancies.filter(d => d.classification === 'b'), packet_issues: discrepancies.filter(d => d.classification === 'c'), lane_errors: discrepancies.filter(d => d.classification === 'a'),
  latent_ambiguities: latent, reported_ambiguities: reported, lane_B_calculation_log_ambiguities: (B.ambiguous_rules || []).filter(a => a.classification === 'calculation_log'),
  hold_check: hold, coverage_per_subtype_agreed: coverage,
  round4_to_round6: historical, ruling_effects: rulingEffects, housekeeping_checks: housekeeping, wella_scale_checks: wellaChecks,
  heat_claim_display_audit: heatDisplay,
  lock_criteria: criteria, lock_verdict: verdict,
  limitations: ['Known-product final confirmation, not new unseen validation or deployed-app testing.', 'Human rule interpretation is recorded explicitly; counts, joins, agreement, coverage, history and verdict are computed. Ambiguous behaviour is not repaired or treated as approved by this score.', 'Shared errors are outside a disagreement-only lock criterion; ruling-example checks and latent reports expose sampled shared-output risks.', 'Draft existence passes criterion (e); R4-H requests updating the addendum after lock. This audit does not claim that its old v0.4 wording is approved or current.'],
};

const esc = v => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const val = v => esc(JSON.stringify(v));
const bullet = s => `- ${s}\n`;
function details(ds) {
  if (!ds.length) return 'None.\n\n';
  return ds.map(d => {
    let s = `### ${d.name} — ${d.field}\n\n\`${d.slug}\` · \`${d.id}\` · class **${d.classification}**\n\n`;
    s += `| Lane | Normalized value | Emitted rule path and rationale |\n|---|---|---|\n| A (Claude Opus) | ${val(d.A)} | ${val(d.A_rule_path)} |\n| B (Codex) | ${val(d.B)} | ${val(d.B_rule_path)} |\n\n`;
    s += `**Governing rule:** ${d.rule}.\n\n${d.explanation}\n\n`;
    if (d.right_lane) s += `**Correct lane: ${d.right_lane}.** Resolve the wrong lane to that value; frozen records remain unchanged.\n\n`;
    if (d.question) s += `**Owner question:** ${d.question}\n\n`;
    if (d.proposed_fix) s += `**Proposed wording:** ${d.proposed_fix}\n\n`;
    if (d.recommendation) s += `**Recommendation:** ${d.recommendation}\n\n`;
    const relevant = d.field === 'target_zone' ? [d.packet_evidence.directions.text] : d.field === 'route' ? [d.packet_evidence.name.confirmed_name, ...d.packet_evidence.claims.filter(c => c.type === 'promise').slice(0, 3).map(c => c.text)] : d.field === 'primary_job' ? [d.packet_evidence.name.confirmed_name, ...d.packet_evidence.claims.filter(c => ['promise', 'hold'].includes(c.type)).map(c => c.text)] : d.packet_evidence.claims.filter(c => ['promise', 'hold', 'humidity'].includes(c.type)).map(c => c.text);
    s += `**Frozen evidence:** ${relevant.map(t => `“${t}”`).join('; ')}. Packets: \`r6/packets/s0/${d.id}.json\`, \`r6/packets/claims/${d.id}.json\` (relative to this engine's data root). Full typed evidence is retained in diff.json.\n\n`;
    return s;
  }).join('');
}
function render(d, sha) {
  const u = d.user_facing_agreement, n = d.counts, g = d.rule_gaps, h = d.round4_to_round6;
  let s = `# Styling v1.0 — final confirmation round 6\n\n`;
  s += `The lanes agree on **${u.agreeing_cells}/${u.cells} user-facing field cells (${u.percent_cells}%)**. **${u.products_fully_agreeing}/${n.records} products (${u.percent_products}%) agree on every user-facing field.** Route includes held versus committed and the evidence/boundary reason; secondary jobs are fully included.\n\n`;
  s += `**Lock verdict: ${d.lock_verdict}.** There are **${n.user_facing_disagreement_cells} user-facing differences on ${n.user_facing_disagreement_products} products**: **a=${n.by_classification.a} proven lane errors, b=${n.by_classification.b} rule-gap cells, c=${n.by_classification.c} packet/data issues, d=${n.by_classification.d} owner-ruling cells**. ${g.length ? 'The gaps concern a defined beach-look secondary and the primary target zone across multiple application instructions. ' : ''}${d.owner_questions.length ? 'The John Frieda route still needs a decision about counting the Frizz Ease range prefix. ' : ''}These unresolved items fail R3-L/R4-L; high agreement does not close them.\n\n`;
  s += `All **${d.hold_check.products_where_either_emits_a_level} products with a hold level in either lane agree**. **${d.coverage_per_subtype_agreed.filter(c => c.meets_5_including_held).length}/${d.coverage_per_subtype_agreed.length} subtypes reach five agreed committed + held records.** The round-2 unseen gate is inherited, not retested. The Leave-in addendum draft exists; existence does not release held products.\n\n`;
  s += `Lane errors occur in both lanes: ${Object.entries(n.lane_error_cells_by_wrong_lane).map(([lane, count]) => `${lane} is wrong in ${count} cells`).join(', ')}. Agreement counts above retain those errors. Frozen lanes, rules and packets were not changed.\n\n`;
  s += `## Owner questions (d)\n\n${details(d.owner_questions)}`;
  s += `## Rule gaps (b)\n\n${details(d.rule_gaps)}`;
  s += `The ${g.filter(x => x.field === 'target_zone').length} target-zone cells share one underlying §6.12 gap. Counts are disagreement cells, not distinct policy issues. Proposed wording is review material and has not been approved or applied.\n\n`;
  s += `## Packet/data issues (c)\n\n${details(d.packet_issues)}`;
  s += `Existing evidence-gated/formula-conflicted products are counted with their frozen blocked state. An agreed evidence block is not a new packet defect causing a disagreement.\n\n`;
  s += `## Proven lane errors (a)\n\n${details(d.lane_errors)}`;
  s += `## Latent user-facing ambiguities\n\n${n.latent_reports} lane-reported observations on ${n.latent_products} products did not produce a difference in the reported field. They do not block under R3-L/R4-L. Observations on a product with another disputed field are retained when this specific field agrees. The stale Brilliantine and Pomade worked rows are already governed by R4-Q1/R4-H; they need text alignment, not a new ruling.\n\n`;
  s += `| Lane | Product (slug) | Fields and agreed values | Reported concern | Handling |\n|---|---|---|---|---|\n`;
  for (const x of d.latent_ambiguities) s += `| ${x.lane} | ${esc(x.name)}<br>\`${x.slug}\` | ${val(x.A)} | ${esc(typeof x.report === 'string' ? x.report : x.report.ambiguity)} | ${esc(x.handling)} |\n`;
  s += `\nLane B's ${d.lane_B_calculation_log_ambiguities.length} explicitly calculation-log ambiguities are retained in diff.json. A's legitimate hold_route “ambiguous” labels are not treated as reports of a new rule ambiguity.\n\n`;
  s += `## Agreement tables and method\n\nThe scorer adapts the round-4 join, normalization, per-field agreement, hold, subtype coverage and historical comparison method, but promotes secondary_jobs to the user-facing denominator and keeps internal diagnostics in a separate table. The user-facing denominator is ${n.records} products × ${u.fields} fields. Null/null agrees; the emitted-value columns disclose absent values. No conclusion or observed count is preset. Normative example expectations and evidence-conditioned analyst interpretations are explicit in diff.js.\n\n`;
  for (const note of d.normalisation) s += bullet(note);
  s += '\n';
  for (const [label, ag] of [['User-facing', d.user_facing_agreement], ['Calculation log', d.calculation_log_agreement]]) {
    s += `### ${label} field agreement\n\n| Field | Agree / all | % | Disagree | Agree / emitted by either | Emitted % |\n|---|---|---|---|---|---|\n`;
    for (const f of ag.field_agreement) s += `| ${f.field} | ${f.agree}/${f.records} | ${f.percent} | ${f.disagree} | ${f.agree_where_emitted}/${f.emitted_by_either} | ${f.percent_where_emitted ?? '—'} |\n`;
    s += `\nAggregate: ${ag.agreeing_cells}/${ag.cells} (${ag.percent_cells}%). ${label === 'Calculation log' ? 'This is a mechanical diagnostic measure: free-prose traces, omitted lane-A-only fields and confidence schema differences dominate it. It is not a behavioural quality score and cannot block the lock.' : ''}\n\n`;
  }
  s += `### Cohort roles\n\n| Role | Records | User cells agree | Fully user-agreeing products | Log cells agree |\n|---|---|---|---|---|\n`;
  for (const [role, x] of Object.entries(d.agreement_by_role)) s += `| ${role} | ${x.records} | ${x.user_facing.agreeing_cells}/${x.user_facing.cells} | ${x.user_facing.products_fully_agreeing}/${x.records} | ${x.calculation_log.agreeing_cells}/${x.calculation_log.cells} |\n`;
  s += `\n### Hold check\n\nRaw, unmasked hold_level values are checked wherever either lane emits one: **${d.hold_check.identical}/${d.hold_check.products_where_either_emits_a_level} identical; ${d.hold_check.mismatches} mismatches**.\n\n`;
  if (d.hold_check.mismatch_list.length) {
    s += '| Product | A | B |\n|---|---|---|\n';
    for (const x of d.hold_check.mismatch_list) s += `| ${esc(x.name)} (${x.slug}) | ${val(x.A)} | ${val(x.B)} |\n`;
    s += '\n';
  } else s += 'Mismatch list: none.\n\n';
  s += '### Subtype coverage\n\nCoverage requires agreement on committed/held state **and** subtype. It does not imply agreement on all other user fields; that stricter count is shown separately. Held means pending_leave_in_addendum, with a profile but no release for recommendation.\n\n| Subtype | Committed | Held | Total | Every user field agrees | Round 4 total | <5 flag |\n|---|---|---|---|---|---|---|\n';
  for (const c of d.coverage_per_subtype_agreed) s += `| ${c.subtype} | ${c.committed_agreed} | ${c.held_agreed} | ${c.total_agreed} | ${c.all_user_fields_agreeing} | ${c.round4_total_agreed ?? '—'} | ${c.below_5_flag ? '**YES**' : 'no'} |\n`;
  s += '\nExact committed and held slug lists are stored in diff.json. The R3-Q1 smoothing market-size exception is unnecessary when its measured total already reaches five.\n\n';
  s += '### Round-4 rulings: product-level landing\n\n“Landed” evaluates only the cited settled outcome, not every property of that product. R4-Q2 landed on alverde’s route/subtype/primary, while its later definition secondary remains disputed.\n\n| Ruling | Product | Expected ruled fields | A actual | B actual | Landed A / B | Other user disagreements |\n|---|---|---|---|---|---|---|\n';
  for (const x of d.ruling_effects) s += `| ${esc(x.ruling)} | ${esc(x.name)}<br>\`${x.slug}\` | ${val(x.expected)} | ${val(x.A)} | ${val(x.B)} | ${x.A_landed ? 'yes' : '**NO**'} / ${x.B_landed ? 'yes' : '**NO**'} | ${esc(x.remaining_user_disagreements.join(', ') || 'none')} |\n`;
  s += `\nThe R4-Q2/RG4-4 slogan context also named John Frieda Blow-Out as unchanged Leave-in. That effect note was not a named registry route ruling; R4-Q2 resolves slogans, not the Frizz Ease prefix. Its new route difference is therefore shown as an owner question, not hidden as “Q2 landed”.\n\n`;
  s += '| Housekeeping | Result | Evidence and limit |\n|---|---|---|\n';
  for (const x of d.housekeeping_checks) s += `| ${x.ruling} | ${x.met ? 'confirmed in stated scope' : '**NOT CONFIRMED**'} (${esc(x.status)}) | ${esc(x.evidence)} |\n`;
  s += '\nH1–H3 include text/schema or operational checks; they are not represented as isolated product-behaviour experiments. H3 example values and paths are in diff.json.\n\n';
  s += `### R3-H5 Wella EIMI scale\n\nAll ${d.wella_scale_checks.length} C1/C2 Haltegrad/Haltestufe cases are discovered from the frozen claims. ${d.wella_scale_checks.filter(x => x.applies_to_styling_profile).length} have Styling/held profiles. The remaining ${d.wella_scale_checks.filter(x => !x.applies_to_styling_profile).length} correctly withhold Styling hold_level under §4.7. Claim normalization uses the governing 1–2 → 1, 3 → 3, 4/4+ → 4 table, not prior lane labels.\n\n| Product | Captured scale text | Normalized claim level | Expected emitted level | A | B | Landed A / B | Scope |\n|---|---|---|---|---|---|---|---|\n`;
  for (const x of d.wella_scale_checks) s += `| ${esc(x.name)}<br>\`${x.slug}\` | ${esc(x.captured_claims.map(c => c.text).join('; '))} | ${x.normalized_claim_level} | ${val(x.expected_hold_level)} | ${val(x.A)} | ${val(x.B)} | ${x.A_landed ? 'yes' : '**NO**'} / ${x.B_landed ? 'yes' : '**NO**'} | ${esc(x.scope_note)} |\n`;
  const olduser = [...h.gone, ...h.persisting].filter(x => x.scope === 'user_facing');
  const goneuser = h.gone.filter(x => x.scope === 'user_facing');
  const persistuser = h.persisting.filter(x => x.scope === 'user_facing');
  const newuser = h.new_in_round6.filter(x => x.scope === 'user_facing');
  s += `\n### Round 4 → round 6\n\n${h.method}\n\nOn the common normalized user-facing definition: **${olduser.length} round-4 disagreement cells → ${goneuser.length} gone, ${persistuser.length} persisting**; **${newuser.length} new cells in r6**. “Persisting” is the same product/field, even if the candidate values or explanation changed.\n\n`;
  s += '| Round-4 product | Field | R4 A / B | Status in r6 | R6 A / B |\n|---|---|---|---|---|\n';
  for (const x of [...goneuser, ...persistuser].sort((a, b) => `${a.slug}::${a.field}`.localeCompare(`${b.slug}::${b.field}`, 'en'))) {
    const r = bySlug.get(x.slug); s += `| ${esc(x.name)}<br>\`${x.slug}\` | ${x.field} | ${val(x.A)} / ${val(x.B)} | ${currentKey.has(`${x.slug}::${x.field}`) ? '**persists**' : 'gone'} | ${val(r.A[x.field])} / ${val(r.B[x.field])} |\n`;
  }
  s += '\nNew user-facing cells:\n\n| Product | Field | A / B | Class |\n|---|---|---|---|\n';
  for (const x of newuser) s += `| ${esc(x.name)}<br>\`${x.slug}\` | ${x.field} | ${val(x.A)} / ${val(x.B)} | ${discrepancies.find(z => z.slug === x.slug && z.field === x.field).classification} |\n`;
  s += `\nThe complete original round-4 register (${h.original_round4_register.length} cells, including formerly supplementary secondary_jobs) is retained in diff.json with gone/persists status: ${h.original_round4_register.filter(x => x.status === 'gone').length} gone, ${h.original_round4_register.filter(x => x.status === 'persists').length} persist. Calculation-log history is also retained. It is excluded from lock blocking under R4-L.\n\n`;
  s += '### Lock criteria\n\n| Criterion | Result | Computed evidence |\n|---|---|---|\n';
  for (const c of d.lock_criteria) {
    const e = c.criterion.startsWith('(a)') ? `${c.evidence.passing}/${c.evidence.subtypes}; below 5: ${c.evidence.below_5.map(x => `${x.subtype}=${x.total_agreed}`).join(', ') || 'none'}` : c.criterion.startsWith('(b)') ? `a=${n.by_classification.a}, b=${n.by_classification.b}, c=${n.by_classification.c}, d=${n.by_classification.d}; b+c+d=${c.evidence.blocking_cells}, required 0` : c.criterion.startsWith('(c)') ? `${d.hold_check.identical}/${d.hold_check.products_where_either_emits_a_level}; ${d.hold_check.mismatches} mismatches` : c.criterion.startsWith('(d)') ? `${c.evidence.historical_criterion.numbers}; NOT retested` : `${c.evidence.path}: exists=${c.evidence.exists}; DRAFT, not in force`;
    s += `| ${esc(c.criterion)} | **${c.met ? 'PASS' : 'FAIL'}** | ${esc(e)} |\n`;
  }
  s += `\n**Overall: ${d.lock_verdict}.** Close the user-facing rule gaps and owner question, synchronize the standard/examples, and run a fresh confirmation for the changed behaviour. Calculation-log differences and already-settled latent editorial corrections alone do not require another round.\n\n`;
  s += '### Scope and reproduction\n\n';
  for (const l of d.limitations) s += bullet(l);
  s += `\nRun \`node data/research/styling-inci/v1.0/round-6/diff.js --summary\` twice, then compare \`shasum -a 256 data/research/styling-inci/v1.0/round-6/diff.json\`. Fixed input hashes are recorded in diff.json; no timestamps, randomness, input run_at metadata or absolute paths enter the output.\n\nCurrent diff.json SHA-256: \`${sha}\`.\n`;
  return s;
}
const json = JSON.stringify(output, null, 2) + '\n';
const sha = crypto.createHash('sha256').update(json).digest('hex');
fs.writeFileSync(path.join(__dirname, 'diff.json'), json);
fs.writeFileSync(path.join(__dirname, 'report.md'), render(output, sha));
if (process.argv.includes('--summary')) console.log(JSON.stringify({ counts: output.counts, agreement: { agreeing_cells: userAgreement.agreeing_cells, cells: userAgreement.cells, percent: userAgreement.percent_cells, fully_agreeing_products: userAgreement.products_fully_agreeing }, hold, coverage: coverage.map(c => `${c.subtype} ${c.committed_agreed}+${c.held_agreed}`), ruling_examples_not_landed: rulingEffects.filter(x => !x.A_landed || !x.B_landed).map(x => x.slug), housekeeping, wella: wellaChecks.map(x => ({ slug: x.slug, expected: x.expected_hold_level, A: x.A, B: x.B })), lock_criteria: criteria.map(c => ({ criterion: c.criterion, met: c.met })), lock_verdict: verdict, sha256: sha }, null, 2));
if (process.argv.includes('--dump')) for (const d of discrepancies) console.log(JSON.stringify({ slug: d.slug, field: d.field, A: d.A, B: d.B, classification: d.classification, right_lane: d.right_lane }));
