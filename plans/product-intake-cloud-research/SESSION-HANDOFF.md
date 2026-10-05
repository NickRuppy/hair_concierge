# Session handoff — server session (ssh), 2026-10-05

Start a Claude session rooted in `/Users/nick/AI_work/hair_conscierge/.worktrees/hetzner-research-handover`. Only a session started there can run `ssh chaarlie-hetzner …` (allow in `.claude/settings.local.json`, ssh deny removed in this branch's `.claude/settings.json`; `ssh -*` stays denied).

Read first: [plan.md](./plan.md) (Rev. 3, decision coverage confirmed), [backlog-triage-2026-10.md](./backlog-triage-2026-10.md), memory `project_intake_cloud_research_program.md`.

## State of this worktree (uncommitted, not deployed)

- Slice 0 code done and verified (full `npm run test:node` green, typecheck clean): worker reliability (stdin closed, timeout = retryable, robust JSON extraction, `infra_auth`, named rembg containers + cleanup), migration `20261005190000_product_intake_job_attempt_hygiene.sql`, migration `20261005190100_product_intake_worker_heartbeats.sql` + async subprocesses, heartbeat loop, lease renewal, lease-loss abort, Sentry cron `product-intake-worker`.
- Onboarding code change was discarded (decision D8b revised); 10 onboarding text products were submitted as data.

## Server tasks (each production step is its own gate with Nick)

1. **Read-only audit (0.1)** — host facts, both `chaarlie-product-intake-*` units verbatim (variable names only, never values), release layout, deployed SHA (`/opt/chaarlie/product-intake/releases/20261005-bf6c74c74fc6` is live), effective env (concurrency, image judge, auto-prepare), Codex version/login, Docker + rembg digest, disk/RAM next to price-audit.
2. **Show Nick the 6 Hetzner-processed final images** (magenta + final, same contact-sheet format as the Mac ones): submissions 28a961ae, 4e1eb309, 56188ef1, 7b2cfe69, 81f41097, e79d36b1. Paths are in each `processed_image` artifact (`final_file`, `qa_file`). Plus the 6 queued at ~14:30 (154a186c, 181476bb, 301c4f7b, 3cb0477c, bd871352, c701e5b6) once processed. Record approvals as `final.image` / `image_approved` decisions with the artifact id + sha.
3. **Findings to fix:** (a) image judge produced 0 `image_judgment` artifacts → judge disabled on both workers; (b) Hetzner writes finalized images INSIDE the release dir → must point `PRODUCT_INTAKE_FINALIZED_IMAGE_DIR` (or equivalent) at `/opt/chaarlie/product-intake/shared/finalized-images` and copy existing files before the next deploy; (c) Nick's Mac also runs a worker (local review center) on old code — JSON-parse failures continue there until main has the fix.
4. **Codify units (0.2) and host budget (0.7)**, then deploy Slice 0 after: Codex counterpart review of the branch, `/ship`, Nick's "merge it", migration apply gate, server deploy gate.

## Open with Nick

- Guhl Kopfhaut Tonikum (8d501682) value sheet presented for final OK (this session).
- Pantene Sunkiss (c3fcd12d) and Eve Curls (ff28f746) sent back to research (empty leave-in projection; invented protocol step + Dutch-only shop).
- Gliss Scalp Balance pair (0fcfbf0e, 42894272): category oil → scalp_care needs a routine-safe path (linked `user_products`).
- Balea Hydra Volume (41e9950e) was published by another session at 13:25; its job is closed — do not touch.
