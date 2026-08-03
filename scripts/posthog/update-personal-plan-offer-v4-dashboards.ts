/**
 * Narrow, reversible migration for the personal-plan offer v4 reorder.
 * Dry-run is the default; writes are explicit, fingerprinted, and backed up.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { personalPlanOfferV4Dashboard } from "../analytics/personal-plan-offer-v4-dashboard"

const projectId = "126788"
const apiOrigin = "https://eu.posthog.com"
const v3 = "personal_plan_v3"
const v4 = "personal_plan_v4"

export const resourceIds = [
  5235347, 5235348, 5235350, 5245339, 5250265, 5233190, 5235351, 5033903,
] as const
type ResourceId = (typeof resourceIds)[number]

const beforeFingerprints: Record<number, string> = {
  5235347: "630ca8e80913f6da5a762c4092539100a6115863d363b5b95ecb832f7f2fdefe",
  5235348: "866ab07772b0008d823306a51727d50b0dea43bf86e55503ca192c600bcda121",
  5235350: "f1df6063b185d5b43ace91852bd5baafa565fe70dea0fa164b6ac49a0d42e066",
  5245339: "d26ebbdf76e9c4e1eb3aa4ef1d3380171520ac12f512d63a73836c9d4175c950",
  5250265: "5e132debf3be6e55ffc75086f9784aa00d518b9b2f7c170034831e9f53734955",
  5233190: "55bf01036312ab9df32ab1407c592f334b1cc02286c7c3e83f83fb23461cf357",
  5235351: "fa3617da312d4f3a2d19c016063874462955ba925ae66e819121c3bcd74f2299",
  5033903: "2966b30b4a90dca7c7b1e5025ef29956bc8e65482ce1c09cbf8d1941204318e9",
}

const afterFingerprints: Partial<Record<number, string>> = {}

const b2V2Prelude = `WITH section_events AS (
  SELECT
    toString(properties.funnel_session_id) AS session_id,
    toString(properties.section_id) AS section_id
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_section_viewed'
    AND properties.offer_revision = 'personal_plan_v3'
    AND properties.offer_variant IN ('personal-plan-v1', 'personal-plan-membership-v1', 'personal-plan-one-time-v1')
    AND lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
),
eligible AS (
  SELECT DISTINCT toString(properties.funnel_session_id) AS session_id
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND properties.offer_revision = 'personal_plan_v3'
    AND properties.offer_variant IN ('personal-plan-v1', 'personal-plan-membership-v1', 'personal-plan-one-time-v1')
    AND lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
),
counts AS (`

const b2V4Prelude = `WITH section_events AS (
  SELECT
    toString(properties.funnel_session_id) AS session_id,
    toString(properties.section_id) AS section_id
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_section_viewed'
    AND properties.offer_revision = 'personal_plan_v4'
    AND properties.offer_variant IN ('personal-plan-v1', 'personal-plan-membership-v1', 'personal-plan-one-time-v1')
    AND lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
),
eligible AS (
  SELECT DISTINCT toString(properties.funnel_session_id) AS session_id
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND properties.offer_revision = 'personal_plan_v4'
    AND properties.offer_variant IN ('personal-plan-v1', 'personal-plan-membership-v1', 'personal-plan-one-time-v1')
    AND lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
),
counts AS (`

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
  afterFingerprints?: Partial<Record<number, string>>
}

const canonical = (insight: Insight) => ({
  id: insight.id,
  name: insight.name,
  description: insight.description ?? "",
  query: insight.query,
})

export const fingerprintInsight = (insight: Insight) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(insight)))
    .digest("hex")

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function queryOf(insight: Insight) {
  const source = insight.query.source as { query?: unknown } | undefined
  if (!source || typeof source.query !== "string") {
    throw new Error(`Insight ${insight.id} has no HogQL source query.`)
  }
  return source.query
}

function withQuery(insight: Insight, query: string, description = insight.description ?? "") {
  const next = clone(insight)
  ;(next.query.source as { query: string }).query = query
  next.description = description
  return next
}

function withDashboardSpec(insight: Insight, spec: { query: string; description: string }) {
  return withQuery(insight, spec.query, spec.description)
}

function replaceExact(value: string, before: string, after: string, id: number) {
  if (!value.includes(before)) {
    throw new Error(`Insight ${id} structure drifted; refusing to reorder it.`)
  }
  return value.replace(before, after)
}

const b2V2Counts = `    uniqIf(session_id, section_id = 'hero') AS o1,
    uniqIf(session_id, section_id = 'personal_plan_diagnosis') AS o2,
    uniqIf(session_id, section_id = 'pricing') AS o3,
    uniqIf(session_id, section_id = 'personal_plan_complete_plan') AS o4,
    uniqIf(session_id, section_id = 'personal_plan_method') AS o5,
    uniqIf(session_id, section_id = 'personal_plan_before_after') AS o6,
    uniqIf(session_id, section_id = 'personal_plan_survey') AS o7,
    uniqIf(session_id, section_id = 'testimonials') AS o8,
    uniqIf(session_id, section_id = 'guarantee') AS o9,
    uniqIf(session_id, section_id = 'faq') AS o10,
    uniqIf(session_id, section_id = 'final_cta') AS o11`

const b2V4Counts = `    uniqIf(session_id, section_id = 'hero') AS o1,
    uniqIf(session_id, section_id = 'personal_plan_diagnosis') AS o2,
    uniqIf(session_id, section_id = 'pricing') AS o3,
    uniqIf(session_id, section_id = 'testimonials') AS o4,
    uniqIf(session_id, section_id = 'personal_plan_complete_plan') AS o5,
    uniqIf(session_id, section_id = 'personal_plan_method') AS o6,
    uniqIf(session_id, section_id = 'personal_plan_before_after') AS o7,
    uniqIf(session_id, section_id = 'personal_plan_survey') AS o8,
    uniqIf(session_id, section_id = 'guarantee') AS o9,
    uniqIf(session_id, section_id = 'faq') AS o10,
    uniqIf(session_id, section_id = 'final_cta') AS o11`

const b2V2Steps = `  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, 'hero' AS section_id, o1 AS sessions, o1 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 2 AS sort, '02 Persönliche Diagnose' AS abschnitt, 'personal_plan_diagnosis' AS section_id, o2 AS sessions, o1 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 3 AS sort, '03 Preis & Mitgliedschaft' AS abschnitt, 'pricing' AS section_id, o3 AS sessions, o2 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 4 AS sort, '04 Vollständiger Plan' AS abschnitt, 'personal_plan_complete_plan' AS section_id, o4 AS sessions, o3 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 5 AS sort, '05 So funktioniert der Plan' AS abschnitt, 'personal_plan_method' AS section_id, o5 AS sessions, o4 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 6 AS sort, '06 Vorher und nachher' AS abschnitt, 'personal_plan_before_after' AS section_id, o6 AS sessions, o5 AS vorherige_sessions FROM counts
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

const b2V4Steps = `  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, 'hero' AS section_id, o1 AS sessions, o1 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 2 AS sort, '02 Persönliche Diagnose' AS abschnitt, 'personal_plan_diagnosis' AS section_id, o2 AS sessions, o1 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 3 AS sort, '03 Preis & Mitgliedschaft' AS abschnitt, 'pricing' AS section_id, o3 AS sessions, o2 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 4 AS sort, '04 Erfahrungen' AS abschnitt, 'testimonials' AS section_id, o4 AS sessions, o3 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 5 AS sort, '05 Vollständiger Plan' AS abschnitt, 'personal_plan_complete_plan' AS section_id, o5 AS sessions, o4 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 6 AS sort, '06 So funktioniert der Plan' AS abschnitt, 'personal_plan_method' AS section_id, o6 AS sessions, o5 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 7 AS sort, '07 Vorher und nachher' AS abschnitt, 'personal_plan_before_after' AS section_id, o7 AS sessions, o6 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 8 AS sort, '08 Umfrage-Beleg' AS abschnitt, 'personal_plan_survey' AS section_id, o8 AS sessions, o7 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 9 AS sort, '09 Garantie' AS abschnitt, 'guarantee' AS section_id, o9 AS sessions, o8 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 10 AS sort, '10 FAQ' AS abschnitt, 'faq' AS section_id, o10 AS sessions, o9 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 11 AS sort, '11 Finaler CTA' AS abschnitt, 'final_cta' AS section_id, o11 AS sessions, o10 AS vorherige_sessions FROM counts`

function transformB2(insight: Insight) {
  const query = queryOf(insight)
  if (!query.includes(v3)) {
    if (query.includes(v4)) return clone(insight)
    throw new Error(`Insight ${insight.id} is missing ${v3}.`)
  }
  return withQuery(
    insight,
    replaceExact(
      replaceExact(
        replaceExact(query, b2V2Prelude, b2V4Prelude, insight.id),
        b2V2Counts,
        b2V4Counts,
        insight.id,
      ),
      b2V2Steps,
      b2V4Steps,
      insight.id,
    ),
    (insight.description ?? "").replaceAll(v3, v4),
  )
}

export function transformInsight(insight: Insight): Insight {
  switch (insight.id as ResourceId) {
    case 5235347:
      return withDashboardSpec(insight, personalPlanOfferV4Dashboard.insights.o1)
    case 5235348:
      return withDashboardSpec(insight, personalPlanOfferV4Dashboard.insights.o2)
    case 5235350:
      return withDashboardSpec(insight, personalPlanOfferV4Dashboard.insights.o3)
    case 5245339:
      return withDashboardSpec(insight, personalPlanOfferV4Dashboard.insights.o5)
    case 5250265:
      return withDashboardSpec(insight, personalPlanOfferV4Dashboard.insights.o6)
    case 5233190:
      return transformB2(insight)
    case 5235351:
    case 5033903:
      return clone(insight)
    default:
      throw new Error(`Insight ${insight.id} is not in the approved v4 migration.`)
  }
}

function parseInsight(value: unknown, id: number): Insight {
  const insight = value as Insight
  if (!insight || insight.id !== id || typeof insight.name !== "string" || !insight.query) {
    throw new Error(`Insight ${id} response is incomplete or mismatched.`)
  }
  return insight
}

function insightUrl(id: number) {
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
  if (!response.ok) {
    throw new Error(
      `PostHog ${init?.method ?? "GET"} ${new URL(input).pathname} failed (${response.status}): ${body.slice(0, 300)}`,
    )
  }
  return JSON.parse(body)
}

async function fetchInsights(deps: MigrationDependencies) {
  return Promise.all(
    resourceIds.map(async (id) => parseInsight(await request(deps, insightUrl(id)), id)),
  )
}

function valueArg(args: string[], key: string) {
  return args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1)
}

function argsOf(args: string[]) {
  return {
    apply: args.includes("--apply"),
    backup: valueArg(args, "--backup"),
    confirm: valueArg(args, "--confirm-project"),
    restore: valueArg(args, "--restore"),
    annotationAt: valueArg(args, "--annotation-at"),
    deploymentSha: valueArg(args, "--deployment-sha"),
  }
}

function outsideRepo(path: string, cwd: string) {
  if (!isAbsolute(path) || !relative(resolve(cwd), resolve(path)).startsWith("..")) {
    throw new Error("Backup/restore path must be absolute and outside the repository.")
  }
  return resolve(path)
}

function classify(
  insight: Insight,
  before: Record<number, string>,
  after: Partial<Record<number, string>>,
) {
  const fingerprint = fingerprintInsight(insight)
  if (after[insight.id] && fingerprint === after[insight.id]) return "after" as const
  if (fingerprint === before[insight.id]) return "before" as const
  throw new Error(
    `Insight ${insight.id} is neither reviewed v3 state nor expected v4 state (got ${fingerprint}). Refusing to write.`,
  )
}

function expectedAfterFingerprint(target: Insight, after: Partial<Record<number, string>>) {
  return after[target.id] ?? fingerprintInsight(target)
}

async function writeBackup(path: string, insights: Insight[], now: Date) {
  await mkdir(dirname(path), { recursive: true })
  try {
    await stat(path)
    throw new Error(`Backup already exists; refusing to overwrite ${path}.`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const data = {
    schema: "personal-plan-offer-v4-dashboard-migration/v1",
    projectId,
    createdAt: now.toISOString(),
    insights: insights.map(canonical),
  }
  const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  await rename(temporary, path)
}

async function readBackup(path: string) {
  const data = JSON.parse(await readFile(path, "utf8")) as {
    schema?: string
    projectId?: string
    insights?: unknown[]
  }
  if (
    data.schema !== "personal-plan-offer-v4-dashboard-migration/v1" ||
    data.projectId !== projectId ||
    !Array.isArray(data.insights)
  ) {
    throw new Error("Restore file is not this migration's project-126788 backup.")
  }
  const insights = data.insights.map((value) => parseInsight(value, (value as Insight).id))
  if (
    JSON.stringify(insights.map((insight) => insight.id).sort()) !==
    JSON.stringify([...resourceIds].sort())
  ) {
    throw new Error("Backup must contain exactly the eight reviewed v4 resources.")
  }
  return insights
}

function assertBackupBefore(insights: Insight[], before: Record<number, string>) {
  for (const insight of insights) {
    if (fingerprintInsight(insight) !== before[insight.id]) {
      throw new Error(`Backup insight ${insight.id} does not match reviewed before-state.`)
    }
  }
}

async function patchAndVerify(
  deps: MigrationDependencies,
  insight: Insight,
  expectedFingerprint: string,
) {
  await request(deps, insightUrl(insight.id), {
    method: "PATCH",
    body: JSON.stringify({
      description: insight.description ?? "",
      query: insight.query,
    }),
  })
  const reread = parseInsight(await request(deps, insightUrl(insight.id)), insight.id)
  if (fingerprintInsight(reread) !== expectedFingerprint) {
    throw new Error(`Post-patch verification failed for insight ${insight.id}.`)
  }
  deps.output(`patched and verified insight ${insight.id}`)
}

function assertValidAnnotation(at: string, deploymentSha: string) {
  if (Number.isNaN(Date.parse(at))) throw new Error("--annotation-at must be ISO-8601.")
  if (!/^[0-9a-f]{7,40}$/i.test(deploymentSha)) {
    throw new Error("--deployment-sha must be a 7–40 character Git SHA.")
  }
}

async function annotate(deps: MigrationDependencies, at: string, deploymentSha: string) {
  assertValidAnnotation(at, deploymentSha)
  await request(deps, `${apiOrigin}/api/projects/${projectId}/annotations/`, {
    method: "POST",
    body: JSON.stringify({
      date_marker: at,
      creation_type: "GIT",
      content: `Personal-plan offer v4 deployed at ${deploymentSha}: testimonials moved to section index 3.`,
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
  const before = overrides.beforeFingerprints ?? beforeFingerprints
  const after = overrides.afterFingerprints ?? afterFingerprints
  const writing = options.apply || Boolean(options.restore)

  if (writing && options.confirm !== projectId) {
    throw new Error(`Writes require --confirm-project=${projectId}.`)
  }
  if (writing && !options.apply) throw new Error("Restore requires --apply.")
  if (writing && !deps.token) {
    throw new Error("POSTHOG_PERSONAL_API_KEY is required for PostHog API access.")
  }
  if (options.annotationAt && (!options.apply || !options.deploymentSha)) {
    throw new Error("--annotation-at requires --apply and --deployment-sha=<git-sha>.")
  }
  if (options.deploymentSha && !options.annotationAt) {
    throw new Error("--deployment-sha requires --annotation-at=<ISO-8601>.")
  }
  if (options.annotationAt && options.deploymentSha) {
    assertValidAnnotation(options.annotationAt, options.deploymentSha)
  }

  const current = await fetchInsights(deps)
  const states = new Map(current.map((insight) => [insight.id, classify(insight, before, after)]))

  if (options.restore) {
    const backup = await readBackup(outsideRepo(options.restore, deps.cwd!))
    assertBackupBefore(backup, before)
    for (const insight of current) {
      const transformed = transformInsight(insight)
      if (
        states.get(insight.id) === "before" ||
        before[insight.id] === expectedAfterFingerprint(transformed, after)
      ) {
        continue
      }
      const restoreTarget = backup.find((candidate) => candidate.id === insight.id)!
      await patchAndVerify(deps, restoreTarget, before[insight.id])
    }
    const reread = await fetchInsights(deps)
    for (const insight of reread) {
      if (fingerprintInsight(insight) !== before[insight.id]) {
        throw new Error(`Restore verification failed for insight ${insight.id}.`)
      }
    }
    deps.output("restored all eight reviewed resources to the backed-up v3 state.")
    return { mode: "restore" as const }
  }

  const targets = current.map(transformInsight)
  for (const target of targets) {
    const actual = fingerprintInsight(target)
    const expected = expectedAfterFingerprint(target, after)
    if (actual !== expected) {
      throw new Error(
        `Insight ${target.id} target drifted from reviewed v4 state (expected ${expected}, got ${actual}). Refusing to patch.`,
      )
    }
    deps.output(
      `insight ${target.id}: ${states.get(target.id) === "after" ? "already applied" : `${before[target.id]} -> ${expected}`}`,
    )
  }

  if (!options.apply) {
    deps.output("dry run only: eight resources validated; no PostHog write performed.")
    return { mode: "dry-run" as const, targets }
  }

  const pending = current.filter(
    (insight) =>
      states.get(insight.id) === "before" &&
      before[insight.id] !== expectedAfterFingerprint(transformInsight(insight), after),
  )
  if (pending.length === 0) {
    if (options.annotationAt) {
      await annotate(deps, options.annotationAt, options.deploymentSha!)
    }
    deps.output("all reviewed v4 resources are already applied; no insight patch performed.")
    return { mode: "apply" as const, patched: 0 }
  }
  if (!options.backup) {
    throw new Error("--apply requires --backup=/absolute/path/outside-the-repository.json.")
  }
  const backupPath = outsideRepo(options.backup, deps.cwd!)
  const mixed = current.some(
    (insight) =>
      states.get(insight.id) === "after" &&
      before[insight.id] !== expectedAfterFingerprint(transformInsight(insight), after),
  )
  if (mixed) {
    const backup = await readBackup(backupPath)
    assertBackupBefore(backup, before)
  } else {
    await writeBackup(backupPath, current, deps.now!())
    deps.output(`wrote narrow before-state backup to ${backupPath}`)
  }

  for (const insight of pending) {
    const target = targets.find((candidate) => candidate.id === insight.id)!
    await patchAndVerify(deps, target, expectedAfterFingerprint(target, after))
  }
  const reread = await fetchInsights(deps)
  for (const insight of reread) {
    const target = targets.find((candidate) => candidate.id === insight.id)!
    if (fingerprintInsight(insight) !== expectedAfterFingerprint(target, after)) {
      throw new Error(`Final post-patch verification failed for insight ${insight.id}.`)
    }
  }
  if (options.annotationAt) {
    await annotate(deps, options.annotationAt, options.deploymentSha!)
  }
  deps.output(`applied and re-read ${pending.length} pending PostHog insights.`)
  return { mode: "apply" as const, backupPath, patched: pending.length }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runMigration(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
