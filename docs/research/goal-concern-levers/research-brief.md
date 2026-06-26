# Goal And Concern Lever Guidance Research Brief

## Purpose

Research the practical lever map behind every onboarding hair goal and concern so AgentV2 can answer goal/problem questions with clearer priorities, profile modifiers, and conservative safety boundaries.

This is external evidence work only. Do not inspect or change runtime code, guidance packages, product data, tests, or schemas during the research phase.

## Complete Coverage Surface

Goals:

- `volume`
- `healthier_hair`
- `less_frizz`
- `color_protection`
- `moisture`
- `healthy_scalp`
- `shine`
- `curl_definition`
- `less_split_ends`
- `less_volume`
- `strengthen`
- `anti_breakage`

Concerns:

- `hair_loss`
- `dandruff`
- `dryness`
- `oily_scalp`
- `hair_damage`
- `split_ends`
- `breakage`
- `frizz`
- `tangling`
- `thinning`

## Evidence Labels

- `strong`: consistent clinical/scientific support or clear safety consensus.
- `moderate`: plausible and commonly accepted with some direct evidence.
- `weak`: indirect evidence, professional practice, or mixed findings.
- `unknown`: insufficient support; do not turn into runtime rule.

## Source Standards

Prefer:

- Dermatology or medical organizations for scalp, dandruff, shedding, thinning, irritation, and hair-loss boundaries.
- Peer-reviewed cosmetic science, dermatology, or trichology literature for fiber damage, friction, conditioning, shine, frizz, breakage, color fading, and curl definition.
- Regulatory or consensus guidance for safety boundaries.
- Professional practice sources only when scientific evidence is weak, labeled as practice consensus rather than proof.

Avoid:

- Influencer claims as primary evidence.
- Brand marketing as proof of efficacy.
- Exact product protocols unless later grounded by product metadata.
- Strong causal claims when evidence is only plausible or indirect.

## Required Research Note Shape

Each workstream note must include:

- scoped goals/concerns covered,
- source list with links,
- evidence labels,
- practical lever map,
- profile modifiers,
- conflicts,
- runtime implications,
- open risks.

## Subagent Stop Line

Research subagents may create or return only their assigned research note. They must not edit:

- `data/agent-v2/guidance/**`
- `src/**`
- `tests/**`
- product catalog/data files
- onboarding vocabulary files

Subagents must flag unresolved conflicts instead of inventing a rule.

