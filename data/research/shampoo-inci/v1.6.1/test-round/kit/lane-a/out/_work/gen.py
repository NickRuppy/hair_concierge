import json,sys,copy,hashlib
sys.path.insert(0,sys.argv[1])
from proj import project,CONF,minconf,BUCKET,t1
from data import D
L=sys.argv[2]
for bid,d in D.items():
    fpath=f'{L}/out/formula-pass/{bid}.json'
    raw=open(fpath,'rb').read(); fp=json.loads(raw)
    dp={}
    for k in ['cleansingStrength','conditioningLevel','weightPotential','dandruffSupport']:
        r=copy.deepcopy(fp['directProperties'][k]); r.pop('provisional',None)
        r['counterSignal']=r.get('counterevidence') if k=='weightPotential' else d['counter'][k]
        r['blindToFinal']='unchanged from the hash-pinned formula pass (formula-only property; claims cannot move it, 3.2)'
        dp[k]=r
    for k in ['focusPrimary','focusSecondary','usageRole','scalpComfortTarget']:
        dp[k]=d[k]
    order=['cleansingStrength','conditioningLevel','weightPotential','focusPrimary','focusSecondary','usageRole','scalpComfortTarget','dandruffSupport']
    dp={k:dp[k] for k in order}
    W=dp['weightPotential'];C=dp['conditioningLevel'];CS=dp['cleansingStrength']
    p=d['proj']
    pr=project(dict(W=(W['value'],W['confidence'],W['neighboringAlternative']),C=(C['value'],C['confidence'],C['neighboringAlternative']),CS=(CS['value'],CS['confidence'],CS['neighboringAlternative']),primary=p['primary'],D1=p['D1'],notes=p['notes']))
    blockers=[f'{k} confidence low' for k in order if dp[k]['confidence']=='low']
    for k in ['scalpComfortTarget','dandruffSupport']:
        if dp[k]['value']=='unknown': blockers.append(f'{k} unknown')
    # S-FOCUS
    fv=[dp['focusPrimary']['value']]+list(dp['focusSecondary']['value'])
    flags=list(pr['flags'])
    if p['primary'] in ('dandruff','sensitive','dry') and 'scalp_active' not in fv: flags.append('review_focus_target_mismatch')
    if p['primary']=='oily' and 'clarifying' not in fv: flags.append('review_focus_target_mismatch')
    if 'scalp_active' in fv and p['primary']=='ordinary': flags.append('review_focus_target_mismatch')
    if p['primary'] in ('sensitive','dry') and CS['value']=='strong': flags.append('review_strong_cleansing_comfort_route')
    D1=p['D1']
    deep='flagged' if (CS['value']=='strong' and dp['focusPrimary']['value']=='clarifying' and dp['usageRole']['value']=='occasional_reset' and D1) else 'not_flagged'
    if D1 and CS['value']=='strong' and deep=='not_flagged': flags.append('review_reset_positioning_mismatch')
    tconf=p['targetConf']
    projected_low=[n for n,c in [('weight',W['confidence']),('scalpTarget',tconf)]+[('fit_'+t,pr['fc'][t]) for t in pr['fc']] if c=='low']
    status='needs_research' if (blockers or projected_low) else ('proposal_blocked_by_review_flags' if flags else 'proposal')
    exp=BUCKET[p['primary']][2]
    th_r=(f"T1 with W={W['value']} (neighbor {W['neighboringAlternative']}), C={C['value']} (neighbor {C['neighboringAlternative']}): "
          +', '.join(f"{t} {t1(t,W['value'],C['value'])}" for t in ['fine','normal','coarse'])
          +(f"; T6 floor applies (scalp-concern target {p['primary']})" if p['primary']!='ordinary' else '; ordinary target, no T6')
          +'; T4 checked against the N-ALT neighbors after T6; thickness claims never change fit (T2).')
    intens_conf=CS['confidence'] if pr['inten']!='clarifying' else minconf(CS['confidence'],'high')
    out={
     'blindId':bid,
     'identity':{'brand':d['brand'],'productName':d['productName'],'packSize':d['packSize'],'market':'DE',
        'formulaFingerprintSha256':fp['inciFingerprintSha256'],'normalization':fp['formulaBlock']['normalization'],
        'completeness':fp['formulaBlock']['completeness'],'e3ProminenceCutoff':fp['formulaBlock']['e3Point'],
        'formulaSourceTier':fp['formulaBlock']['formulaSourceTier'],'identityConfidence':fp['formulaBlock']['identityConfidence'],
        'identityNotes':d['identityNotes'],
        'formulaPassRecord':{'path':f'lane-a/out/formula-pass/{bid}.json','sha256':hashlib.sha256(raw).hexdigest()}},
     'directProperties':dp,
     'formulaFacts':fp['formulaFacts'],
     'unresolvedMaterialIngredients':fp['unresolvedMaterialIngredients'],
     'claimUnitsAndGrades':d['claimUnits'],
     'reconciliation':d['reconciliation'],
     'projection':{
       'status':status,'statusReasons':blockers+projected_low,
       'thicknessFit':pr['fits'],'thicknessFitConfidence':pr['fc'],'thicknessRationale':th_r,
       'weight':pr['weight'],'weightConfidence':W['confidence'],
       'weightRationale':f"W-LIVE: weightPotential {W['value']} -> {pr['weight']}, confidence {W['confidence']}.",
       'scalpTargets':{'primary':{'target':p['primary'],'confidence':tconf,'rationale':p['targetRationale']},'secondary':None},
       'researchCombinationTargets':p['rct'],
       'researchCombinationConfidence':p.get('rctConf'),
       'cleansingIntensity':pr['inten'],'cleansingIntensityConfidence':intens_conf,
       'cleansingIntensityRationale':f"I1: cleansingStrength {CS['value']} with D1 {str(D1).lower()} -> {pr['inten']}; bucket expects {exp}"+(' (amber row, I2)' if pr['inten']!=exp else ' (match)')+f"; I3 neighbor {CS['neighboringAlternative']}.",
       'explicitResetPositioning':D1,'explicitResetEvidence':p['D1evidence'],
       'deepCleanserListing':deep,'deepCleanserRecord':'needs_record' if deep=='flagged' else None,
       'deepCleanserListingConfidence':minconf(CS['confidence'],dp['focusPrimary']['confidence'],dp['usageRole']['confidence']),
       'deepCleanserRationale':('D2 met' if deep=='flagged' else ('D1 true but cleansingStrength '+CS['value']+': D3 ordinary-strength, no deep-cleanser entry (R16.3)' if D1 and CS['value']!='strong' else 'D2 not met (D1 false)')),
       'rows':pr['rows'],'requiredProtocolRoles':pr['roles'],
       'reviewFlags':flags,'informationalNotes':pr['notes'],
       'catalogDependent':'review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; lanes never see catalog ids.'},
     'selfCheck':('6.11: fingerprint matches the frozen packet; claims and labels were hidden during the formula pass (frozen before reveal, sha256 above); no ingredient, family count or position window assigned the weight band, the W-line only gated payload_lipid legs; the W-line was derived from the frozen list and every skipped candidate is recorded; depositionLoad/persistence/resetCapacity present; counterevidence and whyNotNeighborBand are specific; confidence names its limiting factor; no comparison with earlier values was made in this lane. '
                  'Projection derived mechanically from final properties (T1/T6/T4, W-LIVE, I1/I3, D1-D3, 13.7, 13.8); N-ALT neighbors consistent with confidences.'),
     'uncertainties':d['uncertainties']+fp['uncertainties']}
    json.dump(out,open(f'{L}/out/{bid}.json','w'),ensure_ascii=False,indent=1)
    print(bid,status,pr['weight'],p['primary'],pr['fits'],flags,pr['notes'][:0],pr['inten'],deep)
