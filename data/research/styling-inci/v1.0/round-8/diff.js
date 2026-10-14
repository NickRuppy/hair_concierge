#!/usr/bin/env node
'use strict';
// Adapted from round-7/diff.js: frozen bijective join, semantic normalization,
// separate user-facing/log cells, evidence-conditioned adjudication and hold check.
// Targeted r8 only. No timestamps, randomness or preset empirical counts/verdicts.
// Usage: node data/research/styling-inci/v1.0/round-8/diff.js [--summary] [--dump]
// Writes ONLY sibling diff.json and report.md; inputs are never rewritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r8/results.json');
const B = read('blind-lane-B-r8/results.json');
const C = read('r8/cohort.json');
const SCOPE = read('r8/scope-audit.json');
const FREEZE = read('r8/artifact-manifest.json');
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for (const artifact of FREEZE.artifacts) {
  if (digest(path.join(ROOT, artifact.path)) !== artifact.sha256) throw Error(`Frozen bytes changed: ${artifact.path}`);
}
const selected = SCOPE.records.filter(r => r.included);
if (selected.length !== SCOPE.selected_records || selected.length !== C.records.length || SCOPE.records.length !== SCOPE.screened_records ||
    !eqSlugs(selected.map(r => r.source_slug), C.records.map(r => r.source_slug))) throw Error('Scope-audit/cohort coverage differs');
function eqSlugs(a, b) { return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()); }
const scopeBySlug = new Map(selected.map(r => [r.source_slug, r]));
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
const am = mapRecords(A, C, 'A8'), bm = mapRecords(B, C, 'B8');
const idm = new Map(C.id_map.map(r => [r.sample_id, r]));
if (idm.size !== C.id_map.length || idm.size !== C.records.length || new Set(C.records.map(r => r.source_slug)).size !== C.records.length) throw Error('cohort map is not bijective');
const packet = (kind, id) => read(`r8/packets/${kind}/${id}.json`);
const rows = C.records.map(c => {
  const m = idm.get(c.sample_id);
  if (m?.source_slug !== c.source_slug) throw Error(`r8 ID/slug mapping broken: ${c.source_slug}`);
  const scope = scopeBySlug.get(c.source_slug);
  if (!eqSlugs(scope.reasons.map(x => x.class), c.history.round8.reason_classes)) throw Error(`Scope reasons differ: ${c.source_slug}`);
  const rawA = am.get(c.sample_id), rawB = bm.get(c.sample_id);
  const s0 = packet('s0', c.sample_id), fu = packet('fu', c.sample_id), claims = packet('claims', c.sample_id);
  for (const p of [s0, fu, claims]) if (p.sample_id !== c.sample_id || p.packet_version !== C.standard_version) throw Error(`Packet binding/version mismatch ${c.sample_id}`);
  return { id: c.sample_id, slug: m.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role, reason_classes: c.history.round8.reason_classes, scope_evidence: scope, rawA, rawB, A: normalize(rawA), B: normalize(rawB), s0, fu, claims };
}).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySlug = new Map(rows.map(r => [r.slug, r]));
const doc = p => fs.readFileSync(path.join(REPO, p), 'utf8');
const PROPERTY = 'docs/research/styling-inci/v1.0/01_property-set-v0.md';
function ref(p, section, quote) {
  const lines = doc(p).split('\n');
  const sectionNumber = section.match(/^§(\d+(?:\.\d+)?)/)?.[1];
  const start = sectionNumber ? lines.findIndex(l => l.startsWith(`### ${sectionNumber} `) || l.startsWith(`## ${sectionNumber}. `)) : 0;
  if (start < 0) throw Error(`Section absent: ${p}: ${section}`);
  const index = lines.findIndex((l, i) => i >= start && l.includes(quote));
  if (index < 0) throw Error(`Rule quote missing: ${p}: ${quote}`);
  return { path: p, line: index + 1, section, matched_fragment: quote, quote: lines[index] };
}
const job = quote => ref(STANDARD, '§6.10', quote);
const firstJob = job('the first **job-bearing** phrase of the lead promise');
const order = job('the confirmed name\'s job words first (after the primary, in name order), then the C1/C2 promise lines in packet order, each line\'s job words in text order');
const unblind = ref(STANDARD, '§10.2 claim normalisation', '| **Claim normalisation** (two independent passes; PH1-11 (c))');
const r6q1 = ref(LEDGER, 'R6-Q1', '| R6-Q1 |');
const r6t = ref(LEDGER, 'R6-T', '| R6-T |');
const r7f = ref(LEDGER, 'R7-F', '| R7-F |');
const r7q1 = ref(LEDGER, 'R7-Q1', '| R7-Q1 |');
const r7q2 = ref(LEDGER, 'R7-Q2', '| R7-Q2 |');
const r7q3 = ref(LEDGER, 'R7-Q3', '| R7-Q3 |');
const lockRules = [ref(LEDGER, 'R3-L', '| R3-L |'), ref(LEDGER, 'R4-L', '| R4-L |'), ref(LEDGER, 'LOCK-1-S', '| LOCK-1-S |')];
const jobGate = job('A failing secondary is **dropped and recorded**');
const nounJob = job('a product noun states `hold_fix` (molding/hold)');
const powderNoun = ref(STANDARD, '§4.2 name jobs', 'Haarspray, Gel, Wachs, Puder, Schaumfestiger');
const oneName = ref(STANDARD, '§4.2 lead precedence', 'when the confirmed name names exactly one job');
const finishNoun = ref(STANDARD, '§4.2 shine nouns', 'with the R2-Q3 list: Glanz, Shine, Gloss, Finish');
const creamMoment = ref(STANDARD, '§6.11', 'a paste, wax, cream or powder worked into dry hair by hand is `dry_restyle`');
const emission = ref(STANDARD, '§4.7', '| `styling` | full record');
const finishRule = ref(STANDARD, '§6.8', 'Lexicon on C1/C2 text incl. the confirmed name');
const profileRules = {
  route: [r7q1, oneName, ref(STANDARD, '§4.3 3.2', 'directions/promise positioned on oil absorption or cleansing')],
  subtype: [ref(STANDARD, '§5', 'a powder dispensed as an aerosol spray is `texture_spray`')],
  weight: [ref(STANDARD, '§6.3', 'no persistent family above T_S and no LGN pair')],
  finish: [ref(STANDARD, '§6.8', '**Unclaimed ⇒ `unbekannt`, never formula-derived**')],
  flexibility: [ref(STANDARD, '§6.9', 'neither ⇒ `unbekannt`')],
  target_zone: [ref(STANDARD, '§6.12', 'The main required application controls `target_zone`')],
  application_moment: [ref(STANDARD, '§6.11', '**`dry_restyle` needs a named shaping act')],
  primary_job: [r7q1, oneName, firstJob],
  secondary_jobs: [jobGate, order],
  provides_heat_protection: [ref(STANDARD, '§6.7', 'No claim + L9 member ⇒ `false`')],
  heat_activated: [ref(STANDARD, '§6.13', '`no` also when directions give heat no role')],
  alcohol_note: [ref(STANDARD, '§6.5', 'first 3 declared ingredients')],
  buildup_note: [ref(STANDARD, '§6.4', 'fires when **limb 1**')],
};
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
const bigHairCorrect = {
  route: { destination: 'styling', state: 'committed', boundary_reason: null }, subtype: 'texture_spray',
  weight: 'light', finish: 'unbekannt', flexibility: 'unbekannt', target_zone: 'roots', application_moment: 'dry_restyle',
  primary_job: 'volume', secondary_jobs: [], provides_heat_protection: false, heat_activated: 'no', alcohol_note: 'fires', buildup_note: 'does_not_fire',
};
function proven(r, field, lane, correct_value, rules, explanation, extra = {}) {
  if (!eq(r[lane][field], correct_value)) throw Error(`Correct lane differs from rule-derived expectation: ${r.slug}::${field}`);
  return decision('a', lane, rules, explanation, { correct_value, ...extra });
}
function adjudicate(r, field) {
  if (r.slug === 'balea-men-styling-powder' && ['primary_job', 'secondary_jobs'].includes(field)) {
    const evidence = requireClaim(r, /Für Volumen & Textur/);
    if (!/Powder/i.test(r.s0.product.confirmed_name)) throw Error('Powder name absent');
    return proven(r, field, 'B', field === 'primary_job' ? 'hold_fix' : set(['volume','texture']), [powderNoun,nounJob,oneName,r7f,order,jobGate],
      '§4.2 explicitly includes Puder as a job-bearing product-type noun; §6.10 maps a product noun to hold_fix. The short illustrative molding-noun list is not an exception to this generic rule. Styling Powder therefore supplies a vocabulary job and R7-F cannot skip it. B hold_fix is primary; the C2 promise supplies volume then texture, both passing particulate/natural_film gates. A incorrectly falls through to the later volume promise and moves the real primary hold_fix into secondary jobs.', { evidence });
  }
  if (r.slug === 'bali-curls-volumizing-curl-spray-refreshing' && field === 'secondary_jobs') {
    const evidence = requireClaim(r, /Beachlook/);
    return proven(r,field,'A',set(['volume','texture']),[ref(LEDGER,'R4-Q2','| R4-Q2 |'),ref(STANDARD,'§4.2 beach look','salt-spray texture look'),order,jobGate],
      'The confirmed Volumizing Curl Spray name supplies volume after the curl-revival refresh primary. The explicit C2 Beachlook is the ruled beach texture look, not curl definition; it supplies the next texture candidate. Magnesium Sulfate r2 supplies salt, passing both gates. B omits the explicit texture candidate.',{evidence});
  }
  if (r.slug === 'cantu-lockenspray-comeback-curl-next-day' && field === 'finish') {
    const evidence = requireClaim(r,/refreshes curls & adds shine/);
    return proven(r,field,'A','glänzend',[finishRule,ref(STANDARD,'§2.2 A13','whatever its language')],
      'The frozen German-market pack claim is C1 even though it is English: adds shine explicitly sets glänzend. The secondary shine job fails the humectant_only formula gate in both lanes; that gate does not suppress the independent claim-only finish. B omits the finish evidence.',{evidence});
  }
  if (r.slug === 'got2b-gotgloss-glanz-spray' && field === 'secondary_jobs') {
    const evidence = requireClaim(r,/Bis zu 48h Frizz-Effekt/,'humidity');
    return proven(r,field,'A',[],[job('Humidity and duration lines never state a job; an explicit anti-frizz word in them does')],
      'The typed humidity line says Frizz-Effekt, without anti-frizz, reduction, taming or protection against frizz. The exception requires an explicit anti-frizz direction, not bare Frizz. B adds a direction not stated in the frozen packet. There is no evidence that the captured quotation is wrong, so this is a lane error, not a packet issue.',{evidence});
  }
  if (r.slug === 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme') {
    const evidence = requireClaim(r,/Glättet abstehende Haare/);
    if (field === 'application_moment') return proven(r,field,'B','dry_restyle',[creamMoment],
      'The required directions say to rub between the palms and distribute in dry hair. This is the express cream-worked-in-by-hand dry_restyle case; a finishing purpose does not override that required act. A dry_finish misses the specific rule.',{evidence, directions_evidence:r.fu.directions});
    if (['primary_job','secondary_jobs'].includes(field)) return proven(r,field,'A',field==='primary_job'?'shine':['frizz_control'],[r7q3,finishNoun,oneName,order,jobGate],
      'Frizz Ease is excluded, Seiden is a feel modifier and Zauberformel a formula label; Finish remains the product own shine job noun. The one-job confirmed name leads before C2 sentences. Thus A shine is primary and Glättet abstehende Haare/bändigt Frizz supplies frizz_control secondary, passing wax_lipid/silicone_coat. The §6.10 flyaway example maps that sentence to frizz_control but does not name it the primary or override name precedence. B wrongly promotes the later sentence over the name.',{evidence});
  }
  if (r.slug === 'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray' && Object.hasOwn(bigHairCorrect,field)) {
    const evidence = requireClaim(r,/ERFRISCHENDES VOLUMEN SPRAY/);
    return proven(r,field,'A',bigHairCorrect[field],[r7q1,oneName,emission,...profileRules[field]],
      'The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.',{evidence, directions_evidence:r.fu.directions, underlying_issue:'Big Hair Day route; each changed user-facing field is counted separately'});
  }
  if (r.slug === 'moroccanoil-glaettende-creme-smoothing-lotion' && field === 'route') {
    const evidence = requireClaim(r,/Geschmeidigkeit und Definition/);
    return proven(r,field,'B',{destination:'leave_in',state:'route:leave_in',boundary_reason:null},[r7q2,ref(STANDARD,'authority','— **governs**'),ref(STANDARD,'§4.2 definition half','an explicit promise to define or shape curls or waves'),ref(STANDARD,'§4.3 3.4(iii)','if D6 does not fire ⇒ `leave_in`')],
      'Generic hair Definition followed by a separate suitability statement Ideal für lockiges Haar does not explicitly promise to define/shape curls or waves. Governing R7-Q2 removes the old care-plus-definition mixed reading. With substantive care and no qualifying fixative the border routes Leave-in. B follows the ledger; A follows the stale specific mixed example. The hierarchy is explicit and no owner registry exception names this product, so the stale example is a documentation correction rather than an unresolved policy choice.',{evidence,stale_example:ref(STANDARD,'§4.2 stale example','is `mixed` (care job „pflegen" + „Definition" for curly hair)')});
  }
  if (r.slug === 'neqi-diamond-glass-styling-spray-all' && ['primary_job','secondary_jobs'].includes(field)) {
    const evidence = requireClaim(r,/intensiv glänzenden, glatten/);
    return proven(r,field,'A',field==='primary_job'?'sleek':['frizz_control'],[r7q1,firstJob,job('`sleek` only for a smooth or straight result of the whole style'),order,jobGate],
      'R7-Q1 is written as a general adjective-before-job-phrase rule, not a Wellaflex-only exception. In the C2 lead intensiv glänzenden qualifies the following glatten Glass Hair-Effekt job phrase; it does not supply a separate earlier shine job. The smooth whole-style result supplies sleek; reduziert Frizz supplies the eligible frizz_control secondary via silicone_coat. Shine remains finish evidence under §6.8. B repeats the superseded pre-R7 separate-adjective job reading; A applies the governing amendment.',{evidence});
  }
  throw Error(`Unadjudicated USER-FACING difference ${r.slug}::${field}`);
}
const discrepancies = rows.flatMap(r => USER.filter(f => !eq(r.A[f], r.B[f])).map(field => ({
  slug:r.slug,id:r.id,name:r.name,reason_classes:r.reason_classes,field,
  A:r.A[field],B:r.B[field],A_trace:trace(r.rawA),B_trace:trace(r.rawB),
  packet_paths:Object.fromEntries(['s0','fu','claims'].map(k=>[k,`data/research/styling-inci/v1.0/r8/packets/${k}/${r.id}.json`])),
  packet_evidence:{name:r.s0.product,directions:r.s0.directions,s0_promises:r.s0.promise_claims_c1_c2,claims:r.claims.claims},
  ...adjudicate(r,field),
})));
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
const heldRoute = {destination:'provisional_boundary',state:'held',boundary_reason:'pending_leave_in_addendum'};
const rulingSpecs = [
  ['R7-Q1','wellaflex-schaumfestiger-locken-und-wellen-starker-halt',{primary_job:'definition'},r7q1],
  ['R7-Q2','kevin-murphy-killer-curls',{secondary_jobs_includes:'definition'},r7q2],
  ['R7-Q2','bali-gents-sea-salt-spray',{secondary_jobs_excludes:'definition'},r7q2],
  ['R7-Q2','balea-leave-in-spray-sea-salt-care-define',{secondary_jobs_excludes:'definition'},r7q2],
  ['R7-F','neqi-diamond-glass-ultimate-styling-spray',{primary_job:null},r7f],
  ['M2','maria-nila-curlicue-cream',{secondary_jobs_includes:'hold_fix'},ref(STANDARD,'§11.3','secondaries `volume`')],
  ['M2','bumble-and-bumble-brilliantine',{primary_job:'shine'},ref(STANDARD,'§11.8','primary `shine` from the one-job C1 name')],
  ['M2','balea-men-pomade-haar-bart-2in1',{secondary_jobs_excludes:'definition'},ref(STANDARD,'§11.9','no secondaries (no explicit curl/wave definition promise')],
  ['R6-Q1','john-frieda-frizz-ease-unendlich-smooth-blow-out-spray',{route:heldRoute,subtype:'smoothing_styler'},r6q1],
  ['R6-Q1','neqi-diamond-glass-ultimate-styling-spray',{route:heldRoute,subtype:'smoothing_styler'},r6q1],
  ['R6-Q1','neqi-diamond-glass-styling-spray-all',{route:heldRoute,subtype:'smoothing_styler'},r6q1],
  ['R6-T (1)','balea-pure-styling-volumenpuder-spray',{target_zone:'roots'},r6t],
  ['R6-T (2)','redken-root-tease',{target_zone:'all'},r6t],
  ['R6-T (3)','alverde-beach-waves-spray-seaside-balance',{secondary_jobs_excludes:'definition'},r6t],
];
// R7-Q3 outcome check: candidates independently justified by own name/promise text,
// not the collection. This tests absence of collection-only jobs, not final job order.
// Source traces are retained; gated records cannot prove latent name parsing.
const collectionSpecs = [
  ['balea-professional-definier-spray-traumlocken','Traumlocken',['definition'], 'Definier Spray names definition; Leave-in suppresses the Styling profile.'],
  ['balea-professional-styling-cream-traumlocken','Traumlocken',['definition','frizz_control','shine'], 'Styling Cream is generic; explicit C1 defined curls leads.'],
  ['john-frieda-frizz-ease-traumlocken-lockencreme','Frizz Ease / Traumlocken',['definition','frizz_control'], 'Own Lockencreme supplies definition; explicit Verhindert Frizz supplies secondary.'],
  ['john-frieda-traumlocken-belebender-wellenauffrischer','Traumlocken',[], 'Own Wellenauffrischer is refresh, but named mixed route suppresses profile.'],
  ['john-frieda-volume-lift-pushed-up-dry-texture-spray','Volume Lift',['texture','volume'], 'Own Dry Texture leads; explicit C1 Fülle und Volumen supplies volume.'],
  ['john-frieda-volume-lift-ansatz-booster','Volume Lift',[], 'Formula-conflict gate suppresses all Styling jobs before name parsing.'],
  ['garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray','Diamond Sleek',[], 'Own Glättungsspray names sleek; substantive care routes Leave-in and suppresses Styling jobs.'],
  ['john-frieda-frizz-ease-unendlich-smooth-blow-out-spray','Frizz Ease',['sleek','frizz_control','shine'], 'Own Smooth supplies sleek; separate C2 body promises frizz control and shine.'],
  ['john-frieda-frizz-ease-zauberformel-seiden-finish-creme','Frizz Ease',['shine','frizz_control'], 'Own Finish and explicit flyaway sentence supply jobs. Both exclude the collection; their name-versus-sentence order dispute is adjudicated separately.'],
  ['john-frieda-frizz-ease-3-tage-glatt-styling-spray','Frizz Ease',[], 'Own 3-Tage-Glatt names sleek; li_g0_provisional suppresses Styling profile.'],
  ['john-frieda-haarserum-frizz-ease-der-baendiger','Frizz Ease',[], 'Own Serum plus explicit anti-frizz promise routes Oil, suppressing Styling jobs.'],
  ['balea-professional-glow-und-shine-finishing-spray','Glow & Shine',['shine','frizz_control'], 'Own Finishing Spray supplies shine; explicit C2 anti-frizz supplies secondary.'],
  ['balea-professional-haarserum-glow-und-shine','Glow & Shine',[], 'Own Haarserum plus explicit finish line reaches aqueous-conditioner Leave-in exception.'],
  ['wella-eimi-nutricurls-curl-shaper','Nutricurls',['definition','hold_fix','frizz_control'], 'Own Curl Shaper and C2 hold/anti-frizz supply jobs; collection adds none.'],
  ['wella-eimi-nutricurls-fresh-up','Nutricurls',[], 'Explicit C2 curl refresh supplies positioning; substantive care routes Leave-in, suppressing Styling jobs.'],
];
const collectionPrimary = {
  'balea-professional-styling-cream-traumlocken':'definition',
  'john-frieda-frizz-ease-traumlocken-lockencreme':'definition',
  'john-frieda-volume-lift-pushed-up-dry-texture-spray':'texture',
  'john-frieda-frizz-ease-unendlich-smooth-blow-out-spray':'sleek',
  'balea-professional-glow-und-shine-finishing-spray':'shine',
  'wella-eimi-nutricurls-curl-shaper':'definition',
};
const collectionSlugs = rows.filter(r => r.reason_classes.includes('R7-Q3-brand-line')).map(r=>r.slug);
if (!eqSlugs(collectionSlugs,collectionSpecs.map(x=>x[0]))) throw Error('R7-Q3 collection check does not cover all confirmed-line targets');
for (const [slug,collection,allowed,explanation] of collectionSpecs) {
  const expected = {jobs_allowed:set(allowed)};
  if (collectionPrimary[slug]) expected.primary_job=collectionPrimary[slug];
  else if (slug==='john-frieda-frizz-ease-zauberformel-seiden-finish-creme') expected.primary_job_any_of=['shine','frizz_control'];
  else expected.primary_job=null;
  rulingSpecs.push(['R7-Q3',slug,expected,r7q3,{collection,explanation}]);
}
const rulingEffects = rulingSpecs.map(([ruling,slug,expected,rule,context]) => {
  const r = bySlug.get(slug);
  if (!r) return {ruling,rule,slug,expected,present:false,A:null,B:null,A_landed:null,B_landed:null,remaining_user_disagreements:[],note:'Not present in frozen targeted r8; not scored or imported from r7.'};
  const keys = [...new Set(Object.keys(expected).flatMap(k=>k==='jobs_allowed'?['primary_job','secondary_jobs']:k==='primary_job_any_of'?['primary_job']:k.startsWith('secondary_jobs_')?['secondary_jobs']:[k]))];
  const actual = lane => Object.fromEntries(keys.map(k=>[k,r[lane][k]]));
  const lands = lane => Object.entries(expected).every(([k,v])=> {
    if (k==='primary_job_any_of') return v.includes(r[lane].primary_job);
    if (k==='jobs_allowed') return [r[lane].primary_job,...(r[lane].secondary_jobs || [])].filter(x=>x!=null).every(x=>v.includes(x));
    if (k==='secondary_jobs_excludes') return Array.isArray(r[lane].secondary_jobs)&&!r[lane].secondary_jobs.includes(v);
    if (k==='secondary_jobs_includes') return Array.isArray(r[lane].secondary_jobs)&&r[lane].secondary_jobs.includes(v);
    return eq(r[lane][k],v);
  });
  return {ruling,rule,slug,id:r.id,name:r.name,expected,present:true,A:actual('A'),B:actual('B'),A_landed:lands('A'),B_landed:lands('B'),
    remaining_user_disagreements:discrepancies.filter(d=>d.slug===slug).map(d=>d.field),
    ...(context?{...context,profile_emitted_A:prof(r.rawA),profile_emitted_B:prof(r.rawB),note:!prof(r.rawA)&&!prof(r.rawB)?'No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing.':'Allowed jobs have independent own-name/claim evidence; final order is scored separately.',A_trace:trace(r.rawA),B_trace:trace(r.rawB)}:{})};
});
// Explicit lane reports only; the legitimate internal hold_route ambiguous enum is not a rule-gap report.
function aReportedFields(slug,note) {
  const fields = {
    'john-frieda-frizz-ease-unendlich-smooth-blow-out-spray':['route','primary_job'],
    'john-frieda-frizz-ease-zauberformel-seiden-finish-creme':['primary_job','secondary_jobs'],
    'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray':['route'],
    'moroccanoil-glaettende-creme-smoothing-lotion':['route'],
    'neqi-diamond-glass-styling-spray-all':['primary_job','secondary_jobs'],
    'syoss-glaze-topcoat':['secondary_jobs'],
  };
  if (!fields[slug]) throw Error(`Unmapped lane-A reported ambiguity ${slug}: ${note}`);
  return fields[slug];
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
  if (/Ambiguity:|AMBIGUOUS ROUTE/i.test(note)) addReport('A', r, aReportedFields(r.slug, note), note);
}
for (const ambiguity of B.ambiguous_rules || []) {
  if ((ambiguity.impact || ambiguity.classification) !== 'user_facing') continue;
  const fields = /secondary|anti-frizz/i.test(ambiguity.rule) || /secondary_jobs/.test(ambiguity.applied || '') ? ['secondary_jobs'] : ['primary_job'];
  for (const id of ambiguity.records || ambiguity.record_ids || []) {
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
const inputPaths = ['blind-lane-A-r8/results.json', 'blind-lane-B-r8/results.json', 'r8/cohort.json', 'r8/FREEZE-NOTES.md', 'r8/scope-audit.json', 'r8/artifact-manifest.json', 'round-7/diff.js', 'round-8/diff.js'].map(p => path.join(ROOT, p));
for (const kind of ['s0', 'fu', 'claims']) for (const r of rows) inputPaths.push(path.join(ROOT, `r8/packets/${kind}/${r.id}.json`));
const docsDir = path.join(REPO, 'docs/research/styling-inci/v1.0');
inputPaths.push(...fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).map(f => path.join(docsDir, f)), path.join(REPO, LEDGER));
const manifest = inputPaths.sort().map(p => ({ path: path.relative(REPO, p), sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') }));
const output = {
  generated_by: 'data/research/styling-inci/v1.0/round-8/diff.js',
  method: 'TARGETED r8 re-check under R3-L/R4-L, LOCK-1-S, R6-Q1/R6-T and R7-F/R7-Q1/R7-Q2/R7-Q3; A=Claude Opus, B=Codex. Round-7 join, normalization and agreement method adapted. Raw disagreement counts are never altered by adjudication.',
  scope: { requested_records_in_step_1: 69, actual_frozen_r8_records: rows.length, previous_r7_records: read('r7/cohort.json').records.length, denominator_explanation: 'Step 1 names the historical r7 denominator (69); both r8 lanes, cohort and scope audit contain 76 records. All 76 are scored; no arbitrary seven products are dropped.', screened_records: SCOPE.screened_records, selected_records: selected.length, verified_frozen_artifacts: FREEZE.artifacts.length }, inputs: manifest, normalisation: NORMALISATION, lock_rules: lockRules,
  counts: { records: rows.length, by_role: tally(rows, 'role'), by_target_reason: tally(rows.flatMap(r => r.reason_classes), x => x),
    user_facing_disagreement_cells: discrepancies.length, user_facing_disagreement_products: new Set(discrepancies.map(d => d.slug)).size,
    by_classification: classified, lane_error_cells_by_wrong_lane: tally(discrepancies.filter(d => d.classification === 'a'), d => d.right_lane === 'A' ? 'B' : 'A'),
    calculation_log_disagreement_cells: calculationDifferences.length, latent_reports: latent.length, latent_products: new Set(latent.map(x => x.slug)).size },
  user_facing_agreement: userAgreement, calculation_log_agreement: logAgreement,
  disagreements: discrepancies, lane_errors: discrepancies.filter(d => d.classification === 'a'), rule_gaps: discrepancies.filter(d => d.classification === 'b'), packet_issues: discrepancies.filter(d => d.classification === 'c'), owner_questions: discrepancies.filter(d => d.classification === 'd'),
  calculation_log_disagreements: calculationDifferences, reported_ambiguities: reported, latent_ambiguities: latent,
  lane_B_calculation_log_ambiguities: (B.ambiguous_rules || []).filter(a => (a.impact || a.classification) === 'calculation_log'),
  ruling_effects: rulingEffects, hold_check: hold, lock_criteria: criteria, lock_verdict: verdict,
  lock_reason: blockers.length ? `User-facing unresolved cells: ${blockers.map(d => `${d.slug}::${d.field} (${d.classification})`).join('; ')}. Only a disagreements are allowed by the targeted lock criterion.` : 'Every user-facing difference is a proven lane error; no b/c/d user-facing cells remain.',
  products: rows.map(r => ({ id: r.id, slug: r.slug, name: r.name, role: r.role, targeted_reasons: r.reason_classes, scope_audit_evidence: r.scope_evidence,
    A: Object.fromEntries(USER.map(f => [f, r.A[f]])), B: Object.fromEntries(USER.map(f => [f, r.B[f]])),
    fully_agreeing: USER.every(f => eq(r.A[f], r.B[f])), disagreement_fields: USER.filter(f => !eq(r.A[f], r.B[f])) })),
  limitations: ['Targeted known-product confirmation; not a full new cohort, new unseen validation, catalog activation or live-app proof.', 'Human interpretation and proposed contract text are explicit. Joins, normalization, field/product counts, classifications tallies, ruling pass flags, hold counts, manifests and verdict are computed.', 'This scores lock readiness; it does not rewrite LOCK-1-S, owner approvals, frozen lane values or engine status.', 'Calculation-log differences and lane-reported latent ambiguities do not block. No subtype minimum or historical unseen gate is added to the user-specified targeted lock rule.', 'Agreement is not proof against shared mistakes. Named ruling effects are checked separately; hold_check is a raw A/B agreement check with frozen claim traces, not a newly implemented independent hold classifier.'],
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
    if (d.stale_example) s += `**Stale worked example:** ${ruleLabel(d.stale_example)}; the explicit current rule and governing ledger take precedence.\n\n`;
    s += `**Frozen evidence:** ${d.evidence.map(c => `“${c.text}” (${c.tier}, ${c.type})`).join('; ')}. Packet: \`${d.packet_paths.claims}\`.\n\n`;
    return s;
  }).join('');
}
function render(d, sha) {
  const u = d.user_facing_agreement, n = d.counts, h = d.hold_check;
  let s = '# Styling v1.0 — TARGETED final re-check, cohort r8\n\n';
  s += `**${u.agreeing_cells}/${u.cells} user-facing field cells agree (${u.percent_cells}%). ${u.products_fully_agreeing}/${n.records} products fully agree (${u.percent_products}%).** The denominator is ${n.records} products × ${u.fields} user-facing fields. Route includes held/committed state and boundary reason; application moment compares primary only.\n\n`;
  s += `Scope correction: step 1 says 69, the prior r7 cohort size. Frozen r8 and both lanes contain ${n.records} records; this report scores all of them, with no seven-product exclusion. ${d.scope.verified_frozen_artifacts} frozen artifacts match their manifest hashes; the selected scope-audit entries and reasons match the cohort.\n\n`;
  s += `**Lock verdict: ${d.lock_verdict}.** ${d.lock_reason}\n\n`;
  s += `${n.user_facing_disagreement_cells} disagreement cells on ${n.user_facing_disagreement_products} products: **a=${n.by_classification.a}, b=${n.by_classification.b}, c=${n.by_classification.c}, d=${n.by_classification.d}**. Lane errors by wrong lane: ${Object.entries(n.lane_error_cells_by_wrong_lane).map(([lane, count]) => `${lane}=${count}`).join(', ')}. Counts are field cells, not distinct policy issues; consequential secondary changes from a wrong primary remain separate cells.\n\n`;
  s += `Governing lock authority: ${d.lock_rules.map(ruleLabel).join('; ')}. The requested targeted-set criterion allows proven lane errors, requires zero b/c/d user-facing differences, and excludes calculation-log fields. Latent reports do not change this verdict.\n\n`;
  s += `## Ruling-effect check\n\n${d.ruling_effects.filter(x => x.present && x.A_landed && x.B_landed).length}/${d.ruling_effects.filter(x=>x.present).length} present named outcome checks pass in both lanes. This tests the specified ruling fields; it does not claim complete profile agreement on those products. R7-Q3 checks that emitted jobs have independent own-name/claim evidence; collection-only jobs are forbidden. Suppressed profiles cannot establish hidden name parsing. The two R6-T zone exemplars absent from r8 are explicitly N/A.\n\n| Ruling | Product / slug | Expected | A actual | B actual | Landed A / B | Other user disagreements / scope note |\n|---|---|---|---|---|---|---|\n`;
  for (const x of d.ruling_effects) s += `| ${x.ruling} | ${esc(x.name || x.slug)}<br>\`${x.slug}\` | ${val(x.expected)} | ${val(x.A)} | ${val(x.B)} | ${x.A_landed == null ? 'N/A' : x.A_landed ? 'yes' : '**NO**'} / ${x.B_landed == null ? 'N/A' : x.B_landed ? 'yes' : '**NO**'} | ${esc(x.remaining_user_disagreements.join(', ') || 'none')}${x.explanation ? '<br>'+esc(x.explanation) : ''}${x.note ? '<br>'+esc(x.note) : ''} |\n`;
  s += `\nR6/R7 sources: ${[r6q1,r6t,r7f,r7q1,r7q2,r7q3].map(ruleLabel).join('; ')}. Ultimate retains its frozen FX-1 member; the named owner override governs its route without changing ingredient membership.\n\n`;
  s += `## Rule gaps (b)\n\n${details(d.rule_gaps)}## Owner questions (d)\n\n${details(d.owner_questions)}## Packet issues (c)\n\n${details(d.packet_issues)}## Proven lane errors (a)\n\n${details(d.lane_errors)}`;
  s += `## Hold check\n\n**${h.identical_all_records}/${h.records} raw hold values agree**, including ${h.null_in_both} null/null pairs. **${h.identical_where_emitted}/${h.products_where_either_emits_a_level} agree where either lane emits a level; ${h.mismatches} mismatches.** ${h.method}\n\n| Value | Lane A count | Lane B count |\n|---|---|---|\n`;
  for (const k of [...new Set([...Object.keys(h.A_distribution), ...Object.keys(h.B_distribution)])].sort()) s += `| ${k} | ${h.A_distribution[k] || 0} | ${h.B_distribution[k] || 0} |\n`;
  s += '\n';
  if (h.mismatch_list.length) for (const x of h.mismatch_list) s += `- ${x.name} (\`${x.slug}\`): A=${val(x.A)}, B=${val(x.B)}.\n`;
  else s += 'Mismatch list: none. Per-product levels, routes, captured hold claims and lane bases are in diff.json.\n';
  s += `\n## Latent user-facing ambiguities — non-blocking\n\n${n.latent_reports} lane reports on ${n.latent_products} products agree in the reported fields. These observations are preserved without elevating them into demonstrated disagreement gaps. A latent secondary observation may coexist with an independently disputed primary on the same product.\n\n| Lane | Product / slug | Fields with agreed values | Lane-reported concern / applied reading |\n|---|---|---|---|\n`;
  for (const x of d.latent_ambiguities) s += `| ${x.lane} | ${esc(x.name || x.slug)}<br>\`${x.slug}\` | ${val(x.A)} | ${esc(typeof x.report === 'string' ? x.report : `${x.report.rule}: ${x.report.reason}${x.report.applied ? ' Applied: '+x.report.applied : ''}`)} |\n`;
  s += `\nB's ${d.lane_B_calculation_log_ambiguities.length} explicitly calculation-log ambiguity report(s) are retained separately. A's legitimate hold_route ambiguous enum is not counted as a new rule report. Moroccanoil's stale mixed example is adjudicated above against governing R7-Q2. Lane B labels that concern calculation-log, but the actual route difference is independently counted user-facing. Reported concerns on disputed fields are retained in reported_ambiguities and are not latent.\n\n`;
  s += '## Agreement and normalization\n\n### User-facing fields\n\n| Field | Agree / all | % | Disagree | Agree / emitted by either | Emitted % |\n|---|---|---|---|---|---|\n';
  for (const f of u.field_agreement) s += `| ${f.field} | ${f.agree}/${f.records} | ${f.percent} | ${f.disagree} | ${f.agree_where_emitted}/${f.emitted_by_either} | ${f.percent_where_emitted ?? '—'} |\n`;
  s += `\n### Products fully agreeing\n\n${u.fully_agreeing_slugs.map(slug => `- \`${slug}\``).join('\n')}\n\n### Normalization\n\n${d.normalisation.map(x => `- ${x}`).join('\n')}\n\n`;
  s += `### Calculation-log fields — non-blocking\n\n${d.calculation_log_agreement.agreeing_cells}/${d.calculation_log_agreement.cells} cells agree (${d.calculation_log_agreement.percent_cells}%). This mechanical diagnostic compares free-text traces and asymmetric schemas; it is not a behavioral quality score. All log discrepancies are retained in diff.json.\n\n| Field | Agree / all | Disagree |\n|---|---|---|\n`;
  for (const f of d.calculation_log_agreement.field_agreement) s += `| ${f.field} | ${f.agree}/${f.records} | ${f.disagree} |\n`;
  s += '\n## Targeted lock criteria\n\n| Criterion | Result |\n|---|---|\n';
  for (const c of d.lock_criteria) s += `| ${c.criterion} | **${c.met ? 'PASS' : 'FAIL'}** |\n`;
  s += `\n**${d.lock_verdict}:** ${d.lock_reason}\n\n## Scope and reproduction\n\n${d.limitations.map(x => `- ${x}`).join('\n')}\n\n`;
  s += 'The script rejects duplicate/missing/extra IDs, broken slug joins, packet binding/version mismatches, absent quoted rule evidence and unadjudicated new user-facing differences. Fixed input SHA-256 values are recorded in diff.json. It writes only sibling diff.json and report.md.\n\n';
  s += 'Run `node data/research/styling-inci/v1.0/round-8/diff.js --summary` twice, then compare `shasum -a 256 data/research/styling-inci/v1.0/round-8/diff.json`. No timestamps, randomness or absolute paths enter generated output.\n\n';
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
  ruling_effects: {present:rulingEffects.filter(x=>x.present).length,both_landed:rulingEffects.filter(x=>x.present&&x.A_landed&&x.B_landed).length,absent:rulingEffects.filter(x=>!x.present).map(x=>x.slug)}, lock_verdict: verdict, sha256: sha }, null, 2));
if (process.argv.includes('--dump')) for (const d of discrepancies) console.log(JSON.stringify({ slug: d.slug, field: d.field, A: d.A, B: d.B, classification: d.classification, right_lane: d.right_lane }));
