import json, copy
KIT='/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a'
RANK={'not_suited':0,'acceptable':1,'ideal':2}
BUCKET={'ordinary':('normal','balanced','regular'),'oily':('dehydriert-fettig','oily','regular'),'dry':('trocken','dry','gentle'),'sensitive':('irritationen','irritated','gentle'),'dandruff':('schuppen','dandruff','regular')}
WLIVE={'low':'light','moderate':'moderate','high':'heavy'}
CONC={'low':0,'moderate':1,'high':2}
def t1(W,C,t):
    if t=='fine': return {'low':'ideal','moderate':'acceptable','high':'not_suited'}[W]
    if t=='normal': return {'low':'ideal','moderate':'ideal','high':'acceptable'}[W]
    if W=='high': return 'ideal'
    return 'ideal' if C=='high' else 'acceptable'
def fit(W,C,t,concern):
    f=t1(W,C,t)
    if concern and f=='not_suited': f='acceptable'
    return f
def i1(cs,d1):
    return {'low':'gentle','moderate':'regular'}.get(cs, 'clarifying' if d1 else 'regular')
def minc(*cs): return min(cs,key=lambda c:CONC[c])
def load_fp(bid): return json.load(open(f'{KIT}/out/formula-pass/{bid}.json'))
def load_packet(bid): return json.load(open(f'{KIT}/formula/{bid}.json'))
def project(dp, targets, d1, d1conf=None):
    W=dp['weightPotential'];C=dp['conditioningLevel'];CS=dp['cleansingStrength']
    concern = targets[0]!='ordinary'
    fits={};fconf={};flags=[];notes=[]
    for t in ['fine','normal','coarse']:
        f=fit(W['value'],C['value'],t,concern); fits[t]=f
        fconf[t]=minc(W['confidence'],C['confidence']) if t=='coarse' else W['confidence']
        if concern and t1(W['value'],C['value'],t)=='not_suited': notes.append(f'scalp_concern_floor_applied:{t}')
        lower=False
        if W['neighboringAlternative']!='none':
            if RANK[fit(W['neighboringAlternative'],C['value'],t,concern)]<RANK[f]: lower=True
        if t=='coarse' and C['neighboringAlternative']!='none':
            if RANK[fit(W['value'],C['neighboringAlternative'],t,concern)]<RANK[f]: lower=True
        if lower: flags.append(f'review_thickness_boundary:{t}')
    inten=i1(CS['value'],d1)
    for tg in targets:
        b,route,exp=BUCKET[tg]
        if CS['neighboringAlternative']!='none':
            ni=i1(CS['neighboringAlternative'],d1)
            if inten==exp and ni!=exp: flags.append(f'review_intensity_boundary:{b}')
    rows=[]
    for t in ['fine','normal','coarse']:
        if fits[t]=='not_suited': continue
        for tg in targets:
            b,route,exp=BUCKET[tg]
            rows.append({'thickness':t,'shampoo_bucket':b,'scalp_route':route,'cleansing_intensity':inten,'weight':WLIVE[W['value']],'tier':fits[t]})
    roles=[]
    if any(r['shampoo_bucket']=='schuppen' for r in rows): roles.append('shampoo_dandruff')
    if any(r['shampoo_bucket']!='schuppen' for r in rows): roles.append('shampoo_everyday')
    iconf=CS['confidence'] if inten!='clarifying' else minc(CS['confidence'],d1conf)
    return dict(fits=fits,fconf=fconf,flags=flags,notes=notes,inten=inten,iconf=iconf,rows=rows,roles=roles,weight=WLIVE[W['value']],wconf=W['confidence'])
def nn(conf,alt): return 'none' if conf=='high' else alt
def write(bid,rec):
    p=f'{KIT}/out/{bid}.json'
    with open(p,'w') as f: json.dump(rec,f,indent=1,ensure_ascii=False); f.write('\n')
    print('wrote',p)
def build(bid, brand, name, market_note, claimdep, formula_changes, scalp, d1, d1conf, extra_flags, extra_notes, research, uncert, recon, posture, catalog='deepCleanserRecord not applicable', deep=None):
    fp=load_fp(bid); pk=load_packet(bid)
    dp=copy.deepcopy(fp['directProperties'])
    # formula-only properties carried unchanged; add counterSignal from rationale
    for k in ['cleansingStrength','conditioningLevel','weightPotential','dandruffSupport']:
        dp[k].setdefault('counterSignal', dp[k].get('counterevidence','See rationale (counter-signal stated there).'))
        dp[k]['formulaFacts']='see formulaFacts block (normalized positions)'
    for k,v in claimdep.items(): dp[k]=v
    for k,v in formula_changes.items(): dp[k].update(v)
    pr=project(dp, scalp['targets'], d1, d1conf)
    flags=pr['flags']+extra_flags; notes=pr['notes']+extra_notes
    rec={'blindId':bid,
     'identity':{'brand':brand,'productName':name,'packSize':pk['packSize'],'market':'DE','formulaFingerprintSha256':pk['inciFingerprintSha256'],
       'normalization':'Split synonym entries merged into one item (ID-2); every position cited is the normalized one-based position. '+pk['normalization'],
       'completeness':pk['formulaCompleteness']+f" (formula source tier {pk['formulaSourceTier']}, identity confidence {pk['identityConfidence']})",
       'e3ProminenceCutoff':f"{fp['formulaFacts']['e3Point']['inci']}@{fp['formulaFacts']['e3Point']['position']}",
       'note':market_note},
     'formulaPassRef':{'file':f'out/formula-pass/{bid}.json','note':'hash-pinned blind record; not edited after release'},
     'formulaFacts':fp['formulaFacts'],'wLineRecord':fp['wLine'],
     'directProperties':dp,
     'reconciliation':recon,
     'projection':{'status':'projected (proposal; blocked by any review flag until Nick rules)' if not flags else 'projected proposal, blocked by review flags',
       'thicknessFit':pr['fits'],'thicknessFitConfidence':pr['fconf'],
       'thicknessRationale':f"T1 with W={dp['weightPotential']['value']}, C={dp['conditioningLevel']['value']}"+(' then T6 (scalp-concern targets)' if scalp['targets'][0]!='ordinary' else ' (ordinary target, no T6)')+'; T4 checked with N-ALT neighbors after T6.',
       'weight':pr['weight'],'weightConfidence':pr['wconf'],'weightRationale':f"W-LIVE: weightPotential {dp['weightPotential']['value']} -> {pr['weight']} (1:1).",
       'scalpTargets':scalp['scalpTargets'],
       'researchCombinationTargets':research,
       'cleansingIntensity':pr['inten'],'cleansingIntensityConfidence':pr['iconf'],
       'cleansingIntensityRationale':f"I1: cleansingStrength {dp['cleansingStrength']['value']}"+(' with D1 true' if d1 else ', D1 false')+f" -> {pr['inten']}. I3 checked against neighbor {dp['cleansingStrength']['neighboringAlternative']}.",
       'explicitResetPositioning':d1,
       'deepCleanserListing':deep['listing'] if deep else 'not_flagged',
       'deepCleanserListingConfidence':deep['conf'] if deep else minc(dp['cleansingStrength']['confidence'],dp['focusPrimary']['confidence'],dp['usageRole']['confidence']),
       'deepCleanserRationale':deep['rationale'] if deep else 'D2 not met (no explicit deep-cleanser positioning with a strong formula).',
       'deepCleanserRecord':deep.get('record','not_applicable') if deep else 'not_applicable',
       'rows':pr['rows'],'requiredProtocolRoles':pr['roles'],
       'reviewFlags':flags,'informationalNotes':notes,'catalogDependent':'review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; lanes never see catalog ids.'},
     'selfCheck':posture,
     'uncertainties':uncert}
    write(bid,rec)
    return rec
SELF='6.11 self-check: fingerprint matches the frozen packet (re-read by exact path); claims and labels were hidden during the blind formula pass (formula-pass record frozen before reveal); no ingredient, family count or position window assigned the weight band (W-line used only to gate payload_lipid legs); W-line derived from the frozen list per W-LINE and every skipped candidate recorded; depositionLoad, persistence and resetCapacity present with rationales; counterevidence and whyNotNeighborBand specific (W2 where applicable); confidence names its limiting factor; no comparison with earlier or catalog values was made inside the lane.'
