import { promises as dns, type LookupAddress } from "node:dns"
import { EventEmitter } from "node:events"
import https, { type RequestOptions } from "node:https"
import type { IncomingHttpHeaders, IncomingMessage } from "node:http"
import { PassThrough } from "node:stream"
import type { TestContext } from "node:test"

export type CandidateResponse = {
  status?: number
  headers?: IncomingHttpHeaders
  chunks?: Buffer[]
  stall?: boolean
}

/** Mock only OS DNS/TLS boundaries; URL policy, streaming, decode and storage remain real. */
export function mockCandidateTransport(
  t: TestContext,
  options: {
    responses: CandidateResponse[]
    addresses?: Record<string, LookupAddress[]>
    lookup?: (hostname: string) => Promise<LookupAddress[]>
  },
) {
  const dnsQueries: string[] = []
  const requests: Array<{
    url: string
    options: RequestOptions
    pinned?: LookupAddress[]
    destroyed: boolean
  }> = []
  t.mock.method(dns, "lookup", async (hostname: string) => {
    dnsQueries.push(hostname)
    return options.lookup
      ? options.lookup(hostname)
      : (options.addresses?.[hostname] ?? [{ address: "93.184.216.34", family: 4 }])
  })
  t.mock.method(
    https,
    "request",
    (url: URL, requestOptions: RequestOptions, callback: (r: IncomingMessage) => void) => {
      const record = {
        url: url.href,
        options: requestOptions,
        destroyed: false,
      } as (typeof requests)[number]
      requests.push(record)
      const specification = options.responses[requests.length - 1]
      if (!specification) throw new Error("Unexpected HTTPS request in offline fixture")
      const response = Object.assign(new PassThrough(), {
        statusCode: specification.status ?? 200,
        headers: specification.headers ?? {},
      })
      const request = Object.assign(new EventEmitter(), {
        end() {
          queueMicrotask(() => {
            if (record.destroyed) return
            const deliver = () => {
              callback(response as unknown as IncomingMessage)
              for (const chunk of specification.chunks ?? []) {
                if (response.destroyed) break
                response.write(chunk)
              }
              if (!specification.stall) response.end()
            }
            if (requestOptions.lookup) {
              requestOptions.lookup(url.hostname, { all: true }, (error, addresses) => {
                if (error) return request.destroy(error)
                record.pinned = addresses as LookupAddress[]
                deliver()
              })
            } else deliver()
          })
          return request
        },
        destroy(error?: Error) {
          if (record.destroyed) return request
          record.destroyed = true
          requestOptions.signal?.removeEventListener("abort", abort)
          response.destroy()
          if (error) queueMicrotask(() => request.emit("error", error))
          return request
        },
      })
      const abort = () => request.destroy(new Error("aborted transport"))
      requestOptions.signal?.addEventListener("abort", abort, { once: true })
      response.once("end", () => requestOptions.signal?.removeEventListener("abort", abort))
      t.after(() => request.destroy())
      return request
    },
  )
  return { requests, dnsQueries }
}
