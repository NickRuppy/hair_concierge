import assert from "node:assert/strict"
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto"
import test from "node:test"
import {
  AppStoreConfigError,
  AppStoreVerificationError,
  createAppStoreVerifier,
  loadAppleRootCertificates,
  readAppStoreVerifierConfig,
  type AppStoreVerifierConfig,
} from "../src/lib/app-store/verify"

// ---- Minimal DER/X.509 builder: a local CA → intermediate → leaf chain carrying
// Apple's marker OIDs, so the library's real chain verification runs offline.

function der(tag: number, body: Buffer): Buffer {
  const length =
    body.length < 0x80
      ? Buffer.from([body.length])
      : body.length < 0x100
        ? Buffer.from([0x81, body.length])
        : Buffer.from([0x82, body.length >> 8, body.length & 0xff])
  return Buffer.concat([Buffer.from([tag]), length, body])
}
const seq = (...parts: Buffer[]) => der(0x30, Buffer.concat(parts))
function oid(value: string): Buffer {
  const arcs = value.split(".").map(Number)
  const bytes = [40 * arcs[0] + arcs[1]]
  for (const arc of arcs.slice(2)) {
    const chunk = [arc & 0x7f]
    for (let rest = arc >> 7; rest > 0; rest >>= 7) chunk.unshift((rest & 0x7f) | 0x80)
    bytes.push(...chunk)
  }
  return der(0x06, Buffer.from(bytes))
}
const name = (cn: string) => seq(der(0x31, seq(oid("2.5.4.3"), der(0x0c, Buffer.from(cn)))))
const utc = (iso: string) => der(0x17, Buffer.from(iso.replace(/[-:T]/g, "").slice(2, 14) + "Z"))
const ecdsaSha256 = seq(oid("1.2.840.10045.4.3.2"))
function extension(id: string, value: Buffer, critical = false) {
  return seq(oid(id), ...(critical ? [der(0x01, Buffer.from([0xff]))] : []), der(0x04, value))
}

type Issued = { der: Buffer; key: KeyObject; cn: string }
function certificate(cn: string, issuer: Issued | null, ca: boolean, markerOid?: string): Issued {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
  const extensions = [
    extension("2.5.29.19", ca ? seq(der(0x01, Buffer.from([0xff]))) : seq(), true),
    ...(markerOid ? [extension(markerOid, der(0x05, Buffer.alloc(0)))] : []),
  ]
  const tbs = seq(
    der(0xa0, der(0x02, Buffer.from([2]))),
    der(
      0x02,
      Buffer.from([1, ...Array.from({ length: 7 }, () => Math.floor(Math.random() * 256))]),
    ),
    ecdsaSha256,
    name(issuer?.cn ?? cn),
    seq(utc("2020-01-01T00:00:00"), utc("2045-01-01T00:00:00")),
    name(cn),
    publicKey.export({ type: "spki", format: "der" }),
    der(0xa3, seq(...extensions)),
  )
  const signature = sign("sha256", tbs, issuer?.key ?? privateKey)
  return {
    der: seq(tbs, ecdsaSha256, der(0x03, Buffer.concat([Buffer.from([0]), signature]))),
    key: privateKey,
    cn,
  }
}

function chain() {
  const root = certificate("Local Test Root", null, true)
  const intermediate = certificate("Local Test WWDR", root, true, "1.2.840.113635.100.6.2.1")
  const leaf = certificate("Local Test Signer", intermediate, false, "1.2.840.113635.100.6.11.1")
  return { root, intermediate, leaf }
}
const trusted = chain()

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url")
function jws(
  payload: object,
  signer = trusted,
  x5c = [signer.leaf, signer.intermediate, signer.root],
) {
  const header = b64url(
    JSON.stringify({ alg: "ES256", x5c: x5c.map((cert) => cert.der.toString("base64")) }),
  )
  const body = b64url(JSON.stringify(payload))
  const signature = sign("sha256", Buffer.from(`${header}.${body}`), {
    key: signer.leaf.key,
    dsaEncoding: "ieee-p1363",
  })
  return `${header}.${body}.${b64url(signature)}`
}

const signedDate = Date.parse("2026-09-20T10:00:00.000Z")
function transaction(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: "2000000000000002",
    originalTransactionId: "2000000000000001",
    bundleId: "de.chaarlie.app",
    productId: "de.chaarlie.scanner.monthly",
    type: "Auto-Renewable Subscription",
    purchaseDate: signedDate - 1000,
    expiresDate: signedDate + 30 * 24 * 60 * 60 * 1000,
    signedDate,
    environment: "Sandbox",
    inAppOwnershipType: "PURCHASED",
    ...overrides,
  }
}

const localMode = {
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "local",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth",
}
const localKeys = [...Object.keys(localMode), "MOBILE_PILOT_ENABLED"]

function withProcessEnv<T>(vars: Record<string, string | undefined>, run: () => T): T {
  const saved = Object.fromEntries(localKeys.map((key) => [key, process.env[key]]))
  for (const key of localKeys) delete process.env[key]
  Object.assign(process.env, vars)
  try {
    return run()
  } finally {
    for (const key of localKeys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

function config(overrides: Partial<AppStoreVerifierConfig> = {}): AppStoreVerifierConfig {
  return {
    bundleId: "de.chaarlie.app",
    appAppleId: 1234567890,
    environments: ["Production", "Sandbox"],
    rootCertificates: [trusted.root.der],
    enableOnlineChecks: false,
    ...overrides,
  }
}

async function rejects(promise: Promise<unknown>, code: AppStoreVerificationError["code"]) {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof AppStoreVerificationError && error.code === code,
  )
}

test("a transaction signed by a chain under a trusted root verifies and decodes", async () => {
  const verified = await createAppStoreVerifier(config()).verifyTransaction(jws(transaction()))
  assert.equal(verified.environment, "Sandbox")
  assert.equal(verified.payload.transactionId, "2000000000000002")
})

test("a foreign bundle is rejected", async () => {
  await rejects(
    createAppStoreVerifier(config()).verifyTransaction(
      jws(transaction({ bundleId: "com.example.other" })),
    ),
    "invalid_app",
  )
})

test("an environment outside the configured set is rejected", async () => {
  const productionOnly = createAppStoreVerifier(config({ environments: ["Production"] }))
  await rejects(
    productionOnly.verifyTransaction(jws(transaction({ environment: "Sandbox" }))),
    "invalid_environment",
  )
  await rejects(
    productionOnly.verifyTransaction(jws(transaction({ environment: "LocalTesting" }))),
    "invalid_environment",
  )
  await rejects(
    productionOnly.verifyTransaction(jws(transaction({ environment: undefined }))),
    "invalid_environment",
  )
})

test("Xcode (unsigned StoreKit test) data is rejected unless the verifier runs in local mode", async () => {
  const forged = certificate("Forged", null, false)
  const xcode = jws(transaction({ environment: "Xcode" }), {
    ...trusted,
    leaf: forged,
  })
  await rejects(createAppStoreVerifier(config()).verifyTransaction(xcode), "invalid_environment")
  // A hand-built config cannot enable unsigned data outside the full local-mode predicate.
  for (const env of [{}, { ...localMode, MOBILE_PILOT_ENABLED: "true" }]) {
    withProcessEnv(env, () =>
      assert.throws(
        () => createAppStoreVerifier(config({ environments: ["Xcode"], appAppleId: undefined })),
        (error: unknown) => error instanceof AppStoreConfigError,
      ),
    )
  }
  // Local StoreKit testing: Apple's library skips the signature for Xcode by design.
  const local = withProcessEnv(localMode, () =>
    createAppStoreVerifier(config({ environments: ["Xcode"], appAppleId: undefined })),
  )
  assert.equal((await local.verifyTransaction(xcode)).environment, "Xcode")
})

test("a chain under an untrusted root, a tampered payload, or a chain without marker OIDs is rejected", async () => {
  const foreign = chain()
  await rejects(
    createAppStoreVerifier(config()).verifyTransaction(jws(transaction(), foreign)),
    "invalid_signature",
  )

  const [header, , signature] = jws(transaction()).split(".")
  const tampered = `${header}.${b64url(JSON.stringify(transaction({ expiresDate: 4102444800000 })))}.${signature}`
  await rejects(createAppStoreVerifier(config()).verifyTransaction(tampered), "invalid_signature")

  const root = certificate("Unmarked Root", null, true)
  const intermediate = certificate("Unmarked WWDR", root, true)
  const leaf = certificate("Unmarked Signer", intermediate, false)
  await rejects(
    createAppStoreVerifier(config({ rootCertificates: [root.der] })).verifyTransaction(
      jws(transaction(), { root, intermediate, leaf }),
    ),
    "invalid_signature",
  )
  await rejects(
    createAppStoreVerifier(config()).verifyTransaction("not-a-jws"),
    "invalid_signature",
  )
})

test("a notification verifies the outer payload and its embedded transaction and renewal info", async () => {
  const renewal = {
    originalTransactionId: "2000000000000001",
    autoRenewProductId: "de.chaarlie.scanner.monthly",
    productId: "de.chaarlie.scanner.monthly",
    autoRenewStatus: 1,
    signedDate,
    environment: "Production",
  }
  const notification = (data: Record<string, unknown>) =>
    jws({
      notificationType: "DID_RENEW",
      notificationUUID: "0f8a2d8e-3b5a-4d5f-9d7e-2d1c7e6b8a90",
      version: "2.0",
      signedDate,
      data: {
        environment: "Production",
        bundleId: "de.chaarlie.app",
        appAppleId: 1234567890,
        signedTransactionInfo: jws(transaction({ environment: "Production" })),
        signedRenewalInfo: jws(renewal),
        ...data,
      },
    })
  const verifier = createAppStoreVerifier(config())
  const verified = await verifier.verifyNotification(notification({}))
  assert.equal(verified.environment, "Production")
  assert.equal(verified.payload.notificationType, "DID_RENEW")
  assert.equal(verified.transaction?.transactionId, "2000000000000002")
  assert.equal(verified.renewalInfo?.autoRenewStatus, 1)

  await rejects(verifier.verifyNotification(notification({ appAppleId: 42 })), "invalid_app")
  await rejects(
    verifier.verifyNotification(notification({ bundleId: "com.example.other" })),
    "invalid_app",
  )
  // An embedded transaction from another environment cannot ride on a valid envelope.
  await rejects(
    verifier.verifyNotification(
      notification({ signedTransactionInfo: jws(transaction({ environment: "Sandbox" })) }),
    ),
    "invalid_environment",
  )
  await rejects(
    verifier.verifyNotification(
      notification({
        signedTransactionInfo: jws(transaction({ environment: "Production" }), chain()),
      }),
    ),
    "invalid_signature",
  )
})

test("configuration fails closed", () => {
  const base = {
    APP_STORE_BUNDLE_ID: "de.chaarlie.app",
    APP_STORE_APP_APPLE_ID: "1234567890",
    APP_STORE_ENVIRONMENTS: "Production,Sandbox",
    MOBILE_AUTH_MODE: "pilot",
  }
  assert.deepEqual(readAppStoreVerifierConfig(base), {
    bundleId: "de.chaarlie.app",
    appAppleId: 1234567890,
    environments: ["Production", "Sandbox"],
  })
  assert.deepEqual(
    readAppStoreVerifierConfig({
      ...base,
      APP_STORE_APP_APPLE_ID: undefined,
      APP_STORE_ENVIRONMENTS: " Sandbox , Xcode ",
      ...localMode,
    }),
    { bundleId: "de.chaarlie.app", appAppleId: undefined, environments: ["Sandbox", "Xcode"] },
  )
  for (const broken of [
    { APP_STORE_BUNDLE_ID: undefined },
    { APP_STORE_BUNDLE_ID: "not a bundle" },
    { APP_STORE_ENVIRONMENTS: undefined },
    { APP_STORE_ENVIRONMENTS: "" },
    { APP_STORE_ENVIRONMENTS: "Production,LocalTesting" },
    { APP_STORE_ENVIRONMENTS: "production" },
    { APP_STORE_ENVIRONMENTS: "Sandbox,Xcode" },
    { APP_STORE_ENVIRONMENTS: "Xcode", MOBILE_AUTH_MODE: undefined },
    // MOBILE_AUTH_MODE=local alone is not local mode: every part of the predicate counts.
    {
      APP_STORE_ENVIRONMENTS: "Xcode",
      ...localMode,
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    },
    {
      APP_STORE_ENVIRONMENTS: "Xcode",
      ...localMode,
      NEXT_PUBLIC_SUPABASE_URL: "http://10.0.0.5:54321",
    },
    { APP_STORE_ENVIRONMENTS: "Xcode", ...localMode, MOBILE_PILOT_ENABLED: "true" },
    { APP_STORE_ENVIRONMENTS: "Xcode", ...localMode, MOBILE_AUTH_CALLBACK_URL: "chaarlie://auth" },
    { APP_STORE_ENVIRONMENTS: "Xcode", ...localMode, MOBILE_API_ENABLED: undefined },
    { APP_STORE_APP_APPLE_ID: undefined },
    { APP_STORE_APP_APPLE_ID: "12ab" },
    { APP_STORE_APP_APPLE_ID: "0" },
  ]) {
    assert.throws(
      () => readAppStoreVerifierConfig({ ...base, ...broken }),
      (error: unknown) => error instanceof AppStoreConfigError,
      JSON.stringify(broken),
    )
  }
  assert.throws(
    () => createAppStoreVerifier(config({ environments: [] })),
    (error: unknown) => error instanceof AppStoreConfigError,
  )
  assert.throws(
    () => createAppStoreVerifier(config({ rootCertificates: [] })),
    (error: unknown) => error instanceof AppStoreConfigError,
  )
})

test("the committed Apple root certificates load and parse", () => {
  const roots = loadAppleRootCertificates()
  assert.ok(roots.length >= 1)
  // Constructing a verifier parses every root as X.509.
  createAppStoreVerifier(config({ rootCertificates: roots, enableOnlineChecks: true }))
})
