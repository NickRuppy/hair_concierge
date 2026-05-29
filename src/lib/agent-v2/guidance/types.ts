import type {
  AgentV2AskWhen,
  AgentV2GuidanceRule,
  AgentV2LoadedGuidancePackage,
  AgentV2RequiredGrounding,
  AgentV2GuidanceSoftRubric,
} from "@/lib/agent-v2/contracts"

export interface AgentV2CompiledGuidance {
  packages: AgentV2LoadedGuidancePackage[]
  hard_rules: AgentV2GuidanceRule[]
  soft_rubrics: AgentV2GuidanceSoftRubric[]
  required_grounding: AgentV2RequiredGrounding[]
  ask_when: AgentV2AskWhen[]
  markdown_brief: string
}
