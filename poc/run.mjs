import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
const W = path.resolve('.run'); rmSync(W, { recursive: true, force: true }); mkdirSync(W, { recursive: true })
const KEY = 'poc-attest-key-not-a-secret'
const env = { ...process.env, GW_ROOT: W, GW_SERVER: path.resolve('gateway/server.mjs'), GW_BUDGET_USD: '0', GW_ATTEST_KEY: KEY,
  ORCA_CLI: path.resolve('poc/mock-orca.mjs'), MOCK_ORCA_STATE: path.join(W, 'orca-state.json') }
const sh = (f, args, extra = {}) => { const r = spawnSync('node', [f, ...args], { env: { ...env, ...extra }, encoding: 'utf8' }); return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const orca = (...a) => sh('poc/mock-orca.mjs', a)
const J = (s) => { try { return JSON.parse(s) } catch { return {} } }
const results = []; const rec = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} :: ${JSON.stringify(evidence)}`) }
const adapt = (o, extra = {}) => sh('poc/adapter.mjs', [], { A_RUN: o.run, A_TASK: o.task, A_DISPATCH: o.dispatch, A_HANDLE: 'h_worker1', A_CAP: 'code', A_PROMPT: 'Respond with ORCA_AGENT_READY', ...extra })
const newTask = (gated = false) => { const run = J(orca('run-create', '--objective', 'g0 synthetic').out).run; const task = J(orca('task-create', '--run', run, '--spec', 'synthetic', '--gated', String(gated)).out).task; return { run, task } }
const disp = (t) => J(orca('dispatch', '--task', t.task, '--to', 'h_worker1').out).dispatch
const journal = () => readFileSync(path.join(W, '.gateway/journal.jsonl'), 'utf8')
const task = (id) => J(orca('task-show', '--id', id).out)

// S1 happy path: identity preserved, attributed, completed
{ const t = newTask(); const d = disp(t); const r = adapt({ ...t, dispatch: d }, { A_WORKER: 'mock-free' }); const g = J(r.out).gateway ?? {}
  rec('S1', 'happy path: create->dispatch->MCP worker->worker_done', r.code === 0 && task(t.task).status === 'completed' && g.dispatch_id === d && g.run_id === t.run && g.worker === 'mock-free' && g.model === 'mock/free-echo',
    { dispatch: d, task_status: task(t.task).status, worker: g.worker, model: g.model, files: g.files }) }
// S2 failed worker never becomes success
{ const t = newTask(); const d = disp(t); const r = adapt({ ...t, dispatch: d }, { A_WORKER: 'mock-fail' })
  rec('S2', 'failed worker => task failed, no output files', r.code === 1 && task(t.task).status === 'failed' && !existsSync(path.join(W, 'sandbox', d, 'out/should-not-exist.txt')), { task_status: task(t.task).status, exit: r.code }) }
// S3 retry/duplicate + gateway restart (each adapter run is a new gateway process that reloads the journal)
{ const t = newTask(); const d = disp(t); adapt({ ...t, dispatch: d }, { A_WORKER: 'mock-free' }); const r2 = adapt({ ...t, dispatch: d }, { A_WORKER: 'mock-free' })
  const starts = journal().split('\n').filter((l) => l.includes('"event":"start"') && l.includes(d)).length
  rec('S3', 'retry with same dispatch_id: worker executed once; orca rejects 2nd settlement', starts === 1 && J(r2.out).gateway?.duplicate_suppressed === true && J(r2.out).orca_exit === 1, { starts, orca_second: J(r2.out).orca_out }) }
// S4 path escape
{ const t = newTask(); const d = disp(t); const r = adapt({ ...t, dispatch: d }, { A_WORKER: 'mock-escape', A_CAP: 'escape' })
  rec('S4', 'worker write outside sandbox denied', r.code === 1 && !existsSync(path.join(W, 'escaped.txt')) && !existsSync(path.resolve('escaped.txt')) && /path_escape_denied/.test(r.out), { error: J(r.out).gateway?.error }) }
// S5 zero budget
{ const t = newTask(); const d = disp(t); const a = adapt({ ...t, dispatch: d }, { A_CAP: 'premium' }); const t2 = newTask(); const d2 = disp(t2); const b = adapt({ ...t2, dispatch: d2 }, { A_CAP: 'premium', A_WORKER: 'mock-paid' })
  rec('S5', 'paid model unselectable at $0 (auto and explicit)', a.code === 1 && b.code === 1 && /no_worker_within_budget/.test(a.out) && /budget_exceeded/.test(b.out), { auto: J(a.out).gateway?.error, explicit: J(b.out).gateway?.error }) }
// S6 permission bypass flags
{ const t = newTask(); const d = disp(t); const r = adapt({ ...t, dispatch: d }, { A_WORKER: 'mock-free', A_EXTRA: '--dangerously-skip-permissions' })
  rec('S6', 'permission-bypass flag rejected', r.code === 1 && /permission_bypass_flag_rejected/.test(r.out), { error: J(r.out).gateway?.error }) }
// S7 owner gate
{ const t = newTask(true); const g = J(orca('gate-create', '--task', t.task, '--question', 'approve?').out).gate
  const early = orca('dispatch', '--task', t.task, '--to', 'h_worker1'); const forged = orca('gate-resolve', '--id', g, '--from', 'h_worker1', '--resolution', 'ok')
  orca('gate-resolve', '--id', g, '--from', 'owner', '--resolution', 'approved'); const d = disp(t)
  const noGate = adapt({ ...t, dispatch: d }, { A_WORKER: 'mock-free', A_GATED: '1' }); const t2 = newTask(true); const g2 = J(orca('gate-create', '--task', t2.task, '--question', 'q').out).gate; orca('gate-resolve', '--id', g2, '--from', 'owner', '--resolution', 'ok'); const d2 = disp(t2)
  const withGate = adapt({ ...t2, dispatch: d2 }, { A_WORKER: 'mock-free', A_GATED: '1', A_GATE: g2 })
  rec('S7', 'owner gate: blocked dispatch, worker cannot resolve, gateway refuses gated work without gate id', early.code === 1 && forged.code === 1 && /owner_gate_required/.test(noGate.out) && withGate.code === 0,
    { early: early.err, forged: forged.err, no_gate: J(noGate.out).gateway?.error, with_gate: task(t2.task).status }) }
// S8 secrets
{ const t = newTask(); const d = disp(t); const r = adapt({ ...t, dispatch: d }, { A_CAP: 'leak', A_WORKER: 'mock-leak' }); const all = r.out + r.err + journal()
  rec('S8', 'secrets redacted in output and journal', !/sk-FAKEFAKE|abcdef\.123/.test(all) && /REDACTED/.test(all), { redacted: /REDACTED/.test(all) }) }
// S9 forged completion
{ const t = newTask(); const d = disp(t); const f = sh('poc/mock-orca.mjs', ['send', '--type', 'worker_done', '--task-id', t.task, '--dispatch-id', d, '--from', 'h_worker1', '--outcome', 'succeeded', '--result-sha', 'x', '--attestation', 'deadbeef'])
  const g = sh('poc/mock-orca.mjs', ['send', '--type', 'worker_done', '--task-id', t.task, '--dispatch-id', d, '--from', 'h_other', '--outcome', 'succeeded', '--result-sha', 'x', '--attestation', 'deadbeef'])
  rec('S9', 'forged/foreign completion rejected; task stays dispatched', f.code === 1 && g.code === 1 && task(t.task).status === 'dispatched', { forged: f.err, foreign: g.err }) }
// S10 no push/merge/deploy
{ const r = spawnSync('git', ['remote', '-v'], { encoding: 'utf8' }); const refs = spawnSync('git', ['for-each-ref'], { encoding: 'utf8' })
  rec('S10', 'no git remote configured (push impossible); gateway has no git/network tools', r.stdout.trim() === '' && !/git|fetch|http/.test(readFileSync('gateway/server.mjs', 'utf8').replace(/\/\/.*$/gm, '').replace(/'\.\/workers\.mjs'/, '')) , { remotes: r.stdout.trim() }) }
writeFileSync('docs/poc-evidence.json', JSON.stringify({ generated: new Date().toISOString(), node: process.version, results }, null, 1))
process.exit(results.every((r) => r.pass) ? 0 : 1)
