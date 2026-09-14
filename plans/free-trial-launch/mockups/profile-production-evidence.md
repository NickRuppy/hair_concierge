# Profile trial mockup — production evidence

Inspected 13 September 2026. Planning artifact only; no application or provider changes.

## Live reference

Opened `https://chaarlie.de/profile` in the existing signed-in Chrome profile. Inspected the actual desktop layout and the membership section at an emulated iPhone 12 Pro viewport of 390 × 844. The account currently has **Aktiver Sonderzugang**, so production does not demonstrate a live trial or its actions. No account data was changed.

Observed structure: the existing Personal Plan header/navigation, profile sections, then **Einstellungen → Erinnerungen → Mitgliedschaft → Account → legal links**. Mobile uses the fixed five-item bottom navigation; desktop uses header navigation. Membership has a subtle border, no card shadow, and the surrounding memory/account cards have the existing light shadow. The lower settings surface is cream, beyond the upper profile gradient.

The unauthenticated IAB profile request redirected to the public sign-in page. Its shared production stylesheet and preloaded fonts were exported with the browser page-assets API; no private profile HTML, identity, avatar or credentials were exported. Stylesheet URLs identify deployment `dpl_AypqLhb2Wgpo5tkNs3YNvE8eD3rJ`.

## Retained visual assets

- `profile-assets/production.css`: live shared `0o1ianzhtuej6.css`, unchanged.
- `profile-assets/playfair-display.woff2`: live `b027a14d9707b79c-s.p.0hoh-1l45hm~j.woff2`, weight 500.
- `profile-assets/plus-jakarta-sans.woff2`: live `fba5a26ea33df6a3-s.p.0eehd8tgys7nv.woff2`, variable weights.
- `profile-assets/ibm-plex-mono-500.woff2`: local Next cache file `effe91970fc4db64-s.07ig5l8azj~hy.woff2`, matching the font filename referenced in live production CSS. Used for the existing small memory status badge.
- `profile-assets/fonts.css`: local font bindings only; avoids loading external resources in the static mockup.

Live appearance was reconciled with the matching source markup in `src/app/profile/page.tsx`, `src/components/layout/personal-plan-navigation.tsx`, `src/components/ui/card.tsx`, and `src/components/ui/button.tsx`. Membership retains 24px padding, 16px radius, 18px Playfair heading, 14px body, existing muted/foreground colours and the current compact outline-button treatment. The container retains the 1024px maximum width and 16px horizontal padding. Native mobile navigation remains 72px high.

## Proposed differences and scope

Only the trial membership contents/actions are the proposed product change: trial status, annual plan, original trial end, first charge, small renewal note, plan change and trial cancellation. This remains a **settings excerpt**, not a replacement full profile or a new page. The upper hair profile content is outside the excerpt. Static account fixtures replace the real user's identity. The wrapper opens around membership and offers mobile/desktop comparison.

Browser inspection confirmed both responsive navigation variants and the rendered trial details/actions. The production membership account is a special-access account, so the new trial state is explicitly synthetic. Buttons perform no account, payment, navigation or settings operations beyond harmless local placeholder anchors. Provider execution, cancellation dialogs and plan-change states are not verified by these screenshots.

Nick accepted the preceding trial content in principle, then requested this production-based visual revision. **This revision awaits his visual review.** Earlier generic lifecycle frames remain historical draft evidence until similarly reconciled.

## Simplified hierarchy after Nick’s feedback

Nick questioned the information density and provider/current-plan rows. The revised proposal removes the provider row, displays “Testphase” as a small badge, presents “Jahresabo” as the plan name, and groups the trial end with first-year and renewal pricing. Plan change and cancellation sit together, wrapping on narrow screens. Production shell, fonts and surrounding settings cards remain. This is a proposed visual revision, pending review; no billing or access semantics changed. Archived preceding markup: `../archive/profile-trial-v044.html`.

Button correction: after inspecting the live Haar-Check editor (filled-purple save action and purple-outline cancel action), the mockup now uses that existing primary/secondary pair for “Plan ändern” / “Testabo kündigen”, with 44px minimum height and 8px gap. The prior underlined cancellation link is superseded. Only the static mockup changed.
