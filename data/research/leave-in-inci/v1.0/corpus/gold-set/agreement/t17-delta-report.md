# T17 delta report — hard-rule audit adoption (2026-09-11)

Nick's review artifact for ruling **T17**: adoption of the seven "adopt now" items from `plans/leave-in-inci/research/hard-rule-audit.md` (the audit he commissioned right after T16), plus a new general rule, **§1.1 — "Every hard rule must fail toward review or toward the conservative value — never toward a recommendation."**

Full rule text: `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.v0.4.md` §1.1, §2.3.2, §2.4 rule 2, §3.1.1, §7.6/§8.5, §14, §21.3 row 17.
Full mechanical trace: `plans/leave-in-inci/research/gold-set/reference-key-v4/transform-notes.md` §20–21.

---

## Summary

| | Count |
|---|---|
| Products in the gold set | 13 |
| Products with a T17 change | **6** — Cantu, alverde Nutri-Care, Curlsmith, Olaplex, Kevin Murphy, Neqi |
| Products unchanged | 7 — alverde Sprühkur Express 7in1, ISANA, EVO, Maria Nila, Schwarzkopf GLISS, Redken, Balea |
| Dimension or profile **values** that moved | **0** |
| New cautions the user would see | 2 (buildup, on Cantu and Olaplex) |
| New review triggers | 5 records gain one each (Curlsmith, Kevin Murphy, Neqi); alverde Nutri-Care's trigger is renamed, not added |
| Confidence-only changes (no value change) | alverde Nutri-Care — 5 dimensions, one step down each |

**No value moved toward a recommendation on any product.** Every change below is one of: a caution the user sees *more* of, a review flag for a human to look at, or a bookkeeping correction (a superseded marker reading, a confidence step-down) that leaves the underlying dimension value exactly where it already was.

| Product | What changed | Rule |
|---|---|---|
| Cantu Leave-In Haarkur Repair Creme | + buildup caution | H6 |
| alverde Nutri-Care 2-Phasen-Sprühkur | marker reading corrected; confidence down on 5 fields; no value change | H2 |
| Curlsmith Hydrate & Plump Leave-In | marker ruled "vacuous"; new review flag | H1 |
| Olaplex N°.6 Bond Smoother | + buildup caution | H6 |
| Kevin Murphy Young.Again Oil *(excluded product, informational only)* | marker ruled "vacuous"; new review flag | H1 |
| Neqi Diamond Glass Ultimate Styling Spray | new review flag (a conflict between two rules made visible) | H9 |
| All other 7 products | **Nothing changed.** Independently re-checked, confirmed unaffected. | — |

---

## What "adopt now" means, in one paragraph each

- **H1 — the "marker separates nothing" case.** A product's ingredient list is read up to its preservative (the "tail marker") to decide what counts as real formula architecture. If that marker sits so far down the list that everything below it is just preservative, fragrance-allergen labelling or colourant — nothing else — the marker isn't telling us anything, and nothing above it may be credited *purely because* it's "above" a marker that doesn't actually separate anything real from trace material. Two products in the gold set hit this shape.
- **H2 — the allergen-list trap.** EU rules require the 26 declared fragrance allergens to be listed last on a pack. The standard used to allow that block to count as the "tail marker" — but since it's always last by law, it made the marker land in almost the same spot on every naturally-fragranced, preservative-free product, hiding the honest "we can't read a real boundary here" state. The allergen block is no longer eligible as a marker. One product hit this.
- **H6 — the "warns on the light one, not the heavy one" inversion.** The buildup-on-hair caution only fired when a formula's dominant hold-on ingredient class was in a specific group ("permanent, polymer-type" cationic). Two rich, heavy products in the set used a different group (a smaller "monomeric" cationic ingredient) that wasn't in that group — so they carried no buildup warning at all, while a much lighter product elsewhere in the set did. The caution now also fires when a product is simply heavy/rich with that kind of persistent ingredient present, closing the gap.
- **H9 — two rules disagreeing about the same ingredient.** One rule can read a given ingredient, at its exact list position, as a real contributor to a product's texture-conditioning behaviour, while a different rule reads the *same* ingredient at the *same* position as too far down the list to count as a "repair" ingredient. Both readings can be individually correct for their own question — but when it happens on the same product, a person should see it rather than have it pass silently. One product hit this.
- **H3 and H8** (rinse-direction wording, and a missing-claim heat-ingredient case) are also adopted as standing rules, but **no product in this 13-product set currently triggers either one** — they're defined and ready, the same way a couple of earlier rulings (T7, T14) were adopted before the gold set had a product to exercise them on.
- **§1.1** is a new general principle, not a product-level change: any future rule in this standard has to fail toward "ask a human" or "assume the safer reading," never toward a confident answer that oversells the product.

---

## Per-product detail

### Cantu Leave-In Haarkur Repair Creme *(H6)*

| Field | Before | After | Rule |
|---|---|---|---|
| Hinweise (internal flags) | SHN, Transfer | SHN, **Buildup**, Transfer | H6 |
| Cautions shown to a reviewer | „Legt sich spürbar aufs Haar…“, „Dazu haben wir keine belastbare Information.“ | + „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein…“ | H6 |

**Why.** This product is rich/heavy on the hair (`weight_potential: high`) and its persistence comes from Behentrimonium Methosulfate, a "monomeric" cationic ingredient — the deliberately lighter-weight persistence class the standard uses for that ingredient type. Before T17, the buildup caution only looked at persistence class, so this heavy product carried none. It now also looks at weight, and fires. Nothing about how persistent the ingredient itself is judged to be has changed.

---

### alverde Nutri-Care 2-Phasen-Sprühkur (Bio-Mandel, Bio-Argan) *(H2)*

| Field | Before | After | Rule |
|---|---|---|---|
| Tail marker | The declared fragrance-allergen block (rank 14 of 16) | **`none_visible`** — no marker readable at all | H2 |
| Review trigger | `tail_marker_allergen_block_only` | `tail_marker_none_visible` (renamed, not new) | H2 |
| Confidence (internal, not user-facing) | moderate/moderately-high on 5 dimensions | one step lower on all 5 (COND, WT, PERS, HOLD, R2) | H2 |
| Every dimension value, every fit, focus, caution the user sees | unchanged | unchanged | — |

**Why.** This product has no genuine preservative in its ingredient list; the standard used to treat the mandatory allergen-labelling block as if it were the preservative marker, which is misleading (that block is always near the end of any list, by law, whether or not the product has a real "tail"). The formula is now correctly read as having no marker at all, which is the standard's own honest fallback state — a slightly more cautious internal confidence rating, with the review flag renamed to say what's actually true. Every decisive ingredient on this record (the soy and argan oils) sits so early in the list that this correction changes nothing about what the product is judged to do.

---

### Curlsmith Hydrate & Plump Leave-In *(H1)*

| Field | Before | After | Rule |
|---|---|---|---|
| Tail marker | "very late" (rank 36 of 40) | "very late" **and now formally `vacuous`** | H1 |
| Review trigger | `very_late_tail_marker` | `tail_marker_vacuous` (renamed, not new) | H1 |
| Every dimension value, fit, focus, caution | unchanged | unchanged | — |

**Why.** Everything below this product's marker turned out to be nothing but preservatives and declared fragrance allergens — so the marker genuinely separates nothing, and the standard now says so explicitly rather than leaving it as an informal "very late" observation. We checked every ingredient this product's ratings actually rest on, and none of them depends on being credited *only because* it sits above this particular marker — the film-forming polymer near the end of the list already carried its own "this might just be a token amount" caveat before T17, unrelated to this change. Nothing moves.

---

### Olaplex N°.6 Bond Smoother *(H6)*

| Field | Before | After | Rule |
|---|---|---|---|
| Hinweise (internal flags) | SHN, R3 (bond-chemistry flag) | SHN, **Buildup**, R3 | H6 |
| Cautions shown to a reviewer | „Legt sich spürbar…“, Hitzeschutz-caution, Bond-Kategorie-caution, „Dazu haben wir…“ | + „Bleibt lange im Haar…“ (inserted after the heat caution, before the bond caution) | H6 |

**Why.** Same shape as Cantu above: rich/heavy on the hair, persistence carried by a monomeric cationic ingredient (Behentrimonium Chloride), so it previously carried no buildup warning despite being one of the heaviest products in the set. It now does.

---

### Kevin Murphy Young.Again Oil *(H1 — informational only, this product is not classified as a leave-in)*

| Field | Before | After | Rule |
|---|---|---|---|
| Tail marker | "very late" (rank 29 of 36) | "very late" **and now formally `vacuous`** | H1 |
| Review trigger | `very_late_tail_marker` | `tail_marker_vacuous` (renamed, not new) | H1 |

**Why.** This product is already excluded from the leave-in category (it's an oil, not a leave-in) — none of its ratings are ever shown to a user. Its marker's tail also turned out to hold nothing but a preservative, fragrance declaration, allergens and one colour additive, so the same H1 correction applies for the internal record, purely for audit consistency.

---

### Neqi Diamond Glass Ultimate Styling Spray *(H9)*

| Field | Before | After | Rule |
|---|---|---|---|
| Review triggers | (5 existing) | + **`species_reading_conflict`** | H9 |
| Conditioning-film reading (HOLD) | "genuine conditioning film" — unchanged | unchanged | — |
| Repair-film reading (R2) | "not a repair route, too far down the list" — unchanged | unchanged | — |

**Why.** One ingredient on this product's list — a silicone conditioning agent — is read by one rule as a real, meaningful part of the product's texture-conditioning behaviour (which is why this product isn't classified as a styling-only product), while a *different* rule reads that same ingredient, at that same list position, as too far down the list to count toward a "repair" claim. Both readings are correct on their own terms — this isn't a bug — but a person should see that the two rules land differently on the same ingredient rather than have it pass unremarked. **Neither reading changes**; a flag is simply added so a reviewer can see the divergence.

---

## Confirmation: no value moved toward a recommendation

Checked explicitly, product by product, against every rule the seven items could have touched:

- **Buildup caution (H6):** only ever *adds* a caution the user would see. Never removed, never suppressed.
- **Marker corrections (H1, H2):** in every case, we checked whether any rating on the product actually depended on the corrected marker reading for its *value* (not just its trace notes) — none did. Confidence went down on alverde Nutri-Care (more cautious, not less); no rating on any product got better.
- **Species-reading conflict (H9):** both readings kept exactly the value they already had; the flag only exposes the disagreement.
- **H3 and H8:** not exercised on this gold set at all — no product's data matches the condition either rule checks for, so nothing here could have moved regardless.

No product's recommended-for-hair-type rating, damage-fit rating, focus (what the product is "for"), or repair-support level changed on any of the 13 records.

---

## Verification

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/leave-in-research-*.test.ts` — 21/21 passing (new test: "Leave-In fixture applies the T17 hard-rule-audit items (H1/H2/H6/H9)").
- `npm run ci:verify` — typecheck, lint, build all clean (0 errors; 5 pre-existing warnings in unrelated files).
