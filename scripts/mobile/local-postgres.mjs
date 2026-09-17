import { spawn, spawnSync } from "node:child_process"
import { loadLocalEnvironment } from "./local-stack.mjs"

const docker = "/opt/homebrew/bin/docker"
const env = {
  PATH: "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin",
  HOME: process.env.HOME,
  DOCKER_HOST: "unix:///Users/nick/.colima/chaarlie/docker.sock",
}
const args = [
  "exec",
  "-i",
  "supabase_db_chaarlie-mobile-b1",
  "psql",
  "-X",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
]

export function executeLocalSQL(sql) {
  loadLocalEnvironment()
  const result = spawnSync(docker, args, { env, input: sql, encoding: "utf8" })
  if (result.status !== 0)
    throw new Error("Local PostgreSQL rejected fixture SQL: " + result.stderr.slice(0, 1400))
  return result.stdout
}

/** Holds a source write open so the HTTP publisher must wait on the real clock lock. */
export async function holdProfileWrite(userId, thickness) {
  loadLocalEnvironment()
  if (!/^[0-9a-f-]{36}$/.test(userId) || !["fine", "coarse"].includes(thickness))
    throw new Error("Invalid local lock fixture")
  const process = spawn(docker, args, { env, stdio: ["pipe", "pipe", "pipe"] })
  let output = ""
  let finished = false
  const closed = new Promise((resolve, reject) => {
    process.once("error", reject)
    process.once("exit", (code) => {
      finished = true
      if (code === 0) resolve()
      else reject(new Error("Local transaction failed"))
    })
  })
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local transaction lock timeout")), 10000)
    process.stdout.on("data", (data) => {
      output += data.toString()
      if (output.includes("LOCK_HELD")) {
        clearTimeout(timer)
        resolve()
      }
    })
    process.once("exit", () => {
      clearTimeout(timer)
      if (!output.includes("LOCK_HELD")) reject(new Error("Local transaction lock failed"))
    })
  })
  process.stderr.resume()
  process.stdin.write(
    `BEGIN;\nUPDATE public.hair_profiles SET thickness='${thickness}' WHERE user_id='${userId}';\n\\echo LOCK_HELD\n`,
  )
  try {
    await ready
  } catch (error) {
    process.stdin.end("ROLLBACK;\n")
    await closed.catch(() => {})
    throw error
  }
  return {
    async finish(commit) {
      if (!finished) process.stdin.end(commit ? "COMMIT;\n" : "ROLLBACK;\n")
      await closed
    },
  }
}
