Track A run 2 (re-check on locked v1.6.2, after review fix 6eac8883). Kits: tmp/tracka-run2/kit-W1..W4 (seeds 20261011..14, prefixes W1..W4). Brief: tmp/tracka-run2/lane-brief.md.
Release: npx tsx scripts/shampoo-research/build-lane-kit.ts release tmp/tracka-run2/kit-WN lane-x (rollout worktree), after committing/pinning formula-pass.
kit-W1 lane-a aeb3bd35e28dbd9fd | lane-b a590f30f3c2adac27
kit-W2 lane-a a7b8a48ceadb66143 | lane-b a694bf6c24a1c53c1
kit-W3 lane-a a396d4baf058772ab | lane-b af1ec2196d78baae0
kit-W4 lane-a a4005638850c2a4b9 | lane-b a391cb42197a642e4
kit-W2 RESULT: 302/306 = 98.7%; diffs W203 weight light/moderate (fine fit), W210 focusSecondary (research-only)
SEAL INCIDENT kit-W1 lane-b: locked v1.6.2 Version table (Test-round evidence row) names 'Every-Day ... to sensitive via MB' (brand scrubbed, product word survived); matches W118 = G03 Sebamed Every-Day after reveal. Possible anchoring on one product; lane reports independent rule application. Follow-up: Version rows of future standards must not name cohort products; scrub multi-word product names partially.
kit-W1 note: both lanes saw 'Elvital Hydra Hyaluronic' (W1 rule source example, as in run-1) and 'Every-Day' (v1.6.2 version row) in the locked standard; W104 Garnier Honig lane-a needs_research on stale retailer beeswax claim.
kit-W1 RESULT: 319/323 = 98.8%; diffs research-only (focus) + W114 conditioning (moderate/low).
kit-W3 RESULT: 303/306 = 99.0%; diffs research-only (focus, usage).
kit-W4 RESULT: 309/323 = 95.7%; projection-affecting: W411 (A45) weight high/moderate -> heavy (P0), W410 (A21) coarse tier; rest conditioning/focus.
Consolidation (consolidate_run2.py, conservative P0 merge): 74 products; 8 differ from run 1 (v1.6): G03 (R18 MB move, registered), A21 (weight moderate, Nick: cautious if split -> both lanes moderate), A47, A45, G08 (weight), A29 Monday (weight heavy -> moderate, W-LINE), A15b Hask 473 ml (new research, regular shampoo), U1 Balea Tiefenreinigung (oily claim "überschüssiges Fett von Haar und Kopfhaut" outside the closed E2 lexicon -> regular). A09 Garnier Honig still needs_research (lane A: stale retailer beeswax claim).
