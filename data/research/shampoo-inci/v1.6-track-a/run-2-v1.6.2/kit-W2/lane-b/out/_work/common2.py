import json, copy
K='/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/'
RANK={'high':3,'moderate':2,'low':1}
def lo(*c): return min(c,key=lambda x:RANK[x])
TIER={'ideal':3,'acceptable':2,'not_suited':1}
BUCKET={'ordinary':('normal','balanced','regular'),'oily':('dehydriert-fettig','oily','regular'),'dry':('trocken','dry','gentle'),
        'sensitive':('irritationen','irritated','gentle'),'dandruff':('schuppen','dandruff','regular')}
def t1(th,W,C):
    if th=='fine': return {'low':'ideal','moderate':'acceptable','high':'not_suited'}[W]
    if th=='normal': return {'low':'ideal','moderate':'ideal','high':'acceptable'}[W]
    if W=='high': return 'ideal'
    return 'ideal' if C=='high' else 'acceptable'
def i1(cs,d1):
    return {'low':'gentle','moderate':'regular'}.get(cs, 'clarifying' if d1 else 'regular')
def fp(bid): return json.load(open(K+'out/formula-pass/'+bid+'.json'))
def project(dp,targets,concern,d1):
    W=dp['weightPotential'];C=dp['conditioningLevel'];CS=dp['cleansingStrength']
    fits={};conf={};flags=[];notes=[]
    for th in ('fine','normal','coarse'):
        f=t1(th,W['value'],C['value']); lifted=False
        if concern and f=='not_suited': f='acceptable'; lifted=True
        if lifted: notes.append('scalp_concern_floor_applied:'+th)
        fits[th]=f
        conf[th]=W['confidence'] if th!='coarse' else lo(W['confidence'],C['confidence'])
        alts=[]
        if W['neighboringAlternative']!='none': alts.append(('W',W['neighboringAlternative'],C['value']))
        if th=='coarse' and C['neighboringAlternative']!='none': alts.append(('C',W['value'],C['neighboringAlternative']))
        for who,w,c in alts:
            g=t1(th,w,c)
            if concern and g=='not_suited': g='acceptable'
            if TIER[g]<TIER[f]:
                flags.append('review_thickness_boundary:%s (neighbor %s=%s gives %s)'%(th,'weightPotential' if who=='W' else 'conditioningLevel',w if who=='W' else c,g))
    inten=i1(CS['value'],d1)
    for t in targets:
        exp=BUCKET[t][2]
        if CS['neighboringAlternative']!='none':
            ninten=i1(CS['neighboringAlternative'],d1)
            if inten==exp and ninten!=exp: flags.append('review_intensity_boundary:'+BUCKET[t][0])
    rows=[]
    for th in ('fine','normal','coarse'):
        if fits[th] in ('ideal','acceptable'):
            for t in targets:
                rows.append({'thickness':th,'shampoo_bucket':BUCKET[t][0],'scalp_route':BUCKET[t][1],'cleansing_intensity':inten,
                  'weight':{'low':'light','moderate':'moderate','high':'heavy'}[W['value']],'tier':fits[th]})
    roles=[]
    if any(r['shampoo_bucket']=='schuppen' for r in rows): roles.append('shampoo_dandruff')
    if any(r['shampoo_bucket']!='schuppen' for r in rows): roles.append('shampoo_everyday')
    return fits,conf,flags,notes,inten,rows,roles
def dprop(p,counter,facts=None):
    d={k:p[k] for k in ('value','confidence','neighboringAlternative','rationale','ruleIds')}
    d['counterSignal']=counter
    if facts is not None: d['formulaFacts']=facts
    return d
def P(value,conf,nb,rat,rules,counter,**extra):
    d={'value':value,'confidence':conf,'neighboringAlternative':nb,'rationale':rat,'ruleIds':rules,'counterSignal':counter}
    d.update(extra); return d
def build(bid,brand,name,c_counter,k_counter,focusP,focusS,usage,sct,primary,secondary,research,d1,
          flagsExtra=(),notesExtra=(),reconc=(),unc=(),identExtra=None,thRat='',status='proposal',d1rat='No D1 term in the product name, a manufacturer/pack claim or usage directions (13.6).'):
    f=fp(bid)
    dpf=f['directProperties']
    cs=dpf['cleansingStrength'];cl=dpf['conditioningLevel'];wp=dpf['weightPotential']
    ff=f['formulaFacts']
    ident={'brand':brand,'productName':name,'packSize':f['identity']['packSize'],'market':'DE','formulaFingerprintSha256':f['inciFingerprintSha256'],
      'normalization':f['identity']['normalization'],'completeness':f['identity']['formulaCompleteness']+' (packet; formula source tier %s, identity confidence %s)'%(f['identity']['formulaSourceTier'],f['identity']['identityConfidence']),
      'e3ProminenceCutoff':f['identity']['e3ProminenceCutoff']}
    if identExtra: ident.update(identExtra)
    w={k:wp[k] for k in ('value','confidence','neighboringAlternative','evidence','depositionLoad','persistence','resetCapacity','counterevidence','whyThisBand','whyNotNeighborBand','confidenceLimitingFactor','rationale','ruleIds')}
    w['wLineRecord']=wp['wLineRecord'];w['counterSignal']=wp['counterevidence']
    w['formulaIdentifiers']={'fingerprint':f['inciFingerprintSha256'],'sourceTier':f['identity']['formulaSourceTier'],'captureDate':'not in stage-A packet (packet field absent)'}
    dp={'cleansingStrength':dprop(cs,c_counter,ff['surfactants']),'conditioningLevel':dprop(cl,k_counter,ff['conditioningRoutes']),'weightPotential':w,
        'focusPrimary':focusP,'focusSecondary':focusS,'usageRole':usage,'scalpComfortTarget':sct,'dandruffSupport':dict(dpf['dandruffSupport'],counterSignal='none (mechanical lookup, Section 11)')}
    targets=[primary['target']]+([secondary['target']] if secondary else [])
    concern=primary['target']!='ordinary'
    fits,conf,flags,notes,inten,rows,roles=project(dp,targets,concern,d1)
    flags=list(flags)+list(flagsExtra); notes=list(notes)+list(notesExtra)
    W=dp['weightPotential']
    deep='not_flagged'
    if d1 and cs['value']=='strong' and focusP['value']=='clarifying' and usage['value']=='occasional_reset': deep='flagged'
    proj={'status':status,'thicknessFit':fits,'thicknessFitConfidence':conf,
      'thicknessRationale':('T1 with W=%s (%s, neighbor %s), C=%s (%s, neighbor %s)'%(W['value'],W['confidence'],W['neighboringAlternative'],cl['value'],cl['confidence'],cl['neighboringAlternative']))
          +(('; T6 scalp-concern floor applies to targets %s'%targets) if concern else '; ordinary target, no T6')+'; T4 checked against N-ALT neighbors after T6. '+thRat,
      'weight':{'low':'light','moderate':'moderate','high':'heavy'}[W['value']],'weightConfidence':W['confidence'],
      'weightRationale':'W-LIVE: weightPotential %s -> weight %s, confidence = weightPotential confidence.'%(W['value'],{'low':'light','moderate':'moderate','high':'heavy'}[W['value']]),
      'scalpTargets':{'primary':primary,'secondary':secondary},
      'researchCombinationTargets':research,
      'cleansingIntensity':inten,'cleansingIntensityConfidence':cs['confidence'],
      'cleansingIntensityRationale':'I1: cleansingStrength %s%s -> %s. I3 checked with neighbor %s against each projected bucket expectation (%s).'%(cs['value'],' with D1 true' if d1 else ', D1 false',inten,cs['neighboringAlternative'],', '.join('%s expects %s'%(BUCKET[t][0],BUCKET[t][2]) for t in targets)),
      'explicitResetPositioning':bool(d1),'deepCleanserListing':deep,'deepCleanserListingConfidence':lo(cs['confidence'],focusP['confidence'],usage['confidence']),
      'deepCleanserRationale':d1rat+(' D2 met: deepCleanserRecord needs_record.' if deep=='flagged' else ' D2 not met -> not_flagged.'),
      'rows':rows,'requiredProtocolRoles':roles,'reviewFlags':flags,'informationalNotes':notes,
      'catalogDependent':'review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze (13.9, D2 lane visibility); not computed in the lane.'}
    if deep=='flagged': proj['deepCleanserRecord']='needs_record'
    allconf=[conf['fine'],conf['normal'],conf['coarse'],W['confidence'],primary['confidence'],cs['confidence']]+([secondary['confidence']] if secondary else [])
    for k in ('cleansingStrength','conditioningLevel','weightPotential','focusPrimary','focusSecondary','usageRole','scalpComfortTarget','dandruffSupport'):
        allconf.append(dp[k]['confidence'])
    if 'low' in allconf: proj['status']='needs_research'
    rec={'blindId':bid,'standard':'shampoo-classification-v1.6.2','lane':'lane-b','identity':ident,'directProperties':dp,'projection':proj,
      'formulaFacts':ff,'unresolvedMaterialIngredients':f['unresolvedMaterialIngredients'],
      'reconciliation':{'formulaPassFile':'out/formula-pass/%s.json (hash-pinned, unchanged)'%bid,'blindToFinalChanges':list(reconc)},
      'selfCheck':'6.11: fingerprint %s matches the stage-A packet and the formula pass; claims and identity were hidden during the formula judgment (formula pass frozen before the reveal); no ingredient, family count or position window assigned the weight band (the W-line only gated payload_lipid legs); W-line derived from the frozen list as W-LINE states, skipped candidates recorded; depositionLoad/persistence/resetCapacity present with rationales; counterevidence and whyNotNeighborBand specific (W2 addressed where two or more families); confidence names its limiting factor; no comparison with any earlier or live value was made in the lane. Projection flags recomputed mechanically from this record (T4/I3 via N-ALT).'%f['inciFingerprintSha256'],
      'uncertainties':list(unc)}
    json.dump(rec,open(K+'out/'+bid+'.json','w'),indent=1,ensure_ascii=False)
    print(bid,'| weight',proj['weight'],'| primary',primary['target'],'| secondary',secondary['target'] if secondary else None,'| fits',fits['fine'],fits['normal'],fits['coarse'],'| intensity',inten,'| deep',deep,'| combo',research,'| flags',flags,'| notes',notes,'| status',proj['status'])
def fo(value,conf,nb,verdict,moist,rep,shared,lim,role,counter,trace,rat,rules):
    return P(value,conf,nb,rat,rules,counter,careDirection={'verdict':verdict,'moistureRoutes':moist,'repairRoutes':rep,'sharedConditioningRoutes':shared,'limitation':lim},claimRole=role,decisionTrace=trace)
def sec(value,conf,nb,trace,rat,rules=('8','F2','F3','N-ALT')):
    return P(value,conf,nb,rat,list(rules),'n/a' if not value else 'see trace',decisionTrace=trace)
def us(value,conf,nb,code,evid,losing,rat):
    return P(value,conf,nb,rat,['9','U1','U2','U3','U4','CL-SRC','F-TRACE','N-ALT'],'see losing triggers' if losing else 'none',triggerCode=code,triggerEvidence=evid,losingTriggers=losing)
def tgt(t,conf,rat): return {'target':t,'confidence':conf,'rationale':rat}
