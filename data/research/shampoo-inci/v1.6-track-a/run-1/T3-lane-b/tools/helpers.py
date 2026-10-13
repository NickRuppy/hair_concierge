def F(v,c,r,nb,cs,care,role,trace,src): return {"value":v,"confidence":c,"rationale":r,"neighboringAlternative":nb,"counterSignal":cs,"careDirection":care,"claimRole":role,"decisionTrace":trace,"sourceIds":src}
def S(v,c,r,nb,cs,trace,src,exc=None):
    d={"value":v,"confidence":c,"rationale":r,"neighboringAlternative":nb,"counterSignal":cs,"decisionTrace":trace,"sourceIds":src}
    if exc: d["exceptionCode"]=exc
    return d
def U(v,c,r,nb,cs,code,ev,losing,src): return {"value":v,"confidence":c,"rationale":r,"neighboringAlternative":nb,"counterSignal":cs,"decisionTrace":{"default":"regular","triggerCode":code,"triggerEvidence":ev,"losingTriggers":losing,"rationale":r},"sourceIds":src}
def SC(v,c,r,nb,cs,src,facts=None):
    d={"value":v,"confidence":c,"rationale":r,"neighboringAlternative":nb,"counterSignal":cs,"sourceIds":src}
    if facts: d["formulaFacts"]=facts
    return d
def D1F(src="n/a"): return {"value":False,"confidence":"high","rationale":f"D1: no tiefenrein/deep clean/clarifying shampoo/detox-reinigung stem and no occasional-use direction in name or manufacturer/pack claims ({src})."}
NA={"verdict":"not_applicable","limitation":"Focus is not a repair/moisture decision."}
