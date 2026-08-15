import { config as loadEnv } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { join, sep } from "node:path"
import { pathToFileURL } from "node:url"

import { createClient } from "@supabase/supabase-js"

import { auditCatalogAuthority } from "../../src/lib/catalog-authority/audit"
import { readCatalogAuthorityAuditSnapshot } from "../../src/lib/catalog-authority/audit-reader"
import {
  catalogAuthorityAuditSnapshotSchema,
  catalogAuditSchemaObjectSchema,
  type CatalogAuditSchemaObject,
} from "../../src/lib/catalog-authority/contracts"
import {
  createSupabaseCatalogAuditSource,
  type CatalogAuditSupabaseClient,
} from "../../src/lib/catalog-authority/supabase-audit-source"

type Options = {
  inputPath: string | null
  schemaInputPath: string | null
  pretty: boolean
  allowIssues: boolean
}

export function parseCatalogAuthorityAuditArgs(argv: string[]): Options {
  const options: Options = {
    inputPath: null,
    schemaInputPath: null,
    pretty: false,
    allowIssues: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--pretty") options.pretty = true
    else if (argument === "--allow-issues") options.allowIssues = true
    else if (argument === "--input") options.inputPath = requiredValue(argv, ++index, argument)
    else if (argument === "--schema-input")
      options.schemaInputPath = requiredValue(argv, ++index, argument)
    else throw new Error(`unknown catalog authority audit argument: ${argument}`)
  }
  return options
}

export async function runCatalogAuthorityAudit(argv: string[]): Promise<number> {
  const options = parseCatalogAuthorityAuditArgs(argv)
  const schemaObjects = options.schemaInputPath
    ? readSchemaObjects(options.schemaInputPath)
    : undefined
  const snapshot = options.inputPath
    ? catalogAuthorityAuditSnapshotSchema.parse(readJson(options.inputPath))
    : await readLiveSnapshot(schemaObjects)
  const auditedSnapshot = schemaObjects === undefined ? snapshot : { ...snapshot, schemaObjects }
  const receipt = auditCatalogAuthority(auditedSnapshot)
  process.stdout.write(`${JSON.stringify(receipt, null, options.pretty ? 2 : undefined)}\n`)
  process.stderr.write(
    `catalog authority audit: ${receipt.productCount} products, ${receipt.issues.length} issues, mode=${receipt.mode}\n`,
  )
  return receipt.clean || options.allowIssues ? 0 : 1
}

async function readLiveSnapshot(schemaObjects?: CatalogAuditSchemaObject[]) {
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("catalog_audit_supabase_credentials_missing")
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const source = createSupabaseCatalogAuditSource(client as unknown as CatalogAuditSupabaseClient)
  return readCatalogAuthorityAuditSnapshot(source, { schemaObjects: schemaObjects ?? null })
}

function readSchemaObjects(path: string): CatalogAuditSchemaObject[] {
  const value = readJson(path)
  const rows = unwrapSchemaObjects(value)
  return catalogAuditSchemaObjectSchema.array().parse(rows)
}

function unwrapSchemaObjects(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 1 && value[0] && typeof value[0] === "object" && "receipt" in value[0]) {
      return unwrapSchemaObjects((value[0] as { receipt: unknown }).receipt)
    }
    if (
      value.length === 1 &&
      value[0] &&
      typeof value[0] === "object" &&
      "schemaObjects" in value[0]
    ) {
      return unwrapSchemaObjects(value[0])
    }
    return value
  }
  if (value && typeof value === "object" && "receipt" in value) {
    return unwrapSchemaObjects((value as { receipt: unknown }).receipt)
  }
  if (value && typeof value === "object" && "schemaObjects" in value) {
    return (value as { schemaObjects: unknown }).schemaObjects
  }
  return null
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
  return value
}

function loadLocalEnv(): void {
  const cwd = process.cwd()
  const candidates = [join(cwd, ".env.local")]
  const worktreeIndex = cwd.indexOf(`${sep}.worktrees${sep}`)
  if (worktreeIndex >= 0) candidates.push(join(cwd.slice(0, worktreeIndex), ".env.local"))
  for (const envPath of [...new Set(candidates)]) {
    if (existsSync(envPath)) loadEnv({ path: envPath })
  }
}

function isMain(): boolean {
  const entry = process.argv[1]
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href)
}

if (isMain()) {
  runCatalogAuthorityAudit(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    })
}
