# Concern Taxonomy Retagging Review

## Applied High-Confidence Retags

I applied the conservative first-pass retagging directly to the current catalog for the live categories in use (`Conditioner (Drogerie)`, `Leave-in`, `Maske`).

Rules applied:
- existing `protein` -> add `hair_damage`
- existing `feuchtigkeit` -> add `dryness`
- leave-ins with structured `detangle_smooth` benefit -> add `tangling`
- explicit repair-coded products -> add `breakage`
  - leave-ins with structured `repair` benefit
  - or products whose name/description clearly includes `repair`, `repar`, `bond`, `plex`, `keratin`, `anti-snap`, `molecular`, `structure`, `extreme`, or `reveal`

Applied row updates: `95`

Current catalog counts after the high-confidence pass:
- `hair_damage`: `41`
- `dryness`: `40`
- `tangling`: `37`
- `breakage`: `36`

## Ambiguous Review Queue

These were deliberately **not** given `breakage` automatically because the current evidence is suggestive but not explicit enough for the conservative pass.

- `Fructis Hair Food Papaya` (`Maske`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Bali Curls SOS Protein Treatment` (`Maske`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Isana 3in1 Michprotein & Mandel` (`Maske`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Glisskur Liquid Silk (Silikone)` (`Maske`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Guhl Panthenol +` (`Maske`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Neqi Build Boost` (`Maske`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Neqi Peptide Power` (`Maske`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Redken Acidic Color Gloss Leave-In (Silikone)` (`Leave-in`)
  Current: `["protein", "hair_damage", "tangling"]`
  Proposed: `["protein", "hair_damage", "tangling", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.

- `Guhl Panthenol*` (`Conditioner (Drogerie)`)
  Current: `["protein", "hair_damage"]`
  Proposed: `["protein", "hair_damage", "breakage"]`
  Reason: Protein/repair line without an explicit breakage keyword in name or structured leave-in repair benefit.
