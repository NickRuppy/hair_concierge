import json, os
K = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W4/lane-a"
POLICY = "shampoo-classification-v1.6.2"

def load(bid):
    return json.load(open(f"{K}/formula/{bid}.json"))

def norm_list(d):
    L = list(d["canonicalInci"])
    if d["blindId"] == "W411":
        L = ["Aqua (Water, Eau)"] + L[2:]
    return L

def prov(value, conf, nb, rationale, rules):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb,
            "provisional": True, "rationale": rationale, "ruleIds": rules}

def write(bid, P):
    d = load(bid)
    L = norm_list(d)
    rec = {
        "blindId": bid,
        "inciFingerprintSha256": d["inciFingerprintSha256"],
        "lane": "lane-a",
        "phase": "1-blind-formula-pass",
        "policyId": POLICY,
        "formulaBlock": {
            "packSize": d.get("packSize"),
            "formulaCompleteness": d.get("formulaCompleteness"),
            "formulaSourceTier": d.get("formulaSourceTier"),
            "identityConfidence": d.get("identityConfidence"),
            "normalization": P.get("normalization", "Packet list already normalized (synonym variants are single entries); positions cited are normalized one-based positions (ID-2), identical to the packet order."),
            "normalizedInci": [f"{i}. {x}" for i, x in enumerate(L, 1)],
            "e3Point": P["e3"],
        },
        "directProperties": P["dp"],
        "formulaFacts": P["ff"],
        "unresolvedMaterialIngredients": P.get("unresolved", []),
        "notes": P.get("notes", []),
    }
    out = f"{K}/out/formula-pass/{bid}.json"
    with open(out, "w") as f:
        json.dump(rec, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("wrote", out)

def claims_pending_focus(nb, hint):
    return {"value": "general", "confidence": "low", "neighboringAlternative": nb, "provisional": True,
            "careDirection": hint,
            "claimRole": "not_applicable",
            "counterSignal": "Claims are hidden in the blind pass; focus is claim-led (7.2) and cannot be set from the formula alone.",
            "decisionTrace": "Blind pass: claim direction null (hidden). Placeholder `general` (7.1 honest fallback) until reveal; formula routes recorded for reconciliation (3.2).",
            "rationale": "Provisional (formula-only): `general` because no claim is visible; the formula care-direction verdict is recorded before claims (7.3) and the neighbor names the most plausible formula-compatible focus.",
            "ruleIds": ["3.1", "7.2", "7.3", "F1", "N-ALT"]}

def sec_pending(nb):
    return {"value": [], "confidence": "low", "neighboringAlternative": nb, "provisional": True,
            "decisionTrace": "Blind pass: empty default considered; no distinct positioning visible (claims hidden), so no secondary can be selected (Section 8).",
            "rationale": "Provisional (formula-only): `[]` — Section 8 requires distinct exact-product positioning, which is hidden in the blind pass.",
            "ruleIds": ["3.1", "8", "N-ALT"]}

def usage_pending(nb, cs, extra=""):
    return {"value": "regular", "confidence": "low", "neighboringAlternative": nb, "provisional": True,
            "triggerCode": "none", "triggerEvidence": [], "losingTriggers": [],
            "rationale": f"Provisional (formula-only): default `regular` (Section 9); every non-default trigger needs a moderate/high-graded claim or direction, all hidden in the blind pass. cleansingStrength `{cs}` fixes which triggers remain possible: {extra}",
            "ruleIds": ["9", "U1", "U2", "U3", "U4", "CL-SRC"]}

def dandruff(active):
    if active:
        return {"value": "supported", "confidence": "high", "neighboringAlternative": "none",
                "rationale": f"`supported`: complete INCI contains {active} (Section 11 table). Formula-only property; a dandruff target additionally needs a dandruff claim (S-DANDRUFF, R17.3).",
                "ruleIds": ["11", "ID-1"]}
    return {"value": "not_supported", "confidence": "high", "neighboringAlternative": "none",
            "rationale": "`not_supported`: the complete INCI contains none of Piroctone Olamine, Climbazole, Selenium Sulfide or Selenium Disulfide (Section 11, DS1).",
            "ruleIds": ["11", "DS1", "ID-1"]}

def comfort_met(routes, mb, counters=""):
    return {"value": "not_targeted", "confidence": "low", "neighboringAlternative": "targeted", "provisional": True,
            "csaRoute": routes, "mildBase": mb,
            "rationale": f"Provisional `not_targeted` (positioning half SC1 hidden in the blind pass). Formula half CSA is MET via listed prominent route(s): {routes}. MB: {mb}. {counters}If reveal shows a moderate/high-graded E2 sensitive or dry-scalp unit, the value becomes `targeted`.",
            "ruleIds": ["10", "CSA", "MB", "E3", "E4", "SC1"]}

def comfort_fail(why, mb, cand=""):
    return {"value": "not_targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "none", "mildBase": mb,
            "rationale": f"`not_targeted`, decided by the formula: CSA FAILS — {why} MB: {mb}. Without a listed prominent route and without MB, even an explicitly positioned product is `not_targeted` (Section 10), so positioning cannot change the value; a sensitive/dry claim at reveal would trigger S-FAIL with the missing route named.{cand}",
            "ruleIds": ["10", "CSA", "MB", "E3", "E4"]}
