import json, copy, os

OUT = os.environ["OUT"]
OLD = os.environ["OLD"]
method = {
    "policyId": "leave-in-classification-v1.1",
    "modelVersion": "leave-in-inci-v1.1",
    "policySha256": "9c1340357b4c0cf38933340f4592250d10f2cccc1429b0e4d46508d47eee032b",
    "runbookSha256": "dce7d84982e52f5094a0b29500105d13f42c31d44e04b1871bcbef1bda5e56ca",
}
DER = "§10.1: care_direction <- §9 as amended by Standard v1.1 (T20, §9-O1–O7): only settled humectants and medium/rich-band lipids above the tail set a moisture leg; a persistent film that outranks them makes the leg subordinate."


def cd(value, conf, rationale, signals, threshold, limits):
    return {
        "value": value,
        "confidence": conf,
        "rationale": rationale,
        "evidenceSignals": signals,
        "derivation": DER,
        "thresholdReasoning": threshold,
        "limitations": limits,
    }


common_limits = [
    "§9's ceiling caps a formula-only direction at moderate confidence.",
    "T20 compares ranks on one list only; it states no percentage, ratio or dose (G4).",
    "Single-lane re-derivation (2026-10-09) from the 2026-09-18 frozen formula; not run by two independent sealed lanes (overlay §5).",
]
envs = {
    "aussie": (
        "aussie/envelope.json",
        cd(
            "balanced",
            "low",
            "§9 as amended by the v1.1 overlay (T20) resolves care_direction to `balanced` (conservative reading of film_leads_moisture_leg): DIMETHICONE r2 is a persistent L2 film that outranks every candidate directional species. v1.0 returned `moisture` (low) on Betaine r5 / Paraffinum Liquidum r3 / Macadamia oil; T20 supersedes that.",
            [
                "T20 re-derivation 2026-10-09 via deriveLeaveInCareDirectionT20",
                "evidence_level: E2",
                "evidence_scope: formula",
                "anchor row: film_leads_moisture_leg",
                "tail marker: PHENOXYETHANOL r4 (early; plausibility uncertain, recorded as assumption early_tail_marker)",
                "Film species: DIMETHICONE r2 (persistent). Candidate directional species: PARAFFINUM LIQUIDUM r3 (mineral oil, grade unspecified; read pessimistically as a medium/rich lipid; if it were not a directional lipid the row would be film_led_neutral, still `balanced`), BETAINE r5 (settled humectant; below the r4 marker on the plausible-marker read, an ordinal-read candidate otherwise).",
                "Demoted v1.0 leg species above the tail: none (BUTYLENE GLYCOL r19 is far below; C13-14 ALKANE r8 is a volatile carrier).",
                "Positioning: dm copy 'intensive Feuchtigkeit für bis zu 100 Stunden' is a claim counter-signal only (§9 constraint 3).",
                "review triggers: moisture_leg_subordinate",
            ],
            [
                "Reading A (marker plausible, mineral oil = directional lipid): film_leads_moisture_leg, margin 1 < 2 -> `balanced`, low, review moisture_leg_subordinate.",
                "Reading B (marker plausible, mineral oil not directional): film_led_neutral -> `balanced`, moderate.",
                "Reading C (marker implausible, ordinal read): film_leads_moisture_leg, low.",
                "All three readings give `balanced`; the lowest confidence (low) is taken per the §1.1 invariant.",
            ],
            common_limits,
        ),
    ),
    "bali": (
        "bali/envelope.json",
        cd(
            "moisture",
            "moderate",
            "§9 as amended by the v1.1 overlay (T20) keeps `moisture` (moisture_led): GLYCERIN r3 is a settled humectant above the tail marker and no persistent film (L2 silicone, silicone quat, Polysilicone-29) exists anywhere in the formula, so nothing outranks it.",
            [
                "T20 re-derivation 2026-10-09 via deriveLeaveInCareDirectionT20",
                "evidence_level: E2",
                "evidence_scope: formula",
                "anchor row: moisture_led",
                "tail marker: PARFUM r6 / SODIUM BENZOATE r9 (plausible on a 25-ingredient list)",
                "Directional species above the tail: GLYCERIN r3 (settled humectant). PANTHENOL r10 sits below the marker (subordinate).",
                "Non-directional (demoted) species above the tail: COCO-CAPRYLATE r4 (dry-feel ester), GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE r5 (cationic), CETEARYL ALCOHOL r2 (fatty alcohol), CETRIMONIUM CHLORIDE r7 and DISTEAROYLETHYL HYDROXYETHYLMONIUM METHOSULFATE r8 (cationics); they feed COND/WT/PERS but never set a direction.",
                "Positioning: 'Feuchtigkeit', 'Lockendefinition', bond-repair claims are counter-signals only (§9 constraint 3).",
            ],
            [
                "O5: a DH species leads and no film competes -> `moisture`; v1.0 confidence rules unchanged (not a lone-humectant thin architecture: fatty-alcohol + cationic base present) -> moderate.",
                "T20 does not change this product's value; it is re-stated on the v1.1 pins.",
            ],
            common_limits,
        ),
    ),
    "balea": (
        "balea/revision-1/envelope.json",
        cd(
            "balanced",
            "low",
            "§9 as amended by the v1.1 overlay (T20) resolves care_direction to `balanced` (film_leads_moisture_leg): DIMETHICONE r4 (persistent film) outranks the first settled humectant GLYCERIN r6 by 2 ranks, and PROPYLENE GLYCOL r2 (a multifunctional glycol that v1.0 counted as a leg) outranks the film. v1.0 returned `moisture` (low); T20 supersedes that.",
            [
                "T20 re-derivation 2026-10-09 via deriveLeaveInCareDirectionT20",
                "evidence_level: E2",
                "evidence_scope: formula",
                "anchor row: film_leads_moisture_leg",
                "tail marker: vacuous (the preservative/fragrance system occupies the final ranks r15-r18; ordinal read applies)",
                "Film species: DIMETHICONE r4, DIMETHICONOL r12. Directional species: GLYCERIN r6 (DH), SIMMONDSIA CHINENSIS SEED OIL r8 (DL), PANTHENOL r9 (DH). Film-lead margin = 2.",
                "Demoted v1.0 leg species: PROPYLENE GLYCOL r2 (glycol; outranks the film, glycol_only_leg clause), ETHYLHEXYL STEARATE r7 (dry-feel ester), CETRIMONIUM CHLORIDE r13 (cationic).",
                "Positioning: 'Hitzeschutz', 'Blond-Reflex-System', 'geschmeidig' are counter-signals only.",
                "review triggers: glycol_only_leg, moisture_leg_subordinate",
            ],
            [
                "O3: the first directional species (r6) is outranked by the film (r4) -> `balanced`.",
                "O6: marker vacuous (not plausible) and a glycol outranks the film -> confidence `low`, routed to review (glycol_only_leg + moisture_leg_subordinate).",
            ],
            common_limits,
        ),
    ),
}
for name, (f, care) in envs.items():
    e = copy.deepcopy(json.load(open(OLD + "/" + f)))
    e["researchMethod"] = method
    e["profile"]["careDirection"] = care
    u = set(e["profile"].get("uncertainFields", []))
    u.add("care_direction")
    e["profile"]["uncertainFields"] = sorted(u)
    e["profile"]["assumptionNotes"] = list(e["profile"].get("assumptionNotes", [])) + [
        "Standard v1.1 (T20, 2026-09-29): care_direction re-derived 2026-10-09 for catalog-completeness-fill r4; every other field is carried unchanged from the 2026-09-18 v1.0 record (overlay §4: only the field whose rule changed reopens). Formula and fingerprints unchanged; sources re-verified 2026-10-09."
    ]
    os.makedirs(OUT + "/leave-in-v1.1/" + name, exist_ok=True)
    json.dump(e, open(OUT + "/leave-in-v1.1/" + name + "/envelope.json", "w"), indent=2, ensure_ascii=False)
    print(name, "written")
