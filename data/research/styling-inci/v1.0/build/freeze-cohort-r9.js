#!/usr/bin/env node
// Targeted R8 owner-ruling re-check.  Historical cohorts are read-only.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const V1 = path.resolve(__dirname, '..'), ROOT = path.resolve(V1, '../../../..'), OUT = path.join(V1, 'r9');
const R6OUT = path.join(V1, 'r6'), R6SCRIPT = path.join(__dirname, 'freeze-cohort-r6.js');
const STAMP = 'styling-inci-v0.5-r8amend', LEXICON = 'styling-lexicon-v0.5-r7amend';
const VERSION = 'styling-inci-v1.0-cohort-9', SALT = 'styling-inci-v1.0-cohort-9/r8-owner-amendment/opaque-id/';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const ser = x => JSON.stringify(x, null, 2) + '\n'; const clone = x => JSON.parse(JSON.stringify(x));
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;

// Rebuild r6 in memory: r9 never writes r1-r8 and refuses a changed historical input.
const mem = new Map();
const sandboxFs = Object.assign({}, fs, { readFileSync(p, enc) { const k=path.resolve(String(p)); return mem.has(k) ? (enc ? mem.get(k).toString(enc) : mem.get(k)) : fs.readFileSync(p, enc); }, writeFileSync(p,d) { mem.set(path.resolve(String(p)), Buffer.from(d)); }, mkdirSync(){}, rmSync(){} });
const ctx = vm.createContext({ require: m => m === 'fs' ? sandboxFs : require(m), __dirname:path.dirname(R6SCRIPT), __filename:R6SCRIPT, Buffer, console:{log(){}} });
vm.runInContext(fs.readFileSync(R6SCRIPT, 'utf8'), ctx, {filename:R6SCRIPT});
const R6 = x => vm.runInContext(x, ctx); let rebuilt = 0;
for (const [p,b] of mem) if (p.startsWith(R6OUT + path.sep)) { if (!fs.readFileSync(p).equals(b)) throw Error('r6 rebuild changed frozen bytes: '+p); rebuilt++; }
if (rebuilt !== 432) throw Error('incomplete r6 rebuild: '+rebuilt);
const source = JSON.parse(fs.readFileSync(path.join(R6OUT, 'cohort.json'))), all = source.records.slice().sort((a,b)=>cmp(a.source_slug,b.source_slug));
const bySlug = Object.fromEntries(all.map(r=>[r.source_slug,r])), isC12 = R6('isC12'), maskS0 = R6('maskS0');
// Scope is a conservative reach screen, never a classification. Read every name
// representation and every C1/C2 claim type, not just the first promise line.
const powderName = /(?:puder|powder)/i;
const powderFormat = /powder/i;
const volume = /\b(?:volum\w*|fülle|voller(?:es|em|en)?\s+haar|lift)\b/i;
const freshness = /(?:frisch\w*|refresh\w*)/i;
const required = new Set([
  'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray',
  'moroccanoil-glaettende-creme-smoothing-lotion'
]);
const audit = all.map(r => {
  const names = [{field:'identity.product_name',index:0,text:r.identity.product_name},
    ...(r.identity.product_name_as_captured && r.identity.product_name_as_captured !== r.identity.product_name
      ? [{field:'identity.product_name_as_captured',index:0,text:r.identity.product_name_as_captured}] : []),
    ...(r.identity.name_variants || []).map((text,index)=>({field:'identity.name_variants',index,text}))].filter(x=>x.text);
  const claims = r.claims.map((claim,index)=>({...claim,index})).filter(c=>isC12(c.tier));
  const claimLines = claims.map(c=>({field:'claims',index:c.index,type:c.type,tier:c.tier,position:c.position||null,text:c.raw||''}));
  const screened = [...names, ...claimLines];
  const powderMatches = screened.filter(x=>powderName.test(x.text));
  const powderNameMatches = names.filter(x=>powderName.test(x.text));
  const volumeMatches = screened.filter(x=>volume.test(x.text));
  const freshnessMatches = screened.filter(x=>freshness.test(x.text));
  const promises = claims.filter(c=>c.type==='promise').sort((a,b)=>
    ((a.tier.startsWith('C1')&&a.position==='pack_front'?0:a.tier.startsWith('C1')?1:2) -
     (b.tier.startsWith('C1')&&b.position==='pack_front'?0:b.tier.startsWith('C1')?1:2)) || a.index-b.index);
  const reasons=[]; const add=(klass,evidence)=>reasons.push({class:klass,evidence});
  if (r.source_slug==='loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray')
    add('R8-Q1-Big-Hair-Day', 'Owner-ruled refresh-between-washes + volume tie, even with a volume-leading name; re-check dry_shampoo.');
  if (r.source_slug==='moroccanoil-glaettende-creme-smoothing-lotion')
    add('R8-H-Moroccanoil-border', 'Stale mixed example removed: descriptive Definition for krauses Haar plus a separate curl-target line is not a curl-definition promise; R7-Q2 and border rules govern.');
  if (powderNameMatches.length || powderFormat.test(r.identity.format||'') || powderMatches.length)
    add('R8-Q2-hair-powder', 'Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name.');
  // Retain all volume + freshness co-occurrences, even outside the lead. This
  // superset cannot miss a volume-leading product. Curl revival, scent and
  // collection words are left to the lanes, not classified as Dry Shampoo here.
  if (volumeMatches.length && freshnessMatches.length)
    add('R8-Q1-volume-freshness-candidate', 'Volume wording in name or any C1/C2 line plus frisch/Frische/erfrischend/refresh wording in name or any C1/C2 line; conservative candidate, semantics and lead eligibility remain for blind lanes.');
  return {source_slug:r.source_slug,name:r.identity.brand+' '+r.identity.product_name,
    name_variants:r.identity.name_variants||[],included:reasons.length>0,reasons,
    screen:{name_and_variants:names,c1_c2_claim_lines:claimLines,captured_format:r.identity.format||null,
      powder_matches:powderMatches,volume_matches:volumeMatches,freshness_matches:freshnessMatches,
      ordered_promise_lines:promises.map(c=>({field:'claims',index:c.index,tier:c.tier,position:c.position||null,text:c.raw||''}))},
    excluded_reason:reasons.length?null:'No Puder/Powder name/claim or powder format, no volume + freshness co-occurrence, and not the R8-H worked-example record.'};
});
const selected = audit.filter(x=>x.included);
for (const s of required) if (!selected.some(x=>x.source_slug===s)) throw Error('mandatory record missed: '+s);
// No opaque id may overlap any historical cohort, including r8.
const priorIds=new Set(), priorInputs=[]; for (let n=1;n<=8;n++) { const rel='data/research/styling-inci/v1.0/'+(n===1?'':'r'+n+'/')+'cohort.json'; const old=JSON.parse(fs.readFileSync(path.join(ROOT,rel))); old.records.forEach(r=>priorIds.add(r.sample_id)); priorInputs.push(rel); }
const ids=new Set(), records=selected.map(a=>{const r=clone(bySlug[a.source_slug]), old=r.sample_id; r.sample_id='sty-'+sha(SALT+r.source_slug).slice(0,10); if(priorIds.has(r.sample_id)||ids.has(r.sample_id)) throw Error('opaque id collision'); ids.add(r.sample_id); r.standard_version=STAMP;r.lexicon_version=LEXICON;r.history.round9={round6_sample_id:old,reason_classes:a.reasons.map(x=>x.class)};return r;}).sort((a,b)=>cmp(a.sample_id,b.sample_id));
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
  const old=r.history.round9.round6_sample_id;
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
const inputs=[...priorInputs,'data/research/styling-inci/v1.0/build/freeze-cohort-r6.js','data/research/styling-inci/v1.0/build/freeze-cohort-r8.js','plans/styling-concept/02-rulings.md',...['styling-classification-standard.md','01_property-set-v0.md','00_category_charter.md','02_evidence_lexicon.v0.5.md'].map(f=>'docs/research/styling-inci/v1.0/'+f)].sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));
fs.mkdirSync(OUT,{recursive:true});const writes=[],write=(rel,obj)=>{fs.mkdirSync(path.dirname(path.join(OUT,rel)),{recursive:true});fs.writeFileSync(path.join(OUT,rel),typeof obj==='string'?obj:ser(obj));writes.push(rel);};
for(const kind of Object.keys(packets)){const d=path.join(OUT,'packets',kind);fs.mkdirSync(d,{recursive:true});for(const f of fs.readdirSync(d))if(/^sty-[0-9a-f]{10}\.json$/.test(f))fs.unlinkSync(path.join(d,f));}
const verification={r6_rebuild_byte_identical_files:rebuilt,prior_id_overlap:0,strongly_mask_replacements:strongMasks,fu_grading_masks:fuGradeMasks,string_fields_scanned:scanned,leak_hits:hits.length,leak_findings:hits,ready_for_blind_lanes:hits.length===0};
const cohort={cohort_version:VERSION,frozen_on:'2026-10-14',standard_version:STAMP,lexicon_version:LEXICON,purpose:'REFERENCE ONLY. Targeted R8 re-check; never supply cohort/id_map/scope-audit/FREEZE-NOTES to blind lanes.',counts:{total:records.length,screened:all.length,by_reason_class:classes},verification,inputs,id_map:records.map(r=>({...source.id_map.find(x=>x.source_slug===r.source_slug),sample_id:r.sample_id,round6_sample_id:r.history.round9.round6_sample_id})),records};
write('cohort.json',cohort);
write('scope-audit.json',{screened_records:all.length,selected_records:records.length,
  governing_rulings:['R8-Q1','R8-Q2','R8-H'],
  screen_patterns:Object.fromEntries(Object.entries({powder_name:powderName,powder_format:powderFormat,volume,freshness}).map(([k,re])=>[k,{source:re.source,flags:re.flags}])),
  screen_policy:{fields:'Product name, product_name_as_captured, all name variants and every C1/C2 claim type; exact field/index/tier/text retained for all records.',
    powder:'Include all hair powders by format or Puder/Powder in names or any C1/C2 line, including compound nouns, names without an explicit powder noun and aerosol powder sprays.',
    volume_freshness:'Conservative superset: volume anywhere in name/all C1/C2 lines plus freshness anywhere in the same screen. Therefore every volume-lead + freshness-line candidate is retained. No first-line shortcut. Ordered promise lines expose C1 pack_front, other C1 packet order, then C2 packet order; this is audit context, not a primary-job classification.',
    semantics:'Curl refresh, scent freshness and collection-name words can be false positives; inclusion does not assign Dry Shampoo, volume primary or any other value. Blind lanes apply all earlier rulings.',
    r8_h:'Explicitly retain Moroccanoil Glättende Creme, whose stale mixed worked example is removed under R7-Q2 and the existing border rules.'},records:audit});
for(const [kind,ps]of Object.entries(packets))ps.forEach(p=>write('packets/'+kind+'/'+p.id+'.json',p.body));
const esc=s=>String(s).replace(/\|/g,'/').replace(/\n/g,' ');
const notes='# FREEZE-NOTES — targeted Styling r9 re-check\n\nFrozen 2026-10-14. R8 amendment packet stamp: `'+STAMP+'`; lexicon `'+LEXICON+'` (formula membership unchanged). LOCK-1 remains suspended. Governing ledger: R8-Q1, R8-Q2, R8-H and all earlier rulings.\n\n## Scope\n\nAll **'+all.length+'** r6 records were screened case-insensitively over product name, `product_name_as_captured`, every name variant and **every C1/C2 claim line**, regardless of claim type. Exact field/index/tier/text, matches, ordered promise lines and exclusion reasons are in `scope-audit.json`. **'+records.length+'** records selected.\n\n- R8-Q2: include every hair powder (captured powder format or Puder/Powder in names/C1/C2 text), including compounds and aerosol powder sprays. The noun supplies volume; texture/grip requires its own promise; Powder Grip is a two-job name.\n- R8-Q1: include Big Hair Day explicitly and all volume + freshness co-occurrences anywhere in the screened fields, a conservative superset of the requested volume-lead + freshness-line set. No first-line shortcut. Curl revival and scent candidates stay included for semantic re-check; the freeze assigns no route or job.\n- R8-H: include Moroccanoil Glättende Creme explicitly; its stale care + definition mixed example is removed, with R7-Q2 and border rules governing.\n\nScreen patterns: `'+powderName.source+'`; format `'+powderFormat.source+'`; volume `'+volume.source+'`; freshness `'+freshness.source+'` (all case-insensitive).\n\n| Product | Reason class(es) | Inclusion reason |\n|---|---|---|\n'+selected.map(a=>'| '+esc(a.name)+' | '+a.reasons.map(x=>x.class).join(', ')+' | '+a.reasons.map(x=>esc(x.evidence)).join(' / ')+' |').join('\n')+'\n\n## Freeze and verification\n\nThe unmodified r6 builder rebuilt **'+rebuilt+'** historical artifacts byte-identically in memory. r9 emits **'+records.length+'** each of S0, F/U and claims packets from r6 with a fresh opaque salt (`'+SALT+'`); id overlap with r1-r8 is zero. Masking and leak checks reuse `freeze-cohort-r8.js` logic: inherited S0 mask, directions-only F/U grading mask with inherited-mask sentinel, and strongly strength mask. INCI stays byte-identical to r6 and never enters the general grading mask. Every S0/FU string field was scanned: S0 **'+scanned.s0+'**, F/U **'+scanned.fu+'**; unauthorized leaks: **'+hits.length+'**. Claims strings also undergo metadata checks. Run `node data/research/styling-inci/v1.0/build/freeze-cohort-r9.js` twice and compare every artifact hash plus the manifest hash for determinism. `determinism-check.json` is an external two-run verification receipt, excluded from the generated manifest.\n\nNever supply cohort/id_map/scope-audit/FREEZE-NOTES/manifest/verification receipt to blind lanes; supply only the appropriate packets. No classification or production write is performed.\n';
write('FREEZE-NOTES.md',notes);
const manifest={manifest_version:VERSION,frozen_on:'2026-10-14',algorithm:'sha256',script:{path:'data/research/styling-inci/v1.0/build/freeze-cohort-r9.js',sha256:sha(fs.readFileSync(__filename))},inputs,counts:{cohort_records:records.length,packets_s0:records.length,packets_fu:records.length,packets_claims:records.length},verification,artifacts:writes.sort(cmp).map(rel=>({path:'r9/'+rel,sha256:sha(fs.readFileSync(path.join(OUT,rel)))}))};fs.writeFileSync(path.join(OUT,'artifact-manifest.json'),ser(manifest));console.log(JSON.stringify({selected:records.length,by_reason_class:classes,verification,manifest_sha256:sha(fs.readFileSync(path.join(OUT,'artifact-manifest.json')))},null,2));if(hits.length)throw Error('NOT READY: '+JSON.stringify(hits));
