import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG = {
  cliPackage: "@customerio/cli@0.0.19",
  environmentId: 219516,
  regionBaseUrl: "https://eu.fly.customer.io",
  layoutId: 1,
  subject:
    "{% if trigger.first_name != blank %}{{ trigger.first_name }}, deine Haaranalyse ist fertig{% else %}Deine Haaranalyse ist fertig{% endif %}",
  preheader: "Entdecke, womit deine Pflege beginnt und wie Chaarlie dich im Alltag begleitet.",
  targets: {
    draft: {
      messageId: 8,
      templateId: 41,
      name: "[Copy] quiz_result_artifact",
      state: "draft",
    },
    active: {
      messageId: 7,
      templateId: 40,
      name: "quiz_result_artifact",
      state: "active",
    },
  },
  htmlPath: "docs/customerio/quiz-result-artifact-template.html",
  plainTextPath: "docs/customerio/quiz-result-artifact-plain-text-template.txt",
  backupDirectory: "tmp/customerio-quiz-result-email",
} as const

type Target = keyof typeof CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.targets

const WRITABLE_TEMPLATE_KEYS = [
  "layout_id",
  "from_identity_id",
  "reply_to_identity_id",
  "name",
  "bcc",
  "fake_bcc",
  "cc",
  "recipient",
  "subject",
  "body",
  "body_json",
  "image_url",
  "body_amp",
  "body_plain",
  "editor",
  "preprocessor",
  "url",
  "headers",
  "template_type",
  "preheader_text",
  "language",
  "template_engine",
  "whatsapp",
  "test_group_id",
  "recipient_environment_id",
] as const

// These fields are exposed as mutable by templates.update, but are intentionally
// excluded from this transactional-email full replacement. They are destructive
// or belong to newsletter, webhook, short-link, or weighted-variant behavior.
// `request_method` is also omitted because the live email template returns an
// empty value that is invalid against the update enum.
const REVIEWED_OMITTED_TEMPLATE_UPDATE_KEYS = [
  "deleted",
  "newsletter_id",
  "request_method",
  "short_link_domain_id",
  "webhook_config_id",
  "weight",
] as const

type WritableTemplateKey = (typeof WRITABLE_TEMPLATE_KEYS)[number]
type RemoteTemplate = Record<string, unknown> & {
  id: number
  transactional_message_id: number
  layout_id: number
  name: string
}

type RemoteTransactionalMessage = {
  id: number
  state: "draft" | "active"
  template_id: number
  type: string
}

type RemoteLayout = {
  id: number
  body: string
  archived?: boolean
}

export type CustomerIoTemplateUpdateSchema = {
  http_method?: string
  path?: string
  request_body_required?: boolean
  request_body_schema?: {
    required?: string[]
    properties?: {
      template?: {
        properties?: Record<string, unknown>
      }
    }
  }
}

export type CanonicalTemplateSources = {
  subject: string
  preheaderText: string
  body: string
  bodyPlain: string
}

export type CustomerIoTemplateUpdateRequest = {
  template: Record<WritableTemplateKey, unknown>
}

type CliOptions = {
  target: Target
  environmentId: number
  messageId: number
  templateId: number
  apply: boolean
  confirmActive: boolean
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultRoot = path.resolve(scriptDirectory, "..")

function parseJson<T>(value: string, description: string): T {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    throw new Error(`Customer.io ${description} returned invalid JSON`, { cause: error })
  }
}

function runCio(args: string[]): string {
  const result = spawnSync(
    "npx",
    ["--yes", CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.cliPackage, ...args],
    {
      cwd: defaultRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    },
  )
  if (result.error) throw new Error(`Could not run pinned cio: ${result.error.message}`)
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    throw new Error(`cio ${args[0] ?? "command"} failed${details ? `:\n${details}` : ""}`)
  }
  return result.stdout.trim()
}

function sha256(value: unknown): string {
  const serialized = typeof value === "string" ? value : JSON.stringify(value)
  return createHash("sha256").update(serialized).digest("hex")
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function readFlag(args: string[], name: string): string {
  const index = args.indexOf(name)
  const value = index >= 0 ? args[index + 1] : undefined
  if (!value || value.startsWith("--")) throw new Error(`Missing required flag ${name}`)
  return value
}

function readIntegerFlag(args: string[], name: string): number {
  const value = Number(readFlag(args, name))
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

export function parseCliOptions(args: string[]): CliOptions {
  const target = readFlag(args, "--target")
  if (target !== "draft" && target !== "active") {
    throw new Error("--target must be either draft or active")
  }
  const options: CliOptions = {
    target,
    environmentId: readIntegerFlag(args, "--environment-id"),
    messageId: readIntegerFlag(args, "--message-id"),
    templateId: readIntegerFlag(args, "--template-id"),
    apply: args.includes("--apply"),
    confirmActive: args.includes("--confirm-active"),
  }
  const expected = CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.targets[target]
  if (options.environmentId !== CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.environmentId) {
    throw new Error(
      `Environment mismatch: expected ${CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.environmentId}`,
    )
  }
  if (options.messageId !== expected.messageId || options.templateId !== expected.templateId) {
    throw new Error(
      `${target} must use message/template pair ${expected.messageId}/${expected.templateId}`,
    )
  }
  if (target === "active" && options.apply && !options.confirmActive) {
    throw new Error("Active apply requires --confirm-active")
  }
  if (options.confirmActive && (target !== "active" || !options.apply)) {
    throw new Error("--confirm-active is only valid with --target active --apply")
  }
  return options
}

export function loadCanonicalTemplateSources(rootDir = defaultRoot): CanonicalTemplateSources {
  return {
    subject: CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.subject,
    preheaderText: CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.preheader,
    body: readFileSync(path.join(rootDir, CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.htmlPath), "utf8"),
    bodyPlain: readFileSync(
      path.join(rootDir, CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.plainTextPath),
      "utf8",
    ),
  }
}

export function buildTemplateUpdateRequest(
  remoteTemplate: RemoteTemplate,
  sources: CanonicalTemplateSources,
): CustomerIoTemplateUpdateRequest {
  const template = {} as Record<WritableTemplateKey, unknown>
  for (const key of WRITABLE_TEMPLATE_KEYS) {
    if (!(key in remoteTemplate)) throw new Error(`Live template is missing writable field ${key}`)
    template[key] = remoteTemplate[key]
  }
  template.subject = sources.subject
  template.preheader_text = sources.preheaderText
  template.body = sources.body
  template.body_plain = sources.bodyPlain
  return { template }
}

function templatePath(environmentId: number, templateId: number): string {
  return `/v1/environments/${environmentId}/templates/${templateId}`
}

function transactionalMessagePath(environmentId: number, messageId: number): string {
  return `/v1/environments/${environmentId}/transactional_messages/${messageId}`
}

function getRemoteTemplate(environmentId: number, templateId: number) {
  const response = parseJson<{ layouts?: RemoteLayout[]; template?: RemoteTemplate }>(
    runCio(["api", templatePath(environmentId, templateId), "--read-only"]),
    "template GET",
  )
  if (!response.template) throw new Error(`Customer.io template ${templateId} was not returned`)
  return { response, template: response.template }
}

function getRemoteTransactionalMessage(environmentId: number, messageId: number) {
  const response = parseJson<{ transactional_message?: RemoteTransactionalMessage }>(
    runCio(["api", transactionalMessagePath(environmentId, messageId), "--read-only"]),
    "transactional message GET",
  )
  if (!response.transactional_message) {
    throw new Error(`Customer.io transactional message ${messageId} was not returned`)
  }
  return response.transactional_message
}

export function assertTargetIdentity(template: RemoteTemplate, options: CliOptions): void {
  const expected = CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.targets[options.target]
  const mismatches = [
    template.id === options.templateId ? null : `template id ${String(template.id)}`,
    template.transactional_message_id === options.messageId
      ? null
      : `message id ${String(template.transactional_message_id)}`,
    template.name === expected.name ? null : `name ${JSON.stringify(template.name)}`,
    template.layout_id === CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.layoutId
      ? null
      : `layout ${String(template.layout_id)}`,
  ].filter(Boolean)
  if (mismatches.length > 0)
    throw new Error(`Target identity check failed: ${mismatches.join(", ")}`)
}

export function assertTargetMessage(
  message: RemoteTransactionalMessage,
  options: CliOptions,
): void {
  const expected = CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.targets[options.target]
  const mismatches = [
    message.id === options.messageId ? null : `message id ${String(message.id)}`,
    message.template_id === options.templateId
      ? null
      : `message template id ${String(message.template_id)}`,
    message.state === expected.state ? null : `message state ${JSON.stringify(message.state)}`,
    message.type === "email" ? null : `message type ${JSON.stringify(message.type)}`,
  ].filter(Boolean)
  if (mismatches.length > 0) {
    throw new Error(`Transactional message check failed: ${mismatches.join(", ")}`)
  }
}

export function assertExpectedLayout(layouts: RemoteLayout[] | undefined): void {
  const layout = layouts?.find(
    (candidate) => candidate.id === CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.layoutId,
  )
  if (!layout || layout.archived === true) {
    throw new Error(
      `Customer.io layout ${CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.layoutId} is unavailable`,
    )
  }
  const requiredFragments = [
    "{{ content }}",
    "{% unsubscribe_url %}",
    "https://chaarlie.de/impressum",
    "https://chaarlie.de/datenschutz",
  ]
  const missing = requiredFragments.filter((fragment) => !layout.body.includes(fragment))
  if (missing.length > 0) {
    throw new Error(`Customer.io layout is missing required footer content: ${missing.join(", ")}`)
  }
}

export function assertWritableSnapshotUnchanged(
  original: RemoteTemplate,
  current: RemoteTemplate,
): void {
  const changed = WRITABLE_TEMPLATE_KEYS.filter(
    (key) => JSON.stringify(original[key]) !== JSON.stringify(current[key]),
  )
  if (changed.length > 0) {
    throw new Error(`Customer.io template changed after preview: ${changed.join(", ")}`)
  }
}

export function assertExpectedTemplateUpdateSchema(schema: CustomerIoTemplateUpdateSchema): void {
  if (
    schema.http_method !== "PUT" ||
    schema.path !== "/v1/environments/{environment_id}/templates/{template_id}" ||
    schema.request_body_required !== true ||
    !schema.request_body_schema?.required?.includes("template")
  ) {
    throw new Error("Customer.io templates.update schema no longer matches the expected full PUT")
  }

  const templateProperties = schema.request_body_schema.properties?.template?.properties
  if (!templateProperties) {
    throw new Error("Customer.io template schema drift: nested template properties are unavailable")
  }

  const actualKeys = Object.keys(templateProperties)
  const reviewedKeys = new Set<string>([
    ...WRITABLE_TEMPLATE_KEYS,
    ...REVIEWED_OMITTED_TEMPLATE_UPDATE_KEYS,
  ])
  const unreviewedKeys = actualKeys.filter((key) => !reviewedKeys.has(key)).sort()
  const missingKeys = [...reviewedKeys].filter((key) => !(key in templateProperties)).sort()

  if (unreviewedKeys.length > 0 || missingKeys.length > 0) {
    const details = [
      unreviewedKeys.length > 0 ? `unreviewed mutable fields: ${unreviewedKeys.join(", ")}` : null,
      missingKeys.length > 0 ? `missing reviewed fields: ${missingKeys.join(", ")}` : null,
    ].filter(Boolean)
    throw new Error(`Customer.io template schema drift: ${details.join("; ")}`)
  }
}

function assertPreflight(): void {
  const auth = parseJson<{
    status?: string
    verified?: boolean
    base_url?: string
    region?: string
  }>(runCio(["auth", "status"]), "auth status")
  if (
    auth.status !== "authenticated" ||
    auth.verified !== true ||
    auth.region !== "eu" ||
    auth.base_url !== CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.regionBaseUrl
  ) {
    throw new Error("Customer.io must be authenticated against the verified EU management API")
  }
  const schema = parseJson<CustomerIoTemplateUpdateSchema>(
    runCio(["schema", "templates.update"]),
    "templates.update schema",
  )
  assertExpectedTemplateUpdateSchema(schema)
}

function validateUpdateRequest(
  environmentId: number,
  templateId: number,
  request: CustomerIoTemplateUpdateRequest,
): void {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "customerio-result-email-"))
  const templateJsonPath = path.join(temporaryDirectory, "template.json")
  try {
    writeFileSync(templateJsonPath, `${JSON.stringify(request.template, null, 2)}\n`, "utf8")
    const validation = parseJson<{ validation?: { valid?: boolean; errors?: unknown[] } }>(
      runCio([
        "api",
        templatePath(environmentId, templateId),
        "-X",
        "PUT",
        "--json",
        "{template:$template}",
        "--argjson",
        `template=@${templateJsonPath}`,
        "--dry-run",
      ]),
      "template update dry-run",
    )
    if (validation.validation?.valid !== true || validation.validation.errors?.length) {
      throw new Error(
        `Customer.io rejected the update request: ${JSON.stringify(validation.validation)}`,
      )
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

function printDiff(
  remote: RemoteTemplate,
  request: CustomerIoTemplateUpdateRequest,
  mode: "preview" | "apply",
): void {
  const changed = WRITABLE_TEMPLATE_KEYS.filter(
    (key) => JSON.stringify(remote[key]) !== JSON.stringify(request.template[key]),
  )
  console.log(
    mode === "apply"
      ? "Mode: apply (the selected Customer.io template will be updated after final guards)"
      : "Mode: preview (no Customer.io mutation)",
  )
  console.log(`Changed fields: ${changed.length ? changed.join(", ") : "none"}`)
  for (const key of changed) {
    if (key === "body" || key === "body_plain") {
      console.log(`${key}: ${sha256(remote[key])} -> ${sha256(request.template[key])} (sha256)`)
    } else {
      console.log(
        `${key}: ${JSON.stringify(remote[key])} -> ${JSON.stringify(request.template[key])}`,
      )
    }
  }
}

export function assertReadBack(
  remoteTemplate: RemoteTemplate,
  options: CliOptions,
  request: CustomerIoTemplateUpdateRequest,
): void {
  assertTargetIdentity(remoteTemplate, options)
  const mismatches = WRITABLE_TEMPLATE_KEYS.filter(
    (key) => JSON.stringify(remoteTemplate[key]) !== JSON.stringify(request.template[key]),
  )
  if (mismatches.length > 0)
    throw new Error(`Customer.io read-back mismatch: ${mismatches.join(", ")}`)
}

function applyUpdate(
  options: CliOptions,
  originalResponse: { layouts?: RemoteLayout[]; template?: RemoteTemplate },
  request: CustomerIoTemplateUpdateRequest,
): void {
  const originalTemplate = originalResponse.template
  if (!originalTemplate) throw new Error("Cannot back up a missing template")
  assertTargetMessage(
    getRemoteTransactionalMessage(options.environmentId, options.messageId),
    options,
  )
  const current = getRemoteTemplate(options.environmentId, options.templateId)
  assertTargetIdentity(current.template, options)
  assertExpectedLayout(current.response.layouts)
  assertWritableSnapshotUnchanged(originalTemplate, current.template)
  const backupRoot = path.join(defaultRoot, CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.backupDirectory)
  mkdirSync(backupRoot, { recursive: true })
  const stem = `${timestamp()}-${options.target}-${options.messageId}-${options.templateId}`
  const rawBackupPath = path.join(backupRoot, `${stem}-remote.json`)
  const rollbackPath = path.join(backupRoot, `${stem}-rollback.json`)
  const updatePath = path.join(backupRoot, `${stem}-update.json`)
  const rollbackRequest = buildTemplateUpdateRequest(originalTemplate, {
    subject: String(originalTemplate.subject ?? ""),
    preheaderText: String(originalTemplate.preheader_text ?? ""),
    body: String(originalTemplate.body ?? ""),
    bodyPlain: String(originalTemplate.body_plain ?? ""),
  })
  writeFileSync(rawBackupPath, `${JSON.stringify(originalResponse, null, 2)}\n`, "utf8")
  writeFileSync(rollbackPath, `${JSON.stringify(rollbackRequest.template, null, 2)}\n`, "utf8")
  writeFileSync(updatePath, `${JSON.stringify(request.template, null, 2)}\n`, "utf8")
  const rollbackCommand = `npx --yes ${CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.cliPackage} api ${templatePath(options.environmentId, options.templateId)} -X PUT --json '{template:$template}' --argjson template=@${path.relative(defaultRoot, rollbackPath)}`
  console.log(`Backup prepared: ${path.relative(defaultRoot, rawBackupPath)}`)
  console.log(`Rollback if apply or verification fails: ${rollbackCommand}`)
  runCio([
    "api",
    templatePath(options.environmentId, options.templateId),
    "-X",
    "PUT",
    "--json",
    "{template:$template}",
    "--argjson",
    `template=@${updatePath}`,
  ])
  const readBack = getRemoteTemplate(options.environmentId, options.templateId)
  assertExpectedLayout(readBack.response.layouts)
  assertReadBack(readBack.template, options, request)
  assertTargetMessage(
    getRemoteTransactionalMessage(options.environmentId, options.messageId),
    options,
  )
  console.log(`Applied and verified template ${options.templateId}.`)
}

export function main(args = process.argv.slice(2)): void {
  if (args.includes("--help")) {
    console.log(
      "Usage: npm run customerio:quiz-result-email -- --target <draft|active> --environment-id <id> --message-id <id> --template-id <id> [--apply] [--confirm-active]",
    )
    return
  }
  const options = parseCliOptions(args)
  assertPreflight()
  assertTargetMessage(
    getRemoteTransactionalMessage(options.environmentId, options.messageId),
    options,
  )
  const current = getRemoteTemplate(options.environmentId, options.templateId)
  assertTargetIdentity(current.template, options)
  assertExpectedLayout(current.response.layouts)
  const request = buildTemplateUpdateRequest(current.template, loadCanonicalTemplateSources())
  validateUpdateRequest(options.environmentId, options.templateId, request)
  printDiff(current.template, request, options.apply ? "apply" : "preview")
  if (!options.apply) {
    console.log("Dry-run complete. Re-run with --apply to mutate the selected target.")
    return
  }
  applyUpdate(options, current.response, request)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
