/**
 * Narrow, reversible migration for the seven approved personal-plan offer v2
 * insights. Dry-run is the default; writes are explicit and guarded.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectId = "126788"
const apiOrigin = "https://eu.posthog.com"
const v1 = "personal_plan_v1"
const v2 = "personal_plan_v2"
export const insightIds = [5235347, 5235348, 5235350, 5235351, 5245339, 5233190, 5033903] as const
type InsightId = (typeof insightIds)[number]
export type Insight = {
  id: number
  name: string
  description?: string | null
  query: Record<string, unknown>
}
type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>
export type MigrationDependencies = {
  fetch: FetchLike
  output: (line: string) => void
  token?: string
  cwd?: string
  now?: () => Date
  beforeFingerprints?: Record<number, string>
  afterFingerprints?: Record<number, string>
  transform?: (insight: Insight) => Insight
}

const beforeFingerprints: Record<InsightId, string> = {
  5235347: "7609e92419ce22e2b5d3d982373da9c431fcfd78df341f39267be0f0cc1dff61",
  5235348: "870fd1d14aa89068d02bb17a13b91862d387788bd036e10d2279be52e4f1f505",
  5235350: "b20db918a185d02f6b991c6389a3f93480614b7d567257747c5e167818d348f5",
  5235351: "f705f1f28ea37aa1df3d666450d0870bc41c850024dfee26613a1f7618db52e8",
  5245339: "7b33c46d9e91c8e7418de9c95c9953d7545c68ea6f9901eb9626b5848c300028",
  5233190: "79b9d5342abc1c8d1675bd53e58ab4e09272107aded332ea1dc3000b7025b1c0",
  5033903: "1a28e9855d5cd223648d1c629ac48beb2d0f93ec565d4a185eb5467fa727177e",
}
const afterFingerprints: Record<InsightId, string> = {
  5235347: "da214dfa1b0a8fb804643f53d7f6d58eb694a088c4ff63ee0db944a44813eaa1",
  5235348: "cb6a32a32172c8c6e4e2a8b181c195ebe6784bf76fbfd2525d78b2432fefa2c8",
  5235350: "6630dd5af3e0cc8d6719b4afd274bc63304c62666bc6c0b6494932b9ec7cc085",
  5235351: "fa3617da312d4f3a2d19c016063874462955ba925ae66e819121c3bcd74f2299",
  5245339: "eeec112eae3a348eba217d2ba90fe4220f114252c404460780f1dac1025a3412",
  5233190: "3b3b10a9ecda4a42f3b72e7c873ca9a4ee26ecce3b4ca7668675eb1cb830c752",
  5033903: "bcc2d16b13bf4239c41815ae71ba3accba423294e73e50f98e794da7c2e963fd",
}

const canonical = (i: Insight) => ({
  id: i.id,
  name: i.name,
  description: i.description ?? "",
  query: i.query,
})
export const fingerprintInsight = (i: Insight) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(i)))
    .digest("hex")
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function queryOf(i: Insight) {
  const source = i.query.source as { query?: unknown } | undefined
  if (!source || typeof source.query !== "string")
    throw new Error(`Insight ${i.id} has no HogQL source query.`)
  return source.query
}
function withQuery(i: Insight, query: string, description = i.description ?? "") {
  const next = clone(i)
  ;(next.query.source as { query: string }).query = query
  next.description = description
  return next
}
function replaceRevision(i: Insight) {
  const query = queryOf(i)
  if (!query.includes(v1)) throw new Error(`Insight ${i.id} is missing ${v1}.`)
  return withQuery(
    i,
    query.replace(/personal_plan_v1/g, v2),
    (i.description ?? "").replace(/personal_plan_v1/g, v2),
  )
}
function replaceBlock(query: string, oldBlock: string, newBlock: string, id: number) {
  if (!query.includes(oldBlock))
    throw new Error(`Insight ${id} structure drifted; refusing to renumber it.`)
  return query.replace(oldBlock, newBlock)
}
function transformO2(i: Insight) {
  const current = replaceRevision(i)
  const oldSteps = `  UNION ALL SELECT 5, '05 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 6, '06 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 7, '07 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 8, '08 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 9, '09 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 10, '10 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events
  UNION ALL SELECT 11, '11 Checkout geöffnet', uniqIf(session_id, event = 'offer_checkout_opened') FROM journey_events
  UNION ALL SELECT 12, '12 Anbieter initialisiert', uniqIf(session_id, event = 'checkout_started') FROM journey_events
  UNION ALL SELECT 13, '13 Zahlungsoption gesehen', uniqIf(session_id, event = 'offer_payment_option_viewed') FROM journey_events
  UNION ALL SELECT 14, '14 Zahlungsart gewählt', uniqIf(session_id, event = 'offer_payment_method_selected') FROM journey_events`
  const newSteps = `  UNION ALL SELECT 5, '05 Vorher und nachher', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_before_after') FROM journey_events
  UNION ALL SELECT 6, '06 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 7, '07 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 8, '08 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 9, '09 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 10, '10 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 11, '11 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events
  UNION ALL SELECT 12, '12 Checkout geöffnet', uniqIf(session_id, event = 'offer_checkout_opened') FROM journey_events
  UNION ALL SELECT 13, '13 Anbieter initialisiert', uniqIf(session_id, event = 'checkout_started') FROM journey_events
  UNION ALL SELECT 14, '14 Zahlungsoption gesehen', uniqIf(session_id, event = 'offer_payment_option_viewed') FROM journey_events
  UNION ALL SELECT 15, '15 Zahlungsart gewählt', uniqIf(session_id, event = 'offer_payment_method_selected') FROM journey_events`
  return withQuery(
    current,
    replaceBlock(queryOf(current), oldSteps, newSteps, i.id),
    "01–11: Abschnitt mindestens 25 % für 750 ms sichtbar. 12: Checkout geöffnet. 13: Anbieter initialisiert. 14: bereite Zahlungsoption mindestens 50 % für 750 ms sichtbar. 15: echte Zahlungsart-Interaktion.",
  )
}
function transformB2(i: Insight) {
  const current = replaceRevision(i)
  const oldCounts = `    uniqIf(session_id, section_id = 'pricing') AS o5,
    uniqIf(session_id, section_id = 'personal_plan_survey') AS o6,
    uniqIf(session_id, section_id = 'testimonials') AS o7,
    uniqIf(session_id, section_id = 'guarantee') AS o8,
    uniqIf(session_id, section_id = 'faq') AS o9,
    uniqIf(session_id, section_id = 'final_cta') AS o10`
  const newCounts = `    uniqIf(session_id, section_id = 'personal_plan_before_after') AS o5,
    uniqIf(session_id, section_id = 'pricing') AS o6,
    uniqIf(session_id, section_id = 'personal_plan_survey') AS o7,
    uniqIf(session_id, section_id = 'testimonials') AS o8,
    uniqIf(session_id, section_id = 'guarantee') AS o9,
    uniqIf(session_id, section_id = 'faq') AS o10,
    uniqIf(session_id, section_id = 'final_cta') AS o11`
  const oldSteps = `  SELECT 5 AS sort, '05 Preis & Mitgliedschaft' AS abschnitt, 'pricing' AS section_id, o5 AS sessions, o4 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 6 AS sort, '06 Umfrage-Beleg' AS abschnitt, 'personal_plan_survey' AS section_id, o6 AS sessions, o5 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 7 AS sort, '07 Erfahrungen' AS abschnitt, 'testimonials' AS section_id, o7 AS sessions, o6 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 8 AS sort, '08 Garantie' AS abschnitt, 'guarantee' AS section_id, o8 AS sessions, o7 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 9 AS sort, '09 FAQ' AS abschnitt, 'faq' AS section_id, o9 AS sessions, o8 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 10 AS sort, '10 Finaler CTA' AS abschnitt, 'final_cta' AS section_id, o10 AS sessions, o9 AS vorherige_sessions FROM counts`
  const newSteps = `  SELECT 5 AS sort, '05 Vorher und nachher' AS abschnitt, 'personal_plan_before_after' AS section_id, o5 AS sessions, o4 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 6 AS sort, '06 Preis & Mitgliedschaft' AS abschnitt, 'pricing' AS section_id, o6 AS sessions, o5 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 7 AS sort, '07 Umfrage-Beleg' AS abschnitt, 'personal_plan_survey' AS section_id, o7 AS sessions, o6 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 8 AS sort, '08 Erfahrungen' AS abschnitt, 'testimonials' AS section_id, o8 AS sessions, o7 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 9 AS sort, '09 Garantie' AS abschnitt, 'guarantee' AS section_id, o9 AS sessions, o8 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 10 AS sort, '10 FAQ' AS abschnitt, 'faq' AS section_id, o10 AS sessions, o9 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 11 AS sort, '11 Finaler CTA' AS abschnitt, 'final_cta' AS section_id, o11 AS sessions, o10 AS vorherige_sessions FROM counts`
  return withQuery(
    current,
    replaceBlock(
      replaceBlock(queryOf(current), oldCounts, newCounts, i.id),
      oldSteps,
      newSteps,
      i.id,
    ),
  )
}
function transformReach(i: Insight) {
  return withQuery(
    i,
    `WITH section_views AS (
  SELECT toString(properties.offer_variant) AS offer_variant, toString(properties.offer_revision) AS offer_revision, toString(properties.section_id) AS abschnitt, uniq(properties.offer_view_id) AS eindeutige_aufrufe, min(toInt(properties.section_index)) AS erster_section_index
  FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR AND event = 'offer_section_viewed'
  GROUP BY offer_variant, offer_revision, abschnitt
),
offer_views AS (
  SELECT toString(properties.offer_variant) AS offer_variant, toString(properties.offer_revision) AS offer_revision, uniq(properties.offer_view_id) AS offer_aufrufe
  FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR AND event = 'offer_viewed'
  GROUP BY offer_variant, offer_revision
)
SELECT section_views.offer_variant, section_views.offer_revision, section_views.abschnitt, section_views.eindeutige_aufrufe, round(100 * section_views.eindeutige_aufrufe / nullIf(offer_views.offer_aufrufe, 0), 1) AS reichweite_prozent
FROM section_views LEFT JOIN offer_views USING (offer_variant, offer_revision)
ORDER BY section_views.offer_variant, section_views.offer_revision, section_views.erster_section_index ASC`,
    "Eindeutige Offer-Aufrufe je Variante, Revision und Abschnitt sowie Anteil an den passenden Offer-Aufrufen im rollierenden 24-Stunden-Fenster.",
  )
}
export function transformInsight(i: Insight): Insight {
  switch (i.id as InsightId) {
    case 5235347:
    case 5235350:
    case 5235351:
    case 5245339:
      return replaceRevision(i)
    case 5235348:
      return transformO2(i)
    case 5233190:
      return transformB2(i)
    case 5033903:
      return transformReach(i)
    default:
      throw new Error(`Insight ${i.id} is not in the approved migration.`)
  }
}
function parseInsight(value: unknown, id: number): Insight {
  const i = value as Insight
  if (!i || i.id !== id || typeof i.name !== "string" || !i.query)
    throw new Error(`Insight ${id} response is incomplete or mismatched.`)
  return i
}
function url(id: number) {
  return `${apiOrigin}/api/projects/${projectId}/insights/${id}/`
}
async function request(
  deps: MigrationDependencies,
  input: string,
  init?: RequestInit,
): Promise<unknown> {
  const headers = new Headers(init?.headers)
  if (deps.token) headers.set("Authorization", `Bearer ${deps.token}`)
  if (init?.body) headers.set("Content-Type", "application/json")
  const response = await deps.fetch(input, { ...init, headers })
  const body = await response.text()
  if (!response.ok)
    throw new Error(
      `PostHog ${init?.method ?? "GET"} ${new URL(input).pathname} failed (${response.status}): ${body.slice(0, 300)}`,
    )
  return JSON.parse(body)
}
async function fetchInsights(deps: MigrationDependencies) {
  return Promise.all(insightIds.map(async (id) => parseInsight(await request(deps, url(id)), id)))
}
function assertBefore(insights: Insight[], expectedFingerprints: Record<number, string>) {
  for (const i of insights) {
    const actual = fingerprintInsight(i),
      expected = expectedFingerprints[i.id]
    if (actual !== expected)
      throw new Error(
        `Insight ${i.id} drifted from reviewed before-state (expected ${expected}, got ${actual}). Refusing to patch.`,
      )
  }
}
function argsOf(args: string[]) {
  const value = (key: string) =>
    args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1)
  return {
    apply: args.includes("--apply"),
    confirm: value("--confirm-project"),
    backup: value("--backup"),
    restore: value("--restore"),
    annotationAt: value("--annotation-at"),
    deploymentSha: value("--deployment-sha"),
  }
}
function outsideRepo(path: string, cwd: string) {
  if (!isAbsolute(path) || !relative(resolve(cwd), resolve(path)).startsWith(".."))
    throw new Error("Backup/restore path must be absolute and outside the repository.")
  return resolve(path)
}
async function writeBackup(path: string, insights: Insight[], now: Date) {
  await mkdir(dirname(path), { recursive: true })
  const data = {
    schema: "personal-plan-offer-v2-dashboard-migration/v1",
    projectId,
    createdAt: now.toISOString(),
    insights: insights.map(canonical),
  }
  const temp = `${path}.tmp-${process.pid}`
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  await rename(temp, path)
}
async function restoreFile(path: string) {
  const data = JSON.parse(await readFile(path, "utf8")) as {
    schema?: string
    projectId?: string
    insights?: unknown[]
  }
  if (
    data.schema !== "personal-plan-offer-v2-dashboard-migration/v1" ||
    data.projectId !== projectId ||
    !Array.isArray(data.insights)
  )
    throw new Error("Restore file is not this migration's project-126788 backup.")
  const insights = data.insights.map((i) => parseInsight(i, (i as Insight).id))
  if (JSON.stringify(insights.map((i) => i.id).sort()) !== JSON.stringify([...insightIds].sort()))
    throw new Error("Restore backup must contain exactly the seven approved insights.")
  return insights
}
async function patchAndVerify(
  deps: MigrationDependencies,
  insight: Insight,
  expectedFingerprint: string,
) {
  await request(deps, url(insight.id), {
    method: "PATCH",
    body: JSON.stringify({ description: insight.description ?? "", query: insight.query }),
  })
  const reread = parseInsight(await request(deps, url(insight.id)), insight.id)
  if (fingerprintInsight(reread) !== expectedFingerprint)
    throw new Error(`Post-patch verification failed for insight ${insight.id}.`)
  deps.output(`patched and verified insight ${insight.id}`)
}
async function patchAll(deps: MigrationDependencies, insights: Insight[]) {
  for (const i of insights) await patchAndVerify(deps, i, fingerprintInsight(i))
}
async function annotate(deps: MigrationDependencies, at: string, deploymentSha: string) {
  if (Number.isNaN(Date.parse(at))) throw new Error("--annotation-at must be ISO-8601.")
  if (!/^[0-9a-f]{7,40}$/i.test(deploymentSha)) {
    throw new Error("--deployment-sha must be a 7–40 character Git SHA.")
  }
  await request(deps, `${apiOrigin}/api/projects/${projectId}/annotations/`, {
    method: "POST",
    body: JSON.stringify({
      date_marker: at,
      creation_type: "GIT",
      content: `Personal-plan offer v2 deployed at ${deploymentSha}: personal_plan_before_after inserted at section index 4.`,
    }),
  })
  deps.output(`created deployment annotation at ${at}`)
}
export async function runMigration(argv: string[], overrides: Partial<MigrationDependencies> = {}) {
  const options = argsOf(argv)
  const deps: MigrationDependencies = {
    fetch: overrides.fetch ?? fetch,
    output: overrides.output ?? console.log,
    token: overrides.token ?? process.env.POSTHOG_PERSONAL_API_KEY,
    cwd: overrides.cwd ?? process.cwd(),
    now: overrides.now ?? (() => new Date()),
  }
  const expectedBefore = overrides.beforeFingerprints ?? beforeFingerprints
  const expectedAfter = overrides.afterFingerprints ?? afterFingerprints
  const transform = overrides.transform ?? transformInsight
  const writing = options.apply || Boolean(options.restore)
  if (writing && options.confirm !== projectId)
    throw new Error(`Writes require --confirm-project=${projectId}.`)
  if (writing && !options.apply) throw new Error("Restore requires --apply.")
  if (writing && !deps.token)
    throw new Error("POSTHOG_PERSONAL_API_KEY is required for PostHog API access.")
  if (options.annotationAt && !options.apply) throw new Error("--annotation-at requires --apply.")
  if (options.annotationAt && !options.deploymentSha) {
    throw new Error("--annotation-at requires --deployment-sha=<git-sha>.")
  }
  if (options.deploymentSha && !options.annotationAt) {
    throw new Error("--deployment-sha requires --annotation-at=<ISO-8601>.")
  }
  const current = await fetchInsights(deps)
  if (options.restore) {
    const backup = await restoreFile(outsideRepo(options.restore, deps.cwd!))
    assertBefore(backup, expectedBefore)
    const restoreById = new Map(backup.map((insight) => [insight.id, insight]))
    const toRestore: Insight[] = []
    for (const i of current) {
      const fingerprint = fingerprintInsight(i)
      if (fingerprint === expectedBefore[i.id as InsightId]) continue
      if (fingerprint === expectedAfter[i.id as InsightId]) {
        toRestore.push(restoreById.get(i.id)!)
        continue
      }
      throw new Error(
        `Insight ${i.id} is neither reviewed before-state nor expected v2 state; refusing partial restore.`,
      )
    }
    await patchAll(deps, toRestore)
    const reread = await fetchInsights(deps)
    for (const i of reread)
      if (fingerprintInsight(i) !== fingerprintInsight(backup.find((b) => b.id === i.id)!))
        throw new Error(`Restore verification failed for insight ${i.id}.`)
    deps.output(
      `restored ${toRestore.length} insights; ${insightIds.length - toRestore.length} already matched before-state`,
    )
    return { mode: "restore" as const }
  }
  assertBefore(current, expectedBefore)
  const target = current.map(transform)
  for (const i of target)
    deps.output(
      `insight ${i.id}: ${fingerprintInsight(current.find((x) => x.id === i.id)!)} -> ${fingerprintInsight(i)}`,
    )
  if (!options.apply) {
    deps.output(
      `dry run only: ${insightIds.length} insights validated; no PostHog write performed.`,
    )
    return { mode: "dry-run" as const, target }
  }
  if (!options.backup)
    throw new Error("--apply requires --backup=/absolute/path/outside-the-repository.json.")
  const backupPath = outsideRepo(options.backup, deps.cwd!)
  await writeBackup(backupPath, current, deps.now!())
  deps.output(`wrote narrow before-state backup to ${backupPath}`)
  await patchAll(deps, target)
  const reread = await fetchInsights(deps)
  for (const i of reread)
    if (fingerprintInsight(i) !== fingerprintInsight(target.find((x) => x.id === i.id)!))
      throw new Error(`Final post-patch verification failed for insight ${i.id}.`)
  if (options.annotationAt) await annotate(deps, options.annotationAt, options.deploymentSha!)
  deps.output(`applied and re-read ${insightIds.length} PostHog insights.`)
  return { mode: "apply" as const, backupPath }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  runMigration(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
