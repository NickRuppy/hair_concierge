import { createReadStream, existsSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"

const batchDir = resolve(
  process.argv.find((arg) => arg.startsWith("--batch-dir="))?.slice("--batch-dir=".length) ??
    "data/product-images/pilot-2026-06-10",
)
const port = Number(
  process.argv.find((arg) => arg.startsWith("--port="))?.slice("--port=".length) ?? 3357,
)

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".webp":
      return "image/webp"
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".avif":
      return "image/avif"
    default:
      return "application/octet-stream"
  }
}

function safePath(urlPath: string): string | null {
  const relativePath = normalize(
    decodeURIComponent(urlPath === "/" ? "/review.html" : urlPath),
  ).replace(/^(\.\.[/\\])+/, "")
  const fullPath = resolve(batchDir, `.${relativePath}`)
  if (!fullPath.startsWith(batchDir)) return null
  return fullPath
}

const server = createServer((request, response) => {
  const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname

  if (
    request.method === "POST" &&
    (requestPath.endsWith("/review-state") || requestPath.endsWith("/final-review-state"))
  ) {
    const statePath = safePath(`${requestPath}.json`)
    const chunks: Buffer[] = []
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    request.on("end", () => {
      try {
        if (!statePath) throw new Error("Invalid review state path")
        const raw = Buffer.concat(chunks).toString("utf8")
        const parsed = JSON.parse(raw)
        writeFileSync(statePath, `${JSON.stringify(parsed, null, 2)}\n`)
        response.writeHead(204).end()
      } catch (error) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" })
        response.end(error instanceof Error ? error.message : String(error))
      }
    })
    return
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end()
    return
  }

  const filePath = safePath(new URL(request.url ?? "/", "http://127.0.0.1").pathname)
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    response.end("Not found")
    return
  }

  response.writeHead(200, { "content-type": contentType(filePath) })
  if (request.method === "HEAD") {
    response.end()
    return
  }
  createReadStream(filePath).pipe(response)
})

server.listen(port, "127.0.0.1", () => {
  console.log(`Review server running at http://127.0.0.1:${port}/review.html`)
  console.log(`Review state will be written beside each review.html`)
})
