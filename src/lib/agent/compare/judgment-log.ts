import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"
import type { AgentCompareJudgmentRecord } from "./types"

export const AGENT_COMPARE_RUNS_LOG_PATH = path.join(
  process.cwd(),
  "tmp",
  "agent-compare-runs.jsonl",
)

export async function appendAgentCompareJudgmentLog(
  record: AgentCompareJudgmentRecord,
  logPath: string = AGENT_COMPARE_RUNS_LOG_PATH,
): Promise<void> {
  await mkdir(path.dirname(logPath), { recursive: true })
  await appendFile(logPath, `${JSON.stringify(record)}\n`, "utf8")
}
