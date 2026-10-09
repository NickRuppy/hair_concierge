"""Build sanitized lane packets + blind mapping from full freeze packets (v1.6 calibration).

Lane copies keep only classification inputs: product name/brand (positioning input),
pack size, canonical INCI, and verbatim claims/directions per source type.
They drop slot, catalog id, GTINs, URLs, conflicts, notes, confidence and fingerprints.
"""
import glob, json, os, random, re

ROOT = os.path.dirname(os.path.abspath(__file__))
FULL = os.path.join(ROOT, "packets", "full")
LANE = os.path.join(ROOT, "packets", "lane")
os.makedirs(LANE, exist_ok=True)

# Explicit, reviewed clean names: official German product names only, no research notes.
NAME_OVERRIDES = {
    "G08": "Cantu Shea Butter Cleansing Cream Shampoo",
    "G13": "Lavera Pflegeshampoo basis sensitiv Hydrate & Care",
}
# G05: catalog binds GTIN 3600542461658, which Garnier DE and dm show as the 300 ml pack (same INCI across sizes).
SIZE_OVERRIDES = {"G05": "300 ml"}

packets = [json.load(open(p)) for p in sorted(glob.glob(os.path.join(FULL, "*.json")))]
packets = [p for p in packets if p["status"] != "blocked"]
order = list(range(len(packets)))
random.Random(20261008).shuffle(order)

mapping = []
for n, idx in enumerate(order, start=1):
    p = packets[idx]
    blind = f"L{n:02d}"
    name = NAME_OVERRIDES.get(p["slot"]) or re.sub(r",\s*\d+\s*ml$", "", p["name"].split(" (")[0]).strip()
    size = SIZE_OVERRIDES.get(p["slot"]) or (re.findall(r"\d+(?:[.,]\d+)?\s*ml", str(p["packSize"])) or ["unknown"])[0]
    sources = [
        {
            "sourceType": "manufacturer" if s["sourceType"].startswith("manufacturer") else "retailer",
            "claimsVerbatim": s.get("claimsVerbatim") or "",
            "directionsVerbatim": s.get("directionsVerbatim") or "",
        }
        for s in p["sources"]
        if (s.get("claimsVerbatim") or s.get("directionsVerbatim"))
    ]
    lane = {
        "blindId": blind,
        "productName": name,
        "brand": p["brand"],
        "packSize": size,
        "canonicalInci": p["canonicalInci"],
        "positioningSources": sources,
    }
    json.dump(lane, open(os.path.join(LANE, f"{blind}.json"), "w"), ensure_ascii=False, indent=2)
    mapping.append({"blindId": blind, "slot": p["slot"], "productId": p["productId"], "fingerprint": p["inciFingerprintSha256"]})

json.dump(mapping, open(os.path.join(ROOT, "blind-mapping.json"), "w"), indent=2)
print(len(mapping), "lane packets")
