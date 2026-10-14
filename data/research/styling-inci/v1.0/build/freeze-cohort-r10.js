#!/usr/bin/env node
// Final targeted R9 owner-ruling re-check.  Historical cohorts are read-only.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const V1 = path.resolve(__dirname, '..'), ROOT = path.resolve(V1, '../../../..'), OUT = path.join(V1, 'r10');
const R6OUT = path.join(V1, 'r6'), R6SCRIPT = path.join(__dirname, 'freeze-cohort-r6.js');
const STAMP = 'styling-inci-v0.5-r9amend', LEXICON = 'styling-lexicon-v0.5-r7amend';
const VERSION = 'styling-inci-v1.0-cohort-10', SALT = 'styling-inci-v1.0-cohort-10/r9-owner-amendment/opaque-id/';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const ser = x => JSON.stringify(x, null, 2) + '\n'; const clone = x => JSON.parse(JSON.stringify(x));
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;

// Rebuild r6 in memory: r10 never writes r1-r9 and refuses a changed historical input.
const mem = new Map();
const sandboxFs = Object.assign({}, fs, { readFileSync(p, enc) { const k=path.resolve(String(p)); return mem.has(k) ? (enc ? mem.get(k).toString(enc) : mem.get(k)) : fs.readFileSync(p, enc); }, writeFileSync(p,d) { mem.set(path.resolve(String(p)), Buffer.from(d)); }, mkdirSync(){}, rmSync(){} });
const ctx = vm.createContext({ require: m => m === 'fs' ? sandboxFs : require(m), __dirname:path.dirname(R6SCRIPT), __filename:R6SCRIPT, Buffer, console:{log(){}} });
vm.runInContext(fs.readFileSync(R6SCRIPT, 'utf8'), ctx, {filename:R6SCRIPT});
const R6 = x => vm.runInContext(x, ctx); let rebuilt = 0;
for (const [p,b] of mem) if (p.startsWith(R6OUT + path.sep)) { if (!fs.readFileSync(p).equals(b)) throw Error('r6 rebuild changed frozen bytes: '+p); rebuilt++; }
if (rebuilt !== 432) throw Error('incomplete r6 rebuild: '+rebuilt);
const source = JSON.parse(fs.readFileSync(path.join(R6OUT, 'cohort.json'))), all = source.records.slice().sort((a,b)=>cmp(a.source_slug,b.source_slug));
const bySlug = Object.fromEntries(all.map(r=>[r.source_slug,r])), isC12 = R6('isC12'), maskS0 = R6('maskS0');
// Scope is a conservative reach screen, never a classification. Read every
// C1/C2 claim line; primary-adjective reach uses the first eligible promise.
// The reach screen intentionally retains semantic false positives. It assigns no jobs.
// Unicode letter tails cover German inflections, including umlauts/ß.
const JOB_PATTERNS = {
  volume: /(?:volum[\p{L}]*|fülle|schwung|sprungkraft|spannkraft|haarschwung|lift|voller[\p{L}]*\s+haar)/iu,
  texture: /(?:textur[\p{L}]*|texture|grif[\p{L}]*|grip|struktur[\p{L}]*|beach[\s-]*(?:waves?|look)|strandwellen)/iu,
  sleek: /(?:glatt[\p{L}]*|glätt[\p{L}]*|sleek|smooth[\p{L}]*|straight[\p{L}]*)/iu,
  hold_fix: /(?:halt|fixier[\p{L}]*|hold|mold[\p{L}]*|shap[\p{L}]*|formgeb[\p{L}]*|festig[\p{L}]*)/iu,
  shine: /(?:glanz|glänz[\p{L}]*|shine|shiny|gloss[\p{L}]*|glaze|topcoat|brillan[\p{L}]*|wet[\s-]*look|schimmer[\p{L}]*)/iu,
  frizz_control: /(?:frizz|absteh[\p{L}]*|babyhaare|flyaway[\p{L}]*|bändig[\p{L}]*)/iu,
  definition: /(?:definition|defin[\p{L}]*|locken\s+form[\p{L}]*|(?:shape|define)[\p{L}]*\s+(?:curls?|waves?))/iu,
  refresh: /(?:auffrisch[\p{L}]*|erfrisch[\p{L}]*|frisch[\p{L}]*|refresh[\p{L}]*|revitali[\p{L}]*|reaktivier[\p{L}]*|reviv[\p{L}]*)/iu
};
// Conservative lexical result-adjective screen across the complete first eligible
// promise line. No name/subtype classification shortcut is used. Feel/grade and
// non-adjacent adjective candidates remain for the lanes to resolve semantically.
const RESULT_ADJECTIVE = /(?<![\p{L}])(?:maximal[\p{L}]*|ideal[\p{L}]*|handhabbar[\p{L}]*|leicht[\p{L}]*|schwerelos[\p{L}]*|körperbildend[\p{L}]*|glamourös[\p{L}]*|mühelos[\p{L}]*|schnell[\p{L}]*|einfach[\p{L}]*|sanft[\p{L}]*|mittler[\p{L}]*|intensiv[\p{L}]*|strong|flake[\s-]*free|schuppenfrei[\p{L}]*|nicht[\s-]+kleben[\p{L}]*|kaschmirartig[\p{L}]*|trocken[\p{L}]*|strapaziert[\p{L}]*|himmlisch[\p{L}]*|präzis[\p{L}]*|fein[\p{L}]*|glänz[\p{L}]*|spiegelglänz[\p{L}]*|glatt[\p{L}]*|spiegelglatt[\p{L}]*|sleek[\p{L}]*|smooth[\p{L}]*|straight[\p{L}]*|shiny|glossy|matt[\p{L}]*|halbmatt[\p{L}]*|seidenmatt[\p{L}]*|schimmer[\p{L}]*|strahl[\p{L}]*|brillant[\p{L}]*|glasig[\p{L}]*|defin[\p{L}]*|geformt[\p{L}]*|strukturiert[\p{L}]*|texturiert[\p{L}]*|griffig[\p{L}]*|voluminös[\p{L}]*|voller[\p{L}]*|füllig[\p{L}]*|schwungvoll[\p{L}]*|sprungkräftig[\p{L}]*|lockig[\p{L}]*|wellig[\p{L}]*|beweglich[\p{L}]*|flexibl[\p{L}]*|elastisch[\p{L}]*|formbar[\p{L}]*|natürlich[\p{L}]*|natural|fest[\p{L}]*|stark[\p{L}]*|kraftvoll[\p{L}]*|zuverlässig[\p{L}]*|langanhalt[\p{L}]*|lang[\s-]+anhalt[\p{L}]*|long[\s-]+lasting|geschmeidig[\p{L}]*|weich[\p{L}]*|seidig[\p{L}]*|revitalisiert[\p{L}]*|gesund[\p{L}]*|gepflegt[\p{L}]*|makellos[\p{L}]*|lebendig[\p{L}]*|unbeschwert[\p{L}]*|frizz[\s-]*frei[\p{L}]*)(?![\p{L}])/giu;
const required = new Set(['neqi-diamond-glass-styling-spray-all', 'got2b-gotgloss-glanz-spray']);
const correction = {type:'promise', raw:'Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle.', tier:'C2',
  source:'https://www.got2b.de/haarstyling/produkt/settings/got-gloss-glanz-spray.html',date:'2026-10-14',
  position:'unknown',tier_basis:'R9-F owner-verified German manufacturer-page capture'};
const audit = all.map(r => {
  const claimLines = r.claims.map((c,index)=>({field:'claims',index,type:c.type,tier:c.tier,position:c.position||null,text:c.raw||''})).filter(c=>isC12(c.tier));
  const secondaryMatches = claimLines.filter(c=>['finish','other'].includes(c.type)).map(c=>({...c,matched_jobs:Object.keys(JOB_PATTERNS).filter(job=>JOB_PATTERNS[job].test(c.text))})).filter(c=>c.matched_jobs.length);
  const promises = claimLines.filter(c=>c.type==='promise').sort((a,b)=>
    ((a.tier.startsWith('C1')&&a.position==='pack_front'?0:a.tier.startsWith('C1')?1:2)-
     (b.tier.startsWith('C1')&&b.position==='pack_front'?0:b.tier.startsWith('C1')?1:2)) || a.index-b.index);
  const lead = promises[0] || null;
  const adjectives = lead ? [...lead.text.matchAll(RESULT_ADJECTIVE)].map(m=>({text:m[0],offset:m.index})) : [];
  const reasons=[]; const add=(klass,evidence)=>reasons.push({class:klass,evidence});
  if(secondaryMatches.length) add('R9-Q1-any-C12-secondary', 'At least one C1/C2 finish/other line contains a §6.10 job-vocabulary stem. Include all products, even pure-feel/formula/collection or already-promised false positives; lanes apply result semantics, feel-only exclusion and the existing mechanism gate.');
  if(adjectives.length>=2) add('R9-Q2-multiple-result-adjectives', 'The first eligible C1/C2 promise line contains at least two conservative result-adjective candidates. Matching named look/subtype leads where adjectives stand together; otherwise first. Grade/feel or non-adjacent candidates remain for blind semantic review.');
  if(r.source_slug==='neqi-diamond-glass-styling-spray-all') add('R9-Q2-NEQI-All', 'Owner-ruled example: named Glass Hair smoothing look makes sleek primary, shine secondary; always retained.');
  if(r.source_slug==='got2b-gotgloss-glanz-spray') add('R9-F-gotGloss-packet-correction', 'Add missing C2 promise verified 2026-10-14: '+correction.raw);
  return {source_slug:r.source_slug,name:r.identity.brand+' '+r.identity.product_name,included:reasons.length>0,reasons,
    screen:{c1_c2_claim_lines:claimLines,finish_other_job_matches:secondaryMatches,ordered_promise_lines:promises,lead_line:lead,result_adjective_matches:adjectives},
    capture_amendment:r.source_slug==='got2b-gotgloss-glanz-spray'?correction:null,
    excluded_reason:reasons.length?null:'No C1/C2 finish/other job stem, fewer than two result-adjective candidates in the lead promise, and not a named R9-Q2/R9-F record.'};
});
const selected = audit.filter(x=>x.included);
for (const s of required) if (!selected.some(x=>x.source_slug===s)) throw Error('mandatory record missed: '+s);
// No opaque id may overlap any historical cohort, including r9.
const priorIds=new Set(), priorInputs=[]; for (let n=1;n<=9;n++) { const rel='data/research/styling-inci/v1.0/'+(n===1?'':'r'+n+'/')+'cohort.json'; const old=JSON.parse(fs.readFileSync(path.join(ROOT,rel))); old.records.forEach(r=>priorIds.add(r.sample_id)); priorInputs.push(rel); }
const ids=new Set(), records=selected.map(a=>{const r=clone(bySlug[a.source_slug]), old=r.sample_id; r.sample_id='sty-'+sha(SALT+r.source_slug).slice(0,10); if(priorIds.has(r.sample_id)||ids.has(r.sample_id)) throw Error('opaque id collision'); ids.add(r.sample_id); r.standard_version=STAMP;r.lexicon_version=LEXICON;if(r.source_slug==='got2b-gotgloss-glanz-spray')r.claims.push(clone(correction));r.history.round10={round6_sample_id:old,reason_classes:a.reasons.map(x=>x.class)};return r;}).sort((a,b)=>cmp(a.sample_id,b.sample_id));
// Reuse r7's directions-only F/U grading mask, shielding inherited [CLAIM] tokens.
// S0 is already r6-masked; only the new strongly strength stem is added there.
// Never run the general grading mask on INCI (PEG/PPG ratios are ingredient identities).
const STRONGLY_MASK = /\bstrongly\b/gi, STRONGLY_LEAK = /\bstrongly\b/i;
const INHERITED_MASK = '\uE000';
const maskFuGrades = text => {
  if (text.includes(INHERITED_MASK)) throw Error('F/U mask sentinel collision');
  const masked = maskS0(text.replace(/\[CLAIM\]/g, INHERITED_MASK), false);
  return {text:masked.text.replaceAll(INHERITED_MASK, '[CLAIM]'),count:masked.count};
};
const packets={s0:[],fu:[],claims:[]}, strongMasks=[], fuGradeMasks=[];
for(const r of records) for(const kind of Object.keys(packets)) {
  const old=r.history.round10.round6_sample_id;
  const frozen=JSON.parse(fs.readFileSync(path.join(R6OUT,'packets',kind,old+'.json'))),body=clone(frozen);
  body.sample_id=r.sample_id;body.packet_version=STAMP;
  if(kind==='claims'&&r.source_slug==='got2b-gotgloss-glanz-spray')body.claims.push({type:correction.type,text:correction.raw,tier:correction.tier,source_class:'manufacturer_page',source_host:'got2b.de',date:correction.date,position:correction.position});
  if(kind==='fu' && typeof body.directions?.text==='string') {
    const before=body.directions.text, masked=maskFuGrades(before);body.directions.text=masked.text;
    if(before!==masked.text)fuGradeMasks.push({source_slug:r.source_slug,field:'.directions.text',replacements:masked.count,before,after:masked.text});
  }
  if(kind!=='claims') {
    const walk=(o,at='')=> {
      if(Array.isArray(o))o.forEach((v,i)=>walk(v,at+'['+i+']'));
      else if(o&&typeof o==='object')Object.keys(o).forEach(k=> {
        if(k==='inci')return;
        if(typeof o[k]==='string') {
          const count=(o[k].match(STRONGLY_MASK)||[]).length;
          if(count)strongMasks.push({source_slug:r.source_slug,kind,field:at+'.'+k,replacements:count});
          o[k]=o[k].replace(STRONGLY_MASK,'[CLAIM]');
        } else walk(o[k],at+'.'+k);
      });
    };walk(body);
    if(JSON.stringify(body.inci)!==JSON.stringify(frozen.inci))throw Error('INCI mutation: '+r.source_slug);
  }
  packets[kind].push({id:r.sample_id,body});
}
const forbidden=R6('FORBIDDEN_KEYS'), editorial=R6('EDITORIAL_RE'), labels=R6('ANY_LEAK_RE'), patterns=R6('Object.assign({}, S0_LEAK, S0_LEAK_R6)'); const hits=[], scanned={s0:0,fu:0,claims:0};
const walk=(o,kind,tag,at='',key='')=>{if(Array.isArray(o))o.forEach((v,i)=>walk(v,kind,tag,at+'['+i+']',key));else if(o&&typeof o==='object')Object.entries(o).forEach(([k,v])=>{if(forbidden.includes(k))hits.push({check:'forbidden_key',tag,at:at+'.'+k});walk(v,kind,tag,at+'.'+k,k);});else if(typeof o==='string'){scanned[kind]++; const capturedFreeze=kind==='claims'&&key==='text'&&/^Freeze$/i.test(o); if(/https?:\/\/|www\./i.test(o)||labels.test(o)||(!capturedFreeze&&!['sample_id','packet_version','packet'].includes(key)&&editorial.test(o)))hits.push({check:'metadata_leak',tag,at}); if(kind!=='claims'){const bare=o.replace(/\[CLAIM\]/g,' ');for(const [n,re]of Object.entries(patterns)){if(n==='label'||(n==='flexibility_word'&&at==='.product.brand'&&o.toLowerCase()==='wellaflex'))continue;if(re.test(bare))hits.push({check:n,tag,at});}if(STRONGLY_LEAK.test(bare))hits.push({check:'strongly',tag,at});for(const r of all)if(o.toLowerCase().includes(r.source_slug))hits.push({check:'source_slug',tag,at});for(const old of priorIds)if(o.includes(old))hits.push({check:'prior_id',tag,at});if(/\b(?:leave_in|heat_protectant|dry_shampoo|provisional_boundary|salt_spray|texture_spray|shine_finish|smoothing_styler|curl_cream|negative_control)\b/i.test(o))hits.push({check:'route_or_subtype',tag,at});}}};
for(const [kind,ps] of Object.entries(packets))for(const p of ps)walk(p.body,kind,p.id);
const classes={};selected.forEach(a=>a.reasons.forEach(x=>classes[x.class]=(classes[x.class]||0)+1));
const inputs=[...priorInputs,'data/research/styling-inci/v1.0/build/freeze-cohort-r6.js','data/research/styling-inci/v1.0/build/freeze-cohort-r9.js','plans/styling-concept/02-rulings.md',...['styling-classification-standard.md','01_property-set-v0.md','00_category_charter.md','02_evidence_lexicon.v0.5.md'].map(f=>'docs/research/styling-inci/v1.0/'+f)].sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));
fs.mkdirSync(OUT,{recursive:true});const writes=[],write=(rel,obj)=>{fs.mkdirSync(path.dirname(path.join(OUT,rel)),{recursive:true});fs.writeFileSync(path.join(OUT,rel),typeof obj==='string'?obj:ser(obj));writes.push(rel);};
for(const kind of Object.keys(packets)){const d=path.join(OUT,'packets',kind);fs.mkdirSync(d,{recursive:true});for(const f of fs.readdirSync(d))if(/^sty-[0-9a-f]{10}\.json$/.test(f))fs.unlinkSync(path.join(d,f));}
const verification={r6_rebuild_byte_identical_files:rebuilt,prior_id_overlap:0,strongly_mask_replacements:strongMasks,fu_grading_masks:fuGradeMasks,string_fields_scanned:scanned,leak_hits:hits.length,leak_findings:hits,ready_for_blind_lanes:hits.length===0};
const cohort={cohort_version:VERSION,frozen_on:'2026-10-14',standard_version:STAMP,lexicon_version:LEXICON,purpose:'REFERENCE ONLY. Final targeted R9 re-check; never supply cohort/id_map/scope-audit/FREEZE-NOTES to blind lanes.',counts:{total:records.length,screened:all.length,by_reason_class:classes},verification,inputs,id_map:records.map(r=>({...source.id_map.find(x=>x.source_slug===r.source_slug),sample_id:r.sample_id,round6_sample_id:r.history.round10.round6_sample_id})),records};
write('cohort.json',cohort);
write('scope-audit.json',{screened_records:all.length,selected_records:records.length,
  governing_rulings:['R9-Q1','R9-Q2','R9-F','R9-P','LOCK-1-S'],
  screen_patterns:{jobs:Object.fromEntries(Object.entries(JOB_PATTERNS).map(([k,re])=>[k,{source:re.source,flags:re.flags}])),result_adjective:{source:RESULT_ADJECTIVE.source,flags:RESULT_ADJECTIVE.flags}},
  screen_policy:{r9_q1:'Read every C1/C2 finish- and other-typed claim line on every r6 product. Record exact field/index/type/tier/text and matched job stems. Include conservative false positives; pure feel-only lines never assign a secondary job. Promise/hold jobs already eligible under earlier rulings do not independently expand the target set.',
    r9_q2:'First eligible promise line ordered C1 pack_front, other C1 packet order, then C2 packet order. Include every line with >=2 conservative result-adjective matches, including feel/grade and non-adjacent false positives. Explicitly retain NEQI All. This lexical reach screen is not a classification and does not infer subtype or select a primary.',
    r9_f:'Append owner-verified C2 promise only in r10. Full URL and date retained in cohort, scope audit and notes; blind claims packet uses manufacturer_page/source_host/date, as inherited URL masking requires.'},records:audit});
for(const [kind,ps]of Object.entries(packets))ps.forEach(p=>write('packets/'+kind+'/'+p.id+'.json',p.body));
const esc=s=>String(s).replace(/\|/g,'/').replace(/\n/g,' ');
const notes='# FREEZE-NOTES — final targeted Styling r10 re-check\n\nFrozen 2026-10-14. Packet stamp: `'+STAMP+'`; lexicon `'+LEXICON+'` (formula membership unchanged). Styling v1.0 lock suspended (LOCK-1-S) — final targeted re-check r10 pending. Governing ledger: R9-Q1, R9-Q2, R9-F, R9-P and all earlier rulings.\n\n## Screen and scope\n\nAll **'+all.length+'** r6 records were screened. **'+records.length+'** selected. `scope-audit.json` retains every C1/C2 line, exact field/index/type/tier/text, finish/other job matches, ordered promises, lead line, result-adjective matches with offsets, and every inclusion/exclusion reason.\n\n- R9-Q1: every C1/C2 finish/other line with any §6.10 job word, including German stems Volumen/Fülle/Schwung, Textur/Griff/Grip, glatt/Sleek, Halt/fixier, Glanz/glänz/Shine, Frizz/abstehend/Babyhaare, Definition/definiert/Locken formen, auffrisch/Refresh. Conservative semantic false positives remain; pure feel-only lines never assign jobs, and the existing mechanism gate remains.\n- R9-Q2: at least two conservative result-adjective candidates in the first eligible promise line (C1 pack front, other C1, C2; packet order within priority). Grade/feel and non-adjacent candidates deliberately remain for lane review; no subtype/primary inference narrows the screen. NEQI Diamond Glass All is retained explicitly. Matching named look/subtype leads when several result adjectives stand together, else first; sleek = smooth/straight overall look, shine = gloss.\n- R9-F: got2b gotGloss Glanz Spray is retained explicitly; append C2 promise “'+correction.raw+'” from '+correction.source+' (owner verified '+correction.date+'). Full URL retained in reference cohort/audit; blind claim provenance uses source_class, source_host and date to preserve the URL leak boundary.\n\n| Product | Reason class(es) | Inclusion reason |\n|---|---|---|\n'+selected.map(a=>'| '+esc(a.name)+' | '+a.reasons.map(x=>x.class).join(', ')+' | '+a.reasons.map(x=>esc(x.evidence)).join(' / ')+' |').join('\n')+'\n\n## Freeze and verification\n\nThe unmodified r6 builder rebuilt **'+rebuilt+'** historical artifacts byte-identically in memory. r10 emits **'+records.length+'** each of S0, F/U and claims packets from r6 with fresh opaque salt `'+SALT+'`; id overlap with r1–r9 is zero. Reuses freeze-cohort-r9.js logic: inherited S0 mask, directions-only F/U grading mask shielding inherited [CLAIM] tokens, strongly strength mask, all-field metadata/grading/route/old-id/source-slug leak checks. INCI stays byte-identical and never enters general grading masking. Every S0/FU string field scanned: S0 **'+scanned.s0+'**, F/U **'+scanned.fu+'**; claims **'+scanned.claims+'** also metadata-checked. All-field leaks: **'+hits.length+'**. Two independent runs and every artifact/manifest hash are compared in `determinism-check.json` (receipt excluded from generated manifest).\n\nReference only: never supply cohort/id-map/audit/notes/manifest/receipt to blind lanes. Supply only the appropriate packets. No classification, lock reinstatement or production write.\n';
write('FREEZE-NOTES.md',notes);
const manifest={manifest_version:VERSION,frozen_on:'2026-10-14',algorithm:'sha256',script:{path:'data/research/styling-inci/v1.0/build/freeze-cohort-r10.js',sha256:sha(fs.readFileSync(__filename))},inputs,counts:{cohort_records:records.length,packets_s0:records.length,packets_fu:records.length,packets_claims:records.length},verification,artifacts:writes.sort(cmp).map(rel=>({path:'r10/'+rel,sha256:sha(fs.readFileSync(path.join(OUT,rel)))}))};fs.writeFileSync(path.join(OUT,'artifact-manifest.json'),ser(manifest));console.log(JSON.stringify({selected:records.length,by_reason_class:classes,verification,manifest_sha256:sha(fs.readFileSync(path.join(OUT,'artifact-manifest.json')))},null,2));if(hits.length)throw Error('NOT READY: '+JSON.stringify(hits));
