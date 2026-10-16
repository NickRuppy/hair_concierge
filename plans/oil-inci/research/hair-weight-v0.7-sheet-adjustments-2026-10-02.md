# Hairdresser sheet adjustments — v0.7

The current guide is [v0.7](../../../docs/research/oil-inci/v1.0/03_weight-reference-v0.7.md), with [machine reference](../../../data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.7.json). OE23 records Nick’s explicit instruction to adopt the supplied sheet for argan, moringa and black seed, and confirmation of Cacay/Calendula additions.

## Scoped changes

| Item | v0.6 | v0.7 | Basis and limit |
| --- | --- | --- | --- |
| Argan | light/low | medium/low; light alternative | Approved practical middle-band hair guidance; previous flow estimate retained as counterevidence. |
| Moringa | light/low | medium/low; light alternative | Same practical guidance; viscosity and maker hair claim remain counterevidence. |
| Black seed | light/low | medium/low; light alternative | Same practical guidance; viscosity observations remain counterevidence. |
| Cacay | absent | rich/low provisional; medium/light alternatives | Bottom-band practical sheet guidance; exact seed-oil identity verified independently. |
| Calendula | absent as guidance | carrier-dependent guidance, no material prior | Read actual carrier formula; do not turn the extract or trade name into a fixed oil. |

The [supplied sheet](hairdresser-natural-oil-sheet-2026-10-02.png) was explicitly described as ordered by heaviness on hair. Its authorship and comparison protocol are unverified; it is practical evidence, not a sensory test. Existing catalog thickness assignments use the same Haartyp sheet and do not constitute independent corroboration. No exact ranking within bands or deterministic thickness eligibility is introduced.

[Kahai’s TDS](https://kahai.co/wp-content/uploads/2025/12/1.TDS_.pdf), read 2026-10-02, identifies cold-pressed Cacay seed oil with exact INCI `CARYODENDRON ORINOCENSE SEED OIL`. It supplies no hair-weight endpoint. Density, fatty-acid ratios and skin dry-touch claims are excluded from choosing rich.

[PRIMAVERA’s current Calendula page](https://www.primaveralife.com/calendulaoel-bio.html), read 2026-10-02, identifies a Calendula flower macerate in sunflower/olive oils with rosemary leaf extract. The rule is carrier-dependent. This update assigns no product weight to that example; unknown carrier ratios do not justify averaging classes or inheriting the sheet’s bottom-band placement. Exact-product label display normalization is separate from generic alias matching.

## Result and verification

65 material identities / 104 canonical names and aliases: **42 light, 14 medium, eight rich and one unknown**. Of 64 assigned estimates, 62 are low confidence and two moderate; zero validated hair-weight classes. Calendula is separate guidance and not a 66th fixed oil. All other 61 existing material entries are unchanged.

README, charter, property guide and classification-standard routing now point to v0.7. Historical versions and sealed runs retain their bytes. Verification checks current guide/JSON agreement, exact source/name integrity, changed-entry scope, carrier-dependent Calendula handling and historical hashes. Receipt: `hair-weight-v0.7-verification-2026-10-02.json`.

Only the OE23 changes are signed off here; the other candidate priors and a new calibration run remain pending. No runtime or database changes, new calibration, commit or push.
