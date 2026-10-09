"""Unseen-v2 lane agreement (same field set as round 2)."""
import json, os
R = os.path.dirname(os.path.abspath(__file__))
mp = {m["blindId"]: m for m in json.load(open(os.path.join(R, "blind-mapping.json")))}
v = lambda x: x.get("value") if isinstance(x, dict) else x
def fields(d):
    dp, pj = d["directProperties"], d["projection"]
    o = {k: v(dp[k]) for k in ["cleansingStrength","conditioningLevel","weightPotential","focusPrimary","usageRole","scalpComfortTarget","dandruffSupport"]}
    o["focusSecondary"] = tuple(sorted(v(dp["focusSecondary"]) or []))
    for t in ["fine","normal","coarse"]: o["fit."+t] = pj["thicknessFit"][t]
    o["weight"] = pj["weight"]; st = pj["scalpTargets"]
    tv = lambda x: x.get("target") if isinstance(x, dict) else x
    o["target.primary"], o["target.secondary"] = tv(st.get("primary")), tv(st.get("secondary"))
    o["cleansingIntensity"], o["deepCleanserListing"] = pj["cleansingIntensity"], pj["deepCleanserListing"]
    return o
tot = ag = 0
for bid in sorted(mp):
    A = fields(json.load(open(os.path.join(R, "lane-a", bid + ".json")))); B = fields(json.load(open(os.path.join(R, "lane-b", bid + ".json"))))
    for f in A:
        tot += 1
        if A[f] == B[f]: ag += 1
        else: print("DIFF", bid, mp[bid]["name"][:40], f, A[f], B[f])
print(f"agreement {ag}/{tot} = {ag/tot:.1%}")
