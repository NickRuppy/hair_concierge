import json, os
KIT='/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a'
def packet(bid):
    return json.load(open(f'{KIT}/formula/{bid}.json'))
def prop(value, conf, neighbor, rationale, rules, **extra):
    d={'value':value,'confidence':conf,'neighboringAlternative':neighbor,'rationale':rationale,'ruleIds':rules}
    d.update(extra); return d
def focus_prov(verdict, moist, rep, shared, limitation, neighbor, trace_extra):
    return prop('general','low',neighbor,
      'PROVISIONAL (formula-only, claims hidden): general. No claim direction is visible in the blind pass, so no specialist focus has a claim-plus-formula case yet (7.2 "unsupported/generic claims"). Formula care-direction verdict recorded for reconciliation: '+verdict+'. '+trace_extra,
      ['3.1','7.2','7.3','F1','N-ALT'],
      careDirection={'verdict':verdict,'moistureRoutes':moist,'repairRoutes':rep,'sharedConditioningRoutes':shared,'limitation':limitation},
      claimRole='not_applicable',
      counterSignal='Claims hidden; the provisional value can change only through 3.2 reconciliation.',
      decisionTrace='Claim direction: null (blind). Formula compatible: n/a until a claim names a job. Decision: provisional general.')
def secondary_prov(neighbor):
    return {'value':[], 'confidence':'low','neighboringAlternative':neighbor,
      'decisionTrace':'Empty default considered and kept: no exact-product positioning is visible in the blind pass (Section 8 condition 1 cannot be met).',
      'rationale':'PROVISIONAL (formula-only): []. Secondary focus requires distinct exact-product positioning, hidden in the blind pass.',
      'ruleIds':['3.1','8','F3','N-ALT']}
def usage_prov(neighbor, note):
    return prop('regular','low',neighbor,
      'PROVISIONAL (formula-only): regular, the default (Section 9). Every non-default trigger needs a moderate/high-graded claim or direction (CL-SRC), hidden in the blind pass. '+note,
      ['9','U1','U2','U3','U4','CL-SRC','N-ALT'], triggerCode='none', triggerEvidence=[], losingTriggers=[])
def scalp_prov(csa, note):
    return prop('not_targeted','low','targeted',
      'PROVISIONAL (formula-only): not_targeted, because SC1 positioning (an E2 sensitive/dry claim unit graded moderate/high) cannot be seen in the blind pass. Formula half (CSA) recorded for reconciliation: '+csa+' '+note,
      ['10','CSA','SC1','E3','E4','N-ALT'])
def dandruff(active):
    if active:
        return prop('supported','high','none',
          f'supported: the complete INCI contains {active}, a recognized anti-dandruff active (Section 11 table; DS1 for selenium sulfide). Formula-only property, final in the blind pass; whether a dandruff target is projected depends on the claim (S-DANDRUFF, R17.3).',
          ['11','DS1','ID-1','N-ALT'])
    return prop('not_supported','high','none',
      'not_supported: the complete INCI contains none of Piroctone Olamine, Climbazole, Selenium Sulfide or Selenium Disulfide (Section 11 table). Formula complete per packet (ID-1).',
      ['11','DS1','ID-1','N-ALT'])
def write(bid, rec):
    p=f'{KIT}/out/formula-pass/{bid}.json'
    with open(p,'w') as f: json.dump(rec,f,indent=1,ensure_ascii=False); f.write('\n')
    print('wrote',p)
def base(bid):
    d=packet(bid)
    return {'blindId':bid,'inciFingerprintSha256':d['inciFingerprintSha256'],
      'phase':'formula-pass (blind, claims hidden)','lane':'lane-a',
      'standard':'lane copy of candidate shampoo-classification-v1.6.1 (not locked)',
      'identity':{'packSize':d['packSize'],'formulaCompleteness':d['formulaCompleteness'],'formulaSourceTier':d['formulaSourceTier'],'identityConfidence':d['identityConfidence'],
        'normalizationNote':'Packet entries already merge split synonyms (ID-2); every position cited is the normalized one-based position, identical to the packet index + 1.',
        'inciCount':len(d['canonicalInci'])}}, d
