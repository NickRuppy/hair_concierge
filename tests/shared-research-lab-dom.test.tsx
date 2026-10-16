import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { ResearchLabClient } from "../src/components/labs/research/research-lab-client"
import { getSharedResearchLab } from "../src/lib/labs/research/access"

afterEach(() => {
  cleanup()
  mock.restoreAll()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const initial = getSharedResearchLab("mask")
const other = getSharedResearchLab("mask", "default", "02-gliss-7sekunden-express-repair")
function row() {
  return within(screen.getByRole("article", { name: "Gewichtspotenzial" }))
}

test("shared rows immediately explain ingredients and keep lane confidence separate; bulk completion requires confirmation", () => {
  const calls: unknown[] = []
  mock.method(globalThis, "fetch", async (...args: Parameters<typeof fetch>) => {
    calls.push(args)
    return Response.json({})
  })
  render(<ResearchLabClient initialData={initial} />)
  assert.ok(row().getAllByText(/Das schwere Lipid Lanolin/).length > 0)
  assert.ok(row().getByText("A: Hoch"))
  assert.ok(row().getByText("B: Hoch"))
  assert.ok(row().getByText("Konf.: mittel"))
  assert.ok(row().getByText("Konf.: hoch"))
  fireEvent.click(screen.getByRole("button", { name: "Alle 7 offenen Eigenschaften freigeben" }))
  assert.ok(screen.getByRole("alertdialog", { name: "Freigabe bestätigen" }))
  assert.equal(calls.length, 0)
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "Abbrechen" }),
  )
  assert.equal(screen.queryByRole("alertdialog"), null)
  assert.equal(calls.length, 0)
})

test("failed shared save retains the exact rework comment and retries the same displayed product", async () => {
  const requests: Array<Record<string, unknown>> = []
  mock.method(
    globalThis,
    "fetch",
    async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      requests.push(JSON.parse(String(options?.body)))
      if (requests.length === 1)
        return Response.json({ error: "Datenträger voll." }, { status: 500 })
      return Response.json({ saved: true, data: initial })
    },
  )
  render(<ResearchLabClient initialData={initial} />)
  fireEvent.click(row().getByRole("button", { name: "Nacharbeit" }))
  const input = row().getByRole("textbox") as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: "Bitte Lanolin und die Konfidenz prüfen." } })
  await act(async () => {
    fireEvent.click(row().getByRole("button", { name: "Nacharbeit speichern" }))
  })
  assert.match(row().getByRole("alert").textContent!, /Datenträger voll/)
  assert.equal(input.value, "Bitte Lanolin und die Konfidenz prüfen.")
  await act(async () => {
    fireEvent.click(row().getByRole("button", { name: "Nacharbeit speichern" }))
  })
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1], {
    category: "mask",
    dataset: "default",
    itemId: "01-hask-argan-oil-sachet",
    displayFingerprint: initial.detail.displayFingerprint,
    actionId: "rework:profile.weightPotential",
    comment: "Bitte Lanolin und die Konfidenz prüfen.",
  })
  assert.equal(row().queryByRole("textbox"), null)
  assert.match(screen.getByRole("status").textContent!, /Review gespeichert/)
})

test("late save and load responses cannot replace a newer product or its rework draft", async () => {
  const save = deferred<Response>()
  const firstLoad = deferred<Response>()
  let loads = 0
  mock.method(
    globalThis,
    "fetch",
    async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method === "POST") return save.promise
      loads += 1
      return loads === 1 ? firstLoad.promise : Response.json({ data: other })
    },
  )
  render(<ResearchLabClient initialData={initial} />)
  fireEvent.click(row().getByRole("button", { name: "Freigeben" }))
  const queue = within(screen.getByRole("complementary", { name: "Prüfwarteschlange" }))
  fireEvent.click(queue.getByRole("button", { name: /Schwarzkopf Gliss Kur.*7 Sekunden/ }))
  fireEvent.click(queue.getByRole("button", { name: /Schwarzkopf Gliss Kur.*7 Sekunden/ }))
  await act(async () => {})
  assert.ok(screen.getByRole("heading", { name: other.detail.name }))
  fireEvent.click(row().getByRole("button", { name: "Nacharbeit" }))
  fireEvent.change(row().getByRole("textbox"), { target: { value: "Neuer Kommentar für Gliss." } })
  await act(async () => {
    save.resolve(Response.json({ saved: true, data: initial }))
    firstLoad.resolve(Response.json({ data: initial }))
  })
  assert.ok(screen.getByRole("heading", { name: other.detail.name }))
  assert.equal(
    (row().getByRole("textbox") as HTMLTextAreaElement).value,
    "Neuer Kommentar für Gliss.",
  )
  assert.equal(screen.queryByRole("status"), null)
})

test("a successful write with failed refresh blocks repeated writes until a fresh read", async () => {
  let writes = 0
  mock.method(
    globalThis,
    "fetch",
    async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method === "POST") {
        writes += 1
        return Response.json({ saved: true, refreshError: "Gespeichert. Bitte neu laden." })
      }
      return Response.json({ data: initial })
    },
  )
  render(<ResearchLabClient initialData={initial} />)
  await act(async () => {
    fireEvent.click(row().getByRole("button", { name: "Freigeben" }))
  })
  assert.equal(writes, 1)
  assert.equal(
    (row().getByRole("button", { name: "Freigeben" }) as HTMLButtonElement).disabled,
    true,
  )
  assert.match(screen.getByRole("status").textContent!, /Gespeichert/)
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Stand neu laden" }))
  })
  assert.equal(
    (row().getByRole("button", { name: "Freigeben" }) as HTMLButtonElement).disabled,
    false,
  )
  assert.equal(writes, 1)
})

test("stale review recovery reloads evidence without losing the comment and submits the new fingerprint", async () => {
  const fresh = { ...initial, detail: { ...initial.detail, displayFingerprint: "f".repeat(64) } }
  const submitted: Array<Record<string, unknown>> = []
  mock.method(
    globalThis,
    "fetch",
    async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method !== "POST") return Response.json({ data: fresh })
      submitted.push(JSON.parse(String(options.body)))
      return submitted.length === 1
        ? Response.json({ error: "Ergebnisse geändert. Bitte neu laden." }, { status: 409 })
        : Response.json({ saved: true, data: fresh })
    },
  )
  render(<ResearchLabClient initialData={initial} />)
  fireEvent.click(row().getByRole("button", { name: "Nacharbeit" }))
  fireEvent.change(row().getByRole("textbox"), { target: { value: "Konfidenz bitte prüfen." } })
  await act(async () => {
    fireEvent.click(row().getByRole("button", { name: "Nacharbeit speichern" }))
  })
  await act(async () => {
    fireEvent.click(row().getByRole("button", { name: "Stand neu laden · Kommentar behalten" }))
  })
  assert.equal((row().getByRole("textbox") as HTMLTextAreaElement).value, "Konfidenz bitte prüfen.")
  await act(async () => {
    fireEvent.click(row().getByRole("button", { name: "Nacharbeit speichern" }))
  })
  assert.equal(submitted[1].displayFingerprint, fresh.detail.displayFingerprint)
  assert.equal(submitted[1].comment, "Konfidenz bitte prüfen.")
})

test("the shared shell preserves category-specific working values and variable saved lanes", () => {
  render(<ResearchLabClient initialData={getSharedResearchLab("shampoo")} />)
  assert.ok(screen.getByRole("navigation", { name: "Shampoo-Datensatz" }))
  assert.ok(screen.getByRole("article", { name: "Formel & Quellen" }))
  assert.ok(screen.getByRole("article", { name: "Production-Light-Projektion" }))
  assert.ok(screen.getAllByText(/Arbeitswert · Konf\.:/).length > 0)
  cleanup()
  render(<ResearchLabClient initialData={getSharedResearchLab("conditioner")} />)
  assert.ok(screen.getByText(/Für diese Kalibrierungswerte wurde keine Konfidenz gespeichert/))
  const conditioner = within(screen.getAllByRole("article")[0])
  assert.ok(conditioner.getByText(/^K:/))
  assert.ok(conditioner.getByText(/^G:/))
  assert.equal(conditioner.queryByText(/^B:/), null)
  cleanup()
  render(<ResearchLabClient initialData={getSharedResearchLab("leave-in")} />)
  const leaveIn = within(screen.getAllByRole("article")[0])
  assert.ok(leaveIn.getByText(/^R:/))
  assert.equal(leaveIn.queryByText(/^B:/), null)
  assert.ok(leaveIn.getByText("Ein gespeichertes Ergebnis"))
})
