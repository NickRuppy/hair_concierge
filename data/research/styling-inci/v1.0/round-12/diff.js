#!/usr/bin/env node
'use strict';
// Adapted from round-11/diff.js: frozen bijective join, semantic normalization,
// separate user-facing/log cells, evidence-conditioned adjudication and hold check.
// MINI r12 only. No timestamps, randomness or preset empirical counts/verdicts.
// Usage: node data/research/styling-inci/v1.0/round-12/diff.js [--summary] [--dump]
// Writes ONLY sibling diff.json and report.md; inputs are never rewritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r12/results.json');
const B = read('blind-lane-B-r12/results.json');
const C = read('r12/cohort.json');
const SCOPE = read('r12/scope-audit.json');
const FREEZE = read('r12/artifact-manifest.json');
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
const marker = v => v == null ? null : { inci: inciname(v.inci?.replace(/ r\d+$/i,'')), rank: v.rank ?? (Number(v.inci?.match(/ r(\d+)$/i)?.[1]) || null), status: v.status ?? null };
const informational = r => r.informational_and_non_authoritative === true || r.notes?.informational_and_non_authoritative === true;
const boundary = r => r.route === 'provisional_boundary' ? r.boundary_reason || r.reason_code || 'boundary_unnamed' : null;
const prof = r => r.route === 'styling' || boundary(r) === 'pending_leave_in_addendum';
const state = r => r.route === 'styling' ? 'committed' : boundary(r) === 'pending_leave_in_addendum' ? 'held' : r.route === 'provisional_boundary' ? `blocked:${boundary(r)}` : `route:${r.route}`;
const USER = ['route', 'subtype', 'hold_level', 'weight', 'finish', 'flexibility', 'target_zone', 'application_moment', 'primary_job', 'secondary_jobs', 'provides_heat_protection', 'heat_activated', 'alcohol_note', 'buildup_note', 'neutral_fact'];
const BASE_LOG = ['reason_code', 'rule_path', 'review_triggers', 'confidence', 'tail_T_S', 'tail_T_LI', 'ingredient_flags', 'd8b_flags', 'notes', 'identity_status', 'promise_class', 'result_mechanisms', 'hold_route', 'secondary_jobs_order'];
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
  o.secondary_jobs_order = r.secondary_jobs ?? null;
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
const am = mapRecords(A, C, 'A12'), bm = mapRecords(B, C, 'B12');
const idm = new Map(C.id_map.map(r => [r.sample_id, r]));
if (idm.size !== C.id_map.length || idm.size !== C.records.length || new Set(C.records.map(r => r.source_slug)).size !== C.records.length) throw Error('cohort map is not bijective');
const packet = (kind, id) => read(`r12/packets/${kind}/${id}.json`);
const rows = C.records.map(c => {
  const m = idm.get(c.sample_id);
  if (m?.source_slug !== c.source_slug) throw Error(`r12 ID/slug mapping broken: ${c.source_slug}`);
  const scope = scopeBySlug.get(c.source_slug);
  if (!eqSlugs(scope.reasons.map(x => x.class), c.history.round12.reason_classes)) throw Error(`Scope reasons differ: ${c.source_slug}`);
  const rawA = am.get(c.sample_id), rawB = bm.get(c.sample_id);
  const s0 = packet('s0', c.sample_id), fu = packet('fu', c.sample_id), claims = packet('claims', c.sample_id);
  for (const p of [s0, fu, claims]) if (p.sample_id !== c.sample_id || p.packet_version !== C.standard_version) throw Error(`Packet binding/version mismatch ${c.sample_id}`);
  return { id: c.sample_id, slug: m.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role, reason_classes: c.history.round12.reason_classes, scope_evidence: scope, rawA, rawB, A: normalize(rawA), B: normalize(rawB), s0, fu, claims };
}).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySlug = new Map(rows.map(r => [r.slug, r]));
// R9-P: HEAD was frozen to the full SHA below at scoring time; quotes use that commit.
// --rules-revision=<sha> permits later replay of this exact recorded revision.
// Pinned default: 0fab88de2b6de599589a0d63967320b9480154c2 = HEAD when round 12 was scored (R9-P); override with --rules-revision.
const RULE_REVISION = execFileSync('git', ['rev-parse', process.argv.find(x=>x.startsWith('--rules-revision='))?.split('=')[1] || '0fab88de2b6de599589a0d63967320b9480154c2'], {cwd:REPO,encoding:'utf8'}).trim();
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
const jobRule=ref(STANDARD,'§6.10','| Secondary decision |'),jobExample=ref(STANDARD,'§6.10','| Worked example (R9-Q1) |');
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
const r10q1=ref(LEDGER,'R10-Q1','| R10-Q1 |'),r10q2=ref(LEDGER,'R10-Q2','| R10-Q2 |');
const strengthRule=ref(STANDARD,'§6.10','2. **Classify each signal'),selectionRule=ref(STANDARD,'§6.10','4. **Fill at most two'),collectionRule=ref(STANDARD,'§6.10','1. **Collect every job signal');
const nameRule=ref(STANDARD,'§4.2','The RG3-1 form compound stays'),r4q7=ref(LEDGER,'R4-Q7','| R4-Q7 |');
function signals(r, phrases) {
  return phrases.map(([phrase,job,Astrength,Bstrength,basis])=>{
    const c=claims12(r).find(c=>c.text.includes(phrase));
    if(!c)throw Error(`Missing exact signal ${r.slug}: ${phrase}`);
    return {phrase,job,claim:c,packet_index:r.claims.claims.indexOf(c),lane_A_strength:Astrength,lane_B_strength:Bstrength,classification_basis:basis};
  });
}
function formulaProof(r, pattern) {
  const i=r.fu.inci.items.find(i=>pattern.test(i.inci));
  if(!i||['A','B'].some(l=>i.rank >= (r[l].tail_T_S?.rank ?? Infinity)))throw Error(`Formula proof changed ${r.slug}`);
  return i;
}

const r11q1=ref(LEDGER,'R11-Q1','| R11-Q1 |'),r11q2=ref(LEDGER,'R11-Q2','| R11-Q2 |');
const vocabRule=ref(STANDARD,'§6.10','| Primary and vocabulary |'),gateRule=ref(STANDARD,'§6.10','| Formula compatibility |');
const r7Rule=ref(STANDARD,'§4.2','**R7 job reading'),volumeRule=ref(STANDARD,'§6.10','2. **Classify each signal');
function adjudicate(r,field) {
  if(field!=='secondary_jobs')throw Error(`Unadjudicated ${r.slug}::${field}`);
  const base={right_lane:null,wrong_lanes:[],rules:[collectionRule,strengthRule,selectionRule,vocabRule,gateRule],evidence:claims12(r),section:'§6.10 steps 1, 2 and 4; property set §2.12'};
  if(r.slug==='balea-locken-crunchgel') {
    if(!eq(r.A[field],set(['frizz_control','volume']))||!eq(r.B[field],set(['frizz_control','texture'])))throw Error('Crunchgel split changed');
    return {...base,classification:'b',issue_key:'result_construction_strength',rules:[...base.rules,r11q1,r10q2],
      signal_comparison:signals(r,[['Mit Anti-Frizz-Effekt','frizz_control','STRONG','NOT_RECORDED','A states STRONG; B selects frizz but does not supply a strength label.'],['Für definierte Locken voller Sprungkraft','volume','WEAK','WEAK','Both traces call curl-quality volume weak.'],['Das Haar erhält eine flexible Struktur und einen schönen Glanz','texture','WEAK','STRONG','A reads flexible Struktur as a look; B explicitly calls texture strong.']]),
      formula_evidence:formulaProof(r,/^HYDROLYZED CORN STARCH$/i),
      explanation:'R11-Q1 clearly makes curl-quality Sprungkraft WEAK. The remaining split is texture strength: “Das Haar erhält eine flexible Struktur” has an explicit result verb, supporting B’s STRONG job-promise reading, but the result itself is a descriptive flexible-structure look, supporting A’s WEAK reading. R10-Q2 admits Struktur as texture and makes a look description weak; step 2 also calls an explicit job promise strong. Neither settles this verb-plus-look construction. With WEAK texture, the earlier WEAK volume fills the remaining slot (A); with STRONG texture, it precedes WEAK volume (B). Natural film r3 supports both; shine fails its gate.',
      proposed_fix:'Clarify §6.10 step 2 and property set §2.12 whether result verbs (erhält/verleiht) turn hair-look descriptions such as flexible Struktur into STRONG promises, with contrasting examples independent of claim type; replay the reached set.',
      owner_question:'For Balea Locken Crunchgel, should “Das Haar erhält eine flexible Struktur” count as an explicit strong texture promise, or as a weak look description, leaving the earlier curl-bounce volume signal in the second slot?',
      recommendation:'Treat explicit hair-result verbs plus a texture noun as STRONG texture; reserve WEAK for descriptive look fragments. This proposed clarification would select B’s set, but is not current scoring authority.'};
  }
  if(r.slug==='balea-professional-styling-cream-traumlocken') {
    if(!eq(r.A[field],set(['frizz_control','hold_fix']))||!eq(r.B[field],set(['frizz_control','shine'])))throw Error('Traumlocken split changed');
    return {...base,classification:'b',issue_key:'formula_for_gloss_strength',rules:[...base.rules,r11q1],
      signal_comparison:signals(r,[['Schützt effektiv vor Frizz','frizz_control','STRONG','STRONG','A labels strong; B explicitly says strong frizz.'],['LEISTUNGSSTARKE FORMEL FÜR DEFINIERTE, LEBENDIGE LOCKEN VOLLER SPRUNGKRAFT UND NATÜRLICHEM GLANZ','shine','WEAK','STRONG (source not specified)','A explicitly labels gloss weak; B says strong shine without naming the exact source, so this is a plausible source, not an attributed per-line trace.'],['Halt: mittlerer Halt','hold_fix','STRONG','NOT_RECORDED','Strength word clearly makes hold strong; B does not trace its hold exclusion.']]),
      formula_evidence:[formulaProof(r,/^VP\/VA COPOLYMER$/i),formulaProof(r,/^ISOPROPYL PALMITATE$/i)],
      explanation:'Both now respect R11-Q1: curl-quality Sprungkraft is WEAK and does not displace compatible STRONG jobs. R11-Q1 does not decide shine strength. A reads NATÜRLICHEM GLANZ in the formula-for-curls result sentence as a WEAK look description; B explicitly calls shine STRONG but does not identify its exact source. The emphasized LEISTUNGSSTARKE FORMEL FÜR … NATÜRLICHEM GLANZ supports the explicit emphasized promise reading in step 2, while the same step’s look-description sentence supports A. If shine is STRONG, its earlier claim precedes graded hold; if WEAK, strong frizz and mittlerer Halt occupy the two slots. Shine passes wax_lipid r4, hold passes VP/VA r3; neither is a formula error. “Perfekt definierte, glänzende Locken” must separately respect R7-Q1 adjective exclusions and is not automatically B’s source.',
      proposed_fix:'Clarify §6.10 step 2 and property set §2.12 for formula-for/result-noun shine wording, including whether emphasis on FORMEL transfers to a trailing NATÜRLICHEM GLANZ signal. Preserve the volume-only R11-Q1 exception and require source-specific strength traces before replay.',
      owner_question:'For Balea PROFESSIONAL Styling Cream Traumlocken, does “LEISTUNGSSTARKE FORMEL FÜR … LOCKEN … UND NATÜRLICHEM GLANZ” promise strong shine, taking the second slot before hold, or describe a weak gloss look?',
      recommendation:'Treat trailing natural-gloss description as WEAK unless gloss itself is explicitly emphasized or promised by its own action phrase; then A’s frizz_control + hold_fix follows. This is proposed wording, not an approved amendment.'};
  }
  if(r.slug==='bali-curls-volumizing-curl-spray-refreshing') {
    if(!eq(r.A[field],set(['texture','volume']))||!eq(r.B[field],set(['definition','volume'])))throw Error('Bali split changed');
    return {...base,classification:'a',right_lane:'A',wrong_lanes:['B'],correct_value:r.A[field],rules:[...base.rules,r7Rule,nameRule],issue_key:'revival_name_is_refresh',
      formula_evidence:formulaProof(r,/^MAGNESIUM SULFATE$/i),
      explanation:'The confirmed name is Volumizing Curl Spray and the C2 lead says erfrischt deine Locken, with revival directions. §4.2 explicitly says a curl word is “definition, or refresh when the product revives curls”; §6.10 retains “curl-revival refresh exceptions”. Both select refresh as primary. B nevertheless reintroduces the same curl word as a STRONG definition secondary; the explicit exception makes it refresh, then step 4 excludes the primary’s job. A keeps name-volume and the Beachlook texture result. Magnesium Sulfate r2 supports both compatible secondaries. “Für Locken, Wellen & alle Haartypen geeignet” is suitability, not a descriptive promise to define/shape curls.',
      proposed_fix:'Correct lane B secondary_jobs to the unordered set texture + volume; record the revival-name exception in its signal trace. No rule amendment is needed.'};
  }
  if(r.slug==='balea-finishing-spray-glow-und-care') {
    if(!eq(r.A[field],set(['frizz_control','sleek']))||!eq(r.B[field],set(['frizz_control'])))throw Error('Glow split changed');
    return {...base,classification:'d',issue_key:'humidity_smooth_scope',
      formula_evidence:formulaProof(r,/^Triheptanoin$/i),
      explanation:'The C2 humidity line promises Anti-Frizz Effekt and says “bleibt das Haar auch bei hoher Luftfeuchtigkeit glatt und kontrolliert”. A treats Haar … glatt as a WEAK whole-style smooth result; B retains only the anti-frizz job. R9-Q1 and step 1 admit result words from humidity lines, so the typed field cannot exclude sleek. But vocabulary restricts sleek to “a smooth or straight result of the whole style”; the line does not explicitly distinguish maintained flyaway/frizz smoothness from overall shape. A has a basis in the whole-hair subject, B in the anti-frizz context and the whole-style restriction. No rule clearly separates those readings. The free slot and wax_lipid r6 would permit sleek if admitted.',
      proposed_fix:'Clarify §6.10 vocabulary and property set §2.12 whether Haar bleibt glatt in an anti-frizz/humidity claim is a whole-style sleek signal, or requires an explicit overall look/straightening anchor; add both positive and negative examples and replay the reached profiles.',
      owner_question:'For Balea Finishing Spray Glow & Care, should “das Haar … glatt und kontrolliert” under an Anti-Frizz promise show a separate smoothing job, or only the frizz-control job?',
      recommendation:'Require an explicit overall look/shape anchor for a separate sleek job in an anti-frizz humidity sentence; then retain B’s frizz_control-only set. This is a proposed clarification, not a proven A error.'};
  }
  throw Error(`Unadjudicated difference ${r.slug}::${field}`);
}
const disagreements=rows.flatMap(r=>USER.filter(f=>!eq(r.A[f],r.B[f])).map(field=>({slug:r.slug,id:r.id,name:r.name,field,A:r.A[field],B:r.B[field],blocks_lock:null,...adjudicate(r,field)})));
for(const d of disagreements)d.blocks_lock=d.classification!=='a';
const classified=Object.fromEntries(['a','b','c','d'].map(k=>[k,disagreements.filter(d=>d.classification===k).length]));
const calculationDifferences=rows.flatMap(r=>LOG.filter(f=>!eq(r.A[f],r.B[f])).map(field=>({slug:r.slug,id:r.id,field,A:r.A[field],B:r.B[field],blocks_lock:false})));
const normalizationAudit=rows.flatMap(r=>['A','B'].map(lane=>({slug:r.slug,id:r.id,lane,explicitly_informational:informational(r[`raw${lane}`]),rule:emissionRule,raw_user_fields:Object.fromEntries(USER.map(f=>[f,r[`raw${lane}`][f]??null])),normalized_user_fields:Object.fromEntries(USER.map(f=>[f,r[lane][f]])),excluded_informational_fields:informational(r[`raw${lane}`])?USER.filter(f=>!['route','subtype'].includes(f)&&r[`raw${lane}`][f]!=null):[]})));
const userAgreement=agreement(rows,USER),logAgreement=agreement(rows,LOG);
const profileAgreement=agreement(rows.filter(r=>prof(r.rawA)||prof(r.rawB)),USER);
function effect(r,ruling,expected,rules,explanation) {
  if(!r)return {ruling,name:({'R8-Q1':'L’Oréal Elvital Big Hair Day','R8-H':'Moroccanoil Glättende Creme'}[ruling]||ruling),applicable:false,status:'NOT_IN_COHORT',expected,rules,explanation,A_landed:null,B_landed:null};
  const actual=l=>Object.fromEntries(Object.keys(expected).map(k=>[k,r[l][k]]));
  return {ruling,slug:r.slug,id:r.id,name:r.name,applicable:true,expected,A:actual('A'),B:actual('B'),A_landed:eq(actual('A'),expected),B_landed:eq(actual('B'),expected),rules,explanation,evidence:claims12(r),A_trace:trace(r.rawA),B_trace:trace(r.rawB)};
}
function requiredSecondaryEffect(r,ruling,job,rules,re) {
  if(!r)throw Error(`Missing ${ruling} exemplar`);
  return {ruling,slug:r.slug,id:r.id,name:r.name,applicable:true,expected:{required_secondary:job},A:{secondary_jobs:r.A.secondary_jobs},B:{secondary_jobs:r.B.secondary_jobs},A_landed:r.A.secondary_jobs?.includes(job)===true,B_landed:r.B.secondary_jobs?.includes(job)===true,rules,evidence:evidence(r,re),explanation:'Required result is an eligible, supported secondary; other eligible members may occupy the remaining slot.'};
}

const rulingEffects=[
  effect(bySlug.get('balea-professional-styling-cream-traumlocken'),'R11-Q1',{},[r11q1,volumeRule],'Curl-quality volume is WEAK; no volume should displace compatible STRONG jobs.'),
  effect(bySlug.get('schwarzkopf-taft-styling-balm-locken-halt-3'),'R11-Q1',{},[r11q1,volumeRule],'Curl-quality Sprungkraft is WEAK; hold and frizz fill the two stronger secondary slots.'),
  effect(bySlug.get('wella-eimi-nutricurls-curl-shaper'),'R11-Q2',{primary_job:'definition',secondary_jobs:set(['frizz_control','hold_fix'])},[r11q2,nameRule,selectionRule],'Curl Shaper (Defining Gel Cream) names one definition job; forms add no name hold job. Explicit frizz and numbered hold still supply secondaries.'),
  effect(bySlug.get('syoss-curl-cream-gel-3in1'),'R11-Q2',{primary_job:'definition',secondary_jobs:[]},[r11q2,nameRule],'Curl Cream Gel names definition once; form words add no hold secondary and duration is not a hold promise.'),
  effect(bySlug.get('loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray'),'R8-Q1',{route:{destination:'dry_shampoo',state:'route:dry_shampoo',boundary_reason:null}},[r8q1],'Freshness between washes beside volume gives Dry Shampoo with a volume direction.'),
  effect(bySlug.get('moroccanoil-glaettende-creme-smoothing-lotion'),'R8-H',{route:{destination:'leave_in',state:'route:leave_in',boundary_reason:null}},[r8h],'Generic definition of krauses Haar with separate curl suitability is not curl definition; not mixed, then border rules give Leave-in.'),
  requiredSecondaryEffect(bySlug.get('got2b-gotgloss-glanz-spray'),'R9-F','frizz_control',[r9f,jobRule],/Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle/)
];
// Volume exclusion is the narrow R11-Q1 effect; it does not resolve other strength disputes.
for(const e of rulingEffects.filter(e=>e.ruling==='R11-Q1')) {
  const r=bySlug.get(e.slug);
  e.expected={volume_secondary:false};
  e.A={secondary_jobs:r.A.secondary_jobs};e.B={secondary_jobs:r.B.secondary_jobs};
  e.A_landed=Array.isArray(r.A.secondary_jobs)&&!r.A.secondary_jobs.includes('volume');
  e.B_landed=Array.isArray(r.B.secondary_jobs)&&!r.B.secondary_jobs.includes('volume');
  e.signal_strength='WEAK';e.A_signal_trace=r.rawA.notes;e.B_signal_trace=r.rawB.notes;
  e.other_secondary_disagreements=disagreements.filter(d=>d.id===r.id).map(d=>({field:d.field,classification:d.classification}));
}
const powders=rows.filter(r=>/puder|powder/i.test(r.s0.product.confirmed_name));
const powderEffects=powders.map(r=>{
  const suppressed=['A','B'].every(l=>r[l].route.state==='blocked:formula_conflict');
  const redken=/Powder\s+Grip/i.test(r.s0.product.confirmed_name);
  const textureEvidence=claims12(r).filter(c=>/textur|griffig|\bgrip\b|struktur/i.test(c.text));
  const primaryExpected=suppressed?null:redken?'texture':'volume';
  const textureRequired=!suppressed&&!redken&&textureEvidence.length>0;
  const secondary=l=>suppressed?r[l].secondary_jobs===null:(!textureRequired||r[l].secondary_jobs?.includes('texture'))&&(!redken||r[l].secondary_jobs?.includes('volume'));
  return {ruling:'R8-Q2',slug:r.slug,id:r.id,name:r.name,applicable:!suppressed,suppression_checked:suppressed,expected:{primary_job:primaryExpected,texture_secondary_required:textureRequired,volume_secondary_required:!suppressed&&redken},A:{primary_job:r.A.primary_job,secondary_jobs:r.A.secondary_jobs},B:{primary_job:r.B.primary_job,secondary_jobs:r.B.secondary_jobs},primary_A_landed:r.A.primary_job===primaryExpected,primary_B_landed:r.B.primary_job===primaryExpected,secondary_A_landed:secondary('A')===true,secondary_B_landed:secondary('B')===true,A_landed:r.A.primary_job===primaryExpected&&secondary('A')===true,B_landed:r.B.primary_job===primaryExpected&&secondary('B')===true,rules:[r8q2,r9q1,r10q1,selectionRule],evidence:textureEvidence,explanation:'Own confirmed powder name contributes volume; a true second job in its name falls to its own lead. Check promised texture from this product, never borrow it from other powders.'};
});
rulingEffects.push(...powderEffects);
if(!powders.some(r=>/Powder\s+Grip/i.test(r.s0.product.confirmed_name)))rulingEffects.push({ruling:'R8-Q2',name:'Redken Powder Grip',applicable:false,status:'NOT_IN_COHORT',A_landed:null,B_landed:null,rules:[r8q2],explanation:'Named two-job exception is absent from r12; no fresh regression pass is claimed.'});
const reachAudit=rows.map(r=>({slug:r.slug,id:r.id,name:r.name,reason_classes:r.reason_classes,screen:r.scope_evidence.screen,primary_A:r.A.primary_job,primary_B:r.B.primary_job,secondary_A:r.A.secondary_jobs,secondary_B:r.B.secondary_jobs,primary_agree:eq(r.A.primary_job,r.B.primary_job),secondary_agree:eq(r.A.secondary_jobs,r.B.secondary_jobs),user_facing_findings:disagreements.filter(d=>d.id===r.id).map(d=>({field:d.field,classification:d.classification})),interpretation:'Scope annotations decide inclusion only, not output values.'}));
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
  return null; // §7.3 unknown-scale brands are words-only
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

const flatten=v=>typeof v==='string'?v:JSON.stringify(v??null);
const registryRule=ref(STANDARD,'§4.1','**Owner-named routes:');
const latent=rows.flatMap(r=>{
  if(disagreements.some(d=>d.id===r.id))return [];
  const reports=['A','B'].flatMap(l=>{
    const raw=r[`raw${l}`],notes=flatten(raw.notes),all=flatten(trace(raw));
    const overrides=/ruled_route_override_registry|letter.*(?:registry|row)|registry.*(?:letter.*differs|letter would|keeps ruling)/i.test(all);
    const ambiguity=/ambigui/i.test(notes);
    return overrides||ambiguity?[{lane:l,kind:overrides?'registry_overrides_rule_letter':'agreed_value_ambiguity',notes:raw.notes,trace:trace(raw)}]:[];
  });
  return reports.length?[{slug:r.slug,id:r.id,name:r.name,blocks_lock:false,reports,issue:reports.map(x=>`Lane ${x.lane}: ${flatten(x.notes)}; ${flatten(x.trace.rule_path)}`).join(' | '),rules:[registryRule,vocabRule],recommendation:'Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.'}]:[];
});
const reportedAmbiguities=['A','B'].flatMap(l=>(l==='A'?A:B).ambiguous_rules?.flatMap(a=>(a.ids||a.records||[]).map(id=>{
  const r=rows.find(x=>x.id===id);if(!r)throw Error(`Unknown ambiguity ${id}`);
  return {lane:l,slug:r.slug,id,name:r.name,report:a,blocks_lock:false,handling:disagreements.some(d=>d.id===id)?'See actual field adjudication.':'Agreed values or calculation log; no independent blocker.'};
}))||[]);
const orderOnly=rows.filter(r=>eq(r.A.secondary_jobs,r.B.secondary_jobs)&&!eq(r.rawA.secondary_jobs,r.rawB.secondary_jobs)&&r.rawA.secondary_jobs?.length&&r.rawB.secondary_jobs?.length).map(r=>({slug:r.slug,id:r.id,raw_A:r.rawA.secondary_jobs,raw_B:r.rawB.secondary_jobs,blocks_lock:false,explanation:'Same unordered set; storage order is calculation log only.'}));
const criteria=[
  {criterion:'Every user-facing A/B disagreement is a proven lane error against a clear rule',met:disagreements.every(d=>d.classification==='a'&&['A','B'].includes(d.right_lane)&&d.rules.length>0)},
  {criterion:'No unresolved user-facing rule gaps (b), packet issues (c), or owner questions (d)',met:['b','c','d'].every(k=>classified[k]===0)}
];
const verdict=criteria.every(c=>c.met)?'PASS':'FAIL';
const applicableEffects=rulingEffects.filter(e=>e.applicable);
const rulingPass=k=>{const es=applicableEffects.filter(e=>e.ruling===k);return es.length?es.every(e=>e.A_landed&&e.B_landed):null;};
const reachSummary=['R11-Q1','R11-Q2'].map(ruling=>{const rs=rows.filter(r=>r.reason_classes.some(c=>c.startsWith(ruling))),ds=disagreements.filter(d=>rs.some(r=>r.id===d.id));return {ruling,records:rs.length,primary_agree:rs.filter(r=>eq(r.A.primary_job,r.B.primary_job)).length,secondary_agree:rs.filter(r=>eq(r.A.secondary_jobs,r.B.secondary_jobs)).length,by_classification:Object.fromEntries(['a','b','c','d'].map(k=>[k,ds.filter(d=>d.classification===k).length])),note:'Overlapping conservative screening groups; coverage and agreement are not correctness oracles.'};});
const effectSummary={R11_Q1_named_volume_exclusion_both:rulingPass('R11-Q1'),R11_Q2_named_compounds_both:rulingPass('R11-Q2'),R8_Q1_Big_Hair_Day_both:rulingPass('R8-Q1'),R8_H_Moroccanoil_both:rulingPass('R8-H'),R9_F_gotGloss_both:rulingPass('R9-F'),R8_Q2:{targets:powderEffects.length,profile_applicable:powderEffects.filter(e=>e.applicable).length,primary_both:powderEffects.filter(e=>e.applicable&&e.primary_A_landed&&e.primary_B_landed).length,texture_secondary_required:powderEffects.filter(e=>e.expected.texture_secondary_required).length,texture_secondary_both:powderEffects.filter(e=>e.expected.texture_secondary_required&&e.secondary_A_landed&&e.secondary_B_landed).length,checks_both:powderEffects.length?powderEffects.every(e=>e.A_landed&&e.B_landed):null},explicit_applicable_checks_both:applicableEffects.every(e=>e.A_landed&&e.B_landed)};
const inputNames=['blind-lane-A-r12/results.json','blind-lane-B-r12/results.json','r12/cohort.json','r12/FREEZE-NOTES.md','r12/scope-audit.json','r12/artifact-manifest.json','round-11/diff.js','round-12/diff.js'];
const inputPaths=inputNames.map(p=>path.join(ROOT,p));
for(const r of rows)for(const k of ['s0','fu','claims'])inputPaths.push(path.join(ROOT,`r12/packets/${k}/${r.id}.json`));
const inputs=[...inputPaths.map(p=>({path:path.relative(REPO,p).split(path.sep).join('/'),source:'working_tree',sha256:digest(p)})),...[...revisionFiles,LEDGER].map(p=>({path:p,source:'pinned_git_revision',revision:RULE_REVISION,sha256:crypto.createHash('sha256').update(pinnedBytes(p)).digest('hex')}))].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const blockers=disagreements.filter(d=>d.blocks_lock);
const output={generated_by:'data/research/styling-inci/v1.0/round-12/diff.js',rule_revision:RULE_REVISION,
  method:'Adapted round-11 scorer; frozen joins, semantic normalization, evidence-conditioned analyst adjudications. A=Claude Opus; B=Codex. Ledger governs. Counts and verdict computed from observed values; no lane preference.',
  scope:{screened_records:SCOPE.screened_records,selected_records:selected.length,actual_records:rows.length,verified_frozen_artifacts:FREEZE.artifacts.length,field_count_note:'Task/cohort specifies 89 products; the phrase 16 records is stale. The explicit list contains 15 comparison columns. Route is composite (destination, held/committed state, boundary reason), so all requested user-facing dimensions remain visible. All 89 products are scored; application_moment is primary only.'},
  inputs,normalisation:NORMALISATION,normalization_audit:normalizationAudit,lock_rules:lockRules,process_rule:r9p,
  counts:{records:rows.length,user_facing_disagreement_cells:disagreements.length,user_facing_disagreement_products:new Set(disagreements.map(d=>d.id)).size,by_classification:classified,blocking_disagreement_cells:blockers.length,distinct_rule_gaps:new Set(disagreements.filter(d=>d.classification==='b').map(d=>d.issue_key)).size,calculation_log_disagreement_cells:calculationDifferences.length,latent_agreed_value_observations:latent.length},
  user_facing_agreement:userAgreement,styling_profile_agreement:profileAgreement,calculation_log_agreement:logAgreement,disagreements,lane_errors:disagreements.filter(d=>d.classification==='a'),rule_gaps:disagreements.filter(d=>d.classification==='b'),packet_issues:disagreements.filter(d=>d.classification==='c'),owner_questions:disagreements.filter(d=>d.classification==='d'),ruling_effects:rulingEffects,ruling_effect_summary:effectSummary,ruling_reach_audit:reachAudit,ruling_reach_summary:reachSummary,hold_check:hold,latent_ambiguities:latent,registry_over_letter_agreed_products:latent.filter(r=>r.reports.some(x=>x.kind==='registry_overrides_rule_letter')),reported_ambiguities:reportedAmbiguities,secondary_storage_order_only:orderOnly,calculation_log_disagreements:calculationDifferences,lock_criteria:criteria,lock_verdict:verdict,
  lock_reason:blockers.length?`${blockers.length} unresolved user-facing cells (${classified.b} rule-gap, ${classified.c} packet-issue, ${classified.d} owner-question); proven lane errors and calculation log never block.`:'Every user-facing difference is a proven lane error and no b/c/d remain.',
  products:rows.map(r=>({id:r.id,slug:r.slug,name:r.name,reason_classes:r.reason_classes,scope_audit_evidence:r.scope_evidence,A:Object.fromEntries(USER.map(f=>[f,r.A[f]])),B:Object.fromEntries(USER.map(f=>[f,r.B[f]])),A_trace:trace(r.rawA),B_trace:trace(r.rawB),fully_agreeing:USER.every(f=>eq(r.A[f],r.B[f])),disagreement_fields:USER.filter(f=>!eq(r.A[f],r.B[f]))})),
  limitations:['Known-product targeted MINI r12, not new unseen validation or a full 143-product revalidation.','Only cohort powders are checked: absent powders, including Redken Powder Grip, remain N/A.','R11-Q1 named volume exclusion can pass while another secondary strength question remains unresolved.','Registry-over-letter and alternate-reading concerns on agreed values are latent and non-blocking; no frozen input is corrected.','Earlier lexicons are provenance; current v0.5 and governing ledger supply authority. No commit, rule amendment, lock activation, catalog or production action.']};
const esc=v=>String(v??'—').replace(/\|/g,'\\|').replace(/\n/g,'<br>');
const val=v=>esc(JSON.stringify(v));
const label=r=>`\`${r.path}:${r.line}\` (${r.section}, pinned ${r.revision.slice(0,12)})`;
function render(d,sha) {
  const u=d.user_facing_agreement,h=d.hold_check;
  let s='# Chaarlie Styling — MINI re-check r12\n\n';
  s+=`**${u.agreeing_cells}/${u.cells} user-facing cells agree (${u.percent_cells}%); ${u.products_fully_agreeing}/${u.records} products fully agree. Lock: ${d.lock_verdict}.**\n\n`;
  s+=`a/b/c/d = **${['a','b','c','d'].map(k=>d.counts.by_classification[k]).join(' / ')}**. ${d.lock_reason}\n\n`;
  s+=`A = Claude Opus; B = Codex, with no preference for B. ${d.scope.field_count_note}\n\nRules pinned to **\`${d.rule_revision}\`**, the scoring-time HEAD (R9-P). ${d.scope.selected_records}/${d.scope.screened_records} screened products selected; cohort/id-map/scope/packet binding verified and ${d.scope.verified_frozen_artifacts} frozen artifact hashes checked. Exact inclusion reasons are retained in diff.json.\n\n`;
  s+=`Styling/held profiles alone: ${d.styling_profile_agreement.agreeing_cells}/${d.styling_profile_agreement.cells} cells agree (${d.styling_profile_agreement.percent_cells}%), ${d.styling_profile_agreement.products_fully_agreeing}/${d.styling_profile_agreement.records} products. Non-Styling/null values remain in the full-cohort denominator above.\n\n`;
  s+='## Ruling effects\n\n| Ruling | Real product | Expected | A | B | A / B landed |\n|---|---|---|---|---|---|\n';
  for(const e of d.ruling_effects)s+=`| ${e.ruling} | ${esc(e.name)} | ${val(e.expected||e.explanation)} | ${e.A?val(e.A):'N/A'} | ${e.B?val(e.B):'N/A'} | ${e.applicable?`${e.A_landed?'yes':'NO'} / ${e.B_landed?'yes':'NO'}`:'not in cohort'} |\n`;
  for(const e of d.ruling_effects.filter(e=>e.applicable))s+=`\n**${e.ruling} — ${esc(e.name)}:** ${e.explanation} ${e.other_secondary_disagreements?.length?'Other secondary membership remains unresolved; this is only the volume-strength effect. ':''}Rules: ${e.rules.map(label).join('; ')}.\n`;
  s+='\nR8-H explicitly checks the not-mixed, border-rule Leave-in outcome. R8-Q2 checks every powder actually in r12; Redken Powder Grip and other absent powders are N/A, not fresh regression passes. R11-Q1 checks weak curl-quality volume exclusion; R11-Q2 checks one definition primary and absence of form-derived hold.\n\n';
  s+='### Full ruling reach\n\n| Scope screen | Products | Primary agree | Secondary agree | a / b / c / d cells |\n|---|---|---|---|---|\n';
  for(const r of d.ruling_reach_summary)s+=`| ${r.ruling} | ${r.records} | ${r.primary_agree}/${r.records} | ${r.secondary_agree}/${r.records} | ${Object.values(r.by_classification).join(' / ')} |\n`;
  s+='\nScreens overlap and include conservative false positives, non-Styling and blocked records. Inclusion is not a classification oracle.\n\n## Every user-facing disagreement\n\n';
  s+='a = proven clear-rule lane error; b = operational wording gap, with section and fix; c = packet issue; d = unsettled owner choice. Both-defensible readings are b/d. Counts are field cells, and secondary arrays are unordered sets.\n\n';
  for(const x of d.disagreements) {
    s+=`### ${esc(x.name)} — ${x.field}: ${x.classification}\n\n\`${x.slug}\` · \`${x.id}\`. A=${val(x.A)}; B=${val(x.B)}. ${x.classification==='a'?`**Lane ${x.right_lane} is right; lane ${x.wrong_lanes.join('/')} is wrong.** Correct: ${val(x.correct_value)}.`:'**Both readings defensible; neither lane is declared right.**'}\n\n${x.explanation}\n\nAffected section: ${x.section}.\n\n`;
    if(x.signal_comparison) {
      s+='| Exact phrase | Job | A strength | B strength | Trace basis |\n|---|---|---|---|---|\n';
      for(const q of x.signal_comparison)s+=`| ${esc(q.phrase)} | ${q.job} | ${q.lane_A_strength} | ${q.lane_B_strength} | ${esc(q.classification_basis)} |\n`;
      s+='\nNOT_RECORDED means no explicit strength trace; output alone does not prove a per-line label.\n\n';
    }
    s+='Exact governing text:\n\n';for(const r of x.rules)s+=`${label(r)}\n\n> ${r.quote}\n\n`;
    s+=`Frozen evidence: ${x.evidence.map(c=>`“${esc(c.text)}” (${c.tier}, ${c.type})`).join('; ')}.\n\n`;
    if(x.owner_question)s+=`**Owner question:** ${x.owner_question}\n\n**Recommendation:** ${x.recommendation}\n\n`;
    s+=`**Fix:** ${x.proposed_fix}\n\n`;
  }
  s+=`## Hold check\n\n**${h.authoritative_agree}/${h.records} authoritative hold values agree**; ${h.authoritative_emitted} numeric levels emitted; ${h.null_in_both} null/null. Raw agreement ${h.raw_agree}/${h.records}. Independent packet-derived claim/scale/suppression check: **${h.oracle_correct_both}/${h.records} correct in both**, ${h.oracle_failures.length} failures.\n\n${h.method}\n\n| Product | A / B | Expected A / B | Captured level |\n|---|---|---|---|\n`;
  for(const r of h.individual_records)s+=`| ${esc(r.name)} | ${val(r.A)} / ${val(r.B)} | ${val(r.expected_A)} / ${val(r.expected_B)} | ${val(r.captured_claim_level)} |\n`;
  s+=`\nHold rules: ${h.rules.map(label).join('; ')}. All ${h.records} records use their own C1/C2 claims and the profile-emission gate. Ungraded hold leaves the level null regardless of secondary-job strength.\n`;
  s+='\n## Latent ambiguities — non-blocking\n\n';
  s+=`${d.registry_over_letter_agreed_products.length} registry-over-letter products (including Elnett 3 Tage Glatt), plus ${d.latent_ambiguities.length-d.registry_over_letter_agreed_products.length} other agreed-value concerns.\n\n`;
  s+=`${d.latent_ambiguities.length} products fully agree while a lane reports an alternate interpretation or registry-over-letter route. These do not enter a/b/c/d disagreement counts.\n\n`;
  for(const x of d.latent_ambiguities)s+=`- **${esc(x.name)}** (\`${x.slug}\`): ${esc(x.issue)} ${x.recommendation}\n`;
  s+='\n### Secondary storage order only\n\n';
  if(!orderOnly.length)s+='None.\n';
  for(const x of d.secondary_storage_order_only)s+=`- ${esc(d.products.find(p=>p.id===x.id).name)}: A=${val(x.raw_A)}, B=${val(x.raw_B)}. Non-blocking calculation log.\n`;
  s+='\n## User-facing agreement\n\n| Field | Agree / all | Disagree | Agreement |\n|---|---|---|---|\n';
  for(const f of u.field_agreement)s+=`| ${f.field} | ${f.agree}/${f.records} | ${f.disagree} | ${f.percent}% |\n`;
  s+='\n### Products fully agreeing\n\n';for(const r of d.products.filter(r=>r.fully_agreeing))s+=`- ${esc(r.name)} (\`${r.slug}\`).\n`;
  s+='\n## Normalization and calculation log\n\n';for(const n of d.normalisation)s+=`- ${n}\n`;
  s+=`\n${d.counts.calculation_log_disagreement_cells} calculation-log cells differ; none blocks. diff.json retains raw and normalized values, exclusions, traces, storage orders, input hashes and scope evidence.\n\n## Lock predicate\n\n| Criterion | Result |\n|---|---|\n`;
  for(const c of d.lock_criteria)s+=`| ${c.criterion} | ${c.met?'PASS':'FAIL'} |\n`;
  s+=`\n**${d.lock_verdict}: ${d.lock_reason}**\n\n`;for(const l of d.limitations)s+=`- ${l}\n`;
  s+='\n## Pinned governing quotations\n\n';
  for(const r of [r11q1,r11q2,r10q1,r10q2,r9q1,r9q2,r9f,r9p,r8q1,r8q2,r8h,...lockRules])s+=`${label(r)}\n\n> ${r.quote}\n\n`;
  s+=`## Reproduction\n\nRun \`node data/research/styling-inci/v1.0/round-12/diff.js --summary\` twice with unchanged inputs. Default rule revision is the literal SHA above, never HEAD. Replay override: \`--rules-revision=${d.rule_revision}\`. Only sibling diff.json/report.md are written; there are no timestamps or randomness.\n\ndiff.json SHA-256: \`${sha}\`.\n`;
  return s;
}
const json=JSON.stringify(output,null,2)+'\n',sha=crypto.createHash('sha256').update(json).digest('hex');
fs.writeFileSync(path.join(__dirname,'diff.json'),json);
fs.writeFileSync(path.join(__dirname,'report.md'),render(output,sha));
if(process.argv.includes('--summary'))console.log(JSON.stringify({agreement:userAgreement,counts:output.counts,ruling_effects:effectSummary,hold:{agree:hold.authoritative_agree,oracle_correct_both:hold.oracle_correct_both,failures:hold.oracle_failures},rule_revision:RULE_REVISION,verdict,sha256:sha},null,2));
if(process.argv.includes('--dump'))for(const d of disagreements)console.log(JSON.stringify(d));
