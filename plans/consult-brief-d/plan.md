# Consult brief D — plan (Rev. 1, 2026-10-12)

Package D of the cockpit call-ready program (`plans/cockpit-call-ready/plan.md` on main; E+A shipped as #658).
Source: critical hair-expert review of Nomi's cockpit (2026-10-09).

## Rulings (Nick, 2026-10-12)
- **Quality over speed for Nomi**: her call is finished only after D and PDF v2 — nothing is sent before.
- **Order is mine**: D (incl. points) → C1 scalp-type check (member-facing) → PDF v2 → B → rest of C.
- **Keep a point system** — it must rapidly communicate which measure has how much impact, to the
  consultant in the call and (via PDF v2) to the client.
- **Format: dots + total range** (chosen over per-lever points and over summed points): ●●● / ●● / ● per
  measure with a time tag, one total „7,5 → 8 bis 9 in 4–8 Wochen", footnote „Orientierung auf Basis
  üblicher Wirkungen, keine Messung oder Garantie."

## Evidence base
Research digest (hair-care-expert, 2026-10-12): no hair-care RCT for any behaviour lever; tiers rest on
instrumental data + practitioner consensus; per-lever numbers on a 1–10 self-rating are not defensible;
overlapping levers are not additive. Tier values, modifiers and the range formula are judgment calls,
kept deterministic and in code so the 4-week re-scores (package B) can recalibrate them by whole tiers.

## Scope
1. **Point system v2.**
   - New pure module `src/lib/discovery/consult-brief/lever-scale.ts` (test-first):
     - fixed catalog of lever kinds, each with base level (1–3, or none), German time tag, „wenig belegt"
       marker, and whether it is a breakage lever or weight-sensitive;
     - kinds: hitze_tools, hitzeschutz, foehnen, entwirren, chemie_abstaende, spitzen, waschrhythmus,
       produktlast, nachtschutz (no dots), spuelung_neu, gewicht_tausch, leave_in, bondbuilder, maske,
       oel, kopfhaut (own block, no dots), sonstiges (no dots unless Nick sets one);
     - level = base, +1 for breakage levers (heat tools, protectant, detangling, chemical spacing) when
       bleached/breaking, −1 when the gap is small or unknown („offen", marked „im Call klären"),
       −1 for leave-in/oil on fine hair, clamped 1–3;
     - range: weights 0,5/1/1,5 per level, overall largest + ½ × rest, capped by
       min(2, 0,6 × (10 − baseline), 9 − baseline); lower bound = upper / 2, both in half points; levers with
       no 4-week effect (chemie_abstaende, spitzen) and the kopfhaut block stay out of the range.
   - Generator: the model returns `kind` and `gap` per Hebel instead of `points`; code computes `level`.
     Stored Hebel gain `kind`, `gap`, `level` (JSONB, no migration); legacy `points` render as a level
     (≥1,5 → ●●●, ≥1 → ●●, >0 → ●).
   - Runsheet: a level select replaces the points input; time tag and „wenig belegt" beside it; the
     staircase becomes the range („Mit Plan: 8 bis 9"); new footnote.
2. ~~„Warum nicht" names the failing attribute~~ → **moved to C**: those reasons are the scan verdict
   engine's (`src/lib/scan/result-presentation.ts`), member-facing in the scanner too.
3. **Stale banner says what changed**: generation stores per-part hashes (Produkte, Profil, Hitze,
   Waschrhythmus, Wissen, Score, Brief-Version); the banner names the changed parts. Older briefs keep
   the generic text.
4. **Diagnosis describes her, not plan decisions**: prompt rule + eval check (no „Umstellung",
   „vorgesehen", „geplant" in `diagnose`). Not a lint rule: a lint failure discards the generation, too
   harsh for a style rule.
5. **Heat framing**: hot tools in her styling → the heat Hebel says „schonender", never „weniger"/„reduzieren";
   prompt rule + eval check.
6. **Honest evidence labels** in the concern recipes: 51 entries re-graded with one rubric (strong = human
   trials or consistent instrumental data + consensus; moderate = instrumental/mechanistic only; weak =
   consensus or a single small study), research agent 2026-10-12; labels „gut belegt / laborbasiert /
   Erfahrungswert / unklar". Display-only (grades never reach the brief input, G5).
7. **German copy for `hair_loss_or_thinning`** in the recipe texts (3 places).
8. **No duplicate questions**: callFragen never repeat the checklist's code-side asks (prompt rule +
   eval check).

Verification: prompt-version bump (every stored brief stale once), lever-scale unit tests, lint/route/
runsheet tests, `npm run test:consult-brief` golden profiles incl. Nomi, Nomi cockpit render from the
branch, `npm run ci:verify`, Codex whole-branch review.
