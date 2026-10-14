#!/usr/bin/env node
// Targeted R11 volume-strength and compound-form re-check.  Historical cohorts are read-only.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const V1 = path.resolve(__dirname, '..'), ROOT = path.resolve(V1, '../../../..'), OUT = path.join(V1, 'r12');
const R6OUT = path.join(V1, 'r6'), R6SCRIPT = path.join(__dirname, 'freeze-cohort-r6.js');
const STAMP = 'styling-inci-v0.5-r11amend', LEXICON = 'styling-lexicon-v0.5-r7amend';
const VERSION = 'styling-inci-v1.0-cohort-12', SALT = 'styling-inci-v1.0-cohort-12/r11-volume-compound-form/opaque-id/';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const ser = x => JSON.stringify(x, null, 2) + '\n'; const clone = x => JSON.parse(JSON.stringify(x));
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;

// Rebuild r6 in memory: r12 never writes r1-r11 and refuses a changed historical input.
const mem = new Map();
const sandboxFs = Object.assign({}, fs, { readFileSync(p, enc) { const k=path.resolve(String(p)); return mem.has(k) ? (enc ? mem.get(k).toString(enc) : mem.get(k)) : fs.readFileSync(p, enc); }, writeFileSync(p,d) { mem.set(path.resolve(String(p)), Buffer.from(d)); }, mkdirSync(){}, rmSync(){} });
const ctx = vm.createContext({ require: m => m === 'fs' ? sandboxFs : require(m), __dirname:path.dirname(R6SCRIPT), __filename:R6SCRIPT, Buffer, console:{log(){}} });
vm.runInContext(fs.readFileSync(R6SCRIPT, 'utf8'), ctx, {filename:R6SCRIPT});
const R6 = x => vm.runInContext(x, ctx); let rebuilt = 0;
for (const [p,b] of mem) if (p.startsWith(R6OUT + path.sep)) { if (!fs.readFileSync(p).equals(b)) throw Error('r6 rebuild changed frozen bytes: '+p); rebuilt++; }
if (rebuilt !== 432) throw Error('incomplete r6 rebuild: '+rebuilt);
const source = JSON.parse(fs.readFileSync(path.join(R6OUT, 'cohort.json'))), all = source.records.slice().sort((a,b)=>cmp(a.source_slug,b.source_slug));
const bySlug = Object.fromEntries(all.map(r=>[r.source_slug,r])), isC12 = R6('isC12'), maskS0 = R6('maskS0');
// Scope is name + EVERY C1/C2 line on all r6 records; no route/primary filter.
// Historical lane assignments are neither scope inputs nor desired answers.
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
const VOLUME_WORDS = /(?:[\p{L}-]*(?:sprungkr[aä]ft|schwung|spannkraft|fülle|volum)[\p{L}-]*)/giu;
// Match forms inside German compounds too (Lockencreme, Haargel, Texturspray).
const FORM_WORDS = /(?:gel(?:ee|ée)?|cream|creme|lotion|spray|schaum|mousse|wax|wachs)/giu;
const NAME_JOBS = {
 ...JOB_PATTERNS,
 hold_fix: /(?<![\p{L}])(?:halt[\p{L}]*|hold[\p{L}]*|fixier[\p{L}]*|mold[\p{L}]*|shap[\p{L}]*|formgeb[\p{L}]*|forming|festig[\p{L}]*|kontrolle|control|kleber)(?![\p{L}])/giu,
 definition: /(?:curl[\p{L}]*|locken[\p{L}]*|wellen[\p{L}]*|waves?|defin[\p{L}]*|shaper)/giu,
 volume: /(?:volum[\p{L}]*|fülle|schwung|sprungkraft|spannkraft|lift|powder|puder)/giu,
 texture: /(?:textur[\p{L}]*|grip|grif[\p{L}]*|struktur[\p{L}]*|sea[ -]*salt|salz|beach|surf)/giu,
 sleek: /(?:glatt[\p{L}]*|glätt[\p{L}]*|sleek|smooth[\p{L}]*|straight[\p{L}]*)/giu,
 shine: /(?:glanz[\p{L}]*|glänz[\p{L}]*|shine|gloss[\p{L}]*|glow|finish[\p{L}]*|glaze|topcoat)/giu,
 care: /(?:pflege|care|treatment|kur|feuchtigkeit|hydrating|detangling|balsam)/giu,
 heat_protection: /(?:hitzeschutz|heat|thermal)/giu,
 dry_shampoo_refresh: /(?:trockenshampoo|trocken[ -]*shampoo|erfrisch[\p{L}]*)/giu,
 blowdry: /(?:föhn|blow[ -]*out|blow[ -]*dry)/giu
};
// Finite evidence review of EVERY matching r6 line. These exceptions document
// non-explicit volume wording; all other volume/Fülle wording promises volume
// itself. No regex 'für/verleiht' shortcut may upgrade curl quality.
const NON_EXPLICIT_VOLUME = {
 'balea-professional-definier-spray-traumlocken': {4:'Ingredient/technology callout: Pro-Sprungkraft-Formel; no volume promise. Conservative scope inclusion, not an eligible job assignment.'},
 'schwarzkopf-professional-osis-curl-retouch': {1:'Curl revival/quality: more Sprungkraft, definition and natural shine; volume itself is not promised.'},
 'balea-professional-styling-cream-traumlocken': {6:'Defined lively curls voller Sprungkraft: curl quality, WEAK volume (R11-Q1 owner example).',7:'SCHWUNGVOLL is a curl-look description, not an explicit volume promise; retain R7-Q1 exclusions.'},
 'alcina-foehn-lotion': {0:'Schwung & Elastizität describes movement/quality; no volume itself promised in this line.',3:'Bare Sprungkraft in flexibility: no explicit volume promise.'},
 'wella-eimi-sugar-lift': {7:'Duration/look description lang anhaltendes Volumen; conservative reach, not an explicit emphasized volume promise.'},
 'bali-curls-volumizing-curl-spray-refreshing': {0:'Voluminous Beachlook describes the look beside curl revival; conservative reach for signal-strength review.',4:'Voluminous Beachlook is a look description, not an explicit volume promise.'},
 'guhl-foehn-spray-langzeit-volumen': {5:'Bare lebendiges Volumen is a result description without an explicit volume promise.'},
 'wellaflex-schaumfestiger-locken-und-wellen-starker-halt': {0:'Schwungvolle before definierte Locken: R7-Q1 excludes a separate volume job; conservative scope inclusion.',5:'Locken mit Sprungkraft is curl quality, WEAK volume.'},
 'balea-overnight-wellenspray': {3:'Verleiht Wellen und Locken Sprungkraft: a curl-quality promise, not volume itself.'},
 'alverde-locken-refresh-spray': {3:'Geschmeidige Locken voller Sprungkraft: curl quality, WEAK volume.'},
 'balea-locken-crunchgel': {4:'Defined curls voller Sprungkraft: explicit definition, WEAK volume.'},
 'balea-locken-revitalizing-spray': {4:'Defined curls mit Sprungkraft: explicit definition, WEAK volume.'},
 'wella-eimi-nutricurls-curl-shaper': {4:'Defined curls, control and Sprungkraft: curl quality, WEAK volume; a neighbouring job promise cannot upgrade it.'},
 'alcina-styling-mousse-aerosol': {5:'Bare langanhaltendem Volumen duration/result description; conservative reach.'},
 'john-frieda-volume-lift-pushed-up-dry-texture-spray': {1:'Bare langanhaltendes Volumen und Textur duration/result description; conservative reach.'},
 'guhl-styling-spray-locken-pflege-und-styling-2in1': {3:'New Sprungkraft for defined curls is curl quality, not volume itself.'},
 'loreal-paris-elnett-haarspray-extra-starker-halt': {7:'Natural Haarschwung is a movement/look description beside shine.',8:'Duration/result bis zu 72H schwereloses Volumen; conservative reach.'},
 'john-frieda-traumlocken-belebender-wellenauffrischer': {2:'New curl definition and Sprungkraft: curl revival/quality, WEAK volume.'},
 'schwarzkopf-taft-styling-balm-locken-halt-3': {6:'Bare Sprungkraft on a curl product, C2 flexibility: WEAK volume (R11-Q1 owner example).'},
 'maria-nila-curlicue-cream': {0:'Defines curls and gives them lebendige Sprungkraft: curl quality, WEAK volume.'},
 'balea-styling-locken-lotion': {4:'Defined curls & flexible Sprungkraft: curl quality, WEAK volume.'},
 'schwarzkopf-taft-foehn-spray-volumen-halt-3': {3:'Bare natürlicher Haarschwung finish description; no explicit volume promise in this line.'},
 'redken-refreshing-curl-mist': {1:'Restores curl structure, Sprungkraft and natural movement: curl revival/quality, WEAK volume.'}
};
const reviewed=new Set();
const audit = all.map(r=> {
 const frozenClaims=JSON.parse(fs.readFileSync(path.join(R6OUT,'packets','claims',r.sample_id+'.json')));
 const name={field:'identity.product_name',index:-1,type:'confirmed_name',tier:frozenClaims.confirmed_name_tier,text:r.identity.product_name};
 const claims=clone(r.claims);if(r.source_slug==='got2b-gotgloss-glanz-spray')claims.push(clone(correction));
 const claimLines=claims.map((c,index)=>({field:'claims',index,type:c.type,tier:c.tier,position:c.position||null,text:c.raw||''})).filter(c=>isC12(c.tier));
 const volumeLines=claimLines.flatMap(line=> {
   const matches=[...line.text.matchAll(VOLUME_WORDS)].map(m=>({match:m[0],offset:m.index}));
   if(!matches.length)return [];
   const reason=NON_EXPLICIT_VOLUME[r.source_slug]?.[line.index];
   if(reason)reviewed.add(r.source_slug+':'+line.index);
   return [{...line,matches,explicit_volume_promise:!reason,strength:reason?'WEAK_OR_EXCLUDED':'STRONG',basis:reason||'Volume/Fülle itself is promised in the captured wording (not merely curl quality). Duration alone does not suppress an explicit volume result.'}];
 });
 const forms=[...name.text.matchAll(FORM_WORDS)].map(m=>({match:m[0],offset:m.index}));
 const jobs=Object.entries(NAME_JOBS).flatMap(([job,re])=>[...name.text.matchAll(re)].map(m=>({job,match:m[0],offset:m.index}))).sort((a,b)=>a.offset-b.offset||cmp(a.job,b.job));
 // Wax/Gel alone retain their old default. Count them as a job alongside a
 // distinct dispensing form (Wax Spray / Gel-Spray), not twice on one token.
 if(forms.some(f=>/wax|wachs|gel/iu.test(f.match))&&forms.some(f=>/spray/iu.test(f.match)))
   jobs.push({job:'hold_fix',match:forms.filter(f=>/wax|wachs|gel/iu.test(f.match)).map(f=>f.match).join(' / '),basis:'Product noun plus distinct dispensing form; conservative compound reach, existing RG3-1 remains.'});
 const reasons=[];
 const weak=volumeLines.filter(line=>!line.explicit_volume_promise);
 if(weak.length)reasons.push({class:'R11-Q1-non-explicit-volume-wording',evidence:weak.map(line=>`claims[${line.index}] (${line.type}, ${line.tier}) “${line.text}”: ${line.basis}`).join(' / ')});
 if(isC12(name.tier)&&forms.length&&jobs.length)reasons.push({class:'R11-Q2-name-form-plus-job',evidence:`Confirmed (${name.tier}) name “${name.text}”; forms: ${forms.map(x=>x.match).join(', ')}; job-word candidates: ${[...new Set(jobs.map(x=>x.job+': '+x.match))].join(', ')}. Conservative name reach only: preserve collection/qualifier/tie exclusions for the blind lane.`});
 return {source_slug:r.source_slug,name:r.identity.brand+' '+r.identity.product_name,included:reasons.length>0,reasons,
 screen:{confirmed_name:name,c1_c2_claim_lines:claimLines,volume_word_lines:volumeLines,form_word_matches:forms,name_job_word_candidates:jobs},
 capture_amendment:r.source_slug==='got2b-gotgloss-glanz-spray'?correction:null,
 excluded_reason:reasons.length?null:'No C1/C2 non-explicit volume wording and no confirmed C1/C2 name containing both a listed form and a job-word candidate.'};
});
for(const [slug,lines]of Object.entries(NON_EXPLICIT_VOLUME))for(const index of Object.keys(lines))if(!reviewed.has(slug+':'+index))throw Error('unmatched reviewed evidence: '+slug+':'+index);
const selected=audit.filter(x=>x.included);
for(const slug of ['balea-professional-styling-cream-traumlocken','schwarzkopf-taft-styling-balm-locken-halt-3','wella-eimi-nutricurls-curl-shaper','syoss-curl-cream-gel-3in1'])if(!selected.some(x=>x.source_slug===slug))throw Error('mandatory R11 example missed: '+slug);
// No opaque id may overlap any historical cohort, including r11.
const priorIds=new Set(), priorInputs=[]; for (let n=1;n<=11;n++) { const rel='data/research/styling-inci/v1.0/'+(n===1?'':'r'+n+'/')+'cohort.json'; const old=JSON.parse(fs.readFileSync(path.join(ROOT,rel))); old.records.forEach(r=>priorIds.add(r.sample_id)); priorInputs.push(rel); }
const ids=new Set(), records=selected.map(a=>{const r=clone(bySlug[a.source_slug]), old=r.sample_id; r.sample_id='sty-'+sha(SALT+r.source_slug).slice(0,10); if(priorIds.has(r.sample_id)||ids.has(r.sample_id)) throw Error('opaque id collision'); ids.add(r.sample_id); r.standard_version=STAMP;r.lexicon_version=LEXICON;if(r.source_slug==='got2b-gotgloss-glanz-spray')r.claims.push(clone(correction));r.history.round12={round6_sample_id:old,reason_classes:a.reasons.map(x=>x.class)};return r;}).sort((a,b)=>cmp(a.sample_id,b.sample_id));
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
  const old=r.history.round12.round6_sample_id;
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
const inputs=[...priorInputs,'data/research/styling-inci/v1.0/build/freeze-cohort-r6.js','data/research/styling-inci/v1.0/build/freeze-cohort-r11.js','plans/styling-concept/02-rulings.md',...['styling-classification-standard.md','01_property-set-v0.md','00_category_charter.md','02_evidence_lexicon.v0.5.md'].map(f=>'docs/research/styling-inci/v1.0/'+f)].sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));
if(hits.length)throw Error('NOT READY: '+JSON.stringify(hits));
fs.mkdirSync(OUT,{recursive:true});const writes=[],write=(rel,obj)=>{fs.mkdirSync(path.dirname(path.join(OUT,rel)),{recursive:true});fs.writeFileSync(path.join(OUT,rel),typeof obj==='string'?obj:ser(obj));writes.push(rel);};
for(const kind of Object.keys(packets)){const d=path.join(OUT,'packets',kind);fs.mkdirSync(d,{recursive:true});for(const f of fs.readdirSync(d))if(/^sty-[0-9a-f]{10}\.json$/.test(f))fs.unlinkSync(path.join(d,f));}
const verification={r6_rebuild_byte_identical_files:rebuilt,prior_id_overlap:0,strongly_mask_replacements:strongMasks,fu_grading_masks:fuGradeMasks,string_fields_scanned:scanned,leak_hits:hits.length,leak_findings:hits,ready_for_blind_lanes:hits.length===0};
const cohort={cohort_version:VERSION,frozen_on:'2026-10-14',standard_version:STAMP,lexicon_version:LEXICON,purpose:'REFERENCE ONLY. Targeted R11 volume-strength and compound-form re-check; never supply cohort/id_map/scope-audit/FREEZE-NOTES to blind lanes.',counts:{total:records.length,screened:all.length,by_reason_class:classes},verification,inputs,id_map:records.map(r=>({...source.id_map.find(x=>x.source_slug===r.source_slug),sample_id:r.sample_id,round6_sample_id:r.history.round12.round6_sample_id})),records};
write('cohort.json',cohort);
write('scope-audit.json',{screened_records:all.length,selected_records:records.length,
 governing_rulings:['R11-Q1','R11-Q2','R10-Q1','R10-Q2','R9-Q1','R9-Q2','R9-F','R9-P','LOCK-1-S'],
 screen_patterns:{volume_words:{source:VOLUME_WORDS.source,flags:VOLUME_WORDS.flags},forms:{source:FORM_WORDS.source,flags:FORM_WORDS.flags},name_jobs:Object.fromEntries(Object.entries(NAME_JOBS).map(([k,re])=>[k,{source:re.source,flags:re.flags}]))},
 screen_policy:{scope:'All 143 r6 records, confirmed name plus EVERY C1/C2 claim line, all types. No prior route/primary exclusion. Include every non-explicit volume-word line and every confirmed name with form plus job candidates, before formula gates. Name matches are conservative reach annotations, not final jobs; collection, qualifier, tie and authority rules remain for blind classification.',
 volume:'Each matching C1/C2 volume line is explicitly audited. Curl quality stays WEAK regardless of neighbouring verbs or promises. Technology/adjective exclusions are retained but still included conservatively in scope. Bare duration/look volume wording is included conservatively. No hardcoded expected classification.',
 r9_f:'Carry owner-verified gotGloss C2 promise before screening and into its selected record/claims packet.',
 boundary:'No classification or scoring, no historical edits, no lock reinstatement or production write.'},records:audit});
for(const [kind,ps]of Object.entries(packets))ps.forEach(p=>write('packets/'+kind+'/'+p.id+'.json',p.body));
const esc=s=>String(s).replace(/\|/g,'/').replace(/\n/g,' ');
const notes='# FREEZE-NOTES — targeted Styling r12 R11 re-check\n\nFrozen 2026-10-14. Packet stamp: `'+STAMP+'`; lexicon `'+LEXICON+'` (formula membership unchanged). Status: lock suspended (LOCK-1-S) — final re-check r12 pending. Governing ledger: R11-Q1, R11-Q2 and all earlier rulings, including R9-F / R9-P.\n\n## Screen and scope\n\nAll **'+all.length+'** r6 records screened over confirmed name and every C1/C2 claim line, all types. **'+records.length+'** selected, with no prior route/primary restriction. `scope-audit.json` records each inclusion/exclusion, all C1/C2 raw lines, every volume-word line with explicit/non-explicit reading, and form/job matches in every name. These are scope annotations only, not final classifications.\n\n- R11-Q1: include any Sprungkraft/Schwung/Spannkraft/Fülle/Volumen wording without a promise of volume itself. Curl quality is WEAK even alongside explicit definition. Include bare look/duration wording conservatively, and keep technology/R7-Q1 exclusions visible. An explicit volume promise in another line never excludes the record.\n- R11-Q2: include every confirmed C1/C2 name containing a form word (Gel, Cream/Creme, Gelee, Lotion, Spray, Schaum, Mousse, Wax/Wachs) with a job-word candidate; match compounds and inflections. Conservative reach includes qualifier/collection/tie cases for lanes to resolve under existing rulings. No route or formula-gate exclusion.\n- Finite reviewed evidence for every matching volume line is bound to its slug/index and checked at build time. No expected route, primary or secondary answer is copied into packets.\n- R9-F gotGloss C2 correction carried before screening and into its record/claims packet: “'+correction.raw+'” from '+correction.source+' (owner verified '+correction.date+').\n\n| Product | Reason class(es) | Inclusion reason |\n|---|---|---|\n'+selected.map(a=>'| '+esc(a.name)+' | '+a.reasons.map(x=>x.class).join(', ')+' | '+a.reasons.map(x=>esc(x.evidence)).join(' / ')+' |').join('\n')+'\n\n## Freeze and verification\n\nUnmodified r6 builder rebuilt **'+rebuilt+'** historical artifacts byte-identically in memory. r12 emits **'+records.length+'** each S0, F/U and claims packet with fresh opaque salt `'+SALT+'`; overlap with r1–r11: **0**. Reuses freeze-cohort-r11.js masking: inherited S0, directions-only F/U grading mask shielding inherited [CLAIM] tokens, strongly mask, all-field metadata/grading/route/prior-id/source-slug leak checks. INCI unchanged and never enters general grading masking. Scanned string fields: S0 **'+scanned.s0+'**, F/U **'+scanned.fu+'**, claims **'+scanned.claims+'**. All-field leaks: **'+hits.length+'**. Two builds compared in `determinism-check.json`, including every generated artifact and manifest; receipt excluded from manifest.\n\nReference only: never supply cohort/id-map/audit/notes/manifest/receipt to blind lanes. Supply only appropriate packets. No classification, scoring, lock reinstatement or production write. R9-P requires the future scorer to pin exact docs/ledger Git revision; this freeze additionally records current input hashes.\n';
write('FREEZE-NOTES.md',notes);
const manifest={manifest_version:VERSION,frozen_on:'2026-10-14',algorithm:'sha256',script:{path:'data/research/styling-inci/v1.0/build/freeze-cohort-r12.js',sha256:sha(fs.readFileSync(__filename))},inputs,counts:{cohort_records:records.length,packets_s0:records.length,packets_fu:records.length,packets_claims:records.length},verification,artifacts:writes.sort(cmp).map(rel=>({path:'r12/'+rel,sha256:sha(fs.readFileSync(path.join(OUT,rel)))}))};fs.writeFileSync(path.join(OUT,'artifact-manifest.json'),ser(manifest));console.log(JSON.stringify({selected:records.length,by_reason_class:classes,verification,manifest_sha256:sha(fs.readFileSync(path.join(OUT,'artifact-manifest.json')))},null,2));if(hits.length)throw Error('NOT READY: '+JSON.stringify(hits));
