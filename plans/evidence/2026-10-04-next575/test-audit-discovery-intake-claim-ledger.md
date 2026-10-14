# Discovery invitation boundary: complete 35-site ledger

32 R / 1 F / 2 conditional C / 0 D. Proposed35→35→33. Original163-site intake/claim/application scope was recounted and has prior complete evidence; no duplicate read credit.

## tests/discovery-admin-invites-api.test.ts — 11

SHA256 a5151bf284f27e8684c5a16921a64943f0ae2de49c1506fc5a3043fdb355437b

|Line|Mark|Declaration|Evidence|
|---:|---|---|---|
|67|R|create with just a name returns the invite and its signed fragment link|Actual POST trim/null transformation,201/private-no-store and decoded ID/version1; removal of cache policy or row mapping fails.|
|81|R|create normalises an optional e-mail and treats a blank one as none|Two schema branches optional email lowercasing and whitespace-to-null; source parser mutation fails service argument recorder.|
|91|R|create refuses a missing name or a malformed e-mail before any write|Missing/blank name and malformed email reject before write; relaxing relevant Zod guard fails.|
|104|R|create refuses an address another current invite owns|Actual23505 classification to409 and exact non-disclosing German error; generic503 mapping fails.|
|117|R|rotate bumps the version: the answer carries the NEW link, the old one no longer matches|PATCH selects rotate,passesID,projects returned version2/new signed token. Mock supplies version bump; this is transport/projection proof, not actual rotation/CAS proof.|
|130|R|revoke runs the stamp-clearing service revoke and hands out no link|PATCH selects revoke,passesID,projects revoked status/noURL. Mock supplies revoked stamp; this does not prove actual metadata clearing.|
|140|R|an unknown or already revoked invite answers 409, a bad action 400|Missing/revoked service error maps409; action and UUID parsing map400. Distinct guards remain.|
|151|R|non-admins, signed-out visitors and a switched-off flag reach no write|Flag/auth refusal before constructing service client or either write; dropping guard/order fails.|
|187|R|a missing signing secret is a 503 before any write|Missing signing secret before service write maps503; moving resolution after create fails.|
|197|R|the copied link is a pure projection of (id, version) — the CLI's link, byte for byte|Cross-surface version3 URL equality exercises two distinct adapters. Shared URL builder can fail in tandem, but adapter-only version offset/ID/source-site wiring fails. Existing CLI receipt does not decode its ID/version, so no complete stronger union without additional proof.|
|213|R|a cross-origin or origin-less write is refused before the admin gate and any write|Origin missing/foreign rejected before auth forPOST/PATCH; moving origin check after auth or removing fails.|

## tests/discovery-cli.test.ts — 9

SHA256 a9d3333d4c6d75f32065e853f203bb49bd6c7392379a385874923b18a77287f7

|Line|Mark|Declaration|Evidence|
|---:|---|---|---|
|96|R|the discovery CLI parses its four subcommands and normalizes identity|Parser output/error matrix for list/create/rotate/revoke, optional absent/blank email and malformed inputs. Runtime siblings do not cover whole parser union.|
|129|R|the production gate needs --apply, the env gate, the project confirmation and a matching URL|Explicit four-factor write gate, including wrong confirmation and missing URL absent from facade refusal table; retain whole declaration.|
|182|R|a half-gated mutation reaches no write path at all|Actual command dispatch refuses before any gateway operation under half gates, including create and revoke. Direct predicate cannot catch bypassed dispatch.|
|205|R|without --apply the CLI is a dry run that touches nothing|Dry-run exact receipt and zero gateway calls; wrong writes/mode/action projection fails.|
|223|R|an unusable signing secret neither breaks a dry run nor masks the gate refusal|Short secret does not mask dry run or gate refusal; eager secret resolution fails, unlike normal-secret dry run.|
|246|R|a fully gated mutation runs, and list stays a read|Real dispatcher action routing revoke/rotate/list; mistaken gateway selection fails.|
|265|R|create prints a WhatsApp-ready German invite with the token in the fragment|Real command receipt fragment/noquery, invitedstatus and exact German WhatsApp message; malformed greeting/path/message fails.|
|288|R|invite links are reproducible per token version and statuses read off the row|Trailing-slash URL normalization/version-sensitive URLs and invited/claimed/revoked precedence; facade lacks claimed/revoked fixture union.|
|322|R|create without --email makes a name-only invite whose receipt says so|Actual create without email passes null and emits nullable receipt/fragmentURL; CLI parser alone does not prove write/receipt forwarding.|

## tests/discovery-enrollment-token.test.ts — 4

SHA256 c5998eb2b3da9f19d9742482b2890fe7bb26afd83be9efc9359592f1884fc3e5

|Line|Mark|Declaration|Evidence|
|---:|---|---|---|
|14|R|a discovery credential round-trips through its signature|Signed token format, decodedversion3/ID, deterministic identical projection and differentversion4; URL facade does not prove repeated-byte determinism.|
|34|R|tampered, foreign-signed and malformed credentials are rejected|Tampered payload/signature,version,segments,case,empty/null/undefined,foreignsecret and oversize reject; cryptographic/parser boundary independently meaningful.|
|57|R|a short signing secret can neither sign nor verify|Short signing secret rejected by projection/decoder/config,empty secret missing and valid explicit passthrough; sharederror text preserved.|
|69|R|an unsigned payload shape is refused at projection time|Projection rejects invalid UUID and zero version before signing; malformed decode tests do not reach this entry branch.|

## tests/discovery-invitation-card.test.tsx — 11

SHA256 6de1eeb4107f4458e767362cfd459c2b1788461712780870de05e4ffdf5bca8c

|Line|Mark|Declaration|Evidence|
|---:|---|---|---|
|17|R|a signed-in-elsewhere refusal tells the participant how to get out of it|Actual renderer displays passed refusal and session recovery hint; losing error/hint JSX fails.|
|31|R|other refusals keep their own copy without the session hint|Truthy paid-access error plus default-null hint exercises nested hint omission; noerror render cannot observe accidentally supplied fallback under error branch. Title overstates owncopy; present oracle retained.|
|43|C|the invite CTA uses the coral funnel CTA, not plum|C1: exact same ready/email/name/default-prop render already in editable-email keeper; move both color assertions onto prefilled markup.|
|51|R|the claim response's code decides whether the session hint appears|Code-driven signed-in-other-account hint versus other/missing/null payloads; caller wiring not covered but helper has actual client consumer.|
|62|R|the invite always shows an editable e-mail field, prefilled when the admin entered one|Primary renderer keeper for prefilled/empty editable fields, label/CTA; absorbs C1 and C2 without new render/input.|
|78|R|the magic-link screen names the address the link went to|email_sent branch includes target address/copy and excludes input; ready-mode keeper cannot reach it.|
|87|R|the invite page checks the address before it claims|Required versus malformed versus trimmed valid email helper branches; real claimclient calls same helper before network; no assertion of actual network order claimed.|
|97|R|while the invite resolves, the card stands at its final size and says nothing yet|Initial unresolved client SSR includes inert invisible full form and empty role=status; timer keeper returns element tree and does not render loader HTML.|
|108|C|the ready card fades its content in|C2: move exact animation assertion to existing empty ready render. Lea Sommer and Lea both map firstName Lea and cannot affect outer CONTENT_FADE_IN.|
|113|R|the magic-link landing keeps its card but shows its line only after 300 ms|Continuation initial hidden title/copy comes from different component/caller; invitation client timer does not observe continuation.|
|173|F|once „Wird geöffnet …“ has shown, the loading card stays for the loader minimum|F: actual300ms delay/500ms minimum and settled card identity are useful. isLoading compares private function.name InvitationLoading, so identifier-only rename gives false red; replace name inspection with captured initial element type identity in separate repair, no deletion credit.|

