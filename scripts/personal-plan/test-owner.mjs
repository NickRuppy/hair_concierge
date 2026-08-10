import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"
import { access, chmod, mkdtemp, rename, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { chromium } from "playwright"
import { config as loadEnv } from "dotenv"

import {
  PERSONAL_PLAN_TEST_OWNER,
  canApplyPersonalPlanTestOwnerWrite,
  classifyPersonalPlanTestOwner,
  isAllowedPersonalPlanTestOwnerBaseUrl,
  parsePersonalPlanTestOwnerCommand,
} from "./test-owner-policy.mjs"

const quizEnvelope = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["moisture", "shine"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["dry_lengths", "split_ends"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "balanced",
    scalpConcerns: ["irritated"],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
}

const canonicalProfile = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: true,
  scalp_condition: "gereizt",
  concerns: ["dryness", "split_ends"],
  treatment: ["gefaerbt"],
  goals: ["moisture", "shine"],
}

function value(args, name) {
  return args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
}

export function resolvePersonalPlanTestOwnerProjectContext(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("test_owner_supabase_url_not_allowed")
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  const hasUnexpectedUrlParts =
    Boolean(url.username || url.password || url.search || url.hash) || url.pathname !== "/"
  if (isLocal) {
    if (!["http:", "https:"].includes(url.protocol) || hasUnexpectedUrlParts) {
      throw new Error("test_owner_supabase_url_not_allowed")
    }
    return { isLocal: true, projectId: "local" }
  }

  const canonicalHostname = `${PERSONAL_PLAN_TEST_OWNER.projectId}.supabase.co`
  if (
    url.protocol !== "https:" ||
    url.hostname !== canonicalHostname ||
    url.port !== "" ||
    hasUnexpectedUrlParts
  ) {
    throw new Error("test_owner_supabase_url_not_allowed")
  }
  return { isLocal: false, projectId: PERSONAL_PLAN_TEST_OWNER.projectId }
}

export async function assertPersonalPlanTestOwnerStage1Frontier(page) {
  await page
    .getByRole("heading", { name: "Deine Basis", exact: true })
    .waitFor({ state: "visible", timeout: 30_000 })
}

async function requiredQuery(query) {
  const { data, error } = await query
  if (error) throw new Error(`test_owner_inspection_failed:${error.code ?? "unknown"}`)
  return data ?? []
}

async function findAuthOwner(admin) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error("test_owner_auth_inspection_failed")
    const user = data.users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === PERSONAL_PLAN_TEST_OWNER.email,
    )
    if (user) return user
    if (data.users.length === 0) return null
  }
  throw new Error("test_owner_auth_inspection_incomplete")
}

async function loadSnapshot(admin) {
  const user = await findAuthOwner(admin)
  const userId = user?.id
  const ids = PERSONAL_PLAN_TEST_OWNER.ids
  const userOrId = (idColumn, id) =>
    userId ? `${idColumn}.eq.${id},user_id.eq.${userId}` : `${idColumn}.eq.${id}`

  const [
    profiles,
    campaigns,
    leads,
    funnelSessions,
    consents,
    purchases,
    artifacts,
    fieldTestEnrollments,
    manualAccessGrants,
    plans,
    userProducts,
    customerIoOutbox,
  ] = await Promise.all([
    requiredQuery(
      admin
        .from("profiles")
        .select("id,email,is_admin")
        .or(
          userId
            ? `id.eq.${userId},email.eq.${PERSONAL_PLAN_TEST_OWNER.email}`
            : `email.eq.${PERSONAL_PLAN_TEST_OWNER.email}`,
        ),
    ),
    requiredQuery(
      admin
        .from("personal_plan_test_campaigns")
        .select("id,status,revoked_at")
        .eq("id", ids.campaign),
    ),
    requiredQuery(
      admin
        .from("leads")
        .select("id,user_id,email,quiz_kind")
        .or(
          userId
            ? `id.eq.${ids.lead},user_id.eq.${userId},email.eq.${PERSONAL_PLAN_TEST_OWNER.email}`
            : `id.eq.${ids.lead},email.eq.${PERSONAL_PLAN_TEST_OWNER.email}`,
        ),
    ),
    requiredQuery(
      admin
        .from("funnel_sessions")
        .select(
          "id,user_id,lead_id,package_key,channel,is_internal_test,test_kind,field_test_campaign_id",
        )
        .or(userOrId("id", ids.funnelSession)),
    ),
    requiredQuery(
      admin
        .from("personal_plan_one_time_checkout_consents")
        .select("id,user_id,lead_id,funnel_session_id,product_kind,confirmation_status")
        .or(userOrId("id", ids.consent)),
    ),
    requiredQuery(
      admin
        .from("billing_one_time_purchases")
        .select(
          "id,user_id,consent_id,provider,provider_transaction_id,product_kind,status,metadata",
        )
        .or(
          userId
            ? `id.eq.${ids.purchase},user_id.eq.${userId},provider_transaction_id.eq.${PERSONAL_PLAN_TEST_OWNER.providerTransactionId}`
            : `id.eq.${ids.purchase},provider_transaction_id.eq.${PERSONAL_PLAN_TEST_OWNER.providerTransactionId}`,
        ),
    ),
    requiredQuery(
      admin
        .from("personal_plan_prepared_artifacts")
        .select("id,user_id,lead_id,claim_token_hash,status")
        .or(
          userId
            ? `id.eq.${ids.artifact},user_id.eq.${userId},lead_id.eq.${ids.lead},claim_token_hash.eq.${PERSONAL_PLAN_TEST_OWNER.claimTokenHash}`
            : `id.eq.${ids.artifact},lead_id.eq.${ids.lead},claim_token_hash.eq.${PERSONAL_PLAN_TEST_OWNER.claimTokenHash}`,
        ),
    ),
    userId
      ? requiredQuery(
          admin
            .from("personal_plan_test_enrollments")
            .select(
              "id,campaign_id,funnel_session_id,lead_id,user_id,manual_access_grant_id,prepared_artifact_id,status,expires_at,revoked_at",
            )
            .eq("user_id", userId),
        )
      : [],
    userId
      ? requiredQuery(
          admin
            .from("manual_access_grants")
            .select("id,user_id,reason,expires_at,revoked_at")
            .eq("user_id", userId),
        )
      : [],
    userId
      ? requiredQuery(admin.from("personal_plans").select("id,user_id").eq("user_id", userId))
      : [],
    userId
      ? requiredQuery(admin.from("user_products").select("id,user_id").eq("user_id", userId))
      : [],
    requiredQuery(
      admin.from("customerio_profile_sync_outbox").select("lead_id").eq("lead_id", ids.lead),
    ),
  ])

  return {
    user,
    profiles,
    campaigns,
    leads,
    funnelSessions,
    consents,
    purchases,
    artifacts,
    fieldTestEnrollments,
    manualAccessGrants,
    plans,
    userProducts,
    customerIoOutbox,
  }
}

function publicStatus(classification, context, action, extra = {}) {
  return {
    action,
    project: context.projectId,
    owner: PERSONAL_PLAN_TEST_OWNER.email,
    ...classification,
    ...extra,
  }
}

async function createOwner(admin) {
  const { data, error } = await admin.auth.admin.createUser({
    email: PERSONAL_PLAN_TEST_OWNER.email,
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    app_metadata: { personal_plan_test_owner: true },
    user_metadata: { full_name: "Personal Plan QA" },
  })
  if (error || !data.user) throw new Error("test_owner_auth_creation_failed")
  return data.user
}

function requireWriteAuthorization(args, environment, context) {
  if (
    !canApplyPersonalPlanTestOwnerWrite({
      args,
      environment,
      projectId: context.projectId,
      isLocal: context.isLocal,
    })
  ) {
    throw new Error(
      context.isLocal
        ? "test_owner_write_requires_apply"
        : `test_owner_write_requires_apply_confirm_project_and_ALLOW_PERSONAL_PLAN_TEST_OWNER_PRODUCTION_WRITE=1`,
    )
  }
}

async function prepareOwner(admin, args, environment, context) {
  requireWriteAuthorization(args, environment, context)
  const before = await loadSnapshot(admin)
  const beforeClassification = classifyPersonalPlanTestOwner(before)
  if (!beforeClassification.safe || !beforeClassification.canPrepare) {
    throw new Error(`test_owner_prepare_refused:${beforeClassification.issues.join(",")}`)
  }
  const user = before.user ?? (await createOwner(admin))
  const { error } = await admin.rpc("prepare_personal_plan_test_owner", {
    p_user_id: user.id,
    p_quiz_answers: quizEnvelope,
    p_canonical_profile: canonicalProfile,
  })
  if (error) throw new Error(`test_owner_prepare_failed:${error.code ?? "unknown"}`)
  const after = await loadSnapshot(admin)
  const classification = classifyPersonalPlanTestOwner(after)
  if (!classification.safe || !classification.canAuthenticate) {
    throw new Error(`test_owner_prepare_postcondition_failed:${classification.issues.join(",")}`)
  }
  return classification
}

async function resetOwner(admin, args, environment, context) {
  requireWriteAuthorization(args, environment, context)
  const before = await loadSnapshot(admin)
  const beforeClassification = classifyPersonalPlanTestOwner(before)
  if (!before.user || !beforeClassification.safe || !beforeClassification.canReset) {
    throw new Error(`test_owner_reset_refused:${beforeClassification.issues.join(",")}`)
  }
  const { data, error } = await admin.rpc("personal_plan_erase_owner_data", {
    p_user_id: before.user.id,
  })
  if (error) throw new Error(`test_owner_reset_failed:${error.code ?? "unknown"}`)
  const after = await loadSnapshot(admin)
  const classification = classifyPersonalPlanTestOwner(after)
  if (classification.status !== "ready" || classification.frontier !== "stage1") {
    throw new Error(`test_owner_reset_postcondition_failed:${classification.issues.join(",")}`)
  }
  return { classification, erasure: data }
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function createAuthState(admin, args, environment, context) {
  requireWriteAuthorization(args, environment, context)
  const snapshot = await loadSnapshot(admin)
  const classification = classifyPersonalPlanTestOwner(snapshot)
  if (!snapshot.user || !classification.safe || !classification.canAuthenticate) {
    throw new Error(`test_owner_auth_refused:${classification.issues.join(",")}`)
  }
  const rawBaseUrl = value(args, "--base-url")
  if (!rawBaseUrl) throw new Error("test_owner_auth_requires_base_url")
  if (!isAllowedPersonalPlanTestOwnerBaseUrl(rawBaseUrl, context)) {
    throw new Error("test_owner_auth_base_url_not_allowed")
  }
  const origin = new URL(rawBaseUrl)

  const requestedOutput = value(args, "--output")
  if (requestedOutput && !isAbsolute(requestedOutput)) {
    throw new Error("test_owner_auth_output_must_be_absolute")
  }
  const outputPath = requestedOutput
    ? resolve(requestedOutput)
    : join(await mkdtemp(join(tmpdir(), "personal-plan-test-owner-")), "auth-state.json")
  if (await pathExists(outputPath)) throw new Error("test_owner_auth_output_exists")
  const partialPath = join(
    dirname(outputPath),
    `.auth-state-${randomBytes(8).toString("hex")}.partial`,
  )

  let browser
  let failureStage = "generate_link"
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: PERSONAL_PLAN_TEST_OWNER.email,
    })
    const tokenHash = data?.properties?.hashed_token
    if (error || typeof tokenHash !== "string" || !tokenHash) {
      throw new Error("one_time_link_generation_failed")
    }
    const confirmUrl = new URL("/auth/confirm", origin)
    confirmUrl.searchParams.set("token_hash", tokenHash)
    confirmUrl.searchParams.set("type", "magiclink")
    confirmUrl.searchParams.set("next", "/plan-start")

    failureStage = "consume_link"
    browser = await chromium.launch({ headless: true })
    const browserContext = await browser.newContext()
    const page = await browserContext.newPage()
    await page.goto(confirmUrl.toString(), { waitUntil: "domcontentloaded" })
    failureStage = "verify_owner"
    const profileResponse = await browserContext.request.get(
      new URL("/api/profile", origin).toString(),
    )
    if (!profileResponse.ok()) throw new Error("owner_verification_failed")
    const profileBody = await profileResponse.json()
    if (
      profileBody?.profile?.id !== snapshot.user.id ||
      profileBody?.profile?.email?.trim().toLowerCase() !== PERSONAL_PLAN_TEST_OWNER.email
    ) {
      throw new Error("owner_verification_failed")
    }

    failureStage = "open_plan_start"
    await page.goto(new URL("/plan-start", origin).toString(), { waitUntil: "domcontentloaded" })
    failureStage = "verify_stage1_frontier"
    await assertPersonalPlanTestOwnerStage1Frontier(page)

    failureStage = "write_storage_state"
    const state = await browserContext.storageState()
    await writeFile(partialPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    })
    await chmod(partialPath, 0o600)
    await rename(partialPath, outputPath)
    return { classification, outputPath, baseUrl: origin.origin }
  } catch {
    await unlink(partialPath).catch(() => undefined)
    throw new Error(`test_owner_one_time_authentication_failed:${failureStage}`)
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

export async function runPersonalPlanTestOwnerCommand({
  args,
  environment,
  admin,
  log = (value) => console.log(JSON.stringify(value)),
}) {
  const command = parsePersonalPlanTestOwnerCommand(args)
  const context = resolvePersonalPlanTestOwnerProjectContext(environment.NEXT_PUBLIC_SUPABASE_URL)
  if (!context.isLocal && context.projectId !== PERSONAL_PLAN_TEST_OWNER.projectId) {
    throw new Error("test_owner_project_mismatch")
  }

  if (command.action === "inspect") {
    const classification = classifyPersonalPlanTestOwner(await loadSnapshot(admin))
    log(publicStatus(classification, context, command.action))
    return
  }
  if (command.action === "prepare") {
    const classification = await prepareOwner(admin, args, environment, context)
    log(publicStatus(classification, context, command.action))
    return
  }
  if (command.action === "reset") {
    const result = await resetOwner(admin, args, environment, context)
    log(publicStatus(result.classification, context, command.action, { erasure: result.erasure }))
    return
  }

  const result = await createAuthState(admin, args, environment, context)
  log(
    publicStatus(result.classification, context, command.action, {
      baseUrl: result.baseUrl,
      storageStatePath: result.outputPath,
      sideEffect: "Opening /plan-start may create or resume Personal Plan state.",
      cleanup: "Delete this file immediately after the browser review.",
    }),
  )
}

async function main() {
  loadEnv({ path: ".env.local", quiet: true })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) throw new Error("test_owner_supabase_admin_environment_missing")
  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await runPersonalPlanTestOwnerCommand({
    args: process.argv.slice(2),
    environment: process.env,
    admin,
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "personal_plan_test_owner_failed")
    process.exitCode = 1
  })
}
