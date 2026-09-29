#!/usr/bin/env node
/**
 * Builds data/research/leave-in-inci/v1.1/lab-fixture.json — the Lab review
 * fixture under Standard v1.1 (T20) — as an overlay of the byte-frozen v1.0
 * fixture. It does NOT re-run the 1800-line gold-set builder: T20 reopened one
 * field (§16), so only the `care_direction` row of each of the 15 in-category
 * products is replaced, from
 * data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json.
 *
 * Review-state machinery stays intact:
 *   - every other property keeps its v1.0 fingerprint, so its stored Lab
 *     approval still matches;
 *   - every in-category `care_direction` fingerprint changes (T20 reopened the
 *     field on every record — the T19 precedent: an approval under the old rule
 *     is not a stand-in for review under the new one), so exactly that row goes
 *     back to "unreviewed" and the product to "erneut prüfen";
 *   - the four G0-excluded records are untouched (T20 emits nothing for them),
 *     so their boundary approvals survive;
 *   - `standardVersion` keeps its v1.0-fixture stamp on purpose: the Lab's
 *     product staleness check compares it, and changing it would invalidate the
 *     untouched exclusion approvals for no evidentiary reason. The T20 reopen is
 *     carried by the property and product fingerprints instead.
 *
 * Usage (repo root): node scripts/leave-in-research/build-lab-fixture-v1.1.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"

import { fingerprint } from "./lab-fixture-shared.mjs"

const ROOT = process.cwd()
const BASE = path.join(ROOT, "data/research/leave-in-inci/v1.0/lab-fixture.json")
const RECORDS_RELATIVE =
  "data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json"
const OUT = path.join(ROOT, "data/research/leave-in-inci/v1.1/lab-fixture.json")

const fixture = JSON.parse(readFileSync(BASE, "utf8"))
const records = JSON.parse(readFileSync(path.join(ROOT, RECORDS_RELATIVE), "utf8")).records

/** Lab slot numbering: gold set 1-13, unseen u1-u6 as 14-19. */
function recordFor(product) {
  const key = product.batch === "unseen-test" ? `u${product.slot - 13}` : product.slot
  return records.find((record) => String(record.slot) === String(key))
}

function fingerprintProperty(property) {
  return fingerprint({
    path: property.path,
    value: property.value,
    rationale: property.rationale,
    observations: property.observations,
    counterSignals: property.counterSignals,
    derivedFrom: property.derivedFrom,
    echo: property.echo,
  })
}

function speciesLine(record) {
  const byClass = (speciesClass) =>
    record.species_above_tail
      .filter((species) => species.speciesClass === speciesClass)
      .map((species) => `${species.inci} r${species.rank}`)
  const parts = [
    ["Film", byClass("persistent_film")],
    ["DH", byClass("settled_humectant")],
    ["DL", byClass("medium_rich_lipid")],
    ["Glykol", byClass("multifunctional_glycol")],
    ["Dry-feel-Ester", byClass("dry_feel_ester")],
    ["Kationisch", byClass("cationic")],
  ].filter(([, list]) => list.length > 0)
  return parts.map(([label, list]) => `${label}: ${list.join(", ")}`).join(" · ")
}

function shortLine(record) {
  const cd = record.care_direction
  const head = cd.changed
    ? `T20 (v1.1): moisture → ${cd.value}, Zeile ${cd.row}, ${cd.confidence}.`
    : `T20 (v1.1): unverändert ${cd.value}, Zeile ${cd.row}, ${cd.confidence}.`
  const marker = record.tail_marker.rank
    ? `Marker ${record.tail_marker.ingredient} r${record.tail_marker.rank}.`
    : "Kein Marker (ordinale Lesung)."
  const review = cd.review_triggers.length ? ` Prüfen: ${cd.review_triggers.join(", ")}.` : ""
  const line = `${head} ${marker}${review}`
  return line.length <= 260 ? line : `${line.slice(0, 257)}…`
}

function rationaleFor(record) {
  const cd = record.care_direction
  return [
    `## \`care_direction\` — \`${cd.value}\` (Standard v1.1, T20)`,
    "",
    `- \`confidence\` **${cd.confidence}** · **E2** · formula · row \`${cd.row}\`${
      cd.film_lead_margin !== null ? ` · film-lead margin ${cd.film_lead_margin}` : ""
    }`,
    `- Species above the tail: ${speciesLine(record) || "none classified"}`,
    `- ${cd.note}`,
    ...(cd.confidence_step_down ? [`- Step-down: ${cd.confidence_step_down}`] : []),
    ...(cd.superseded_reading ? ["", `Superseded: ${cd.superseded_reading}`] : []),
  ].join("\n")
}

let touched = 0
for (const product of fixture.products) {
  if (product.g0.outOfCategory) continue
  const record = recordFor(product)
  if (!record) throw new Error(`no T20 record for Lab slot ${product.slot}`)
  const index = product.properties.findIndex((property) => property.path === "care_direction")
  if (index === -1) throw new Error(`Lab slot ${product.slot} has no care_direction row`)
  const before = product.properties[index]
  const cd = record.care_direction
  const after = {
    ...before,
    value: cd.value,
    rawValue: cd.value,
    confidence: cd.confidence,
    evidenceLevel: "E2",
    evidenceScope: "formula",
    echo: { ...before.echo, value: cd.value },
    reasoningShort: shortLine(record),
    rationale: rationaleFor(record),
    rationaleSource: `${RECORDS_RELATIVE} · slot ${record.slot}`,
    rationaleExtractionGap: false,
    observations: [`T20 species read: ${speciesLine(record)}`],
    counterSignals: cd.mandatory_counter_signal ? [cd.mandatory_counter_signal] : [],
    reviewNote: cd.review_triggers.length
      ? `T20 review: ${cd.review_triggers.join(", ")}`
      : null,
    adjudication: null,
  }
  product.properties[index] = after
  product.propertyFingerprints.care_direction = fingerprintProperty(after)
  product.productFingerprint = fingerprint(product.propertyFingerprints)

  if (cd.confidence === "low" && cd.routes_to_review && !product.uncertainFields.includes("care_direction"))
    product.uncertainFields = [...product.uncertainFields, "care_direction"]

  const retired = "care_direction_underfires_on_film_led_architecture"
  const newTriggers = cd.review_triggers.filter(
    (trigger) => !product.reviewRouting.triggers.includes(trigger),
  )
  if (product.reviewRouting.triggers.includes(retired) || newTriggers.length > 0) {
    product.reviewRouting = {
      ...product.reviewRouting,
      triggers: [
        ...product.reviewRouting.triggers.filter((trigger) => trigger !== retired),
        ...newTriggers,
      ],
      triggerBasis: [
        ...(product.reviewRouting.triggerBasis ?? []).filter(
          (entry) => !/care_direction under-firing/.test(entry.trigger),
        ),
        ...newTriggers.map((trigger) => ({
          trigger,
          basis: `Standard v1.1 T20 §9-O6 — ${cd.row}, confidence ${cd.confidence} (${RECORDS_RELATIVE}, slot ${record.slot})`,
        })),
      ],
    }
  }
  touched += 1
}
if (touched !== 15) throw new Error(`expected 15 in-category care_direction rows, touched ${touched}`)

fixture.generatedAt = "2026-09-29"
mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(fixture, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ out: path.relative(ROOT, OUT), careDirectionRowsReopened: touched })}\n`)
