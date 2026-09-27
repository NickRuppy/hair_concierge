import assert from "node:assert/strict"
import test from "node:test"
import {
  AppStoreConfigError,
  AppStoreVerificationError,
  createAppStoreVerifier,
  loadAppleRootCertificates,
  readAppStoreVerifierConfig,
  type AppStoreVerifierConfig,
} from "../src/lib/app-store/verify"
import { b64url, certificate, chain, jws, trusted } from "./helpers/app-store-jws"

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
