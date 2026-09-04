import assert from "node:assert/strict"
import { appendFileSync, cpSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"

import { ShampooV14PilotClient } from "@/app/labs/shampoo-research/shampoo-v14-pilot-client"
import {
  applyShampooV14PilotReviewAction,
  loadShampooV14PilotReviewItems,
  type ShampooV14PilotReviewItem,
} from "@/lib/labs/shampoo-v14-pilot-review"

function renderItems(items: ShampooV14PilotReviewItem[], initialItemId: string) {
  return renderToStaticMarkup(
    <ShampooV14PilotClient datasetId="pilot" initialItems={items} initialItemId={initialItemId} />,
  )
}

function renderLab(initialItemId = "elvital-hydra-hyaluronic") {
  const items = loadShampooV14PilotReviewItems()
  return renderItems(items, initialItemId)
}

test("renders the five-product v1.4 pilot queue and local-only review boundary", () => {
  const markup = renderLab()

  assert.match(markup, /Shampoo Research Lab/)
  assert.match(markup, /Nur Entwicklung · Shampoo-v1.4-Pilot · keine Katalogfreigabe/)
  assert.match(markup, /Elvital Hydra \[Hyaluronic\] 72H Feuchtigkeit-Auffüllendes Shampoo/)
  assert.match(markup, /Shampoo Intense Keratin/)
  assert.match(markup, /Anti-Schuppen Shampoo Classic Clean/)
  assert.match(markup, /Shampoo Sensitiv/)
  assert.match(markup, /Shampoo &amp; Spülung 2in1 Volumen/)
  assert.doesNotMatch(markup, /Katalog anwenden|Publish|Veröffentlichen|Supabase|Catalog-Aktion/)
})

test("labels a wave dataset without changing the approved review structure", () => {
  const items = loadShampooV14PilotReviewItems()
  const waveOneMarkup = renderToStaticMarkup(
    <ShampooV14PilotClient datasetId="wave-01" initialItems={items} initialItemId={items[0]!.id} />,
  )
  const waveTwoMarkup = renderToStaticMarkup(
    <ShampooV14PilotClient datasetId="wave-02" initialItems={items} initialItemId={items[0]!.id} />,
  )

  assert.match(waveOneMarkup, /Shampoo-v1\.4-Welle 01/)
  assert.match(waveTwoMarkup, /Shampoo-v1\.4-Welle 02/)
  assert.match(waveOneMarkup, /5 Shampoo-Forschungsprodukte/)
  assert.doesNotMatch(waveOneMarkup, /Fünf Shampoo-v1\.4-Pilotprodukte/)
})

test("renders wave source evidence records as readable text instead of raw JSON", () => {
  const item = structuredClone(loadShampooV14PilotReviewItems()[0]!)
  assert.ok(item.formula)
  item.formula.claims = [{ source_id: "manufacturer", text: "Lesbarer Claim" }]
  item.formula.directions = [{ source_id: "retailer", text: "Lesbare Anwendung" }]
  item.formula.warnings = [{ description: "Lesbare Warnung" }]
  item.formula.openQuestions = [{ severity: "non_blocking", question: "Lesbare offene Frage" }]

  const markup = renderItems([item], item.id)

  assert.match(markup, /Lesbarer Claim/)
  assert.match(markup, /Lesbare Anwendung/)
  assert.match(markup, /Lesbare Warnung/)
  assert.match(markup, /Lesbare offene Frage/)
  assert.doesNotMatch(markup, /&quot;source_id&quot;/)
  assert.doesNotMatch(markup, /&quot;question&quot;/)
})

test("renders critical pilot evidence for formula conflicts, properties and projection rows", () => {
  const markup = renderLab()

  assert.match(markup, /Aufgelöster Quellen-\/Formelkonflikt/)
  assert.match(markup, /resolved non-material conflict evidence/)
  assert.match(markup, /versorgt Kopfhaut und Längen mit Feuchtigkeit/)
  assert.match(
    markup,
    /Auf nassem Haar auftragen, sanft in die Kopfhaut einmassieren und ausspülen/,
  )
  assert.match(markup, /product_correction/)
  assert.match(markup, /Kein sekundärer Fokus/)
  assert.match(markup, /Haardicke/)
  assert.match(markup, /shampoo_bucket/)
  assert.match(markup, /scalp_route/)
  assert.match(markup, /cleansing_intensity/)
  assert.match(markup, /normal/)
  assert.match(markup, /coarse/)
  assert.match(markup, /balanced/)
  assert.match(markup, /shampoo_everyday/)
  assert.match(
    markup,
    /High rinse-off conditioning and hydration-led positioning support coarse hair/,
  )
  assert.match(markup, /Gesamtes Pilotprodukt freigeben/)
})

test("renders formula-led v1.5 focus evidence while preserving the historical v1.4 value", () => {
  const elvital = renderLab("elvital-hydra-hyaluronic")
  assert.match(elvital, /Fokus-Policy v1\.5/)
  assert.match(elvital, /Feuchtigkeit \(moisture\)/)
  assert.match(elvital, /Vorher v1\.4: allgemein \(general\) · sekundär Glanz \(shine\)/)
  assert.match(elvital, /Formelurteil/)
  assert.match(elvital, /Feuchtigkeit unterstützt/)
  assert.match(elvital, /Claim-Rolle/)

  const sensitive = renderLab("isana-sensitiv")
  assert.match(sensitive, /Kopfhaut-Ziel \(scalp_active\)/)
  assert.match(sensitive, /Vorher v1\.4: sanft \(gentle\)/)

  const volume = renderLab("isana-2in1-volumen")
  assert.match(volume, /Volumen \(volume\)/)
  assert.match(volume, /nicht richtungsspezifisch/)
})

test("renders empty secondary focus and exact multi-route projection for selected products", () => {
  const emptySecondary = renderLab("isana-2in1-volumen")
  assert.match(emptySecondary, /Sekundärer Fokus/)
  assert.match(emptySecondary, /Kein sekundärer Fokus/)

  const dandruffProjection = renderLab("head-shoulders-classic-clean")
  assert.match(dandruffProjection, /schuppen/)
  assert.match(dandruffProjection, /dehydriert-fettig/)
  assert.match(dandruffProjection, /shampoo_dandruff/)
  assert.match(dandruffProjection, /shampoo_everyday/)
})

test("makes invalidated decisions and their archived history visible after artifact drift", () => {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-v14-review-ui-drift-"))
  const statePath = join(directory, "review-state.json")
  try {
    cpSync(join(process.cwd(), "plans/scan-db-expansion/research/shampoo-v14/pilot"), directory, {
      recursive: true,
    })
    const options = { pilotRoot: directory, reviewStatePath: statePath }
    const original = loadShampooV14PilotReviewItems(options)[0]!
    applyShampooV14PilotReviewAction(
      {
        action: "approve_formula",
        productId: original.id,
        expectedHash: original.integrity.hash,
      },
      options,
    )

    appendFileSync(join(directory, original.id, "source-packet.json"), "\n", "utf8")
    const changed = loadShampooV14PilotReviewItems(options)[0]!
    const changedMarkup = renderItems(loadShampooV14PilotReviewItems(options), changed.id)
    assert.match(changedMarkup, /Frühere Entscheidungen sind archiviert/)
    assert.match(changedMarkup, new RegExp(original.integrity.hash))

    applyShampooV14PilotReviewAction(
      {
        action: "approve_formula",
        productId: changed.id,
        expectedHash: changed.integrity.hash,
      },
      options,
    )
    const archivedMarkup = renderItems(loadShampooV14PilotReviewItems(options), changed.id)
    assert.match(archivedMarkup, /1 Entscheidungen/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
