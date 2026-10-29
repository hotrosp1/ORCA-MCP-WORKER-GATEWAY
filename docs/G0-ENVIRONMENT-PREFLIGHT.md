# G0 — Preflight môi trường

Ngày: 2026-10-29. Người thực hiện: Claude (phiên cloud). Workspace: `/home/user/orca-mcp-worker-gateway` (repo Git tổng hợp, không có remote).

## Môi trường thực tế
| Mục | Giá trị |
|---|---|
| Hệ điều hành | Linux 6.18.44-fc-v185 x86_64 (container cloud, **không phải máy Windows của Owner**) |
| Node / npm | v22.22.0 / 10.9.4 |
| Python / Git | 3.13.17 / 2.43.0 |
| `orca`, `orca-ide`, `opencode`, `codex`, `copilot` | **Không có** trong PATH |
| `claude` | Có (`/opt/node22/bin/claude`), thuộc môi trường cloud; **không dùng** làm worker |
| Ứng dụng Orca (Electron) | **Chưa cài, không chạy** — không có GUI/runtime Orca trong container |

## Hệ quả
- Mọi tiêu chí cần **Orca runtime thật** (launch/supervise adapter, giữ Task/Dispatch identity trong Orca, worker_done thật, Owner Gate thật) **không kiểm chứng được** ở đây → BLOCKED.
- PoC dùng **test double** (`poc/mock-orca.mjs`) mô phỏng các verb Orca đã đọc trong mã nguồn. Double **không phải Orca** và không chứng minh hành vi runtime của Orca.
- Không worker thật nào được dùng: không có xác thực/quota hợp lệ; không có thông tin xác thực nào được dùng hoặc bịa ra.

## Tiền đề cho G1 (trên máy có Orca)
Orca ≥ phiên bản có `orchestration` (đã thấy ở 1.4.214 nguồn), CLI `orca` (Linux: `orca-ide`), Node ≥ 22, ít nhất một agent CLI đã đăng nhập hợp lệ.

## Thiếu đầu vào
**Context Pack (AC-01…AC-10) không được cung cấp** trong phiên. Xem `G0-POC-RESULTS.md` mục ma trận nghiệm thu.
