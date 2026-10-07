# Production scanner capture receipt

Captured: 2026-09-14 15:50:42 UTC (17:50:42 Europe/Berlin).
URL: https://chaarlie.de/scan
Primary asset: ogx-production-scan-390x844.jpg
Dimensions: 390 x 844 pixels.
SHA-256: aa7221d1c44e03fa0ddb4b70f3947fae66f907a47dffd97a921b48fa29724566

## Provenance

Unmodified native browser screenshot of the genuine production Chaarlie scanner. The browser screenshot APIs return JPEG bytes. The earlier .png path is preserved as a byte-identical compatibility alias for the parent; its actual encoding is JPEG. Use the .jpg asset when integrating. No cropping, compositing, generated UI, CSS/DOM changes, fixtures, or image retouching.

Signed in to Nick's existing scanner-test identity using Supabase admin generateLink and the application's normal /auth/confirm verification route. No email was sent. Opened Scan > Merkliste > the existing OGX entry, which produced the live fit result. This is a saved-product result opened through production, not a new physical barcode capture.

Product: OGX Renewing + Argan Oil of Morocco Shampoo.
Catalog product ID: 2ecd3c9d-90f6-45a3-a72c-daefed50be10.
Visible result: “Passt mit Einschränkung zu deinem Haar”; “2 von 3 Zielbereichen getroffen”.
Visible fit dimensions: cleansing “sanft” mismatches regular target; balanced scalp matches; medium hair diameter matches.
Real product photograph is visible in the result header.

Existing refined profile context: very short, wavy, normal-diameter natural hair, medium density; balanced scalp; frizz/surface and shine goals; shampoo approximately twice weekly. Refined need version: b9f3f411-3037-41bf-b73e-076ebec40ad3. No profile data was created or changed.

## Action and mutation receipt

- Read-only scoped Supabase queries identified an existing authorized scanner-test account, saved product, and refined profile.
- Generated and consumed one admin magic-link for that existing identity; normal authentication session/auth audit state may change. No password change, new account, entitlement, provider, billing, payment, catalog, customer, or plan mutation was performed.
- Dismissed the in-product feedback hint (browser-local UI state).
- Opened the existing wishlist result; ordinary application analytics/cache side effects may occur. A scoped scan_resolve_events query for the capture period returned zero new rows. No explicit saved-product mutation was made.
- No email, feedback, or other message was sent to anyone.
- The scanner used an already-permitted camera session while its surface was open; no permission settings were changed. The final result sheet covers the person; only a narrow room/viewfinder strip remains behind the sheet. The scanner tab was closed after capture to stop camera use.
- Removed the temporary auth-link file and reset the temporary mobile viewport. No auth tokens or passwords are included in this receipt.
- No repository source edits, publication, deployment, or parent planning-worktree edits.

## Integration limit

The screenshot truthfully shows a qualified result for this existing test profile. Do not label it an unconditional positive match or imply it was evaluated for a different profile. This receipt documents live production UI and fit result, not camera barcode-decoder verification.
