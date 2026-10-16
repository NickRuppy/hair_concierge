import json,re,hashlib,copy,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[8]
BASE=pathlib.Path(__file__).resolve().parent
# Resolve repository independently of checkout directory name.
ROOT=next(p for p in BASE.parents if (p/'.agents').is_dir())
OLD=ROOT/'data/research/oil-inci/v1.0/corpus/exploratory/full-profile-completion-v0.1/dictionary-staging/corrected-function-dictionary-v0.4.json'
HOLD=ROOT/'data/research/oil-inci/v1.0/corpus/holdout/full-profile-v0.2'
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def norm(s):return re.sub(r'\s+',' ',re.sub(r'\([^)]*\)','',s.upper())).strip()
def save(name,d):(BASE/name).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
old=load(OLD); hd=load(HOLD/'dictionary.json'); hr={e['id']:e for e in load(HOLD/'function-source-registry.json')['entries']}
ix={}; origin={}
for e in old['entries']:
 for n in [e['canonical_name']]+e['aliases']:ix[norm(n)]=e;origin[e['canonical_name']]={'path':str(OLD.relative_to(ROOT)),'sha256':sha(OLD),'sources':e.get('source_refs',[]),'alias_basis':e.get('alias_basis',[]),'penetration_source_refs':e.get('penetration_source_refs',[])}
for e in hd['entries']:
 for n in [e['canonical_name']]+e['aliases']:ix[norm(n)]=e
 origin[e['canonical_name']]={'path':str((HOLD/'dictionary.json').relative_to(ROOT)),'sha256':sha(HOLD/'dictionary.json'),'registry_records':[hr[r['id']] for r in e.get('source_refs',[])],'penetration_source_refs':e.get('penetration_source_refs',[])}
FLAGS=['silicones','mineral_oil','drying_alcohol','fragrance','scalp_active_botanicals']
STD='docs/research/oil-inci/v1.0/02_classification-standard-v0.8.md'
EU='https://webgate.ec.europa.eu/reqs2/public/v2/requirement/auxi/eu/32009R1223_spcosmet_annex_3.pdf'
UV='https://promo.basf.com/campaign/EMB/AR/BROCHURE%20FILTROS%20UV%20ES%20Y%20PT%20shop.pdf'
new={}
def add(name,roles,refs=None,positive=None,uv=False,notes=None):
 e={'canonical_name':name,'aliases':[],'roles':roles,'flags':{k:{'value':False,'matches':[],'reviewed_exclusions':['Exact identity reviewed against the five closed families in the current method; this form is not a recognized match. No substring inference.']} for k in FLAGS},'uv_filter':uv,'penetration_evidence':'not_assessed','admitted_penetration_anchor':False,'penetration_form_exclusions':[],'penetration_notes':'No admitted penetration evidence for this exact form; this is not a negative inference.','penetration_source_refs':[],'notes':notes or 'Qualitative ingredient function only; no concentration, grade, finished-form retention or performance established.','source_refs':[]}
 for k in positive or []:e['flags'][k]={'value':True,'matches':[name],'reviewed_exclusions':[]}
 new[name]=e; origin[name]={'new_review':True,'reviewed_at':'2026-10-12','source_refs':refs or [{'ref':STD,'claim_supported':'Literal identity is retained with functions not assessed. Five closed-family exclusions reviewed; no plant extract converted to an essential oil.'}]}
add('ALCOHOL',['solvent_alcohol'],[{'url':'https://www.fda.gov/cosmetics/cosmetics-labeling-claims/alcohol-free','claim_supported':'Cosmetic label Alcohol denotes ethanol; distinct from fatty alcohols.'}],['drying_alcohol'])
add('DIBUTYL ADIPATE',['defined_ester_emollient','solvent'],[{'url':'https://promo.basf.com/campaign/Projetos/CaringForYou/Documentos/Cuidados%20de%20la%20Piel/Cetiol%C2%AE%20B.pdf','claim_supported':'BASF identifies exact INCI and di-n-butyl adipate ester, emollient and crystalline-filter solvent functions.'}])
add('BRASSICA CAMPESTRIS SEED OIL',['intact_botanical_fixed_oil'],[{'url':'https://docs.newdirectionsaromatics.com/msds/MSDS_CanolaOrganicCarrierOil.pdf','claim_supported':'Supplier exact botanical/INCI identity and whole carrier oil.'}])
for n in ['ETHYLHEXYL TRIAZONE','DIETHYLAMINO HYDROXYBENZOYL HEXYL BENZOATE']:add(n,['recognized_uv_filter'],[{'url':UV,'claim_supported':'BASF exact INCI UV-filter identity; no finished-product SPF or hair efficacy inferred.'}],uv=True)
add('SODIUM CHLORIDE',['not_assessed'],notes='Literal inorganic salt identity retained. Formulation function and impact are not assessed; do not infer film, low residue or concentration.')
add('PANTHENOL',['humectant'],[{'url':'https://www.dsm-firmenich.com/protected/beauty-care/en/products/vitamins/d-panthenol.html','claim_supported':'Supplier identifies panthenol as moisturizer in skin/hair care; no stereoisomer, grade or biological activity transferred from supplied D-panthenol.'}])
for n in ['FRUCTOOLIGOSACCHARIDES','INULIN','PANTOLACTONE','TRIFOLIUM PRATENSE FLOWER EXTRACT']:add(n,['not_assessed'],notes='Literal exact identity retained; qualitative cosmetic function is not assessed here. No carrier, film, volatility, low-residue, essential-oil or active-botanical inference.')
add('ARGANIA KERNEL OIL',['not_assessed'],notes='Species-incomplete literal declaration. Do not alias to Argania Spinosa Kernel Oil or transfer an oil weight/penetration prior. Secondary contribution remains unresolved; review decisive-identity impact under the method.')
add('QUATERNIUM-95',['cationic_conditioning_clue'],[{'url':'https://www.crodabeauty.com/en-gb/products/product/1550-chromaveil','claim_supported':'Supplier describes a Quaternium-95/Propanediol blend as quaternary ammonium hair conditioner with UVA/UVB absorption; standalone exact ingredient filter assignment is not established by this blend page.'}],notes='A supplier blend identifies this quaternary ammonium component in a hair-conditioning preparation. Exact grade, molecular architecture and substantivity are not established. UV-filter gate remains false: the reviewed primary evidence describes a two-component preparation, not a standalone exact-filter proof.')
add('ARACHIS HYPOGAEA OIL',['intact_botanical_fixed_oil'],[{'url':'https://ota-oil.co.jp/business/cosmetic-materials/arachis/','claim_supported':'Manufacturer identifies exact peanut oil INCI, pressed/refined seed oil and hair-care use; no grade inferred for a finished formula.'}])
add('CANANGA ODORATA FLOWER OIL',['essential_oil','declared_fragrance_allergen'],[{'url':'https://www.indesso.com/en/our-catalog/cananga-oil','claim_supported':'Manufacturer exact INCI identifies aromatic essential flower oil.'},{'url':EU,'claim_supported':'Annex III entry347 explicitly lists Cananga Odorata Flower Oil and its collective allergen label.'}],['fragrance'],notes='Exact flower oil identity retained; parenthetical collective Oil/Extract label does not alias this oil to all extracts. Not in the closed scalp-active essential-oil family.')
add('TRIMETHYLCYCLOPENTENYL METHYLISOPENTENOL',['declared_fragrance_allergen'],[{'url':EU,'claim_supported':'Annex III entry339 identifies this exact fragrance-allergen ingredient (CAS67801-20-1).'}],['fragrance'])
for n,entry in [('DIMETHYL PHENETHYL ACETATE',334),('ISOEUGENYL ACETATE',370)]:
 add(n,['declared_fragrance_allergen'],[{'url':EU,'claim_supported':f'Annex III entry{entry} identifies this exact fragrance-allergen ingredient.'}],['fragrance'])
 origin[n]['correction_of_prior_entry']={'path':str(OLD.relative_to(ROOT)),'previous_roles':['not_assessed'],'previous_fragrance':False,'reason':'New primary exact-name review; historical dictionary left unchanged.'}
for n,e in new.items():ix[norm(n)]=e
records=[]
for g in ['a','b']:
 p=BASE.parent/f'source-staging/group-{g}.json'
 for r in load(p)['records']:records.append(r)
entries={}; mappings=[]
for r in records:
 for ing in r['ingredients']:
  raw=ing['raw_name']; key=norm(raw); assert key in ix,(raw,key)
  e=copy.deepcopy(ix[key]); name=e['canonical_name'];
  # Only case/common-name formatting normalization; Latin identity and derivative retained.
  if raw.upper()!=name and raw.upper() not in e['aliases']:e['aliases'].append(raw.upper())
  if name in entries:
   entries[name]['aliases']=sorted(set(entries[name]['aliases']+e['aliases']))
  else:entries[name]=e
  mappings.append({'case_id':r.get('case_id',r['source_key']),'rank':ing['rank'],'raw_name':raw,'canonical_name':name,'mapping_basis':'Exact reviewed name or case/parenthetical common-name normalization; plant part and preparation retained.','identity_limitation':e['notes'] if name in ['ARGANIA KERNEL OIL','CANANGA ODORATA FLOWER OIL'] else None})
registry=[]
for i,(name,e) in enumerate(sorted(entries.items()),1):
 id=f'F{i:03d}';registry.append({'id':id,'canonical_name':name,'provenance':origin[name],'closed_flags_review':{'contract':STD,'basis':'All five exact closed families reviewed. Extracts are not essential oils; glycols and aromatic alcohols do not become ethanol; oil plant-name tokens do not become silicone/mineral oil.'}})
 e.pop('alias_basis',None);e['source_refs']=[{'id':id,'claim_supported':'Reviewed exact ingredient identity/qualitative functions and limits only. Full references registered outside blind lane.'}]
 if e.get('penetration_source_refs'):e['penetration_source_refs']=[{'id':id,'claim_supported':'Exact-form admitted penetration evidence and exclusions retained from reviewed predecessor.'}]
 # Other optional provenance must never leak into neutral dictionary.
 for k in list(e):
  if k not in ['canonical_name','aliases','roles','flags','uv_filter','penetration_evidence','admitted_penetration_anchor','penetration_form_exclusions','penetration_notes','penetration_source_refs','notes','source_refs']:e.pop(k)
 e['aliases']=sorted(set(e['aliases']))
D={'version':'targeted-material-functions-v0.1','scope':'Neutral qualitative ingredient identities and functions only. Roles do not establish concentrations, grade or finished-product behavior. No product labels.','entries':list(v for k,v in sorted(entries.items()))}
save('function-dictionary.json',D)
save('function-source-registry.json',{'scope':'Outside blind lane only. Actual ingredient provenance for neutral source IDs.','reviewed_at':'2026-10-12','entries':registry})
save('normalization-mapping.json',{'scope':'Outside blind lane. Exact source ranks/raw declarations preserved; no input source file edited.','mappings':mappings})
checks={'all_tokens_mapped':len(mappings)==sum(len(r['ingredients']) for r in records),'all_five_flags_boolean':all(set(e['flags'])==set(FLAGS) and all(type(f['value']) is bool for f in e['flags'].values()) for e in entries.values()),'no_product_names_or_urls_in_neutral':not any(s in json.dumps(D).lower() for s in ['https://','nuxe','ogx','furterer','weleda']),'old_dictionary_sha256':sha(OLD),'prior_holdout_dictionary_sha256':sha(HOLD/'dictionary.json'),'unique_entries':len(entries),'mapped_occurrences':len(mappings),'new_or_primary_updated_entries':sorted(set(new)&set(entries)),'unresolved_function_entries':[e['canonical_name'] for e in entries.values() if e['roles']==['not_assessed']],'admission_caveat':'Argania Kernel Oil species incomplete and unaliased. Root decides whether this secondary contribution is material to admission. Quaternium-95 standalone exact-filter proof not established; supplied blend evidence retained as clue only.'}
assert all(checks[k] for k in ['all_tokens_mapped','all_five_flags_boolean','no_product_names_or_urls_in_neutral'])
checks['output_sha256']={f:sha(BASE/f) for f in ['function-dictionary.json','function-source-registry.json','normalization-mapping.json']}
save('verification-receipt.json',checks)
print(json.dumps(checks,indent=2))
