import { execFile, execFileSync, spawn } from "node:child_process"
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs"
import net from "node:net"
import { dirname, join, resolve } from "node:path"

type LaunchOptions = {
  openBrowser: boolean
  port: number
}

type RunningProcess = {
  pid: number
  command: string
  cwd: string | null
}

const DEFAULT_PORT = 3910
const LOCAL_HOST = "127.0.0.1"

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const repoRoot = findRepoRoot(process.cwd())

  if (!repoRoot) {
    throw new Error("Repo root konnte nicht gefunden werden.")
  }

  const logDir = join(repoRoot, ".tmp/product-intake-review-center")
  mkdirSync(logDir, { recursive: true })

  const url = `http://localhost:${options.port}`
  const appProcess = findListeningProcess(options.port)
  const appWasRunning = Boolean(appProcess)
  const workerWasRunning = findRunningWorkerProcess()

  if (appProcess) {
    assertProcessBelongsToRepo(
      appProcess,
      repoRoot,
      `Port ${options.port} ist bereits von einem anderen Worktree belegt.`,
    )
    console.log(`Review Center laeuft bereits auf ${url} (pid ${appProcess.pid}).`)
  } else {
    const appLog = join(logDir, "review-center.log")
    const app = spawnDetached(
      "npm",
      [
        "run",
        "dev",
        "--workspace",
        "@chaarlie/product-intake-review",
        "--",
        "--hostname",
        LOCAL_HOST,
        "--port",
        String(options.port),
      ],
      repoRoot,
      appLog,
    )
    console.log(`Review Center gestartet (pid ${app.pid ?? "?"}). Log: ${appLog}`)
  }

  if (workerWasRunning) {
    assertProcessBelongsToRepo(
      workerWasRunning,
      repoRoot,
      "Ein Codex Worker laeuft bereits aus einem anderen Worktree.",
    )
    console.log(`Codex Worker laeuft bereits (pid ${workerWasRunning.pid}).`)
  } else {
    const workerLog = join(logDir, "codex-worker.log")
    const worker = spawnDetached(
      "npm",
      [
        "run",
        "products:intake:codex-worker",
        "--",
        "--execute-codex",
        "--watch",
        "--concurrency",
        "2",
        "--poll-ms",
        "5000",
      ],
      repoRoot,
      workerLog,
      {
        PRODUCT_INTAKE_CODEX_CONCURRENCY: "2",
        PRODUCT_INTAKE_CODEX_WORKER_POLL_MS: "5000",
      },
    )
    console.log(`Codex Worker gestartet (pid ${worker.pid ?? "?"}). Log: ${workerLog}`)
  }

  if (!appWasRunning) {
    await waitForPort(options.port, 20_000)
  }

  if (options.openBrowser) {
    await openUrl(url)
  } else {
    console.log(`Browser nicht geoeffnet. URL: ${url}`)
  }

  console.log("Product Intake Review Center ist bereit.")
}

function parseArgs(args: string[]): LaunchOptions {
  let openBrowser = true
  let port = DEFAULT_PORT

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--no-open") {
      openBrowser = false
      continue
    }
    if (arg === "--port") {
      const value = args[index + 1]
      if (!value) throw new Error("--port braucht einen Wert.")
      port = Number.parseInt(value, 10)
      index += 1
      continue
    }
    if (arg?.startsWith("--port=")) {
      port = Number.parseInt(arg.slice("--port=".length), 10)
      continue
    }
  }

  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`Ungueltiger Port: ${port}`)
  }

  return { openBrowser, port }
}

function spawnDetached(
  command: string,
  args: string[],
  cwd: string,
  logFile: string,
  envOverrides: NodeJS.ProcessEnv = {},
) {
  const out = openSync(logFile, "a")
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdio: ["ignore", out, out],
  })
  closeSync(out)
  child.unref()
  return child
}

function findRunningWorkerProcess(): RunningProcess | null {
  try {
    const output = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    const currentPid = process.pid
    for (const rawLine of output.split("\n")) {
      const line = rawLine.trim()
      if (!line || !line.includes("products:intake:codex-worker")) continue
      if (line.includes("review-center-launcher")) continue
      const match = line.match(/^(\d+)\s+(.+)$/)
      if (!match) continue
      const pid = Number.parseInt(match[1] ?? "", 10)
      if (!Number.isFinite(pid) || pid === currentPid) continue
      return { pid, command: match[2] ?? line, cwd: findProcessCwd(pid) }
    }
  } catch {
    return null
  }

  return null
}

function findListeningProcess(port: number): RunningProcess | null {
  try {
    const output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    const pidLine = output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("p"))
    const pid = Number.parseInt(pidLine?.slice(1) ?? "", 10)
    if (!Number.isFinite(pid)) return null

    return {
      pid,
      command: findProcessCommand(pid) ?? `pid ${pid}`,
      cwd: findProcessCwd(pid),
    }
  } catch {
    return null
  }
}

function findProcessCommand(pid: number): string | null {
  try {
    const output = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return output.length > 0 ? output : null
  } catch {
    return null
  }
}

function findProcessCwd(pid: number): string | null {
  try {
    const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    const cwdLine = output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("n"))
    return cwdLine ? cwdLine.slice(1) : null
  } catch {
    return null
  }
}

function assertProcessBelongsToRepo(
  processInfo: RunningProcess,
  repoRoot: string,
  message: string,
) {
  if (processBelongsToRepo(processInfo, repoRoot)) return

  const cwd = processInfo.cwd ?? "unbekannt"
  throw new Error(
    `${message} pid=${processInfo.pid}; cwd=${cwd}; command=${processInfo.command}. ` +
      "Beende diesen Prozess oder starte den Launcher aus dem passenden Worktree.",
  )
}

function processBelongsToRepo(processInfo: RunningProcess, repoRoot: string) {
  const normalizedRepo = resolve(repoRoot)
  if (processInfo.cwd) {
    const normalizedCwd = resolve(processInfo.cwd)
    return normalizedCwd === normalizedRepo || normalizedCwd.startsWith(`${normalizedRepo}/`)
  }

  return processInfo.command.includes(normalizedRepo)
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: LOCAL_HOST, port })
    socket.setTimeout(500)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => {
      resolve(false)
    })
  })
}

async function waitForPort(port: number, timeoutMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortListening(port)) return
    await sleep(500)
  }
  throw new Error(`Review Center ist nach ${timeoutMs}ms noch nicht auf Port ${port} erreichbar.`)
}

function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("open", [url], (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function findRepoRoot(startDir: string): string | null {
  let current = startDir

  for (let depth = 0; depth < 8; depth += 1) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "apps/product-intake-review/package.json")) &&
      existsSync(join(current, "scripts/product-intake/codex-research-worker.ts"))
    ) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }

  return null
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Product Intake Review Center konnte nicht gestartet werden: ${message}`)
  process.exitCode = 1
})
