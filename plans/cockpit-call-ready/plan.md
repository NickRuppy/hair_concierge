# Cockpit call-ready — plan (Rev. 1, 2026-10-09)

Source: critical hair-expert review of Nomi's cockpit (2026-10-09; enrollment `6ebb7e7b…`). Nick: fix it
generally with Nomi as the example, one PR per package, order **E+A → D → B → C**. Expert findings were
verified in code before planning (2026-10-09 code map); two did not hold (mask "zu oft" is engine-faithful;
"Festgehalten" already counts decisions only — its problem is wording).

## PR 1 — Packages E + A (admin-only; no member surface)

Rulings (Nick, 2026-10-09):
- **A1 Status vocabulary** everywhere (step card header, „Für den Plan festgehalten", week view):
  `Entschieden` (clicked) · `Vorschlag` (engine pick, unconfirmed) · `Offen` (her own product, undecided);
  a deliberately empty step reads `Bewusst ohne Produkt` — never „offen". One pure helper derives it
  (`runsheet/decision-state.ts`), every place renders from it. `outcome` (hashed) is untouched.
- **A2 „Testlauf zurücksetzen"**: deletes all product decisions of the intake (call sheet untouched), confirm
  dialog, refused once finalised. New RPC `discovery_admin_reset_call_decisions(target_intake_id)` with
  `FOR UPDATE` on the intake (race with finalize), DELETE handler on the decisions route reusing the guards.
- **A3 Week view placement** (ruled after the steps-per-day research, 2026-10-09: multi-day by role):
  a step appears in EVERY column where it belongs — wash-only steps (shampoo, conditioner, mask, pre-wash
  oil, post-wash leave-in, pre-shampoo/post-wash bondbuilder) on Waschtag; finishing oil on Waschtag
  (optional, last) AND days without washing; heat steps (protectant, pre-heat leave-in) on Waschtag and on
  days without washing only when she uses a hot tool; scalp serum on Waschtag (days without washing only if
  labelled for daily use — conservative default: Waschtag only); overnight bondbuilder on days without
  washing. Defaults, not hard rules (convention, no trials). Research: scratchpad research/steps-per-day-type.md.
- **E4 One question list**: drop the „kurz fragen" chips; the checklist line points to „Fragen für den Call".
  (D: the brief generator receives the code-side asks so it stops repeating them.)

Routine fixes (no ruling needed):
- **E3** „nicht vergleichbar" for her 2×/Woche vs „nach jeder Haarwäsche": the wash anchor drops a swapped
  shampoo; anchor from her stated shampoo frequency regardless of the decision. „nach Bedarf" chip wording.
- **E5** comparison table: wider label column, no mid-word breaks, headers that don't overlap.
- **E2** alternatives: equal Bondbuilder options carry application info (vor dem Shampoo / Leave-in / über
  Nacht) instead of a bare „Passt"; „Sortieren: Fit" hidden when it sorts nothing. Shared assessment rows
  untouched.
- **E1** profile chip strip at the top — shown as a Nomi mockup before building.

## Later PRs
- **D** brief: „Warum nicht" names the failing attribute; stale banner says what changed; heat lever
  „schonender"; downgrade „stark belegt"; German copy for `hair_loss_or_thinning`; asks into the generator.
- **B** record the call: answer fields per call question; structured follow-ups (flake history, break
  location, iron temperature, bleach logistics); score context. Schema change.
- **C** engine (member-facing, item by item): scalp-type check for scalp care; no swap proposal for unrated
  products; leave-on/oil cap for fine + flat; „Essenziell" badges; „Reichhaltige Vorwäsche" label.
