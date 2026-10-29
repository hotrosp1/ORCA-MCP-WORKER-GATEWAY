# G0 — Hợp đồng MCP Worker Gateway (v0, bản nháp đã chạy được ở mức mock)

Giao thức: MCP stdio, JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`), protocolVersion `2025-11-25` (không dùng Tasks extension ở v0; xem G2).

## Tools
**`worker_list`** → danh sách `{name, model, capabilities[], cost_usd_per_call}`.

**`worker_dispatch`** (idempotent theo `dispatch_id`)
- Vào: `run_id, task_id, dispatch_id, capability, prompt` (bắt buộc); `worker?, extra_args?[], gated?, owner_gate?`.
- Ra (`content[0].text` là JSON): `{run_id, task_id, dispatch_id, worker, model, outcome: "succeeded"|"failed", error|null, files[], stdout?, result_sha, attestation, duplicate_suppressed?}`; `isError=true` khi `outcome=failed`.
- Lỗi tường minh: `permission_bypass_flag_rejected`, `owner_gate_required`, `no_worker_within_budget`, `budget_exceeded`, `worker_failed`, `path_escape_denied`, `unknown_worker`.

**`worker_result`** `{dispatch_id}` → bản ghi đã lưu hoặc `{error:"not_found"}`.

## Bất biến
1. Gateway không có API tạo/sửa Task, Dispatch, Gate.
2. `attestation = HMAC-SHA256(key, run|task|dispatch|outcome|result_sha)`; khóa do gateway/Owner giữ, không in ra log.
3. Chỉ `outcome="succeeded"` khi worker thoát 0 **và** mọi thao tác file hợp lệ.
4. Ngân sách mặc định `GW_BUDGET_USD=0`.
5. Log/journal luôn qua `redact()`.

## Việc còn thiếu (G1+)
Xác thực người gọi gateway; lưu khóa chứng thực ngoài tiến trình; cancel/heartbeat; Tasks extension; chọn worker theo quota thực; xác minh `owner_gate` với Orca (hiện gateway chỉ kiểm tra có truyền gate id, **không** xác minh gate đã resolve).
