import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { CelebrationPopup } from "../src/components/onboarding/screens/celebration-popup"

test("onboarding celebration renders its caller-selected Routine CTA", () => {
  const html = renderToStaticMarkup(
    <CelebrationPopup ctaLabel="ZU MEINER ROUTINE" onDismiss={() => undefined} />,
  )

  assert.match(html, />ZU MEINER ROUTINE</)
  assert.doesNotMatch(html, />ZUM CHAT</)
})
