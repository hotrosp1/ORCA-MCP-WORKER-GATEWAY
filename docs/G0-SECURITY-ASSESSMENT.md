# G0 — Đánh giá bảo mật

| Yêu cầu Phase D | Kết quả | Bằng chứng / giới hạn |
|---|---|---|
| Worker không sửa file ngoài workspace | Một phần | S4 PASS cho file worker trả về. Worker CLI thật: chưa kiểm chứng, cần sandbox OS |
| Không bật cờ bỏ quyền ngầm | PASS (chặn theo danh sách) | S6; danh sách cờ là blacklist, chưa đầy đủ cho mọi CLI. Nên chuyển sang whitelist ở G1 |
| Không chọn model trả phí khi ngân sách 0 | PASS | S5. `cost_usd_per_call` do registry tự khai — cần nguồn giá đáng tin ở G2 (LiteLLM budget) |
| Worker lỗi không thành công giả | PASS | S2, S9 |
| Retry không chạy trùng | PASS | S3 |
| Không lộ secret | PASS (mẫu regex) | S8; regex hẹp (sk-, Bearer, key=) |
| Không auto-merge/push/deploy | PASS | Mã gateway không có thao tác git; commit chỉ cục bộ, chưa push (repo có remote `origin`, quyền push được cấp riêng) |

## Rủi ro khác
- Gateway chạy với quyền OS user (cùng cảnh báo của `orca-mcp`): không phải ranh giới bảo mật.
- Khóa HMAC cấp qua biến môi trường: lộ cho mọi tiến trình con. Cần kho khóa riêng.
- Gateway chưa xác thực người gọi (stdio tin tiến trình cha).
- `owner_gate` chưa được xác minh với Orca.
