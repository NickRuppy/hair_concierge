import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ProductDrilldownScreen } from "../src/components/onboarding/screens/product-drilldown-screen"

test("onboarding product drilldown uses the canonical aligned two-line frequency labels", () => {
  const html = renderToStaticMarkup(
    <ProductDrilldownScreen
      category="conditioner"
      categoryLabel="Conditioner"
      intakeMethod="manual"
      productName="Test Conditioner"
      brandText=""
      frequency="weekly_1x"
      frontImagePath={null}
      committedFrontImagePath={null}
      existingUsageId={null}
      barcodeImagePath={null}
      isSupportedIntakeCategory={false}
      productIntakeEnabled={false}
      onIntakeMethodChange={() => {}}
      onBrandTextChange={() => {}}
      onProductNameChange={() => {}}
      onFrequencyChange={() => {}}
      onUploadImage={async () => {}}
      onContinue={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /role="slider"/)
  assert.match(html, /aria-valuetext="1x\/Woche"/)
  assert.match(html, /aria-label="1×\/Woche"/)
  assert.match(html, /data-slider-stop-marker="weekly_1x"/)
  assert.match(html, /data-slider-stop-label="weekly_1x"/)
  assert.match(html, /data-slider-label-line="1"[^>]*>1×\/<\/span>/)
  assert.match(html, /data-slider-label-line="2"[^>]*>Woche<\/span>/)
})
