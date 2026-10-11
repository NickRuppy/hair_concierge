import { Client } from "/Users/nick/AI_work/hair_conscierge/.worktrees/catalog-completeness-fill/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js"
import { StreamableHTTPClientTransport } from "/Users/nick/AI_work/hair_conscierge/.worktrees/catalog-completeness-fill/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js"
const [tool, arg] = process.argv.slice(2)
const client = new Client({ name: "r4-readonly", version: "1.0.0" }, { capabilities: {} })
await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.dm.de/mcp")))
const args = tool === "getProductDetails" ? { gtins: arg.split(",").map(Number) } : { query: arg }
const r = await client.callTool({ name: tool, arguments: args })
console.log(r.content[0].text)
await client.close()
