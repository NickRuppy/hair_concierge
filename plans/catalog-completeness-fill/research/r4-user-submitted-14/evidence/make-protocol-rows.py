import json, copy, os

OUT = os.environ["OUT"]
OLDP = "/Users/nick/AI_work/hair_conscierge/.worktrees/catalog-assessment-completeness/plans/catalog-assessment-completeness"
CHECK = "2026-10-09"

cand = json.load(open(OLDP + "/ordinary-guidance-bindings-v1/candidate.json"))
man = json.load(open(OLDP + "/leave-in-repairs-v1/manifest.json"))
rows = []


def ev(url, typ):
    return {"sourceUrl": url, "sourceType": typ, "checkedAt": CHECK}


def set_evidence(row, v2, evid):
    row["guidance_payload"]["evidence"] = evid
    v2["evidence"] = evid


# ---------------------------------------------------------------- ordinary 8
src_updates = {
    "b761256d": dict(
        label="Syoss Intense Fullness Shampoo – Hersteller-Anwendung (syoss.de)",
        url="https://www.syoss.de/haarpflege/shampoo/syoss-intense-fullness-kraeftigendes-shampoo.html",
        text="Sanft im nassen Haar verteilen und gründlich ausspülen",
        evid=[ev("https://www.syoss.de/haarpflege/shampoo/syoss-intense-fullness-kraeftigendes-shampoo.html", "manufacturer")],
    ),
    "f8a8fd56": dict(
        label="dm Produktseite, exakte GTIN 4015100860481 (Anwendung) + Syoss Hersteller",
        url="https://www.dm.de/p/d/3047032/syoss-shampoo-intense-volume",
        text="Sanft im nassen Haar verteilen und ausspülen.",
        evid=[
            ev("https://www.dm.de/p/d/3047032/syoss-shampoo-intense-volume", "retailer"),
            ev("https://www.syoss.net/care/shampoo/syoss-intense-volume-deep-caring-shampoo.html", "manufacturer"),
        ],
    ),
    "88c230c5": dict(
        label="L’Oréal Paris Elvital Glycolic Gloss Ultimate Shampoo – Hersteller-Anwendung",
        url="https://www.loreal-paris.de/elvital/glycolic-gloss/shampoo",
        text="Das Elvital Glycolic Gloss Ultimate Shampoo von L’Oréal Paris auf das nasse Haar auftragen und einmassieren, danach gründlich ausspülen.",
        evid=[
            ev("https://www.loreal-paris.de/elvital/glycolic-gloss/shampoo", "manufacturer"),
            ev("https://www.dm.de/p/d/1346429/l-oreal-paris-elvital-shampoo-glycolic-gloss", "retailer"),
        ],
    ),
    "4f67cb6d": dict(
        label="Jean&Len Color Conditioner Granatapfel Rose – Hersteller-Anwendung",
        url="https://www.jeanlen.de/color-conditioner-granatapfel-rose",
        text="Nach der Haarwäsche ins feuchte Haar einmassieren und kurz einwirken lassen. Anschließend gründlich ausspülen.",
        evid=[
            ev("https://www.jeanlen.de/color-conditioner-granatapfel-rose", "manufacturer"),
            ev("https://www.dm.de/p/d/3086487/jean-und-len-conditioner-colorglow-granatapfel-rose", "retailer"),
        ],
    ),
    "62ff4f08": dict(
        label="John Frieda Frizz Ease Wunder-Reparatur Conditioner – Hersteller-Anwendung",
        url="https://www.johnfrieda.com/de-de/produkte/frizz-ease/wunder-reparatur/conditioner/",
        text="Nach dem Shampoonieren überschüssiges Wasser ausdrücken. In Längen und Spitzen einarbeiten, wo das Haar besonders pflegebedürftig ist. Ausspülen, um kräftigeres und glänzenderes Haar zu erhalten. Nach jeder Haarwäsche anwenden.",
        evid=[
            ev("https://www.johnfrieda.com/de-de/produkte/frizz-ease/wunder-reparatur/conditioner/", "manufacturer"),
            ev("https://www.dm.de/p/d/3123413/john-frieda-conditioner-frizz-ease-wunder-reparatur", "retailer"),
        ],
    ),
    "5f4f1300": dict(
        label="Neqi Diamond Glass Conditioner – Hersteller-Anwendung",
        url="https://neqi-hair.com/products/diamond-glass-conditioner",
        text="Den Conditioner nach der Haarwäsche mit DIAMOND GLASS Shampoo in die Haarlängen einmassieren. 2-3 Minuten einwirken lassen. Gründlich ausspülen.",
        evid=[
            ev("https://neqi-hair.com/products/diamond-glass-conditioner", "manufacturer"),
            ev("https://www.dm.de/p/d/3101240/neqi-conditioner-diamond-glass", "retailer"),
        ],
    ),
    "931892fb": dict(
        label="Müller Pantene Pro-V Moisture Boost Pflegespülung (Bild-/Artikel-ID 08700216939140; 800 ml Pumpspender)",
        url="https://www.mueller.de/p/pantene-pro-v-moisture-boost-pflegespuelung-PPN3150289/",
        text="In die Längen deines Haares geben. Ausspülen ODER als leave-in verwenden",
        evid=[ev("https://www.mueller.de/p/pantene-pro-v-moisture-boost-pflegespuelung-PPN3150289/", "retailer")],
    ),
    "7fb31d10": dict(
        label="Schwarzkopf GLISS Liquid Silk Spülung – Hersteller-Anwendung",
        url="https://www.schwarzkopf.de/marken/haarpflege/gliss/liquid-silk/liquid-silk-spuelung.html",
        text="Nach dem Waschen sanft im feuchten Haar verteilen. Gut ausspülen! Regelmäßig zur Haarpflege anwenden und für optimale Ergebnisse vorher das Liquid Silk Shampoo verwenden",
        evid=[
            ev("https://www.schwarzkopf.de/marken/haarpflege/gliss/liquid-silk/liquid-silk-spuelung.html", "manufacturer"),
            ev("https://www.dm.de/p/d/1430911/schwarzkopf-gliss-conditioner-liquid-silk", "retailer"),
        ],
    ),
}
for b in cand["bindings"]:
    u = src_updates[b["product_id"][:8]]
    row = copy.deepcopy(b["row"])
    v2 = copy.deepcopy(b["guidance_payload_v2"])
    set_evidence(row, v2, u["evid"])
    full = {
        "product_id": b["product_id"],
        "name": b["expected_name"],
        **{k: row[k] for k in ["category", "role", "cadence", "application_stage", "application_state", "placement", "contact_time_seconds", "rinse_action", "reapplication", "instruction_modifiers"]},
        "application_family": row["guidance_payload"]["applicationFamily"],
        "source_label": u["label"],
        "source_url": u["url"],
        "source_text": u["text"],
        "guidance_payload": row["guidance_payload"],
        "guidance_payload_v2": v2,
        "origin_of_row": "Sept draft candidate (ordinary-guidance-bindings-v1) re-verified against 2026-10-09 sources; shared category template, no bespoke steps",
    }
    rows.append(full)

# ---------------------------------------------------------------- leave-in rows
def from_manifest(pid8, role):
    for e in man["entries"]:
        if e["productId"].startswith(pid8):
            for p in e["intendedAuthority"]["product_application_protocols"]:
                if p["role"] == role:
                    return copy.deepcopy(p), e["productId"]
    raise KeyError((pid8, role))


def finish(p, pid, name, label, url, text, evid, note):
    set_evidence(p, p["guidance_payload_v2"], evid) if False else None
    p["guidance_payload"]["evidence"] = evid
    p["guidance_payload_v2"]["evidence"] = evid
    p["source_label"] = label
    p["source_url"] = url
    p["source_text"] = text
    p["product_id"] = pid
    p["name"] = name
    p["origin_of_row"] = note
    return p


# Aussie
p, pid = from_manifest("ba326dab", "post_wash_leave_in")
rows.append(
    finish(
        p, pid, "AUSSIE SOS Leave-In Haarserum 100 Hours Hydration, 160 ml",
        "dm Deutschland, exakte GTIN 8006530085724 (Anwendung)",
        "https://www.dm.de/p/d/3135991/aussie-leave-in-haarserum-100-hours-hydration",
        "Nach deiner Duschroutine oder unterwegs anwenden. Für feines bis mittleres Haar 1 mal drücken. Für dickes Haar 2 mal drücken. In den Händen verreiben und beobachten, wie es sich in Flüssigkeit verwandelt. Auf feuchtem oder trockenem Haar auftragen. Kein Ausspülen notwendig",
        [ev("https://www.dm.de/p/d/3135991/aussie-leave-in-haarserum-100-hours-hydration", "retailer")],
        "Sept manifest row, re-verified 2026-10-09 (dm MCP getProductDetails)",
    )
)
# Bali
for role in ["post_wash_leave_in", "pre_heat_protection"]:
    p, pid = from_manifest("694c4568", role)
    txt = (
        "Nach der Haarwäsche eine kleine Menge in das feuchte Haar geben – vor allem in Längen und Spitzen. Nicht ausspülen. Ideal als letzter Schritt deiner Pflegeroutine – sorgt für Definition, Schutz & Feuchtigkeit."
        if role == "post_wash_leave_in"
        else "Schützt vor äußeren Einflüssen wie UV-Strahlen, Hitze oder Luftfeuchtigkeit. Nach der Haarwäsche eine kleine Menge in das feuchte Haar geben – vor allem in Längen und Spitzen. Nicht ausspülen."
    )
    rows.append(
        finish(
            p, pid, "Bali Curls Bonding Repair Leave-In Cream N°3",
            "Bali Curls Hersteller (bali-care.com), Variante 150 ml GTIN 4262391991732",
            "https://www.bali-care.com/de-de/products/bonding-repair-leave-in-cream-n-3",
            txt,
            [ev("https://www.bali-care.com/de-de/products/bonding-repair-leave-in-cream-n-3", "manufacturer")],
            "Sept manifest row, re-verified 2026-10-09 (manufacturer page). dm listing for the same GTIN carries a different product's INCI/directions and is NOT used.",
        )
    )
# Balea
for role in ["post_wash_leave_in", "pre_heat_protection"]:
    p, pid = from_manifest("ea88a333", role)
    txt = (
        "2-3 Pumphübe zwischen den Handfächen verreiben und in die Längen und Spitzen des Haars verteilen. Nicht ausspülen."
        if role == "post_wash_leave_in"
        else "Hitzeschutz bis zu 230 °C. 2-3 Pumphübe zwischen den Handfächen verreiben und in die Längen und Spitzen des Haars verteilen. Nicht ausspülen."
    )
    ev_list = [
        ev("https://www.dm.de/p/d/3062765/balea-professional-leave-in-serum-brilliant-blond-hair-sealer", "retailer"),
        ev("https://www.duitsevoordeeldrogist.nl/balea-professional-leave-in-serum-brilliant-blond.html", "retailer"),
    ]
    note = "Sept manifest row; DE/NL wording re-verified 2026-10-09. The damp-or-dry wording (dm Italia) could not be re-verified today (JS shell) and is NOT cited in this row."
    p = finish(p, pid, "Balea Professional Brilliant Blond Hair Sealer Leave-in Serum",
               "dm Deutschland, exakte GTIN 4070765027518 (Anwendung, Hitzeschutz-Merkmal)",
               "https://www.dm.de/p/d/3062765/balea-professional-leave-in-serum-brilliant-blond-hair-sealer", txt, ev_list, note)
    rows.append(p)

# Neqi spray: rebuild from the live shared pre_heat_damp / post_wash_damp templates
def neqi(role):
    base, pid = from_manifest("694c4568", role)  # same shared-template shape (Bali) as structural base
    p = copy.deepcopy(base)
    pid = "42a2fe20-bd7e-49a3-a880-8ae89015a5c9"
    p["guidance_payload"]["guidanceKey"] = (
        "product-leave-in-%s-post-wash" % pid if role == "post_wash_leave_in" else "product-leave-in-%s-pre-heat" % pid
    )
    p["guidance_payload"]["scope"]["productId"] = pid
    p["guidance_payload_v2"]["scope"]["productId"] = pid
    return p, pid


for role in ["post_wash_leave_in", "pre_heat_protection"]:
    p, pid = neqi(role)
    txt = "Das Haar in Abschnitte unterteilen. Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen. Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen."
    if role == "pre_heat_protection":
        txt = "Styling + intensiver Hitzeschutz (bis 230°) in einem. " + txt
    rows.append(
        finish(
            p, pid, "Neqi Diamond Glass Ultimate Styling Spray",
            "Neqi Hersteller (neqi-hair.com) + dm exakte GTIN 4063528094575",
            "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray", txt,
            [ev("https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray", "manufacturer"),
             ev("https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate", "retailer")],
            "Rebuilt on the shared family templates (post_wash_damp_conditioning / pre_heat_damp), not on the archived bespoke prose of the Sept worksheet (which contained claims the sources do not make).",
        )
    )

# ---------------------------------------------------------------- mask row (TPL-MASK, live shape)
mask_pid = "e5cfad78-ea22-49a5-911a-cb1f3109fa1c"
mask_ev = [ev("https://www.jeanlen.de/haarmaske-feuchtigkeit-rosemary-ginger", "manufacturer")]
mask_row = {
    "product_id": mask_pid,
    "name": "Jean&Len Rosemary/Ginger Hair Mask Hydration Rosemary/Ginger",
    "category": "mask",
    "role": "intensive_conditioning_mask",
    "cadence": None,
    "application_stage": "post_cleanse_rinse_off",
    "application_state": None,
    "placement": "lengths_ends",
    "contact_time_seconds": None,
    "rinse_action": "rinse_out",
    "reapplication": "not_stated",
    "instruction_modifiers": [],
    "application_family": "post_shampoo_rinse_out_mask",
    "source_label": "Jean&Len Hersteller (jeanlen.de), Anwendung",
    "source_url": "https://www.jeanlen.de/haarmaske-feuchtigkeit-rosemary-ginger",
    "source_text": "Nach dem Waschen die Haarmaske Feuchtigkeit großzügig in Deine Haarlängen einmassieren, einwirken lassen und dann gründlich ausspülen. | Als Pflegeboost 5 Minuten und als Intensivpflege 30 Minuten im feuchten Haar einwirken lassen. Gründlich ausspülen.",
    "guidance_payload": {
        "role": "intensive_care",
        "scope": {"kind": "product", "category": "mask", "productId": mask_pid},
        "steps": [
            {"action": "apply_product", "stepKey": "apply-mask", "copyTemplateDe": "Das Haar nach der Wäsche sanft ausdrücken, bis es nicht mehr tropft. In Längen und Spitzen einarbeiten, den Ansatz aussparen. Mit einem grobzinkigen Kamm durchkämmen, damit jede Strähne bedeckt ist."},
            {"action": "wait", "stepKey": "wait-mask", "copyTemplateDe": "5–30 Minuten einwirken lassen."},
            {"action": "rinse", "stepKey": "rinse-mask", "copyTemplateDe": "Gründlich ausspülen."},
        ],
        "locale": "de",
        "evidence": mask_ev,
        "sequence": {"after": ["wet_cleanse"], "anchor": "post_cleanse_rinse_off", "before": [], "conflictsWith": []},
        "guidanceKey": "product-mask-" + mask_pid,
        "requirements": {"requiredCatalogFacts": [], "requiredProfileFacts": [], "requiredProtocolFacts": []},
        "protocolFacts": {"rinse": "rinse_out", "amount": None, "cautions": [], "reapplication": "none", "applicationArea": "lengths_ends", "contactTimeSeconds": None, "conditionerRelationship": "replaces_conditioner"},
        "schemaVersion": 1,
        "protocolVersion": 1,
        "applicationFamily": "post_shampoo_rinse_out_mask",
        "compatibleDayTypes": ["intensive_care_day"],
        "exactGuidanceRequired": True,
    },
    "guidance_payload_v2": {
        "role": "intensive_care",
        "facts": {"heat": None, "rinse": "rinse_out", "amount": None, "contactTime": {"kind": "range_seconds", "maximumSeconds": 1800, "minimumSeconds": 300}, "applicationArea": "hair_lengths_ends", "applicationState": "wet_hair", "conditionerPolicy": "replaces_conditioner"},
        "scope": {"kind": "product", "category": "mask", "productId": mask_pid},
        "evidence": mask_ev,
        "exactSteps": [],
        "sourceRole": "intensive_conditioning_mask",
        "workflowId": None,
        "cautionCodes": [],
        "contractKind": "product_pointer",
        "schemaVersion": 2,
        "applicationFamily": "post_shampoo_rinse_out_mask",
        "runtimeBlockerCode": None,
        "requiredCompanionProductId": None,
    },
    "origin_of_row": "Built on the live TPL-MASK row shape (Alterra Intensiv Repair, range_seconds). Two stated dwell times (5 min Pflegeboost / 30 min Intensivpflege) expressed as the range 300-1800 s.",
}
rows.append(mask_row)

os.makedirs(OUT + "/proposal", exist_ok=True)
json.dump(rows, open(OUT + "/proposal/protocol-rows.json", "w"), indent=2, ensure_ascii=False)
print(len(rows), "rows")
