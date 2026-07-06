import { execFileSync, spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

export type LocalWorkerKickResult = {
  ready: boolean
  started: boolean
  alreadyRunning?: boolean
  pid: number | null
  command: string
  reason?: string
}

const LOCAL_CODEX_WORKER_ARGS = [
  "run",
  "products:intake:codex-worker",
  "--",
  "--execute-codex",
  "--watch",
  "--concurrency",
  "2",
  "--poll-ms",
  "5000",
]
const LOCAL_CODEX_WORKER_COMMAND =
  "npm run products:intake:codex-worker -- --execute-codex --watch --concurrency=2 --poll-ms=5000"

export function kickLocalCodexWorker(): LocalWorkerKickResult {
  const repoRoot = findRepoRoot(process.cwd())
  if (!repoRoot) {
    return {
      ready: false,
      started: false,
      pid: null,
      command: LOCAL_CODEX_WORKER_COMMAND,
      reason: "Repo root konnte nicht gefunden werden.",
    }
  }

  const runningWorker = findRunningWorkerProcess()
  if (runningWorker) {
    return {
      ready: true,
      started: false,
      alreadyRunning: true,
      pid: runningWorker.pid,
      command: runningWorker.command,
      reason: "Lokaler Worker laeuft bereits.",
    }
  }

  const child = spawn("npm", LOCAL_CODEX_WORKER_ARGS, {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      PRODUCT_INTAKE_CODEX_CONCURRENCY: process.env.PRODUCT_INTAKE_CODEX_CONCURRENCY ?? "2",
      PRODUCT_INTAKE_CODEX_WORKER_POLL_MS:
        process.env.PRODUCT_INTAKE_CODEX_WORKER_POLL_MS ?? "5000",
    },
    stdio: "ignore",
  })
  child.unref()

  return {
    ready: true,
    started: true,
    pid: child.pid ?? null,
    command: LOCAL_CODEX_WORKER_COMMAND,
  }
}

function findRunningWorkerProcess(): { pid: number; command: string } | null {
  try {
    const output = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    const currentPid = process.pid
    for (const rawLine of output.split("\n")) {
      const line = rawLine.trim()
      if (!line) continue
      if (!line.includes("products:intake:codex-worker")) continue
      const match = line.match(/^(\d+)\s+(.+)$/)
      if (!match) continue
      const pid = Number.parseInt(match[1] ?? "", 10)
      if (!Number.isFinite(pid) || pid === currentPid) continue
      return { pid, command: match[2] ?? line }
    }
  } catch {
    return null
  }

  return null
}

function findRepoRoot(startDir: string): string | null {
  let current = startDir

  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(current, "scripts/product-intake/codex-research-worker.ts"))) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }

  return null
}
