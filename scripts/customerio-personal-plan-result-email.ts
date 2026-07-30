import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  assertExpectedLayout,
  assertExpectedTemplateUpdateSchema,
  buildTemplateUpdateRequest,
  type CustomerIoTemplateUpdateRequest,
  type CustomerIoTemplateUpdateSchema,
} from "./customerio-quiz-result-email"

export const CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG = {
  cliPackage: "@customerio/cli@0.0.19",
  environmentId: 219516,
  messageId: 9,
  templateId: 76,
  sourceMessageId: 8,
  sourceTemplateId: 41,
  layoutId: 1,
  name: "personal_plan_result_artifact",
  copiedName: "[Copy] [Copy] quiz_result_artifact",
  state: "draft",
  subject: "Dein persönlicher Haarplan ist bereit",
  preheader: "Wir haben dein Haarprofil analysiert. Dein persönlicher Plan wartet auf dich.",
  htmlPath: "docs/customerio/personal-plan-result-artifact-template.html",
  plainTextPath: "docs/customerio/personal-plan-result-artifact-plain-text-template.txt",
  backupDirectory: "tmp/customerio-personal-plan-result-email",
} as const

type RemoteTemplate = Record<string, unknown> & {
  id: number
  transactional_message_id: number
  layout_id: number
  name: string
}

type RemoteMessage = {
  id: number
  name: string
  state: "draft" | "active"
  template_id: number
  type: string
  link_tracking: boolean
  send_to_unsubscribed: boolean
  hide_message_body: boolean
  has_sent_message: boolean
}

type Options = {
  environmentId: number
  messageId: number
  templateId: number
  apply: boolean
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function runCio(args: string[]): string {
  const result = spawnSync(
    "npx",
    ["--yes", CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG.cliPackage, ...args],
    { cwd: root, encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n").trim())
  }
  return result.stdout.trim()
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T
  } catch {
    throw new Error(`Customer.io ${label} returned invalid JSON`)
  }
}

function readInteger(args: string[], flag: string): number {
  const value = Number(args[args.indexOf(flag) + 1])
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Missing valid ${flag}`)
  return value
}

export function parsePersonalPlanEmailOptions(args: string[]): Options {
  const options = {
    environmentId: readInteger(args, "--environment-id"),
    messageId: readInteger(args, "--message-id"),
    templateId: readInteger(args, "--template-id"),
    apply: args.includes("--apply"),
  }
  const config = CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG
  if (
    options.environmentId !== config.environmentId ||
    options.messageId !== config.messageId ||
    options.templateId !== config.templateId
  ) {
    throw new Error(
      `Target must be environment/message/template ${config.environmentId}/${config.messageId}/${config.templateId}`,
    )
  }
  return options
}

function messagePath(environmentId: number, messageId: number) {
  return `/v1/environments/${environmentId}/transactional_messages/${messageId}`
}

function templatePath(environmentId: number, templateId: number) {
  return `/v1/environments/${environmentId}/templates/${templateId}`
}

function getMessage(options: Options): RemoteMessage {
  const response = parseJson<{ transactional_message?: RemoteMessage }>(
    runCio(["api", messagePath(options.environmentId, options.messageId), "--read-only"]),
    "message GET",
  )
  if (!response.transactional_message) throw new Error("Customer.io message was not returned")
  return response.transactional_message
}

function getTemplate(options: Options): {
  layouts?: Array<{ id: number; body: string; archived?: boolean }>
  template: RemoteTemplate
} {
  const response = parseJson<{
    layouts?: Array<{ id: number; body: string; archived?: boolean }>
    template?: RemoteTemplate
  }>(
    runCio(["api", templatePath(options.environmentId, options.templateId), "--read-only"]),
    "template GET",
  )
  if (!response.template) throw new Error("Customer.io template was not returned")
  return { layouts: response.layouts, template: response.template }
}

export function assertPersonalPlanMessage(message: RemoteMessage): void {
  const config = CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG
  const allowedNames = new Set<string>([config.copiedName, config.name])
  const invalid =
    message.id !== config.messageId ||
    message.template_id !== config.templateId ||
    message.state !== config.state ||
    message.type !== "email" ||
    !allowedNames.has(message.name) ||
    message.link_tracking !== true ||
    message.send_to_unsubscribed !== true ||
    message.hide_message_body !== false ||
    message.has_sent_message !== false
  if (invalid) throw new Error("Personal-plan Customer.io message identity/settings check failed")
}

export function assertPersonalPlanTemplate(template: RemoteTemplate): void {
  const config = CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG
  if (
    template.id !== config.templateId ||
    template.transactional_message_id !== config.messageId ||
    template.layout_id !== config.layoutId ||
    !new Set<string>([config.copiedName, config.name]).has(template.name)
  ) {
    throw new Error("Personal-plan Customer.io template identity check failed")
  }
}

function canonicalRequest(template: RemoteTemplate): CustomerIoTemplateUpdateRequest {
  const config = CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG
  const request = buildTemplateUpdateRequest(template, {
    subject: config.subject,
    preheaderText: config.preheader,
    body: readFileSync(path.join(root, config.htmlPath), "utf8"),
    bodyPlain: readFileSync(path.join(root, config.plainTextPath), "utf8"),
  })
  request.template.name = config.name
  return request
}

function assertPreflight() {
  const auth = parseJson<{ status?: string; verified?: boolean; region?: string }>(
    runCio(["auth", "status"]),
    "auth status",
  )
  if (auth.status !== "authenticated" || auth.verified !== true || auth.region !== "eu") {
    throw new Error("Customer.io EU authentication is not verified")
  }
  const schema = parseJson<CustomerIoTemplateUpdateSchema>(
    runCio(["schema", "templates.update"]),
    "templates.update schema",
  )
  assertExpectedTemplateUpdateSchema(schema)
}

function validate(options: Options, request: CustomerIoTemplateUpdateRequest) {
  const directory = mkdtempSync(path.join(tmpdir(), "customerio-personal-plan-"))
  const requestPath = path.join(directory, "template.json")
  try {
    writeFileSync(requestPath, JSON.stringify(request.template), "utf8")
    const result = parseJson<{ validation?: { valid?: boolean; errors?: unknown[] } }>(
      runCio([
        "api",
        templatePath(options.environmentId, options.templateId),
        "-X",
        "PUT",
        "--json",
        "{template:$template}",
        "--argjson",
        `template=@${requestPath}`,
        "--dry-run",
      ]),
      "template update dry-run",
    )
    if (result.validation?.valid !== true || result.validation.errors?.length) {
      throw new Error(`Customer.io rejected the template: ${JSON.stringify(result.validation)}`)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function sha(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex")
}

function updateMessageName(options: Options) {
  const config = CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG
  runCio([
    "api",
    messagePath(options.environmentId, options.messageId),
    "-X",
    "PUT",
    "--json",
    "{transactional_message:{update_type:$type,name:$name,description:$description}}",
    "--arg",
    "type=name_and_description",
    "--arg",
    `name=${config.name}`,
    "--arg",
    "description=Persönlicher Haarplan nach Abschluss des neuen Quiz",
  ])
}

function apply(
  options: Options,
  original: ReturnType<typeof getTemplate>,
  request: CustomerIoTemplateUpdateRequest,
) {
  const config = CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG
  const directory = path.join(root, config.backupDirectory)
  mkdirSync(directory, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backup = path.join(directory, `${stamp}-${config.messageId}-${config.templateId}.json`)
  const update = path.join(directory, `${stamp}-${config.templateId}-update.json`)
  writeFileSync(
    backup,
    `${JSON.stringify({ message: getMessage(options), ...original }, null, 2)}\n`,
  )
  writeFileSync(update, `${JSON.stringify(request.template, null, 2)}\n`)
  console.log(`Backup: ${path.relative(root, backup)}`)
  updateMessageName(options)
  runCio([
    "api",
    templatePath(options.environmentId, options.templateId),
    "-X",
    "PUT",
    "--json",
    "{template:$template}",
    "--argjson",
    `template=@${update}`,
  ])
  const message = getMessage(options)
  const readBack = getTemplate(options)
  assertPersonalPlanMessage(message)
  assertPersonalPlanTemplate(readBack.template)
  assertExpectedLayout(readBack.layouts)
  if (message.name !== config.name || readBack.template.name !== config.name) {
    throw new Error("Customer.io personal-plan name read-back failed")
  }
  for (const [key, value] of Object.entries(request.template)) {
    if (JSON.stringify(readBack.template[key]) !== JSON.stringify(value)) {
      throw new Error(`Customer.io read-back mismatch: ${key}`)
    }
  }
  console.log(
    `Applied and verified inactive message/template ${config.messageId}/${config.templateId}.`,
  )
}

export function main(args = process.argv.slice(2)) {
  if (args.includes("--help")) {
    console.log(
      "Usage: npm run customerio:personal-plan-result-email -- --environment-id 219516 --message-id 9 --template-id 76 [--apply]",
    )
    return
  }
  const options = parsePersonalPlanEmailOptions(args)
  assertPreflight()
  const message = getMessage(options)
  const current = getTemplate(options)
  assertPersonalPlanMessage(message)
  assertPersonalPlanTemplate(current.template)
  assertExpectedLayout(current.layouts)
  const request = canonicalRequest(current.template)
  validate(options, request)
  const requestTemplate = request.template as Record<string, unknown>
  const changed = Object.keys(requestTemplate).filter(
    (key) => JSON.stringify(current.template[key]) !== JSON.stringify(requestTemplate[key]),
  )
  console.log(`Mode: ${options.apply ? "apply" : "preview"}`)
  console.log(`Changed fields: ${changed.join(", ") || "none"}`)
  console.log(`HTML sha256: ${sha(request.template.body)}`)
  console.log(`Plain sha256: ${sha(request.template.body_plain)}`)
  if (options.apply) apply(options, current, request)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
