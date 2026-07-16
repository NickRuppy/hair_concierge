import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG,
  assertExpectedLayout,
  assertExpectedTemplateUpdateSchema,
  assertReadBack,
  assertTargetIdentity,
  assertTargetMessage,
  assertWritableSnapshotUnchanged,
  buildTemplateUpdateRequest,
  loadCanonicalTemplateSources,
  parseCliOptions,
} from "../scripts/customerio-quiz-result-email"

const root = new URL("../", import.meta.url)
const html = readFileSync(new URL(CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.htmlPath, root), "utf8")
const plain = readFileSync(new URL(CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.plainTextPath, root), "utf8")

const remoteTemplate = {
  id: 41,
  transactional_message_id: 8,
  layout_id: 1,
  from_identity_id: null,
  reply_to_identity_id: null,
  name: "[Copy] quiz_result_artifact",
  bcc: null,
  fake_bcc: true,
  cc: null,
  recipient: null,
  subject: "Old subject",
  body: "Old body",
  body_json: "",
  image_url: "",
  body_amp: "",
  body_plain: "Old plain body",
  editor: "html",
  preprocessor: "",
  url: "",
  headers: [],
  request_method: "",
  template_type: "email",
  preheader_text: "Old preheader",
  language: "",
  template_engine: 1,
  whatsapp: false,
  test_group_id: "0",
  recipient_environment_id: null,
  variables: ["trigger.rows"],
  links: { metric: "/read-only" },
  created: 123,
}

const currentTemplateUpdateSchema = {
  http_method: "PUT",
  path: "/v1/environments/{environment_id}/templates/{template_id}",
  request_body_required: true,
  request_body_schema: {
    required: ["template"],
    properties: {
      template: {
        properties: Object.fromEntries(
          [
            "bcc",
            "body",
            "body_amp",
            "body_json",
            "body_plain",
            "cc",
            "deleted",
            "editor",
            "fake_bcc",
            "from_identity_id",
            "headers",
            "image_url",
            "language",
            "layout_id",
            "name",
            "newsletter_id",
            "preheader_text",
            "preprocessor",
            "recipient",
            "recipient_environment_id",
            "reply_to_identity_id",
            "request_method",
            "short_link_domain_id",
            "subject",
            "template_engine",
            "template_type",
            "test_group_id",
            "url",
            "webhook_config_id",
            "weight",
            "whatsapp",
          ].map((key) => [key, { nullable: true }]),
        ),
      },
    },
  },
}

test("canonical HTML is an email-safe fragment under layout 1", () => {
  assert.doesNotMatch(html, /<!doctype|<html\b|<head\b|<body\b|<style\b/i)
  assert.doesNotMatch(
    html,
    /unsubscribe_url|Abmelden|Impressum|Datenschutz|Haarmony LLC|info@chaarlie\.de/i,
  )
  assert.match(html, /role="presentation"/)
  assert.match(html, /max-width:\s*600px/)
  assert.match(html, /padding:\s*24px 4px/)
  assert.match(html, /word-break:\s*break-word/)
  const hiddenPreheader = html.match(/<div[\s\S]*?display:\s*none[\s\S]*?>([\s\S]*?)<\/div>/)?.[1]
  assert.ok(hiddenPreheader)
  assert.equal(
    hiddenPreheader
      .replace(/&#(?:8199|65279);/g, "")
      .replace(/\s+/g, " ")
      .trim(),
    CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.preheader,
  )
  assert.doesNotMatch(html, /\| escape/)
  for (const expression of html.matchAll(/\{\{\s*([^}]+)\s*\}\}/g)) {
    if (expression[1].includes("forloop.index")) continue
    assert.match(expression[1], /\|\s+xml_escape/, expression[0])
  }
})

test("canonical templates render the current trigger contract and no retired offer", () => {
  for (const field of [
    "trigger.first_name",
    "trigger.headline",
    "trigger.intro",
    "trigger.app_bridge_headline",
    "trigger.app_bridge_body",
    "trigger.signals",
    "signal.label",
    "signal.conclusion",
    "trigger.foundation_products",
    "product.category_label",
    "product.name",
    "product.note",
    "product.image_url",
    "product.cadence_label",
    "product.cadence_qualifier",
    "trigger.app_stories",
    "story.headline",
    "story.body",
    "trigger.cta_label",
    "trigger.result_url",
  ]) {
    assert.match(html, new RegExp(field.replace(".", "\\.")), field)
  }

  for (const source of [html, plain]) {
    assert.doesNotMatch(source, /customer\./)
    assert.doesNotMatch(source, /trigger\.(rows|main_lever|routine_levers)/)
    assert.doesNotMatch(source, /launch|rabatt|discount|testimonial|screenshot|garantie|dringend/i)
    assert.doesNotMatch(source, /https:\/\/chaarlie\.de\/result\//)
    assert.match(source, /trigger\.app_bridge_headline/)
    assert.match(source, /trigger\.app_bridge_body/)
    assert.match(source, /trigger\.app_stories/)
    assert.match(source, /story\.headline/)
    assert.match(source, /story\.body/)
    assert.match(source, /trigger\.cta_label/)
    assert.match(source, /trigger\.result_url/)
    assert.doesNotMatch(source, /product\.category_label[^\n]*· Beispiel/)
  }
})

test("product meaning and both result links survive missing images", () => {
  const withoutImages = html.replace(/<img\b[^>]*>/gi, "")
  for (const field of [
    "product.category_label",
    "product.name",
    "product.note",
    "product.cadence_label",
    "product.cadence_qualifier",
  ]) {
    assert.match(withoutImages, new RegExp(field.replace(".", "\\.")))
  }
  assert.equal((withoutImages.match(/trigger\.result_url/g) ?? []).length, 3)

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0])
  assert.ok(images.length > 0)
  for (const image of images) {
    assert.match(image, /alt="[^"]+"/i)
    const width = image.match(/width="(\d+)"/i)?.[1]
    const height = image.match(/height="(\d+)"/i)?.[1]
    assert.ok(width)
    assert.equal(height, width)
  }
})

test("capability section uses the approved grouped checklist hierarchy", () => {
  const capabilityMatch = html.match(
    /<!-- capabilities:start -->([\s\S]*?)<!-- capabilities:end -->/,
  )
  assert.ok(capabilityMatch)
  const capabilityBlock = capabilityMatch[1]

  assert.match(capabilityBlock, /\{\{ trigger\.app_bridge_headline \| xml_escape \}\}/)
  assert.match(capabilityBlock, /\{\{ trigger\.app_bridge_body \| xml_escape \}\}/)
  assert.match(capabilityBlock, /role="presentation"/)
  assert.match(capabilityBlock, /border:\s*1px solid #e9e0ed/)
  assert.match(capabilityBlock, /\{% for story in trigger\.app_stories %\}/)
  assert.match(capabilityBlock, /width="44"/)
  assert.match(capabilityBlock, /background-color:\s*#edf6f1/)
  assert.match(capabilityBlock, /color:\s*#2d7952/)
  assert.match(capabilityBlock, /aria-hidden="true"/)
  assert.match(capabilityBlock, /✓/)
  assert.match(capabilityBlock, /\{\{ story\.headline \| xml_escape \}\}/)
  assert.match(capabilityBlock, /\{\{ story\.body \| xml_escape \}\}/)
  assert.match(capabilityBlock, /unless forloop\.first/)
  assert.doesNotMatch(capabilityBlock, /story\.label|<h3\b|text-transform|letter-spacing/)
  assert.doesNotMatch(html, /story\.label/)

  const fontSizes = [
    ...new Set([...capabilityBlock.matchAll(/font-size:\s*(\d+)px/g)].map((match) => match[1])),
  ].sort()
  assert.deepEqual(fontSizes, ["15", "24"])
})

test("plain-text alternative is complete, multiline, and legally self-contained", () => {
  assert.ok((plain.match(/\n/g) ?? []).length > 20)
  assert.doesNotMatch(plain, / {2}\| {2}/)
  assert.match(plain, /trigger\.signals/)
  assert.match(plain, /trigger\.foundation_products/)
  assert.match(plain, /trigger\.app_stories/)
  assert.match(plain, /Abmelden: \{% unsubscribe_url %\}/)
  assert.match(plain, /Haarmony LLC/)
  assert.match(plain, /https:\/\/chaarlie\.de\/impressum/)
  assert.match(plain, /https:\/\/chaarlie\.de\/datenschutz/)
  assert.match(plain, /Liebe Grüße,\nChaarlie/)
  assert.match(plain, /\{\{ trigger\.result_url \}\}/)
  assert.doesNotMatch(plain, /trigger\.result_url \| escape/)
  assert.doesNotMatch(plain, /\| escape/)
})

test("update request exactly uses canonical sources and preserves writable metadata", () => {
  const sources = loadCanonicalTemplateSources(fileURLToPath(new URL("../", import.meta.url)))
  const request = buildTemplateUpdateRequest(remoteTemplate, sources)

  assert.equal(request.template.subject, CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.subject)
  assert.equal(request.template.preheader_text, CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.preheader)
  assert.equal(request.template.body, html)
  assert.equal(request.template.body_plain, plain)
  assert.equal(request.template.layout_id, remoteTemplate.layout_id)
  assert.equal(request.template.from_identity_id, remoteTemplate.from_identity_id)
  assert.equal(request.template.reply_to_identity_id, remoteTemplate.reply_to_identity_id)
  assert.equal(request.template.name, remoteTemplate.name)
  assert.equal(request.template.editor, remoteTemplate.editor)
  assert.equal(request.template.template_engine, remoteTemplate.template_engine)
  assert.equal(request.template.preprocessor, remoteTemplate.preprocessor)

  for (const getOnly of [
    "id",
    "transactional_message_id",
    "request_method",
    "variables",
    "links",
    "created",
  ]) {
    assert.equal(getOnly in request.template, false, getOnly)
  }
})

test("subject uses the sanitized name without HTML entities", () => {
  assert.match(CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.subject, /\{\{ trigger\.first_name \}\}/)
  assert.doesNotMatch(CUSTOMERIO_QUIZ_RESULT_EMAIL_CONFIG.subject, /\| escape/)
})

test("operator preflight guards message state, pairing, and legal layout content", () => {
  const draftOptions = parseCliOptions([
    "--target",
    "draft",
    "--environment-id",
    "219516",
    "--message-id",
    "8",
    "--template-id",
    "41",
  ])
  assert.doesNotThrow(() =>
    assertTargetMessage({ id: 8, state: "draft", template_id: 41, type: "email" }, draftOptions),
  )
  assert.throws(
    () =>
      assertTargetMessage({ id: 8, state: "active", template_id: 41, type: "email" }, draftOptions),
    /message state/,
  )
  assert.doesNotThrow(() =>
    assertExpectedLayout([
      {
        id: 1,
        archived: false,
        body: "{{ content }} {% unsubscribe_url %} https://chaarlie.de/impressum https://chaarlie.de/datenschutz",
      },
    ]),
  )
  assert.throws(
    () => assertExpectedLayout([{ id: 1, archived: false, body: "{{ content }}" }]),
    /required footer content/,
  )
})

test("operator fails closed when templates.update adds an unreviewed optional field", () => {
  assert.doesNotThrow(() => assertExpectedTemplateUpdateSchema(currentTemplateUpdateSchema))

  const driftedSchema = structuredClone(currentTemplateUpdateSchema)
  driftedSchema.request_body_schema.properties.template.properties.optional_delivery_mode = {
    nullable: true,
  }
  assert.throws(
    () => assertExpectedTemplateUpdateSchema(driftedSchema),
    /template schema drift: unreviewed mutable fields: optional_delivery_mode/,
  )
})

test("operator guards template identity, concurrent changes, and final read-back", () => {
  const options = parseCliOptions([
    "--target",
    "draft",
    "--environment-id",
    "219516",
    "--message-id",
    "8",
    "--template-id",
    "41",
  ])
  const original = structuredClone(remoteTemplate)
  const request = buildTemplateUpdateRequest(original, {
    subject: "New subject",
    preheaderText: "New preheader",
    body: "New body",
    bodyPlain: "New plain body",
  })

  assert.doesNotThrow(() => assertTargetIdentity(original, options))
  assert.throws(
    () => assertTargetIdentity({ ...original, name: "unexpected" }, options),
    /Target identity check failed/,
  )
  assert.doesNotThrow(() => assertWritableSnapshotUnchanged(original, structuredClone(original)))
  assert.throws(
    () => assertWritableSnapshotUnchanged(original, { ...original, subject: "concurrent edit" }),
    /changed after preview: subject/,
  )

  const readBack = { ...original, ...request.template } as typeof remoteTemplate
  assert.doesNotThrow(() => assertReadBack(readBack, options, request))
  assert.throws(
    () => assertReadBack({ ...readBack, body_plain: "truncated" }, options, request),
    /read-back mismatch: body_plain/,
  )
})

test("operator flags guard exact message/template pairs and active confirmation", () => {
  assert.equal(
    parseCliOptions([
      "--target",
      "draft",
      "--environment-id",
      "219516",
      "--message-id",
      "8",
      "--template-id",
      "41",
    ]).apply,
    false,
  )
  assert.throws(
    () =>
      parseCliOptions([
        "--target",
        "draft",
        "--environment-id",
        "219516",
        "--message-id",
        "7",
        "--template-id",
        "41",
      ]),
    /8\/41/,
  )
  assert.throws(
    () =>
      parseCliOptions([
        "--target",
        "active",
        "--environment-id",
        "219516",
        "--message-id",
        "7",
        "--template-id",
        "40",
        "--apply",
      ]),
    /--confirm-active/,
  )
  assert.equal(
    parseCliOptions([
      "--target",
      "active",
      "--environment-id",
      "219516",
      "--message-id",
      "7",
      "--template-id",
      "40",
      "--apply",
      "--confirm-active",
    ]).confirmActive,
    true,
  )
})

test("there is only one canonical HTML body", () => {
  assert.equal(
    existsSync(
      new URL("../docs/customerio/quiz-result-artifact-template.paste.html", import.meta.url),
    ),
    false,
  )
})
