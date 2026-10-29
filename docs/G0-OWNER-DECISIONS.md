# G0 — Quyết định cần Owner

1. **Cung cấp Context Pack (AC-01…AC-10)** để chấm nghiệm thu chính thức; hiện chỉ có tiêu chí tạm.
2. **Máy chạy G1:** cho phép chạy phiên local trên máy có Orca (Windows hay Linux). Phiên cloud không có Orca runtime và không kết nối được máy của Owner.
3. **Chấp thuận hướng A** (adapter + gateway, không sửa Orca) làm hướng G1; hướng B cần Owner cho phép riêng việc sửa/fork Orca.
4. **Worker thật:** chọn agent nào đăng nhập tương tác (OpenCode/Codex/Claude/Copilot) và xác nhận không phát sinh phí.
5. **Phạm vi bảo mật:** chấp nhận gateway chạy với quyền OS user ở G1, hay yêu cầu sandbox OS trước khi chạy worker thật.
6. **Vị trí repo:** workspace PoC đang ở `/home/user/orca-mcp-worker-gateway` (cục bộ, chưa push). Có chuyển vào `hotrosp1/orca-mcp-worker-gateway` không? Việc push cần Owner đồng ý.
