# Session handoff — Product Intake cloud research (state 2026-10-06)

Read first: [plan.md](./plan.md) (Rev. 3, decision coverage confirmed), [backlog-triage-2026-10.md](./backlog-triage-2026-10.md), memory `project_intake_cloud_research_program.md`.

ssh: `ssh chaarlie-hetzner …` works from any Claude session once this branch's `.claude/settings.json` is on `main` (deny `Bash(ssh *)` replaced by deny `Bash(ssh -*)`) and `Bash(ssh chaarlie-hetzner *)` is in the local `.claude/settings.local.json`. Close stdin when looping over ssh (`< /dev/null`).

## Done on the server (2026-10-05, Nick-approved)

- Read-only audit: `ubuntu-4gb-nbg1-1` (Nuremberg), Ubuntu 26.04, 2 vCPU / 3.7 GiB / 2 GiB swap, disk 55 %; units `chaarlie-product-intake-worker` (Restart=always, concurrency 1, poll 5 s, no MemoryMax) and `chaarlie-product-intake-review` (127.0.0.1:3910); release `20261005-bf6c74c74fc6`; Codex CLI 0.156.1 (stale); rembg image digest pinned.
- Drop-in `/etc/systemd/system/chaarlie-product-intake-worker.service.d/10-finalized-images.conf`: `PRODUCT_INTAKE_FINALIZED_IMAGE_DIR=/opt/chaarlie/product-intake/shared/finalized-images`, `PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED=true`. Existing finalized images copied there (verified identical). Worker restarted 18:15 UTC.
- Shadow challenger left as is: its 10-judgment target was reached on 2026-09-26, it no longer runs.

## Deployment revalidation — 2026-10-15

Slice 0 and the shared stages are deployed. The running worker and review app
use release `92bfe95862eb20f0d1a53a71cac22fc4e8b60892`; the worker heartbeat
was current and the review app answered HTTP 200 during the read-only audit.
The worker currently starts through a systemd override with Node
`--conditions=react-server --import tsx`; PR #650 makes standalone startup
reproducible in the repository.

Production already records `20261006112322` (attempt hygiene), `20261006112337`
(heartbeats), `20261006141653` (engine binding) and `20261007062729` (shared-stage
artifact kinds). PR #645 aligns the four repository filenames without changing
SQL content. Do not apply duplicate copies under their old filenames. This
alignment does not repair unrelated historical migration-history drift.
For future releases, apply any new required migrations before switching the
worker release; a code rollback does not undo the applied migration history.

## Still open

- Codify units + drop-in into `deploy/product-intake/` (0.2), host budget (0.7), Codex CLI upgrade on the server.
- Backlog products: see the program memory for per-product state (images approved; values being completed by research; publish via `approve-package` package flow).
