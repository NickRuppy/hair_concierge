"""Round-1 lane agreement: 8 direct properties + projection fields, with direction of each disagreement."""
import json, os
R = os.path.dirname(os.path.abspath(__file__))
mapping = {m["blindId"]: m for m in json.load(open(os.path.join(R, "..", "blind-mapping.json")))}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
WEIGHT = {"heavy": 0, "moderate": 1, "light": 2}  # lighter = shown to more hair types

def fields(d):
    dp, pj = d["directProperties"], d["projection"]
    v = lambda x: x.get("value") if isinstance(x, dict) else x
    out = {k: v(dp[k]) for k in ["cleansingStrength","conditioningLevel","weightPotential","focusPrimary","usageRole","scalpComfortTarget","dandruffSupport"]}
    out["focusSecondary"] = tuple(sorted(v(dp["focusSecondary"]) or []))
    for t in ["fine","normal","coarse"]: out["fit."+t] = pj["thicknessFit"][t]
    out["weight"] = pj["weight"]
    st = pj["scalpTargets"]; out["target.primary"] = st.get("primary"); out["target.secondary"] = st.get("secondary")
    out["cleansingIntensity"] = pj["cleansingIntensity"]; out["deepCleanserListing"] = pj["deepCleanserListing"]
    return out

def direction(field, a, b):
    if field.startswith("fit."): return "tier"
    if field == "weight": return "weight"
    if field == "target.secondary": return "extra_target" if (a is None) != (b is None) else "different"
    return ""

total = agree = 0; rows = []
for bid in sorted(mapping):
    A = fields(json.load(open(os.path.join(R, "lane-a", bid + ".json"))))
    B = fields(json.load(open(os.path.join(R, "lane-b", bid + ".json"))))
    for f in A:
        total += 1
        if A[f] == B[f]: agree += 1
        else: rows.append((bid, mapping[bid]["slot"], f, A[f], B[f], direction(f, A[f], B[f])))
print(f"agreement {agree}/{total} = {agree/total:.1%}")
direct = [r for r in rows if not r[2].startswith(("fit.","weight","target.","cleansingIntensity","deepCleaner"))]
for r in rows: print(r)
