# Consent simplification research — 2026-09-15

## Recommendation
Use a simple accept-optional/reject-optional first layer, plus settings with separate analytics and advertising purposes. Group Meta and OpenAI under advertising; use the same actual consent decision on both client/server paths. Vendor-specific switches are not required merely because providers differ. A single optional toggle with no purpose-specific alternative would unnecessarily bundle analytics and advertising.

## Primary sources checked
- EDPB Guidelines 05/2020, para 43–44, granularity: https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf . Search indexed guidance supports separate purposes; direct PDF fetch failed. Corroborated by EDPB 2024 opinion section 4.2.1.5: https://www.edpb.europa.eu/system/files/2024-04/edpb_opinion_202408_consentorpay_en.pdf .
- German DSK telemedia guidance, version 1.1: https://datenschutzkonferenz-online.de/media/oh/20221130_OH_Telemedien_Version_1.1.pdf and consultation response https://www.datenschutzkonferenz-online.de/media/oh/20221205_oh_Auswertung_Konsultation_zur_Orientierungshilfe_fuer_Anbieter_von_Telemedien_final.pdf . First-layer joint approval still needs the individual purposes described there; granularity remains relevant.
- Google: https://developers.google.com/tag-platform/security/concepts/consent-mode . Distinguishes analytics_storage, ad_storage, ad_user_data and ad_personalization. Provider signals support purpose separation; they are not themselves a legal-compliance determination. Basic vs advanced implementations differ; no assumption that Google behavior applies to other SDKs.
- PostHog: https://posthog.com/docs/privacy/data-collection . Opt-out controls stop captures including autocapture/manual events/replays, opt-out by default is supported, and CMP changes must be wired into opt_in_capturing/opt_out_capturing. Current provider recommendation loads SDK opted-out rather than gating snippet; determine acceptable network boundary in implementation.
- OpenAI: https://developers.openai.com/ads/measurement-pixel . Consent defaults true unless denied before init; denied measurement is not replayed after approval. opt_out for future personalization is separate from measurement consent.
- Meta official GDPR integration page https://developers.facebook.com/docs/meta-pixel/implementation/gdpr/ returned HTTP 429. Do not claim its current instructions were verified. Recheck before concrete SDK changes; third-party guides were not used as technical authority.
- ICO (UK supporting UX guidance, not German legal authority): https://ico.org.uk/media2/about-the-ico/documents/4032419/cookie-letters-project-phase-2-template-letter.pdf . Reject nonessential advertising should be as prominent/easy as accept. Preview uses equal visual weight for the main buttons.

## Scope and interpretation
The recommendation is practical EU/German-facing product guidance grounded in primary sources, not a certification of legal compliance. Consent categories follow purposes, not provider count. Essential classification follows the actual operation, not the vendor name: payment confirmation and transactional emails must not be broken by optional measurement denial.
User selected shared Meta/OpenAI treatment. Nick approved the first-layer simplification and settings hierarchy on 2026-09-15 (“yeah better, lets lock this in”). The complete integration journey and expanded technical plan still need finalization and review.

Artifacts: this research note and current preview `commit`; prior alternatives overwritten at user's direction; transient reviewer output stays outside repo.

## Provider follow-up
Cookiebot/Usercentrics' current first-party integration guide (updated June15,2026) documents Meta `fbq('consent','revoke')` and `grant`, initial revoke and consent-change listener: https://support.cookiebot.com/hc/en-us/articles/360004461894-Require-consent-before-loading-Facebook-pixel . This verifies that CMP provider's integration recipe, not successful access to Meta's rate-limited page. Customer.io utility methods were also checked at https://docs.customer.io/integrations/data-in/connections/javascript/utility-methods/ .
