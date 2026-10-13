"""Score the v1.6.2 test round against pre-registration.json (baseline = v1.6 Track A lane values)."""
import json,os
T="plans/shampoo-v162/test"; K=f"{T}/kit"
base=json.load(open(f"{T}/baseline-v1.6.json")); pre=json.load(open(f"{T}/pre-registration.json"))
mp={m["blindId"]:m["slot"] for m in json.load(open(f"{K}/blind-mapping.json"))}
def v(x): return x.get("value") if isinstance(x,dict) else x
def norm(x):
    dp=x.get("directProperties",x); pj=x["projection"]; st=pj.get("scalpTargets") or {}
    prim=st.get("primary"); sec=st.get("secondary")
    th=pj.get("thicknesses"); fits={t["thickness"]:t["fit"] for t in th} if isinstance(th,list) else pj.get("thicknessFit")
    flags=sorted({(f.get("code") if isinstance(f,dict) else str(f).split(":")[0]) for f in pj.get("reviewFlags",[])}-{"review_thickness_boundary","review_intensity_boundary"})
    return {**{k:v(dp.get(k)) for k in ["cleansingStrength","conditioningLevel","weightPotential","dandruffSupport","focusPrimary","usageRole","scalpComfortTarget"]},
        "weight":v(pj.get("weight")),"fits":fits,"primaryTarget":(prim.get("target") if isinstance(prim,dict) else prim),
        "secondaryTarget":(sec.get("target") if isinstance(sec,dict) else sec),"intensity":v(pj.get("observedCleansingIntensity") or pj.get("cleansingIntensity")),
        "combination":sorted(v(pj.get("researchCombinationTargets")) or []),
        "rows":sorted((r["thickness"],r["shampoo_bucket"],r["cleansing_intensity"]) for r in pj.get("rows",[])),"reviewFlags":flags}
MOVES={"G03":{"scalpComfortTarget":"targeted","primaryTarget":"sensitive","rows":[("coarse","irritationen","gentle"),("fine","irritationen","gentle"),("normal","irritationen","gentle")],"reviewFlags":[],"focusPrimary":"scalp_active"}}
for bid,slot in sorted(mp.items()):
    for L in "ab":
        got=norm(json.load(open(f"{K}/lane-{L}/out/{bid}.json")))
        lanes=base[slot]["lanes"]
        out=[]
        for k,val in got.items():
            exp=MOVES.get(slot,{}).get(k)
            if exp is not None:
                ok=(val==[tuple(r) for r in exp]) if k=="rows" else val==exp
                if not ok: out.append(f"{k}: MOVE expected {exp}, got {val}")
                continue
            allowed=[]
            for l in "ab":
                bv=lanes[l][k]
                if k=="rows": bv=sorted(tuple(r) for r in bv)
                if k=="reviewFlags": bv=sorted(set(bv)-{"review_thickness_boundary","review_intensity_boundary"})
                allowed.append(bv)
            vv=sorted(tuple(r) for r in val) if k=="rows" else val
            if vv not in allowed: out.append(f"{k}: baseline {allowed[0] if allowed[0]==allowed[1] else allowed}, got {val}")
        print(f"{slot} {bid} lane-{L}: "+("OK" if not out else " | ".join(out)))
