# Runbook — Affiliate Link Backfill Execution

Spec: `docs/superpowers/specs/2026-05-13-affiliate-link-backfill-design.md`
Plan: `docs/superpowers/plans/2026-05-13-affiliate-link-backfill.md`

This runbook walks through a single end-to-end execution. Everything that mutates production data is explicit and confirm-able.

## Prerequisites

- `.env.local` is populated with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run ci:verify` passes on `main`.
- `data/affiliate-research/` exists.

## Step 1 — Export

```bash
npx tsx scripts/export-missing-affiliate-links.ts
```

Confirm the row count matches the audit (`209` at time of plan-writing). If the totals warning fires, update `SLICE_PLAN` in the export script and rerun.

## Step 2 — Canary

Dispatch one general-purpose subagent. From the Claude Code session, invoke the `Agent` tool with the prompt template below, parameterized for the canary slice:

```
INPUT  = data/affiliate-research/missing-canary.csv
OUTPUT = data/affiliate-research/results-canary.csv
CATEGORY = "mixed (canary)"
PREFERENCE_ORDER = "DM > Rossmann > Müller > brand-direct > Amazon DE"
```

Wait for the agent to complete. Then:

```bash
npx tsx scripts/validate-slice.ts canary
head -5 data/affiliate-research/results-canary.csv
```

Eyeball the chosen URLs. If the verification rules need tweaking (too many false `high`s, etc.), edit the prompt template before fanout.

## Step 3 — Fanout

In a single Claude Code message, dispatch 15 `Agent` calls in parallel — one per slice. Use the per-category preference orders from the spec. Each agent's prompt swaps in its slice's `SLUG`, `CATEGORY`, and `PREFERENCE_ORDER`.

Slices:

```
shampoo-a, shampoo-b, shampoo-c, shampoo-d
leave-in-a, leave-in-b, leave-in-c
oele-a, oele-b, oele-c
conditioner-a, conditioner-b, conditioner-c
maske-a, maske-b
```

When all 15 return:

```bash
fail=0
for slug in shampoo-a shampoo-b shampoo-c shampoo-d \
            leave-in-a leave-in-b leave-in-c \
            oele-a oele-b oele-c \
            conditioner-a conditioner-b conditioner-c \
            maske-a maske-b; do
  npx tsx scripts/validate-slice.ts "$slug" || fail=1
done
if [ "$fail" -ne 0 ]; then
  echo "One or more slices failed validation. Rerun those slices before aggregating."
  exit 1
fi
```

Any slice that fails: rerun ONLY that slice's subagent (point it at the same input/output paths). Re-validate.

## Step 4 — Pre-aggregation diff check

Confirm the subagents only wrote `results-*.csv` files (boundary check from the spec):

```bash
ls data/affiliate-research/
git status -- data/affiliate-research/
```

Expected: only `missing-*.csv` (already-present) and `results-*.csv` (newly written) files. If anything else changed (e.g. someone touched `applied.log` already, or a stray script-output file appeared), STOP and investigate before aggregating.

## Step 5 — Aggregate

```bash
npx tsx scripts/aggregate-affiliate-research.ts
```

Inspect:

```bash
wc -l data/affiliate-research/{results,approved,review-queue}.csv
head -10 data/affiliate-research/approved.csv
```

## Step 6 — Manual review of `approved.csv`

Open `approved.csv`. Sanity-check each row's `chosen_url` against `name` and `brand`. Delete any row that looks wrong. Move rows you'd like to escalate from `review-queue.csv` into `approved.csv` if you trust them.

## Step 7 — Dry write-back

```bash
npx tsx scripts/write-affiliate-links.ts --dry
```

Confirm the printed UPDATE count matches `approved.csv` row count.

## Step 8 — Real write-back

```bash
npx tsx scripts/write-affiliate-links.ts
```

Then re-audit:

```bash
npx tsx scripts/audit-affiliate-links.ts
```

`activeWithLink` should have increased by exactly the count in `applied.log`.

## Rollback

If a bad batch of URLs was written, regenerate from the previous audit and re-NULL specific rows:

```sql
UPDATE products SET affiliate_link = NULL WHERE id IN ('id1', 'id2', ...);
```

Then re-export, re-research only those rows, and re-aggregate.
