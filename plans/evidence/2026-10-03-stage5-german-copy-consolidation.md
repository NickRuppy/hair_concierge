# Stage5 German-copy same-source consolidation

## Supported conditional C1

Delete only `tests/personal-plan-stage5-german-copy.test.ts:79`, **“unavailable retry refreshes the server route instead of linking to the same page.”** Transfer its two unique assertions to the existing `:87`, **“an unavailable direct day offers the bounded overview while transient failures retry”**:

```ts
assert.match(source, /actionHref: null/)
assert.doesNotMatch(source, /actionHref: "\/anwendung"/)
```

The keeper already reads the identical `src/components/application/application-state.tsx` source and asserts `actionLabel: "Erneut laden"` and `router.refresh()`. The source chooses `ApplicationRetryButton` only when `STATE_COPY.unavailable.actionHref` is `null` (`application-state.tsx:40-47,84-102,108-121`); restoring `actionHref: "/anwendung"` would otherwise pass the current keeper because the refresh handler still exists. The transfer catches that exact fault.

`ApplicationState` is real UI: `ApplicationPage` renders it for every non-ready view at `application-page.tsx:165`; `RouteAwareApplicationPage` is used by the production Anwendung route (`src/app/anwendung/page.tsx:316,332`), Labs, and gated preview. This is a test consolidation only, no private source seam to remove.

## Controls and limits

Use `/tmp/test-audit-stage5-german-copy-transfer-driver.cjs --check` before application; it requires the exact worktree and donor test hash, exact one donor and keeper anchors, and parses the prospective file. `--apply` is intentionally available only to the main operator after a fresh check. Then run the focused native Node test and two source faults: `actionHref: null`→`"/anwendung"` and removal of `router.refresh()`. The first must fail from the transferred assertions; the second from the already-retained assertion. This is static/source-level proof, not a browser click simulation.

No other C/D claim was added: the remaining source readers bind distinct files/negative invariants, while behavior tests have distinct input classes or complete output oracles.
