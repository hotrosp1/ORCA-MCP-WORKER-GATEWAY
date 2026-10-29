// TEST DOUBLE of the Orca orchestration CLI. NOT Orca. Models only the documented verbs
// (run-create, task-create, dispatch, gate-create, gate-resolve, send --type worker_done)
// so the adapter->gateway->completion path can be exercised without the Orca runtime.
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const STATE = process.env.MOCK_ORCA_STATE
const st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { n: 0, runs: {}, tasks: {}, dispatches: {}, gates: {}, calls: [] }
const [verb, ...rest] = process.argv.slice(2)
const o = {}; for (let i = 0; i < rest.length; i += 2) o[rest[i].replace(/^--/, '')] = rest[i + 1]
const id = (p) => `${p}_${++st.n}`
const save = () => writeFileSync(STATE, JSON.stringify(st, null, 1))
const out = (v) => { st.calls.push({ verb, ...o }); save(); console.log(JSON.stringify(v)) }
const fail = (m) => { st.calls.push({ verb, ...o, rejected: m }); save(); console.error(JSON.stringify({ error: m })); process.exit(1) }
if (verb === 'run-create') { const r = id('run'); st.runs[r] = { objective: o.objective }; out({ run: r }) }
else if (verb === 'task-create') { const t = id('task'); st.tasks[t] = { run: o.run, spec: o.spec, status: 'ready', gated: o.gated === 'true' }; out({ task: t }) }
else if (verb === 'gate-create') { const g = id('gate'); st.gates[g] = { task: o.task, status: 'open' }; st.tasks[o.task].status = 'blocked'; out({ gate: g }) }
else if (verb === 'gate-resolve') { if (o.from !== 'owner') fail('only_owner_resolves_gates'); st.gates[o.id].status = 'resolved'; st.tasks[st.gates[o.id].task].status = 'ready'; out({ ok: true }) }
else if (verb === 'dispatch') {
  const t = st.tasks[o.task]; if (!t || t.status !== 'ready') fail(`task_not_ready:${t?.status}`)
  const d = id('disp'); st.dispatches[d] = { task: o.task, run: t.run, handle: o.to, attempt: 1 }; t.status = 'dispatched'; out({ dispatch: d, run: t.run, task: o.task })
} else if (verb === 'send' && o.type === 'worker_done') {
  const d = st.dispatches[o['dispatch-id']]; if (!d) fail('unknown_dispatch')
  if (d.task !== o['task-id']) fail('task_dispatch_mismatch')
  if (o.from !== d.handle) fail('sender_not_assignee')
  const want = createHmac('sha256', process.env.GW_ATTEST_KEY).update([d.run, d.task, o['dispatch-id'], o.outcome, o['result-sha']].join('|')).digest('hex')
  if (o.attestation !== want) fail('bad_completion_attestation')
  const t = st.tasks[d.task]; if (t.status !== 'dispatched') fail(`already_settled:${t.status}`)
  t.status = o.outcome === 'succeeded' ? 'completed' : 'failed'; t.result = o['result-sha']; out({ task: d.task, status: t.status })
} else if (verb === 'task-show') out(st.tasks[o.id])
else fail('unsupported_verb')
