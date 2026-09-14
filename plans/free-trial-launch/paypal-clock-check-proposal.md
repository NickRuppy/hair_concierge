# PayPal authorization-clock check

Status: canceled by the owner on 14 September 2026: “need no test - we ship this right away”. This supersedes the earlier approval. The app creation form was closed without submission; no test app, plan activation or payer agreement was created. Retain the proposal only as historical context. Do not execute it or request its approval again.

## Exact proposed scope

- One isolated **live** PayPal REST app named `Chaarlie_trial_verification`, under the existing merchant, with no production webhook URL. Keep the production app, credentials and webhook unchanged. PayPal scopes webhook events to the app that generated them; confirm the new app has no webhook or lookup routing into production before creating an agreement. [PayPal webhook scope](https://developer.paypal.com/api/rest/webhooks).
- A monthly plan matching the approved schedule: EUR 0 for seven days, then EUR 9.99 each month; no setup fee, shipping or added tax. Prefer a dedicated verification copy so the published catalog stays in draft state. Retrieve and validate the entire persisted schedule before use.
- One unapproved agreement, with a fresh random request identity, no existing checkout token, and no app/customer/admission/database linkage. Record provider creation time. No repeated creation after an ambiguous response; retrieve or retry with the same request identity.
- Nick completes the PayPal approval personally after an intentional short delay. The provider screen must show zero due immediately and the correct future monthly obligation. Abort if either differs. No request to collect money or to accelerate the trial.
- Retrieve authoritative activation/status timestamps, `start_time`, cycle executions and `next_billing_time`; compare the first collection boundary with both creation + seven days and completed authorization + seven days. Check subscription transactions for zero nonzero payments. Distinguish date-only presentation from an exact API timestamp; do not pass the clock gate from a screenshot alone.
- Cancel the exact test subscription immediately after obtaining the evidence, then retrieve it to confirm `CANCELLED` and check transactions again. Cancellation is part of the same test authorization. If cancellation cannot be confirmed, keep the agreement as an unresolved operational item and give Nick the exact PayPal automatic-payment cancellation action; no silent cleanup claim. If the session interrupts, Nick must cancel from PayPal automatic payments before collection becomes due.
- Deactivate the dedicated verification plan after confirmed cancellation. Keep minimal sanitized evidence. No actual subscription identifier, email, payer identity, credentials or approval URL belongs in the committed plan; operator evidence stays in ignored private storage.

This test proves provider clock behavior only. It does not prove application provisioning, deployed webhook delivery, paid conversion, plan changes or late-payment recovery. Those remain separate integration checks. PayPal may send its own authorization/cancellation confirmations; Chaarlie sends no optional trial email.

## Why the existing production app is not the proposed test boundary

Current PayPal activation requires a local checkout intent or billing row. A standalone agreement has neither and would produce failing/redelivered production webhooks. A matching local token can instead enter legacy paid activation, which is being hardened locally before trial integration. A separate REST app avoids those unrelated production effects while testing the provider schedule. The new credentials will be stored locally using the same private mechanism as the working production credentials.

## Execution checkpoint

Canceled as recorded above. Continue product implementation and publication preparation without this isolated live experiment. Skipping the experiment is not evidence that provider timing was verified and does not change the accepted customer prices, access or cancellation contract.

On resuming, both the existing connected Developer tab and a fresh Developer tab redirected to PayPal sign-in. The owner was asked to sign back in to Apps & Credentials → Live, leaving credentials hidden. This browser session is needed to create the isolated app; it is separate from the previously verified API credentials. No test resource or agreement was created while signed out.
