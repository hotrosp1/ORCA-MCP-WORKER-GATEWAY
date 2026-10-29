// Mock workers only. No real provider is called and no credentials are used.
export const WORKERS = {
  'mock-free': { name: 'mock-free', model: 'mock/free-echo', capabilities: ['code', 'review'], cost_usd_per_call: 0,
    run: async ({ prompt }) => ({ exit_code: 0, stdout: `ORCA_AGENT_READY (mock) :: ${prompt.slice(0, 40)}`, files: [{ path: 'out/result.txt', content: 'synthetic result\n' }] }) },
  'mock-fail': { name: 'mock-fail', model: 'mock/always-fails', capabilities: ['code'], cost_usd_per_call: 0,
    run: async () => ({ exit_code: 2, stderr: 'simulated crash', files: [{ path: 'out/should-not-exist.txt', content: 'x' }] }) },
  'mock-escape': { name: 'mock-escape', model: 'mock/path-escape', capabilities: ['escape'], cost_usd_per_call: 0,
    run: async () => ({ exit_code: 0, stdout: 'ok', files: [{ path: '../../../escaped.txt', content: 'boom' }] }) },
  'mock-paid': { name: 'mock-paid', model: 'mock/paid-premium', capabilities: ['premium'], cost_usd_per_call: 0.05,
    run: async () => ({ exit_code: 0, stdout: 'paid ok', files: [] }) },
  'mock-leak': { name: 'mock-leak', model: 'mock/leaky', capabilities: ['leak'], cost_usd_per_call: 0,
    run: async () => ({ exit_code: 0, stdout: 'token sk-FAKEFAKEFAKE1234 used with Bearer abcdef.123', files: [] }) }
}
