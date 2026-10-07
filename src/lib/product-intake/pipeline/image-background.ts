import { existsSync, mkdirSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { createHash } from "node:crypto"

import { runWorkerProcess, type WorkerSpawn } from "./process"
import { errorMessage } from "./shared"

export type RembgRuntimeConfig = {
  enabled: boolean
  dockerBin: string
  image: string
  model: "isnet-general-use"
  modelDir: string
  timeoutMs: number
}

const REMBG_IMAGE =
  "danielgatis/rembg@sha256:98e72b790093dec3b21967e22c8eb75a0a67d458fdba7ef5fcc1900cad76396b"

const REMBG_MODEL = "isnet-general-use" as const

export async function runVisionBackgroundRemoval(params: {
  sourceFile: string
  outputDir: string
  outputSlug: string
}): Promise<string | null> {
  const direct = await runWorkerProcess(
    "swift",
    ["scripts/product-images/removebg.swift", params.outputDir, params.sourceFile],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    },
  )
  const sourceBase = basename(params.sourceFile).replace(/\.[^.]+$/, "")
  const directOutput = join(params.outputDir, `${sourceBase}.png`)
  if (!direct.error && direct.status === 0 && existsSync(directOutput)) return directOutput

  const paddedOutput = join(params.outputDir, `${params.outputSlug}-vision-padded.png`)
  const padded = await runWorkerProcess(
    "swift",
    ["scripts/product-images/removebg-padded.swift", params.sourceFile, paddedOutput],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    },
  )

  if (!padded.error && padded.status === 0 && existsSync(paddedOutput)) return paddedOutput
  return null
}

export async function runAutomaticBackgroundRemoval(params: {
  sourceFile: string
  outputDir: string
  outputSlug: string
}): Promise<{ file: string; method: "vision" | "rembg_isnet_general_use" } | null> {
  if (process.platform === "darwin") {
    const visionFile = await runVisionBackgroundRemoval(params)
    if (visionFile) return { file: visionFile, method: "vision" }
  }

  const rembg = await runRembgContainer({
    sourceFile: params.sourceFile,
    outputFile: join(params.outputDir, `${params.outputSlug}-rembg-isnet.png`),
    config: rembgRuntimeConfig(process.env),
  })
  return rembg ? { file: rembg, method: "rembg_isnet_general_use" } : null
}

export function rembgRuntimeConfig(env: Record<string, string | undefined>): RembgRuntimeConfig {
  const enabled = /^(1|true|yes|on)$/i.test(env.PRODUCT_INTAKE_REMBG_ENABLED?.trim() ?? "")
  const parsedTimeout = Number.parseInt(env.PRODUCT_INTAKE_REMBG_TIMEOUT_MS ?? "", 10)
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.max(30_000, Math.min(parsedTimeout, 10 * 60_000))
    : 3 * 60_000

  return {
    enabled,
    dockerBin: env.PRODUCT_INTAKE_REMBG_DOCKER_BIN?.trim() || "docker",
    image: REMBG_IMAGE,
    model: REMBG_MODEL,
    modelDir:
      env.PRODUCT_INTAKE_REMBG_MODEL_DIR?.trim() ||
      join(process.cwd(), "tmp", "product-intake-rembg-models"),
    timeoutMs,
  }
}

export function finalizedImageOutputRoot(
  env: Readonly<Record<string, string | undefined>>,
  cwd = process.cwd(),
): string {
  return (
    env.PRODUCT_INTAKE_FINALIZED_IMAGE_DIR?.trim() ||
    join(cwd, "apps/product-intake-review/public/product-intake-finalized")
  )
}

export function rembgContainerArgs(params: {
  config: RembgRuntimeConfig
  sourceFile: string
  outputFile: string
}): string[] {
  const sourceDir = resolve(dirname(params.sourceFile))
  const outputDir = resolve(dirname(params.outputFile))
  const modelDir = resolve(params.config.modelDir)

  return [
    "run",
    "--rm",
    "--network=none",
    "--memory=2500m",
    "--memory-swap=3g",
    "--cpus=2",
    "--pids-limit=256",
    "--read-only",
    "--name",
    rembgContainerName(params.outputFile),
    "--tmpfs=/tmp:rw,nosuid,nodev,size=256m",
    "--tmpfs=/root/.cache:rw,nosuid,nodev,size=128m",
    "--env",
    "NUMBA_CACHE_DIR=/tmp/numba",
    "--env",
    "XDG_CACHE_HOME=/tmp/cache",
    "-v",
    `${sourceDir}:/input:ro`,
    "-v",
    `${outputDir}:/output`,
    "-v",
    `${modelDir}:/root/.rembg:ro`,
    params.config.image,
    "i",
    "-m",
    params.config.model,
    `/input/${basename(params.sourceFile)}`,
    `/output/${basename(params.outputFile)}`,
  ]
}

export async function runRembgContainer(
  params: {
    config: RembgRuntimeConfig
    sourceFile: string
    outputFile: string
  },
  spawn: WorkerSpawn = runWorkerProcess,
): Promise<string | null> {
  if (!params.config.enabled) return null
  mkdirSync(dirname(params.outputFile), { recursive: true })
  mkdirSync(params.config.modelDir, { recursive: true })

  const name = rembgContainerName(params.outputFile)
  let detail = ""
  try {
    const result = await spawn(params.config.dockerBin, rembgContainerArgs(params), {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 10,
      timeout: params.config.timeoutMs,
    })
    if (!result.error && result.status === 0 && existsSync(params.outputFile)) {
      return params.outputFile
    }
    detail = [result.error?.message, result.stderr?.trim()]
      .filter((value): value is string => Boolean(value))
      .join("; ")
  } catch (error) {
    detail = errorMessage(error)
  }
  await removeRembgContainer(name, spawn, params.config.dockerBin)
  console.error(`rembg background removal failed${detail ? `: ${detail}` : "."}`)
  return null
}

export function rembgContainerName(outputFile: string): string {
  const id = createHash("sha256").update(resolve(outputFile)).digest("hex").slice(0, 24)
  return `chaarlie-rembg-${id}`
}

export async function removeRembgContainer(
  name: string,
  spawn: WorkerSpawn,
  dockerBin: string,
): Promise<void> {
  try {
    await spawn(dockerBin, ["rm", "-f", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    })
  } catch {
    // Cleanup is best effort, including when Docker is unavailable.
  }
}

export async function cleanupStaleRembgContainers(
  spawn: WorkerSpawn = runWorkerProcess,
  dockerBin = rembgRuntimeConfig(process.env).dockerBin,
): Promise<void> {
  try {
    const containers = await spawn(
      dockerBin,
      ["ps", "-a", "--filter", "name=chaarlie-rembg-", "--format", "{{.Names}}"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 },
    )
    if (containers.error || containers.status !== 0) return
    for (const name of containers.stdout.split(/\r?\n/).map((value) => value.trim())) {
      if (/^chaarlie-rembg-[a-zA-Z0-9_.-]+$/.test(name)) {
        await removeRembgContainer(name, spawn, dockerBin)
      }
    }
  } catch {
    // A missing Docker binary must not prevent the research worker from starting.
  }
}
