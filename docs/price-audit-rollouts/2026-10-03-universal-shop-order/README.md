# Universal purchase-shop priority — 2026-10-03

Nick clarified: “the shop rule applies across all categories”. This supersedes the
former oil, leave-in, bondbuilder, and unresolved-category purchase exceptions.

The purchase order is **dm > Rossmann > Müller > brand-direct > Amazon DE** for
every category. Package size and price are secondary; URL, size, and price must
refer to one verified purchasable variant of the same product. Official
manufacturer pages retain first priority for identity and property evidence.

## Local correction and verification

- Branch: `codex/price-audit-rollout-receipt`; correction base: `6beb123c866e81559377ce92cd6f2303d47c7ff3`.
- Updated the canonical runbook and both commercial contracts in the generated
  research prompt. The older affiliate design now links to the canonical rule.
- Replaced the category switch with one shared order, clarified fallback
  reasoning, and removed the static assertion requiring the obsolete oil order.
- Original coverage acknowledgement: Nick's explicit universal-category rule and
  earlier instruction that preferred shops take priority over package and price.
- Internal decision revalidation: the same order reaches both packet locations
  for all ten supported categories and an unresolved category. No open choices.
- Recorded red proof: the new runnable packet test against the base worker fails
  for leave-in, oil, bondbuilder, heat protectant, scalp care, and unresolved
  category (16 checks: 9 pass, 7 fail including the parent test).
- Final green command:
  `node --import ./tests/server-only-register.cjs --import tsx --test tests/product-intake-research-worker-name-only-seam.test.ts tests/product-intake-research-jobs.test.ts tests/product-intake-codex-model-config.test.ts`
  — **58 passed, 0 failed**.
- `npm run typecheck`, targeted Prettier check, and `git diff --check` passed.
- Normal correctness review: checked both packet consumers, evidence/purchase
  priority separation, category contracts, matching offer requirements, fallback
  reasoning, regression proof, and documentation links. **No blocking findings.**
  Structural review omitted for this small localized removal of category branches.
- Reviewed content fingerprint: `f810c451a13905d427aae62a4452b881b95d073c54667d74cfc1d9793eb7185c`. The sorted manifest is
  [reviewed-content.sha256](reviewed-content.sha256); it covers the five changed
  source/docs/test files and public shop evidence. Receipt and manifest exclude
  themselves to avoid self-reference.
- Receipt and public evidence are committed with the correction. Test runner logs
  stay in `/tmp`. Historical catalog-write receipts remain unchanged.
- No server deployment, worker restart, timer change, or catalog write in this
  correction. Prompt behavior is verified locally; the running intake worker
  has not received this source update. No push or PR is part of this correction.

## Cacay recheck under the shared rule

The [public retailer evidence](cacay-preferred-shop-recheck.json) was collected at
14:43 UTC. Official dm lookup returned `found=false` for EAN 4260541540014; fresh
name-search rows did not contain that exact product. Müller returned no search
results for the EAN or NUTREEOIL Cacay name. Rossmann returned a client challenge:
its availability remains **unverified**, rather than proven absent.

No exact purchasable offer was verified at the first three shops. Retain the
already verified manufacturer offer (15 ml, €24.99) as a fallback after those
checks. This is not an oil exception and does not substitute another oil brand.
