import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import build
from specs_a import SPECS as A
from specs_b import SPECS as B

specs = dict(A)
specs.update(B)
for bid in sorted(specs):
    r = build(bid, specs[bid])
    p, d = r["projection"], r["directProperties"]
    sec = p["scalpTargets"]["secondary"]
    print(bid, "W=" + p["weight"], "primary=" + p["scalpTargets"]["primary"]["target"],
          "secondary=" + (sec["target"] if sec else "none"),
          "fits=" + "/".join(p["thicknessFit"][t] for t in ("fine", "normal", "coarse")),
          "int=" + p["cleansingIntensity"], "focus=" + d["focusPrimary"]["value"], str(d["focusSecondary"]["value"]),
          "usage=" + d["usageRole"]["value"], "flags=" + str(p["reviewFlags"]), "notes=" + str(p["informationalNotes"]),
          "rct=" + str(p["researchCombinationTargets"]), "dc=" + p["deepCleanserListing"], "rows=" + str(len(p["rows"])), "status=" + p["status"])
