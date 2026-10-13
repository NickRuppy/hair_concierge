# Ready-check receipt: Hair Tools polish (`codex/hair-tools-polish`)

- **Head:** `a71bc11c`, which is the merge of origin/main `11f522b8`. The branch is 0 behind.
- **Content fingerprint:** `6cf5e9bd605de852e7c5878237f592b8e219c232793c80da44de5a157d199975`. It is the SHA-256 of the sorted `path <blob|DELETED>` manifest over the 26 paths changed against merge-base `11f522b8`, taken before this receipt was added.
- **Scope:** Nick's "fix all the points you found" after the post-ship walkthrough of PR #666. No product logic or data changes.
- **The seven fixes:**
  1. Night labels: „Glatter Kissenbezug (z. B. Seide, Satin)", „Spitzen-Schoner", „Scrunchie / weiches Haargummi".
  2. The Stage-1 tools lead is conditional: once nothing is left to check, it reads „Was du schon hast, ist markiert."
  3. The night-protection Anwendung copy fits every night form, follows N06 and keeps fixture 103's loosen/remove clause. The verbs in `CAPABILITY_ACTIONS_DE` use the short imperative form.
  4. Display-only card labels with soft hyphens and `hyphens: manual`, so compound words no longer break mid-word in WebKit or Chromium. Stored answers, care facts and alt text keep the plain labels.
  5. `docs/local-qa-access.md` says the rollout flag is matched case-insensitively.
  6. The journey lab's Routine tools follow the session's answers, through a labs-only server action that throws outside development and test.
  7. The journey lab seeds every tools and habits re-entry from the latest session.

## Checks (tree `a71bc11c`, after `npm ci`)

| Check | Result |
| --- | --- |
| `npm run ci:verify` | exit 0 (after moving a stale `.next` aside; its generated types still referenced the Stripe route that #668 removed) |
| `npm run test:personal-plan` | 3664 pass, 0 fail |
| `npm run test:personal-plan:nested` | 1564 pass, 0 fail |
| `npm run test:node` | 11744 pass, 0 fail |
| `npm run test:playwright:personal-plan-stage3:journey` | chromium 80 passed, 1 failed |

- **The chromium failure:** `personal-plan-start.spec.ts:234` („Escape at the first dialog-visible instant"). This is the known load-dependent regression from main's #662 (Next 16.3.8). It reproduced on a clean origin/main in 2 of 2 runs, and a fix task is filed. The webkit half did not run, because the chromium failure stops the script.
- **On the pre-merge tree `03763395`:**
  - The journey run was chromium 81 passed and webkit 13 passed.
  - In the @ci group on a production build, profile-editorial and profile-page-smoke passed.
  - The @ci failures were only in offer, payment and quiz lab specs that 404 locally without CI's lab env. No such code is in the diff.

## Review

The Codex whole-branch review of `3d62c38b..03763395` returned APPROVE with no findings. It confirmed:
- the labels stay display-only;
- the production server action compiles to an unconditional throw;
- the lead's edge cases are correct;
- the night copy meets N06.

Two optional follow-ups for Nick are copy questions only:
- short imperatives in `GUIDANCE_COPY_DE`;
- „Spitzen-Schoner" in the legacy care vocabulary.

## Evidence

`plans/mockups/2026-10-12-hair-tools-polish/README.md` lists the screenshots (PNG files are git-ignored).
