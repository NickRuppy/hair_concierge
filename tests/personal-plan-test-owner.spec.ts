import { expect, test } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const enabled = process.env.PERSONAL_PLAN_STAGE1_5_ISOLATED_BROWSER === "1"
const baseUrl = process.env.PLAYWRIGHT_BASE_URL
const commandPath = resolve("scripts/personal-plan/test-owner.mjs")

function runCommand(...args: string[]) {
  return JSON.parse(
    execFileSync("node", [commandPath, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }),
  )
}

test.describe("reusable Personal Plan QA owner", () => {
  test.skip(!enabled || !baseUrl, "run through the isolated Stage 1–5 browser harness")

  test("prepares, authenticates through a one-time link, and resets to Stage 1", async ({
    browser,
  }) => {
    const workspace = await mkdtemp(join(tmpdir(), "personal-plan-test-owner-browser-"))
    const storageStatePath = join(workspace, "auth-state.json")
    try {
      const prepared = runCommand("prepare", "--apply")
      expect(prepared).toMatchObject({
        action: "prepare",
        project: "local",
        owner: "personal-plan-qa@hairconscierge.test",
        status: "ready",
        frontier: "stage1",
        safe: true,
      })

      const replayed = runCommand("prepare", "--apply")
      expect(replayed).toMatchObject({ status: "ready", frontier: "stage1", safe: true })

      const authenticated = runCommand(
        "auth-state",
        "--apply",
        `--base-url=${baseUrl}`,
        `--output=${storageStatePath}`,
      )
      expect(authenticated).toMatchObject({
        action: "auth-state",
        storageStatePath,
        owner: "personal-plan-qa@hairconscierge.test",
      })
      expect((await stat(storageStatePath)).mode & 0o777).toBe(0o600)

      const context = await browser.newContext({ storageState: storageStatePath })
      const page = await context.newPage()
      await page.goto("/plan-start")
      await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()

      const profileResponse = await context.request.get("/api/profile")
      expect(profileResponse.ok()).toBe(true)
      const profile = await profileResponse.json()
      expect(profile.profile.email).toBe("personal-plan-qa@hairconscierge.test")

      const progressed = runCommand("inspect")
      expect(progressed).toMatchObject({ status: "progressed", frontier: "in_progress" })
      await context.close()

      const reset = runCommand("reset", "--apply")
      expect(reset).toMatchObject({
        action: "reset",
        status: "ready",
        frontier: "stage1",
        safe: true,
      })
      expect(reset.erasure).toMatchObject({ outcome: "erased" })

      const resetReplay = runCommand("reset", "--apply")
      expect(resetReplay).toMatchObject({ status: "ready", frontier: "stage1", safe: true })
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })
})
