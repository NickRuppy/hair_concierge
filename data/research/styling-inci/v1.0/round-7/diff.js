#!/usr/bin/env node
'use strict';
// Adapted from round-6/diff.js: frozen bijective join, semantic normalization,
// separate user-facing/log cells, evidence-conditioned adjudication and hold check.
// Targeted r7 only. No timestamps, randomness or preset empirical counts/verdicts.
// Usage: node data/research/styling-inci/v1.0/round-7/diff.js [--summary] [--dump]
// Writes ONLY sibling diff.json and report.md; inputs are never rewritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r7/results.json');
const B = read('blind-lane-B-r7/results.json');
const C = read('r7/cohort.json');
const STANDARD = 'docs/research/styling-inci/v1.0/styling-classification-standard.md';
const LEDGER = 'plans/styling-concept/02-rulings.md';
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
  'route is compared as {destination,state,boundary_reason}; boundary_reason is populated only for provisional_boundary. This retains evidence_gate, formula_conflict, mixed_promise, li_g0_provisional and pending_leave_in_addendum; committed and held are never folded together. Non-boundary pair/reason vocabulary remains calculation log.',
  'application_moment compares primary only: {primary,also[]} versus string. also[] is excluded as requested. provides_heat_protection compares the boolean value, not research-trace wrappers.',
  'buildup/alcohol notes: {fired:false}, not_fired and does_not_fire -> does_not_fire; {fired:true}, fired and fires -> fires. null remains null.',
  'Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.',
  'neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.',
  'Empty secondary_jobs/d8b_flags collections and null are equivalent only when no Styling profile exists (§4.7). Only explicitly informational_and_non_authoritative historical properties are masked. Any unmarked forbidden value remains scoreable.',
  'confidence_internal is mapped to confidence; promise unknown/null -> not_assigned. Other lane-A-only fields are retained as schema-asymmetric calculation-log columns; missing is null. No user-facing disagreement is removed by adjudication.',
];
function normalize(r) {
  const o = {};
  for (const f of [...USER, ...LOG]) o[f] = r[f] ?? null;
  o.route = { destination: r.route, state: state(r), boundary_reason: boundary(r) };
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
const am = mapRecords(A, C, 'A7'), bm = mapRecords(B, C, 'B7');
const idm = new Map(C.id_map.map(r => [r.sample_id, r]));
if (idm.size !== C.id_map.length || idm.size !== C.records.length || new Set(C.records.map(r => r.source_slug)).size !== C.records.length) throw Error('cohort map is not bijective');
const packet = (kind, id) => read(`r7/packets/${kind}/${id}.json`);
const rows = C.records.map(c => {
  const m = idm.get(c.sample_id);
  if (m?.source_slug !== c.source_slug) throw Error(`r7 ID/slug mapping broken: ${c.source_slug}`);
  const rawA = am.get(c.sample_id), rawB = bm.get(c.sample_id);
  const s0 = packet('s0', c.sample_id), fu = packet('fu', c.sample_id), claims = packet('claims', c.sample_id);
  for (const p of [s0, fu, claims]) if (p.sample_id !== c.sample_id || p.packet_version !== C.standard_version) throw Error(`Packet binding/version mismatch ${c.sample_id}`);
  return { id: c.sample_id, slug: m.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role, reason_classes: c.history.round7.reason_classes, rawA, rawB, A: normalize(rawA), B: normalize(rawB), s0, fu, claims };
}).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySlug = new Map(rows.map(r => [r.slug, r]));
const doc = p => fs.readFileSync(path.join(REPO, p), 'utf8');
const PROPERTY = 'docs/research/styling-inci/v1.0/01_property-set-v0.md';
function ref(p, section, quote) {
  const lines = doc(p).split('\n');
  const start = section === '§6.10' ? lines.findIndex(l => l.startsWith('### 6.10 ')) : 0;
  const index = lines.findIndex((l, i) => i >= start && l.includes(quote));
  if (index < 0) throw Error(`Rule quote missing: ${p}: ${quote}`);
  return { path: p, line: index + 1, section, quote };
}
const job = quote => ref(STANDARD, '§6.10', quote);
const firstJob = job('the first **job-bearing** phrase of the lead promise');
const order = job('the confirmed name\'s job words first (after the primary, in name order), then the C1/C2 promise lines in packet order, each line\'s job words in text order');
const unblind = ref(STANDARD, '§10.2 claim normalisation', '| **Claim normalisation** (two independent passes; PH1-11 (c))');
const volume = job('Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume`');
const holdJob = job('a hold claim with a strength word **or a brand number** states `hold_fix`');
const humidityJob = job('Humidity and duration lines never state a job; an explicit anti-frizz word in them does');
const r6q1 = ref(LEDGER, 'R6-Q1', '| R6-Q1 |');
const r6t = ref(LEDGER, 'R6-T', '| R6-T |');
const lockRules = [ref(LEDGER, 'R3-L', '| R3-L |'), ref(LEDGER, 'R4-L', '| R4-L |')];
const trace = r => Object.fromEntries(['rule_path', 'reason_code', 'boundary_reason', 'hold_basis', 'notes'].map(f => [f, r[f] ?? null]));
const decision = (classification, right_lane, rules, explanation, extra = {}) => ({ classification, right_lane, rules, explanation, ...extra });
function requireClaim(r, pattern, type) {
  const found = r.claims.claims.filter(c => /^C[12]/.test(c.tier || '') && (!type || c.type === type) && pattern.test(c.text));
  if (!found.length) throw Error(`Expected adjudication evidence absent ${r.slug}: ${pattern}`);
  return found;
}
// Explicit analyst interpretations, conditioned on frozen evidence and the actual
// discrepant field. Every new/unexpected disagreement stops rather than receiving
// an automatic lane-error label. Measured counts and verdicts are computed below.
function adjudicate(r, field) {
  if (r.slug === 'wellaflex-schaumfestiger-locken-und-wellen-starker-halt' && ['primary_job', 'secondary_jobs'].includes(field)) {
    const evidence = requireClaim(r, /schwungvolle, definierte Locken/, 'promise');
    return decision('a', 'A', [firstJob, volume, order], field === 'primary_job'
      ? 'The C1 lead begins “schwungvolle” before “definierte Locken”. Schwung maps to volume under RG2-6; its adjective expresses the same stated job. RG-11 selects the first job-bearing phrase, so A volume is correct and B definition skips the earlier volume phrase.'
      : 'With the ruled-by-text primary volume, exclude volume from secondary candidates. The confirmed name supplies Schaumfestiger/hold_fix then Locken & Wellen/definition (R4-Q7, §4.2 RG3-1); both pass via fixative_film. A {hold_fix, definition} is correct. B retains its erroneous primary definition and repeats the true primary volume as a secondary.', { evidence });
  }
  if (r.slug === 'maria-nila-curlicue-cream' && field === 'secondary_jobs') {
    const evidence = requireClaim(r, /Halt 3\/5/, 'hold');
    return decision('a', 'B', [holdJob, order, ref(LEDGER, 'R4-H (5)', 'typed hold lines are secondary-job candidates only through the §6.10 hold_fix rule')], 'Volume occurs in the C2 lead (“lebendige Sprungkraft”), then C2 “Halt 3/5” supplies the explicit numeric-hold exception. Both pass via PVP/fixative_film; two slots are available. B {volume, hold_fix} is correct. A follows the stale §11.3 worked row and omits the current explicit §6.10/R4-H(5) candidate. The worked row is an editorial correction, not an unresolved policy choice.', { evidence, stale_example: ref(STANDARD, '§11.3 worked example', 'secondary `volume` („lebendige Sprungkraft') });
  }
  if (r.slug === 'neqi-diamond-glass-styling-spray-all' && ['primary_job', 'secondary_jobs'].includes(field)) {
    const evidence = requireClaim(r, /intensiv glänzenden, glatten/, 'promise');
    return decision('a', 'B', [firstJob, order, unblind, ref(PROPERTY, '§7 C fields', '| **Authoritative claim capture (C; not blind;')], field === 'primary_job'
      ? 'The authoritative unmasked C2 lead states shine (“intensiv glänzenden”) before sleek (“glatten”). §10.2 assigns jobs to claim normalisation, not masked S0. B shine is correct. A explicitly uses S0 “[CLAIM] glatten” and therefore skips the first unmasked job. R6-Q1 fixes route/subtype, not this independent C field.'
      : 'After primary shine, the same unmasked promise supplies sleek then frizz_control (“reduziert Frizz”). Both pass via silicone_coat. B {sleek, frizz_control} is correct. A retains the erroneous sleek primary and repeats the true shine primary as a secondary.', { evidence });
  }
  if (r.slug === 'neqi-diamond-glass-ultimate-styling-spray' && field === 'primary_job') {
    const evidence = requireClaim(r, /Styling mit intensivem Hitzeschutz/, 'promise');
    return decision('b', null, [firstJob, job('one primary, ≤ 2 secondaries from'), ref(PROPERTY, '§2.12 source assumption', 'These always exist, because S0 requires a C1/C2 promise.'), r6q1], 'Ultimate is correctly held smoothing_styler in both lanes, but its C1/C2 promise lines state generic Styling plus heat protection, heat-activated polymers, water repellence and shorter drying time. None supplies a primary from the eight-job vocabulary. §6.10 requires one primary but specifies no representation when an eligible lead supplies none. The no-C1/C2-promise exception does not apply: promise lines exist. A null and B review both express the missing job differently; neither is proven correct by a clear no-job convention. B review is outside the closed vocabulary, but that alone does not prove A null against an existing rule. Typed finish/other lines and the subtype do not authorize replacing the lead.', {
      evidence,
      proposed_fix: 'In §6.10 and property set §2.12: when the eligible C1/C2 lead supplies no job in the primary-job vocabulary, emit primary_job: null and an internal primary_job_unresolved review trigger. Do not infer a primary from subtype, formula, or typed finish/other lines. Keep the owner-ruled held route and independently score eligible secondaries. Correct the assumption that a C1/C2 promise always supplies a closed-list job.',
      recommendation: 'Use null for the absent user-facing job and keep review in the calculation log. This is proposed contract wording, not an approved correction to frozen lane B. Synchronize the consuming guidance and re-check this affected case after the gap is resolved.',
    });
  }
  if (r.slug === 'john-frieda-frizz-ease-traumlocken-lockencreme' && field === 'secondary_jobs') {
    const evidence = requireClaim(r, /Verhindert Frizz für definierte, flexible Locken/, 'humidity');
    return decision('a', 'B', [humidityJob, order, r6q1], 'C1 “Verhindert Frizz für definierte, flexible Locken” explicitly promises frizz control. The written anti-frizz exception admits it even in a typed humidity line; silicone_coat/wax_lipid passes the gate and a slot is free. B {frizz_control} is correct; A omits it. R6-Q1 bars Frizz Ease as a brand-line job, but does not erase this separate explicit pack claim.', { evidence });
  }
  throw Error(`Unadjudicated USER-FACING difference ${r.slug}::${field}`);
}
const discrepancies = rows.flatMap(r => USER.filter(f => !eq(r.A[f], r.B[f])).map(field => ({
  slug: r.slug, id: r.id, name: r.name, reason_classes: r.reason_classes, field,
  A: r.A[field], B: r.B[field], A_trace: trace(r.rawA), B_trace: trace(r.rawB),
  packet_paths: Object.fromEntries(['s0', 'fu', 'claims'].map(k => [k, `data/research/styling-inci/v1.0/r7/packets/${k}/${r.id}.json`])),
  packet_evidence: { name: r.s0.product, directions: r.s0.directions, s0_promises: r.s0.promise_claims_c1_c2, claims: r.claims.claims },
  ...adjudicate(r, field),
})));
const correctValue = d => {
  if (d.slug === 'wellaflex-schaumfestiger-locken-und-wellen-starker-halt') return d.field === 'primary_job' ? 'volume' : set(['hold_fix', 'definition']);
  if (d.slug === 'maria-nila-curlicue-cream') return set(['volume', 'hold_fix']);
  if (d.slug === 'neqi-diamond-glass-styling-spray-all') return d.field === 'primary_job' ? 'shine' : set(['sleek', 'frizz_control']);
  if (d.slug === 'john-frieda-frizz-ease-traumlocken-lockencreme') return ['frizz_control'];
  throw Error(`No rule-derived correct value ${d.slug}::${d.field}`);
};
for (const d of discrepancies.filter(d => d.classification === 'a')) {
  d.correct_value = correctValue(d);
  if (!eq(d[d.right_lane], d.correct_value)) throw Error(`Adjudicated lane does not match rule-derived value ${d.slug}::${d.field}`);
}
const calculationDifferences = rows.flatMap(r => LOG.filter(f => !eq(r.A[f], r.B[f])).map(field => ({ slug: r.slug, id: r.id, field, A: r.A[field], B: r.B[field], blocks_lock: false })));
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
const holdRows = rows.map(r => ({ slug: r.slug, id: r.id, name: r.name, A: r.rawA.hold_level ?? null, B: r.rawB.hold_level ?? null,
  A_basis: r.rawA.hold_basis ?? null, B_basis: r.rawB.hold_basis ?? null,
  A_state: state(r.rawA), B_state: state(r.rawB),
  claimed_hold: r.claims.claims.filter(c => c.type === 'hold' && /^C[12]/.test(c.tier || '')),
}));
const emittedHold = holdRows.filter(r => r.A != null || r.B != null), holdMismatches = holdRows.filter(r => !eq(r.A, r.B));
const hold = { records: rows.length, identical_all_records: holdRows.length - holdMismatches.length,
  products_where_either_emits_a_level: emittedHold.length, identical_where_emitted: emittedHold.filter(r => eq(r.A, r.B)).length,
  null_in_both: holdRows.filter(r => r.A == null && r.B == null).length,
  mismatches: holdMismatches.length, mismatch_list: holdMismatches,
  A_distribution: tally(holdRows, r => r.A == null ? 'null' : r.A), B_distribution: tally(holdRows, r => r.B == null ? 'null' : r.B),
  raw_unmasked_check: true, individual_records: holdRows,
  method: 'Raw hold_level on every cohort record, including null, held profiles and non-Styling routes. Agreement is not an independent claim-to-level oracle; captured C1/C2 hold claims and both bases are retained for every record. No formula or grade is manufactured.' };
// Normative named expectations only; actual outcomes, pass flags and totals are computed.
const rulingSpecs = [
  ['R6-Q1', 'john-frieda-frizz-ease-unendlich-smooth-blow-out-spray', { route: { destination: 'provisional_boundary', state: 'held', boundary_reason: 'pending_leave_in_addendum' }, subtype: 'smoothing_styler' }],
  ['R6-Q1', 'neqi-diamond-glass-ultimate-styling-spray', { route: { destination: 'provisional_boundary', state: 'held', boundary_reason: 'pending_leave_in_addendum' }, subtype: 'smoothing_styler' }],
  ['R6-Q1', 'neqi-diamond-glass-styling-spray-all', { route: { destination: 'provisional_boundary', state: 'held', boundary_reason: 'pending_leave_in_addendum' }, subtype: 'smoothing_styler' }],
  ['R6-T (1)', 'balea-pure-styling-volumenpuder-spray', { target_zone: 'roots' }],
  ['R6-T (2)', 'redken-root-tease', { target_zone: 'all' }],
  ['R6-T (3)', 'alverde-beach-waves-spray-seaside-balance', { secondary_jobs_excludes: 'definition' }],
];
const rulingEffects = rulingSpecs.map(([ruling, slug, expected]) => {
  const r = bySlug.get(slug); if (!r) throw Error(`Missing ruling exemplar ${slug}`);
  const keys = Object.keys(expected).map(k => k === 'secondary_jobs_excludes' ? 'secondary_jobs' : k);
  const actual = lane => Object.fromEntries(keys.map(k => [k, r[lane][k]]));
  const lands = lane => Object.entries(expected).every(([k, v]) => k === 'secondary_jobs_excludes' ? Array.isArray(r[lane].secondary_jobs) && !r[lane].secondary_jobs.includes(v) : eq(r[lane][k], v));
  return { ruling, rule: ruling === 'R6-Q1' ? r6q1 : r6t, slug, id: r.id, name: r.name, expected, A: actual('A'), B: actual('B'), A_landed: lands('A'), B_landed: lands('B'), remaining_user_disagreements: discrepancies.filter(d => d.slug === slug).map(d => d.field) };
});
// Extract actual lane reports, not all occurrences of the legitimate hold_route
// 'ambiguous' enum. Preserve per-field latent observations on disputed products.
function aReportedFields(slug, note) {
  if (/secondary|two-job name yields/i.test(note) && !/primary_job|Primary:|primary would|primary becomes/i.test(note)) return ['secondary_jobs'];
  if (/flex.*feel line/i.test(note)) return ['flexibility'];
  if (/Ambiguous \(route|route, user-facing/i.test(note)) return ['route'];
  if (/primary_job|primary would|primary becomes|Primary job|lead becomes|primary.*ambiguity/i.test(note)) return ['primary_job'];
  if (/second_day|damp_before_drying|Moment:/i.test(note)) return ['application_moment'];
  throw Error(`Unmapped lane-A reported ambiguity ${slug}`);
}
const reported = [];
function addReport(lane, r, fields, report) {
  const differing = fields.filter(f => !eq(r.A[f], r.B[f]));
  const agreeing = fields.filter(f => eq(r.A[f], r.B[f]));
  reported.push({ lane, slug: r.slug, id: r.id, name: r.name, fields, report, disagreement_fields: differing, latent_fields: agreeing,
    A: Object.fromEntries(fields.map(f => [f, r.A[f]])), B: Object.fromEntries(fields.map(f => [f, r.B[f]])) });
}
for (const r of rows) {
  const note = typeof r.rawA.notes === 'string' ? r.rawA.notes : (r.rawA.notes || []).join(' | ');
  if (/\bambiguity\b|\bambiguous\b/i.test(note.replace(/hold_route\s+ambiguous\b/gi, 'hold_route_unresolved'))) addReport('A', r, aReportedFields(r.slug, note), note);
}
for (const ambiguity of B.ambiguous_rules || []) {
  if (ambiguity.impact !== 'user_facing') continue;
  const fields = /secondary|anti-frizz/i.test(ambiguity.rule) || /secondary_jobs/.test(ambiguity.applied || '') ? ['secondary_jobs'] : ['primary_job'];
  for (const id of ambiguity.records || []) {
    const r = rows.find(r => r.id === id); if (!r) throw Error(`Unmapped lane-B ambiguity ${id}`);
    addReport('B', r, fields, ambiguity);
  }
}
const latent = reported.filter(x => x.latent_fields.length).map(x => ({ ...x, fields: x.latent_fields,
  A: Object.fromEntries(x.latent_fields.map(f => [f, bySlug.get(x.slug).A[f]])), B: Object.fromEntries(x.latent_fields.map(f => [f, bySlug.get(x.slug).B[f]])),
  blocks_lock: false, handling: 'The reported field agrees in both lanes. Retain this observation without reclassifying it as an A/B disagreement or an approved rule change. A different disputed field on the same product remains scored independently.' }));
const blockers = discrepancies.filter(d => d.classification !== 'a');
const criteria = [
  { criterion: 'Every user-facing disagreement is a proven lane error under a clear rule', met: discrepancies.every(d => d.classification === 'a' && ['A', 'B'].includes(d.right_lane) && d.rules.length > 0), blocking_cells: blockers.length },
  { criterion: 'No user-facing rule gaps (b), packet issues (c), or owner questions (d)', met: ['b', 'c', 'd'].every(k => classified[k] === 0), classification_counts: classified },
];
const verdict = criteria.every(c => c.met) ? 'PASS' : 'FAIL';
const inputPaths = ['blind-lane-A-r7/results.json', 'blind-lane-B-r7/results.json', 'r7/cohort.json', 'r7/FREEZE-NOTES.md', 'round-6/diff.js'].map(p => path.join(ROOT, p));
for (const kind of ['s0', 'fu', 'claims']) for (const r of rows) inputPaths.push(path.join(ROOT, `r7/packets/${kind}/${r.id}.json`));
const docsDir = path.join(REPO, 'docs/research/styling-inci/v1.0');
inputPaths.push(...fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).map(f => path.join(docsDir, f)), path.join(REPO, LEDGER));
const manifest = inputPaths.sort().map(p => ({ path: path.relative(REPO, p), sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') }));
const output = {
  generated_by: 'data/research/styling-inci/v1.0/round-7/diff.js',
  method: 'TARGETED r7 re-check under R3-L/R4-L and R6-Q1/R6-T; A=Claude Opus, B=Codex. Round-6 join, normalization and agreement method adapted. Raw disagreement counts are never altered by adjudication.',
  inputs: manifest, normalisation: NORMALISATION, lock_rules: lockRules,
  counts: { records: rows.length, by_role: tally(rows, 'role'), by_target_reason: tally(rows.flatMap(r => r.reason_classes), x => x),
    user_facing_disagreement_cells: discrepancies.length, user_facing_disagreement_products: new Set(discrepancies.map(d => d.slug)).size,
    by_classification: classified, lane_error_cells_by_wrong_lane: tally(discrepancies.filter(d => d.classification === 'a'), d => d.right_lane === 'A' ? 'B' : 'A'),
    calculation_log_disagreement_cells: calculationDifferences.length, latent_reports: latent.length, latent_products: new Set(latent.map(x => x.slug)).size },
  user_facing_agreement: userAgreement, calculation_log_agreement: logAgreement,
  disagreements: discrepancies, lane_errors: discrepancies.filter(d => d.classification === 'a'), rule_gaps: discrepancies.filter(d => d.classification === 'b'), packet_issues: discrepancies.filter(d => d.classification === 'c'), owner_questions: discrepancies.filter(d => d.classification === 'd'),
  calculation_log_disagreements: calculationDifferences, reported_ambiguities: reported, latent_ambiguities: latent,
  lane_B_calculation_log_ambiguities: (B.ambiguous_rules || []).filter(a => a.impact === 'calculation_log'),
  ruling_effects: rulingEffects, hold_check: hold, lock_criteria: criteria, lock_verdict: verdict,
  lock_reason: blockers.length ? `User-facing unresolved cells: ${blockers.map(d => `${d.slug}::${d.field} (${d.classification})`).join('; ')}. Only a disagreements are allowed by the targeted lock criterion.` : 'Every user-facing difference is a proven lane error; no b/c/d user-facing cells remain.',
  products: rows.map(r => ({ id: r.id, slug: r.slug, name: r.name, role: r.role, targeted_reasons: r.reason_classes,
    A: Object.fromEntries(USER.map(f => [f, r.A[f]])), B: Object.fromEntries(USER.map(f => [f, r.B[f]])),
    fully_agreeing: USER.every(f => eq(r.A[f], r.B[f])), disagreement_fields: USER.filter(f => !eq(r.A[f], r.B[f])) })),
  limitations: ['Targeted known-product confirmation; not a full new cohort, new unseen validation, catalog activation or live-app proof.', 'Human interpretation and proposed contract text are explicit. Joins, normalization, field/product counts, classifications tallies, ruling pass flags, hold counts, manifests and verdict are computed.', 'Calculation-log differences and lane-reported latent ambiguities do not block. No subtype minimum or historical unseen gate is added to the user-specified targeted lock rule.', 'Agreement is not proof against shared mistakes. Named ruling effects are checked separately; hold_check is a raw A/B agreement check with frozen claim traces, not a newly implemented independent hold classifier.'],
};
const esc = v => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const val = v => esc(JSON.stringify(v));
const ruleLabel = r => `\`${r.path}:${r.line}\` (${r.section})`;
function details(ds) {
  if (!ds.length) return 'None.\n\n';
  return ds.map(d => {
    let s = `### ${d.name} — ${d.field}\n\n\`${d.slug}\` · \`${d.id}\` · class **${d.classification}**\n\n| Lane | Normalized value | Emitted trace |\n|---|---|---|\n| A (Claude Opus) | ${val(d.A)} | ${val(d.A_trace)} |\n| B (Codex) | ${val(d.B)} | ${val(d.B_trace)} |\n\n`;
    s += `**Rules:** ${d.rules.map(ruleLabel).join('; ')}. Exact cited clauses and full frozen evidence are retained in diff.json.\n\n${d.explanation}\n\n`;
    if (d.right_lane) s += `**Correct lane: ${d.right_lane}; wrong lane: ${d.right_lane === 'A' ? 'B' : 'A'}.** Frozen lane values remain unchanged.\n\n`;
    if (d.proposed_fix) s += `**Proposed fix (not approved):** ${d.proposed_fix}\n\n`;
    if (d.question) s += `**Owner question:** ${d.question}\n\n`;
    if (d.recommendation) s += `**Recommendation:** ${d.recommendation}\n\n`;
    if (d.stale_example) s += `**Stale worked example:** ${ruleLabel(d.stale_example)}; the explicit current rule and ledger exception govern.\n\n`;
    s += `**Frozen evidence:** ${d.evidence.map(c => `“${c.text}” (${c.tier}, ${c.type})`).join('; ')}. Packet: \`${d.packet_paths.claims}\`.\n\n`;
    return s;
  }).join('');
}
function render(d, sha) {
  const u = d.user_facing_agreement, n = d.counts, h = d.hold_check;
  let s = '# Styling v1.0 — TARGETED final re-check, cohort r7\n\n';
  s += `**${u.agreeing_cells}/${u.cells} user-facing field cells agree (${u.percent_cells}%). ${u.products_fully_agreeing}/${n.records} products fully agree (${u.percent_products}%).** The denominator is ${n.records} products × ${u.fields} user-facing fields. Route includes held/committed state and boundary reason; application moment compares primary only.\n\n`;
  s += `**Lock verdict: ${d.lock_verdict}.** ${d.lock_reason}\n\n`;
  s += `${n.user_facing_disagreement_cells} disagreement cells on ${n.user_facing_disagreement_products} products: **a=${n.by_classification.a}, b=${n.by_classification.b}, c=${n.by_classification.c}, d=${n.by_classification.d}**. Lane errors by wrong lane: ${Object.entries(n.lane_error_cells_by_wrong_lane).map(([lane, count]) => `${lane}=${count}`).join(', ')}. Counts are field cells, not distinct policy issues; consequential secondary changes from a wrong primary remain separate cells.\n\n`;
  s += `Governing lock authority: ${d.lock_rules.map(ruleLabel).join('; ')}. The requested targeted-set criterion allows proven lane errors, requires zero b/c/d user-facing differences, and excludes calculation-log fields. Latent reports do not change this verdict.\n\n`;
  s += `## Ruling-effect check\n\n${d.ruling_effects.filter(x => x.A_landed && x.B_landed).length}/${d.ruling_effects.length} named effects land in both lanes. This tests the specified ruling fields; it does not claim complete profile agreement on those products.\n\n| Ruling | Product / slug | Expected | A actual | B actual | Landed A / B | Other user disagreements |\n|---|---|---|---|---|---|---|\n`;
  for (const x of d.ruling_effects) s += `| ${x.ruling} | ${esc(x.name)}<br>\`${x.slug}\` | ${val(x.expected)} | ${val(x.A)} | ${val(x.B)} | ${x.A_landed ? 'yes' : '**NO**'} / ${x.B_landed ? 'yes' : '**NO**'} | ${esc(x.remaining_user_disagreements.join(', ') || 'none')} |\n`;
  s += `\nR6 sources: ${ruleLabel(r6q1)}; ${ruleLabel(r6t)}. Ultimate retains its frozen FX-1 member; the named owner override governs its route without changing ingredient membership.\n\n`;
  s += `## Rule gaps (b)\n\n${details(d.rule_gaps)}## Owner questions (d)\n\n${details(d.owner_questions)}## Packet issues (c)\n\n${details(d.packet_issues)}## Proven lane errors (a)\n\n${details(d.lane_errors)}`;
  s += `## Hold check\n\n**${h.identical_all_records}/${h.records} raw hold values agree**, including ${h.null_in_both} null/null pairs. **${h.identical_where_emitted}/${h.products_where_either_emits_a_level} agree where either lane emits a level; ${h.mismatches} mismatches.** ${h.method}\n\n| Value | Lane A count | Lane B count |\n|---|---|---|\n`;
  for (const k of [...new Set([...Object.keys(h.A_distribution), ...Object.keys(h.B_distribution)])].sort()) s += `| ${k} | ${h.A_distribution[k] || 0} | ${h.B_distribution[k] || 0} |\n`;
  s += '\n';
  if (h.mismatch_list.length) for (const x of h.mismatch_list) s += `- ${x.name} (\`${x.slug}\`): A=${val(x.A)}, B=${val(x.B)}.\n`;
  else s += 'Mismatch list: none. Per-product levels, routes, captured hold claims and lane bases are in diff.json.\n';
  s += `\n## Latent user-facing ambiguities — non-blocking\n\n${n.latent_reports} lane reports on ${n.latent_products} products agree in the reported fields. These observations are preserved without elevating them into demonstrated disagreement gaps. A latent secondary observation may coexist with an independently disputed primary on the same product.\n\n| Lane | Product / slug | Fields with agreed values | Lane-reported concern / applied reading |\n|---|---|---|---|\n`;
  for (const x of d.latent_ambiguities) s += `| ${x.lane} | ${esc(x.name)}<br>\`${x.slug}\` | ${val(x.A)} | ${esc(typeof x.report === 'string' ? x.report : `${x.report.rule}: ${x.report.reason} Applied: ${x.report.applied}`)} |\n`;
  s += `\nB's ${d.lane_B_calculation_log_ambiguities.length} explicitly calculation-log ambiguity report(s) are retained separately. A's legitimate hold_route ambiguous enum is not counted as a new rule report. Curlicue's worked-example inconsistency produced a disagreement and is adjudicated above, rather than counted latent.\n\n`;
  s += '## Agreement and normalization\n\n### User-facing fields\n\n| Field | Agree / all | % | Disagree | Agree / emitted by either | Emitted % |\n|---|---|---|---|---|---|\n';
  for (const f of u.field_agreement) s += `| ${f.field} | ${f.agree}/${f.records} | ${f.percent} | ${f.disagree} | ${f.agree_where_emitted}/${f.emitted_by_either} | ${f.percent_where_emitted ?? '—'} |\n`;
  s += `\n### Products fully agreeing\n\n${u.fully_agreeing_slugs.map(slug => `- \`${slug}\``).join('\n')}\n\n### Normalization\n\n${d.normalisation.map(x => `- ${x}`).join('\n')}\n\n`;
  s += `### Calculation-log fields — non-blocking\n\n${d.calculation_log_agreement.agreeing_cells}/${d.calculation_log_agreement.cells} cells agree (${d.calculation_log_agreement.percent_cells}%). This mechanical diagnostic compares free-text traces and asymmetric schemas; it is not a behavioral quality score. All log discrepancies are retained in diff.json.\n\n| Field | Agree / all | Disagree |\n|---|---|---|\n`;
  for (const f of d.calculation_log_agreement.field_agreement) s += `| ${f.field} | ${f.agree}/${f.records} | ${f.disagree} |\n`;
  s += '\n## Targeted lock criteria\n\n| Criterion | Result |\n|---|---|\n';
  for (const c of d.lock_criteria) s += `| ${c.criterion} | **${c.met ? 'PASS' : 'FAIL'}** |\n`;
  s += `\n**${d.lock_verdict}:** ${d.lock_reason}\n\n## Scope and reproduction\n\n${d.limitations.map(x => `- ${x}`).join('\n')}\n\n`;
  s += 'The script rejects duplicate/missing/extra IDs, broken slug joins, packet binding/version mismatches, absent quoted rule evidence and unadjudicated new user-facing differences. Fixed input SHA-256 values are recorded in diff.json. It writes only sibling diff.json and report.md.\n\n';
  s += 'Run `node data/research/styling-inci/v1.0/round-7/diff.js --summary` twice, then compare `shasum -a 256 data/research/styling-inci/v1.0/round-7/diff.json`. No timestamps, randomness or absolute paths enter generated output.\n\n';
  s += `diff.json SHA-256: \`${sha}\`.\n`;
  return s;
}
const json = JSON.stringify(output, null, 2) + '\n';
const sha = crypto.createHash('sha256').update(json).digest('hex');
fs.writeFileSync(path.join(__dirname, 'diff.json'), json);
fs.writeFileSync(path.join(__dirname, 'report.md'), render(output, sha));
if (process.argv.includes('--summary')) console.log(JSON.stringify({ counts: output.counts,
  agreement: { agreeing_cells: userAgreement.agreeing_cells, cells: userAgreement.cells, percent: userAgreement.percent_cells, fully_agreeing_products: userAgreement.products_fully_agreeing },
  hold: { all_agree: hold.identical_all_records, emitted: hold.products_where_either_emits_a_level, mismatches: hold.mismatches },
  ruling_effects: rulingEffects.map(x => ({ slug: x.slug, A_landed: x.A_landed, B_landed: x.B_landed })), lock_verdict: verdict, sha256: sha }, null, 2));
if (process.argv.includes('--dump')) for (const d of discrepancies) console.log(JSON.stringify({ slug: d.slug, field: d.field, A: d.A, B: d.B, classification: d.classification, right_lane: d.right_lane }));
