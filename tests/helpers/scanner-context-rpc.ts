import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

type Row = Record<string, unknown>

/** In-memory transport for the owner-filtered source read and publication CAS.
 * Actual source validation and scanner computation still run in production code.
 * SQL privileges/triggers are covered by mobile-profile-migration.test.ts.
 */
export function createScannerContextRpc(rows: {
  hairProfiles: Row[]
  personalPlans: Map<string, Row>
  needVersions: Map<string, Row>
  leads?: Row[]
}) {
  const clocks = new Map<string, { source: string; revision: number }>()
  const publications = new Map<string, { id: string; payload: string }>()
  function read(userId: string) {
    const plan = rows.personalPlans.get(userId) ?? null
    const need = (kind: "initial" | "refined") => {
      const row = rows.needVersions.get(plan?.[`current_${kind}_need_version_id`] as string)
      return row?.user_id === userId && row.personal_plan_id === plan?.id && row.kind === kind
        ? row
        : null
    }
    const source = {
      userId,
      profile: rows.hairProfiles.find((row) => row.user_id === userId) ?? null,
      plan,
      initial: need("initial"),
      refined: need("refined"),
      refinements: [],
      leads: (rows.leads ?? []).filter(
        (row) => row.user_id === userId && row.quiz_kind === "legacy",
      ),
    }
    const serialized = JSON.stringify(source)
    const prior = clocks.get(userId)
    const revision = prior ? prior.revision + Number(prior.source !== serialized) : 1
    clocks.set(userId, { source: serialized, revision })
    return structuredClone({ ...source, sourceRevision: String(revision), profileRevision: "1" })
  }
  return {
    publications,
    rpc(name: string, args: Row) {
      const userId = args.p_user_id as string
      if (name === "scanner_context_read_source") return { data: read(userId), error: null }
      assert.equal(name, "scanner_context_publish")
      const source = read(userId)
      if (args.p_expected_source_revision !== source.sourceRevision)
        return { data: { outcome: "stale_source" }, error: null }
      assert.match(args.p_source_hash as string, /^[a-f0-9]{64}$/)
      assert.equal((args.p_output_snapshot as Row).computationVersion, args.p_engine_version)
      const key = JSON.stringify([
        userId,
        source.sourceRevision,
        args.p_source_hash,
        args.p_engine_version,
      ])
      const payload = JSON.stringify([
        args.p_input_snapshot,
        args.p_output_snapshot,
        args.p_snapshot_source,
      ])
      const prior = publications.get(key)
      if (prior) assert.equal(payload, prior.payload, "immutable context publication must match")
      const publication = prior ?? { id: randomUUID(), payload }
      publications.set(key, publication)
      return { data: { outcome: "ready", contextRevision: publication.id }, error: null }
    },
  }
}
