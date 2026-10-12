"""Round-2 sealed lane kits: 13 gold products only, fresh blind ids, scrubbed standard copy."""
import json, os, random, re, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
std = open(os.path.join(ROOT, "..", "v1.6-candidate", "classification-standard.md")).read()
# Drop the non-normative worked examples (they name calibration products) and scrub product references.
std = re.sub(r"### 13\.10 Worked examples.*?(?=### 13\.11)", "", std, flags=re.S)
std = std.replace(", e.g. OGX Renewing stays visible for normal hair", "")
std = re.sub(r"\(pattern: Balea, regular-shampoo record `[^`]*` plus deep-cleanser record `[^`]*`, which owns the barcode\)", "(an existing pattern in the catalog)", std)
for name in ["Guhl", "Salthouse", "Balea", "OGX", "Hask", "Cantu", "Syoss", "Lavera", "Sebamed", "Pantene", "Fructis", "ISANA", "DERMAXPRO", "Hafermilch"]:
    assert name not in std, name
lane_dir = os.path.join(ROOT, "packets", "lane")
mapping = {m["blindId"]: m for m in json.load(open(os.path.join(ROOT, "blind-mapping.json")))}
gold = sorted(b for b, m in mapping.items() if m["slot"].startswith("G"))
random.Random(20261009).shuffle(gold)
r2map = []
for lane in ["lane-a", "lane-b"]:
    os.makedirs(os.path.join(OUT, lane, "packets"), exist_ok=True)
    os.makedirs(os.path.join(OUT, lane, "out"), exist_ok=True)
    open(os.path.join(OUT, lane, "classification-standard.md"), "w").write(std)
for n, old in enumerate(gold, start=1):
    pid = f"P{n:02d}"
    pkt = json.load(open(os.path.join(lane_dir, old + ".json")))
    pkt["blindId"] = pid
    for lane in ["lane-a", "lane-b"]:
        json.dump(pkt, open(os.path.join(OUT, lane, "packets", pid + ".json"), "w"), ensure_ascii=False, indent=2)
    r2map.append({"round2Id": pid, "round1Id": old, "slot": mapping[old]["slot"], "productId": mapping[old]["productId"]})
json.dump(r2map, open(os.path.join(ROOT, "round-2-mapping.json"), "w"), indent=2)
print(len(r2map), "products;", len(std.splitlines()), "standard lines")
