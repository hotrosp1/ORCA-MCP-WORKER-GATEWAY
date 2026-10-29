# G0 — Rà soát nguồn (đọc mã, shallow clone depth 1, 2026-10-29)

Chỉ ghi nhận điều đọc được trong mã/tài liệu; README không được coi là bằng chứng chạy.

| Repo | URL | Commit SHA | Phiên bản |
|---|---|---|---|
| stablyai/orca | https://github.com/stablyai/orca | 1c33f515de935e78dfe1f303bb8637785918424f (2026-10-28) | package.json 1.4.214 |
| thomaswitt/mcp-agents | https://github.com/thomaswitt/mcp-agents | 42aefd038b3150d3e6acfda7f2704588535aeb1f (2026-10-14) | 0.36.0 (MIT) |
| BeehiveInnovations/pal-mcp-server | https://github.com/BeehiveInnovations/pal-mcp-server | 7afc7c1cc96e23992c8f105f960132c657883bb1 (2025-12-15) | 9.8.2 (Apache-2.0) |
| BerriAI/litellm | https://github.com/BerriAI/litellm | a66dc50efbdb6984797304d6fdd91dc5358647e8 (2026-10-28) | 1.109.0 |
| BuildContext/orca-mcp | https://github.com/BuildContext/orca-mcp | 8e355dd72d168aa81c85d8003cdfeb53821f4de1 (2026-08-20) | 0.3.6 (MIT) |

## Orca (mức mã nguồn)
- Có hạ tầng điều phối first-party: `src/shared/orchestration-rpc-contract.ts` liệt kê RPC `orchestration.runCreate/taskCreate/dispatch/workerStart/workerStop/gateCreate/gateResolve/send/check/ask/federation*`. CLI spec: `src/cli/specs/orchestration.ts` (verb `run-create`, `task-create`, `dispatch --task --to <handle>`, `gate-create/resolve`, `send --type worker_done --outcome`).
- Danh tính: `worker_done`/`heartbeat` là tín hiệu theo **đúng Dispatch**; hoàn tất chỉ được chấp nhận từ pane được dispatch, hoặc khi handle người gửi khớp assignee (`specs/orchestration.ts` dòng ~83). Có `--retry-request` cho idempotency.
- Worker của Orca là **terminal/pane chạy agent CLI**; coordinator giao việc bằng `dispatch`. **Không tìm thấy** đường dispatch trực tiếp tới MCP server.
- Orca là **ACP client** (`src/main/acp/*`) và truyền `mcpServers: []` khi mở session (acp-structured-handshake.ts, acp-session-runtime.ts) → Orca không tự nối worker qua MCP.
- Orca có skill `orchestration` và trợ giúp cấu hình MCP (`mcp-config.ts`) cho agent, nhưng đó là MCP *của agent*, không phải đường dispatch của Orca.
- Chưa xác minh được ở runtime: xác thực của handle khi dùng nhiều terminal, hành vi khi worker bị kill giữa chừng, `orca-ide` headless — cần Orca chạy thật.

## BuildContext/orca-mcp (0.3.6)
MCP server bên ngoài, `execFile` binary `orca`, stdio hoặc Streamable HTTP; tool `dispatch → await → release`. Hướng điều khiển: **MCP client → Orca**, tức *ngược chiều* với Orca → worker. Tự cảnh báo "không phải sandbox" (chạy với quyền OS user). Đáng tái sử dụng làm tham chiếu cho cách gọi CLI Orca và bắt `worker_done`; không phải gateway worker.

## thomaswitt/mcp-agents (0.36.0)
Bọc Claude Code/Codex CLI thành MCP tool (mỗi provider một server). Không có định tuyến động, quota, chi phí. Có ghi chú `codex mcp-server` bị deprecate → dùng `codex app-server`. Hữu ích như mẫu spawn CLI worker.

## PAL MCP (9.8.2)
Provider abstraction + `clink` (CLI-to-CLI bridge) với vai trò (planner/codereviewer). Là *tool cho agent*, không có khái niệm Run/Task/Dispatch của Orca; phụ thuộc Python lớn. Tham chiếu cho model selection đa provider.

## LiteLLM (1.109.0)
Proxy/SDK thống nhất nhiều provider, có ngân sách (`max_budget` trong `proxy/_types.py`), virtual key, routing. Phù hợp làm lớp **model/quota/cost** phía dưới gateway cho worker dùng API; không thay thế gateway MCP.

## MCP Tasks Extension / Copilot ACP (tài liệu, không phải mã)
- Tasks: extension `io.modelcontextprotocol/tasks`, spec 2026-07-28; `tasks/get`, `tasks/update`, `tasks/cancel`; trả task handle bền và client poll. Nguồn: https://modelcontextprotocol.io/extensions/tasks/overview. Các blog bên thứ ba mô tả payload không nhất quán → phải kiểm tra schema chính thức trước khi hiện thực. **Chưa xác minh** Orca hoặc worker nào hỗ trợ.
- Copilot CLI ACP: `copilot --acp --stdio|--port`, public preview (01/2026), cấu hình cố định lúc khởi động. Nguồn: https://docs.github.com/en/copilot/reference/acp-server. Chưa chạy (không có Copilot CLI/xác thực).
