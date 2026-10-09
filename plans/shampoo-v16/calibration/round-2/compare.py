"""Round-2 lane agreement + three-way weight comparison (Aug-26 approved / v1.4 candidate / round 2)."""
import json, os
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(R, "..", "..", "..", "..")
m2 = json.load(open(os.path.join(R, "..", "round-2-mapping.json")))
names = {g["slot"]: g["name"] for g in json.load(open(os.path.join(R, "..", "..", "gold-set", "gold-set-proposal.json")))["gold"]}
names["G13"] = "Lavera Basis Sensitiv"
cand = {e["catalogProductId"]: e for e in json.load(open(os.path.join(ROOT, "data/research/shampoo-inci/v1.4-candidate/candidate.json")))["entries"]}
aug = {r["candidateId"]: r["old"] for r in json.load(open(os.path.join(ROOT, "data/research/shampoo-inci/approved-weight-consistency-v1/audit.json")))["rows"]}
v = lambda x: x.get("value") if isinstance(x, dict) else x
def fields(d):
    dp, pj = d["directProperties"], d["projection"]
    o = {k: v(dp[k]) for k in ["cleansingStrength","conditioningLevel","weightPotential","focusPrimary","usageRole","scalpComfortTarget","dandruffSupport"]}
    o["focusSecondary"] = tuple(sorted(v(dp["focusSecondary"]) or []))
    for t in ["fine","normal","coarse"]: o["fit."+t] = pj["thicknessFit"][t]
    o["weight"] = pj["weight"]; st = pj["scalpTargets"]
    o["target.primary"], o["target.secondary"] = st.get("primary"), st.get("secondary")
    o["cleansingIntensity"], o["deepCleanserListing"] = pj["cleansingIntensity"], pj["deepCleanserListing"]
    return o
tot = ag = 0; diffs = []; wt = []
for m in sorted(m2, key=lambda x: x["slot"]):
    A = fields(json.load(open(os.path.join(R, "lane-a", m["round2Id"] + ".json"))))
    B = fields(json.load(open(os.path.join(R, "lane-b", m["round2Id"] + ".json"))))
    for f in A:
        tot += 1
        if A[f] == B[f]: ag += 1
        else: diffs.append((m["slot"], names[m["slot"]][:30], f, A[f], B[f]))
    c = cand.get(m["productId"]); cid = c["candidateId"] if c else None
    wt.append((m["slot"], names[m["slot"]][:34], aug.get(cid, "–"), c["properties"]["weightPotential"]["value"] if c else "–", A["weightPotential"], B["weightPotential"]))
print(f"lane agreement {ag}/{tot} = {ag/tot:.1%}")
for d in diffs: print("  DIFF", d)
print("\nweight: slot | product | Aug-26 approved | v1.4 re-check | lane A | lane B")
for w in wt: print("  ", " | ".join(w))
