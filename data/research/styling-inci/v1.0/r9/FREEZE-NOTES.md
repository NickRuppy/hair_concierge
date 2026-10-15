# FREEZE-NOTES — targeted Styling r9 re-check

Frozen 2026-10-14. R8 amendment packet stamp: `styling-inci-v0.5-r8amend`; lexicon `styling-lexicon-v0.5-r7amend` (formula membership unchanged). LOCK-1 remains suspended. Governing ledger: R8-Q1, R8-Q2, R8-H and all earlier rulings.

## Scope

All **143** r6 records were screened case-insensitively over product name, `product_name_as_captured`, every name variant and **every C1/C2 claim line**, regardless of claim type. Exact field/index/tier/text, matches, ordered promise lines and exclusion reasons are in `scope-audit.json`. **16** records selected.

- R8-Q2: include every hair powder (captured powder format or Puder/Powder in names/C1/C2 text), including compounds and aerosol powder sprays. The noun supplies volume; texture/grip requires its own promise; Powder Grip is a two-job name.
- R8-Q1: include Big Hair Day explicitly and all volume + freshness co-occurrences anywhere in the screened fields, a conservative superset of the requested volume-lead + freshness-line set. No first-line shortcut. Curl revival and scent candidates stay included for semantic re-check; the freeze assigns no route or job.
- R8-H: include Moroccanoil Glättende Creme explicitly; its stale care + definition mixed example is removed, with R7-Q2 and border rules governing.

Screen patterns: `(?:puder|powder)`; format `powder`; volume `\b(?:volum\w*|fülle|voller(?:es|em|en)?\s+haar|lift)\b`; freshness `(?:frisch\w*|refresh\w*)` (all case-insensitive).

| Product | Reason class(es) | Inclusion reason |
|---|---|---|
| Balea Haarpuder Volumen (Pomegranate) | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| Balea MEN Styling Powder | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| Balea Styling Spray Volumenpuder Pure Styling | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| BALI CURLS Volumizing Curl Spray | R8-Q1-volume-freshness-candidate | Volume wording in name or any C1/C2 line plus frisch/Frische/erfrischend/refresh wording in name or any C1/C2 line; conservative candidate, semantics and lead eligibility remain for blind lanes. |
| BALI GENTS VOLUMIZING STYLING POWDER | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| Batiste TROCKENSHAMPOO ALL IN ONE fruchtig frischer Duft | R8-Q1-volume-freshness-candidate | Volume wording in name or any C1/C2 line plus frisch/Frische/erfrischend/refresh wording in name or any C1/C2 line; conservative candidate, semantics and lead eligibility remain for blind lanes. |
| got2b Styling Puder Volumen Powderfull | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| got2b Trocken SHAMPOO Extra Volumen | R8-Q1-volume-freshness-candidate | Volume wording in name or any C1/C2 line plus frisch/Frische/erfrischend/refresh wording in name or any C1/C2 line; conservative candidate, semantics and lead eligibility remain for blind lanes. |
| Kevin.Murphy Powder.Puff Volume | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) | R8-Q1-Big-Hair-Day, R8-Q1-volume-freshness-candidate | Owner-ruled refresh-between-washes + volume tie, even with a volume-leading name; re-check dry_shampoo. / Volume wording in name or any C1/C2 line plus frisch/Frische/erfrischend/refresh wording in name or any C1/C2 line; conservative candidate, semantics and lead eligibility remain for blind lanes. |
| Moroccanoil Glättende Creme (Smoothing Lotion) | R8-H-Moroccanoil-border | Stale mixed example removed: descriptive Definition for krauses Haar plus a separate curl-target line is not a curl-definition promise; R7-Q2 and border rules govern. |
| Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| Schwarzkopf Professional OSiS Dust It | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| Redken Powder Grip (03 Mattifying Hair Powder) | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| Schwarzkopf taft Haarpuder VOLUMEN | R8-Q2-hair-powder | Puder/Powder noun in a name or C1/C2 line, or captured powder format; volume noun mapping and promised texture/grip secondary must be re-checked. Powder Grip remains a two-job name. |
| Wella Professionals EIMI Volume Dry Me (Trockenshampoo) | R8-Q1-volume-freshness-candidate | Volume wording in name or any C1/C2 line plus frisch/Frische/erfrischend/refresh wording in name or any C1/C2 line; conservative candidate, semantics and lead eligibility remain for blind lanes. |

## Freeze and verification

The unmodified r6 builder rebuilt **432** historical artifacts byte-identically in memory. r9 emits **16** each of S0, F/U and claims packets from r6 with a fresh opaque salt (`styling-inci-v1.0-cohort-9/r8-owner-amendment/opaque-id/`); id overlap with r1-r8 is zero. Masking and leak checks reuse `freeze-cohort-r8.js` logic: inherited S0 mask, directions-only F/U grading mask with inherited-mask sentinel, and strongly strength mask. INCI stays byte-identical to r6 and never enters the general grading mask. Every S0/FU string field was scanned: S0 **800**, F/U **455**; unauthorized leaks: **0**. Claims strings also undergo metadata checks. Run `node data/research/styling-inci/v1.0/build/freeze-cohort-r9.js` twice and compare every artifact hash plus the manifest hash for determinism. `determinism-check.json` is an external two-run verification receipt, excluded from the generated manifest.

Never supply cohort/id_map/scope-audit/FREEZE-NOTES/manifest/verification receipt to blind lanes; supply only the appropriate packets. No classification or production write is performed.
