import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const htmlUrl = new URL(
  "../docs/customerio/personal-plan-result-artifact-template.html",
  import.meta.url,
)
const plainUrl = new URL(
  "../docs/customerio/personal-plan-result-artifact-plain-text-template.txt",
  import.meta.url,
)
const imageUrl = new URL("../public/images/emails/personal-plan-before-after.jpg", import.meta.url)

test("personal-plan result email has canonical rich, plain, and comparison assets", () => {
  assert.equal(existsSync(htmlUrl), true)
  assert.equal(existsSync(plainUrl), true)
  assert.equal(existsSync(imageUrl), true)
})

test("rich template is email-safe, compact, escaped, and hard-paywall only", () => {
  const html = readFileSync(htmlUrl, "utf8")
  assert.doesNotMatch(html, /<!doctype|<html\b|<head\b|<body\b|<style\b/i)
  assert.match(html, /role="presentation"/)
  assert.match(html, /max-width:\s*600px/)
  assert.match(html, /trigger\.comparison_image_url\s*\|\s*xml_escape/)
  assert.match(html, /width="552"/)
  assert.match(html, /trigger\.primary_message\.kind/)
  assert.match(html, /trigger\.primary_message\.label\s*\|\s*xml_escape/)
  assert.match(html, /\{% for row in trigger\.diagnostic_rows %\}/)
  assert.match(html, /row\.title\s*\|\s*xml_escape/)
  assert.match(html, /row\.summary\s*\|\s*xml_escape/)
  assert.match(html, /trigger\.plan_fit_statement\s*\|\s*xml_escape/)
  assert.equal((html.match(/trigger\.result_url/g) ?? []).length, 3)
  assert.doesNotMatch(html, /locked_plan|trigger\.products|trigger\.routine|trigger\.frequency/i)
  assert.doesNotMatch(
    html,
    /unsubscribe_url|Abmelden|Impressum|Datenschutz|Haarmony LLC|info@chaarlie\.de/i,
  )
})

test("plain text keeps all meaning and the legal fallback without the image", () => {
  const plain = readFileSync(plainUrl, "utf8")
  assert.match(plain, /Hallo,/)
  assert.match(plain, /trigger\.primary_message\.kind/)
  assert.match(plain, /trigger\.primary_message\.label/)
  assert.match(plain, /trigger\.diagnostic_rows/)
  assert.match(plain, /row\.title/)
  assert.match(plain, /row\.summary/)
  assert.match(plain, /trigger\.plan_fit_statement/)
  assert.match(plain, /trigger\.result_url/)
  assert.match(plain, /Abmelden: \{% unsubscribe_url %\}/)
  assert.match(plain, /https:\/\/chaarlie\.de\/impressum/)
  assert.match(plain, /https:\/\/chaarlie\.de\/datenschutz/)
  assert.doesNotMatch(plain, /locked_plan|trigger\.products|trigger\.routine|trigger\.frequency/i)
})
