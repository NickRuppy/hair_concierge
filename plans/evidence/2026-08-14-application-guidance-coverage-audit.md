# Application guidance coverage audit — 2026-08-14

## Scope

Read-only production inspection of the 223 active, executable Personal Plan catalog products, their 272 V2 application pointers, current accepted Routine items, category-specific application facts, and the Stage 5 compiler contracts on fresh `origin/main` (`6ca24b64`). No Supabase or production writes were performed.

The audit distinguishes:

- **pointer validity** — a stored V2 pointer parses and composes;
- **declared use-case coverage** — every use declared by catalog facts has a matching pointer;
- **journey eligibility** — every genuine Leave-in and every conventional leave-on finishing Oil receives independently supported between-wash methods instead of becoming unresolved;
- **research completeness** — product-specific claims and category-level professional technique authority remain separate.

## Confirmed findings

1. All 272 stored V2 pointers parse and compose successfully. There are no structurally invalid or runtime-blocked active pointer rows.
2. The current publication gate checks required Routine-role pointer existence, but not every product × supported use case × Anwendung day.
3. `product_application_protocols` has a unique index on `(product_id, category, role)`. A Leave-in therefore cannot store both a post-wash and a between-wash pointer for the same Routine role.
4. The day compiler treats `leave_in` as accepted on wash, refresh, and between-wash days, while the exact-guidance resolver requires exact Leave-in guidance on refresh and between-wash days. This makes a valid post-wash-only Leave-in appear as an unresolved refresh product.
5. Five current active Routine items are exposed to this false unresolved state: Cantu Leave-In Repair Cream, Color WOW Money Mist, Gliss Ultimate Repair Sprüh-Conditioner, It’s a 10 Miracle Leave-In, and NEQI x @_the.beautiful.people Leave-In Moisturizing Mist.
6. All 41 active Leave-ins have exactly one `post_wash_leave_in` pointer family: 36 are post-wash families and five are between-wash families. The schema cannot represent a verified product that supports both.
7. Comparing current Leave-in `application_stage` facts with stored pointer families finds 12 declared-but-unrepresented uses across eight products:

| Declared stage | Declared | Covered | Missing products |
| --- | ---: | ---: | --- |
| `towel_dry` | 41 | 36 | alverde 7in1, Elvital Midnight Serum, Pantene Bonding Leave-In, Pantene 7in1 Haaröl Spray, Redken One United |
| `dry_hair` | 5 | 1 | Kevin Murphy Young Again, NEQI Leave-In Mist, Living Proof Restore Repair Leave-In, Redken One United |
| `post_style` | 3 | 1 | Kevin Murphy Young Again, Redken One United |
| `pre_heat` | 15 | 14 | NEQI Leave-In Mist |

8. Existing source text exposes further catalog-stage drift not captured by that comparison, including dry-hair or post-style directions for Balea Aqua Hyaluron 3in1, EVO Head Mistress, Garnier Hair Food Aloe Vera, Gliss Ultimate Repair, HASK Keratin 5-in-1, and Pantene HEAT&GLOW. These are research candidates, not automatically accepted facts.
9. Oil role storage is structurally complete but its between-wash presentation is not: 26 products have 54 Oil pointers, 22 have `dry_finish`, 21 have post-wash damp conditioning, and 18 have both. The dry-finish template can reach between-wash days, but the damp method remains wash-only and the compiler never groups the two. Four products therefore have no current dry between-wash route and zero Oils receive the same explicit two-method choice as Leave-ins.
10. The remaining eight categories pass current declared-authority checks: required pointers exist; all pointers parse/compose; Dry Shampoo format matches its family; Scalp Care rinse mode matches its family; and Heat pointers contain supported application states. This does not replace source revalidation, but no further structural collision was found.

## Completed Leave-in research conclusions

The full frozen cohort of 41 active Leave-ins was rechecked and is fingerprint-bound in `data/catalog-enrichment/personal-plan-stage5-v2/leave-in-use-cases-2026-08-14.json`. Existing reviewed authority is retained for 25 products; 16 products carry an explicit researched override or correction. The effective matrix contains 18 additional application-family pointers and one stale-family correction. Every planned pointer parses and composes against the reviewed shared templates.

Implementation closure keeps the original 272-row source snapshot as a separately fingerprinted baseline and produces one 289-row final activation artifact. The final set contains all 18 reviewed inserts, excludes the corrected stale Redken family, composes without blockers, and remains inactive until the separately guarded V2 artifact apply.

### Color WOW Money Mist — corrected category conclusion

Manufacturer authority supports clean, damp, freshly washed hair and heat-protection use. That does not establish a manufacturer-specific dry-refresh claim, but manufacturer silence is not evidence that a true Leave-in cannot be used conservatively between washes. Independent dermatology and formulation evidence supports a minimal category-level damp refresh and a lower-dose targeted dry method. Money Mist therefore appears between washes without presenting either method as a Color WOW-specific claim.

- https://colorwowhair.com/products/money-mist-leave-in-conditioner
- https://uk.colorwowhair.com/products/money-mist-leave-in-conditioner
- https://www.aad.org/public/everyday-care/hair-scalp-care/hair/leave-in-conditioner-tips
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9921463/

### Confirmed multi-use examples

- alverde 7in1: dm directions explicitly allow dry or damp hair.
- Elvital Öl Magique Midnight Serum: L'Oréal directions allow dry or wet hair, morning or night, without rinsing.
- Kevin Murphy Young Again: manufacturer guidance allows damp or dry hair.
- Redken One United: reviewed source authority covers after cleansing, between-wash refresh, before/after styling, and heat protection.
- Pantene Bonding Leave-In and Pantene 7in1 Haaröl Spray: current reviewed sources describe damp/wet and dry use; source quality should be upgraded where the current authority is retailer/secondary.
- Balea Aqua Hyaluron, Garnier Aloe Vera, Garnier Macadamia, Gliss Ultimate Repair, HASK Keratin 5-in-1, and Pantene HEAT&GLOW: reviewed directions support both post-wash and dry-hair use.
- EVO Head Mistress: manufacturer directions support post-wash and after-styling use.
- NEQI Leave-In Moisturizing Mist: manufacturer directions support towel-dried post-wash use and damp-hair heat protection, but not dry refresh.

### Confirmed correction example

Living Proof Restore Repair Leave-In is directed for damp hair and every-wash use. The current `dry_hair` stage still must not be treated as a manufacturer-specific application claim merely because the product is “for dry/damaged hair.” Its dry between-wash method comes from the separately labelled category policy.

## Planning implications

- Product-specific claims and category-level technique guidance are separate authorities; neither should masquerade as the other.
- Existing category facts remain broad audit signals. The reviewed manifest supplies exact product-specific uses, while the category policy supplies universal damp/dry between-wash technique for genuine Leave-ins.
- Protocol storage must allow more than one application family per product/role.
- Publication must fail if a declared supported use lacks exactly one valid pointer, or if an unreviewed/unknown use remains.
- Runtime must synthesize both between-wash methods for conventional Leave-ins behind a reversible capability switch. Invalid or missing underlying product pointers still fail closed and must never render “wird noch geprüft.”
- The full 41-Leave-in cohort requires source recheck because the V1→V2 normalization collapsed multi-use directions into one family.
- Conventional leave-on finishing Oils require a separate category policy: dry is the default between-wash method and lightly dampened use is the alternative. Eligibility comes from typed leave-on `finish`/`leave_in` pointer authority, never merely `category = oil`.
- Oil exceptions remain exact: pre-wash-only, scalp/rinse-out, and special heat protocols do not inherit generic between-wash methods. Ordinary Oil never implies heat protection.
- Oil quantity should use catalog `weight` plus profile thickness/density. Fine or low-density hair and rich Oils receive the most conservative one-drop/ends-first wording.

## Remaining release boundaries

- No production migration, catalog mutation, feature activation, or deployment was authorized or performed.
- Counts are a 2026-08-14 production snapshot and must be refreshed immediately before any migration/apply gate.
- Retailer-only authority remains explicitly labelled for alverde, Balea, and three Pantene products; it is executable but should be upgraded if a current manufacturer direction becomes available.
