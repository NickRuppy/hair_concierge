import "./helpers/dom"
import assert from "node:assert/strict"
import { after, afterEach, mock, test } from "node:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { ResearchLabClient } from "../src/components/labs/research/research-lab-client"
import { getSharedResearchLab } from "../src/lib/labs/research/access"
import { buildOilLabReviewPackage } from "../src/lib/oil-research/lab-package"
import { detailFixture } from "./oil-lab-handoff-fixture"
import { POST } from "../src/app/api/labs/research/review/route"

const directory = mkdtempSync(join(tmpdir(), "oil-lab-dom-"))
const env = {
  NODE_ENV: process.env.NODE_ENV,
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: process.env.OIL_RESEARCH_LAB_REVIEW_STATE_PATH,
  OIL_RESEARCH_LAB_BUNDLE_DIR: process.env.OIL_RESEARCH_LAB_BUNDLE_DIR,
}
Object.assign(process.env, {
  NODE_ENV: "development",
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: join(directory, "state.json"),
  OIL_RESEARCH_LAB_BUNDLE_DIR: join(directory, "bundles"),
})
mkdirSync(join(directory, "bundles"))
writeFileSync(
  join(directory, "bundles/current.json"),
  JSON.stringify(buildOilLabReviewPackage(detailFixture())),
)
afterEach(() => {
  cleanup()
  mock.restoreAll()
})
after(() => {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  rmSync(directory, { recursive: true, force: true })
})

test("oil scenario conditions render without duplicate React keys", () => {
  const errors: unknown[][] = []
  mock.method(console, "error", (...args: unknown[]) => errors.push(args))
  render(<ResearchLabClient initialData={getSharedResearchLab("oil", "default")} />)
  assert.equal(
    errors.some((args) => String(args[0]).includes("same key")),
    false,
  )
})

test("oil completion shows actual matching draft and requires an explicit confirmation naming matching", async () => {
  const data = getSharedResearchLab("oil", "intake")
  let requests = 0
  mock.method(
    globalThis,
    "fetch",
    async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      requests++
      return POST(new Request("http://localhost/api/labs/research/review", options))
    },
  )
  render(<ResearchLabClient initialData={data} />)
  const matching = within(
    screen.getByRole("article", { name: "Matching-Vorschläge · manuell prüfen" }),
  )
  assert.match(matching.getByText(/Haardicken:/).textContent!, /Fein/)
  assert.match(matching.getByText(/Haardicken:/).textContent!, /natuerliches-oel/)
  assert.equal(screen.queryByText("Bisherige Öle-Ansicht"), null)
  fireEvent.click(
    screen.getByRole("button", { name: "Offene Eigenschaften freigeben und Prüfung abschließen" }),
  )
  const dialog = within(screen.getByRole("alertdialog", { name: "Freigabe bestätigen" }))
  assert.ok(dialog.getByText(/Öl-Eigenschaften und Matching-Vorschläge/))
  assert.equal(requests, 0)
  await act(async () => {
    fireEvent.click(dialog.getByRole("button", { name: "Freigabe bestätigen" }))
  })
  assert.equal(requests, 1)
  assert.ok(
    within(
      screen.getByRole("article", { name: "Matching-Vorschläge · manuell prüfen" }),
    ).getAllByText("Freigegeben").length,
  )
  assert.ok(screen.getByText("Lokal geprüft · noch nicht im Katalog"))
})
