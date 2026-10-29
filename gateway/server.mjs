// Minimal MCP Worker Gateway (stdio, newline-delimited JSON-RPC 2.0). Zero dependencies.
// Orca keeps authority over Run/Task/Dispatch/Gate; the gateway only executes and attests.
import { createHmac, randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { WORKERS } from './workers.mjs'

const ROOT = path.resolve(process.env.GW_ROOT ?? process.cwd())
const SANDBOX = path.join(ROOT, 'sandbox')
const JOURNAL = path.join(ROOT, '.gateway', 'journal.jsonl')
const BUDGET_USD = Number(process.env.GW_BUDGET_USD ?? '0')
const SECRET = process.env.GW_ATTEST_KEY ?? randomBytes(16).toString('hex')
const BYPASS = [/--dangerously-skip-permissions/, /--yolo/, /--full-auto/, /--dangerously-bypass/, /bypassPermissions/]
mkdirSync(path.dirname(JOURNAL), { recursive: true }); mkdirSync(SANDBOX, { recursive: true })

const redact = (s) => String(s).replace(/(sk-[A-Za-z0-9_-]{6,}|Bearer\s+\S+|key=\S+)/g, '[REDACTED]')
const log = (e) => appendFileSync(JOURNAL, redact(JSON.stringify({ ts: new Date().toISOString(), ...e })) + '\n')
const attest = (r) => createHmac('sha256', SECRET).update([r.run_id, r.task_id, r.dispatch_id, r.outcome, r.result_sha].join('|')).digest('hex')
const sha = (s) => createHmac('sha256', 'x').update(s).digest('hex').slice(0, 16)

const done = new Map() // dispatch_id -> record (idempotency; rebuilt from journal on restart)
if (existsSync(JOURNAL)) for (const l of readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean)) { const e = JSON.parse(l); if (e.event === 'result') done.set(e.record.dispatch_id, e.record) }

const TOOLS = [
  { name: 'worker_list', description: 'List workers with capability, model, cost.', inputSchema: { type: 'object', properties: {} } },
  { name: 'worker_dispatch', description: 'Execute one Orca Dispatch on a matched worker. Idempotent per dispatch_id.',
    inputSchema: { type: 'object', required: ['run_id', 'task_id', 'dispatch_id', 'capability', 'prompt'],
      properties: { run_id: { type: 'string' }, task_id: { type: 'string' }, dispatch_id: { type: 'string' }, capability: { type: 'string' },
        prompt: { type: 'string' }, worker: { type: 'string' }, extra_args: { type: 'array', items: { type: 'string' } }, gated: { type: 'boolean' }, owner_gate: { type: 'string', description: 'gate id that Orca resolved; required when task is gated' } } } },
  { name: 'worker_result', description: 'Fetch stored result for a dispatch_id.', inputSchema: { type: 'object', required: ['dispatch_id'], properties: { dispatch_id: { type: 'string' } } } }
]

function safeWrite(dispatchId, rel, content) {
  const base = path.join(SANDBOX, dispatchId)
  const target = path.resolve(base, rel)
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error(`path_escape_denied: ${rel}`)
  mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, content)
  return path.relative(ROOT, target)
}

function pick(a) {
  const cands = Object.values(WORKERS).filter((w) => w.capabilities.includes(a.capability))
  if (a.worker) { const w = WORKERS[a.worker]; if (!w) throw new Error('unknown_worker'); return w }
  const free = cands.filter((w) => w.cost_usd_per_call <= BUDGET_USD)
  if (!free.length) throw new Error(`no_worker_within_budget: capability=${a.capability} budget=${BUDGET_USD}`)
  return free[0]
}

async function dispatch(a) {
  const prev = done.get(a.dispatch_id)
  if (prev) { log({ event: 'duplicate_suppressed', dispatch_id: a.dispatch_id }); return { ...prev, duplicate_suppressed: true } }
  const rec = { run_id: a.run_id, task_id: a.task_id, dispatch_id: a.dispatch_id, worker: null, model: null, outcome: 'failed', error: null, files: [], result_sha: '' }
  try {
    for (const arg of a.extra_args ?? []) if (BYPASS.some((r) => r.test(arg))) throw new Error(`permission_bypass_flag_rejected: ${arg}`)
    if (a.gated && !a.owner_gate) throw new Error('owner_gate_required')
    const w = pick(a)
    if (w.cost_usd_per_call > BUDGET_USD) throw new Error(`budget_exceeded: ${w.name} costs ${w.cost_usd_per_call} > ${BUDGET_USD}`)
    rec.worker = w.name; rec.model = w.model
    log({ event: 'start', dispatch_id: a.dispatch_id, worker: w.name, model: w.model })
    const out = await w.run({ prompt: a.prompt })
    if (!out || out.exit_code !== 0) throw new Error(`worker_failed: exit=${out?.exit_code} ${out?.stderr ?? ''}`)
    for (const f of out.files ?? []) rec.files.push(safeWrite(a.dispatch_id, f.path, f.content))
    rec.stdout = redact(out.stdout ?? ''); rec.outcome = 'succeeded'
  } catch (e) { rec.error = redact(e.message) }
  rec.result_sha = sha(JSON.stringify([rec.outcome, rec.stdout ?? '', rec.error ?? '', rec.files]))
  rec.attestation = attest(rec)
  done.set(a.dispatch_id, rec); log({ event: 'result', record: rec })
  return rec
}

async function call(name, args) {
  if (name === 'worker_list') return Object.values(WORKERS).map(({ run, ...m }) => m)
  if (name === 'worker_dispatch') return dispatch(args)
  if (name === 'worker_result') return done.get(args.dispatch_id) ?? { error: 'not_found' }
  throw new Error('unknown_tool')
}

const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n')
createInterface({ input: process.stdin }).on('line', async (line) => {
  let m; try { m = JSON.parse(line) } catch { return }
  if (m.id === undefined) return
  try {
    if (m.method === 'initialize') send({ id: m.id, result: { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'g0-worker-gateway', version: '0.0.1' } } })
    else if (m.method === 'tools/list') send({ id: m.id, result: { tools: TOOLS } })
    else if (m.method === 'tools/call') {
      const r = await call(m.params.name, m.params.arguments ?? {})
      send({ id: m.id, result: { content: [{ type: 'text', text: JSON.stringify(r) }], isError: r?.outcome === 'failed' } })
    } else send({ id: m.id, error: { code: -32601, message: 'method_not_found' } })
  } catch (e) { send({ id: m.id, result: { content: [{ type: 'text', text: JSON.stringify({ error: redact(e.message) }) }], isError: true } }) }
})
