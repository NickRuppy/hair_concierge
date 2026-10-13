import json, os
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANE = os.path.dirname(OUT)
BUCKET = {"ordinary":("normal","balanced","regular"),"oily":("dehydriert-fettig","oily","regular"),
          "dry":("trocken","dry","gentle"),"sensitive":("irritationen","irritated","gentle"),"dandruff":("schuppen","dandruff","regular")}
RANK = {"ideal":2,"acceptable":1,"not_suited":0}
CONFR = {"low":0,"moderate":1,"high":2}
def t1(th, W, C):
    if th=="fine": return {"low":"ideal","moderate":"acceptable","high":"not_suited"}[W]
    if th=="normal": return {"low":"ideal","moderate":"ideal","high":"acceptable"}[W]
    if W=="high": return "ideal"
    return "ideal" if C=="high" else "acceptable"
def t6(f, concern): return "acceptable" if (concern and f=="not_suited") else f
def intensity(cs, d1):
    return {"low":"gentle","moderate":"regular"}.get(cs, "clarifying" if d1 else "regular")
def minconf(*c): return min(c, key=lambda x: CONFR[x])

def build(bid, spec):
    fp = json.load(open(os.path.join(OUT,"formula-pass",bid+".json")))
    dp = fp["directProperties"]
    props = {}
    for k in ["cleansingStrength","conditioningLevel","weightPotential","dandruffSupport"]:
        r = dict(dp[k]); r.pop("provisional",None)
        r.setdefault("sourceIds",["formula:"+fp["inciFingerprintSha256"][:12]])
        if k=="dandruffSupport": r.setdefault("counterSignal","Mechanical INCI check (Section 11); botanicals, salicylic acid or claims never change it.")
        props[k] = r
    for k in ["focusPrimary","focusSecondary","usageRole","scalpComfortTarget"]:
        props[k] = spec[k]
    # formula facts with positions for every property
    facts = fp["formulaFacts"]
    for k,r in props.items():
        r.setdefault("formulaFacts", spec.get("facts",{}).get(k, facts if k in ("cleansingStrength","conditioningLevel","weightPotential") else []))
        assert r.get("counterSignal"), (bid,k)
        nb = r.get("neighboringAlternative")
        if r["confidence"]=="high": assert nb in ("none",None) , (bid,k,nb); r["neighboringAlternative"]="none"
        else: assert nb not in ("none",None), (bid,k)
    W=props["weightPotential"]["value"]; C=props["conditioningLevel"]["value"]; CS=props["cleansingStrength"]["value"]
    Wn=props["weightPotential"]["neighboringAlternative"]; Cn=props["conditioningLevel"]["neighboringAlternative"]; CSn=props["cleansingStrength"]["neighboringAlternative"]
    Wc=props["weightPotential"]["confidence"]; Cc=props["conditioningLevel"]["confidence"]; CSc=props["cleansingStrength"]["confidence"]
    tg = spec["targets"]; prim = tg["primary"]["target"]; sec = tg.get("secondary")
    concern = prim!="ordinary"
    flags = list(spec.get("flags",[])); notes = list(spec.get("notes",[]))
    ths=[]
    for th in ["fine","normal","coarse"]:
        base=t1(th,W,C); fin=t6(base,concern)
        if fin!=base: notes.append({"code":"scalp_concern_floor_applied","detail":th})
        alts=[]
        if Wn!="none": alts.append(("weightPotential",Wn,t6(t1(th,Wn,C),concern)))
        if th=="coarse" and Cn!="none": alts.append(("conditioningLevel",Cn,t6(t1(th,W,Cn),concern)))
        lower=[a for a in alts if RANK[a[2]]<RANK[fin]]
        if lower: flags.append({"code":"review_thickness_boundary","detail":f"{th}: {fin} -> {lower[0][2]} if {lower[0][0]}={lower[0][1]} (T4)"})
        conf = Wc if th!="coarse" else minconf(Wc,Cc)
        rat = f"T1: W {W}" + (f", C {C}" if th=="coarse" else "") + f" -> {base}" + (f"; T6 lifts to {fin}" if fin!=base else "") + f". Confidence = lowest T1 input ({conf})." + (" T4: "+"; ".join(f"neighbor {a[0]}={a[1]} would give {a[2]}" for a in alts) if alts else " No T4 neighbor (high-confidence inputs).")
        ths.append({"thickness":th,"fit":fin,"t1Fit":base,"confidence":conf,"rationale":rat})
    weight={"value":{"low":"light","moderate":"moderate","high":"heavy"}[W],"confidence":Wc,"rationale":f"W-LIVE: weightPotential {W} -> 1:1."}
    d1=spec["d1"]["value"]
    inten=intensity(CS,d1)
    icon = CSc if inten!="clarifying" else minconf(CSc, spec["d1"]["confidence"])
    targets=[prim]+([sec["target"]] if sec else [])
    for t in targets:
        exp=BUCKET[t][2]
        if CSn!="none" and inten==exp and intensity(CSn,d1)!=exp:
            flags.append({"code":"review_intensity_boundary","detail":BUCKET[t][0]})
    # S-FOCUS
    foc=[props["focusPrimary"]["value"]]+list(props["focusSecondary"]["value"])
    if any(t in ("dandruff","sensitive","dry") for t in targets) and "scalp_active" not in foc:
        flags.append({"code":"review_focus_target_mismatch","detail":"specialist target without scalp_active focus"})
    if "oily" in targets and "clarifying" not in foc:
        flags.append({"code":"review_focus_target_mismatch","detail":"oily target without clarifying focus"})
    if "scalp_active" in foc and prim=="ordinary" and not any(f["code"]=="review_specialist_gate_failed" for f in flags):
        flags.append({"code":"review_focus_target_mismatch","detail":"scalp_active focus with unexplained ordinary target"})
    rows=[]
    for th in ths:
        if th["fit"] in ("ideal","acceptable"):
            for t in targets:
                b,r,exp=BUCKET[t]
                rows.append({"thickness":th["thickness"],"shampoo_bucket":b,"scalp_route":r,"cleansing_intensity":inten,"weight":weight["value"],"tier":th["fit"],
                             "liveVerdictExpectation":"ideal" if (th["fit"]=="ideal" and inten==exp) else "supportive"})
    roles=sorted({"shampoo_dandruff" if r["shampoo_bucket"]=="schuppen" else "shampoo_everyday" for r in rows})
    dcl = spec.get("deepCleanserListing",{"value":"not_flagged"})
    proj={"thicknesses":ths,"weight":weight,
          "scalpTargets":{"primary":tg["primary"],"secondary":sec},
          "observedCleansingIntensity":{"value":inten,"confidence":icon,"rationale":f"I1: cleansingStrength {CS}"+(" with D1 true" if d1 else "")+f" -> {inten}."},
          "explicitResetPositioning":spec["d1"],
          "deepCleanserListing":dcl,
          "rows":rows,"requiredProtocolRoles":roles,
          "reviewFlags":flags,"informationalNotes":notes,
          "researchCombinationTargets":spec.get("rct",{"value":[]}),
          "catalogDependentFieldsNotComputed":["review_live_value_differs (requires live rows; orchestrator after freeze)"]}
    if dcl["value"]=="flagged": proj["deepCleanserListing"]["deepCleanserRecord"]="needs_record"
    allconf=[r["confidence"] for r in props.values()]+[t["confidence"] for t in ths]+[weight["confidence"],icon,tg["primary"]["confidence"]]+([sec["confidence"]] if sec else [])
    status = "needs_research" if "low" in allconf else "classified"
    rec={"blindId":bid,"inciFingerprintSha256":fp["inciFingerprintSha256"],"policy":"shampoo-classification-v1.6",
         "identity":spec["identity"],"normalizationNote":fp["normalizationNote"],
         "claimUnitsReviewed":spec["claims"],
         "directProperties":props,
         "blindToFinalChanges":spec["changes"],
         "projection":proj,
         "selfCheck":{"fingerprintMatchesFrozenPacket":True,"claimsHiddenDuringFormulaJudgment":True,
                      "noIngredientCountOrPositionWindowAssignedWeightBand":True,"allThreeWeightSubjudgmentsPresent":True,
                      "counterEvidenceAndWhyNotNeighborSpecific":True,"confidenceNamesLimitingUncertainty":True,
                      "noComparisonWithEarlierValuesInsideLane":True,"weightUnchangedAfterUnblind":True},
         "uncertainties":spec["uncertainties"],"status":status}
    if status=="needs_research": rec["needsResearch"]=True
    with open(os.path.join(OUT,bid+".json"),"w") as f: json.dump(rec,f,ensure_ascii=False,indent=2)
    return rec
def summary(rec):
    p=rec["directProperties"]; pr=rec["projection"]
    fits="/".join(t["fit"][:3] for t in pr["thicknesses"])
    sec=pr["scalpTargets"]["secondary"]
    return f'{rec["blindId"]} CS={p["cleansingStrength"]["value"]} CL={p["conditioningLevel"]["value"]} WP={p["weightPotential"]["value"]} FP={p["focusPrimary"]["value"]} FS={p["focusSecondary"]["value"]} U={p["usageRole"]["value"]} SC={p["scalpComfortTarget"]["value"]} DS={p["dandruffSupport"]["value"]} | fits={fits} w={pr["weight"]["value"]} tgt={pr["scalpTargets"]["primary"]["target"]}+{sec["target"] if sec else "-"} int={pr["observedCleansingIntensity"]["value"]} rct={pr["researchCombinationTargets"]["value"]} flags={[f["code"]+":"+str(f.get("detail",""))[:30] for f in pr["reviewFlags"]]} notes={[n["code"] for n in pr["informationalNotes"]]} status={rec["status"]}'
