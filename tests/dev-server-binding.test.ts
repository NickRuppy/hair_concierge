import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import test from "node:test"

const require = createRequire(import.meta.url)
const { Command } = require("next/dist/compiled/commander")

function devOptions(extra: string[] = []) {
  // Exercise npm argument forwarding and Next's real CLI. Intercept only the
  // nextDev runner so this security regression needs no listening socket.
  const runner = `export function nextDev(options) { console.log('DEV_OPTIONS=' + JSON.stringify(options)); }`
  const loader = `export async function resolve(specifier, context, nextResolve) {
    if (specifier === '../cli/next-dev.js') return {
      url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(runner)}`)}, shortCircuit: true,
    };
    return nextResolve(specifier, context);
  }`
  const preload = `import { register } from 'node:module'; register(${JSON.stringify(`data:text/javascript,${encodeURIComponent(loader)}`)}, import.meta.url);`
  const result = spawnSync("npm", ["run", "dev", "--", ...extra], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(preload)}`,
    },
  })
  assert.equal(result.status, 0, result.stderr)
  const optionsLine = result.stdout.split("\n").find((line) => line.startsWith("DEV_OPTIONS="))
  assert.ok(optionsLine, result.stdout)
  return JSON.parse(optionsLine.slice("DEV_OPTIONS=".length))
}

test("npm dev defaults to localhost and permits the explicit Playwright hostname", () => {
  assert.equal(devOptions().hostname, "localhost")
  assert.equal(devOptions(["--hostname", "127.0.0.1", "--port", "3217"]).hostname, "127.0.0.1")
})

test("worktree dev starts Next bound to localhost without requiring a real socket", () => {
  // Replace only OS port probes and child launch; execute the real worktree script.
  const preload = `
    import net from 'node:net';
    import cp from 'node:child_process';
    import { EventEmitter } from 'node:events';
    import { syncBuiltinESMExports } from 'node:module';
    net.createServer = () => {
      const server = new EventEmitter();
      server.listen = () => { queueMicrotask(() => server.emit('listening')); return server; };
      server.close = callback => callback();
      return server;
    };
    cp.spawn = (binary, args) => {
      console.log('NEXT_LAUNCH=' + JSON.stringify({ binary, args }));
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('exit', 0));
      return child;
    };
    syncBuiltinESMExports();
  `
  const result = spawnSync(
    process.execPath,
    ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/worktree-dev.mjs"],
    { encoding: "utf8" },
  )
  assert.equal(result.status, 0, result.stderr)
  const launchLine = result.stdout.split("\n").find((line) => line.startsWith("NEXT_LAUNCH="))
  assert.ok(launchLine, result.stdout)
  const { args } = JSON.parse(launchLine.slice("NEXT_LAUNCH=".length))
  const command = new Command().option("-H, --hostname <hostname>").option("--port <port>")
  assert.equal(args[0], "dev")
  command.parse([process.execPath, "next", ...args.slice(1)])
  assert.equal(command.opts().hostname, "localhost")
})
