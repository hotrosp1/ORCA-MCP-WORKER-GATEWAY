# G0 — Kiến trúc & ADR

## So sánh hai hướng tích hợp
| | A. Adapter CLI chung do Orca giám sát → MCP Worker Gateway | B. Orca dispatch trực tiếp tới MCP |
|---|---|---|
| Căn cứ trong mã Orca | Worker = terminal chạy lệnh; `dispatch --task --to <handle>`; `worker_done` theo Dispatch | **Không thấy** đường dispatch MCP; Orca là ACP client với `mcpServers: []` |
| Cần sửa mã Orca | Không (về lý thuyết) | Có (hoặc chờ upstream) |
| Giữ Run/Task/Dispatch/Gate trong Orca | Có — gateway chỉ thực thi và chứng thực | N/A |
| Trạng thái kiểm chứng | Logic gateway+adapter: chạy được với test double. Với Orca thật: **chưa kiểm chứng** | Không khả thi nếu không sửa Orca |

**Kết luận sơ bộ:** A là hướng khả thi *không sửa Orca* theo bằng chứng mã nguồn; B bị loại ở G0.

## ADR-G0-001 (đề xuất, chờ Owner)
- **Quyết định:** Orca là orchestrator duy nhất. Một *generic CLI adapter* (Node, không phụ thuộc) chạy trong pane Orca, đọc danh tính Dispatch, gọi MCP Worker Gateway, rồi báo `worker_done` bằng CLI Orca.
- **Nguyên tắc:** (1) Gateway không tự tạo/đổi trạng thái Task, Dispatch hay Gate. (2) Adapter không tự quyết định thành công — chỉ chuyển kết quả gateway kèm chứng thực HMAC. (3) Idempotency theo `dispatch_id`, journal bền để phục hồi sau restart. (4) Ngân sách mặc định 0 USD; worker có phí không được chọn. (5) Gateway áp dụng file vào sandbox theo `dispatch_id` thay vì để worker ghi trực tiếp.
- **Hệ quả/Giới hạn:** worker CLI thật tự ghi file; PoC chưa có cách cô lập ở mức OS. Chứng thực HMAC là lớp bổ sung của gateway — Orca hiện chỉ kiểm tra handle/pane, nên cần adapter chuyển chứng thực vào `--payload`/`--report-path`, và bước *xác minh* cần coordinator. Chưa kiểm chứng.
- **Phương án thay thế:** fork Orca để thêm dispatch MCP (cần Owner cho phép riêng); dùng `orca-mcp` đảo chiều (MCP client điều khiển Orca) — hợp cho coordinator ngoài, không phải worker.

## Luồng
```
Owner Gate (Orca) -> Task/Dispatch (Orca) -> pane chạy adapter -> MCP worker_dispatch (gateway)
     -> chọn worker theo capability + ngân sách -> worker thực thi -> gateway áp file vào sandbox/<dispatch_id>
     -> bản ghi kết quả + HMAC -> adapter: orca send --type worker_done --outcome <succeeded|failed>
```
Fallback giữ trạng thái: journal `.gateway/journal.jsonl` lưu start/result theo `dispatch_id`; gateway restart nạp lại journal. **Fallback giữa worker (đổi worker khi một worker hỏng) chưa hiện thực trong PoC.**
