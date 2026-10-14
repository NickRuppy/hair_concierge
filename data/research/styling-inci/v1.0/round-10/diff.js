#!/usr/bin/env node
'use strict';
// Adapted from round-9/diff.js: frozen bijective join, semantic normalization,
// separate user-facing/log cells, evidence-conditioned adjudication and hold check.
// MINI r10 only. No timestamps, randomness or preset empirical counts/verdicts.
// Usage: node data/research/styling-inci/v1.0/round-10/diff.js [--summary] [--dump]
// Writes ONLY sibling diff.json and report.md; inputs are never rewritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r10/results.json');
const B = read('blind-lane-B-r10/results.json');
const C = read('r10/cohort.json');
const SCOPE = read('r10/scope-audit.json');
const FREEZE = read('r10/artifact-manifest.json');
if (A.lane !== 'A' || B.lane !== 'B' || [A,B].some(l => l.standard !== C.standard_version.replace(/^styling-inci-/, ''))) throw Error('Lane identity/standard stamp mismatch');
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
const am = mapRecords(A, C, 'A10'), bm = mapRecords(B, C, 'B10');
const idm = new Map(C.id_map.map(r => [r.sample_id, r]));
if (idm.size !== C.id_map.length || idm.size !== C.records.length || new Set(C.records.map(r => r.source_slug)).size !== C.records.length) throw Error('cohort map is not bijective');
const packet = (kind, id) => read(`r10/packets/${kind}/${id}.json`);
const rows = C.records.map(c => {
  const m = idm.get(c.sample_id);
  if (m?.source_slug !== c.source_slug) throw Error(`r10 ID/slug mapping broken: ${c.source_slug}`);
  const scope = scopeBySlug.get(c.source_slug);
  if (!eqSlugs(scope.reasons.map(x => x.class), c.history.round10.reason_classes)) throw Error(`Scope reasons differ: ${c.source_slug}`);
  const rawA = am.get(c.sample_id), rawB = bm.get(c.sample_id);
  const s0 = packet('s0', c.sample_id), fu = packet('fu', c.sample_id), claims = packet('claims', c.sample_id);
  for (const p of [s0, fu, claims]) if (p.sample_id !== c.sample_id || p.packet_version !== C.standard_version) throw Error(`Packet binding/version mismatch ${c.sample_id}`);
  return { id: c.sample_id, slug: m.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role, reason_classes: c.history.round10.reason_classes, scope_evidence: scope, rawA, rawB, A: normalize(rawA), B: normalize(rawB), s0, fu, claims };
}).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySlug = new Map(rows.map(r => [r.slug, r]));
// R9-P: choose HEAD at scoring time; every rule quote is read from that commit.
// --rules-revision=<sha> permits later replay of this exact recorded revision.
// Pinned default: dcaff25e = HEAD when round 10 was scored (R9-P); override with --rules-revision.
const RULE_REVISION = execFileSync('git', ['rev-parse', process.argv.find(x=>x.startsWith('--rules-revision='))?.split('=')[1] || 'dcaff25e'], {cwd:REPO,encoding:'utf8'}).trim();
const revisionFiles = execFileSync('git',['ls-tree','-r','--name-only',RULE_REVISION,'docs/research/styling-inci/v1.0'],{cwd:REPO,encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.md'));
const cache = new Map();
function pinnedBytes(p) { if(!cache.has(p))cache.set(p,execFileSync('git',['show',`${RULE_REVISION}:${p}`],{cwd:REPO}));return cache.get(p); }
const doc=p=>pinnedBytes(p).toString('utf8');
function ref(p,section,fragment) {
  const lines=doc(p).split('\n');
  const number=section.match(/^§(\d+(?:\.\d+)?)/)?.[1];
  const start=number?lines.findIndex(l=>l.startsWith(`### ${number} `)||l.startsWith(`## ${number}. `)):0;
  if(start<0)throw Error(`Missing pinned section ${section}`);
  const i=lines.findIndex((l,i)=>i>=start&&l.includes(fragment));
  if(i<0)throw Error(`Missing pinned rule ${section}: ${fragment}`);
  return {revision:RULE_REVISION,path:p,line:i+1,section,matched_fragment:fragment,quote:lines[i]};
}
const emissionRule=ref(STANDARD,'§4.7','Styling properties **optional and marked');
const r8q1=ref(LEDGER,'R8-Q1','| R8-Q1 |'),r8q2=ref(LEDGER,'R8-Q2','| R8-Q2 |'),r8h=ref(LEDGER,'R8-H','| R8-H |');
const r9q1=ref(LEDGER,'R9-Q1','| R9-Q1 |'),r9q2=ref(LEDGER,'R9-Q2','| R9-Q2 |'),r9f=ref(LEDGER,'R9-F','| R9-F |'),r9p=ref(LEDGER,'R9-P','| R9-P |');
const jobRule=ref(STANDARD,'§6.10','| Decision |'),jobExample=ref(STANDARD,'§6.10','| Worked example (R9-Q1) |');
const typedHoldRule=ref(LEDGER,'R4-H','| R4-H |');
const lockRules=[ref(LEDGER,'R3-L','| R3-L |'),ref(LEDGER,'R4-L','| R4-L |')];
const claims12=r=>r.claims.claims.filter(c=>/^C[12]/.test(c.tier||''));
const trace=r=>Object.fromEntries(['reason_code','boundary_reason','rule_path','hold_basis','notes'].map(f=>[f,r[f]??null]));
function evidence(r,re) {const found=claims12(r).filter(c=>re.test(c.text));if(!found.length)throw Error(`Evidence absent ${r.slug}: ${re}`);return found;}
function agreement(rs,fields) {
  const field_agreement=fields.map(field=>{const agree=rs.filter(r=>eq(r.A[field],r.B[field])).length,active=rs.filter(r=>r.A[field]!=null||r.B[field]!=null),emittedAgree=active.filter(r=>eq(r.A[field],r.B[field])).length;return {field,records:rs.length,agree,disagree:rs.length-agree,percent:pct(agree,rs.length),emitted_by_either:active.length,agree_where_emitted:emittedAgree,percent_where_emitted:pct(emittedAgree,active.length)};});
  const cells=rs.length*fields.length,agreeing_cells=field_agreement.reduce((n,r)=>n+r.agree,0),all=rs.filter(r=>fields.every(f=>eq(r.A[f],r.B[f])));
  return {records:rs.length,fields:fields.length,cells,agreeing_cells,percent_cells:pct(agreeing_cells,cells),products_fully_agreeing:all.length,percent_products:pct(all.length,rs.length),fully_agreeing_slugs:all.map(r=>r.slug),field_agreement};
}
const ungradedHoldSlugs=new Set(['balea-sea-salt-texture-spray','got2b-styling-puder-volumen-powderfull','guhl-foehn-spray-langzeit-volumen','moroccanoil-dry-texture-spray','moroccanoil-textur-und-volumenpuder','moroccanoil-volumizing-spray','schwarzkopf-taft-haarpuder-volumen']);
function adjudicate(r,field) {
  // These are explicit analyst interpretations, conditioned on exact frozen evidence
  // and actual differences. No lane, count, or lock result is preferred or preset.
  if(field!=='secondary_jobs')throw Error(`Unreviewed difference ${r.slug}::${field}`);
  if(ungradedHoldSlugs.has(r.slug)) {
    const a=r.A[field],b=r.B[field];
    if(!eq(a.filter(j=>j!=='hold_fix'),b.filter(j=>j!=='hold_fix'))||a.includes('hold_fix')===b.includes('hold_fix'))throw Error(`Changed hold split ${r.slug}`);
    const e=evidence(r,/Halt|\bhold\b/i);
    const questionEvidence=[...e].filter(c=>c.type==='hold').sort((a,b)=>a.text.length-b.text.length)[0]||e[0];
    if(e.some(c=>c.type==='hold'&&c.number!=null))throw Error(`Unexpected graded hold ${r.slug}`);
    return {classification:'d',right_lane:null,wrong_lanes:[],rules:[r9q1,jobRule,typedHoldRule],evidence:e,
      section:'§6.10 R9-Q1 versus RG3-16 / R4-H(5)',
      explanation:'A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.',
      owner_question:`Should ${r.name} show a hold/fixing secondary for its captured ${questionEvidence.text} even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?`,
      recommendation:'Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.',
      proposed_fix:'After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.'};
  }
  if(r.slug==='bali-gents-haarpuder-volumizing-styling-powder') {
    const e=evidence(r,/natürlich strukturierten Look/);
    if(!eq(set([...r.A[field],'texture']),set([...r.B[field],'texture']))||r.A[field].includes('texture')===r.B[field].includes('texture'))throw Error('Changed structured-look split');
    return {classification:'b',right_lane:null,wrong_lanes:[],rules:[r8q2,r9q1,jobRule],evidence:e,section:'§6.10 texture vocabulary and explicit-result threshold',
      explanation:'B reads natürlich strukturierten Look as an explicit texture result; A requires a texture/grip promise and omits it. The standard maps texture/grip but does not explicitly map strukturiert. R6-T/R7-Q2 exclude generic definition only; they do not settle this texture synonym. The C3 Griffigkeit line cannot decide the cell.',
      proposed_fix:'Add a normative texture vocabulary entry explicitly deciding whether strukturiert/strukturierter Look is a texture-result promise, distinguishing styling result from feel-only or collection wording; synchronize §6.10 and property set §2.12 before a targeted replay.',
      recommendation:'Include an explicit structured-look result as texture when its formula gate passes (Silica Silylate r2 here), subject to owner amendment. No primary change: Puder/Powder remains volume.'};
  }
  if(r.slug==='schwarzkopf-taft-styling-balm-locken-halt-3') {
    const e=evidence(r,/Sprungkraft|HALT 3|Halt 3|Anti-Frizz/);
    // Confirmed-name brand-number hold precedes all claim-line candidates.
    if(!/Halt\s+3/i.test(r.claims.confirmed_name))throw Error('Name hold evidence changed');
    const candidates=['hold_fix'];
    for(const c of claims12(r)){
      if(/Sprungkraft/.test(c.text))candidates.push('volume');
      if(/Anti-Frizz/i.test(c.text))candidates.push('frizz_control');
    }
    const ordered=[...new Set(candidates)].slice(0,2),correct=set(ordered);
    const rights=['A','B'].filter(l=>eq(r[l][field],correct));if(rights.length!==1)throw Error('Taft oracle does not decide exactly one lane');
    const fixative=r.fu.inci.items.find(i=>/^PVP$/i.test(i.inci));
    if(!fixative||fixative.rank>=r.rawA.tail_markers.T_S.rank||fixative.rank>=r.rawB.tail_markers.T_S.rank)throw Error('Taft formula gate not proven');
    return {classification:'a',right_lane:rights[0],wrong_lanes:['A','B'].filter(l=>!rights.includes(l)),correct_value:correct,correct_ordered_value:ordered,rules:[r9q1,jobRule],evidence:e,formula_evidence:fixative,
      explanation:'The name’s Halt 3 supplies hold_fix before claim lines. R9-Q1 says ANY C1/C2 claim line: C2 Sprungkraft, even typed flexibility, explicitly maps to volume and precedes the Anti-Frizz finish line. PVP r4 passes both hold and volume gates. The two slots are hold_fix, volume; the later frizz candidate has no free slot. The text clearly decides this cell.',
      proposed_fix:`Correct lane ${['A','B'].filter(l=>!rights.includes(l)).join('/')}’s derived secondary jobs to hold_fix, volume; preserve frozen lane files.`};
  }
  throw Error(`Unadjudicated difference ${r.slug}::${field}`);
}
const disagreements=rows.flatMap(r=>USER.filter(f=>!eq(r.A[f],r.B[f])).map(field=>({slug:r.slug,id:r.id,name:r.name,field,A:r.A[field],B:r.B[field],blocks_lock:null,...adjudicate(r,field)})));
for(const d of disagreements)d.blocks_lock=d.classification!=='a';
const classified=Object.fromEntries(['a','b','c','d'].map(k=>[k,disagreements.filter(d=>d.classification===k).length]));
const calculationDifferences=rows.flatMap(r=>LOG.filter(f=>!eq(r.A[f],r.B[f])).map(field=>({slug:r.slug,id:r.id,field,A:r.A[field],B:r.B[field],blocks_lock:false})));
const normalizationAudit=rows.flatMap(r=>['A','B'].map(lane=>({slug:r.slug,id:r.id,lane,explicitly_informational:informational(r[`raw${lane}`]),rule:emissionRule,raw_user_fields:Object.fromEntries(USER.map(f=>[f,r[`raw${lane}`][f]??null])),normalized_user_fields:Object.fromEntries(USER.map(f=>[f,r[lane][f]])),excluded_informational_fields:informational(r[`raw${lane}`])?USER.filter(f=>!['route','subtype'].includes(f)&&r[`raw${lane}`][f]!=null):[]})));
const userAgreement=agreement(rows,USER),logAgreement=agreement(rows,LOG);
function effect(r,ruling,expected,rules,explanation) {
  if(!r)return {ruling,applicable:false,status:'NOT_IN_COHORT',expected,rules,explanation,A_landed:null,B_landed:null};
  const actual=l=>Object.fromEntries(Object.keys(expected).map(k=>[k,r[l][k]]));
  return {ruling,slug:r.slug,id:r.id,name:r.name,applicable:true,expected,A:actual('A'),B:actual('B'),A_landed:eq(actual('A'),expected),B_landed:eq(actual('B'),expected),rules,explanation,evidence:claims12(r),A_trace:trace(r.rawA),B_trace:trace(r.rawB)};
}
function requiredSecondaryEffect(r,ruling,job,rules,re) {
  if(!r)throw Error(`Missing ${ruling} exemplar`);
  return {ruling,slug:r.slug,id:r.id,name:r.name,applicable:true,expected:{required_secondary:job},A:{secondary_jobs:r.A.secondary_jobs},B:{secondary_jobs:r.B.secondary_jobs},A_landed:r.A.secondary_jobs?.includes(job)===true,B_landed:r.B.secondary_jobs?.includes(job)===true,rules,evidence:evidence(r,re),explanation:'Required result is an eligible, supported secondary; other eligible members may occupy the remaining slot.'};
}
const rulingEffects=[
  requiredSecondaryEffect(bySlug.get('balea-pure-styling-volumenpuder-spray'),'R9-Q1','texture',[r9q1,jobRule,jobExample],/griffige Textur direkt am Ansatz/),
  effect(bySlug.get('neqi-diamond-glass-styling-spray-all'),'R9-Q2',{primary_job:'sleek'},[r9q2,jobRule],'Named heat-activated smooth Glass Hair look takes primary over the adjacent shine adjective.'),
  requiredSecondaryEffect(bySlug.get('neqi-diamond-glass-styling-spray-all'),'R9-Q2','shine',[r9q2,jobRule],/glänzenden.*glatten/),
  requiredSecondaryEffect(bySlug.get('got2b-gotgloss-glanz-spray'),'R9-F','frizz_control',[r9f,jobRule],/Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle/),
  effect(bySlug.get('loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray'),'R8-Q1',{route:{destination:'dry_shampoo',state:'route:dry_shampoo',boundary_reason:null}},[r8q1],'Big Hair Day is not selected in r10; no fresh two-lane observation exists. N/A is never a passing regression check.'),
  effect(bySlug.get('moroccanoil-glaettende-creme-smoothing-lotion'),'R8-H',{route:{destination:'leave_in',state:'route:leave_in',boundary_reason:null}},[r8h],'Not mixed: generic Definition of frizzy hair with separate curl suitability is not curl definition. Border rules route Leave-in.')
];
const powders=rows.filter(r=>/puder|powder/i.test(r.s0.product.confirmed_name));
const powderEffects=powders.map(r=>{
  const suppressed=['A','B'].every(l=>r[l].route.state==='blocked:formula_conflict');
  const redken=/Powder\s+Grip/i.test(r.s0.product.confirmed_name);
  if(redken)evidence(r,/FÜR MEHR GRIFFIGKEIT/);
  const textureEvidence=claims12(r).filter(c=>/textur|griffig|\bgrip\b/i.test(c.text));
  const ambiguous=disagreements.filter(d=>d.slug===r.slug&&d.classification!=='a');
  const primaryExpected=suppressed?null:redken?'texture':'volume';
  const textureRequired=!suppressed&&!redken&&(/textur|\bgrip\b/i.test(r.s0.product.confirmed_name)||textureEvidence.length>0);
  const actual=l=>({primary_job:r[l].primary_job,secondary_jobs:r[l].secondary_jobs});
  const primary=l=>r[l].primary_job===primaryExpected;
  const secondary=l=>suppressed?r[l].secondary_jobs===null:(!textureRequired||r[l].secondary_jobs?.includes('texture'))&&(!redken||r[l].secondary_jobs?.includes('volume'));
  return {ruling:'R8-Q2',slug:r.slug,id:r.id,name:r.name,applicable:!suppressed,suppression_checked:suppressed,
    expected:{primary_job:primaryExpected,texture_secondary_required:textureRequired,volume_secondary_required:!suppressed&&redken},A:actual('A'),B:actual('B'),
    primary_A_landed:primary('A'),primary_B_landed:primary('B'),secondary_A_landed:secondary('A')===true,secondary_B_landed:secondary('B')===true,
    A_landed:primary('A')&&secondary('A')===true,B_landed:primary('B')&&secondary('B')===true,
    unresolved_other_secondary_cells:ambiguous.map(d=>({field:d.field,classification:d.classification})),
    status:suppressed?'SUPPRESSED':ambiguous.length?'POWDER_RULE_LANDED_OTHER_SECONDARY_UNRESOLVED':'CHECKED',
    rules:[r8q2,r9q1,jobRule,emissionRule],evidence:textureEvidence,
    explanation:suppressed?'Formula conflict suppresses the entire Styling profile; not a volume-primary success.':redken?'Two-job Powder Grip name falls to texture lead; volume secondary.':'Powder noun contributes volume; the packet lead decides a multi-job name. Required explicit texture/grip secondaries checked independently of ungraded hold or structured-look disputes.'};
});
rulingEffects.push(...powderEffects);
if(!rows.some(r=>/Powder\s+Grip/i.test(r.s0.product.confirmed_name)))rulingEffects.push({ruling:'R8-Q2',name:'Redken Powder Grip',applicable:false,status:'NOT_IN_COHORT',A_landed:null,B_landed:null,rules:[r8q2],explanation:'The named two-job exception is absent from r10; no regression pass claimed.'});
const reachAudit=rows.map(r=>({slug:r.slug,id:r.id,name:r.name,reason_classes:r.reason_classes,
  R9_Q1_screen:r.scope_evidence.screen,
  primary_A:r.A.primary_job,primary_B:r.B.primary_job,secondary_A:r.A.secondary_jobs,secondary_B:r.B.secondary_jobs,
  primary_agree:eq(r.A.primary_job,r.B.primary_job),secondary_agree:eq(r.A.secondary_jobs,r.B.secondary_jobs),
  user_facing_findings:disagreements.filter(d=>d.slug===r.slug).map(d=>({field:d.field,classification:d.classification})),
  interpretation:'Conservative lexical screen includes false positives, feel/ingredient/collection lines, blocked and non-Styling products. Inclusion is no independent job oracle.'}));
// Claim-only hold oracle covers the actual captured ladders. Unknown strength
// vocabulary is preserved as an audit limitation rather than silently translated.
const holdRules=[ref(STANDARD,'§7.2','6. **No strength claim'),ref(STANDARD,'§7.2','3. **The number beats the word'),ref(STANDARD,'§7.2','7. **Conflicting'),ref(STANDARD,'§7.3','| Henkel Haltegrad'),ref(STANDARD,'§7.3','| Alcina Hold-Faktor'),ref(STANDARD,'§7.3','| **Wella Professionals EIMI**'),ref(STANDARD,'§7.4','| leicht, sanft'),ref(STANDARD,'§7.4','| sehr / extra'),ref(STANDARD,'§7.4','**Never strength'),emissionRule];
function numberLevel(r,c) {
  const n=Number(c.number);if(!Number.isFinite(n))throw Error(`Invalid number ${r.slug}`);
  const brand=r.claims.brand;
  if(/^Balea/i.test(brand))return null; // unlegended 1–7 is words-only
  if(/Wella Professionals/i.test(brand))return n<=2?1:n===3?3:n>=4?4:null;
  if(/ALCINA/i.test(brand))return n<=2?1:n<=5?2:n<=7?3:4;
  if(/taft/i.test(brand)&&/haargel/i.test(r.claims.confirmed_name)&&!(/gel wax/i.test(r.claims.confirmed_name)))return null;
  if(/taft|syoss|got2b|wellaflex|Maria Nila/i.test(brand))return n<=2?1:n===3?2:n===4?3:4;
  if(/Gard|NIVEA/i.test(brand))return n<=2?1:n===3?2:n===4?3:4;
  throw Error(`Unreviewed numeric brand ${brand}`);
}
function wordLevel(c) {
  const t=text(c.words||c.text).toLowerCase();
  if(/kein(?:en)? halt|ohne halt/.test(t))return 0;
  if(/extra|ultra|mega|extrem|maximal|\bmax\b|\bpower\b|sehr.*stark/.test(t)&&/halt|hold|stark|krass/.test(t))return 4;
  if(/stark|\bstrong\b|krass/.test(t))return 3;
  if(/mitt(?:el|l)|normal/.test(t))return 2;
  if(/leicht|sanft|\bsoft\b|weich/.test(t))return 1;
  if(/\bfirm\b/.test(t))return 'UNMAPPED';
  return null;
}
const median=xs=>{xs=[...xs].sort((a,b)=>a-b);let m=xs.length/2;return xs.length?Math.ceil(xs.length%2?xs[Math.floor(m)]:(xs[m-1]+xs[m])/2):null;};
function holdOracle(r) {
  const cs=claims12(r).filter(c=>c.type==='hold');
  const numeric=cs.filter(c=>c.number!=null).map(c=>numberLevel(r,c)).filter(x=>x!=null);
  const words=cs.map(wordLevel),unmapped=words.includes('UNMAPPED');
  const captured=numeric.length?median(numeric):median(words.filter(x=>typeof x==='number'));
  const complete=!unmapped||numeric.length>0;
  const expected=l=>prof(r[`raw${l}`])?complete?captured:'UNMAPPED':null;
  return {slug:r.slug,id:r.id,name:r.name,claims:cs,numeric_levels:numeric,word_levels:words,captured_claim_level:complete?captured:'UNMAPPED',
    expected_A:expected('A'),expected_B:expected('B'),A:r.A.hold_level,B:r.B.hold_level,raw_A:r.rawA.hold_level??null,raw_B:r.rawB.hold_level??null,
    A_correct:expected('A')==='UNMAPPED'?null:eq(r.A.hold_level,expected('A')),B_correct:expected('B')==='UNMAPPED'?null:eq(r.B.hold_level,expected('B')),
    note:unmapped?'firm hold has no enumerated strength mapping; this product is formula-blocked, so suppression remains fully checkable.':null};
}
const holdRecords=rows.map(holdOracle);
const hold={records:rows.length,authoritative_agree:holdRecords.filter(r=>eq(r.A,r.B)).length,raw_agree:holdRecords.filter(r=>eq(r.raw_A,r.raw_B)).length,
  authoritative_emitted:holdRecords.filter(r=>r.A!=null||r.B!=null).length,null_in_both:holdRecords.filter(r=>r.A==null&&r.B==null).length,
  authoritative_mismatches:holdRecords.filter(r=>!eq(r.A,r.B)),raw_mismatches:holdRecords.filter(r=>!eq(r.raw_A,r.raw_B)),
  oracle_correct_both:holdRecords.filter(r=>r.A_correct&&r.B_correct).length,oracle_failures:holdRecords.filter(r=>r.A_correct===false||r.B_correct===false),
  A_distribution:tally(holdRecords,r=>r.A??'null'),B_distribution:tally(holdRecords,r=>r.B??'null'),individual_records:holdRecords,rules:holdRules,
  method:'C1/C2 claim-only scales/words, numbers before words, conflicting strengths median rounded up, then lane-specific profile-emission gate. No number from formula or duration. Strength vocabulary does not decide secondary eligibility.'};
// Every agreed-value wording concern is kept separate from actual disagreements.
const latent=rows.filter(r=>/AMBIGUOUS/i.test(typeof r.rawA.notes==='string'?r.rawA.notes:'')&&!disagreements.some(d=>d.slug===r.slug)).map(r=>({slug:r.slug,id:r.id,name:r.name,blocks_lock:false,
  issue:r.rawA.notes,A:Object.fromEntries(USER.map(f=>[f,r.A[f]])),B:Object.fromEntries(USER.map(f=>[f,r.B[f]])),rules:[jobRule],
  recommendation:'Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.'}));
const reportedAmbiguities=['A','B'].flatMap(l=>(l==='A'?A:B).ambiguous_rules?.flatMap(a=>(a.ids||a.records||[]).map(id=>{
  const r=rows.find(x=>x.id===id);if(!r)throw Error(`Unknown ambiguity ${id}`);
  return {lane:l,slug:r.slug,id,name:r.name,report:a,blocks_lock:false,handling:disagreements.some(d=>d.id===id)?'See actual field adjudication.':'Agreed values or calculation-log ordering; does not independently create a blocker.'};
}))||[]);
const orderOnly=rows.filter(r=>eq(r.A.secondary_jobs,r.B.secondary_jobs)&&!eq(r.rawA.secondary_jobs,r.rawB.secondary_jobs)&&r.rawA.secondary_jobs?.length&&r.rawB.secondary_jobs?.length).map(r=>({slug:r.slug,id:r.id,raw_A:r.rawA.secondary_jobs,raw_B:r.rawB.secondary_jobs,blocks_lock:false,explanation:'Same selected set, storage order only; r9 set normalization retained.'}));
const criteria=[
  {criterion:'Every user-facing A/B disagreement is a proven lane error against a clear rule',met:disagreements.every(d=>d.classification==='a'&&['A','B'].includes(d.right_lane)&&d.rules.length>0)},
  {criterion:'No unresolved user-facing rule gaps (b), packet issues (c), or owner questions (d)',met:['b','c','d'].every(k=>classified[k]===0)}
];
const verdict=criteria.every(c=>c.met)?'PASS':'FAIL';
const applicableEffects=rulingEffects.filter(e=>e.applicable);
const rulingPass=k=>{const es=applicableEffects.filter(e=>e.ruling===k);return es.length?es.every(e=>e.A_landed&&e.B_landed):null;};
const reachSummary=['R9-Q1','R9-Q2','R9-F'].map(ruling=>{const rs=rows.filter(r=>r.reason_classes.some(c=>c.startsWith(ruling))),ds=disagreements.filter(d=>rs.some(r=>r.id===d.id));return {ruling,records:rs.length,primary_agree:rs.filter(r=>eq(r.A.primary_job,r.B.primary_job)).length,secondary_agree:rs.filter(r=>eq(r.A.secondary_jobs,r.B.secondary_jobs)).length,by_classification:Object.fromEntries(['a','b','c','d'].map(k=>[k,ds.filter(d=>d.classification===k).length])),note:'Overlapping lexical-screen groups; agreement is not an independent ruling-correctness oracle.'};});
const effectSummary={R9_Q1_Balea_texture_both:rulingPass('R9-Q1'),R9_Q1_ungraded_hold_unresolved:disagreements.filter(d=>ungradedHoldSlugs.has(d.slug)&&d.classification!=='a').length,
  R9_Q2_NEQI_All_both:rulingPass('R9-Q2'),R9_F_gotGloss_both:rulingPass('R9-F'),R8_Q1_Big_Hair_Day_both:rulingPass('R8-Q1'),R8_H_Moroccanoil_both:rulingPass('R8-H'),
  R8_Q2:{targets:powderEffects.length,profile_applicable:powderEffects.filter(e=>e.applicable).length,suppressed:powderEffects.filter(e=>!e.applicable).length,
    primary_both:powderEffects.filter(e=>e.applicable&&e.primary_A_landed&&e.primary_B_landed).length,
    texture_secondary_required:powderEffects.filter(e=>e.expected.texture_secondary_required).length,
    texture_secondary_both:powderEffects.filter(e=>e.expected.texture_secondary_required&&e.secondary_A_landed&&e.secondary_B_landed).length,
    powder_rule_checks_both:powderEffects.every(e=>e.A_landed&&e.B_landed),other_secondary_unresolved:powderEffects.filter(e=>e.unresolved_other_secondary_cells.length).length},
  explicit_applicable_ruling_checks_both:applicableEffects.every(e=>e.A_landed&&e.B_landed),
  all_user_facing_ruling_interpretations_resolved:disagreements.every(d=>d.classification==='a')};
const inputNames=['blind-lane-A-r10/results.json','blind-lane-B-r10/results.json','r10/cohort.json','r10/FREEZE-NOTES.md','r10/scope-audit.json','r10/artifact-manifest.json','round-9/diff.js','round-10/diff.js'];
const inputPaths=inputNames.map(p=>path.join(ROOT,p));
for(const r of rows)for(const k of ['s0','fu','claims'])inputPaths.push(path.join(ROOT,`r10/packets/${k}/${r.id}.json`));
const pinnedPaths=[...revisionFiles,LEDGER];
const inputs=[...inputPaths.map(p=>({path:path.relative(REPO,p).split(path.sep).join('/'),source:'working_tree',sha256:digest(p)})),...pinnedPaths.map(p=>({path:p,source:'pinned_git_revision',revision:RULE_REVISION,sha256:crypto.createHash('sha256').update(pinnedBytes(p)).digest('hex')}))].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const blockers=disagreements.filter(d=>d.blocks_lock);
const output={generated_by:'data/research/styling-inci/v1.0/round-10/diff.js',rule_revision:RULE_REVISION,
  method:'Adapted round-9 scorer; frozen bijective joins and semantic normalization preserved. A=Claude Opus; B=Codex. Evidence-conditioned analyst judgments, computed totals and lock predicate. Ledger governs; no lane preference.',
  scope:{screened_records:SCOPE.screened_records,selected_records:selected.length,actual_records:rows.length,verified_frozen_artifacts:FREEZE.artifacts.length,
    field_count_note:'The request lists 15 field columns and refers to 16 records from the earlier MINI. r10 contains 100 records; all are scored. Route is one composite field preserving destination, held/committed state and boundary reason; application_moment is primary only.'},
  inputs,normalisation:NORMALISATION,normalization_audit:normalizationAudit,lock_rules:lockRules,process_rule:r9p,
  counts:{records:rows.length,user_facing_disagreement_cells:disagreements.length,user_facing_disagreement_products:new Set(disagreements.map(d=>d.slug)).size,by_classification:classified,
    blocking_disagreement_cells:blockers.length,calculation_log_disagreement_cells:calculationDifferences.length,latent_agreed_value_observations:latent.length},
  user_facing_agreement:userAgreement,calculation_log_agreement:logAgreement,disagreements,
  lane_errors:disagreements.filter(d=>d.classification==='a'),rule_gaps:disagreements.filter(d=>d.classification==='b'),packet_issues:disagreements.filter(d=>d.classification==='c'),owner_questions:disagreements.filter(d=>d.classification==='d'),
  ruling_effects:rulingEffects,ruling_effect_summary:effectSummary,ruling_reach_audit:reachAudit,ruling_reach_summary:reachSummary,hold_check:hold,
  latent_ambiguities:latent,reported_ambiguities:reportedAmbiguities,secondary_storage_order_only:orderOnly,calculation_log_disagreements:calculationDifferences,
  lock_criteria:criteria,lock_verdict:verdict,
  lock_reason:blockers.length?`${blockers.length} unresolved user-facing disagreement cells (${classified.b} rule gaps, ${classified.c} packet issues, ${classified.d} owner questions); clear lane errors and calculation-log differences do not block.`:'All user-facing disagreement cells are proven lane errors and no unresolved b/c/d cells remain.',
  products:rows.map(r=>({id:r.id,slug:r.slug,name:r.name,reason_classes:r.reason_classes,scope_audit_evidence:r.scope_evidence,A:Object.fromEntries(USER.map(f=>[f,r.A[f]])),B:Object.fromEntries(USER.map(f=>[f,r.B[f]])),A_trace:trace(r.rawA),B_trace:trace(r.rawB),fully_agreeing:USER.every(f=>eq(r.A[f],r.B[f])),disagreement_fields:USER.filter(f=>!eq(r.A[f],r.B[f]))})),
  limitations:['Known-product targeted MINI r10, not new unseen validation or a full 143-product revalidation.',
    'R8-Q1 Big Hair Day and Redken Powder Grip are absent; no two-lane regression pass is inferred for absent records.',
    'Agreement and passing named effects do not resolve ambiguous ungraded-hold eligibility. Both-defensible readings are d/b, never fabricated lane errors.',
    'Reported hypothetical alternatives on agreed values are separate non-blocking observations under the requested lock comparison.',
    'Older lexicons are pinned and fingerprinted as provenance; v0.5 and the governing ledger are the current authority.',
    'No frozen inputs corrected, no lock reinstated, no commit, no catalog or production action.']};
const esc=v=>String(v??'—').replace(/\|/g,'\\|').replace(/\n/g,'<br>');
const val=v=>esc(JSON.stringify(v));
const label=r=>`\`${r.path}:${r.line}\` (${r.section}, pinned ${r.revision.slice(0,12)})`;
function render(d,sha){
  const u=d.user_facing_agreement,c=d.counts,h=d.hold_check,e=d.ruling_effect_summary;
  let s='# Chaarlie Styling — MINI re-check r10\n\n';
  s+=`**${u.agreeing_cells}/${u.cells} user-facing cells agree (${u.percent_cells}%); ${u.products_fully_agreeing}/${u.records} products fully agree. Lock: ${d.lock_verdict}.**\n\n`;
  s+=`A/B field-cell classifications: **a=${c.by_classification.a}, b=${c.by_classification.b}, c=${c.by_classification.c}, d=${c.by_classification.d}**. ${d.lock_reason}\n\n`;
  s+=`A = Claude Opus; B = Codex. No preference for B. ${d.scope.field_count_note}\n\n`;
  s+=`Rules/quotes pinned at scoring time to HEAD **\`${d.rule_revision}\`** (R9-P). ${d.scope.selected_records}/${d.scope.screened_records} screened products selected; bijective cohort/id-map/packet/scope joins verified and ${d.scope.verified_frozen_artifacts} frozen artifact hashes checked. Inclusion reasons and exact screen evidence are retained per product in diff.json.\n\n`;
  s+='## Ruling effects\n\n| Ruling | Product | Expected | A | B | A / B landed |\n|---|---|---|---|---|---|\n';
  for(const x of d.ruling_effects)s+=`| ${x.ruling} | ${esc(x.name||'Big Hair Day')} | ${val(x.expected||x.explanation)} | ${x.A?val(x.A):'N/A'} | ${x.B?val(x.B):'N/A'} | ${x.status==='NOT_IN_COHORT'?'not in cohort':`${x.A_landed?'yes':'NO'} / ${x.B_landed?'yes':'NO'}`}${x.suppression_checked?' (suppression only)':''}${x.unresolved_other_secondary_cells?.length?' (other secondary unresolved)':''} |\n`;
  s+=`\nR9-Q1 Balea’s other-typed texture promise: **${e.R9_Q1_Balea_texture_both?'PASS':'FAIL'}**. This does not settle ${e.R9_Q1_ungraded_hold_unresolved} ungraded-hold splits. NEQI All’s R9-Q2 primary sleek + secondary shine: **${e.R9_Q2_NEQI_All_both?'PASS':'FAIL'}**. R9-F gotGloss frizz secondary: **${e.R9_F_gotGloss_both?'PASS':'FAIL'}**. R8-H Moroccanoil border route: **${e.R8_H_Moroccanoil_both?'PASS':'FAIL'}**. R8-Q1 Big Hair Day and Redken Powder Grip: **not in r10**.\n\n`;
  const p=e.R8_Q2;s+=`R8-Q2: **${p.primary_both}/${p.profile_applicable} applicable powder primaries** pass in both, **${p.texture_secondary_both}/${p.texture_secondary_required} explicit texture/grip secondaries** pass in both; ${p.suppressed} formula-blocked powder passes suppression only. ${p.other_secondary_unresolved} powders still have a hold/structured-look secondary dispute. This is a pass for the tested powder-noun rule, not full powder-profile agreement.\n\n`;
  s+='### Full screened ruling reach\n\n| Ruling screen | Products | Primary agree | Secondary agree | a / b / c / d cells |\n|---|---|---|---|---|\n';
  for(const r of d.ruling_reach_summary)s+=`| ${r.ruling} | ${r.records} | ${r.primary_agree}/${r.records} | ${r.secondary_agree}/${r.records} | ${Object.values(r.by_classification).join(' / ')} |\n`;
  s+='\nGroups overlap. These are all reached records, including lexical false positives and suppressed profiles. Screen membership does not assign a job; the named oracle checks and individual adjudications decide the reported effects. Exact candidate lines/types and inclusion reasons are in diff.json.\n\n';
  s+='## Every user-facing disagreement\n\n';
  for(const x of d.disagreements){
    s+=`### ${x.name} — ${x.field}: ${x.classification}\n\n\`${x.slug}\` · \`${x.id}\`. A=${val(x.A)}; B=${val(x.B)}. ${x.classification==='a'?`**Lane ${x.right_lane} is right; ${x.wrong_lanes.join('/')} is wrong.** Correct value: ${val(x.correct_value)}.`:'**Both readings defensible; no lane declared right.**'}\n\n`;
    s+=`${x.explanation}\n\nRules: ${x.rules.map(label).join('; ')}. ${x.section?`Affected section: ${x.section}. `:''}Frozen C1/C2 evidence: ${x.evidence.map(c=>`“${esc(c.text)}” (${c.tier}, ${c.type})`).join('; ')}.\n\n`;
    if(x.owner_question)s+=`**Owner question:** ${esc(x.owner_question)}\n\n`;
    if(x.recommendation)s+=`**Recommendation:** ${x.recommendation}\n\n`;
    s+=`**Fix:** ${x.proposed_fix}\n\n`;
  }
  s+='## Hold check\n\n';
  s+=`**${h.authoritative_agree}/${h.records} authoritative hold values agree**; ${h.authoritative_emitted} numeric levels emitted and ${h.null_in_both} null/null. Raw storage: ${h.raw_agree}/${h.records} agree. Independent packet-derived claim/scale/suppression oracle: **${h.oracle_correct_both}/${h.records} correct in both**, ${h.oracle_failures.length} failures. Ungraded hold can leave hold_level null regardless of the unresolved hold_fix secondary question.\n\n${h.method}\n\n`;
  s+='| Product | A / B | Packet-derived expected A / B | Captured level |\n|---|---|---|---|\n';
  for(const r of h.individual_records)s+=`| ${esc(r.name)} | ${val(r.A)} / ${val(r.B)} | ${val(r.expected_A)} / ${val(r.expected_B)} | ${val(r.captured_claim_level)}${r.note?' (unmapped; profile blocked)':''} |\n`;
  s+=`\nRules: ${h.rules.map(label).join('; ')}. Cantu’s firm hold is unlisted strength vocabulary but its formula conflict suppresses the profile; no speculative translation is used. Kevin.Murphy Powder Puff’s sanfter Halt maps to 1 but is likewise suppressed. Non-Styling raw values remain in diff.json.\n\n`;
  s+='## Latent ambiguities and reported concerns — non-blocking\n\n';
  s+=`${d.latent_ambiguities.length} lane-A hypothetical alternatives concern products with complete user-facing agreement. These are not added to a/b/c/d disagreement counts. They need no owner answer to score this comparison.\n\n`;
  for(const x of d.latent_ambiguities)s+=`- **${esc(x.name)}:** Lane-A note: ${esc(x.issue)} Recommendation: ${x.recommendation}\n`;
  s+='\n';for(const x of d.reported_ambiguities)s+=`- **${esc(x.name)} (lane ${x.lane}):** ${esc(x.report.reason)} ${x.handling}\n`;
  s+='\nBalea’s abbreviated R9 worked example names texture but does not explicitly ban the earlier graded hold secondary; both select hold_fix + texture under the general order. NEQI Ultimate’s same shine/sleek set has different storage order only; the inherited set normalization keeps that separate. Neither concern resolves or conceals an actual selected-member split.\n\n';
  s+='## User-facing agreement\n\n| Field | Agree / all | Disagree | Agreement |\n|---|---|---|---|\n';
  for(const f of u.field_agreement)s+=`| ${f.field} | ${f.agree}/${f.records} | ${f.disagree} | ${f.percent}% |\n`;
  s+='\n### Products fully agreeing\n\n';for(const r of d.products.filter(r=>r.fully_agreeing))s+=`- ${r.name} (\`${r.slug}\`).\n`;
  s+='\n## Normalization and calculation log\n\n';for(const n of d.normalisation)s+=`- ${n}\n`;
  s+=`\nCalculation log: ${d.calculation_log_agreement.agreeing_cells}/${d.calculation_log_agreement.cells} cells agree; ${c.calculation_log_disagreement_cells} differences, none blocking. Raw/normalized user fields, all exclusions, log differences and secondary storage-order differences are retained in diff.json. No held profile is masked.\n\n`;
  s+='## Lock predicate\n\n| Criterion | Result |\n|---|---|\n';for(const q of d.lock_criteria)s+=`| ${q.criterion} | ${q.met?'PASS':'FAIL'} |\n`;
  s+=`\n**${d.lock_verdict}: ${d.lock_reason}**\n\n`;for(const l of d.limitations)s+=`- ${l}\n`;
  s+='\n## Pinned governing quotations\n\n';
  for(const r of [r9q1,r9q2,r9f,r9p,r8q1,r8q2,r8h,typedHoldRule,jobRule,jobExample,...lockRules])s+=`${label(r)}\n\n> ${r.quote}\n\n`;
  s+='## Reproduction\n\nRun `node data/research/styling-inci/v1.0/round-10/diff.js --summary` twice at the same HEAD and unchanged inputs. Compare SHA-256 of diff.json and report.md. Later replay: add `--rules-revision='+d.rule_revision+'`. Only the sibling diff.json/report.md are written; no timestamps/randomness/absolute paths. Script/input hashes and every quoted source revision are recorded.\n\n';
  s+=`diff.json SHA-256: \`${sha}\`.\n`;return s;
}
const json=JSON.stringify(output,null,2)+'\n';
const sha=crypto.createHash('sha256').update(json).digest('hex');
fs.writeFileSync(path.join(__dirname,'diff.json'),json);
fs.writeFileSync(path.join(__dirname,'report.md'),render(output,sha));
if(process.argv.includes('--summary'))console.log(JSON.stringify({agreement:{agreeing_cells:userAgreement.agreeing_cells,cells:userAgreement.cells,percent:userAgreement.percent_cells,products_fully_agreeing:userAgreement.products_fully_agreeing,records:rows.length},counts:output.counts,ruling_effects:effectSummary,hold:{agree:hold.authoritative_agree,oracle_correct_both:hold.oracle_correct_both,oracle_failures:hold.oracle_failures.map(r=>({slug:r.slug,expected:r.expected_A,A:r.A,B:r.B}))},rule_revision:RULE_REVISION,lock_verdict:verdict,sha256:sha},null,2));
if(process.argv.includes('--dump'))for(const d of disagreements)console.log(JSON.stringify(d));
