import { readFile } from "node:fs/promises"
import path from "node:path"

import { AgentV2GuidancePackageSchema } from "@/lib/agent-v2/contracts"
import type { AgentV2CompiledGuidance } from "@/lib/agent-v2/guidance/types"
import { getAgentV2GuidancePackageEntry } from "@/lib/agent-v2/guidance/package-index"

export async function loadAgentV2GuidancePackages(ids: string[]): Promise<AgentV2CompiledGuidance> {
  const packages = []

  for (const id of ids) {
    const entry = getAgentV2GuidancePackageEntry(id)
    if (!entry) {
      throw new Error(`Unknown AgentV2 guidance package: ${id}`)
    }

    const metadataJson = await readFile(fromRepoRoot(entry.metadataPath), "utf8")
    const metadata = AgentV2GuidancePackageSchema.parse(JSON.parse(metadataJson))
    if (metadata.package_id !== id) {
      throw new Error(`AgentV2 guidance package id mismatch for ${id}`)
    }

    const expectedMarkdownPath = entry.markdownPath.replace("data/agent-v2/guidance/", "")
    if (metadata.markdown_path !== expectedMarkdownPath) {
      throw new Error(`AgentV2 guidance markdown_path mismatch for ${id}`)
    }

    const markdown_brief = await readFile(fromRepoRoot(entry.markdownPath), "utf8")
    packages.push({
      ...metadata,
      markdown_brief,
    })
  }

  return {
    packages,
    hard_rules: packages.flatMap((pkg) => pkg.hard_rules),
    soft_rubrics: packages.flatMap((pkg) => pkg.soft_rubrics),
    required_grounding: packages.flatMap((pkg) => pkg.required_grounding),
    ask_when: packages.flatMap((pkg) => pkg.ask_when),
    markdown_brief: packages
      .map((pkg) => `<!-- ${pkg.package_id} -->\n${pkg.markdown_brief.trim()}`)
      .join("\n\n"),
  }
}

function fromRepoRoot(relativePath: string): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), relativePath)
}
