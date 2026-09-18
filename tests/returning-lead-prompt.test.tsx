import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { chromium } from "playwright"

test("return prompt requires an explicit choice, isolates focus, and supports pending/retry", async (t) => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {ReturningLeadPrompt} from './src/components/quiz/returning-lead-prompt';
        const root=createRoot(document.getElementById('root'));
        window.choices=[];
        window.renderPrompt=(busy=false)=>root.render(<ReturningLeadPrompt busy={busy}
          onContinue={()=>window.choices.push('continue')} onEdit={()=>window.choices.push('edit')}/>);
        window.unmountPrompt=()=>root.unmount(); window.renderPrompt();`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  })
  const browser = await chromium.launch()
  t.after(() => browser.close())
  const page = await browser.newPage({
    viewport: { width: 375, height: 667 },
    reducedMotion: "reduce",
  })
  await page.route("**/*", (route) => route.abort())
  await page.setContent('<button id="quiz">Glatt</button><div id="root"></div>')
  await page.locator("#quiz").focus()
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const dialog = page.getByRole("dialog", { name: "Du hast das Quiz schon gemacht." })
  const next = page.getByRole("button", { name: "Mit meinen Antworten weiter" })
  const edit = page.getByRole("button", { name: "Antworten bearbeiten" })
  await dialog.waitFor()
  await next.waitFor()
  await page.waitForFunction(
    () => document.activeElement?.textContent === "Mit meinen Antworten weiter",
  )
  assert.equal(await dialog.getAttribute("aria-modal"), "true")
  assert.equal(await dialog.locator("button").count(), 2)
  const descriptionId = await dialog.getAttribute("aria-describedby")
  assert.ok(descriptionId)
  assert.equal(
    await page.locator(`[id="${descriptionId}"]`).innerText(),
    "Deine Antworten sind noch da. Möchtest du sie übernehmen oder ändern?",
  )
  assert.equal(
    await page
      .locator("#quiz")
      .evaluate((element) => element instanceof HTMLElement && element.inert),
    true,
  )

  await page.keyboard.press("Shift+Tab")
  assert.equal(await edit.evaluate((element) => element === document.activeElement), true)
  await page.keyboard.press("Tab")
  assert.equal(await next.evaluate((element) => element === document.activeElement), true)
  await page.keyboard.press("Escape")
  assert.equal(await dialog.count(), 1)
  await page.locator("[data-returning-lead-overlay]").dispatchEvent("click")
  assert.equal(await dialog.count(), 1)
  assert.deepEqual(await page.evaluate(() => (window as any).choices), [])

  await next.click()
  await edit.click()
  assert.deepEqual(await page.evaluate(() => (window as any).choices), ["continue", "edit"])

  await page.evaluate(() => (window as any).renderPrompt(true))
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"]')?.getAttribute("aria-busy") === "true",
  )
  assert.equal(await next.isDisabled(), true)
  assert.equal(await edit.isDisabled(), true)
  assert.equal(await page.getByRole("status").innerText(), "Einen Moment bitte …")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  assert.deepEqual(await page.evaluate(() => (window as any).choices), ["continue", "edit"])

  await page.evaluate(() => (window as any).renderPrompt(false))
  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"] button')?.hasAttribute("disabled"),
  )
  await next.click()
  assert.deepEqual(await page.evaluate(() => (window as any).choices), [
    "continue",
    "edit",
    "continue",
  ])
  await page.evaluate(() => (window as any).unmountPrompt())
  assert.equal(
    await page
      .locator("#quiz")
      .evaluate((element) => element instanceof HTMLElement && element.inert),
    false,
  )
  assert.equal(
    await page.locator("#quiz").evaluate((element) => element === document.activeElement),
    true,
  )
})
