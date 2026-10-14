#!/usr/bin/env node
'use strict';
// Adapted from round-10/diff.js: frozen bijective join, semantic normalization,
// separate user-facing/log cells, evidence-conditioned adjudication and hold check.
// MINI r11 only. No timestamps, randomness or preset empirical counts/verdicts.
// Usage: node data/research/styling-inci/v1.0/round-11/diff.js [--summary] [--dump]
// Writes ONLY sibling diff.json and report.md; inputs are never rewritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r11/results.json');
const B = read('blind-lane-B-r11/results.json');
const C = read('r11/cohort.json');
const SCOPE = read('r11/scope-audit.json');
const FREEZE = read('r11/artifact-manifest.json');
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
const am = mapRecords(A, C, 'A11'), bm = mapRecords(B, C, 'B11');
const idm = new Map(C.id_map.map(r => [r.sample_id, r]));
if (idm.size !== C.id_map.length || idm.size !== C.records.length || new Set(C.records.map(r => r.source_slug)).size !== C.records.length) throw Error('cohort map is not bijective');
const packet = (kind, id) => read(`r11/packets/${kind}/${id}.json`);
const rows = C.records.map(c => {
  const m = idm.get(c.sample_id);
  if (m?.source_slug !== c.source_slug) throw Error(`r11 ID/slug mapping broken: ${c.source_slug}`);
  const scope = scopeBySlug.get(c.source_slug);
  if (!eqSlugs(scope.reasons.map(x => x.class), c.history.round11.reason_classes)) throw Error(`Scope reasons differ: ${c.source_slug}`);
  const rawA = am.get(c.sample_id), rawB = bm.get(c.sample_id);
  const s0 = packet('s0', c.sample_id), fu = packet('fu', c.sample_id), claims = packet('claims', c.sample_id);
  for (const p of [s0, fu, claims]) if (p.sample_id !== c.sample_id || p.packet_version !== C.standard_version) throw Error(`Packet binding/version mismatch ${c.sample_id}`);
  return { id: c.sample_id, slug: m.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role, reason_classes: c.history.round11.reason_classes, scope_evidence: scope, rawA, rawB, A: normalize(rawA), B: normalize(rawB), s0, fu, claims };
}).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySlug = new Map(rows.map(r => [r.slug, r]));
// R9-P: HEAD was frozen to the full SHA below at scoring time; quotes use that commit.
// --rules-revision=<sha> permits later replay of this exact recorded revision.
// Pinned default: 16000a8061058e1a82ee457d67f82285d694508d = HEAD when round 11 was scored (R9-P); override with --rules-revision.
const RULE_REVISION = execFileSync('git', ['rev-parse', process.argv.find(x=>x.startsWith('--rules-revision='))?.split('=')[1] || '16000a8061058e1a82ee457d67f82285d694508d'], {cwd:REPO,encoding:'utf8'}).trim();
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
  if(!i||['A','B'].some(l=>i.rank>=r[`raw${l}`].tail_markers.T_S.rank))throw Error(`Formula proof changed ${r.slug}`);
  return i;
}
function adjudicate(r,field) {
  if(r.slug==='balea-professional-styling-cream-traumlocken'&&field==='secondary_jobs') {
    if(!eq(r.A[field],set(['frizz_control','hold_fix']))||!eq(r.B[field],set(['frizz_control','volume'])))throw Error('Balea split changed');
    const ss=signals(r,[
      ['Schützt effektiv vor Frizz','frizz_control','STRONG','STRONG','A explicitly says STRONG; B calls this a strong Frizz promise.'],
      ['LEISTUNGSSTARKE FORMEL FÜR DEFINIERTE, LEBENDIGE LOCKEN VOLLER SPRUNGKRAFT UND NATÜRLICHEM GLANZ','volume','WEAK','STRONG (source not specified)','A explicitly treats fuller bounce as a look description; B explicitly calls Sprungkraft strong but does not identify which of the two Sprungkraft/Schwung lines supplies it. This line is the plausible early strong candidate, not an invented exact B trace.'],
      ['SCHWUNGVOLL. DEFINIERT. VERWÖHNT.','volume','WEAK','NOT_RECORDED','B does not identify the source line of its strong bounce reading.'],
      ['Halt: mittlerer Halt','hold_fix','STRONG','NOT_RECORDED','Strength word clearly makes this STRONG under the rule; B omits this job; its stated strong-volume reading is compatible with volume taking the earlier slot, but B does not give a per-signal trace for this hold line.']
    ]);
    return {classification:'b',right_lane:null,wrong_lanes:[],rules:[r10q1,strengthRule,selectionRule,collectionRule],evidence:ss.map(s=>s.claim),signal_comparison:ss,formula_evidence:formulaProof(r,/^VP\/VA COPOLYMER$/i),issue_key:'result_description_emphasis',section:'§6.10 procedure step 2 (explicit/emphasized promise versus look description)',
      explanation:'The C1 phrase presents a leistungsstarke formula for curls voller Sprungkraft. A reads the bounce wording as a WEAK look description; B reads Sprungkraft as STRONG. Both have a basis in step 2: merely describing a result is WEAK, but an explicit emphasized job promise is STRONG. The rule does not decide whether this formula-for/result-noun construction, or the standalone SCHWUNGVOLL slogan, crosses that boundary. Both alternatives pass the same VP/VA r3 gate. If volume is STRONG, it precedes the later graded hold; if WEAK, STRONG frizz and hold fill both slots. Neither selected set is a proven lane error.',
      proposed_fix:'Clarify §6.10 step 2 and property set §2.12 with a general rule for formula-for result nouns (FÜR … VOLLER SPRUNGKRAFT) and standalone emphatic job slogans, including whether emphasis transfers from FORMEL to the result. Add contrasting examples and replay every reached record; do not use upper-case typography alone as strength.',
      owner_question:'For Balea PROFESSIONAL Styling Cream Traumlocken, should “LEISTUNGSSTARKE FORMEL FÜR … LOCKEN VOLLER SPRUNGKRAFT” count as a strong volume promise, so volume takes the second slot, or as a weak look description, so hold takes it?',
      recommendation:'Treat an explicit formula-for result promise as STRONG volume here; retain purely descriptive curl adjectives and isolated slogans as WEAK unless the rule gives them a result-promising construction. This is a proposed amendment, not the scoring oracle.'};
  }
  if(r.slug==='schwarzkopf-taft-styling-balm-locken-halt-3'&&field==='secondary_jobs') {
    if(!eq(r.A[field],set(['hold_fix','frizz_control']))||!eq(r.B[field],set(['hold_fix','volume'])))throw Error('Taft split changed');
    const ss=signals(r,[
      ['Halt 3','hold_fix','STRONG','STRONG','Both identify confirmed-name/brand-number hold; the unmasked name itself is also recorded.'],
      ['Sprungkraft','volume','WEAK','NOT_RECORDED','A explicitly says WEAK. B records that this flexibility line precedes other secondary candidates, but gives no STRONG/WEAK label. Its selected set is compatible with either volume promoted to STRONG, or volume and frizz both treated WEAK. No unsupported label is attributed to B.'],
      ['definierte Locken, Anti-Frizz-Effekt','frizz_control','STRONG','NOT_RECORDED','A explicitly says STRONG. B has no strength trace for this line; its omission cannot prove whether B treated it WEAK or overlooked it.']
    ]);
    return {classification:'b',right_lane:null,wrong_lanes:[],rules:[r10q1,r9q1,strengthRule,selectionRule,collectionRule],evidence:ss.map(s=>s.claim),signal_comparison:ss,formula_evidence:formulaProof(r,/^PVP$/i),issue_key:'standalone_result_label_strength',section:'§6.10 procedure step 2 (bare job labels and result nouns)',
      explanation:'A makes isolated Sprungkraft WEAK and Anti-Frizz-Effekt STRONG. B selects the earlier Sprungkraft with hold, but does not expose strength labels. The standard expressly admits Sprungkraft from a flexibility line, without settling its strength; it distinguishes explicit job promises from passing mentions, without deciding bare Anti-Frizz-Effekt in a comma-separated finish description. Reading that effect noun as an explicit result promise is defensible; reading both bare result nouns as passing mentions is also defensible. The latter puts earlier volume before frizz among WEAK signals. PVP r4 passes both gates. The older r10 Taft lane-error conclusion used chronological order before the new strength procedure and cannot decide r11.',
      proposed_fix:'Clarify §6.10 step 2 and property set §2.12: classify standalone result nouns such as Sprungkraft and Anti-Frizz-Effekt with examples independent of packet type; state whether an effect label alone is an explicit promise or needs an action/benefit construction. Require per-signal strength traces and replay the reached products.',
      owner_question:'For Schwarzkopf taft Styling Balm LOCKEN Halt 3, should the bare “Anti-Frizz-Effekt” be stronger than the earlier bare “Sprungkraft”, so anti-frizz gets the remaining secondary slot?',
      recommendation:'Treat an explicit anti-frizz effect label as STRONG frizz_control and isolated Sprungkraft as WEAK volume; that selects hold_fix + frizz_control. Approve this general wording distinction before applying it as a lane-error oracle.'};
  }
  if(r.slug==='wella-eimi-nutricurls-curl-shaper'&&['primary_job','secondary_jobs'].includes(field)) {
    const e=evidence(r,/bändigt Frizz|Haltestufe|definierte Locken, Kontrolle und Sprungkraft/);
    if(!/Curl Shaper.*Defining Gel Cream/.test(r.claims.confirmed_name))throw Error('Wella name changed');
    const ss=signals(r,[['Die Formel bändigt Frizz und schließt Feuchtigkeit ein','frizz_control','STRONG','STRONG','Explicit taming promise: A secondary, B primary.'],['Haltestufe: 2','hold_fix','STRONG','STRONG','Brand-number hold is strong in both readings.']]);
    if(r.A.primary_job!=='definition'||r.B.primary_job!=='frizz_control'||!eq(r.A.secondary_jobs,set(['frizz_control','hold_fix']))||!eq(r.B.secondary_jobs,set(['definition','hold_fix'])))throw Error('Wella split changed');
    return {classification:'b',right_lane:null,wrong_lanes:[],issue_key:'compound_name_job_scope',rules:[r4q7,nameRule,collectionRule,strengthRule,selectionRule],evidence:e,signal_comparison:ss,
      confirmed_name_signal_comparison:{name:r.claims.confirmed_name,A:{definition:'STRONG / primary',Gel:'form-only; no hold job'},B:{definition:'STRONG / secondary',Gel:'STRONG hold job'},rule:'Curl/Defining/Shaper denotes one definition job and Nutricurls is a collection. Dispute: whether Gel in Gel Cream retains its hold job or is part of the form-only compound exception.'},
      formula_evidence:formulaProof(r,/^Vp\/va Copolymer$/i),section:'§4.2 step 1 (RG3-1 form-compound exception versus R4-Q7 product-noun rule); §6.10 primary exclusion',
      explanation:'B has the stronger literal R4-Q7 reading: Gel names hold and Curl/Defining/Shaper names definition, so two jobs send primary selection to the first C2 promise, bändigt Frizz. A has a defensible basis in the same §4.2 paragraph’s retained statement that a product noun used as a form in a compound with another product noun supplies no job; A applies this to Gel Cream. The later dispensing-form restriction has spray examples but no defined form vocabulary or explicit Gel Cream decision. D7 separately names Gel Cream as a curl-cream sale, which decides subtype, not the number of name jobs. Under the required both-defensible ceiling, this textual scope ambiguity is a rule gap, not a proven lane error. The secondary cell shares the same cause: excluding definition versus frizz_control as primary changes the selected set; STRONG frizz, name-definition and numbered hold are otherwise supported and VP/VA r3 passes the gate.',
      proposed_fix:'Clarify §4.2’s general compound sentence and R4-Q7 exception together: define dispensing-form scope, expressly classify Gel Cream and Cream Gel, and synchronize §6.10 name vocabulary / property set §2.12. Then replay all compound names reached by that general rule. Count these two cells separately but retain one shared issue_key.',
      owner_question:'For Wella EIMI Nutricurls Curl Shaper (Defining Gel Cream), does Gel still add a hold job beside Curl, so the first Frizz promise supplies the primary, or does Gel Cream describe only the form, leaving definition primary?',
      recommendation:'Keep Gel as a STRONG hold job in Gel Cream and restrict the form-only exception to explicitly defined dispensing forms. That selects primary frizz_control and secondary definition + hold_fix, matching B; it is a proposed clarification, not a present-rule lane-error finding.'};
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
  if(!r)return {ruling,name:({'R8-Q1':'L’Oréal Elvital Big Hair Day','R8-H':'Moroccanoil Glättende Creme'}[ruling]||ruling),applicable:false,status:'NOT_IN_COHORT',expected,rules,explanation,A_landed:null,B_landed:null};
  const actual=l=>Object.fromEntries(Object.keys(expected).map(k=>[k,r[l][k]]));
  return {ruling,slug:r.slug,id:r.id,name:r.name,applicable:true,expected,A:actual('A'),B:actual('B'),A_landed:eq(actual('A'),expected),B_landed:eq(actual('B'),expected),rules,explanation,evidence:claims12(r),A_trace:trace(r.rawA),B_trace:trace(r.rawB)};
}
function requiredSecondaryEffect(r,ruling,job,rules,re) {
  if(!r)throw Error(`Missing ${ruling} exemplar`);
  return {ruling,slug:r.slug,id:r.id,name:r.name,applicable:true,expected:{required_secondary:job},A:{secondary_jobs:r.A.secondary_jobs},B:{secondary_jobs:r.B.secondary_jobs},A_landed:r.A.secondary_jobs?.includes(job)===true,B_landed:r.B.secondary_jobs?.includes(job)===true,rules,evidence:evidence(r,re),explanation:'Required result is an eligible, supported secondary; other eligible members may occupy the remaining slot.'};
}
const rulingEffects=[
  effect(bySlug.get('got2b-styling-puder-volumen-powderfull'),'R10-Q1',{primary_job:'volume',secondary_jobs:['hold_fix'],hold_level:null},[r10q1,strengthRule,selectionRule,ref(STANDARD,'§6.10','| got2b Puder Volumen Powderfull |')],'STRONG name/volume promise is primary; exact C2 mit natürlichem Halt is WEAK hold_fix and fills a free slot. Hold level stays null. The pinned worked example provides the outcome; actual lane values are computed.'),
  effect(bySlug.get('bali-gents-haarpuder-volumizing-styling-powder'),'R10-Q2',{primary_job:'volume',secondary_jobs:['texture']},[r10q2,strengthRule,selectionRule,ref(STANDARD,'§6.10','| Bali Gents Haarpuder (VOLUMIZING STYLING POWDER) |')],'STRONG Powder/volume is primary; exact C2 einen natürlich strukturierten Look is WEAK texture, filling a free slot. C3 grip copy remains excluded.'),
  requiredSecondaryEffect(bySlug.get('balea-pure-styling-volumenpuder-spray'),'R9-Q1','texture',[r9q1,jobRule,jobExample],/griffige Textur direkt am Ansatz/),
  effect(bySlug.get('neqi-diamond-glass-styling-spray-all'),'R9-Q2',{primary_job:'sleek'},[r9q2,jobRule],'Named heat-activated smooth Glass Hair look takes primary over the adjacent shine adjective.'),
  requiredSecondaryEffect(bySlug.get('neqi-diamond-glass-styling-spray-all'),'R9-Q2','shine',[r9q2,jobRule],/glänzenden.*glatten/),
  requiredSecondaryEffect(bySlug.get('got2b-gotgloss-glanz-spray'),'R9-F','frizz_control',[r9f,jobRule],/Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle/),
  effect(bySlug.get('loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray'),'R8-Q1',{route:{destination:'dry_shampoo',state:'route:dry_shampoo',boundary_reason:null}},[r8q1],'Big Hair Day is not selected in r11; no fresh two-lane observation exists. N/A is never a passing regression check.'),
  effect(bySlug.get('moroccanoil-glaettende-creme-smoothing-lotion'),'R8-H',{route:{destination:'leave_in',state:'route:leave_in',boundary_reason:null}},[r8h],'Not mixed: generic Definition of frizzy hair with separate curl suitability is not curl definition. Border rules route Leave-in.')
];
for(const [slug,re,inci] of [
  ['got2b-styling-puder-volumen-powderfull',/natürlichem Halt/,/^Silica Silylate$/i],
  ['bali-gents-haarpuder-volumizing-styling-powder',/natürlich strukturierten Look/,/^Silica Silylate$/i]
]){
  const r=bySlug.get(slug);if(!r)throw Error(`Missing mandatory r11 exemplar ${slug}`);
  const e=rulingEffects.find(e=>e.slug===slug);e.signal_evidence=evidence(r,re);e.formula_evidence=formulaProof(r,inci);
  e.signal_strength='WEAK';e.A_signal_trace=r.rawA.notes;e.B_signal_trace=r.rawB.notes;
}
const powders=rows.filter(r=>/puder|powder/i.test(r.s0.product.confirmed_name));
const powderEffects=powders.map(r=>{
  const suppressed=['A','B'].every(l=>r[l].route.state==='blocked:formula_conflict');
  const redken=/Powder\s+Grip/i.test(r.s0.product.confirmed_name);
  if(redken)evidence(r,/FÜR MEHR GRIFFIGKEIT/);
  const textureEvidence=claims12(r).filter(c=>/textur|griffig|\bgrip\b|struktur/i.test(c.text));
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
    explanation:suppressed?'Formula conflict suppresses the entire Styling profile; not a volume-primary success.':redken?'Two-job Powder Grip name falls to texture lead; volume secondary.':'Powder noun contributes volume; the packet lead decides a multi-job name. Required texture/grip/structured-look secondaries checked under R8-Q2 plus R10-Q2; ungraded hold eligibility follows R10-Q1.'};
});
rulingEffects.push(...powderEffects);
if(!rows.some(r=>/Powder\s+Grip/i.test(r.s0.product.confirmed_name)))rulingEffects.push({ruling:'R8-Q2',name:'Redken Powder Grip',applicable:false,status:'NOT_IN_COHORT',A_landed:null,B_landed:null,rules:[r8q2],explanation:'The named two-job exception is absent from r11; no regression pass claimed.'});
const reachAudit=rows.map(r=>({slug:r.slug,id:r.id,name:r.name,reason_classes:r.reason_classes,
  R10_Q1_screen:r.scope_evidence.screen,
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
const latent=rows.filter(r=>/AMBIGUI/i.test(typeof r.rawA.notes==='string'?r.rawA.notes:'')&&!disagreements.some(d=>d.slug===r.slug)).map(r=>({slug:r.slug,id:r.id,name:r.name,blocks_lock:false,
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
const reachSummary=['R10-Q1','R10-Q2','R9-F'].map(ruling=>{const rs=rows.filter(r=>r.reason_classes.some(c=>c.startsWith(ruling))),ds=disagreements.filter(d=>rs.some(r=>r.id===d.id));return {ruling,records:rs.length,primary_agree:rs.filter(r=>eq(r.A.primary_job,r.B.primary_job)).length,secondary_agree:rs.filter(r=>eq(r.A.secondary_jobs,r.B.secondary_jobs)).length,by_classification:Object.fromEntries(['a','b','c','d'].map(k=>[k,ds.filter(d=>d.classification===k).length])),note:'Overlapping lexical-screen groups; agreement is not an independent ruling-correctness oracle.'};});
const effectSummary={R10_Q1_Powerfull_hold_fix_both:rulingPass('R10-Q1'),R10_Q2_Bali_texture_both:rulingPass('R10-Q2'),R9_Q1_Balea_texture_both:rulingPass('R9-Q1'),
  R9_Q2_NEQI_All_both:rulingPass('R9-Q2'),R9_F_gotGloss_both:rulingPass('R9-F'),R8_Q1_Big_Hair_Day_both:rulingPass('R8-Q1'),R8_H_Moroccanoil_both:rulingPass('R8-H'),
  R8_Q2:{targets:powderEffects.length,profile_applicable:powderEffects.filter(e=>e.applicable).length,suppressed:powderEffects.filter(e=>!e.applicable).length,
    primary_both:powderEffects.filter(e=>e.applicable&&e.primary_A_landed&&e.primary_B_landed).length,
    texture_secondary_required:powderEffects.filter(e=>e.expected.texture_secondary_required).length,
    texture_secondary_both:powderEffects.filter(e=>e.expected.texture_secondary_required&&e.secondary_A_landed&&e.secondary_B_landed).length,
    powder_rule_checks_both:powderEffects.every(e=>e.A_landed&&e.B_landed),other_secondary_unresolved:powderEffects.filter(e=>e.unresolved_other_secondary_cells.length).length},
  explicit_applicable_ruling_checks_both:applicableEffects.every(e=>e.A_landed&&e.B_landed),
  all_user_facing_ruling_interpretations_resolved:disagreements.every(d=>d.classification==='a')};
const inputNames=['blind-lane-A-r11/results.json','blind-lane-B-r11/results.json','r11/cohort.json','r11/FREEZE-NOTES.md','r11/scope-audit.json','r11/artifact-manifest.json','round-10/diff.js','round-11/diff.js'];
const inputPaths=inputNames.map(p=>path.join(ROOT,p));
for(const r of rows)for(const k of ['s0','fu','claims'])inputPaths.push(path.join(ROOT,`r11/packets/${k}/${r.id}.json`));
const pinnedPaths=[...revisionFiles,LEDGER];
const inputs=[...inputPaths.map(p=>({path:path.relative(REPO,p).split(path.sep).join('/'),source:'working_tree',sha256:digest(p)})),...pinnedPaths.map(p=>({path:p,source:'pinned_git_revision',revision:RULE_REVISION,sha256:crypto.createHash('sha256').update(pinnedBytes(p)).digest('hex')}))].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const blockers=disagreements.filter(d=>d.blocks_lock);
const output={generated_by:'data/research/styling-inci/v1.0/round-11/diff.js',rule_revision:RULE_REVISION,
  method:'Adapted round-10 scorer; frozen bijective joins and semantic normalization preserved. A=Claude Opus; B=Codex. Evidence-conditioned analyst judgments, computed totals and lock predicate. Ledger governs; no lane preference.',
  scope:{screened_records:SCOPE.screened_records,selected_records:selected.length,actual_records:rows.length,verified_frozen_artifacts:FREEZE.artifacts.length,
    field_count_note:'The request lists 15 field columns and refers to 16 records; the explicit task and frozen cohort specify 51. r11 contains 51 records; all are scored. Route is one composite field preserving destination, held/committed state and boundary reason; application_moment is primary only.'},
  inputs,normalisation:NORMALISATION,normalization_audit:normalizationAudit,lock_rules:lockRules,process_rule:r9p,
  counts:{records:rows.length,user_facing_disagreement_cells:disagreements.length,user_facing_disagreement_products:new Set(disagreements.map(d=>d.slug)).size,by_classification:classified,
    blocking_disagreement_cells:blockers.length,distinct_rule_gaps:new Set(disagreements.filter(d=>d.classification==='b').map(d=>d.issue_key)).size,calculation_log_disagreement_cells:calculationDifferences.length,latent_agreed_value_observations:latent.length},
  user_facing_agreement:userAgreement,calculation_log_agreement:logAgreement,disagreements,
  lane_errors:disagreements.filter(d=>d.classification==='a'),rule_gaps:disagreements.filter(d=>d.classification==='b'),packet_issues:disagreements.filter(d=>d.classification==='c'),owner_questions:disagreements.filter(d=>d.classification==='d'),
  ruling_effects:rulingEffects,ruling_effect_summary:effectSummary,ruling_reach_audit:reachAudit,ruling_reach_summary:reachSummary,hold_check:hold,
  latent_ambiguities:latent,reported_ambiguities:reportedAmbiguities,secondary_storage_order_only:orderOnly,calculation_log_disagreements:calculationDifferences,
  lock_criteria:criteria,lock_verdict:verdict,
  lock_reason:blockers.length?`${blockers.length} unresolved user-facing disagreement cells (${classified.b} rule-gap cells, ${classified.c} packet-issue cells, ${classified.d} owner-question cells); clear lane errors and calculation-log differences do not block.`:'All user-facing disagreement cells are proven lane errors and no unresolved b/c/d cells remain.',
  products:rows.map(r=>({id:r.id,slug:r.slug,name:r.name,reason_classes:r.reason_classes,scope_audit_evidence:r.scope_evidence,A:Object.fromEntries(USER.map(f=>[f,r.A[f]])),B:Object.fromEntries(USER.map(f=>[f,r.B[f]])),A_trace:trace(r.rawA),B_trace:trace(r.rawB),fully_agreeing:USER.every(f=>eq(r.A[f],r.B[f])),disagreement_fields:USER.filter(f=>!eq(r.A[f],r.B[f]))})),
  limitations:['Known-product targeted MINI r11, not new unseen validation or a full 143-product revalidation.',
    'R8-Q1 Big Hair Day, R8-H Moroccanoil Glättende Creme and Redken Powder Grip are absent; no two-lane regression pass is inferred for absent records.',
    'Agreement and passing named effects do not resolve the explicit-promise versus look-description strength threshold. Both-defensible readings are b/d, never fabricated lane errors.',
    'Reported hypothetical alternatives on agreed values are separate non-blocking observations under the requested lock comparison.',
    'Older lexicons are pinned and fingerprinted as provenance; v0.5 and the governing ledger are the current authority.',
    'No frozen inputs corrected, no lock reinstated, no commit, no catalog or production action.']};
const esc=v=>String(v??'—').replace(/\|/g,'\\|').replace(/\n/g,'<br>');
const val=v=>esc(JSON.stringify(v));
const label=r=>`\`${r.path}:${r.line}\` (${r.section}, pinned ${r.revision.slice(0,12)})`;
function render(d,sha){
  const u=d.user_facing_agreement,c=d.counts,h=d.hold_check,e=d.ruling_effect_summary;
  let s='# Chaarlie Styling — MINI re-check r11\n\n';
  s+=`**${u.agreeing_cells}/${u.cells} user-facing cells agree (${u.percent_cells}%); ${u.products_fully_agreeing}/${u.records} products fully agree. Lock: ${d.lock_verdict}.**\n\n`;
  s+=`A/B field-cell classifications: **a=${c.by_classification.a}, b=${c.by_classification.b}, c=${c.by_classification.c}, d=${c.by_classification.d}** (${c.distinct_rule_gaps} distinct rule gaps). ${d.lock_reason}\n\n`;
  s+=`A = Claude Opus; B = Codex. No preference for B. ${d.scope.field_count_note}\n\n`;
  s+=`Rules/quotes pinned at scoring time to HEAD **\`${d.rule_revision}\`** (R9-P). ${d.scope.selected_records}/${d.scope.screened_records} screened products selected; bijective cohort/id-map/packet/scope joins verified and ${d.scope.verified_frozen_artifacts} frozen artifact hashes checked. Inclusion reasons and exact screen evidence are retained per product in diff.json.\n\n`;
  s+='## Ruling effects\n\n| Ruling | Product | Expected | A | B | A / B landed |\n|---|---|---|---|---|---|\n';
  for(const x of d.ruling_effects)s+=`| ${x.ruling} | ${esc(x.name||'Big Hair Day')} | ${val(x.expected||x.explanation)} | ${x.A?val(x.A):'N/A'} | ${x.B?val(x.B):'N/A'} | ${x.status==='NOT_IN_COHORT'?'not in cohort':`${x.A_landed?'yes':'NO'} / ${x.B_landed?'yes':'NO'}`}${x.suppression_checked?' (suppression only)':''}${x.unresolved_other_secondary_cells?.length?' (other secondary unresolved)':''} |\n`;
  s+=`\nR10-Q1 Powerfull WEAK hold_fix: **${e.R10_Q1_Powerfull_hold_fix_both?'PASS':'FAIL'}**. R10-Q2 Bali Gents WEAK texture: **${e.R10_Q2_Bali_texture_both?'PASS':'FAIL'}**. R9-Q1 Balea texture, R9-Q2 NEQI All sleek/shine, and R9-F gotGloss frizz: **${e.R9_Q1_Balea_texture_both&&e.R9_Q2_NEQI_All_both&&e.R9_F_gotGloss_both?'PASS':'FAIL'}**. R8-Q1 Big Hair Day, R8-H Moroccanoil Glättende Creme and Redken Powder Grip: **not in r11; no regression pass inferred**.\n\n`;
  const p=e.R8_Q2;s+=`R8-Q2: **${p.primary_both}/${p.profile_applicable} applicable powder primaries** pass in both, **${p.texture_secondary_both}/${p.texture_secondary_required} explicit texture/grip/structured-look secondaries** pass in both; ${p.suppressed} formula-blocked powder passes suppression only. ${p.other_secondary_unresolved} powders still have a secondary membership dispute. This is a pass for the tested powder-noun rule, not full powder-profile agreement.\n\n`;
  s+='R8-H expected behavior is not mixed (generic krauses-Haar definition is not curl definition), then the border-rule Leave-in route. Its absent-cohort observation remains N/A.\n\n';
  s+='### Full screened ruling reach\n\n| Ruling screen | Products | Primary agree | Secondary agree | a / b / c / d cells |\n|---|---|---|---|---|\n';
  for(const r of d.ruling_reach_summary)s+=`| ${r.ruling} | ${r.records} | ${r.primary_agree}/${r.records} | ${r.secondary_agree}/${r.records} | ${Object.values(r.by_classification).join(' / ')} |\n`;
  s+='\nGroups overlap. These are all reached records, including lexical false positives and suppressed profiles. Screen membership does not assign a job; the named oracle checks and individual adjudications decide the reported effects. Exact candidate lines/types and inclusion reasons are in diff.json.\n\n';
  s+='## Every user-facing disagreement\n\n';
  s+='Categories a/b/c/d classify observed field cells, not proposed amendments: a = clear-rule lane error; b = operational rule-text gap with section and fix; c = packet defect; d = an owner choice with no settled policy. The three gaps below concern how existing policy is expressed, so they are b. Their concrete owner questions and recommendations support clarification and do not imply approval.\n\n';
  for(const x of d.disagreements){
    s+=`### ${x.name} — ${x.field}: ${x.classification}\n\n\`${x.slug}\` · \`${x.id}\`. A=${val(x.A)}; B=${val(x.B)}. ${x.classification==='a'?`**Lane ${x.right_lane} is right; ${x.wrong_lanes.join('/')} is wrong.** Correct value: ${val(x.correct_value)}.`:'**Both readings defensible; no lane declared right.**'}\n\n`;
    s+=`${x.explanation}\n\nRules: ${x.rules.map(label).join('; ')}. ${x.section?`Affected section: ${x.section}. `:''}Frozen C1/C2 evidence: ${x.evidence.map(c=>`“${esc(c.text)}” (${c.tier}, ${c.type})`).join('; ')}.\n\n`;
    if(x.signal_comparison){
      s+='| Exact phrase | Job | A strength | B strength | Trace basis |\n|---|---|---|---|---|\n';
      for(const q of x.signal_comparison)s+=`| ${esc(q.phrase)} | ${q.job} | ${q.lane_A_strength} | ${q.lane_B_strength} | ${esc(q.classification_basis)} |\n`;
      s+='\nNOT_RECORDED means the lane supplied no explicit strength label; output alone is not treated as proof of its classification.\n\n';
    }
    if(x.confirmed_name_signal_comparison)s+=`Confirmed-name analysis: ${val(x.confirmed_name_signal_comparison)}.\n\n`;
    if(x.owner_question)s+=`**Owner question:** ${esc(x.owner_question)}\n\n`;
    if(x.recommendation)s+=`**Recommendation:** ${x.recommendation}\n\n`;
    s+=`**Fix:** ${x.proposed_fix}\n\n`;
  }
  s+='## Hold check\n\n';
  s+=`**${h.authoritative_agree}/${h.records} authoritative hold values agree**; ${h.authoritative_emitted} numeric levels emitted and ${h.null_in_both} null/null. Raw storage: ${h.raw_agree}/${h.records} agree. Independent packet-derived claim/scale/suppression oracle: **${h.oracle_correct_both}/${h.records} correct in both**, ${h.oracle_failures.length} failures. Ungraded hold can leave hold_level null regardless of the secondary signal-strength question.\n\n${h.method}\n\n`;
  s+='| Product | A / B | Packet-derived expected A / B | Captured level |\n|---|---|---|---|\n';
  for(const r of h.individual_records)s+=`| ${esc(r.name)} | ${val(r.A)} / ${val(r.B)} | ${val(r.expected_A)} / ${val(r.expected_B)} | ${val(r.captured_claim_level)}${r.note?' (unmapped; profile blocked)':''} |\n`;
  s+=`\nRules: ${h.rules.map(label).join('; ')}. All cohort hold values are checked from their own C1/C2 claims and profile-emission state; no hold grade is inferred from job signal strength or formula. Full claim traces are retained in diff.json.\n\n`;
  s+='## Latent ambiguities and reported concerns — non-blocking\n\n';
  s+=`${d.latent_ambiguities.length} lane-A hypothetical alternatives concern products with complete user-facing agreement. These are not added to a/b/c/d disagreement counts. They need no owner answer to score this comparison.\n\n`;
  for(const x of d.latent_ambiguities)s+=`- **${esc(x.name)}:** Lane-A note: ${esc(x.issue)} Recommendation: ${x.recommendation}\n`;
  s+='\n';for(const x of d.reported_ambiguities)s+=`- **${esc(x.name)} (lane ${x.lane}):** ${esc(x.report.reason)} ${x.handling}\n`;
  s+='\nLatent alternatives are recorded independently of actual disagreements. Storage order compares selected members as the same unordered set; it is a calculation-log difference only. Exact raw ordered arrays are retained below and in diff.json.\n\n';
  for(const x of d.secondary_storage_order_only)s+=`- **${esc(d.products.find(p=>p.id===x.id).name)}:** A=${val(x.raw_A)}; B=${val(x.raw_B)}. Same selected set; non-blocking.\n`;
  s+='\n';
  s+='## User-facing agreement\n\n| Field | Agree / all | Disagree | Agreement |\n|---|---|---|---|\n';
  for(const f of u.field_agreement)s+=`| ${f.field} | ${f.agree}/${f.records} | ${f.disagree} | ${f.percent}% |\n`;
  s+='\n### Products fully agreeing\n\n';for(const r of d.products.filter(r=>r.fully_agreeing))s+=`- ${r.name} (\`${r.slug}\`).\n`;
  s+='\n## Normalization and calculation log\n\n';for(const n of d.normalisation)s+=`- ${n}\n`;
  s+=`\nCalculation log: ${d.calculation_log_agreement.agreeing_cells}/${d.calculation_log_agreement.cells} cells agree; ${c.calculation_log_disagreement_cells} differences, none blocking. Raw/normalized user fields, all exclusions, log differences and secondary storage-order differences are retained in diff.json. No held profile is masked.\n\n`;
  s+='## Lock predicate\n\n| Criterion | Result |\n|---|---|\n';for(const q of d.lock_criteria)s+=`| ${q.criterion} | ${q.met?'PASS':'FAIL'} |\n`;
  s+=`\n**${d.lock_verdict}: ${d.lock_reason}**\n\n`;for(const l of d.limitations)s+=`- ${l}\n`;
  s+='\n## Pinned governing quotations\n\n';
  for(const r of [r10q1,r10q2,strengthRule,selectionRule,r4q7,nameRule,r9q1,r9q2,r9f,r9p,r8q1,r8q2,r8h,typedHoldRule,jobRule,jobExample,...lockRules])s+=`${label(r)}\n\n> ${r.quote}\n\n`;
  s+='## Reproduction\n\nRun `node data/research/styling-inci/v1.0/round-11/diff.js --summary` twice with unchanged inputs; the default rule revision is the full pinned SHA, not HEAD. Compare SHA-256 of diff.json and report.md. Later replay: add `--rules-revision='+d.rule_revision+'`. Only the sibling diff.json/report.md are written; no timestamps/randomness/absolute paths. Script/input hashes and every quoted source revision are recorded.\n\n';
  s+=`diff.json SHA-256: \`${sha}\`.\n`;return s;
}
const json=JSON.stringify(output,null,2)+'\n';
const sha=crypto.createHash('sha256').update(json).digest('hex');
fs.writeFileSync(path.join(__dirname,'diff.json'),json);
fs.writeFileSync(path.join(__dirname,'report.md'),render(output,sha));
if(process.argv.includes('--summary'))console.log(JSON.stringify({agreement:{agreeing_cells:userAgreement.agreeing_cells,cells:userAgreement.cells,percent:userAgreement.percent_cells,products_fully_agreeing:userAgreement.products_fully_agreeing,records:rows.length},counts:output.counts,ruling_effects:effectSummary,hold:{agree:hold.authoritative_agree,oracle_correct_both:hold.oracle_correct_both,oracle_failures:hold.oracle_failures.map(r=>({slug:r.slug,expected:r.expected_A,A:r.A,B:r.B}))},rule_revision:RULE_REVISION,lock_verdict:verdict,sha256:sha},null,2));
if(process.argv.includes('--dump'))for(const d of disagreements)console.log(JSON.stringify(d));
