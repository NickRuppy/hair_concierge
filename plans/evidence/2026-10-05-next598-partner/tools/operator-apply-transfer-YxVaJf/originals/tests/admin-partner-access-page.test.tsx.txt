import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import PartnerAccessAdminPage from "../src/app/admin/partner-access/page"

test("partner admin page exposes the recurring single and batch workflow", () => {
  const html = renderToStaticMarkup(<PartnerAccessAdminPage />)
  assert.match(html, /Partnerzugänge/)
  assert.match(html, /Einzeln/)
  assert.match(html, /Mehrere/)
  assert.match(html, /Name/)
  assert.match(html, /E-Mail/)
  assert.match(html, /Zugang erstellen/)
  assert.doesNotMatch(html, /lebenslang|Abo|Zahlung/i)
})
