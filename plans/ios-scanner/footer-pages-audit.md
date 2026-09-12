# Footer pages and iOS disclosure changes — 2026-09-11

Status: read-only production audit plus draft planning copy; no public page changes. Reviewed all five footer targets: [Datenschutz](https://chaarlie.de/datenschutz), [AGB](https://chaarlie.de/agb), [Impressum](https://chaarlie.de/impressum), [Widerruf](https://chaarlie.de/widerruf), [Kontakt](https://chaarlie.de/kontakt). Direct HTTP GET verified current pages; raw public text snapshot is outside the repository at `/tmp/ios-footer-live-text-2026-09-11.json`. The browser search reader initially returned an older May AGB snapshot; the direct production response is August and includes one-time purchases. Do not report the cached subscription-only wording as current.

Current footer ownership: `src/components/landing/footer-links.tsx:3-9`; page sources under `src/app/{datenschutz,agb,impressum,widerruf,kontakt}/page.tsx`. This scope covers the free iOS/shared-account changes and directly related disclosure inconsistencies, not certification of all existing terms.

## What the current pages settle

Privacy section 8 supplies an existing retention policy: unaccounted quiz answers 90 days; resolved payment-support cases 90 days, open cases until clarification; marketing records until withdrawal. It also labels invoice data as subject to a ten-year duty. These are published promises, not proof that deletion jobs or that legal classification are correct. The Impressum identifies Haarmony LLC and Jonas; the withdrawal page covers paid purchases, including the one-time plan. Contact provides the support address. No other footer page supplies a more precise purchase-consent/deletion data map.

## Findings and proposed treatment

| ID | Finding and evidence | Treatment |
|---|---|---|
| L1 | Privacy scope says website; sections 3/4 focus on quiz results/chat. Native barcode processing, shared Merkliste, APNs device registration and research-result delivery are missing. `datenschutz/page.tsx:31,70-115,120-206`. | Add explicit app/shared-account scope and scanner/push purposes. State only behavior enforced by T1–T5; verify actual native SDKs/data paths before publication. Draft below. |
| L2 | Section 8 gives broad durations but no shared-account deletion/case-contact separation; section 10 only describes email requests. `datenschutz/page.tsx:260-307`. | Add in-app initiation and approved deletion/cancellation consequences, minimal retained case contact, stop marketing/scan notifications, and necessary case/deletion messages. Existing privacy rights by email remain available. |
| L3 | Blanket invoice-ten-year wording is not a sufficient legal basis for the retention implementation. Current German invoice retention in §14b UStG is eight years; AO §147 distinguishes record classes. IRS requirements also depend on the record/tax circumstances. | Do not replace ten with eight/three globally. Confirm applicable regimes and record classes for the US LLC, including consent/fulfilment evidence, then bind fields and expiry triggers. Draft financial paragraph is criteria-based pending that confirmation; E2 remains partly unresolved. |
| L4 | Quiz basis differs between section 3(b) (contract) and section 9 (consent before registration); general analytics wording also differs from the consent-specific section 7. | Consolidate purposes/bases by actual operation. Keep auth, marketing DOI, optional web tracking and necessary diagnostics separate. Do not silently change legal basis or introduce native analytics. |
| L5 | Privacy section 5 promises marketing only after double opt-in. Source audit establishes optional consent, but not a complete regular-quiz DOI confirmation/delivery gate. | Preserve the existing opt-in promise. Confirm DOI evidence and provider enforcement before enrolling scanner users. Auth email verification by itself is not marketing consent. This is a verified gap in evidence, not a finding that unconsented emails have been sent. |
| L6 | EU-representative section still says a representative will be appointed before processing EU data. `datenschutz/page.tsx:45-50`. | Replace the placeholder with confirmed applicable information. Actual establishment/Art.27 applicability and any representative identity must be established; do not invent a contact or assume Jonas is the appointed representative. |
| L7 | Current AGB §3 describes only paid checkout; §2/§9 cover advice/routines and paid access, without a clear free scanner/account case. | Add free iOS access, account requirement, shared data, and deletion/cancellation consequences. Preserve existing web prices, one-time purchase and withdrawal rights. Draft shown in page-layout preview. |
| L8 | Provider roles/regions and update label require reconciliation. Privacy still says last updated May although later features are described. | Update date upon actual publication, not now. Verify processor roles, hosting/transfers and native APNs role from actual contracts/configuration; a provider's US corporate location and EU workspace hosting are separate facts. Do not label every payment provider or platform identically by assumption. |

## Draft disposition

[German copy draft](footer-copy-draft.md) and [layout preview](evidence/footer-pages-review.html) contain the concrete proposed additions. The preview places the copy in the current legal-page structure: narrow reading column, existing page hierarchy and current neutral colors. It is selective section evidence, not a replacement for every legal clause. Public-page implementation and publication remain pending the reviewed copy, unresolved facts, native behavior and final journey sign-off.

No scanner-specific need to rewrite the withdrawal page was found. Keep its paid-purchase rights reachable; account deletion does not automatically request a refund or remove statutory rights. Contact and Impressum remain shared; no new invented identity/address is proposed.

## Sources checked

- [§14b UStG](https://www.gesetze-im-internet.de/ustg_1980/__14b.html): current German invoice rule is eight years, generally measured from calendar-year end; applicability to the LLC is not established by its website language.
- [§147 AO](https://www.gesetze-im-internet.de/ao_1977/__147.html): different German record classes have different periods; does not authorize keeping all user data.
- [IRS recordkeeping periods](https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records): record/action/tax circumstances determine duration, including exceptions. Not a uniform alternative retention period for this service.
- [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/): real deletion with required-record exceptions, in-app initiation and transparent timing. This does not settle the LLC's tax obligations.

## Before publication

Verify financial record classes/periods and representative facts; trace regular-quiz marketing DOI end to end; prove app camera/push/notification/deletion promises match implementation; reconcile existing quiz/analytics legal-basis wording. These are concrete unresolved facts, not a request for Nick to choose database columns or arbitrary legal durations. Do not present this draft as a legal approval or automatically enable production retention jobs from it.

## Source verification for L5

Regular quiz consent is optional (`src/components/quiz/quiz-consent-sheet.tsx:35`), captured independently (`quiz-lead-capture.tsx:172`, `src/app/api/quiz/lead/route.ts:268,336`) and sent as Customer.io traits (`src/lib/customerio/quiz-traits.ts:77`). `src/app/auth/confirm/route.ts:159` verifies identity and links the profile without changing marketing consent; the auth-user trigger only creates profiles (`supabase/migrations/00001_initial_schema.sql:383`). These establish separate consent capture, not the advertised DOI confirmation/delivery gate (`src/app/datenschutz/page.tsx:170`). A bounded read-only audit returned these anchors; live marketing delivery compliance remains unverified.


## Überarbeitete Dokumente

Nick hat vollständige aktualisierte Fassungen autorisiert. [Datenschutz und AGB mit Redaktionsstatus](legal/README.md) liegen vor. Keine EU-Niederlassung oder Vertretung eingerichtet laut ausdrücklicher Antwort; L6/R1 bleibt zu klären. Die aktuelle Layout-Vorschau zeigt die vollständigen Arbeitsfassungen, der vorige selektive Vergleich ist unter `evidence/footer-pages-excerpts-review.html` erhalten.
