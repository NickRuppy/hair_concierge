import "server-only"
type Client = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}
export type TrialIdentityRightsSource = { kind: "enrollment" | "stripe" | "paypal"; id: string }
const kinds = ["account", "verified_email", "stripe_card", "paypal_payer"] as const
export async function inspectTrialIdentityRights(
  client: Client,
  source: TrialIdentityRightsSource,
) {
  validateSource(source)
  const result = await client.rpc("inspect_trial_identity_rights", {
    p_source_kind: source.kind,
    p_source_id: source.id,
  })
  if (result.error) throw new Error("Identity rights inspection failed")
  return result.data
}
function validateSource(source: TrialIdentityRightsSource) {
  if (
    !["enrollment", "stripe", "paypal"].includes(source.kind) ||
    typeof source.id !== "string" ||
    source.id.length > 255 ||
    !(source.kind === "enrollment"
      ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.id)
      : source.kind === "stripe"
        ? /^sub_[A-Za-z0-9_]+$/.test(source.id)
        : /^I-[A-Z0-9]+$/.test(source.id))
  )
    throw new Error("Invalid rights source")
}
export async function applyTrialIdentityRights(
  client: Client,
  input: {
    source: TrialIdentityRightsSource
    action: "restrict" | "release" | "erase" | "correct"
    kinds: string[]
    reference: string
  },
) {
  validateSource(input.source)
  if (
    !["restrict", "release", "erase", "correct"].includes(input.action) ||
    input.kinds.length < 1 ||
    input.kinds.length > 4 ||
    input.kinds.some((kind) => !kinds.includes(kind as (typeof kinds)[number])) ||
    !input.reference.trim() ||
    input.reference.length > 255
  )
    throw new Error("Invalid rights request")
  const result = await client.rpc("apply_trial_identity_rights", {
    p_source_kind: input.source.kind,
    p_source_id: input.source.id,
    p_action: input.action,
    p_kinds: input.kinds,
    p_reference: input.reference,
  })
  if (result.error || !result.data)
    throw new Error("Identity rights action requires reconciliation")
  return result.data
}
export async function configureTrialIdentityKeyVersions(client: Client, versions: number[]) {
  if (
    !versions.length ||
    versions.length > 8 ||
    new Set(versions).size !== versions.length ||
    versions.some((version) => !Number.isSafeInteger(version) || version < 1 || version > 999999999)
  )
    throw new Error("Invalid identity key versions")
  const result = await client.rpc("configure_trial_identity_key_versions", { p_versions: versions })
  if (result.error) throw new Error("Identity key registry requires retained-key overlap")
}
