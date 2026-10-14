#!/usr/bin/env node
'use strict';
// Adapted from round-8/diff.js: frozen bijective join, semantic normalization,
// separate user-facing/log cells, evidence-conditioned adjudication and hold check.
// MINI r9 only. No timestamps, randomness or preset empirical counts/verdicts.
// Usage: node data/research/styling-inci/v1.0/round-9/diff.js [--summary] [--dump]
// Writes ONLY sibling diff.json and report.md; inputs are never rewritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r9/results.json');
const B = read('blind-lane-B-r9/results.json');
const C = read('r9/cohort.json');
const SCOPE = read('r9/scope-audit.json');
const FREEZE = read('r9/artifact-manifest.json');
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
const informational = r => r.informational_and_non_authoritative === true || r.notes?.informational_and_non_authoritative === true;
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
  'buildup/alcohol notes: false, {fired:false}, not_fired and does_not_fire -> does_not_fire; true, {fired:true}, fired and fires -> fires. null remains null.',
  'Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.',
  'neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.',
  'Empty secondary_jobs/d8b_flags and null are equivalent only without a Styling profile (§4.7). Optional non-Styling observations are excluded only with explicit informational_and_non_authoritative:true, at record level or in notes. Route and subtype remain scoreable; held profiles are never masked. Raw values and each exclusion remain in the normalization audit.',
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
    o[f] = v === true || v === 'fired' ? 'fires' : v === false || v === 'not_fired' ? 'does_not_fire' : v ?? null;
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
  if (informational(r)) {
    if (!['leave_in','oil','heat_protectant','dry_shampoo'].includes(r.route)) throw Error(`Illegal informational suppression on ${r.id}`);
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
const am = mapRecords(A, C, 'A9'), bm = mapRecords(B, C, 'B9');
const idm = new Map(C.id_map.map(r => [r.sample_id, r]));
if (idm.size !== C.id_map.length || idm.size !== C.records.length || new Set(C.records.map(r => r.source_slug)).size !== C.records.length) throw Error('cohort map is not bijective');
const packet = (kind, id) => read(`r9/packets/${kind}/${id}.json`);
const rows = C.records.map(c => {
  const m = idm.get(c.sample_id);
  if (m?.source_slug !== c.source_slug) throw Error(`r9 ID/slug mapping broken: ${c.source_slug}`);
  const scope = scopeBySlug.get(c.source_slug);
  if (!eqSlugs(scope.reasons.map(x => x.class), c.history.round9.reason_classes)) throw Error(`Scope reasons differ: ${c.source_slug}`);
  const rawA = am.get(c.sample_id), rawB = bm.get(c.sample_id);
  const s0 = packet('s0', c.sample_id), fu = packet('fu', c.sample_id), claims = packet('claims', c.sample_id);
  for (const p of [s0, fu, claims]) if (p.sample_id !== c.sample_id || p.packet_version !== C.standard_version) throw Error(`Packet binding/version mismatch ${c.sample_id}`);
  return { id: c.sample_id, slug: m.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role, reason_classes: c.history.round9.reason_classes, scope_evidence: scope, rawA, rawB, A: normalize(rawA), B: normalize(rawB), s0, fu, claims };
}).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySlug = new Map(rows.map(r => [r.slug, r]));
// R9-P: historical quotations and their provenance stay bound to the scored revision.
// r9: commit adding round-9/diff.json.
const RULE_REVISION = '87e98086a7614a34e1705a1f1bd952535d43e1d0';
const revisionFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', RULE_REVISION, 'docs/research/styling-inci/v1.0'], { cwd: REPO, encoding: 'utf8' }).trim().split('\n').filter(p => p.endsWith('.md'));
const revisionCache = new Map();
const pinnedBytes = p => {
  if (!revisionCache.has(p)) revisionCache.set(p, execFileSync('git', ['show', `${RULE_REVISION}:${p}`], { cwd: REPO }));
  return revisionCache.get(p);
};
const doc = p => pinnedBytes(p).toString('utf8');
// Historical manifests fingerprint the scored docs/ledger and adapted scorers,
// while frozen data are still read and checked from the working tree.
const provenanceBytes = p => {
  const rel = path.relative(REPO, p).split(path.sep).join('/');
  return revisionFiles.includes(rel) || rel === LEDGER || /^data\/research\/styling-inci\/v1\.0\/round-\d+\/diff\.js$/.test(rel) ? pinnedBytes(rel) : fs.readFileSync(p);
};
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
// Analyst judgments are evidence-conditioned below. Unknown differences fail closed;
// neither an agreeing value nor a lane's self-reported ambiguity is itself an oracle.
const emissionRule = ref(STANDARD, '§4.7', 'Styling properties **optional and marked');
const r8q1 = ref(LEDGER, 'R8-Q1', '| R8-Q1 |');
const r8q2 = ref(LEDGER, 'R8-Q2', '| R8-Q2 |');
const r8h = ref(LEDGER, 'R8-H', '| R8-H |');
const jobRule = ref(STANDARD, '§6.10', 'texture/grip promised in a C1/C2 line is an eligible secondary');
const jobOrder = ref(STANDARD, '§6.10', 'then the C1/C2 promise lines in packet order');
const lockRules = [ref(LEDGER, 'R3-L', '| R3-L |'), ref(LEDGER, 'R4-L', '| R4-L |')];
const trace = r => Object.fromEntries(['reason_code','boundary_reason','rule_path','hold_basis','notes'].map(f=>[f,r[f]??null]));
const claims12 = r => r.claims.claims.filter(c=>/^C[12]/.test(c.tier || ''));
function evidence(r, pattern) {
  const found = claims12(r).filter(c=>pattern.test(c.text));
  if (!found.length) throw Error(`Missing expected packet evidence ${r.slug}: ${pattern}`);
  return found;
}
function adjudicate(r, field) {
  // This confirmation set currently has no authoritative disagreements. Do not
  // fabricate an a/b/c/d decision for a changed/future input without reviewing it.
  throw Error(`Unadjudicated user-facing difference: ${r.slug}::${field}`);
}
const discrepancies = rows.flatMap(r=>USER.filter(f=>!eq(r.A[f],r.B[f])).map(field=>({
  slug:r.slug,id:r.id,name:r.name,field,A:r.A[field],B:r.B[field],...adjudicate(r,field)
})));
const calculationDifferences = rows.flatMap(r=>LOG.filter(f=>!eq(r.A[f],r.B[f])).map(field=>({
  slug:r.slug,id:r.id,field,A:r.A[field],B:r.B[field],blocks_lock:false
})));
const normalizationAudit = rows.flatMap(r=>['A','B'].map(lane=>({
  slug:r.slug,id:r.id,lane,route:r[lane].route,
  explicitly_informational:informational(r[`raw${lane}`]),
  marker_location: r[`raw${lane}`].informational_and_non_authoritative === true ? 'record' : r[`raw${lane}`].notes?.informational_and_non_authoritative === true ? 'notes' : null,
  rule:emissionRule,
  raw_user_fields:Object.fromEntries(USER.map(f=>[f,r[`raw${lane}`][f]??null])),
  normalized_user_fields:Object.fromEntries(USER.map(f=>[f,r[lane][f]])),
  excluded_informational_fields:informational(r[`raw${lane}`]) ? USER.filter(f=>!['route','subtype'].includes(f)&&r[`raw${lane}`][f]!=null) : []
})));
const userAgreement=agreement(rows,USER), logAgreement=agreement(rows,LOG);
const classified=Object.fromEntries(['a','b','c','d'].map(k=>[k,discrepancies.filter(d=>d.classification===k).length]));
function effect(r, ruling, expected, rules, explanation, extra={}) {
  const actual=lane=>Object.fromEntries(Object.keys(expected).map(k=>[k,r[lane][k]]));
  return {ruling,slug:r.slug,id:r.id,name:r.name,expected,A:actual('A'),B:actual('B'),
    A_landed:eq(actual('A'),expected),B_landed:eq(actual('B'),expected),rules,explanation,...extra};
}
const big=bySlug.get('loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray');
const moroc=bySlug.get('moroccanoil-glaettende-creme-smoothing-lotion');
if (!big || !moroc) throw Error('Missing named ruling exemplars');
const rulingEffects=[
  effect(big,'R8-Q1',{route:{destination:'dry_shampoo',state:'route:dry_shampoo',boundary_reason:null}},[r8q1],
    'Refresh between washes alongside volume triggers the Dry Shampoo tie even with a volume-first name.',{evidence:evidence(big,/frischeres Haargefühl/)}),
  effect(moroc,'R8-H',{route:{destination:'leave_in',state:'route:leave_in',boundary_reason:null}},[r8h],
    'Generic Definition for krauses Haar plus separate curl suitability is no curl-definition promise. No mixed stop: border rule 3.4(iii) routes Leave-in.',{evidence:evidence(moroc,/Geschmeidigkeit und Definition/),A_trace:trace(moroc.rawA),B_trace:trace(moroc.rawB)})
];
const powders=rows.filter(r=>r.reason_classes.includes('R8-Q2-hair-powder'));
// Normative own-name/lead interpretations, not observed lane values or a preset
// verdict. Redken's two-job name falls to its explicit Griffigkeit lead.
const powderEffects=powders.map(r=>{
  const blocked=['A','B'].every(l=>r[l].route.state==='blocked:formula_conflict');
  if (blocked) return {ruling:'R8-Q2',slug:r.slug,id:r.id,name:r.name,applicable:false,
    expected:{primary_job:null,secondary_jobs:null},A:{primary_job:r.A.primary_job,secondary_jobs:r.A.secondary_jobs},B:{primary_job:r.B.primary_job,secondary_jobs:r.B.secondary_jobs},
    A_landed:r.A.primary_job===null&&r.A.secondary_jobs===null,B_landed:r.B.primary_job===null&&r.B.secondary_jobs===null,
    rules:[r8q2,emissionRule],explanation:'Formula conflict stops S0 before a Styling profile. Powder noun mapping is not observable; suppression is checked, never counted as a volume-primary success.'};
  const redken=r.slug==='redken-powder-grip-03';
  if(redken) evidence(r,/FÜR MEHR GRIFFIGKEIT/);
  if(r.slug==='moroccanoil-textur-und-volumenpuder') evidence(r,/Volumen/i);
  const textureClaims=claims12(r).filter(c=>/textur|griffig|\bgrip\b/i.test(c.text));
  const nameTexture=/textur|\bgrip\b/i.test(r.s0.product.confirmed_name);
  const textureSecondaryRequired=!redken&&(nameTexture||textureClaims.length>0);
  const primaryExpected=redken?'texture':'volume';
  const primary=Object.fromEntries(['A','B'].map(l=>[l,r[l].primary_job===primaryExpected]));
  const secondary=Object.fromEntries(['A','B'].map(l=>[l,(!textureSecondaryRequired||r[l].secondary_jobs?.includes('texture'))&&(!redken||r[l].secondary_jobs?.includes('volume'))]));
  return {ruling:'R8-Q2',slug:r.slug,id:r.id,name:r.name,applicable:true,
    expected:{primary_job:primaryExpected,texture_secondary_required:textureSecondaryRequired,volume_secondary_required:redken},
    A:{primary_job:r.A.primary_job,secondary_jobs:r.A.secondary_jobs},B:{primary_job:r.B.primary_job,secondary_jobs:r.B.secondary_jobs},
    primary_A_landed:primary.A,primary_B_landed:primary.B,secondary_A_landed:secondary.A,secondary_B_landed:secondary.B,
    A_landed:primary.A&&secondary.A,B_landed:primary.B&&secondary.B,rules:[r8q2,jobRule],
    evidence:textureClaims,confirmed_name:r.s0.product.confirmed_name,
    explanation:redken?'Powder + Grip names two jobs; the C2 Griffigkeit lead gives texture primary, volume secondary.':
      textureSecondaryRequired?'Volume primary; explicitly promised texture/grip must remain an eligible secondary under R8-Q2, subject to gate and two slots.':
      'Volume primary. No explicit texture/grip promise in C1/C2; texture is not inferred from powder form or formula.'};
});
rulingEffects.push(...powderEffects);
const sharedErrors=[];
for(const x of powderEffects.filter(x=>x.applicable&&!x.A_landed&&!x.B_landed)) {
  const r=bySlug.get(x.slug);
  if(r.slug!=='balea-pure-styling-volumenpuder-spray'||!eq(r.A.secondary_jobs,['hold_fix'])||!eq(r.B.secondary_jobs,['hold_fix'])) throw Error(`Unreviewed shared ruling failure ${r.slug}`);
  const e=evidence(r,/griffige Textur direkt am Ansatz/);
  const particle=r.fu.inci.items.find(i=>/^silica$/i.test(i.inci));
  if(!particle || r.rawA.tail_markers?.T_S?.rank!=null || r.rawB.tail_markers?.T_S?.rank!=null) throw Error('Shared-error particulate/absent-tail evidence changed');
  sharedErrors.push({classification:'a',kind:'shared_lane_error',slug:r.slug,id:r.id,name:r.name,field:'secondary_jobs',
    A:r.A.secondary_jobs,B:r.B.secondary_jobs,right_lane:'neither',wrong_lanes:['A','B'],correct_value:['hold_fix','texture'],
    counted_as_AB_disagreement:false,blocks_requested_disagreement_lock:false,
    rules:[r8q2,jobRule,jobOrder,ref(STANDARD,'§3.3','the whole list is above-tail')],evidence:e,formula_evidence:particle,
    explanation:'R8-Q2 is later, higher-authority and specific to powders: a C1/C2 line promising texture/grip qualifies. The legacy promise-only filter cannot exclude this exact promise merely because its packet type is other. Silica r7 is credited with no T_S present; particulate passes the texture gate and the second slot is free. Both lanes omit texture.',
    proposed_fix:'Add texture after hold_fix in both derived profiles; preserve frozen lane files. If guidance is clarified, state explicitly that R8-Q2 powder texture/grip eligibility includes C1/C2 other lines. No new owner policy is needed.'});
}
// Separate actual ambiguities in agreed values from concerns already settled by
// a clear governing rule. Never turn a shared error into an owner question.
const latent=[];
for(const r of rows) {
  const note=typeof r.rawA.notes==='string'?r.rawA.notes:'';
  if(r.slug==='bali-gents-haarpuder-volumizing-styling-powder'&&/strukturiert/i.test(note)) latent.push({slug:r.slug,id:r.id,name:r.name,field:'secondary_jobs',A:r.A.secondary_jobs,B:r.B.secondary_jobs,
    rules:[jobRule],evidence:evidence(r,/strukturierten Look/),blocks_lock:false,
    issue:'Does natürlich strukturierten Look explicitly promise the texture job? The vocabulary does not map strukturiert alone. The curl-specific definition rule does not settle this texture wording.',
    recommendation:'Retain the agreed omission pending an explicit vocabulary amendment; no texture is inferred from C3 grip claims.'});
  if(r.slug==='redken-powder-grip-03'&&/handback ambiguity/i.test(note)) latent.push({slug:r.slug,id:r.id,name:r.name,field:'flexibility',A:r.A.flexibility,B:r.B.flexibility,
    rules:[ref(STANDARD,'§6.9','`beweglich`: flexibel')],evidence:evidence(r,/flexibler/),blocks_lock:false,
    issue:'The flexibility word flexibler occurs in a feel sentence (fühlt sich … an). Both read beweglich; §6.9 lists flexibel without excluding feel phrasing.',
    recommendation:'Keep beweglich. Clarify the wording editorially if desired; this is no demonstrated A/B rule gap.'});
}
const reportedAmbiguities=(B.ambiguous_rules||[]).flatMap(a=>(a.records||[]).map(id=>{
  const r=rows.find(x=>x.id===id);if(!r)throw Error(`Unknown ambiguity ID ${id}`);
  return {lane:'B',slug:r.slug,id,name:r.name,report:a,handling:sharedErrors.some(x=>x.id===id)?'Existing R8-Q2 resolves this concern; shared lane error documented separately.':'Latent agreed-value wording concern; non-blocking.'};
}));
const holdRecords=rows.map(r=>({slug:r.slug,id:r.id,name:r.name,A:r.A.hold_level,B:r.B.hold_level,raw_A:r.rawA.hold_level??null,raw_B:r.rawB.hold_level??null,
  A_state:state(r.rawA),B_state:state(r.rawB),B_informational:informational(r.rawB),claims:claims12(r).filter(c=>c.type==='hold'),A_basis:r.rawA.hold_basis??null,B_basis:r.rawB.hold_basis??null}));
const holdMismatch=holdRecords.filter(r=>!eq(r.A,r.B)),rawHoldMismatch=holdRecords.filter(r=>!eq(r.raw_A,r.raw_B));
// Bounded, packet-derived hold oracle. Reject unfamiliar numeric/strength claims
// rather than silently applying an incomplete general hold classifier.
function claimLevel(r) {
  const values=claims12(r).filter(c=>c.type==='hold').map(c=>{
    if(c.number!=null){if(!/^Wella/.test(r.s0.product.brand)||c.number!==1)throw Error('Unreviewed hold scale');return 1;}
    const t=c.words||c.text;
    if(/(?:leicht|sanft)\w*\s+Halt/i.test(t))return 1;
    if(/stark\w*\s+Halt/i.test(t))return 3;
    if(/lang.?anhalt|natürlich|24 Stunden/i.test(t))return null;
    throw Error(`Unreviewed hold words ${r.slug}: ${t}`);
  }).filter(x=>x!=null).sort((a,b)=>a-b);
  if(!values.length)return null;
  const mid=values.length/2;return Math.ceil(values.length%2?values[Math.floor(mid)]:(values[mid-1]+values[mid])/2);
}
const holdOracle=rows.map(r=>{const captured=claimLevel(r),expected=prof(r.rawA)?captured:null;return {slug:r.slug,id:r.id,captured_claim_level:captured,expected_authoritative_level:expected,A:r.A.hold_level,B:r.B.hold_level,A_correct:eq(r.A.hold_level,expected),B_correct:eq(r.B.hold_level,expected)};});
const hold={records:rows.length,authoritative_agree:rows.length-holdMismatch.length,authoritative_mismatches:holdMismatch,
  raw_agree:rows.length-rawHoldMismatch.length,raw_mismatches:rawHoldMismatch,
  authoritative_emitted:holdRecords.filter(r=>r.A!=null||r.B!=null).length,null_in_both:holdRecords.filter(r=>r.A==null&&r.B==null).length,
  A_distribution:tally(holdRecords,r=>r.A??'null'),B_distribution:tally(holdRecords,r=>r.B??'null'),
  oracle_correct_both:holdOracle.filter(r=>r.A_correct&&r.B_correct).length,oracle:holdOracle,individual_records:holdRecords,
  rules:[emissionRule,ref(STANDARD,'§7.2','**No strength claim ⇒ `null`**'),ref(STANDARD,'§7.4','| stark | 3 |'),ref(LEDGER,'R3-H5','| R3-H5 |')],
  method:'Authoritative comparison plus unmasked raw comparison. Packet-derived bounded hold oracle applies claim-only strength, emission and formula-conflict suppression; Wella Dry Me informational 1 is retained in raw diagnostics, not projected as Styling hold.'};
const blockers=discrepancies.filter(x=>x.classification!=='a');
const criteria=[
  {criterion:'Every A/B user-facing disagreement is a proven lane error against a clear rule',met:discrepancies.every(x=>x.classification==='a'&&['A','B'].includes(x.right_lane)&&x.rules?.length>0)},
  {criterion:'No unresolved user-facing disagreement rule gaps (b), packet issues (c) or owner questions (d)',met:['b','c','d'].every(k=>classified[k]===0)}
];
const verdict=criteria.every(x=>x.met)?'PASS':'FAIL';
const effectSummary={R8_Q1_both:rulingEffects.filter(x=>x.ruling==='R8-Q1').every(x=>x.A_landed&&x.B_landed),
  R8_H_both:rulingEffects.filter(x=>x.ruling==='R8-H').every(x=>x.A_landed&&x.B_landed),
  R8_Q2:{targets:powderEffects.length,profile_applicable:powderEffects.filter(x=>x.applicable).length,
    suppressed:powderEffects.filter(x=>!x.applicable).length,
    primary_both:powderEffects.filter(x=>x.applicable&&x.primary_A_landed&&x.primary_B_landed).length,
    texture_secondary_required:powderEffects.filter(x=>x.applicable&&x.expected.texture_secondary_required).length,
    texture_secondary_both:powderEffects.filter(x=>x.applicable&&x.expected.texture_secondary_required&&x.secondary_A_landed&&x.secondary_B_landed).length,
    all_checks_both:powderEffects.every(x=>x.A_landed&&x.B_landed)},
  all_rulings_landed:rulingEffects.every(x=>x.A_landed&&x.B_landed)};
const inputs=['blind-lane-A-r9/results.json','blind-lane-B-r9/results.json','r9/cohort.json','r9/FREEZE-NOTES.md','r9/scope-audit.json','r9/artifact-manifest.json','round-8/diff.js','round-9/diff.js'].map(p=>path.join(ROOT,p));
for(const r of rows)for(const k of ['s0','fu','claims'])inputs.push(path.join(ROOT,`r9/packets/${k}/${r.id}.json`));
inputs.push(...revisionFiles.map(p=>path.join(REPO,p)),path.join(REPO,LEDGER));
const output={generated_by:'data/research/styling-inci/v1.0/round-9/diff.js',
  method:'MINI r9, A=Claude Opus, B=Codex. Round-8 bijective join, semantic normalization, separate user/log cells and evidence-conditioned scoring adapted. No preset empirical totals or verdict. Ledger governs.',
  scope:{screened_records:SCOPE.screened_records,selected_records:selected.length,actual_records:rows.length,verified_frozen_artifacts:FREEZE.artifacts.length},
  inputs:inputs.sort().map(p=>({path:path.relative(REPO,p),sha256:crypto.createHash('sha256').update(provenanceBytes(p)).digest('hex')})),normalisation:NORMALISATION,normalization_audit:normalizationAudit,lock_rules:lockRules,
  counts:{records:rows.length,user_facing_disagreement_cells:discrepancies.length,user_facing_disagreement_products:new Set(discrepancies.map(x=>x.slug)).size,by_classification:classified,
    all_findings_by_classification:Object.fromEntries(['a','b','c','d'].map(k=>[k,discrepancies.filter(x=>x.classification===k).length+sharedErrors.filter(x=>x.classification===k).length])),
    shared_lane_error_cells:sharedErrors.length,shared_lane_error_assignments:sharedErrors.reduce((n,x)=>n+x.wrong_lanes.length,0),latent_ambiguities:latent.length,calculation_log_disagreement_cells:calculationDifferences.length},
  user_facing_agreement:userAgreement,calculation_log_agreement:logAgreement,disagreements:discrepancies,
  lane_errors:discrepancies.filter(x=>x.classification==='a'),rule_gaps:discrepancies.filter(x=>x.classification==='b'),packet_issues:discrepancies.filter(x=>x.classification==='c'),owner_questions:discrepancies.filter(x=>x.classification==='d'),
  shared_lane_errors:sharedErrors,reported_ambiguities:reportedAmbiguities,latent_ambiguities:latent,calculation_log_disagreements:calculationDifferences,
  ruling_effects:rulingEffects,ruling_effect_summary:effectSummary,hold_check:hold,lock_criteria:criteria,lock_verdict:verdict,
  lock_reason:blockers.length?`${blockers.length} unresolved A/B user-facing disagreement cells.`:
    `No authoritative A/B user-facing disagreements or unresolved b/c/d disagreements. ${sharedErrors.length} shared clear-rule error(s) are disclosed separately: agreement-based lock readiness does not certify all ruling effects or all outputs correct.`,
  products:rows.map(r=>({id:r.id,slug:r.slug,name:r.name,reason_classes:r.reason_classes,scope_audit_evidence:r.scope_evidence,
    A:Object.fromEntries(USER.map(f=>[f,r.A[f]])),B:Object.fromEntries(USER.map(f=>[f,r.B[f]])),A_trace:trace(r.rawA),B_trace:trace(r.rawB),
    fully_agreeing:USER.every(f=>eq(r.A[f],r.B[f])),disagreement_fields:USER.filter(f=>!eq(r.A[f],r.B[f]))})),
  limitations:['The lock verdict implements the requested A/B disagreement criterion. Shared clear-rule errors are separate, not fabricated disagreements, unresolved rule gaps or owner questions.',
    'Ruling-effect failure remains visible even if the disagreement-based lock verdict passes. This receipt does not reinstate LOCK-1, correct frozen lane records or activate production.',
    'Known-product MINI confirmation, not new unseen validation or full-cohort validation. Formula-conflict Kevin.Murphy has no profile; Bali Curls remains held and unmatchable.',
    'Analyst rule interpretations are explicit. Counts, coverage, flags, holds, manifests, classifications totals and verdict are computed; unexpected disagreements or ruling failures stop the script.',
    'Current ledger and current v0.5 documents govern. Older lexicons in the supplied directory are hashed for provenance, not applied over v0.5.']};
const esc=v=>String(v??'—').replace(/\|/g,'\\|').replace(/\n/g,'<br>');
const val=v=>esc(JSON.stringify(v));
const ruleLabel=r=>`\`${r.path}:${r.line}\` (${r.section})`;
function render(d,sha){
  const u=d.user_facing_agreement,c=d.counts,h=d.hold_check,q=d.ruling_effect_summary.R8_Q2;
  let s='# Styling research engine — MINI re-check r9\n\n';
  s+=`**${u.agreeing_cells}/${u.cells} user-facing cells agree (${u.percent_cells}%); ${u.products_fully_agreeing}/${u.records} products fully agree.** ${u.fields} fields per product; application moment compares primary only.\n\n`;
  s+=`**Lock verdict: ${d.lock_verdict} under the requested R3-L/R4-L disagreement criterion.** ${d.lock_reason}\n\n`;
  if(c.shared_lane_error_cells) s+=`**Ruling-effect caveat:** ${c.shared_lane_error_cells} shared error(s), affecting ${c.shared_lane_error_assignments} lane assignments, remain outside the A/B disagreement counts. Both lanes omit the explicitly promised texture secondary for Balea Styling Spray Volumenpuder Pure Styling. R8-Q2 has therefore **not fully landed**. This PASS is a comparison-based readiness result, not a claim that the profiles need no correction or that LOCK-1 has been reinstated.\n\n`;
  s+=`A/B disagreement cells: **a=${c.by_classification.a}, b=${c.by_classification.b}, c=${c.by_classification.c}, d=${c.by_classification.d}**. These are field-cell counts; shared errors are counted separately. A=Claude Opus; B=Codex. Neither lane receives a preference.\n\n`;
  s+=`Scope: ${d.scope.selected_records} selected from ${d.scope.screened_records} screened records. Cohort/id-map/packet joins and scope reason classes agree; ${d.scope.verified_frozen_artifacts} frozen artifacts match their hashes. The broad volume/freshness screen includes semantic false positives; inclusion alone assigns no route.\n\n`;
  s+='## Ruling effects\n\n';
  s+=`R8-Q1 Big Hair Day: **${d.ruling_effect_summary.R8_Q1_both?'PASS':'FAIL'}** in both. R8-H Moroccanoil Glättende Creme: **${d.ruling_effect_summary.R8_H_both?'PASS':'FAIL'}** in both. R8-Q2: **${q.primary_both}/${q.profile_applicable} applicable powder primary jobs pass**, with ${q.suppressed} formula-blocked powder checked for suppression. **${q.texture_secondary_both}/${q.texture_secondary_required} required texture secondaries pass** in both. Redken Powder Grip is the two-job exception: its lead makes texture primary and volume secondary.\n\n`;
  s+='| Ruling | Product | Expected | A | B | A / B landed |\n|---|---|---|---|---|---|\n';
  for(const x of d.ruling_effects)s+=`| ${x.ruling} | ${esc(x.name)}<br>\`${x.slug}\` | ${val(x.expected)}${x.applicable===false?'<br>Profile N/A; suppression only':''} | ${val(x.A)} | ${val(x.B)} | ${x.A_landed?'yes':'**NO**'} / ${x.B_landed?'yes':'**NO**'} |\n`;
  s+='\nThe remaining volume/freshness candidates confirm why screen membership is not a Dry Shampoo instruction:\n\n| Product | A route/state | B route/state |\n|---|---|---|\n';
  for(const x of d.products.filter(x=>x.reason_classes.includes('R8-Q1-volume-freshness-candidate')))s+=`| ${esc(x.name)} | ${val(x.A.route)} | ${val(x.B.route)} |\n`;
  s+='\n## Every A/B user-facing disagreement\n\n';
  if(!d.disagreements.length)s+='None after documented semantic normalization. Thus there are no A/B lane-error adjudications, rule-gap fixes, packet repairs or owner questions to list. Both-defensible readings would require b/d, never a; the script stops on any new unadjudicated difference.\n\n';
  else for(const x of d.disagreements)s+=`- ${esc(x.name)} ${x.field}: ${x.classification}; A=${val(x.A)}, B=${val(x.B)}.\n`;
  s+='## Shared clear-rule error — not an A/B disagreement\n\n';
  for(const x of d.shared_lane_errors){
    s+=`### ${x.name} — ${x.field}\n\n\`${x.slug}\` · \`${x.id}\` · **class a, both lanes wrong; neither lane is right.**\n\n`;
    s+=`A=${val(x.A)}; B=${val(x.B)}. Correct ordered value: **${val(x.correct_value)}**.\n\n`;
    s+=`${x.explanation}\n\nRules: ${x.rules.map(ruleLabel).join('; ')}. Frozen C2 evidence: ${x.evidence.map(e=>`“${e.text}” (${e.tier}; type ${e.type})`).join('; ')}.\n\n`;
    s+=`**Fix:** ${x.proposed_fix}\n\nNo owner question: the later powder-specific owner rule settles eligibility. This clear error does not create a b/d gap. It fails the named ruling-effect check, while the requested A/B lock predicate remains separate. Frozen results remain unchanged.\n\n`;
  }
  s+='## Hold check\n\n';
  s+=`**Authoritative values: ${h.authoritative_agree}/${h.records} agree**, including ${h.null_in_both} null/null pairs and ${h.authoritative_emitted} emitted numeric levels. **Raw storage: ${h.raw_agree}/${h.records} agree.** The bounded packet-derived hold oracle matches both authoritative outputs on **${h.oracle_correct_both}/${h.records}**.\n\n`;
  s+='| Product | Authoritative A / B | Raw A / B | Captured claim level |\n|---|---|---|---|\n';
  for(const x of h.individual_records){const o=h.oracle.find(y=>y.id===x.id);s+=`| ${esc(x.name)} | ${val(x.A)} / ${val(x.B)} | ${val(x.raw_A)} / ${val(x.raw_B)} | ${val(o.captured_claim_level)} |\n`;}
  s+='\nWella EIMI Dry Me: A omits Styling hold; B retains claim-derived 1 explicitly as informational in notes. Neither projects an authoritative Styling hold value on this Dry Shampoo. Kevin.Murphy’s captured Sanfter Halt would yield 1, but its formula-conflict gate suppresses the whole profile. Neither is a user-facing hold mismatch.\n\n';
  s+=`Hold rules: ${h.rules.map(ruleLabel).join('; ')}. ${h.method}\n\n`;
  s+='## Latent wording ambiguities — non-blocking\n\n';
  s+=`${d.latent_ambiguities.length} observations concern values on which both lanes agree. They are not demonstrated A/B gaps or new owner questions.\n\n`;
  for(const x of d.latent_ambiguities)s+=`- **${x.name} — ${x.field}**, A/B=${val(x.A)}: ${x.issue} Recommendation: ${x.recommendation} Rules: ${x.rules.map(ruleLabel).join('; ')}.\n`;
  if(d.reported_ambiguities.some(x=>x.handling.startsWith('Existing R8-Q2'))) s+='\nB also reports a typed-other-line concern for Balea Volumenpuder Spray. It is resolved by existing R8-Q2 and recorded as the shared error above, not counted again as a latent ambiguity or unresolved policy question.\n\n';
  s+='## Agreement and normalization\n\n| User-facing field | Agree / all | Disagree | Agreement |\n|---|---|---|---|\n';
  for(const f of u.field_agreement)s+=`| ${f.field} | ${f.agree}/${f.records} | ${f.disagree} | ${f.percent}% |\n`;
  s+='\n### Products fully agreeing\n\n';
  for(const x of d.products.filter(x=>x.fully_agreeing))s+=`- ${x.name} (\`${x.slug}\`).\n`;
  s+='\n### Semantic normalization audit\n\n';
  s+=`Authority: ${ruleLabel(emissionRule)}. Non-Styling optional observations are excluded only when explicitly marked informational. B places the explicit marker in notes; its location does not turn observations into authoritative fields. No held profile is suppressed. Route/state/reason and subtype remain scored on every record.\n\n`;
  s+='| Lane | Explicitly informational product | Excluded non-null fields |\n|---|---|---|\n';
  for(const x of d.normalization_audit.filter(x=>x.explicitly_informational))s+=`| ${x.lane} | \`${x.slug}\` (marker: ${x.marker_location}) | ${x.excluded_informational_fields.join(', ')} |\n`;
  s+='\n';
  for(const x of d.normalisation)s+=`- ${x}\n`;
  s+=`\nRaw and normalized values for each lane/product, plus excluded fields, are retained in diff.json. Calculation-log agreement: ${d.calculation_log_agreement.agreeing_cells}/${d.calculation_log_agreement.cells} cells; ${d.counts.calculation_log_disagreement_cells} differences. These trace/schema differences never block R4-L.\n\n`;
  s+='## Lock predicate and reproduction\n\n| Criterion | Result |\n|---|---|\n';
  for(const x of d.lock_criteria)s+=`| ${x.criterion} | **${x.met?'PASS':'FAIL'}** |\n`;
  s+=`\n**${d.lock_verdict}:** ${d.lock_reason}\n\n`;
  for(const x of d.limitations)s+=`- ${x}\n`;
  s+='\nRun `node data/research/styling-inci/v1.0/round-9/diff.js --summary` twice and compare SHA-256 of both output files. The generator emits no timestamps, randomness or absolute paths and writes only sibling diff.json and report.md. All inputs, packets, governing docs and the adapted script are fingerprinted in diff.json.\n\n';
  s+=`diff.json SHA-256: \`${sha}\`.\n`;
  return s;
}
const json=JSON.stringify(output,null,2)+'\n';
const sha=crypto.createHash('sha256').update(json).digest('hex');
fs.writeFileSync(path.join(__dirname,'diff.json'),json);
fs.writeFileSync(path.join(__dirname,'report.md'),render(output,sha));
if(process.argv.includes('--summary'))console.log(JSON.stringify({agreement:{agreeing_cells:userAgreement.agreeing_cells,cells:userAgreement.cells,percent:userAgreement.percent_cells,products_fully_agreeing:userAgreement.products_fully_agreeing},counts:output.counts,ruling_effects:effectSummary,hold:{authoritative_agree:hold.authoritative_agree,raw_agree:hold.raw_agree,oracle_correct_both:hold.oracle_correct_both},lock_verdict:verdict,sha256:sha},null,2));
if(process.argv.includes('--dump'))for(const x of discrepancies)console.log(JSON.stringify(x));
