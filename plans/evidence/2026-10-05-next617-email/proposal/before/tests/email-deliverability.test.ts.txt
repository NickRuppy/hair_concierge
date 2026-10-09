import assert from "node:assert/strict"
import test from "node:test"

import { checkEmailDeliverability, type EmailDnsResolver } from "../src/lib/email-deliverability"
import { suggestEmailCorrection } from "../src/lib/email-deliverability-shared"

const notFound = () => {
  const error = new Error("queryMx ENOTFOUND") as NodeJS.ErrnoException
  error.code = "ENOTFOUND"
  return error
}

const noData = () => {
  const error = new Error("queryMx ENODATA") as NodeJS.ErrnoException
  error.code = "ENODATA"
  return error
}

/** Resolver-Attrappe: nur die Faelle, die der Test braucht. */
function resolverFor({
  mx,
  a = [],
  aaaa = [],
  mxError,
  aError,
}: {
  mx?: { exchange: string; priority: number }[]
  a?: string[]
  aaaa?: string[]
  mxError?: unknown
  aError?: unknown
}): EmailDnsResolver {
  return {
    resolveMx: async () => {
      if (mxError) throw mxError
      return mx ?? []
    },
    resolve4: async () => {
      if (aError) throw aError
      return a
    },
    resolve6: async () => {
      if (aError) throw aError
      return aaaa
    },
  }
}

// ---------------------------------------------------------------- Tippfehler

test("korrigiert belegte Provider-Tippfehler aus den Bounce-Logs", () => {
  assert.equal(suggestEmailCorrection("asti.stoecker@gmail.vom"), "asti.stoecker@gmail.com")
  assert.equal(suggestEmailCorrection("nadinefriedrichs@gmx.den"), "nadinefriedrichs@gmx.de")
  assert.equal(suggestEmailCorrection("a@gmial.com"), "a@gmail.com")
  assert.equal(suggestEmailCorrection("a@web.d"), "a@web.de")
  assert.equal(suggestEmailCorrection("a@hotmial.com"), "a@hotmail.com")
})

test("schlaegt nichts vor bei real existierenden Domains", () => {
  // Diese Faelle waren Fehlvorschlaege einer Aehnlichkeitsheuristik:
  // mail.com liegt eine Einfuegung von gmail.com entfernt, .co eine von .com.
  assert.equal(suggestEmailCorrection("a@mail.com"), null)
  assert.equal(suggestEmailCorrection("a@example.co"), null)
  assert.equal(suggestEmailCorrection("a@gmx.com"), null)
  assert.equal(suggestEmailCorrection("a@live.com"), null)
  assert.equal(suggestEmailCorrection("a@mail.de"), null)
  assert.equal(suggestEmailCorrection("a@gmail.com"), null)
  assert.equal(suggestEmailCorrection("a@meine-echte-firma.de"), null)
})

test("verkraftet unvollstaendige Eingaben ohne zu werfen", () => {
  assert.equal(suggestEmailCorrection(""), null)
  assert.equal(suggestEmailCorrection("ohne-at-zeichen"), null)
  assert.equal(suggestEmailCorrection("@gmail.vom"), null)
  assert.equal(suggestEmailCorrection("a@"), null)
})

// ------------------------------------------------------------ MX-Sonderfaelle

test("nimmt Grossanbieter ohne DNS-Abfrage an", async () => {
  let called = false
  const resolver: EmailDnsResolver = {
    resolveMx: async () => {
      called = true
      return []
    },
    resolve4: async () => [],
    resolve6: async () => [],
  }
  const result = await checkEmailDeliverability("jemand@gmail.com", { resolver })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.outcome, "known_good")
  assert.equal(called, false, "fuer bekannte Domains darf kein Lookup laufen")
})

test("nimmt Domains mit gueltigem MX an", async () => {
  const resolver = resolverFor({ mx: [{ exchange: "mx.firma.de", priority: 10 }] })
  const result = await checkEmailDeliverability("jemand@firma.de", { resolver })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.outcome, "mx")
})

test("lehnt Null MX nach RFC 7505 ab", async () => {
  for (const exchange of ["", "."]) {
    const resolver = resolverFor({ mx: [{ exchange, priority: 0 }] })
    const result = await checkEmailDeliverability("jemand@kein-mail.de", { resolver })
    assert.equal(result.ok, false, `Null MX "${exchange}" muss abgelehnt werden`)
    if (!result.ok) assert.equal(result.reason, "null_mx")
  }
})

test("nimmt Domains ohne MX an, wenn ein A-Eintrag existiert (RFC 5321)", async () => {
  const resolver = resolverFor({ mxError: noData(), a: ["203.0.113.10"] })
  const result = await checkEmailDeliverability("jemand@nur-a-record.de", { resolver })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.outcome, "implicit_mx")
})

test("nimmt Domains ohne MX an, wenn ein AAAA-Eintrag existiert", async () => {
  const resolver = resolverFor({ mxError: noData(), aaaa: ["2001:db8::1"] })
  const result = await checkEmailDeliverability("jemand@nur-aaaa.de", { resolver })
  assert.equal(result.ok, true)
})

test("nimmt einen gueltigen A-Eintrag trotz transientem AAAA-Fehler als impliziten MX an", async () => {
  const boom = new Error("SERVFAIL") as NodeJS.ErrnoException
  boom.code = "ESERVFAIL"
  const resolver: EmailDnsResolver = {
    resolveMx: async () => [],
    resolve4: async () => ["203.0.113.10"],
    resolve6: async () => {
      throw boom
    },
  }
  const result = await checkEmailDeliverability("jemand@teilweise-erreichbar.de", { resolver })

  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.outcome, "implicit_mx")
})

test("lehnt Domains ohne MX und ohne A/AAAA ab und liefert den Vorschlag mit", async () => {
  let fallbackCalls = 0
  const resolver: EmailDnsResolver = {
    resolveMx: async () => {
      throw notFound()
    },
    resolve4: async () => {
      fallbackCalls += 1
      return []
    },
    resolve6: async () => {
      fallbackCalls += 1
      return []
    },
  }
  const result = await checkEmailDeliverability("asti@gmail.vom", { resolver })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.reason, "no_mx")
    assert.equal(result.suggestion, "asti@gmail.com")
  }
  assert.equal(fallbackCalls, 0, "NXDOMAIN darf keine unnoetigen A/AAAA-Abfragen starten")
})

test("lehnt ungueltiges Format ab, ohne DNS zu fragen", async () => {
  let called = false
  const resolver: EmailDnsResolver = {
    resolveMx: async () => {
      called = true
      return []
    },
    resolve4: async () => [],
    resolve6: async () => [],
  }
  const result = await checkEmailDeliverability("keine-mail-adresse", { resolver })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "format")
  assert.equal(called, false)
})

// ------------------------------------------------------------------ Fail open

test("laesst bei DNS-Zeitueberschreitung durch", async () => {
  const resolver: EmailDnsResolver = {
    resolveMx: () => new Promise(() => {}),
    resolve4: async () => [],
    resolve6: async () => [],
  }
  const result = await checkEmailDeliverability("jemand@langsam.de", {
    resolver,
    timeoutMs: 20,
  })
  assert.equal(result.ok, true, "ein haengender Resolver darf keine Leads blockieren")
  if (result.ok) assert.equal(result.outcome, "fail_open")
})

test("laesst bei unerwartetem Resolver-Fehler durch", async () => {
  const boom = new Error("SERVFAIL") as NodeJS.ErrnoException
  boom.code = "ESERVFAIL"
  const resolver = resolverFor({ mxError: boom })
  const result = await checkEmailDeliverability("jemand@kaputt.de", { resolver })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.outcome, "fail_open")
})

test("laesst durch, wenn der A/AAAA-Fallback in einen Timeout laeuft", async () => {
  const resolver: EmailDnsResolver = {
    resolveMx: async () => [],
    resolve4: () => new Promise(() => {}),
    resolve6: () => new Promise(() => {}),
  }
  const result = await checkEmailDeliverability("jemand@fallback-haengt.de", {
    resolver,
    timeoutMs: 20,
  })
  assert.equal(result.ok, true)
})

test("teilt ein einziges Zeitbudget zwischen MX und A/AAAA", async (context) => {
  const timeoutMs = 300
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 })
  const resolver: EmailDnsResolver = {
    resolveMx: () => new Promise((resolve) => setTimeout(() => resolve([]), 200)),
    resolve4: () => new Promise(() => {}),
    resolve6: () => new Promise(() => {}),
  }
  const resultPromise = checkEmailDeliverability("jemand@geteiltes-budget.de", {
    resolver,
    timeoutMs,
  })
  await Promise.resolve()

  context.mock.timers.tick(200)
  await Promise.resolve()
  await Promise.resolve()
  context.mock.timers.tick(99)

  let settled = false
  void resultPromise.then(() => {
    settled = true
  })
  await Promise.resolve()
  assert.equal(settled, false, "das gemeinsame Budget darf nicht vorzeitig enden")

  context.mock.timers.tick(1)
  const result = await resultPromise

  assert.equal(result.ok, true, "das gemeinsame Zeitbudget muss fail-open enden")
  if (result.ok) assert.equal(result.outcome, "fail_open")
  assert.equal(Date.now(), timeoutMs, "MX und Fallback duerfen kein zweites Budget starten")
})

test("raeumt den Timeout nach erfolgreichem Lookup ab", async () => {
  // Ein nicht abgeraeumter Timer haelt das Event-Loop offen. Wenn dieser Test
  // durchlaeuft und der Prozess danach beendet, ist der Timer sauber geloescht.
  const before = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length
  const resolver = resolverFor({ mx: [{ exchange: "mx.firma.de", priority: 10 }] })
  await checkEmailDeliverability("jemand@firma.de", { resolver, timeoutMs: 60_000 })
  const after = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length
  assert.equal(after, before, "nach dem Lookup darf kein Timer offen bleiben")
})

test("normalisiert die Adresse auf Kleinschreibung ohne Leerzeichen", async () => {
  const result = await checkEmailDeliverability("  Jemand@Gmail.com  ")
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.normalized, "jemand@gmail.com")
})
