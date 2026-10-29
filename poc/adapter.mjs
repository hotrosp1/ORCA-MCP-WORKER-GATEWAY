// Generic CLI adapter that Orca would supervise as a worker terminal (approach A).
// Reads dispatch identity from env, calls the MCP gateway, reports worker_done via the Orca CLI.
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
const e = process.env
const gw = spawn('node', [e.GW_SERVER], { env: e, stdio: ['pipe', 'pipe', 'inherit'] })
const rl = createInterface({ input: gw.stdout }); const waiting = new Map(); let n = 0
rl.on('line', (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); waiting.delete(m.id) })
const rpc = (method, params) => new Promise((res) => { const id = ++n; waiting.set(id, res); gw.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n') })
await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'orca-adapter', version: '0' } })
const args = { run_id: e.A_RUN, task_id: e.A_TASK, dispatch_id: e.A_DISPATCH, capability: e.A_CAP, prompt: e.A_PROMPT,
  worker: e.A_WORKER || undefined, gated: e.A_GATED === '1', owner_gate: e.A_GATE || undefined, extra_args: e.A_EXTRA ? e.A_EXTRA.split(' ') : [] }
const r = await rpc('tools/call', { name: 'worker_dispatch', arguments: args })
const rec = JSON.parse(r.result.content[0].text)
// The adapter never decides success itself: it forwards the gateway's attested outcome (or failure if the call errored).
const outcome = rec.outcome === 'succeeded' ? 'succeeded' : 'failed'
const p = spawnSync('node', [e.ORCA_CLI, 'send', '--type', 'worker_done', '--task-id', rec.task_id ?? args.task_id, '--dispatch-id', args.dispatch_id,
  '--from', e.A_HANDLE, '--outcome', outcome, '--result-sha', rec.result_sha ?? '', '--attestation', rec.attestation ?? ''], { env: e, encoding: 'utf8' })
console.log(JSON.stringify({ gateway: rec, orca_exit: p.status, orca_out: (p.stdout || p.stderr).trim() }))
gw.kill(); process.exit(outcome === 'succeeded' ? 0 : 1)
