"""Track A run 2 (locked v1.6.2): conservative lane merge (same P0 rules as consolidate.py), then the
delta against run 1 (v1.6) — the state Nick reviewed on 2026-10-12 — so only changed lines go back to him.
Usage: python3 consolidate_run2.py <kits-root> [W1 W2 ...]"""
import glob,io,json,os,sys,runpy,contextlib
from collections import defaultdict
KR=sys.argv[1]; BATCHES=sys.argv[2:] or ["W1","W2","W3","W4"]
D="data/research/shampoo-inci/v1.6-track-a"
TIER={"not_suited":0,"acceptable":1,"ideal":2}; WEIGHT={"light":0,"moderate":1,"heavy":2}
T7={"fine":{"light"},"normal":{"light","moderate"},"coarse":{"heavy"}}
def val(x): return x.get("value") if isinstance(x,dict) else x
def nr(rec):
    pj=rec.get("projection",{}); return "needs_research" in (str(rec.get("status")),str(pj.get("projectionStatus")),str(pj.get("status")))
packets={}
for p in glob.glob(f"{D}/packets/*.json"):
    x=json.load(open(p)); packets[x["slot"]]=x
final={}
for b in BATCHES:
    K=f"{KR}/kit-{b}"
    for m in json.load(open(f"{K}/blind-mapping.json")):
        a=json.load(open(f"{K}/lane-a/out/{m['blindId']}.json")); bb=json.load(open(f"{K}/lane-b/out/{m['blindId']}.json"))
        ra={(r["thickness"],r["shampoo_bucket"]):r for r in a["projection"].get("rows",[])}
        rb={(r["thickness"],r["shampoo_bucket"]):r for r in bb["projection"].get("rows",[])}
        rows,flags={},[]
        for k in sorted(set(ra)|set(rb)):
            if k not in ra or k not in rb: flags.append(f"row {k} only in lane {'A' if k in ra else 'B'} -> dropped"); continue
            x,y=ra[k],rb[k]
            w=max(x["weight"],y["weight"],key=lambda v:WEIGHT[v]); t=min(x["tier"],y["tier"],key=lambda v:TIER[v])
            if x["cleansing_intensity"]!=y["cleansing_intensity"]: flags.append(f"intensity {k}: A {x['cleansing_intensity']} / B {y['cleansing_intensity']}")
            if x["weight"]!=y["weight"]: flags.append(f"weight {k}: A {x['weight']} / B {y['weight']} -> {w}")
            rows[k]={"thickness":k[0],"shampoo_bucket":k[1],"cleansing_intensity":x["cleansing_intensity"],"weight":w,"researchTier":t,"t7Tier":"ideal" if w in T7[k[0]] else "acceptable"}
        comb=sorted(set(val(a["projection"].get("researchCombinationTargets")) or [])&set(val(bb["projection"].get("researchCombinationTargets")) or []))
        dc=[val(a["projection"].get("deepCleanserListing")),val(bb["projection"].get("deepCleanserListing"))]
        final[m["slot"]]={"productId":m["productId"],"blindId":m["blindId"],"needsResearch":nr(a) or nr(bb),"needsResearchLanes":[L for L,r in (("A",a),("B",bb)) if nr(r)],
                          "rows":rows,"flags":flags,"combination":comb,"deepCleaner":dc}
# run 1 (v1.6) for the delta
with contextlib.redirect_stdout(io.StringIO()):
    sys_argv=sys.argv; sys.argv=["x",D]; r1=runpy.run_path("plans/shampoo-v16-rollout/track-a/consolidate.py"); sys.argv=sys_argv
f1={f["slot"]:f for f in r1["final"].values()}
rec=r1["recommended"]
out=[]
for s,f in sorted(final.items()):
    o=f1.get(s); name=packets[s]["name"].split(" (")[0]
    new={k:(r["cleansing_intensity"],r["weight"],r["t7Tier"]) for k,r in f["rows"].items()}
    old={(r["thickness"],r["shampoo_bucket"]):(r["cleansing_intensity"],r["weight"],r["t7Tier"]) for r in (o["rows"] if o else [])}
    ch={"added":sorted(set(new)-set(old)),"removed":sorted(set(old)-set(new)),
        "changed":sorted((k,old[k],new[k]) for k in set(new)&set(old) if old[k]!=new[k])}
    comb_old=o["researchCombination"] if o else None
    entry={"slot":s,"name":name,"recommended":bool(rec.get(f["productId"])),"needsResearch":f["needsResearch"],"needsResearchLanes":f["needsResearchLanes"],
           "run1NeedsResearch":(o["needsResearch"] if o else "not researched"),"delta":ch,"combination":f["combination"],"combinationRun1":comb_old,"laneFlags":f["flags"]}
    if ch["added"] or ch["removed"] or ch["changed"] or f["needsResearch"]!=(o["needsResearch"] if o else None) or f["combination"]!=comb_old: out.append(entry)
json.dump({"batches":BATCHES,"products":len(final),"changed":out},open(f"{KR}/run2-delta.json","w"),indent=1,default=str,ensure_ascii=False)
print(f"products {len(final)}; changed vs run 1: {len(out)}")
for e in out:
    d=e["delta"]; print(f"{e['slot']} {'R' if e['recommended'] else '-'} {e['name'][:38]:38} +{len(d['added'])} -{len(d['removed'])} ~{len(d['changed'])} nr:{e['run1NeedsResearch']}->{e['needsResearch']} comb:{e['combinationRun1']}->{e['combination']}")
