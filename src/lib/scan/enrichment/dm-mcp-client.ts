import "server-only"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { parseToonTable, ToonParseError } from "./toon"

export type DmProductDetailsRow = Record<string, string>
export type DmMcpErrorReason = "timeout" | "session_expired" | "transport" | "malformed"
export class DmMcpError extends Error {
  constructor(public readonly reason: DmMcpErrorReason) {
    super("dm lookup failed: " + reason)
    this.name = "DmMcpError"
  }
}
export type DmMcpClient = { getProductDetails(gtins: string[]): Promise<DmProductDetailsRow[]> }
function sanitizeError(error: unknown): DmMcpError {
  if (error instanceof DmMcpError) return error
  if (error instanceof StreamableHTTPError && error.code === 404)
    return new DmMcpError("session_expired")
  if (error instanceof McpError && error.code === ErrorCode.RequestTimeout)
    return new DmMcpError("timeout")
  if (
    error instanceof SyntaxError ||
    error instanceof ToonParseError ||
    (error instanceof Error && error.name === "ZodError")
  ) {
    return new DmMcpError("malformed")
  }
  return new DmMcpError("transport")
}

export function createDmMcpClient(deps: {
  endpoint?: string
  fetch?: typeof fetch
  deadlineMs: number
  now?: () => number
}): DmMcpClient {
  return {
    async getProductDetails(gtins) {
      const now = deps.now ?? (() => performance.now())
      const expiresAt = now() + deps.deadlineMs
      const controller = new AbortController()
      let currentClient: Client | undefined
      const remaining = () => {
        const budget = expiresAt - now()
        if (controller.signal.aborted || budget <= 0) throw new DmMcpError("timeout")
        return budget
      }
      // Covers *all* fetches, including the SDK's initialized notification and background SSE.
      const boundedFetch: typeof fetch = async (input, init) => {
        remaining()
        const signal = init?.signal
          ? AbortSignal.any([controller.signal, init.signal])
          : controller.signal
        const response = await (deps.fetch ?? fetch)(input, { ...init, signal })
        try {
          remaining()
          signal.throwIfAborted()
        } catch (error) {
          void response.body?.cancel().catch(() => {})
          throw error
        }
        return response
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => {
            reject(new DmMcpError("timeout"))
            controller.abort()
            void currentClient?.close().catch(() => {})
          },
          Math.max(0, deps.deadlineMs),
        )
      })
      const operation = async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          remaining()
          const client = new Client(
            { name: "chaarlie-scan", version: "1.0.0" },
            { capabilities: {} },
          )
          currentClient = client
          const transport = new StreamableHTTPClientTransport(
            new URL(deps.endpoint ?? "https://mcp.dm.de/mcp"),
            {
              fetch: boundedFetch,
              // The enclosing operation owns its one 404 retry and absolute time budget.
              reconnectionOptions: {
                maxRetries: 0,
                initialReconnectionDelay: 1000,
                maxReconnectionDelay: 1000,
                reconnectionDelayGrowFactor: 1,
              },
            },
          )
          const failed = new Promise<never>((_resolve, reject) => {
            client.onerror = reject
          })
          const exchange = async () => {
            await client.connect(transport, { signal: controller.signal, timeout: remaining() })
            remaining()
            const result = await client.callTool(
              { name: "getProductDetails", arguments: { gtins: gtins.map(Number) } },
              undefined,
              { signal: controller.signal, timeout: remaining() },
            )
            remaining()
            if (
              result.isError ||
              !Array.isArray(result.content) ||
              result.content[0]?.type !== "text"
            )
              throw new DmMcpError("malformed")
            const payload: unknown = JSON.parse(result.content[0].text)
            if (
              !payload ||
              typeof payload !== "object" ||
              !("result" in payload) ||
              typeof payload.result !== "string"
            )
              throw new DmMcpError("malformed")
            const rows = parseToonTable(payload.result)
            remaining()
            return rows
          }
          try {
            return await Promise.race([exchange(), failed])
          } catch (error) {
            const sanitized = controller.signal.aborted
              ? new DmMcpError("timeout")
              : sanitizeError(error)
            if (sanitized.reason !== "session_expired" || attempt === 1) throw sanitized
            remaining()
          } finally {
            await client.close().catch(() => {})
          }
        }
        throw new DmMcpError("session_expired")
      }
      try {
        return await Promise.race([operation(), deadline])
      } catch (error) {
        throw sanitizeError(error)
      } finally {
        clearTimeout(timer)
        controller.abort()
        // Cleanup is best-effort: awaiting it here would escape the operation's hard deadline.
        void currentClient?.close().catch(() => {})
      }
    },
  }
}
