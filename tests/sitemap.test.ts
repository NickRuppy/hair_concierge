import assert from "node:assert/strict"
import test from "node:test"

import { buildSitemap } from "../src/app/sitemap"

const staticUrls = [
  "https://chaarlie.de/",
  "https://chaarlie.de/quiz",
  "https://chaarlie.de/methodik",
  "https://chaarlie.de/kontakt",
  "https://chaarlie.de/impressum",
  "https://chaarlie.de/datenschutz",
  "https://chaarlie.de/agb",
  "https://chaarlie.de/widerruf",
]

test("sitemap contains only the canonical public foundation routes", () => {
  const sitemap = buildSitemap()
  const urls = sitemap.map(({ url }) => url)

  assert.deepEqual(urls, staticUrls)
  for (const omittedPath of [
    "/ratgeber",
    "/pricing",
    "/result/example",
    "/auth",
    "/app",
    "/admin",
    "/api/example",
    "/welcome",
  ]) {
    assert.ok(!urls.includes(`https://chaarlie.de${omittedPath}`), omittedPath)
  }
  assert.ok(sitemap.every((entry) => entry.lastModified === undefined))
})
