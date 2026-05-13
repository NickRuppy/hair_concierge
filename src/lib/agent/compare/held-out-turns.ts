import type { AgentCompareMultiTurnChain } from "./prompt-packs"

// Real held-out user-testing turns are intentionally not checked into this prototype yet.
// Production rollout requires the larger private held-out set described in the plan.
export const HELD_OUT_AGENT_COMPARE_TURNS: AgentCompareMultiTurnChain[] = []
