import { pathToFileURL } from "node:url"
import { createAdminClient } from "../../src/lib/supabase/admin"
import {
  applyTrialIdentityRights,
  configureTrialIdentityKeyVersions,
  inspectTrialIdentityRights,
  type TrialIdentityRightsSource,
} from "../../src/lib/billing/trial-identity-rights"
type Client = Parameters<typeof inspectTrialIdentityRights>[0]
export async function runTrialIdentityRights(argv: string[], client: Client) {
  const [command, ...args] = argv
  const options = new Map<string, string>()
  for (const arg of args) {
    const match = /^(--source-kind|--source-id|--reference|--kinds|--versions)=(.+)$/.exec(arg)
    if (arg === "--apply" && !options.has("--apply")) options.set("--apply", "true")
    else if (match && !options.has(match[1]!)) options.set(match[1]!, match[2]!)
    else throw new Error("Invalid rights command options")
  }
  const apply = options.has("--apply")
  if (command === "keys") {
    if (
      [...options.keys()].some((key) => !["--versions", "--apply"].includes(key)) ||
      !/^\d+(,\d+)*$/.test(options.get("--versions") ?? "")
    )
      throw new Error("Use keys --versions=1,2 [--apply]")
    const versions = options.get("--versions")!.split(",").map(Number)
    if (
      !versions.length ||
      versions.length > 8 ||
      new Set(versions).size !== versions.length ||
      versions.some(
        (version) => !Number.isSafeInteger(version) || version < 1 || version > 999999999,
      )
    )
      throw new Error("Invalid key versions")
    if (apply) await configureTrialIdentityKeyVersions(client, versions)
    return { mode: apply ? "apply" : "dry-run", action: "keys", versions }
  }
  if (
    !["inspect", "restrict", "release", "erase", "correct"].includes(command ?? "") ||
    options.has("--versions")
  )
    throw new Error("Choose inspect, restrict, release, erase, correct or keys")
  const source = {
    kind: options.get("--source-kind"),
    id: options.get("--source-id"),
  } as TrialIdentityRightsSource
  if (!source.kind || !source.id) throw new Error("A verified source is required")
  const before = await inspectTrialIdentityRights(client, source)
  if (command === "inspect") {
    if ([...options.keys()].some((key) => !["--source-kind", "--source-id"].includes(key)))
      throw new Error("Inspect is read-only")
    return { mode: "read-only", before }
  }
  const reference = options.get("--reference"),
    kinds = (options.get("--kinds") ?? "account,verified_email,stripe_card,paypal_payer").split(",")
  if (!reference?.trim() || reference.length > 255)
    throw new Error("Restricted case reference is required")
  const result = apply
    ? await applyTrialIdentityRights(client, {
        source,
        action: command as "restrict" | "release" | "erase" | "correct",
        kinds,
        reference,
      })
    : null
  return { mode: apply ? "apply" : "dry-run", action: command, source, kinds, before, result }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runTrialIdentityRights(process.argv.slice(2), createAdminClient())
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch(() => {
      console.error(
        "Identity rights operation failed. Verify the source, restricted case reference, key overlap and service access; no raw identities should be logged.",
      )
      process.exitCode = 1
    })
