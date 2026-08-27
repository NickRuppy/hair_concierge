# Moderator invitation return routing

## Scope

Complete the approved organic moderator journey: an active tester reopening the invitation resumes saved progress. Fresh testers still log in and start the organic quiz. No account resets, grants, migrations, or new UI.

## Evidence and correction

The disposable hosted tester completed organic quiz, activation, Personal Plan, and routine. A fresh login through the invitation then stalled at `/plan-start`, although the saved routine and owner-scoped routing source were intact. Navigating to `/anwendung` loaded that routine's application days successfully.

Route active moderator page and start responses to `/anwendung`. Existing authenticated middleware resolves recovery to `/plan-bereit`, incomplete setup to `/plan-start`, pending proposal to `/routine`, and accepted routine to `/anwendung`. Keep the response parser compatible with the older `/plan-start` response; the client always enters the canonical progress-controlled route. Never accept arbitrary response URLs.

## Verification and release

Existing account-page, start-route, response-parser, and frontier tests cover the seam. The first three fail against the previous implementation. Run focused tests, typecheck, lint, and required CI. Verify a fresh hosted login through the actual invitation after deployment, then remove only the disposable production fixture. The five real moderator accounts remain untouched.

This is a bounded correction to the approved journey, not a new design decision. Publication, merge, deployment, and the isolated fixture verification remain within the explicitly authorized live release.
