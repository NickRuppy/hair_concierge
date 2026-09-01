import { config as loadEnv } from "dotenv"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  createPartnerInvitations,
  listPartnerInvitations,
  mutatePartnerInvitation,
  type PartnerInvitationInput,
} from "../src/lib/partner-access/service"

const PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const WRITE_GATE = "ALLOW_PARTNER_ACCESS_PRODUCTION_WRITE"
const CONFIRM_PROJECT = `--confirm-project=${PROJECT_ID}`

export type PartnerAccessCommand =
  | { action: "list" }
  | { action: "create"; apply: boolean; creators: PartnerInvitationInput[] }
  | {
      action: "revoke" | "reactivate" | "rotate"
      apply: boolean
      invitationId: string
    }

function value(args: readonly string[], name: string) {
  const prefix = `${name}=`
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

export async function parsePartnerAccessCommand(
  args: readonly string[],
  readText: (path: string) => Promise<string> = (path) => readFile(path, "utf8"),
): Promise<PartnerAccessCommand> {
  const [action] = args
  if (action === "list") return { action }
  if (action === "create") {
    const file = value(args, "--file")
    let creators: unknown
    if (file) {
      creators = JSON.parse(await readText(file))
    } else {
      creators = [{ name: value(args, "--name"), email: value(args, "--email") }]
    }
    if (!Array.isArray(creators) || creators.length < 1 || creators.length > 100) {
      throw new Error("create requires 1-100 creators")
    }
    return {
      action,
      apply: args.includes("--apply"),
      creators: creators.map((creator) => {
        if (!creator || typeof creator !== "object") throw new Error("invalid creator entry")
        const row = creator as Record<string, unknown>
        if (typeof row.name !== "string" || typeof row.email !== "string") {
          throw new Error("each creator requires name and email")
        }
        return { name: row.name, email: row.email }
      }),
    }
  }
  if (action === "revoke" || action === "reactivate" || action === "rotate") {
    const invitationId = value(args, "--invitation")
    if (!invitationId) throw new Error(`${action} requires --invitation=<uuid>`)
    return { action, apply: args.includes("--apply"), invitationId }
  }
  throw new Error(
    "Usage: list | create (--name=<name> --email=<email> | --file=<json>) | revoke|reactivate|rotate --invitation=<uuid>",
  )
}

export function canApplyPartnerAccess(
  args: readonly string[],
  environment: Record<string, string | undefined>,
) {
  let projectId: string | null = null
  try {
    projectId = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0]
  } catch {
    projectId = null
  }
  return (
    args.includes("--apply") &&
    args.includes(CONFIRM_PROJECT) &&
    environment[WRITE_GATE]?.trim() === "1" &&
    projectId === PROJECT_ID
  )
}

export async function runPartnerAccessCommand(input: {
  args: readonly string[]
  environment: Record<string, string | undefined>
  log?: (value: unknown) => void
}) {
  const command = await parsePartnerAccessCommand(input.args)
  const log = input.log ?? console.log
  if (command.action === "list") {
    log(await listPartnerInvitations())
    return
  }
  if (!command.apply) {
    log({ mode: "dry-run", writes: false, ...command })
    return
  }
  if (!canApplyPartnerAccess(input.args, input.environment)) {
    throw new Error(
      `Writes require ${WRITE_GATE}=1, ${CONFIRM_PROJECT}, --apply, and the matching Supabase URL`,
    )
  }
  if (command.action === "create") {
    log(await createPartnerInvitations(command.creators))
    return
  }
  log(await mutatePartnerInvitation(command.action, command.invitationId))
}

async function main() {
  loadEnv({ path: resolve(process.cwd(), ".env.local") })
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment is not configured")
  }
  await runPartnerAccessCommand({ args: process.argv.slice(2), environment: process.env })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
