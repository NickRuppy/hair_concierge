# Slot 7 — Maria Nila Curlicue Cream

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Curl cream with hold polymer

> **G0 verdict: `excluded_styling_first`.** This record is emitted under the §2.3.1 exclusion contract:
> identity, G0 state and rationale, `out_of_category: true`, the formula record, and **§7 dimensions marked
> `informational_and_non_authoritative: true`**. **No lean matching profile is emitted** — no `focus`, no fit fields,
> no `specialist_functions`, no cautions. The absence of fit fields is the machine-readable signal of exclusion, not
> an omission.

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Maria Nila — Curlicue Cream |
| Pack / market | 100 ml · DE |
| GTIN | **not found** — documented identity-research gap |
| Formula source | marianila.com (manufacturer), captured 2026-09-03 |
| Identity status | `verified` (formula), with an open identifier gap |
| Directions status | `captured` (English, non-German-market manufacturer page), rinse test PASS |
| Claims status | `present` (1 entry, C4, `creates_claim: false`) |
| Fingerprint | `f7c3be7bc73e173951cf965513602bba22b5271e4141fc156df44a363658db3a` |

**Claim and directions authority (§2.4.1 rule 3).** marianila.com has no German region and no German-language content
was located, so the manufacturer page is **C5**. flaconi.de is **C4**. **No C1/C2 source exists for this product.**

**Frozen claims consumed (§2.4 rule 3).**
- C4 (flaconi.de): „Wirkung: Anti-Frizz", alongside „Haartyp: Lockiges Haar" — `creates_claim: false`.
- C5 (marianila.com, English, recorded not entered): „Enhances and defines curls"; „Prevents frizz and split ends";
  „Use in damp hair to protect your hair against humidity"; the manufacturer's own „Hold 3/5".

## G0 — product-form gate → `excluded_styling_first`

**Architecture half (§2.3.2, E1/E2 from the formula) — established.**
The HOLD anchor (§7.7) returns **`meaningful_hold_route`**:
- **PVP at rank 4** is a fixative-class L5 member, present as architecture on the rank prong (marker at rank 13), in a
  film-forming context (Carbomer 10 + Triethanolamine 14 give a neutralised film-forming/rheology system).
- The conditioning architecture behind it is **thin**: no silicone of any kind; no oil, butter or ester emollient; no
  cationic polymer; no LGN pair. **Cetyl Alcohol (5) is a lone long-chain fatty alcohol with no cationic partner** —
  §7.1's note reads that as an emollient/consistency factor, not a lamellar conditioning pair. The only cationic
  species is **Quaternium-95 (11)**, an opaque quat number whose polymeric-vs-monomeric structure the INCI name does
  not settle (§7.6). The remainder above the marker is water, three glycols and two botanical extracts.
- A fixative polymer at rank 4 with that behind it is the `meaningful_hold_route` shape, not `incidental_film`.

**Positioning half — not established at C1/C2, and no C1/C2 evidence points the other way.**
The only hold/texture positioning available is C5 (the manufacturer's own „Hold 3/5", „Enhances and defines curls",
and the directions "…for a textured look… for a more controlled look") and C4 („Wirkung: Anti-Frizz",
„Haartyp: Lockiges Haar"). G13 binds the positioning half of a G0 decision exactly as it binds every other claim-keyed
decision (§2.3.2, closing v0.2's omission).

**Ordered rule applied — §2.3.2 clause 3.**
> *Architecture half established, positioning half resting only on C3–C5 sources, and no C1/C2 evidence pointing the
> other way ⇒ `excluded_styling_first`*, with the weak-tier positioning recorded as corroboration and its tier stated.

- Clause 1 does not apply (the positioning half is not at C1/C2).
- **Clause 2 does not apply**: there is **no C1/C2 evidence materially contradicting the exclusion**. The paradigm case
  clause 2 names — C1/C2 directions describing an explicitly included use, such as a blow-dry primer or a post-wash
  leave-in — would require a C1/C2 source, and none exists. The C5 directions do describe damp-hair application, but a
  C5 source cannot supply the contradicting half any more than it can supply the positioning half.
- Clause 4 is respected: `provisional_boundary` is reserved for genuine evidence conflicts, and **a weak positioning
  tier does not manufacture an ambiguity** — it fails to *create* the positioning half, while the architecture read
  stands unambiguous on its own terms. §2.3.2 governs over §2.3's trap-3 sentence.

**Recorded corroboration with tiers:** C5 „Hold 3/5" and „Enhances and defines curls"; C5 directions "for a textured
look" / "for a more controlled look"; C4 „Wirkung: Anti-Frizz" / „Haartyp: Lockiges Haar". None of these decided the
state; all point the same way as the architecture read.

**The exclusion decides the emitted state, not whether a human looks at the record.** This record routes to review
(§14, G0 boundary) and its weak-tier positioning basis is recorded for exactly that reason.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **ETHYLHEXYLGLYCERIN, rank 13 of 17**. Above the tail = ranks 1–12.
Recorded as a heuristic; it is late relative to the list (§17.18), though PVP at rank 4 sits far enough above it that
the HOLD read does not depend on the marker's exact position.

## §7 dimensions — `informational_and_non_authoritative: true`

These exist only to make the boundary case reusable as a stress case. **They are never inputs to matching, comparison
or copy** (§2.3.1). This lane emits the full §7 set for both excluded records, as a stated convention — §2.3.1 leaves
the subset optional and §17.24 records that as an open gap.

| Dim | Value | Confidence | Basis |
|---|---|---|---|
| FORM | `aqueous_or_hydroalcoholic_solution` | moderate | Decision order run in full: `anhydrous` no → `two_phase` no (Polysorbate 20 present; no bulk oil phase) → `emulsion` no (no true O/W emulsifying system carrying a lipid or silicone phase; a lone fatty alcohol is **not** an LGN pair and, as reworded in v0.3, does not block the solution row) → `microemulsion` no (test (i) is arguably met — Polysorbate 20 plus glycols high in the list — but **test (ii) fails outright: there is no oil or silicone load at all**) → **solution matched**: water leading, glycols early, no LGN pair, only solubiliser-type material without a real oil/silicone load |
| COND | `moderate` | **low** | Rank prong places Cetyl Alcohol (5) and Quaternium-95 (11) as architecture, so `low` ("no persistent non-volatile above the tail") is refused. **Coherence counter-signal (§3.1.1 clause 2):** a lone fatty alcohol with no cationic partner plus an unresolvable quat is a thin, incoherent conditioning read — recorded, **lowers confidence one step**, and may not lower the rank-supported value |
| SLIP | `moderate`, bias `unknown` | low | One M1 route (the quat/fatty-alcohol pair). Bias: no persistent film and no volatile carrier — neither row fits (§17.16) |
| SFR | `moderate` (`shine qualifier: present`) | low | `high` needs a continuous **persistent-silicone or substantive-cationic-polymer** film — neither exists. `moderate` is carried by a single film former (PVP). `low` is refused because a film former is present |
| WT | `moderate` | **low** | Exactly one persistent non-volatile family above the tail — Cetyl Alcohol (5), read as an emollient/consistency factor. No LGN pair, no rich band, no silicone. §10.1.2 tag not applicable (WT is not `high`; and no C1/C2 statement exists) |
| PERS | `neutral_non_volatile` | low | **`quat_structure: unresolved`** — Quaternium-95's polymeric-vs-monomeric structure is not settled by the INCI name, so it is **not promoted** to `permanent_cationic`. §7.6 rule applied: take `neutral_non_volatile` with the monomeric note, record the limitation, route to review. Supplier substantivity claims are not used (that would be a charge-density inference by another route, G4) |
| **HOLD** | **`meaningful_hold_route`** | moderate | The G0-deciding read, above. PVP (4) above the marker, film-forming context, thin conditioning behind it. §7.7's ceiling holds: the coarse **state** only — **no hold level, no grade, no score** (SR §K HOLD). The C5 „Hold 3/5" is the manufacturer's own scale and is *not* adopted as a level |
| HEAT | `not_claimed` | high | No C1/C2 heat claim (none at any tier). No L9 member. Binary would be `false`; **not emitted** (no lean profile) |
| HUM | `not_claimed` | high | §7.9 clause 1: no C1/C2 humidity/anti-frizz claim ⇒ `not_claimed` whatever the formula shows. The C4 „Anti-Frizz" and C5 "protect against humidity" are recorded in `counter_signals[]` with tiers. Clause 3 is not engaged: **PVP is hygroscopic** and loses film stiffness as RH rises (SR §F.1) — the opposite of a water-uptake-reduction mechanism — so there is no qualifying hydrophobic route to record. Routes to review under `claim_authority_gap` |
| R2 | `none_visible` | moderately_high | No cationised protein, silane derivative or silicone quat at any rank; no hydrolysed protein at all. No `candidate_below_tail` note |
| DOSE | `moderate` | moderate | Derived from WT `moderate`. FORM contributes no value (v0.3 change 18) |
| EXPO | `fragrance_declared` | high | Parfum (17); **no individually declared EU allergens**. No `Alcohol Denat.`/`Alcohol` → no alcohol note. Not fragrance-free, not hypoallergenic — the flag is an exposure statement (§7.12) |
| ROLE | `unknown` | low | Directions are **C5** (non-German-market manufacturer page). §7.13 rule 1 permits role values only from C1/C2 directions. Recorded in `supporting_signals[]` with tier: "Apply to damp hair just at the ends for a textured look or apply throughout the lengths for a more controlled look…" — at C1/C2 this would have established `post_wash`, `ends_only` and `curl_styling` |

**Demoted flags (informational).** SHN `present` (qualifier on SFR only) · CURL not derived (§17.20) ·
**R3 `none`** (researched, negative: no C1/C2 bond claim, no recognised bond chemistry) · LAYER not emitted ·
buildup caution not emitted.

**`care_direction` (informational): `moisture`, confidence `low`** — the **humectant-led minimum row** (§9, v0.2):
an L4 leg present as architecture (Propylene Glycol 2, Glycerin 3, Butylene Glycol 9, Propanediol 12) with **no** R2
route, even though the emollient and cationic legs are thin or absent. The thin-architecture observation is the
required counter-signal. Not silicone-led, so the §9 `unknown` rule does not fire.

## Lean matching profile

**Not emitted.** §2.3.1: an excluded record carries no `focus`, no fit fields, no `specialist_functions` and no
cautions. Downstream consumers must treat "no lean profile present" as the machine-readable signal of exclusion.

No German user-facing string is emitted for this record, including the `HOLD = meaningful_hold_route` string — §18
strings are emitted by lean-profile field values, and this record has no lean profile.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| G0 product-form decision | Every exclusion decided under §2.3.2 clause 3 records its weak-tier basis and routes to review |
| `HOLD = meaningful_hold_route` | Styling-boundary decision (standing trigger) |
| `claim_authority_gap` | Anti-frizz/humidity and hold/curl positioning exist only at C4/C5; no German-market Maria Nila source exists |
| `quat_structure: unresolved` | Quaternium-95 (§7.6) |
| Absent exact-market identifier | No GTIN established |
| Directions below C1/C2 authority | ROLE `unknown`; open gap §17.23 |

`review_status`: **`provisional`** (minimum for an excluded record) → routed.
`out_of_category`: **true**. `g0_state`: `excluded_styling_first`.

## Note for the round-3 diff

This is one of the two slots §19.2.1 names for re-derivation under the §2.3.2 precedence rule. The v0.3 change that
decides it is clause 3: **a positioning half resting only on C3–C5 sources fails to create the positioning half, but
does not manufacture an ambiguity** — so the clean architecture read governs and the record is an exclusion rather
than a `provisional_boundary`. The opposite v0.2 outcome would have been an ambiguity created by a *missing* German
market page rather than by conflicting evidence.
