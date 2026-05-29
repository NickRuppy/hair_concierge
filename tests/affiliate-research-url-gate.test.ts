import assert from "node:assert/strict"
import test from "node:test"

import {
  isUsableUrl,
  hostOf,
  isAllowedHost,
  isDeniedHost,
  normalizeBrandSlug,
  passesBrandDirect,
  urlGate,
} from "../src/lib/affiliate-research/url-gate"

test("isUsableUrl accepts http(s) URLs, rejects junk", () => {
  assert.equal(isUsableUrl("https://www.dm.de/p/foo"), true)
  assert.equal(isUsableUrl("http://example.com"), true)
  assert.equal(isUsableUrl("ftp://example.com"), false)
  assert.equal(isUsableUrl(""), false)
  assert.equal(isUsableUrl("   "), false)
  assert.equal(isUsableUrl(null), false)
  assert.equal(isUsableUrl("not a url"), false)
})

test("hostOf returns lowercased host without port", () => {
  assert.equal(hostOf("https://WWW.DM.de:443/x"), "www.dm.de")
  assert.equal(hostOf("https://olaplex.com/products/n3"), "olaplex.com")
})

test("isAllowedHost matches with or without www. prefix", () => {
  assert.equal(isAllowedHost("www.dm.de"), true)
  assert.equal(isAllowedHost("dm.de"), true)
  assert.equal(isAllowedHost("www.amazon.de"), true)
  assert.equal(isAllowedHost("amazon.com"), false)
  assert.equal(isAllowedHost("random.example"), false)
})

test("isDeniedHost catches aggregators and ebay/aliexpress/amazon.com", () => {
  assert.equal(isDeniedHost("www.idealo.de"), true)
  assert.equal(isDeniedHost("geizhals.de"), true)
  assert.equal(isDeniedHost("ebay.de"), true)
  assert.equal(isDeniedHost("amazon.com"), true)
  assert.equal(isDeniedHost("www.dm.de"), false)
})

test("normalizeBrandSlug strips non-alphanumerics and normalizes umlauts", () => {
  assert.equal(normalizeBrandSlug("OLAPLEX"), "olaplex")
  assert.equal(normalizeBrandSlug("Sante"), "sante")
  assert.equal(normalizeBrandSlug("Sante Naturkosmetik"), "santenaturkosmetik")
  assert.equal(normalizeBrandSlug("Schwarzköpf"), "schwarzkoepf")
  assert.equal(normalizeBrandSlug("K18"), "k18")
})

test("passesBrandDirect matches brand slug as hostname substring, min slug length 4", () => {
  assert.equal(passesBrandDirect("olaplex.com", "OLAPLEX"), true)
  assert.equal(
    passesBrandDirect("k18hair.com", "K18"),
    false,
    "K18 slug too short, fails brand-direct",
  )
  assert.equal(passesBrandDirect("sante.de", "Sante"), true)
  assert.equal(passesBrandDirect("epres.com", "Epres"), true)
  assert.equal(passesBrandDirect("unrelated.de", "Sante"), false)
  assert.equal(passesBrandDirect("any.de", "AB"), false, "slug below 4 chars never matches")
})

test("urlGate returns pass=true for allowlisted host with valid URL", () => {
  const res = urlGate({
    chosen_url: "https://www.dm.de/p/foo",
    brand: "Pantene",
  })
  assert.equal(res.pass, true)
})

test("urlGate rejects denylisted hosts", () => {
  const res = urlGate({
    chosen_url: "https://www.idealo.de/foo",
    brand: "Pantene",
  })
  assert.equal(res.pass, false)
  assert.match(res.reason, /denylisted/i)
})

test("urlGate rejects malformed URLs", () => {
  const res = urlGate({
    chosen_url: "not a url",
    brand: "Pantene",
  })
  assert.equal(res.pass, false)
  assert.match(res.reason, /parse/i)
})

test("urlGate accepts brand-direct when host contains slug (length >= 4)", () => {
  const res = urlGate({
    chosen_url: "https://sante.de/products/foo",
    brand: "Sante",
  })
  assert.equal(res.pass, true)
})

test("urlGate rejects host that is neither allowlisted nor brand-direct", () => {
  const res = urlGate({
    chosen_url: "https://random-shop.example/foo",
    brand: "Pantene",
  })
  assert.equal(res.pass, false)
  assert.match(res.reason, /not on allowlist/i)
})
