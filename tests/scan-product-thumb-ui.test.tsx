import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime"
import { imageConfigDefault } from "next/dist/shared/lib/image-config"
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern"
import { configSchema } from "next/dist/server/config-schema"

import nextConfig from "../next.config"
import { ScanProductThumb } from "../src/components/scan/scan-product-thumb"

const imageUrl = "https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_320,w_320/example"
const config = { ...imageConfigDefault, ...nextConfig.images }

test("dm thumbnail browser sources use the optimizer, while catalog thumbnails keep their existing URL", () => {
  const markup = renderToStaticMarkup(
    <ImageConfigContext.Provider value={config}>
      <ScanProductThumb imageUrl={imageUrl} label="Shampoo" size={48} proxied />
    </ImageConfigContext.Provider>,
  )
  assert.match(markup, /src="\/_next\/image\?url=/)
  assert.match(markup, /srcSet="\/_next\/image\?url=/)
  assert.doesNotMatch(markup, /(?:src|srcSet)="https:/)
  assert.match(markup, /width="48" height="48"/)
  const catalogUrl = "https://catalog.example/image.jpg"
  const catalog = renderToStaticMarkup(
    <ScanProductThumb imageUrl={catalogUrl} label="Shampoo" size={48} />,
  )
  assert.match(catalog, /src="https:\/\/catalog.example\/image.jpg"/)
})

test("missing dm image renders an accessible placeholder without an outbound image", () => {
  const markup = renderToStaticMarkup(
    <ScanProductThumb imageUrl={null} label="Shampoo" size={48} proxied />,
  )
  assert.match(markup, /Shampoo: Bild nicht verfügbar/)
  assert.doesNotMatch(markup, /<img/)
})

test("pinned Next config enforces zero image redirects and keeps both previous remote patterns", () => {
  const parsed = configSchema.safeParse({ images: nextConfig.images })
  assert.equal(parsed.success, true)
  if (parsed.success) assert.equal(parsed.data.images?.maximumRedirects, 0)
  const allowed = (url: string) => hasRemoteMatch([], config.remotePatterns, new URL(url))
  assert.equal(allowed(imageUrl), true)
  assert.equal(allowed("http://products.dm-static.com/images/a"), false)
  assert.equal(allowed("https://products.dm-static.com.evil.test/images/a"), false)
  assert.equal(allowed("https://products.dm-static.com/other/a"), false)
  assert.equal(allowed("https://www.tophair.de/app/uploads/a.jpg"), true)
  assert.equal(allowed("https://assets.cdn.filesafe.space/a.jpg"), true)
})
