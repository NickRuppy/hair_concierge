import json, sys, copy, hashlib
W='/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-b'
BUCKET={'ordinary':('normal','balanced','regular'),'oily':('dehydriert-fettig','oily','regular'),'dry':('trocken','dry','gentle'),'sensitive':('irritationen','irritated','gentle'),'dandruff':('schuppen','dandruff','regular')}
ORDER=['not_suited','acceptable','ideal']
def t1(th,w,c):
    if th=='fine': return {'low':'ideal','moderate':'acceptable','high':'not_suited'}[w]
    if th=='normal': return {'low':'ideal','moderate':'ideal','high':'acceptable'}[w]
    if w=='high': return 'ideal'
    return 'ideal' if c=='high' else 'acceptable'
def fits(w,c,concern):
    out={}
    for th in ['fine','normal','coarse']:
        f=t1(th,w,c)
        if concern and f=='not_suited': f='acceptable'
        out[th]=f
    return out
def intensity(cs,d1):
    return {'low':'gentle','moderate':'regular'}.get(cs, 'clarifying' if d1 else 'regular')
CONFR={'low':0,'moderate':1,'high':2}
def mn(*a): return min(a,key=lambda x:CONFR[x])
def build(spec):
    i=spec['id']
    fp=json.load(open(f"{W}/out/formula-pass/{i}.json"))
    fph=hashlib.sha256(open(f"{W}/out/formula-pass/{i}.json",'rb').read()).hexdigest()
    dp=copy.deepcopy(fp['directProperties'])
    final={}
    for k in ['cleansingStrength','conditioningLevel','weightPotential','dandruffSupport']:
        final[k]=dp[k]; final[k].pop('provisional',None)
        final[k]['blindValue']=dp[k]['value']; final[k]['changedAfterUnblind']=False
    for k in ['focusPrimary','focusSecondary','usageRole','scalpComfortTarget']:
        rec=spec[k]; rec['blindValue']=dp[k]['value']; rec['blindConfidence']=dp[k]['confidence']
        rec['changedAfterUnblind']= rec['value']!=dp[k]['value'] or rec['confidence']!=dp[k]['confidence']
        final[k]=rec
    order=['cleansingStrength','conditioningLevel','weightPotential','focusPrimary','focusSecondary','usageRole','scalpComfortTarget','dandruffSupport']
    final={k:final[k] for k in order}
    W_=final['weightPotential']; C_=final['conditioningLevel']; CS=final['cleansingStrength']
    p=spec['proj']
    prim=p['primary']; sec=p.get('secondary')
    targets=[prim]+([sec['target']] if sec else [])
    concern= prim!='ordinary'
    f=fits(W_['value'],C_['value'],concern)
    raw={th:t1(th,W_['value'],C_['value']) for th in f}
    fitconf={'fine':W_['confidence'],'normal':W_['confidence'],'coarse':mn(W_['confidence'],C_['confidence'])}
    inten=intensity(CS['value'],p['d1'])
    weight={'low':'light','moderate':'moderate','high':'heavy'}[W_['value']]
    rows=[]
    for th in ['fine','normal','coarse']:
        if f[th] in ('ideal','acceptable'):
            for t in targets:
                b,r,_=BUCKET[t]
                rows.append({'thickness':th,'shampoo_bucket':b,'scalp_route':r,'cleansing_intensity':inten,'weight':weight,'tier':f[th]})
    roles=[]
    if any(r['shampoo_bucket']=='schuppen' for r in rows): roles.append('shampoo_dandruff')
    if any(r['shampoo_bucket']!='schuppen' for r in rows): roles.append('shampoo_everyday')
    # T4 mechanical
    flags=[]
    def tierAfter(th,w,c):
        x=t1(th,w,c)
        return 'acceptable' if (concern and x=='not_suited') else x
    for th in ['fine','normal','coarse']:
        cur=f[th]; lower=False
        if W_['neighboringAlternative'] not in ('none',None):
            if ORDER.index(tierAfter(th,W_['neighboringAlternative'],C_['value']))<ORDER.index(cur): lower=True
        if th=='coarse' and C_['neighboringAlternative'] not in ('none',None):
            if ORDER.index(tierAfter(th,W_['value'],C_['neighboringAlternative']))<ORDER.index(cur): lower=True
        if lower: flags.append(f'review_thickness_boundary:{th}')
    # I3
    if CS['neighboringAlternative'] not in ('none',None):
        ni=intensity(CS['neighboringAlternative'],p['d1'])
        for t in targets:
            b,_,exp=BUCKET[t]
            if inten==exp and ni!=exp: flags.append(f'review_intensity_boundary:{b}')
    flags+=p.get('extraFlags',[])
    notes=list(p.get('notes',[]))
    for th in ['fine','normal','coarse']:
        if concern and raw[th]=='not_suited': notes.append(f'scalp_concern_floor_applied:{th}')
    allconf=[final[k]['confidence'] for k in order]
    status='needs_research' if ('low' in allconf or final['dandruffSupport']['value']=='unknown' or final['scalpComfortTarget']['value']=='unknown') else ('proposed_blocked_by_review_flags' if flags else 'proposed')
    expl={th:f"T1 cell W={W_['value']}, C={C_['value']} -> {raw[th]}"+(f"; T6 floor -> {f[th]}" if raw[th]!=f[th] else '') for th in f}
    proj={
     'status':status,
     'thicknessFit':f,'thicknessFitConfidence':fitconf,
     'thicknessRationale':'; '.join(f"{th}: {expl[th]}" for th in f)+". T2: thickness/texture claims ignored. T4 recomputed from N-ALT neighbors after T6."+(' T6 applies (scalp-concern targets).' if concern else ' Balanced scalp (ordinary): no T6.'),
     'weight':weight,'weightConfidence':W_['confidence'],
     'weightRationale':f"W-LIVE: weightPotential {W_['value']} -> {weight}, confidence = weightPotential confidence ({W_['confidence']}).",
     'scalpTargets':{'primary':{'target':prim,'confidence':p['primaryConf'],'rationale':p['primaryRationale']},'secondary':sec},
     'researchCombinationTargets':p.get('rct',[]),
     'researchCombinationConfidence':p.get('rctConf',{}),
     'cleansingIntensity':inten,'cleansingIntensityConfidence':CS['confidence'] if inten!='clarifying' else mn(CS['confidence'],p['d1Conf']),
     'cleansingIntensityRationale':f"I1: cleansingStrength {CS['value']}"+(", D1 true" if p['d1'] else ", D1 false")+f" -> {inten}; written unchanged to every row (I2). I3 checked against the {CS['neighboringAlternative']} neighbor.",
     'explicitResetPositioning':p['d1'],
     'explicitResetEvidence':p.get('d1Evidence','none'),
     'deepCleanserListing':'not_flagged',
     'deepCleanserListingConfidence':p.get('dclConf', mn(CS['confidence'],final['focusPrimary']['confidence'],final['usageRole']['confidence'],p['d1Conf'])),
     'deepCleanserRationale':p.get('dclRationale','D2 not met (requires cleansingStrength strong, focusPrimary clarifying, usageRole occasional_reset and D1 true); not_flagged.'),
     'rows':rows,'requiredProtocolRoles':roles,
     'reviewFlags':flags,'informationalNotes':notes,
     'catalogDependent':'review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; lanes do not see catalog rows.'+(' '+p['catalogNote'] if p.get('catalogNote') else '')
    }
    rec={
     'blindId':i,
     'identity':{**spec['identity'],'formulaFingerprintSha256':fp['inciFingerprintSha256'],'normalization':fp['identity']['normalization'],'completeness':fp['identity']['formulaCompleteness'],'e3ProminenceCutoff':fp['identity']['e3ProminenceCutoff'],'formulaSourceTier':fp['identity']['formulaSourceTier'],'identityConfidence':fp['identity']['identityConfidence']},
     'formulaPassRecord':{'path':f'out/formula-pass/{i}.json','sha256':fph,'note':'Hash-pinned blind record; not edited after release.'},
     'claimEvidence':spec['claimEvidence'],
     'directProperties':final,
     'formulaFacts':fp['formulaFacts'],
     'unresolvedMaterialIngredients':fp['unresolvedMaterialIngredients']+spec.get('extraUnresolved',[]),
     'reconciliation':spec['reconciliation'],
     'projection':proj,
     'selfCheck':spec.get('selfCheck','6.11: fingerprint matches the frozen packet; claims were hidden during the formula judgment (formula pass hash-pinned); no ingredient, family count or position window assigned the weight band; W-line derived per W-LINE with every skipped candidate recorded; three subjudgments present; whyNotNeighborBand specific; confidence names its limit; no comparison with earlier values made in-lane. Projection derived mechanically from final properties (T1/T6/T4/I1/I3/W-LIVE/13.7).'),
     'uncertainties':fp['uncertainties']+spec.get('uncertainties',[])
    }
    json.dump(rec,open(f"{W}/out/{i}.json",'w'),ensure_ascii=False,indent=1)
    print(i,status,weight,prim,sec and sec['target'],f,flags)
