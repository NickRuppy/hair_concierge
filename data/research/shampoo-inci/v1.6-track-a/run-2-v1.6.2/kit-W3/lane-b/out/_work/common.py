def focus(value, conf, nb, verdict, mo, re, sh, lim, role, counter, trace, rat, rules):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb,
            "careDirection": {"verdict": verdict, "moistureRoutes": mo, "repairRoutes": re, "sharedConditioningRoutes": sh, "limitation": lim},
            "claimRole": role, "counterSignal": counter, "decisionTrace": trace, "rationale": rat, "ruleIds": rules}

def sec(value, conf, nb, trace, rat, rules=["8", "F2", "F3"]):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "decisionTrace": trace, "rationale": rat, "ruleIds": rules}

def usage(value, conf, nb, code, ev, losing, rat, rules=["9", "U1", "U2", "U3", "U4", "CL-SRC"]):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "triggerCode": code, "triggerEvidence": ev,
            "losingTriggers": losing, "rationale": "Default regular considered. " + rat, "ruleIds": rules}

def scalp(value, conf, nb, rat, rules=["10", "SC1", "CSA", "MB", "E2a", "E4"]):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "rationale": rat, "ruleIds": rules}

def tgt(target, conf, rat):
    return {"target": target, "confidence": conf, "rationale": rat}

CS_C1 = {"cleansingStrength": "Refatting/conditioning co-ingredients argue slightly milder; convention (C1) unchanged.",
         "conditioningLevel": "See rationale (counter-signal recorded there).",
         "weightPotential": "See counterevidence field.",
         "dandruffSupport": "None; mechanical table lookup."}
