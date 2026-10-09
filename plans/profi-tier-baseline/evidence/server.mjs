import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const folder = dirname(fileURLToPath(import.meta.url))
const root = resolve(folder, "../../..")
const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/beratung", ["index.html", "text/html; charset=utf-8"]],
  ["/cockpit", ["index.html", "text/html; charset=utf-8"]],
  ["/direkt", ["index.html", "text/html; charset=utf-8"]],
  ["/scanner", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/prototype.js", ["prototype.js", "text/javascript; charset=utf-8"]],
  [
    "/fonts/PlusJakartaSans-Regular.ttf",
    [resolve(root, "public/fonts/PlusJakartaSans-Regular.ttf"), "font/ttf"],
  ],
  [
    "/fonts/PlayfairDisplay-Regular.ttf",
    [resolve(root, "public/fonts/PlayfairDisplay-Regular.ttf"), "font/ttf"],
  ],
])

createServer(async (req, res) => {
  const route = routes.get(new URL(req.url, "http://localhost").pathname)
  if (!route || !["GET", "HEAD"].includes(req.method)) {
    res.writeHead(404).end("Not found")
    return
  }
  try {
    const data = await readFile(resolve(folder, route[0]))
    res.writeHead(200, {
      "Content-Type": route[1],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'",
    })
    res.end(req.method === "HEAD" ? undefined : data)
  } catch {
    res.writeHead(500).end("Prototype asset unavailable")
  }
}).listen(4391, "127.0.0.1", () => {
  console.log("Budget prototype: http://127.0.0.1:4391 — local demo only")
})
