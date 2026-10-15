#!/usr/bin/env node
// Targeted R10 signal-strength re-check.  Historical cohorts are read-only.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const V1 = path.resolve(__dirname, '..'), ROOT = path.resolve(V1, '../../../..'), OUT = path.join(V1, 'r11');
const R6OUT = path.join(V1, 'r6'), R6SCRIPT = path.join(__dirname, 'freeze-cohort-r6.js');
const STAMP = 'styling-inci-v0.5-r10amend', LEXICON = 'styling-lexicon-v0.5-r7amend';
const VERSION = 'styling-inci-v1.0-cohort-11', SALT = 'styling-inci-v1.0-cohort-11/r10-signal-strength/opaque-id/';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const ser = x => JSON.stringify(x, null, 2) + '\n'; const clone = x => JSON.parse(JSON.stringify(x));
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;

// Rebuild r6 in memory: r11 never writes r1-r10 and refuses a changed historical input.
const mem = new Map();
const sandboxFs = Object.assign({}, fs, { readFileSync(p, enc) { const k=path.resolve(String(p)); return mem.has(k) ? (enc ? mem.get(k).toString(enc) : mem.get(k)) : fs.readFileSync(p, enc); }, writeFileSync(p,d) { mem.set(path.resolve(String(p)), Buffer.from(d)); }, mkdirSync(){}, rmSync(){} });
const ctx = vm.createContext({ require: m => m === 'fs' ? sandboxFs : require(m), __dirname:path.dirname(R6SCRIPT), __filename:R6SCRIPT, Buffer, console:{log(){}} });
vm.runInContext(fs.readFileSync(R6SCRIPT, 'utf8'), ctx, {filename:R6SCRIPT});
const R6 = x => vm.runInContext(x, ctx); let rebuilt = 0;
for (const [p,b] of mem) if (p.startsWith(R6OUT + path.sep)) { if (!fs.readFileSync(p).equals(b)) throw Error('r6 rebuild changed frozen bytes: '+p); rebuilt++; }
if (rebuilt !== 432) throw Error('incomplete r6 rebuild: '+rebuilt);
const source = JSON.parse(fs.readFileSync(path.join(R6OUT, 'cohort.json'))), all = source.records.slice().sort((a,b)=>cmp(a.source_slug,b.source_slug));
const bySlug = Object.fromEntries(all.map(r=>[r.source_slug,r])), isC12 = R6('isC12'), maskS0 = R6('maskS0');
// Reach screening only: no new route, primary, formula gate or secondary assignment.
// Prior lane results are reference-only scope inputs, never copied into packets.
const routeInputs = [], reference = new Map();
const routeOf = r => typeof r.route === 'object' ? r.route : {destination:r.route,state:r.provisional?'held':'committed',boundary_reason:r.boundary_reason||null};
for (const lane of ['A','B']) {
  const rel=`data/research/styling-inci/v1.0/blind-lane-${lane}-r6/results.json`;
  routeInputs.push(rel);
  for(const r of JSON.parse(fs.readFileSync(path.join(ROOT,rel))).records) {
    const slug=source.records.find(x=>x.sample_id===r.id)?.source_slug;
    if(!slug)throw Error('unmapped r6 lane id: '+r.id);
    const ref=reference.get(slug)||{round:6,lanes:{}};
    ref.lanes[lane]={route:routeOf(r),primary_job:r.primary_job};reference.set(slug,ref);
  }
}
for(let n=7;n<=10;n++) {
  const rel=`data/research/styling-inci/v1.0/round-${n}/diff.json`;routeInputs.push(rel);
  for(const r of JSON.parse(fs.readFileSync(path.join(ROOT,rel))).products)
    reference.set(r.slug,{round:n,lanes:{A:{route:r.A.route,primary_job:r.A.primary_job},B:{route:r.B.route,primary_job:r.B.primary_job}}});
}
// German inflections + English captured words; boundaries prevent e.g. 'Nachhaltig'
// becoming hold. Raw matches and semantic exclusions remain visible in the audit.
const JOB_PATTERNS = {
 volume: /(?<![\p{L}])(?:volum[\p{L}]*|fülle|schwung[\p{L}]*|sprungkraft|spannkraft|haarschwung|lift[\p{L}]*|voller[\p{L}]*\s+(?:haar|look))(?![\p{L}])/giu,
 texture: /(?<![\p{L}])(?:textur[\p{L}]*|texture|grif[\p{L}]*|grip|struktur[\p{L}]*|beach[\s-]*(?:waves?|look|hair)|strandwellen|strandähnlich[\p{L}]*)(?![\p{L}])/giu,
 sleek: /(?<![\p{L}])(?:glatt[\p{L}]*|glätt[\p{L}]*|spiegelglatt[\p{L}]*|sleek|smooth[\p{L}]*|straight[\p{L}]*)(?![\p{L}])/giu,
 hold_fix: /(?<![\p{L}])(?:halt[\p{L}]*|hold[\p{L}]*|fixier[\p{L}]*|mold[\p{L}]*|shap[\p{L}]*|formgeb[\p{L}]*|festig[\p{L}]*|kontrolle|control)(?![\p{L}])/giu,
 shine: /(?<![\p{L}])(?:glanz[\p{L}]*|glänz[\p{L}]*|spiegelglänz[\p{L}]*|shine|shiny|gloss[\p{L}]*|glaze|topcoat|brillan[\p{L}]*|wet[\s-]*look|schimmer[\p{L}]*)(?![\p{L}])/giu,
 frizz_control: /(?<![\p{L}])(?:frizz|anti[\s-]*frizz[\p{L}]*|absteh[\p{L}]*|babyhaare|flyaway[\p{L}]*|bändig[\p{L}]*)(?![\p{L}])/giu,
 definition: /(?<![\p{L}])(?:definition|defin[\p{L}]*|locken\s+form[\p{L}]*|(?:shape|define)[\p{L}]*\s+(?:curls?|waves?))(?![\p{L}])/giu,
 refresh: /(?<![\p{L}])(?:auffrisch[\p{L}]*|erfrisch[\p{L}]*|refresh[\p{L}]*|revitali[\p{L}]*|reaktivier[\p{L}]*|reviv[\p{L}]*)(?![\p{L}])/giu
};
const COLLECTIONS = /(?:Frizz Ease|Traum\s*locken|Volume Lift|Diamond Sleek|Glow\s*&\s*Shine|Nutricurls|Curl Manifesto)/gi;
const correction = {type:'promise', raw:'Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle.', tier:'C2',
 source:'https://www.got2b.de/haarstyling/produkt/settings/got-gloss-glanz-spray.html',date:'2026-10-14',
 position:'unknown',tier_basis:'R9-F owner-verified German manufacturer-page capture'};
const required=new Set(['schwarzkopf-taft-styling-balm-locken-halt-3','bali-gents-haarpuder-volumizing-styling-powder','got2b-styling-puder-volumen-powderfull','moroccanoil-volumizing-spray']);
const audit = all.map(r=> {
 const ref=reference.get(r.source_slug);if(!ref)throw Error('missing prior route: '+r.source_slug);
 const eligible=Object.values(ref.lanes).some(x=>x.route.destination==='styling'||x.route.boundary_reason==='pending_leave_in_addendum');
 const primarySet=[...new Set(Object.values(ref.lanes).map(x=>x.primary_job))];
 const primary=primarySet.length===1?primarySet[0]:null;
 const frozenClaims=JSON.parse(fs.readFileSync(path.join(R6OUT,'packets','claims',r.sample_id+'.json')));
 const name={field:'identity.product_name',index:-1,type:'confirmed_name',tier:frozenClaims.confirmed_name_tier,text:r.identity.product_name};
 const claims=clone(r.claims);if(r.source_slug==='got2b-gotgloss-glanz-spray')claims.push(clone(correction));
 const claimLines=claims.map((c,index)=>({field:'claims',index,type:c.type,tier:c.tier,position:c.position||null,text:c.raw||''})).filter(c=>isC12(c.tier));
 const lines=[name,...claimLines], matches=[],exclusions=[];
 if(isC12(name.tier)) {
   const own=name.text.replace(COLLECTIONS,m=>' '.repeat(m.length));
   const job=/(?:puder|powder)/iu.test(own)?'volume':/(?:wachs|wax|paste|clay|gel|pomade|fiber|haarspray|hair\s*spray|schaumfestiger)/iu.test(own)?'hold_fix':null;
   if(job)matches.push({...name,job,match:own,strength:'STRONG',basis:'Product-type noun under §4.2/R8-Q2; scope only'});
 }
 for(const line of lines) {
   if(!isC12(line.tier))continue;
   const text=line.type==='confirmed_name'?line.text.replace(COLLECTIONS,m=>' '.repeat(m.length)):line.text;
   for(const [job,re]of Object.entries(JOB_PATTERNS))for(const m of text.matchAll(re)) {
     const start=Math.max(text.lastIndexOf('.',m.index-1),text.lastIndexOf(';',m.index-1))+1;
     const stop=[text.indexOf('.',m.index),text.indexOf(';',m.index)].filter(x=>x>=0);
     const clause=text.slice(start,stop.length?Math.min(...stop):text.length);
     const near=text.slice(Math.max(start,m.index-35),m.index+m[0].length+25);
     let exclude=null;
     if(line.type==='hair_type'&&!/(?:look|finish|verleiht|definiert|auffrisch|bändig)/iu.test(clause))exclude='Existing hair/audience description, not a promised Styling result; type alone never excludes a job promise.';
     if(job==='texture'&&/(?:mousse|creme|gel[ée]*|puder|formel|ultra[ -]?leicht|geleeartig[\p{L}]*|leicht[\p{L}]*[, -]+(?:geleeartig[\p{L}]*|aktivierbar[\p{L}]*)|leichte)\s*[- ]*textur|haarstruktur|lockenstruktur/iu.test(near))exclude='Formula/consistency or existing hair structure, not a promised Styling texture result.';
     if(/haargefühl|gefühl|feel|duft/iu.test(clause)&&!/(?:finish|look|frisur|styles?|ergebnis|griffig|volumen|sprungkraft|spannkraft)/iu.test(clause))exclude='Pure feel/scent line without a Styling result (R9-Q1).';
     if(job==='definition'&&!/(?:locken|wellen|curls?|waves?)/iu.test(clause))exclude='Non-curl definition is not definition (R7-Q2).';
     if(job==='hold_fix'&&/(?:halt|hold)/iu.test(m[0])&&/(?:kein[\p{L}]*\s+(?:halt|hold)|ohne\s+(?:halt|hold))/iu.test(near))exclude='Negated hold never supplies a positive hold_fix signal.';
     if(job==='hold_fix'&&m[0].toLowerCase()==='kontrolle'&&/frizz[- ]*$/iu.test(text.slice(start,m.index)))exclude='Frizz-Kontrolle is frizz_control, not a separate hold job.';
     if(job==='shine'&&/(?:nicht|kein[\p{L}]*|ohne)\s*$/iu.test(text.slice(start,m.index)))exclude='Negated shine never supplies a positive shine signal.';
     if(job==='sleek'&&/^(?:glätteisen|glättbürste)$/iu.test(m[0]))exclude='Application tool, not a promised sleek result.';
     if(job==='volume'&&/^schwungvoll/iu.test(m[0])&&/^\s*,?\s*(?:definierte|locken|wellen)/iu.test(text.slice(m.index+m[0].length)))exclude='R7-Q1: adjective before the definition job supplies no separate volume.';
     // curl/wave words in the product's own name supply definition (R7-Q2).
     if(exclude){exclusions.push({...line,job,match:m[0],offset:m.index,reason:exclude});continue;}
     const prefix=text.slice(start,m.index),suffix=text.slice(m.index+m[0].length);
     // A duration such as 'Halt für bis zu 24 Stunden' is not a brand number.
     const number=job==='hold_fix'&&/^(?:halt(?:egrad|estufe)?|hold(?:[ -]?faktor)?|hold-faktor)\s*[:=]?\s*\d/iu.test(text.slice(m.index));
     const holdAttached=/(?:stark[\p{L}]*|strong|leicht[\p{L}]*|sanft[\p{L}]*|soft|weich[\p{L}]*|mittel[\p{L}]*|normal(?:er|en|em|e)?|extra|ultra|mega|maximal[\p{L}]*|max|power)(?:[, &-]+(?:langanhaltend[\p{L}]*|flexibl[\p{L}]*|aber|und|variabl[\p{L}]*|zuverlässig[\p{L}]*))*\s*$/iu.test(prefix);
     const attachedEmphasis=/(?:stark[\p{L}]*|intensiv[\p{L}]*|optimal[\p{L}]*|unglaublich[\p{L}]*|strahlend[\p{L}]*|maximal[\p{L}]*|sofortig[\p{L}]*|mehr|perfekt[\p{L}]*)(?:[, &-]+(?:und|ein[\p{L}]*))*\s*$/iu.test(prefix);
     const look=/^\s+(?:look[\p{L}]*|styles?|finish|ergebnis)/iu.test(suffix)||/(?:looks?\s+von|looks?.*(?:glatt|glänzend))/iu.test(clause);
     const explicit=job==='hold_fix' ? /^(?:fixier|festig|formgeb|mold|shap)/iu.test(m[0]) : /(?<![\p{L}])(?:verleiht|verleihen|bietet|sorgt|gibt|reduziert|wirkt.*entgegen|bändigt|bekämpft|erhalte|erhält|schafft|kreier[\p{L}]*|definiert|definierende|auffrisch[\p{L}]*|reaktivier[\p{L}]*|aufzubauen|aufbauen|revitalisier[\p{L}]*|stellt.*wieder|für|um)(?![\p{L}])/iu.test(clause);
     const strength=job==='hold_fix'?(holdAttached||/^\s*:\s*(?:stark[\p{L}]*|leicht[\p{L}]*|mittel[\p{L}]*|extra|ultra|maximal[\p{L}]*)(?:\s+[\p{L}]+){0,2}\s+halt/iu.test(suffix)):attachedEmphasis;
     // A neighbouring volume maximum cannot upgrade a structured-look description.
     // Keep uncertain semantic cases weak in this conservative reach screen.
     const strong=line.type==='confirmed_name'||number||strength||(!look&&explicit)||/^(?:texturgeb|volumengebend|glättet|glättend|definier)/iu.test(m[0])&&job!=='hold_fix';
     matches.push({...line,job,match:m[0],offset:m.index,strength:strong?'STRONG':'WEAK',basis:line.type==='confirmed_name'?'product-name job word':number?'brand hold number':strength?'strength/emphasis candidate':!strong?'passing mention or look description without strength/emphasis':'explicit job-result promise candidate'});
   }
   if(line.type==='confirmed_name'&&isC12(line.tier)&&/(?:curl[\p{L}]*|locken[\p{L}]*|wave[\p{L}]*|wellen[\p{L}]*)/iu.test(text)&&!/beach|strand/iu.test(text))
     matches.push({...line,job:'definition',match:text,strength:'STRONG',basis:'R7-Q2 curl/wave word in product own name'});
 }
 matches.sort((a,b)=>a.index-b.index||(a.offset??-1)-(b.offset??-1));
 const allWeak=matches.filter(x=>x.strength==='WEAK');
 const weak=allWeak.filter(x=>x.job!==primary);
 const secondaryJobs=[...new Set(matches.map(x=>x.job).filter(j=>j!==primary))];
 const reasons=[];const add=(klass,evidence)=>reasons.push({class:klass,evidence});
 if(eligible&&weak.length)add('R10-Q1-WEAK-signal',weak.map(x=>`${x.job}: ${x.field}[${x.index}] (${x.type}, ${x.tier}) “${x.text}”`).filter((x,i,a)=>a.indexOf(x)===i).join(' / '));
 if(eligible&&secondaryJobs.length>=3)add('R10-Q1-three-secondary-candidates',`At least three distinct non-primary lexical candidates before formula gating: ${secondaryJobs.join(', ')}. Primary reference: ${primary||'unresolved/disputed'}. Strength-first ordering can change the two slots.`);
 if(r.source_slug==='schwarzkopf-taft-styling-balm-locken-halt-3')add('R10-Q1-flexibility-Sprungkraft','Mandatory: C2 flexibility line “Sprungkraft” is a volume signal; inspect every typed C1/C2 line, not only promise/finish/other.');
 if(r.source_slug==='bali-gents-haarpuder-volumizing-styling-powder')add('R10-Q2-Struktur-look','Mandatory: C2 promise “natürlich strukturierten Look” supplies weak texture; C3 look/Griffigkeit lines do not count.');
 return {source_slug:r.source_slug,name:r.identity.brand+' '+r.identity.product_name,included:reasons.length>0,reasons,
  screen:{route_eligible:eligible,prior_reference:ref,primary_reference:primary,confirmed_name:name,c1_c2_claim_lines:claimLines,job_signal_candidates:matches,weak_signal_candidates:allWeak,weak_secondary_candidates:weak,distinct_secondary_candidates:secondaryJobs,semantic_exclusions:exclusions},
  capture_amendment:r.source_slug==='got2b-gotgloss-glanz-spray'?correction:null,
  excluded_reason:reasons.length?null:!eligible?'Latest prior lane route is neither committed Styling nor held Styling.':'No weak non-primary candidate and fewer than three distinct secondary candidates; no mandatory R10 example.'};
});
const selected=audit.filter(x=>x.included);
if(selected.some(x=>!x.screen.route_eligible))throw Error('selected non-Styling route');
for(const slug of required)if(!selected.some(x=>x.source_slug===slug))throw Error('mandatory record missed: '+slug);
// No opaque id may overlap any historical cohort, including r10.
const priorIds=new Set(), priorInputs=[]; for (let n=1;n<=10;n++) { const rel='data/research/styling-inci/v1.0/'+(n===1?'':'r'+n+'/')+'cohort.json'; const old=JSON.parse(fs.readFileSync(path.join(ROOT,rel))); old.records.forEach(r=>priorIds.add(r.sample_id)); priorInputs.push(rel); }
const ids=new Set(), records=selected.map(a=>{const r=clone(bySlug[a.source_slug]), old=r.sample_id; r.sample_id='sty-'+sha(SALT+r.source_slug).slice(0,10); if(priorIds.has(r.sample_id)||ids.has(r.sample_id)) throw Error('opaque id collision'); ids.add(r.sample_id); r.standard_version=STAMP;r.lexicon_version=LEXICON;if(r.source_slug==='got2b-gotgloss-glanz-spray')r.claims.push(clone(correction));r.history.round11={round6_sample_id:old,reason_classes:a.reasons.map(x=>x.class)};return r;}).sort((a,b)=>cmp(a.sample_id,b.sample_id));
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
  const old=r.history.round11.round6_sample_id;
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
const inputs=[...priorInputs,'data/research/styling-inci/v1.0/build/freeze-cohort-r6.js','data/research/styling-inci/v1.0/build/freeze-cohort-r10.js',...routeInputs,'plans/styling-concept/02-rulings.md',...['styling-classification-standard.md','01_property-set-v0.md','00_category_charter.md','02_evidence_lexicon.v0.5.md'].map(f=>'docs/research/styling-inci/v1.0/'+f)].sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));
fs.mkdirSync(OUT,{recursive:true});const writes=[],write=(rel,obj)=>{fs.mkdirSync(path.dirname(path.join(OUT,rel)),{recursive:true});fs.writeFileSync(path.join(OUT,rel),typeof obj==='string'?obj:ser(obj));writes.push(rel);};
for(const kind of Object.keys(packets)){const d=path.join(OUT,'packets',kind);fs.mkdirSync(d,{recursive:true});for(const f of fs.readdirSync(d))if(/^sty-[0-9a-f]{10}\.json$/.test(f))fs.unlinkSync(path.join(d,f));}
const verification={r6_rebuild_byte_identical_files:rebuilt,prior_id_overlap:0,strongly_mask_replacements:strongMasks,fu_grading_masks:fuGradeMasks,string_fields_scanned:scanned,leak_hits:hits.length,leak_findings:hits,ready_for_blind_lanes:hits.length===0};
const cohort={cohort_version:VERSION,frozen_on:'2026-10-14',standard_version:STAMP,lexicon_version:LEXICON,purpose:'REFERENCE ONLY. Targeted R10 signal-strength re-check; never supply cohort/id_map/scope-audit/FREEZE-NOTES to blind lanes.',counts:{total:records.length,screened:all.length,by_reason_class:classes},verification,inputs,id_map:records.map(r=>({...source.id_map.find(x=>x.source_slug===r.source_slug),sample_id:r.sample_id,round6_sample_id:r.history.round11.round6_sample_id})),records};
write('cohort.json',cohort);
write('scope-audit.json',{screened_records:all.length,selected_records:records.length,
 governing_rulings:['R10-Q1','R10-Q2','R9-Q1','R9-Q2','R9-F','R9-P','LOCK-1-S'],
 screen_patterns:{jobs:Object.fromEntries(Object.entries(JOB_PATTERNS).map(([k,re])=>[k,{source:re.source,flags:re.flags}]))},
 screen_policy:{scope:'Screen all 143 r6 records using confirmed name plus EVERY C1/C2 claim line, all types. Restrict selection to committed/held Styling from latest prior lane references (union if disputed). Keep weak secondary candidates even when duplicated by stronger signals; exclude an agreed primary job from scope triggers, and keep disputed/null primaries conservative. Secondary capacity counts distinct jobs excluding an agreed prior primary, before formula gates. Semantic false positives remain for blind resolution.',
 strength:'Name words are strong after collection exclusion. Explicit result promises, emphasis/strength and brand hold numbers are strong. Bare hold, duration-only hold and look descriptions without emphasis are weak. Scope strength labels are conservative reach annotations, never final classifications. Pure feel/consistency/audience/negated-hold matches are logged and excluded by content, never by field type alone.',
 r9_f:'Carry owner-verified gotGloss C2 promise as in r10 before screening and into any selected record/claims packet.',
 boundary:'No classification or scoring, no historical edits, no lock reinstatement. Prior routes/primary are reference-only and never supplied to blind lanes; formula gates remain for those lanes.'},records:audit});
for(const [kind,ps]of Object.entries(packets))ps.forEach(p=>write('packets/'+kind+'/'+p.id+'.json',p.body));
const esc=s=>String(s).replace(/\|/g,'/').replace(/\n/g,' ');
const notes='# FREEZE-NOTES — targeted Styling r11 signal-strength re-check\n\nFrozen 2026-10-14. Packet stamp: `'+STAMP+'`; lexicon `'+LEXICON+'` (formula membership unchanged). Status: lock suspended (LOCK-1-S) — final re-check r11 pending. Governing ledger: R10-Q1, R10-Q2, R9-Q1, R9-Q2, R9-F, R9-P and all earlier rulings.\n\n## Screen and scope\n\nAll **'+all.length+'** r6 records screened over confirmed name and every C1/C2 claim line, including promise/finish/other/hold/flexibility/humidity and other typed lines. **'+records.length+'** Styling-routed/held records selected. `scope-audit.json` retains name tier, all eligible raw lines, lexical job matches, strength/basis, semantic exclusions, latest prior route/primary references and each inclusion/exclusion reason. These are scope annotations only; lanes must apply the normative semantics and unchanged formula gate.\n\n- Select any weak candidate (bare hold without a strength word/brand number, passing mentions, look descriptions including Struktur/strukturiert), including weak secondary mentions duplicated by stronger signals; exclude only the agreed primary job from scope triggers.\n- Also select three or more distinct secondary candidates, excluding an agreed prior primary, before formula gating; strong signals precede weak signals when filling the two slots.\n- Mandatory Taft Styling Balm Locken: C2 flexibility “Sprungkraft” supplies a volume candidate. Mandatory Bali Gents Haarpuder: C2 “natürlich strukturierten Look” supplies weak texture.\n- Restrict to Styling/held Styling using the latest prior r6 lane/round7–10 references, union on route disputes. These historical results are scope context only, never desired answers.\n- R9-F gotGloss correction is carried before screening: “'+correction.raw+'” from '+correction.source+' (owner verified '+correction.date+'). Raw URL retained in reference artifacts; claims packet uses manufacturer_page/source_host/date.\n\n| Product | Reason class(es) | Inclusion reason |\n|---|---|---|\n'+selected.map(a=>'| '+esc(a.name)+' | '+a.reasons.map(x=>x.class).join(', ')+' | '+a.reasons.map(x=>esc(x.evidence)).join(' / ')+' |').join('\n')+'\n\n## Freeze and verification\n\nUnmodified r6 builder rebuilt **'+rebuilt+'** historical artifacts byte-identically in memory. r11 emits **'+records.length+'** each S0, F/U and claims packet with fresh opaque salt `'+SALT+'`; overlap with r1–r10: **0**. Reuses freeze-cohort-r10.js masking: inherited S0, directions-only F/U grading mask shielding inherited [CLAIM] tokens, strongly mask, all-field metadata/grading/route/prior-id/source-slug leak checks. INCI is unchanged and never enters general grading masking. Scanned string fields: S0 **'+scanned.s0+'**, F/U **'+scanned.fu+'**, claims **'+scanned.claims+'**. All-field leaks: **'+hits.length+'**. Two runs compared in `determinism-check.json`, including every generated artifact and manifest; receipt excluded from manifest.\n\nReference only: never supply cohort/id-map/audit/notes/manifest/receipt to blind lanes. Supply only appropriate packets. No classification, scoring, lock reinstatement or production write. R9-P remains in force: a future scorer must pin the exact docs/ledger Git revision; this freeze records current input hashes and does not edit historical scorers.\n';
write('FREEZE-NOTES.md',notes);
const manifest={manifest_version:VERSION,frozen_on:'2026-10-14',algorithm:'sha256',script:{path:'data/research/styling-inci/v1.0/build/freeze-cohort-r11.js',sha256:sha(fs.readFileSync(__filename))},inputs,counts:{cohort_records:records.length,packets_s0:records.length,packets_fu:records.length,packets_claims:records.length},verification,artifacts:writes.sort(cmp).map(rel=>({path:'r11/'+rel,sha256:sha(fs.readFileSync(path.join(OUT,rel)))}))};fs.writeFileSync(path.join(OUT,'artifact-manifest.json'),ser(manifest));console.log(JSON.stringify({selected:records.length,by_reason_class:classes,verification,manifest_sha256:sha(fs.readFileSync(path.join(OUT,'artifact-manifest.json')))},null,2));if(hits.length)throw Error('NOT READY: '+JSON.stringify(hits));
