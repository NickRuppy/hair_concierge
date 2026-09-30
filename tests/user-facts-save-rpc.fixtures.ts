/**
 * An in-memory stand-in for `public.user_facts_save_v1`
 * (`supabase/migrations/20260929231300_user_facts_save_v1.sql`) for unit tests that drive the
 * account-link writers through a fake Supabase client. It mirrors the SQL steps those writers
 * depend on — the revision CAS, `create_only` preserve (a pure preserve of ANY existing
 * domain, F3) and its `preservedCandidates` union, the top-level field-level merge where a JSON null
 * clears a key, the `fields` provenance merge (cleared keys drop out) and the revision bump.
 * It never derives legacy columns (that has its own parity test against the real SQL).
 */

type Row = Record<string, unknown>

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function simulateUserFactsSave(rows: Row[], args: Row): Row {
  let profile = rows.find((row) => row.user_id === args.p_user_id)
  const expected = args.p_expected_revision as number | null | undefined

  if (!profile) {
    if (expected != null && expected !== 0) return { status: "revision_conflict", revision: 0 }
    profile = { user_id: args.p_user_id, facts_revision: 0, facts_provenance: {} }
    rows.push(profile)
  }

  const revision = (profile.facts_revision as number | undefined) ?? 0
  if (expected != null && expected !== revision) {
    return { status: "revision_conflict", revision }
  }

  const domain = args.p_domain as string
  const oldDomain = isRecord(profile[domain]) ? (profile[domain] as Row) : null
  const allProvenance = isRecord(profile.facts_provenance) ? (profile.facts_provenance as Row) : {}
  const oldProvenance = isRecord(allProvenance[domain]) ? (allProvenance[domain] as Row) : {}
  const provenance = args.p_provenance as Row
  const patch = args.p_patch as Row

  if (args.p_mode === "create_only" && oldDomain !== null) {
    const incoming = Array.isArray(provenance.preservedCandidates)
      ? (provenance.preservedCandidates as Row[])
      : []
    const existing = Array.isArray(oldProvenance.preservedCandidates)
      ? (oldProvenance.preservedCandidates as Row[])
      : []
    if (incoming.length > 0 || existing.length > 0) {
      const union = [...existing]
      for (const entry of incoming) {
        if (!union.some((kept) => kept.kind === entry.kind && kept.id === entry.id)) {
          union.push(entry)
        }
      }
      profile.facts_provenance = {
        ...allProvenance,
        [domain]: { ...oldProvenance, preservedCandidates: union },
      }
    }
    return { status: "preserved", revision, changed: false, diagnosticsHash: null }
  }

  const cleared = Object.entries(patch)
    .filter(([, value]) => value === null)
    .map(([key]) => key)
  const nextDomain: Row = { ...(oldDomain ?? {}), ...patch }
  for (const key of cleared) delete nextDomain[key]

  const fields: Row = {
    ...(isRecord(oldProvenance.fields) ? oldProvenance.fields : {}),
    ...(isRecord(provenance.fields) ? provenance.fields : {}),
  }
  for (const key of cleared) delete fields[key]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped, re-added below
  const { fields: _fields, preservedCandidates: _candidates, ...envelope } = provenance
  const merged: Row = { ...envelope }
  if (Object.keys(fields).length > 0) merged.fields = fields
  if (Array.isArray(oldProvenance.preservedCandidates)) {
    merged.preservedCandidates = oldProvenance.preservedCandidates
  }

  profile[domain] = nextDomain
  profile.facts_provenance = { ...allProvenance, [domain]: merged }
  profile.facts_revision = revision + 1
  return {
    status: "ok",
    revision: revision + 1,
    changed: JSON.stringify(nextDomain) !== JSON.stringify(oldDomain),
    diagnosticsHash: null,
  }
}
