import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';

const endpoint = 'https://mcp.dm.de/mcp';
const out = '/tmp/chaarlie-dm-probe.wfL1m6';
const unknown = ['4262391991626', '4006381333931', '4066447975284', '4068134087058', '4010355347367', '4066447936193', '4001638530378'];
const controls = ['4066447982695', '4066447982619', '4066447882995'];
const names = ['OGX Argan Oil Shampoo', 'Balea Feuchtigkeit Shampoo', 'Isana Anti-Schuppen Shampoo'];
let session;
let id = 0;
const records = [];

async function call(method, params, label) {
  const start = performance.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  const body = await res.text();
  const durationMs = Math.round(performance.now() - start);
  session ||= res.headers.get('mcp-session-id');
  const line = body.split(/\r?\n/).find((s) => s.startsWith('data: '));
  let parsed;
  try { parsed = JSON.parse(line ? line.slice(6) : body); } catch { parsed = { unparsed: body }; }
  const record = { label, method, params, status: res.status, durationMs, rateHeaders: Object.fromEntries([...res.headers].filter(([key]) => /rate|retry/i.test(key))), response: parsed };
  records.push(record);
  console.log(JSON.stringify({ label, status: res.status, durationMs, error: parsed.error ?? parsed.result?.isError ?? null }));
  return parsed;
}

try {
  await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'chaarlie-readonly-probe', version: '0.1' } }, 'initialize');
  const inventory = await call('tools/list', {}, 'tools/list');
  await call('tools/call', { name: 'getProductDetails', arguments: { gtins: [...unknown, ...controls].map(Number) } }, 'details-all-gtins');
  for (const ean of [...unknown, ...controls]) {
    await call('tools/call', { name: 'searchProducts', arguments: { query: ean } }, `search-ean-${ean}`);
    // Every supplied EAN begins with a nonzero digit; stripping leading zeroes is the same query.
  }
  for (const name of names) await call('tools/call', { name: 'searchProducts', arguments: { query: name } }, `search-name-${name}`);
  await writeFile(`${out}/results.json`, JSON.stringify(records, null, 2));
  await writeFile(`${out}/inventory.json`, JSON.stringify(inventory.result?.tools ?? [], null, 2));
  console.log(`Saved ${records.length} records in ${out}`);
} catch (error) {
  await writeFile(`${out}/results.json`, JSON.stringify(records, null, 2));
  console.error(error);
  process.exitCode = 1;
}
