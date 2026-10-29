# G0 — Lộ trình G1–G4 (đề xuất)

## Reuse vs build
| Thành phần | Quyết định | Lý do |
|---|---|---|
| Điều phối Run/Task/Dispatch/Gate | Dùng Orca nguyên bản | Đã có RPC/CLI first-party |
| Gateway + adapter | **Build** (nhỏ, Node) | Không repo nào có sẵn hợp đồng Dispatch-aware |
| Gọi CLI Orca, `await`/`release` | Tham chiếu `orca-mcp` (MIT) | Hướng ngược, nhưng cùng bài toán `worker_done` |
| Bọc Claude/Codex CLI | Tham chiếu `mcp-agents` (MIT) | Mẫu spawn CLI, app-server của Codex |
| Chọn model/chi phí/quota API | Dùng LiteLLM proxy ở G2 | Ngân sách, virtual key sẵn có |
| PAL `clink` | Chỉ tham chiếu | Không có khái niệm Dispatch; phụ thuộc lớn |

## G1 — Xác minh với Orca thật (blocker lớn nhất)
Trên máy có Orca (Windows của Owner hoặc Linux `orca-ide`): chạy adapter làm worker pane; xác nhận `dispatch` → `worker_done` thật, hành vi khi kill pane, quy tắc handle/pane; chạy lại S1–S9 với Orca thật thay cho double. Tiêu chí ra: P7 PASS.
## G2 — Worker thật + chi phí
Một worker miễn phí hợp lệ (đăng nhập Owner) qua gateway; LiteLLM ngân sách 0 USD; whitelist tham số CLI; xác minh gate với Orca; đánh giá MCP Tasks extension cho tác vụ dài.
## G3 — Độ bền & cô lập
Sandbox OS cho worker CLI, fallback giữa worker giữ trạng thái/bằng chứng, heartbeat/cancel, khóa chứng thực ngoài tiến trình, xác thực người gọi.
## G4 — Vận hành
Quan sát (log có che secret), cấu hình đa worker, tài liệu vận hành, quyết định HTTP/remote nếu Owner đồng ý.
