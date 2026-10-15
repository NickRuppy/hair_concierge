#!/usr/bin/env node
// Targeted R7 owner-ruling re-check.  Historical cohorts are read-only.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const V1 = path.resolve(__dirname, '..'), ROOT = path.resolve(V1, '../../../..'), OUT = path.join(V1, 'r8');
const R6OUT = path.join(V1, 'r6'), R6SCRIPT = path.join(__dirname, 'freeze-cohort-r6.js');
const STAMP = 'styling-inci-v0.5-r7amend', LEXICON = 'styling-lexicon-v0.5-r7amend';
const VERSION = 'styling-inci-v1.0-cohort-8', SALT = 'styling-inci-v1.0-cohort-8/r7-owner-amendment/opaque-id/';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const ser = x => JSON.stringify(x, null, 2) + '\n'; const clone = x => JSON.parse(JSON.stringify(x));
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;

// Rebuild r6 in memory: r8 never writes r1-r7 and refuses a changed historical input.
const mem = new Map();
const sandboxFs = Object.assign({}, fs, { readFileSync(p, enc) { const k=path.resolve(String(p)); return mem.has(k) ? (enc ? mem.get(k).toString(enc) : mem.get(k)) : fs.readFileSync(p, enc); }, writeFileSync(p,d) { mem.set(path.resolve(String(p)), Buffer.from(d)); }, mkdirSync(){}, rmSync(){} });
const ctx = vm.createContext({ require: m => m === 'fs' ? sandboxFs : require(m), __dirname:path.dirname(R6SCRIPT), __filename:R6SCRIPT, Buffer, console:{log(){}} });
vm.runInContext(fs.readFileSync(R6SCRIPT, 'utf8'), ctx, {filename:R6SCRIPT});
const R6 = x => vm.runInContext(x, ctx); let rebuilt = 0;
for (const [p,b] of mem) if (p.startsWith(R6OUT + path.sep)) { if (!fs.readFileSync(p).equals(b)) throw Error('r6 rebuild changed frozen bytes: '+p); rebuilt++; }
if (rebuilt !== 432) throw Error('incomplete r6 rebuild: '+rebuilt);
const source = JSON.parse(fs.readFileSync(path.join(R6OUT, 'cohort.json'))), all = source.records.slice().sort((a,b)=>cmp(a.source_slug,b.source_slug));
const bySlug = Object.fromEntries(all.map(r=>[r.source_slug,r])), isC12 = R6('isC12'), maskS0 = R6('maskS0');
// Conservative primary-job screen, not a classification: bare curl/wave mentions and formula words are not sentence jobs.
const primary = /\b(?:halt|hold|fixier\w*|volum\w*|schwung|sprungkraft|spannkraft|fülle|textur\w*|struktur\w*|grip|griffig\w*|gl[aä]tt\w*|smooth\w*|sleek|anti[- ]?frizz|frizz|gl[aä]nz\w*|shine|gloss|defin\w*|form(?:t|en|ung)?|shap\w*|mold\w*|beach\w*|refresh\w*|auffrisch\w*|reviv\w*|reaktiv\w*)\b/i;
const definitionStem = /\bdefin\w*/i;
const curlWave = /\b(?:curl\w*|lock\w*|wellen?\w*|wave\w*)\b/i;
const brandLine = /\b(?:frizz[-\s]*ease|traumlocken|volume\s*lift|diamond\s*sleek|glow\s*(?:&|und)\s*shine|nutricurls)\b/i;
// Additional line candidates are retained conservatively, never declared brand lines by this screen.
// Thermashape is explicitly a collection in capture/round3-smoothing-r5.json (two products).
// The others appear as separate pack/header/name units; their status is checked by the lanes under R7-Q3.
const lineCandidate = /\b(?:thermashape|curl\s*manifesto|locken\s*methode|locken\s*traum|lockenwunder|gotcurlz|glaze|eimi\s+(?:volume|texture))\b/i;
const required = new Set(['bali-gents-sea-salt-spray','balea-leave-in-spray-sea-salt-care-define','kevin-murphy-killer-curls','wellaflex-schaumfestiger-locken-und-wellen-starker-halt','neqi-diamond-glass-ultimate-styling-spray','neqi-diamond-glass-styling-spray-all','maria-nila-curlicue-cream','bumble-and-bumble-brilliantine','balea-men-pomade-haar-bart-2in1']);
const audit = all.map(r => {
  const names = [{field:'identity.product_name',index:0,text:r.identity.product_name}, ...(r.identity.product_name_as_captured && r.identity.product_name_as_captured !== r.identity.product_name ? [{field:'identity.product_name_as_captured',index:0,text:r.identity.product_name_as_captured}] : []), ...(r.identity.name_variants || []).map((text,index)=>({field:'identity.name_variants',index,text}))].filter(x=>x.text);
  const claims = r.claims.map((claim,index)=>({...claim,index})).filter(c=>isC12(c.tier));
  const nameParts = names.map(x=>x.text), lines = claims.map(c=>c.raw || '');
  const reasons=[]; const add=(klass,evidence)=>reasons.push({class:klass,evidence});
  if (required.has(r.source_slug)) add('mandatory-r7-m2', 'Explicit R7/M2 re-check record.');
  const name = nameParts.join(' / ');
  const collectionMatches = [...names, ...claims.map(c=>({field:'claims',index:c.index,type:c.type,tier:c.tier,text:c.raw||''}))].filter(x=>brandLine.test(x.text));
  if (collectionMatches.length) add('R7-Q3-brand-line', 'Confirmed brand line/collection with a job word in name, variant or C1/C2 claim field.');
  const lineCandidateMatches = [...names, ...claims.map(c=>({field:'claims',index:c.index,type:c.type,tier:c.tier,text:c.raw||''}))].filter(x=>lineCandidate.test(x.text));
  if (lineCandidateMatches.length) add('R7-Q3-line-candidate', 'Additional collection/line candidate with a potential job word; conservative inclusion, not a ruling that a product name is a collection.');
  if (curlWave.test(name)) add('R7-Q2-curl-wave-name', 'Curl/wave word in product name or name variant: '+name);
  const definitionMatches = [...names, ...claims.map(c=>({field:'claims',index:c.index,type:c.type,tier:c.tier,text:c.raw||''}))].filter(x=>definitionStem.test(x.text));
  if (definitionMatches.length) add('R7-Q2-definition-define-screen', 'Case-insensitive /\\bdefin\\w*/i match in name, variant or C1/C2 claim field.');
  const adjective = claims.filter(c=>/\bdefin\w*\s+(?:lock\w*|curl\w*|wellen?\w*|wave\w*)/i.test(c.raw || ''));
  if (adjective.length) add('R7-Q1-adjective-before-job', 'Adjective-before-job candidate in a C1/C2 claim.');
  // R7-F primary reach deliberately uses promise lines only. Eligible order: C1 pack_front,
  // other C1 packet order, then C2 packet order. Typed hold/finish/free_from/etc. never enter it.
  const promises = claims.filter(c=>c.type==='promise').sort((a,b)=>((a.tier.startsWith('C1')&&a.position==='pack_front'?0:a.tier.startsWith('C1')?1:2)- (b.tier.startsWith('C1')&&b.position==='pack_front'?0:b.tier.startsWith('C1')?1:2)) || a.index-b.index);
  const firstNoJob = promises.length && !primary.test(promises[0].raw||'') ? 0 : -1, laterJob = firstNoJob < 0 ? [] : promises.slice(1).filter(c=>primary.test(c.raw||''));
  if (firstNoJob >= 0 && laterJob.length) add('R7-F-later-primary', 'First eligible ordered promise line '+promises[0].index+' has no explicit primary-job stem match; later eligible promise lines have matches. Conservative R7-F candidate; name/semantic eligibility is left to the blind lanes.');
  if (promises.length && promises.every(c=>!primary.test(c.raw||''))) add('R7-F-unresolved-primary', 'No eligible ordered C1/C2 promise line has an explicit primary-job stem match. Conservative R7-F unresolved candidate; name/semantic eligibility is left to the blind lanes.');
  return {source_slug:r.source_slug,name:r.identity.brand+' '+r.identity.product_name,name_variants:r.identity.name_variants||[],included:reasons.length>0,reasons,screen:{name_and_variants:names,c1_c2_claim_lines:claims.map(c=>({field:'claims',index:c.index,type:c.type,tier:c.tier,position:c.position||null,text:c.raw||''})),collection_name_matches:collectionMatches,additional_line_candidate_matches:lineCandidateMatches,definition_define_matches:definitionMatches,r7_f_ordered_promise_lines:promises.map(c=>({field:'claims',index:c.index,tier:c.tier,position:c.position||null,text:c.raw||'',has_primary_vocabulary:primary.test(c.raw||'')}))},excluded_reason:reasons.length?null:'No R7-F/Q1/Q2/Q3 or M2 screen match.'};
});
const selected = audit.filter(x=>x.included);
for (const s of required) if (!selected.some(x=>x.source_slug===s)) throw Error('mandatory record missed: '+s);
// No opaque id may overlap any historical cohort, including r7.
const priorIds=new Set(), priorInputs=[]; for (let n=1;n<=7;n++) { const rel='data/research/styling-inci/v1.0/'+(n===1?'':'r'+n+'/')+'cohort.json'; const old=JSON.parse(fs.readFileSync(path.join(ROOT,rel))); old.records.forEach(r=>priorIds.add(r.sample_id)); priorInputs.push(rel); }
const ids=new Set(), records=selected.map(a=>{const r=clone(bySlug[a.source_slug]), old=r.sample_id; r.sample_id='sty-'+sha(SALT+r.source_slug).slice(0,10); if(priorIds.has(r.sample_id)||ids.has(r.sample_id)) throw Error('opaque id collision'); ids.add(r.sample_id); r.standard_version=STAMP;r.lexicon_version=LEXICON;r.history.round8={round6_sample_id:old,reason_classes:a.reasons.map(x=>x.class)};return r;}).sort((a,b)=>cmp(a.sample_id,b.sample_id));
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
  const old=r.history.round8.round6_sample_id;
  const frozen=JSON.parse(fs.readFileSync(path.join(R6OUT,'packets',kind,old+'.json'))),body=clone(frozen);
  body.sample_id=r.sample_id;body.packet_version=STAMP;
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
const inputs=[...priorInputs,'data/research/styling-inci/v1.0/build/freeze-cohort-r6.js','data/research/styling-inci/v1.0/build/freeze-cohort-r7.js','plans/styling-concept/02-rulings.md',...['styling-classification-standard.md','01_property-set-v0.md','00_category_charter.md','02_evidence_lexicon.v0.5.md'].map(f=>'docs/research/styling-inci/v1.0/'+f)].sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));
fs.mkdirSync(OUT,{recursive:true});const writes=[],write=(rel,obj)=>{fs.mkdirSync(path.dirname(path.join(OUT,rel)),{recursive:true});fs.writeFileSync(path.join(OUT,rel),typeof obj==='string'?obj:ser(obj));writes.push(rel);};
for(const kind of Object.keys(packets)){const d=path.join(OUT,'packets',kind);fs.mkdirSync(d,{recursive:true});for(const f of fs.readdirSync(d))if(/^sty-[0-9a-f]{10}\.json$/.test(f))fs.unlinkSync(path.join(d,f));}
const verification={r6_rebuild_byte_identical_files:rebuilt,prior_id_overlap:0,strongly_mask_replacements:strongMasks,fu_grading_masks:fuGradeMasks,string_fields_scanned:scanned,leak_hits:hits.length,leak_findings:hits,ready_for_blind_lanes:hits.length===0};
const cohort={cohort_version:VERSION,frozen_on:'2026-10-13',standard_version:STAMP,lexicon_version:LEXICON,purpose:'REFERENCE ONLY. Targeted R7 re-check; never supply cohort/id_map/scope-audit/FREEZE-NOTES to blind lanes.',counts:{total:records.length,screened:all.length,by_reason_class:classes},verification,inputs,id_map:records.map(r=>({...source.id_map.find(x=>x.source_slug===r.source_slug),sample_id:r.sample_id,round6_sample_id:r.history.round8.round6_sample_id})),records};
write('cohort.json',cohort);write('scope-audit.json',{screened_records:all.length,selected_records:records.length,screen_patterns:{primary_candidate:{source:primary.source,flags:primary.flags},definition:{source:definitionStem.source,flags:definitionStem.flags},curl_wave_name:{source:curlWave.source,flags:curlWave.flags},confirmed_collection:{source:brandLine.source,flags:brandLine.flags},additional_line_candidate:{source:lineCandidate.source,flags:lineCandidate.flags}},screen_policy:{definition_and_adjective:'Case-insensitive /\\bdefin\\w*/i and adjective screens read product name (including product_name_as_captured), variants and every C1/C2 claim type; each match records field, index and exact text.',r7_f:'Only C1/C2 type=promise lines enter primary reach, ordered C1 pack_front first, then other C1 packet order, then C2 packet order. Only a no-stem first eligible promise lead triggers the later-promise candidate; later no-job lines cannot override an already job-bearing lead. Bare curl/wave mentions and formula words do not prove a sentence job. This is a conservative stem screen, not a primary-job classification; name and sentence semantics are re-checked by the lanes. Typed finish/hold/free_from/etc. never enter primary selection.',r7_q3:'Confirmed multi-product collection inventory: Frizz Ease, Traumlocken, Volume Lift, Diamond Sleek, Glow & Shine, Nutricurls. Name, variants and every C1/C2 claim line are screened; each match records field, index and exact text. Additional conservative line candidates are screened: Thermashape (capture/round3-smoothing-r5.json explicitly names thermashape-collection for two products), Curl Manifesto and Locken Methode (distinct pack/header units in capture/packnames-r7.json), Locken Traum, Lockenwunder, gotCURLZ, Glaze and EIMI Volume/Texture. Candidate inclusion does not decide that the words are collection names or override the product-name rulings; the lanes decide from the captured context.'},records:audit});for(const [kind,ps]of Object.entries(packets))ps.forEach(p=>write('packets/'+kind+'/'+p.id+'.json',p.body));
const esc=s=>String(s).replace(/\|/g,'/').replace(/\n/g,' ');const notes='# FREEZE-NOTES — targeted Styling r8 re-check\n\nFrozen 2026-10-13. R7 amendment packet stamp: `'+STAMP+'`; lexicon `'+LEXICON+'`. LOCK-1 remains suspended pending this targeted re-check (LOCK-1-S).\n\n## Scope\n\nAll **'+all.length+'** r6 records were screened case-insensitively. Definition/adjective tests use `/\\bdefin\\w*/i` over product name (including `product_name_as_captured`), variants and **every** C1/C2 claim type, with exact field/index/text in `scope-audit.json`. R7-F uses only C1/C2 `promise` lines, ordered C1 `pack_front`, other C1 packet order, then C2 packet order; typed finish/hold/free_from/etc. cannot become primary inputs. Only a no-stem first eligible promise lead triggers the later-promise candidate; a later no-job line cannot override a job-bearing lead. Bare curl/wave mentions and formula words are not treated as sentence jobs. The primary screen is conservative candidate capture, not classification: name and sentence semantics remain for the blind re-check. **'+records.length+'** records are selected.\n\nScreen expressions (case-insensitive; full exact patterns also in `scope-audit.json`):\n\n- Definition: `'+definitionStem.source+'`\n- Curl/wave names: `'+curlWave.source+'`\n- Known collections: `'+brandLine.source+'`\n- Additional line candidates: `'+lineCandidate.source+'`\n- Conservative primary candidate: `'+primary.source+'`\n\nThe R7-Q3 name inventory confirms Frizz Ease, Traumlocken, Volume Lift, Diamond Sleek, Glow & Shine and Nutricurls as multi-product collection names containing job words. The screen also retains additional conservative line candidates: Thermashape (explicit thermashape-collection URLs for two products in `capture/round3-smoothing-r5.json`), Curl Manifesto and Locken Methode (separate pack/header units in `capture/packnames-r7.json`), Locken Traum, Lockenwunder, gotCURLZ, Glaze and EIMI Volume/Texture. These candidates do not rule a product noun to be a collection name; they ensure R7-Q3 reach is checked without silently dropping possible line names or overriding R4-Q2/R4-Q7.\n\n| Product | Reason class(es) |\n|---|---|\n'+selected.map(a=>'| '+esc(a.name)+' | '+a.reasons.map(x=>x.class).join(', ')+' |').join('\n')+'\n\n## Freeze and verification\n\nThe unmodified r6 builder rebuilt **'+rebuilt+'** historical artifacts byte-identically in memory. r8 emits **'+records.length+'** S0, F/U, and claims packets with a fresh opaque salt (`'+SALT+'`); id overlap with r1-r7 is zero. It preserves r6 S0 masking, reuses the exact r7 directions-only F/U grading mask (including its inherited-mask sentinel), and adds `strongly` to the strength-grade mask and a non-stateful leak regex. INCI is byte-identical to r6 and is never passed through the general grading mask. All S0/FU string fields were scanned: S0 **'+scanned.s0+'**, F/U **'+scanned.fu+'**; unauthorized leaks: **'+hits.length+'**. Re-run `node data/research/styling-inci/v1.0/build/freeze-cohort-r8.js` twice and compare `r8/artifact-manifest.json` SHA-256 for determinism.\n';write('FREEZE-NOTES.md',notes);
const manifest={manifest_version:VERSION,frozen_on:'2026-10-13',algorithm:'sha256',script:{path:'data/research/styling-inci/v1.0/build/freeze-cohort-r8.js',sha256:sha(fs.readFileSync(__filename))},inputs,counts:{cohort_records:records.length,packets_s0:records.length,packets_fu:records.length,packets_claims:records.length},verification,artifacts:writes.sort(cmp).map(rel=>({path:'r8/'+rel,sha256:sha(fs.readFileSync(path.join(OUT,rel)))}))};fs.writeFileSync(path.join(OUT,'artifact-manifest.json'),ser(manifest));console.log(JSON.stringify({selected:records.length,by_reason_class:classes,verification,manifest_sha256:sha(fs.readFileSync(path.join(OUT,'artifact-manifest.json')))},null,2));if(hits.length)throw Error('NOT READY: '+JSON.stringify(hits));
