# Recurring Price Audit

Plan of record: `plans/price-audit-lane.md`. Approved 2026-09-30 (host adapters + review fallback, auto-write on confirmed identity, weekly Hetzner run; Rev. 3: stored prices always show, staleness never blanks them).

## What it does

`npm run price-audit` re-checks `price_eur`, `purchase_link_status`, `price_checked_at` and `purchase_link_checked_at` for all active catalog products, recommendation-surfaced (`is_chaarlie_recommended`) first, oldest check first.

- **dm.de** — identity and commerce via the official dm MCP `searchProducts` (GTIN match **and** the stored link's DAN/GTIN must agree); `purchasable`/`sellout` are the structured availability signals. `getProductDetails` is not used (documented "NOT FOR: prices, availability").
- **rossmann.de / mueller.de / douglas.de** — stored-PDP fetch with the honest audit user agent, schema.org JSON-LD parsing (GTIN identity, offer price, availability; ambiguous multi-price offers go to review).
- **Everything else / anything unconfirmed** — the GPT fallback (Nick, 2026-09-30): whatever the deterministic path could not confirm (no adapter, host not enabled, bot wall, GTIN/link mismatch) escalates in the same run to the Codex CLI (already on the worker), which researches the current price like a human would. Its answer counts only with a gate-passing evidence URL (deny aggregators; known retailers or the brand's own shop) and passes the same anomaly guards. It may auto-write **`price_eur` + `price_checked_at` only** — an LLM claim about link status goes to the review CSV, never into `purchase_link_status`. Budget-capped per run (`--llm-budget`, default 40, oldest/recommendable first); enabled by default only with `--apply` (a dry-run opts in with `--llm`, opt out with `--no-llm`). Products it can't settle land in the review CSV as before.

Honesty rules (enforced in `src/lib/price-audit/decide.ts`, unit-tested):

- `price_checked_at` is stamped **only** when the adapter actually read the current price on an identity-confirmed page.
- Confirmed-but-not-buyable pages write only `purchase_link_status='unavailable'` + `purchase_link_checked_at`; the shown (possibly stale) price is never written.
- `unavailable` needs **structured** evidence (JSON-LD availability, dm `purchasable`/`sellout`); text-classifier hits go to review. Each auto-written `unavailable` also emits a `link_unavailable_needs_replacement` review row (link replacements stay review-only per HAI-124).
- Anomalies (price ≤ 0, > 500 €, delta > 30 %) go to review, never auto-write.
- Updates are id-based and guarded: the row must still carry the observed `affiliate_link` and `price_checked_at`, and exactly one row must match, or nothing is written (`concurrent_change`).

## Probe gate (per-host auto-write authority)

A host may auto-write only when `data/price-audit/probes/<host>.json` has `enabledForAutoWrite: true` (every sample confirmed identity + price), a non-empty `reviewedBy`, and a `probedAt` younger than 60 days. Hosts without that are **not fetched at all** in cron runs; their rows become `host_not_enabled` review proposals with zero network traffic.

Rollout per host (run on the Hetzner worker):

```bash
npm run price-audit:probe -- --host dm.de
```

Compare the printed samples against the live pages, then re-run with `--reviewed-by nick` (or edit the file). Commit the probe file — it is the auto-write authorization evidence and expires after 60 days.

Supervised observation of a not-yet-enabled host (dry-run only, never combinable with `--apply`): `npm run price-audit -- --probe-hosts --host rossmann.de --limit 10`.

## Runner usage

```bash
npm run price-audit                     # dry-run, artifacts only, zero writes, no GPT
npm run price-audit -- --limit 20 --llm # bounded supervised run incl. GPT fallback
npm run price-audit -- --apply          # id-based updates + GPT fallback (cron mode)
```

Artifacts land in `$PRICE_AUDIT_OUT_DIR/<run-start>/` (default `tmp/price-audit/`): `summary.json`, `review-proposals.csv`, `auto-writes.csv` (old→new per write, with `applied`/`note`). On the server set `PRICE_AUDIT_OUT_DIR=/opt/chaarlie/price-audit/shared/runs` — releases are atomic folders, `tmp/` inside a release is lost on switch. Keep at least 90 days: `auto-writes.csv` is the proof that no stamp happened without a confirmed read.

Exit codes: `0` ok, `2` systemic failure (majority of *fetched* re-checks failed — skipped `host_not_enabled` rows don't count), `1` crash. Sentry: with `NEXT_PUBLIC_SENTRY_DSN` set, the run checks in against monitor `price-audit-weekly` (crontab `30 4 * * 1` Europe/Berlin) — the dead-man switch for a silently dead timer.

## Server install (Hetzner worker)

Unit files: `deploy/price-audit/price-audit.{service,timer}` → `/etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable --now price-audit.timer`. Notes:

- `EnvironmentFile=/opt/chaarlie/price-audit/shared/env` needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `PRICE_AUDIT_OUT_DIR`.
- The release checkout needs **dev dependencies** installed (`tsx` is a devDependency).
- The box also runs the intake worker (concurrency one, 4 GB): the unit carries `MemoryMax=1G` and `Nice=10`; keep the Monday 04:30 slot.
- `Persistent=true` catches missed ticks; since prices always show, a missed week only means staler numbers, never blank cards.
- Activating the timer is a production action with its own authorization (same rule as the intake worker).

## Processing review proposals

`review-proposals.csv` rows are applied the HAI-124 way: reviewed, then a hand-written id-based migration (precedent: `supabase/migrations/20260609204000_hai_124_product_metadata_corrections.sql`). Never `scripts/ingest-products.ts`. Link replacements always go through review — the audit never rewrites `affiliate_link`.

Before the first `--apply` run, review the dry-run `summary.json` with expected fresh-coverage per host and for the recommendable set; GTIN coverage bounds dm auto-writes (336/347 active products had a canonical GTIN on 2026-09-30; GTINs mapped to more than one product are dropped, fail-closed).

## Interactions to know

- **Display rule (Nick, 2026-09-30):** the stored price always shows — a stale `price_checked_at` never blanks it on any surface (the earlier Stage-3/cockpit hide-when-stale gate is removed; an outdated price beats a price-less card). Stage-3-family surfaces still show no price when `purchase_link_status` is `unavailable`; the cockpit Idealplan card does not status-gate (accepted divergence, F10). `price_checked_at` drives audit prioritization and honesty evidence, not display.
- **Routine drawer freshness line** uses `products.updated_at`, which every audit write bumps. Status-only writes therefore refresh that date without a new price — accepted; no-op status writes are skipped to limit it.
- **Catalog-enrichment replay guards** (e.g. scalp executor) compare commercial fields exactly; replaying old launch batches after audit writes fails closed on drift — expected, resolve against the audit trail in `auto-writes.csv`.
- **`data/product-metadata-audit/known-price-checks.json`** (one-shot HAI-124 audit) holds pinned expected prices; once the recurring audit moves prices, its `stale_price` findings are noise — prefer the recurring lane's artifacts, and update or retire that file when running `npm run audit:products`.
- **dm terms**: the repo's dm research-ops note says dm's terms for continuing commercial display/storage are not settled; dm auto-writes stay behind Nick's explicit go (see plan, open decision).
