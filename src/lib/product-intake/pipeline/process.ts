import {
  spawn,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from "node:child_process"

export type WorkerSpawn = (
  command: string,
  args: string[],
  options: SpawnSyncOptionsWithStringEncoding,
) => SpawnSyncReturns<string> | Promise<SpawnSyncReturns<string>>

// Preserve the result/error contract of spawnSync without blocking heartbeats.
export function runWorkerProcess(
  command: string,
  args: string[],
  options: SpawnSyncOptionsWithStringEncoding,
): Promise<SpawnSyncReturns<string>> {
  return new Promise((resolveResult) => {
    const { timeout, maxBuffer = 1024 * 1024, encoding: _encoding, ...spawnOptions } = options
    void _encoding
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutSize = 0
    let stderrSize = 0
    let error: Error | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let killTimer: ReturnType<typeof setTimeout> | undefined
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    let terminated = false
    const child = spawn(command, args, {
      ...spawnOptions,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    const signalGroup = (signal: NodeJS.Signals) => {
      try {
        if (!child.pid) throw new Error("Child has no process group")
        process.kill(-child.pid, signal)
      } catch {
        child.kill(signal)
      }
    }
    const finish = (status: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(killTimer)
      clearTimeout(settleTimer)
      if (terminated) signalGroup("SIGKILL")
      child.stdout?.destroy()
      child.stderr?.destroy()
      resolveResult({
        pid: child.pid ?? 0,
        output: [],
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        status,
        signal,
        error,
      })
    }
    const settleAfterGrace = () => {
      // Pipes can outlive the leader, even after a process-group kill. Bound that wait.
      settleTimer ??= setTimeout(() => finish(child.exitCode, child.signalCode), 2_000)
    }
    const terminate = (failure: Error) => {
      if (error) return
      error = failure
      terminated = true
      signalGroup("SIGTERM")
      killTimer = setTimeout(() => signalGroup("SIGKILL"), 1_000)
      settleAfterGrace()
    }
    const collect = (stream: "stdout" | "stderr", chunk: Buffer) => {
      const size = stream === "stdout" ? stdoutSize : stderrSize
      const remaining = Math.max(0, maxBuffer - size)
      const accepted = chunk.subarray(0, remaining)
      if (stream === "stdout") {
        if (accepted.length) stdout.push(accepted)
        stdoutSize += accepted.length
      } else {
        if (accepted.length) stderr.push(accepted)
        stderrSize += accepted.length
      }
      if (chunk.length > remaining) {
        terminate(
          Object.assign(new Error(`${command} output exceeded maxBuffer`), { code: "ENOBUFS" }),
        )
      }
    }
    child.stdout?.on("data", (chunk: Buffer) => collect("stdout", chunk))
    child.stderr?.on("data", (chunk: Buffer) => collect("stderr", chunk))
    child.on("error", (failure) => {
      error ??= failure
    })
    child.on("exit", () => {
      if (error) settleAfterGrace()
    })
    child.on("close", finish)
    if (timeout && timeout > 0) {
      timer = setTimeout(
        () => terminate(Object.assign(new Error(`${command} ETIMEDOUT`), { code: "ETIMEDOUT" })),
        timeout,
      )
    }
  })
}
