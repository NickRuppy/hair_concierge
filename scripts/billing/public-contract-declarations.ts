import { readFile } from "node:fs/promises"
import {
  applyMatchedPublicTrialCancellation,
  completePublicContractDeclarationResolution,
  inspectPublicContractDeclarationResolution,
  matchPublicContractDeclaration,
} from "../../src/lib/billing/public-contract-declaration-resolution"
import { pathToFileURL } from "node:url"
import { createAdminClient } from "../../src/lib/supabase/admin"
import type { PublicDeclarationClient } from "../../src/lib/billing/public-contract-declarations"

/** Read-only operator entry: list is PII-free; an exact id explicitly opens submitted details. */
export async function readPublicContractDeclarations(
  argv: string[],
  client: PublicDeclarationClient,
) {
  if (argv.length < 1 || argv.length > 2)
    throw new Error("Use --list [--offset=100] or --declaration=<UUID>")
  const arg = argv[0]
  let name: string, args: Record<string, unknown>
  if (arg === "--list") {
    if (argv[1] && !/^--offset=\d{1,7}$/.test(argv[1])) throw new Error("Invalid list offset")
    name = "list_public_contract_declarations_for_review"
    args = { p_limit: 100, p_offset: argv[1] ? Number(argv[1].slice("--offset=".length)) : 0 }
  } else if (
    argv.length === 1 &&
    /^--declaration=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg)
  ) {
    name = "get_public_contract_declaration_for_review"
    args = { p_declaration_id: arg.slice("--declaration=".length) }
  } else throw new Error("Use --list or --declaration=<UUID>; mutations are not supported")
  const { data, error } = await client.rpc(name, args)
  if (error || !Array.isArray(data)) throw new Error("Public declaration review queue unavailable")
  return { mode: "read-only", rows: data }
}

/** Explicit trusted operator commands; no submitted-email matching or provider calls. */
export async function runPublicContractDeclarationCommand(
  argv: string[],
  client: PublicDeclarationClient,
  readEvidence: (path: string) => Promise<string> = (path) => readFile(path, "utf8"),
) {
  if (argv[0]?.startsWith("--")) return readPublicContractDeclarations(argv, client)
  const command = argv[0]
  const options: Record<string, string> = {}
  for (const arg of argv.slice(1)) {
    const parsed = /^--([a-z-]+)=(.+)$/.exec(arg)
    if (!parsed || Object.hasOwn(options, parsed[1]!))
      throw new Error("Invalid or repeated resolution option")
    options[parsed[1]!] = parsed[2]!
  }
  function fields(required: string[]) {
    if (Object.keys(options).length !== required.length || !required.every((k) => options[k]))
      throw new Error("Missing or unknown resolution option")
  }
  if (command === "inspect") {
    fields(["declaration"])
    return {
      mode: "read-only",
      resolution: await inspectPublicContractDeclarationResolution(client, options.declaration!),
    }
  }
  if (command === "match") {
    fields(["declaration", "user", "enrollment", "verification-reference"])
    return {
      mode: "match",
      result: await matchPublicContractDeclaration(client, {
        declarationId: options.declaration!,
        verifiedUserId: options.user!,
        enrollmentId: options.enrollment!,
        verificationReference: options["verification-reference"]!,
      }),
    }
  }
  if (command === "apply") {
    fields(["declaration", "interpretation-reference"])
    return {
      mode: "apply",
      result: await applyMatchedPublicTrialCancellation(client, {
        declarationId: options.declaration!,
        interpretationReference: options["interpretation-reference"]!,
      }),
    }
  }
  if (command === "complete") {
    fields(["declaration", "evidence-file"])
    const evidence = JSON.parse(await readEvidence(options["evidence-file"]!)) as unknown
    return {
      mode: "complete",
      result: await completePublicContractDeclarationResolution(client, {
        declarationId: options.declaration!,
        evidence,
      }),
    }
  }
  throw new Error("Use --list, --declaration=<UUID>, inspect, match, apply, or complete")
}

async function main() {
  const result = await runPublicContractDeclarationCommand(
    process.argv.slice(2),
    createAdminClient(),
  )
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error(
      "Public declaration operation failed. Inspect the exact case, command arguments and verified evidence with configured service access. No provider execution or message send is performed by this CLI.",
    )
    process.exitCode = 1
  })
}
