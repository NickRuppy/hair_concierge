# Ready-to-paste prompt: build the Mask research engine

We are building the Mask ingredient-research engine for Chaarlie, as the third category engine after Shampoo and Conditioner.

Work in the existing worktree `.worktrees/mask-inci` (branch `codex/mask-inci`); verify its base equals the fetched `origin/main` tip before anything else.

Start by reading, in this order:

1. `plans/mask-inci/handover/01_mask_engine_kickoff.md` — the full handover: mission, read order, projection targets, conditioner parallels, gates, phase plan. Treat it as the project contract.
2. Everything in its "Read order" section, especially the complete Conditioner engine package under `docs/research/conditioner-inci/` — it is the primary worked reference, and I want the parallels (and deliberate differences) to conditioner logic surfaced explicitly, not assumed.

Then, before any research or drafting:

- Run the plan-hardening loop on Phase 1 (category charter) only: present the category-boundary options and the consequential choices as a decision-coverage record, and stop for my rulings.
- Do not draft the classification standard, touch any adapter code, or select calibration products until Phase 1 is ruled.

Constraints that hold for the whole project: research-only (no Supabase or production writes, no catalog changes); blind formula-first; product truth separate from user fit; frozen artifacts immutable; research fan-out on cheaper models per AGENTS.md with the main session orchestrating; every phase ends at a checkpoint for me.

Deliverable shape at the end of the project: the standard five engine layers plus integration rows in `docs/research/README.md` and the `product-research-engine` skill, exactly as the handover specifies.
