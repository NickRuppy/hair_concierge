import json
K='/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/'
def packet(bid):
    return json.load(open(K+'formula/'+bid+'.json'))
def prop(value,conf,nb,rat,rules,**extra):
    d={'value':value,'confidence':conf,'neighboringAlternative':nb,'rationale':rat,'ruleIds':rules}
    d.update(extra); return d
def focus(verdict,moist,rep,shared,lim,nb,nbwhy):
    return prop('general','low',nb,
      'Provisional, formula-only (claims hidden, 3.1): no exact-product claim is visible, so no focus candidate exists and 7.2 ("unsupported/absent claims") gives general. Formula care-direction verdict: '+verdict+'. Neighbor '+nb+': '+nbwhy+' Final focus is decided only after the reveal (3.2, 7.2, F1-F7).',
      ['3.1','7.2','7.3','F1','N-ALT'],
      careDirection={'verdict':verdict,'moistureRoutes':moist,'repairRoutes':rep,'sharedConditioningRoutes':shared,'limitation':lim},
      claimRole='not_applicable',counterSignal='No claim visible in the blind pass; formula verdict only. '+lim,
      decisionTrace='Blind: claim direction null; formula verdict '+verdict+'; decision reason: no candidate claim, provisional general.')
def secondary(nb):
    return prop([],'low',nb,'Provisional, formula-only: secondary needs distinct exact-product positioning (Section 8), which is hidden in the blind pass; empty default.',['8','F2','F3','N-ALT'],
      decisionTrace='Empty default considered; no claims visible; no secondary selected.')
def usage(strong):
    nb='alternating' if strong else 'frequent'
    why=('cleansingStrength is strong, so reset intent (U4) could fire alternating' if strong else 'cleansingStrength is not strong, so explicit frequency wording (U2) could fire frequent')
    return prop('regular','low',nb,'Provisional, formula-only: usage triggers need moderate/high-graded claims or directions (Section 9, CL-SRC), hidden in the blind pass; default regular. Neighbor: '+why+'.',['9','U1','U2','U4','CL-SRC','N-ALT'],
      triggerCode='none',triggerEvidence=[],losingTriggers=[])
def write(rec):
    p=K+'out/formula-pass/'+rec['blindId']+'.json'
    pk=packet(rec['blindId'])
    assert rec['inciFingerprintSha256']==pk['inciFingerprintSha256']
    for k in ('cleansingStrength','conditioningLevel','weightPotential'):
        v=rec['directProperties'][k]; assert v['value'] and v['confidence'] and v['rationale']
        if v['confidence']=='high': assert v['neighboringAlternative']=='none',(rec['blindId'],k)
        else: assert v['neighboringAlternative']!='none',(rec['blindId'],k)
    json.dump(rec,open(p,'w'),indent=1,ensure_ascii=False)
    print('wrote',p)
def base(bid,norm,e3,extra_id=None):
    pk=packet(bid)
    ident={'packSize':pk['packSize'],'formulaCompleteness':pk['formulaCompleteness'],'formulaSourceTier':pk['formulaSourceTier'],
      'identityConfidence':pk['identityConfidence'],'normalization':norm,'e3ProminenceCutoff':e3}
    if extra_id: ident.update(extra_id)
    return {'blindId':bid,'inciFingerprintSha256':pk['inciFingerprintSha256'],'phase':'formula-pass (blind, stage A only; no reveal opened)',
      'standard':'shampoo-classification-v1.6.2','lane':'lane-b','identity':ident}
def ev(cp=(),pl=(),wr=(),si=(),pf=(),ff=(),cc=(),reset=(),hum=(),exc=(),unr=()):
    return {'cationic_polymer':list(cp),'payload_lipid':list(pl),'weak_refatter':list(wr),'silicone':list(si),'protein_film':list(pf),'film_former':list(ff),
      'cationic_conditioner':list(cc),'reset':list(reset),'humectantContext':list(hum),'excluded':list(exc),'unresolved':list(unr)}
def wline(pos,inci,classes,cap,skipped=(),codes=(),mat=(),nonmat=(),run=None):
    return {'wLine':{'position':pos,'inci':inci,'classes':list(classes)},'cap':cap,'alphabeticalRun':run,'skipped':list(skipped),'codes':list(codes),
      'payloadLipidMaterial':list(mat),'payloadLipidNonMaterial':list(nonmat)}
def weight(value,conf,nb,rat,evid,wl,dl,pe,rc,counter,why,whynot,limit,rules=('6.6','W-LINE','W2','W3','N-ALT')):
    return prop(value,conf,nb,rat,list(rules),evidence=evid,wLineRecord=wl,depositionLoad=dl,persistence=pe,resetCapacity=rc,
      counterevidence=counter,whyThisBand=why,whyNotNeighborBand=whynot,confidenceLimitingFactor=limit)
NODAND=prop('not_supported','high','none','Not supported: the complete INCI contains no Piroctone Olamine, Climbazole or Selenium (Di)Sulfide (Section 11).',['11','DS1'])
def DAND(pos): return prop('supported','high','none','Supported: the complete INCI contains Piroctone Olamine @%d, a recognized anti-dandruff active (Section 11). Formula-only; whether a dandruff target is projected depends on a dandruff claim (S-DANDRUFF, R17.3), hidden in the blind pass.'%pos,['11','S-DANDRUFF','R17.3'])
def SCT_csa_holds(how):
    return prop('not_targeted','low','targeted','Provisional, formula-only: positioning (SC1) is hidden, so the default is not_targeted. '+how+' A sensitive/dry-scalp claim graded moderate/high would make it targeted.',['10','CSA','MB','SC1','E4','N-ALT'])
def SCT_csa_fails(how):
    return prop('not_targeted','high','none','Not targeted (formula half fails, so no claim can make it targeted): '+how+' An explicitly positioned product would still be not_targeted and fail its S-SENSITIVE/S-DRY gate (S-FAIL).',['10','CSA','MB','E4','S-FAIL'])
