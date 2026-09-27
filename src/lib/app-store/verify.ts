import "server-only"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library"
import { localMobileModeEnabled } from "../mobile/pilot"
import { APP_STORE_ENVIRONMENTS, type AppStoreEnvironment } from "./state"

/**
 * Apple JWS verification. One SignedDataVerifier per allowed environment; the
 * unverified environment claim only selects the verifier, which re-checks it after
 * the signature, bundle ID and (Production) app Apple ID checks.
 *
 * `Xcode` is local StoreKit testing: Apple's library accepts it WITHOUT a signature,
 * so it is allowed only under the full local-mode predicate (localMobileModeEnabled),
 * checked both when reading config and again in the factory.
 */

export type AppStoreVerifierConfig = {
  bundleId: string
  appAppleId: number | undefined
  environments: readonly AppStoreEnvironment[]
  /** DER-encoded trusted roots (Apple's in production, a local test CA in tests). */
  rootCertificates: readonly Buffer[]
  /** OCSP revocation checks against Apple; off only for offline test chains. */
  enableOnlineChecks: boolean
}

export class AppStoreConfigError extends Error {
  constructor() {
    super("app_store_not_configured")
    this.name = "AppStoreConfigError"
  }
}

export class AppStoreVerificationError extends Error {
  constructor(
    readonly code: "invalid_signature" | "invalid_app" | "invalid_environment" | "retryable",
    options?: { cause?: unknown },
  ) {
    super(code, options)
    this.name = "AppStoreVerificationError"
  }
}

const BUNDLE_ID = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/
const APP_APPLE_ID = /^[1-9][0-9]{0,15}$/

export function readAppStoreVerifierConfig(
  env: Record<string, string | undefined> = process.env,
): Pick<AppStoreVerifierConfig, "bundleId" | "appAppleId" | "environments"> {
  const bundleId = env.APP_STORE_BUNDLE_ID
  if (!bundleId || !BUNDLE_ID.test(bundleId)) throw new AppStoreConfigError()
  const environments = (env.APP_STORE_ENVIRONMENTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  if (
    environments.length === 0 ||
    environments.some((value) => !(APP_STORE_ENVIRONMENTS as readonly string[]).includes(value)) ||
    (environments.includes("Xcode") && !localMobileModeEnabled(env))
  )
    throw new AppStoreConfigError()
  const rawAppleId = env.APP_STORE_APP_APPLE_ID
  if (rawAppleId !== undefined && !APP_APPLE_ID.test(rawAppleId)) throw new AppStoreConfigError()
  const appAppleId = rawAppleId === undefined ? undefined : Number(rawAppleId)
  if (environments.includes("Production") && appAppleId === undefined)
    throw new AppStoreConfigError()
  return {
    bundleId,
    appAppleId,
    environments: Array.from(new Set(environments)) as AppStoreEnvironment[],
  }
}

const APPLE_ROOT_CERTIFICATES = [
  "AppleRootCA-G3.cer",
  "AppleRootCA-G2.cer",
  "AppleIncRootCertificate.cer",
]

/** Routes that verify must trace src/lib/app-store/certs (next.config outputFileTracingIncludes). */
export function loadAppleRootCertificates(): Buffer[] {
  const directory = path.join(process.cwd(), "src/lib/app-store/certs")
  return APPLE_ROOT_CERTIFICATES.map((file) =>
    readFileSync(/* turbopackIgnore: true */ path.join(directory, file)),
  )
}

const LIBRARY_ENVIRONMENT: Record<AppStoreEnvironment, Environment> = {
  Production: Environment.PRODUCTION,
  Sandbox: Environment.SANDBOX,
  Xcode: Environment.XCODE,
}

function unverifiedClaims(jws: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(jws.split(".")[1] ?? "", "base64url").toString("utf8"),
    )
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>
  } catch {
    /* Rejected below. */
  }
  throw new AppStoreVerificationError("invalid_signature")
}

function nestedEnvironment(claims: Record<string, unknown>): unknown {
  for (const key of ["data", "summary", "appData"]) {
    const value = claims[key]
    if (value && typeof value === "object") return (value as Record<string, unknown>).environment
  }
  return undefined
}

function translate(error: unknown): AppStoreVerificationError {
  if (error instanceof AppStoreVerificationError) return error
  if (error instanceof VerificationException) {
    if (error.status === VerificationStatus.INVALID_APP_IDENTIFIER)
      return new AppStoreVerificationError("invalid_app", { cause: error })
    if (error.status === VerificationStatus.INVALID_ENVIRONMENT)
      return new AppStoreVerificationError("invalid_environment", { cause: error })
    if (error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)
      return new AppStoreVerificationError("retryable", { cause: error })
  }
  return new AppStoreVerificationError("invalid_signature", { cause: error })
}

export type VerifiedNotification = {
  environment: AppStoreEnvironment
  payload: ResponseBodyV2DecodedPayload
  transaction: JWSTransactionDecodedPayload | null
  renewalInfo: JWSRenewalInfoDecodedPayload | null
}

export type AppStoreVerifier = {
  verifyTransaction(
    jws: string,
  ): Promise<{ environment: AppStoreEnvironment; payload: JWSTransactionDecodedPayload }>
  verifyRenewalInfo(
    jws: string,
  ): Promise<{ environment: AppStoreEnvironment; payload: JWSRenewalInfoDecodedPayload }>
  verifyNotification(signedPayload: string): Promise<VerifiedNotification>
}

/**
 * Build config with readAppStoreVerifierConfig. The factory re-checks the Xcode rule
 * against the live process environment so a hand-built config cannot enable unsigned data.
 */
export function createAppStoreVerifier(config: AppStoreVerifierConfig): AppStoreVerifier {
  if (
    config.environments.length === 0 ||
    config.rootCertificates.length === 0 ||
    (config.environments.includes("Xcode") && !localMobileModeEnabled(process.env))
  )
    throw new AppStoreConfigError()
  const verifiers = new Map<AppStoreEnvironment, SignedDataVerifier>()
  for (const environment of config.environments) {
    try {
      verifiers.set(
        environment,
        new SignedDataVerifier(
          [...config.rootCertificates],
          config.enableOnlineChecks,
          LIBRARY_ENVIRONMENT[environment],
          config.bundleId,
          config.appAppleId,
        ),
      )
    } catch {
      throw new AppStoreConfigError()
    }
  }

  function select(claimed: unknown): [AppStoreEnvironment, SignedDataVerifier] {
    const verifier = verifiers.get(claimed as AppStoreEnvironment)
    if (!verifier) throw new AppStoreVerificationError("invalid_environment")
    return [claimed as AppStoreEnvironment, verifier]
  }

  return {
    async verifyTransaction(jws) {
      try {
        const [environment, verifier] = select(unverifiedClaims(jws).environment)
        return { environment, payload: await verifier.verifyAndDecodeTransaction(jws) }
      } catch (error) {
        throw translate(error)
      }
    },
    async verifyRenewalInfo(jws) {
      try {
        const [environment, verifier] = select(unverifiedClaims(jws).environment)
        return { environment, payload: await verifier.verifyAndDecodeRenewalInfo(jws) }
      } catch (error) {
        throw translate(error)
      }
    },
    async verifyNotification(signedPayload) {
      try {
        const [environment, verifier] = select(nestedEnvironment(unverifiedClaims(signedPayload)))
        const payload = await verifier.verifyAndDecodeNotification(signedPayload)
        // The envelope's verifier also checks the embedded JWS, so both must share its environment.
        const transaction = payload.data?.signedTransactionInfo
          ? await verifier.verifyAndDecodeTransaction(payload.data.signedTransactionInfo)
          : null
        const renewalInfo = payload.data?.signedRenewalInfo
          ? await verifier.verifyAndDecodeRenewalInfo(payload.data.signedRenewalInfo)
          : null
        return { environment, payload, transaction, renewalInfo }
      } catch (error) {
        throw translate(error)
      }
    },
  }
}

let defaultVerifier: AppStoreVerifier | undefined

/** Production verifier from env + Apple's committed roots, with OCSP online checks. */
export function appStoreVerifier(): AppStoreVerifier {
  defaultVerifier ??= createAppStoreVerifier({
    ...readAppStoreVerifierConfig(),
    rootCertificates: loadAppleRootCertificates(),
    enableOnlineChecks: true,
  })
  return defaultVerifier
}
