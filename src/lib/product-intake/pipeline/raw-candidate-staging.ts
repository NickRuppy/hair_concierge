import "server-only"
import { promises as dns, type LookupAddress } from "node:dns"
import https from "node:https"
import { BlockList, isIP, type LookupFunction } from "node:net"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProductIntakeReviewAssetInput } from "@chaarlie/product-intake-core"
import sharp from "sharp"
import { PRODUCT_INTAKE_MAX_IMAGE_BYTES } from "../image-validation"
import { uploadProductReviewAsset } from "../review-assets"

export type RawCandidateExecution = { signal: AbortSignal; deadlineMs: number }
export type StageRawImageCandidateParams = RawCandidateExecution & {
  artifacts: readonly { kind: string; payload: Record<string, unknown> }[]
  submissionId: string
  expectedRevision: number
  createStorageClient: (signal: AbortSignal) => Pick<SupabaseClient, "storage">
}

const nonPublic = new BlockList()
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  nonPublic.addSubnet(network, prefix, "ipv4")
// IPv6 is restricted to global unicast, excluding special-use and transition ranges.
const globalV6 = new BlockList()
globalV6.addSubnet("2000::", 3, "ipv6")
for (const [network, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  nonPublic.addSubnet(network, prefix, "ipv6")

function isPublicAddress(address: string) {
  const family = isIP(address)
  return family === 4
    ? !nonPublic.check(address, "ipv4")
    : family === 6 && globalV6.check(address, "ipv6") && !nonPublic.check(address, "ipv6")
}

function candidateUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("raw_candidate_unsafe_url")
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("raw_candidate_unsafe_url")
  return url
}

/** DNS itself has no cancellation API; abandon its result without opening a socket. */
function abortable<T>(work: Promise<T>, signal: AbortSignal, onAbort?: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      onAbort?.()
      reject(signal.reason)
    }
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}

async function bounded<T>(
  execution: RawCandidateExecution,
  run: (signal: AbortSignal, deadline: number) => Promise<T>,
) {
  execution.signal.throwIfAborted()
  const observed = Date.now()
  const remaining = Math.min(30_000, execution.deadlineMs - observed)
  if (!Number.isFinite(remaining) || remaining <= 0)
    throw new Error("raw_candidate_deadline_exceeded")
  const deadline = observed + remaining
  const timeout = new AbortController()
  const signal = AbortSignal.any([execution.signal, timeout.signal])
  const timer = setTimeout(
    () => timeout.abort(new Error("raw_candidate_deadline_exceeded")),
    remaining,
  )
  try {
    const result = await run(signal, deadline)
    signal.throwIfAborted()
    return result
  } finally {
    clearTimeout(timer)
  }
}

async function resolvePublic(url: URL, signal: AbortSignal): Promise<LookupAddress> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  signal.throwIfAborted()
  let addresses: LookupAddress[]
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await abortable(dns.lookup(hostname, { all: true, verbatim: true }), signal)
  } catch {
    signal.throwIfAborted()
    throw new Error("raw_candidate_dns_failed")
  }
  signal.throwIfAborted()
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
    throw new Error("raw_candidate_unsafe_destination")
  return addresses[0]
}

type Download = { bytes: Buffer; contentType: string | null }
type Hop = Download | { redirect: string }

async function requestImage(url: URL, signal: AbortSignal): Promise<Hop> {
  const address = await resolvePublic(url, signal)
  // Returning this exact prevalidated answer prevents a second, potentially rebound DNS lookup.
  const lookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [address])
    else callback(null, address.address, address.family)
  }
  signal.throwIfAborted()
  return new Promise<Hop>((resolve, reject) => {
    const request = https.request(
      url,
      {
        agent: false,
        lookup,
        signal,
        headers: {
          accept: "image/jpeg,image/png,image/webp,*/*;q=0.8",
          "user-agent": "ChaarlieProductIntakeReview/1.0",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          resolve({ redirect: response.headers.location })
          response.destroy()
          request.destroy()
          return
        }
        const fail = (code: string) => {
          reject(new Error(code))
          response.destroy()
          request.destroy()
        }
        if (status < 200 || status >= 300) return fail("raw_candidate_download_failed")
        const declaredSize = Number(response.headers["content-length"])
        if (declaredSize > PRODUCT_INTAKE_MAX_IMAGE_BYTES) return fail("raw_candidate_too_large")
        const chunks: Buffer[] = []
        let size = 0
        response.on("data", (chunk: Buffer) => {
          size += chunk.length
          if (size > PRODUCT_INTAKE_MAX_IMAGE_BYTES) return fail("raw_candidate_too_large")
          chunks.push(Buffer.from(chunk))
        })
        response.once("error", () => reject(new Error("raw_candidate_download_failed")))
        response.once("aborted", () => reject(new Error("raw_candidate_download_failed")))
        response.once("end", () =>
          resolve({
            bytes: Buffer.concat(chunks),
            contentType: response.headers["content-type"] ?? null,
          }),
        )
      },
    )
    request.once("error", () =>
      reject(signal.aborted ? signal.reason : new Error("raw_candidate_download_failed")),
    )
    request.end()
  })
}

async function download(
  urlValue: string,
  signal: AbortSignal,
  deadline: number,
): Promise<Download> {
  let url = candidateUrl(urlValue)
  for (let redirects = 0; ; redirects++) {
    const response = await requestImage(url, signal)
    signal.throwIfAborted()
    if ("redirect" in response) {
      if (redirects === 3) throw new Error("raw_candidate_redirect_limit")
      let destination: URL
      try {
        destination = new URL(response.redirect, url)
      } catch {
        throw new Error("raw_candidate_unsafe_url")
      }
      url = candidateUrl(destination.href)
      continue
    }
    const decoder = sharp(response.bytes, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    }).timeout({ seconds: Math.max(1, Math.ceil((deadline - Date.now()) / 1000)) })
    try {
      // Metadata alone accepts truncated files; force the actual bounded pixel decode.
      await abortable(decoder.raw().toBuffer(), signal, () => decoder.destroy())
    } catch {
      signal.throwIfAborted()
      throw new Error("raw_candidate_invalid_image")
    }
    signal.throwIfAborted()
    return response
  }
}

/** Used by both new raw staging and the legacy image path's remote fallback. */
export async function downloadRawImageCandidate(
  url: string,
  execution: RawCandidateExecution,
): Promise<{ bytes: Buffer; contentType: string | null }> {
  return bounded(execution, (signal, deadline) => download(url, signal, deadline))
}

export async function stageRawImageCandidate(
  params: StageRawImageCandidateParams,
): Promise<ProductIntakeReviewAssetInput | null> {
  params.signal.throwIfAborted()
  const candidate = params.artifacts.find(
    (artifact) =>
      artifact.kind === "image_candidate" &&
      typeof artifact.payload.image_url === "string" &&
      artifact.payload.image_url.trim(),
  )
  if (!candidate) return null
  return bounded(params, async (signal, deadline) => {
    const { bytes } = await download(candidate.payload.image_url as string, signal, deadline)
    signal.throwIfAborted()
    try {
      const asset = await abortable(
        uploadProductReviewAsset({
          client: params.createStorageClient(signal),
          submissionId: params.submissionId,
          payloadRevision: params.expectedRevision + 1,
          kind: "raw",
          bytes,
        }),
        signal,
      )
      signal.throwIfAborted()
      return asset
    } catch {
      signal.throwIfAborted()
      throw new Error("raw_candidate_storage_failed")
    }
  })
}
