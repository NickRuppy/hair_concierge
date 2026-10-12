"""Track A consolidation: two sealed lanes per batch -> conservative final rows -> diff vs live + coverage.

Conservative merge (P0): a row survives only if both lanes project it; its research tier is the lower of
the two; weight is the heavier of the two; an intensity disagreement is kept as a flag. A product either
lane marks needs_research keeps its live rows unchanged (no apply). Live green/amber follows Nick's T7
ruling (2026-10-12): green iff weight is in the thickness's ideal set, otherwise amber.
"""
import glob
import json
import os
import sys
from collections import defaultdict

ROOT = sys.argv[1] if len(sys.argv) > 1 else "data/research/shampoo-inci/v1.6-track-a"
RUN = os.path.join(ROOT, "run-1")
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
WEIGHT = {"light": 0, "moderate": 1, "heavy": 2}
T7_IDEAL = {"fine": {"light"}, "normal": {"light", "moderate"}, "coarse": {"heavy"}}
BUCKET_ROUTE = {"normal": "balanced", "dehydriert-fettig": "oily", "trocken": "dry", "irritationen": "irritated", "schuppen": "dandruff"}


def val(x):
    return x.get("value") if isinstance(x, dict) else x


def lane_rows(rec):
    out = {}
    for r in rec["projection"].get("rows", []):
        out[(r["thickness"], r["shampoo_bucket"])] = r
    return out


def needs_research(rec):
    pj = rec.get("projection", {})
    return "needs_research" in (str(rec.get("status")), str(pj.get("projectionStatus")), str(pj.get("status")))


final, adjudications = {}, []
for mapping_path in sorted(glob.glob(os.path.join(RUN, "T*-blind-mapping.json"))):
    batch = os.path.basename(mapping_path).split("-")[0]
    for m in json.load(open(mapping_path)):
        a = json.load(open(os.path.join(RUN, f"{batch}-lane-a", m["blindId"] + ".json")))
        b = json.load(open(os.path.join(RUN, f"{batch}-lane-b", m["blindId"] + ".json")))
        ra, rb = lane_rows(a), lane_rows(b)
        rows, flags = {}, []
        for key in sorted(set(ra) | set(rb)):
            if key not in ra or key not in rb:
                flags.append(f"row {key} only in lane {'A' if key in ra else 'B'} -> dropped")
                continue
            x, y = ra[key], rb[key]
            tier = min(x["tier"], y["tier"], key=lambda t: TIER[t])
            weight = max(x["weight"], y["weight"], key=lambda w: WEIGHT[w])
            if x["cleansing_intensity"] != y["cleansing_intensity"]:
                flags.append(f"intensity {key}: A {x['cleansing_intensity']} / B {y['cleansing_intensity']}")
            if x["tier"] != y["tier"]:
                flags.append(f"tier {key}: A {x['tier']} / B {y['tier']} -> {tier}")
            rows[key] = {"thickness": key[0], "shampoo_bucket": key[1], "scalp_route": x["scalp_route"],
                         "cleansing_intensity": x["cleansing_intensity"], "weight": weight, "researchTier": tier,
                         "t7Tier": "ideal" if weight in T7_IDEAL[key[0]] else "acceptable"}
        nr = needs_research(a) or needs_research(b)
        final[m["productId"]] = {"slot": m["slot"], "blindId": m["blindId"], "needsResearch": nr,
                                 "rows": list(rows.values()), "flags": flags,
                                 "researchCombination": sorted(set(val(a["projection"].get("researchCombinationTargets")) or []) &
                                                               set(val(b["projection"].get("researchCombinationTargets")) or []))}
        if flags or nr:
            adjudications.append({"productId": m["productId"], "slot": m["slot"], "needsResearch": nr, "flags": flags})

live = json.load(open(os.path.join(ROOT, "live-rows-2026-10-12.json")))
live_rows, recommended = defaultdict(dict), {}
for pid, rec, th, bucket, route, intensity in live["rows"]:
    live_rows[pid][(th, bucket)] = intensity
    recommended[pid] = rec

diff = []
for pid in sorted(set(live_rows) | set(final)):
    f = final.get(pid)
    if f is None:
        diff.append({"productId": pid, "status": "not_researched (blocked or new)"}); continue
    if f["needsResearch"]:
        diff.append({"productId": pid, "slot": f["slot"], "status": "needs_research (live unchanged)"}); continue
    new = {(r["thickness"], r["shampoo_bucket"]): r for r in f["rows"]}
    old = live_rows.get(pid, {})
    added = sorted(k for k in new if k not in old)
    removed = sorted(k for k in old if k not in new)
    intensity = sorted((k, old[k], new[k]["cleansing_intensity"]) for k in new if k in old and old[k] != new[k]["cleansing_intensity"])
    amber = sorted(k for k in new if new[k]["t7Tier"] == "acceptable")
    diff.append({"productId": pid, "slot": f["slot"], "recommended": recommended.get(pid),
                 "added": added, "removed": removed, "intensityChanged": intensity, "amberUnderT7": amber,
                 "scalpConcernChange": any(k[1] != "normal" for k in added + removed)})


def coverage(rows_by_product, green_only):
    cells = defaultdict(int)
    for pid, rows in rows_by_product.items():
        if not recommended.get(pid):
            continue
        seen = set()
        for r in rows:
            if green_only and r.get("t7Tier", "ideal") != "ideal":
                continue
            seen.add((r["thickness"], BUCKET_ROUTE[r["shampoo_bucket"]]))
        for c in seen:
            cells[c] += 1
    return cells


before = {pid: [{"thickness": k[0], "shampoo_bucket": k[1]} for k in rows] for pid, rows in live_rows.items()}
after = {}
for pid in set(live_rows) | set(final):
    f = final.get(pid)
    after[pid] = before.get(pid, []) if (f is None or f["needsResearch"]) else f["rows"]
cov = {"before_any": coverage(before, False), "after_any": coverage(after, False), "after_green_t7": coverage(after, True)}

out = {"products": len(final), "adjudications": adjudications, "diff": diff,
       "coverage": {k: {f"{c[0]}×{c[1]}": n for c, n in sorted(v.items())} for k, v in cov.items()}}
json.dump(out, open(os.path.join(ROOT, "consolidation.json"), "w"), indent=1, default=str)
print(f"products {len(final)}; adjudications {len(adjudications)}; needs_research {sum(1 for f in final.values() if f['needsResearch'])}")
for th in ["fine", "normal", "coarse"]:
    print(th, {r: (cov['before_any'].get((th, r), 0), cov['after_any'].get((th, r), 0), cov['after_green_t7'].get((th, r), 0))
               for r in ["balanced", "oily", "dry", "irritated", "dandruff"]})
