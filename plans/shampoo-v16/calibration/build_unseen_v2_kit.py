"""Unseen-v2 sealed lane kits: 6 fresh Track B products, scrubbed standard copy (same scrub as round 2)."""
import glob, json, os, random, re, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
std = open(os.path.join(ROOT, "..", "v1.6-candidate", "classification-standard.md")).read()
std = re.sub(r"### 13\.10 Worked examples.*?(?=### 13\.11)", "", std, flags=re.S)
std = std.replace(", e.g. OGX Renewing stays visible for normal hair", "")
std = re.sub(r"\(pattern: Balea, regular-shampoo record `[^`]*` plus deep-cleanser record `[^`]*`, which owns the barcode\)", "(an existing pattern in the catalog)", std)
for name in ["head&shoulders", "Head & Shoulders", "Apple Fresh", "Syoss", "Aussie", "AUSSIE", "John Frieda", "JOHN FRIEDA", "Violet Crush", "ISANA", "Marula", "Kokosmilch", "Macadamia"]:
    assert name not in std, name
full = [json.load(open(p)) for p in sorted(glob.glob(os.path.join(ROOT, "unseen-v2", "full", "*.json")))]
order = list(range(len(full))); random.Random(20261010).shuffle(order)
mapping = []
for lane in ["lane-a", "lane-b"]:
    os.makedirs(os.path.join(OUT, lane, "packets"), exist_ok=True); os.makedirs(os.path.join(OUT, lane, "out"), exist_ok=True)
    open(os.path.join(OUT, lane, "classification-standard.md"), "w").write(std)
for n, idx in enumerate(order, start=1):
    p = full[idx]; qid = f"Q{n:02d}"
    size = (re.findall(r"\d+(?:[.,]\d+)?\s*ml", str(p["packSize"])) or ["unknown"])[0]
    pkt = {"blindId": qid, "productName": p["name"].split(" (")[0].strip().rstrip(","), "brand": p["brand"], "packSize": size,
           "canonicalInci": p["canonicalInci"],
           "positioningSources": [{"sourceType": "manufacturer" if s["sourceType"].startswith("manufacturer") else "retailer",
                                   "claimsVerbatim": s.get("claimsVerbatim") or "", "directionsVerbatim": s.get("directionsVerbatim") or ""}
                                  for s in p["sources"] if (s.get("claimsVerbatim") or s.get("directionsVerbatim"))]}
    pkt["productName"] = re.sub(r",\s*\d+\s*ml$", "", pkt["productName"])
    for lane in ["lane-a", "lane-b"]:
        json.dump(pkt, open(os.path.join(OUT, lane, "packets", qid + ".json"), "w"), ensure_ascii=False, indent=2)
    mapping.append({"blindId": qid, "slot": p["slot"], "name": p["name"]})
json.dump(mapping, open(os.path.join(ROOT, "unseen-v2", "blind-mapping.json"), "w"), ensure_ascii=False, indent=2)
print(len(mapping), "packets")
