# G0 — Kết quả PoC

Lệnh: `cd /home/user/orca-mcp-worker-gateway && node poc/run.mjs` — thoát **0**, 10/10 kịch bản PASS. Dữ liệu thô: `docs/poc-evidence.json`. Node v22.22.0.

**Phạm vi trung thực:** PoC chạy gateway MCP thật (stdio) và adapter thật, nhưng "Orca" là **test double** (`poc/mock-orca.mjs`) và worker là **mock**. Không Orca runtime, không worker/LLM thật, không khóa thật. Đây là bằng chứng về *hợp đồng và logic gateway*, **không** phải bằng chứng Orca thật tích hợp được.

| Kịch bản | Nội dung | Kết quả |
|---|---|---|
| S1 | Tạo run/task, dispatch, gọi worker qua MCP, worker_done, ghi nhận worker+model | PASS |
| S2 | Worker lỗi → task `failed`, không có file đầu ra, exit 1 | PASS |
| S3 | Retry cùng `dispatch_id`: worker chạy 1 lần (gateway tiến trình mới nạp journal); bản thứ hai bị gateway chặn trùng và double từ chối `already_settled` | PASS |
| S4 | Worker cố ghi `../../../escaped.txt` → `path_escape_denied`, file không tồn tại | PASS |
| S5 | Ngân sách 0: worker trả phí không được chọn (tự động lẫn chỉ định) | PASS |
| S6 | `--dangerously-skip-permissions` bị từ chối | PASS |
| S7 | Gate: dispatch task bị khóa bị từ chối; worker không resolve được gate; gateway từ chối việc gated thiếu gate id; có gate id thì chạy | PASS (xem giới hạn) |
| S8 | Chuỗi giống secret bị che trong output và journal | PASS |
| S9 | Chứng thực giả / người gửi lạ bị từ chối; task giữ `dispatched` | PASS |
| S10 | Mã gateway không chứa thao tác git/mạng; PoC không push (repo này có remote `origin` chỉ để đọc, nên không còn tiêu chí "không có remote") | PASS (kiểm tra tĩnh yếu) |

## Giới hạn đã biết của PoC
- Bảo vệ path chỉ áp dụng cho file do worker *trả về*; worker CLI thật tự ghi file thì cần cô lập OS. **Chưa chứng minh.**
- S7: chỉ chứng minh tính nhất quán của double; gateway không xác minh gate với Orca.
- S10 là kiểm tra chuỗi trên mã, không phải giám sát mạng.
- Chưa có fallback giữa worker, chưa có kill worker giữa chừng, chưa có worker thật, chưa chạy Orca.

## Ma trận nghiệm thu
**Context Pack với AC-01…AC-10 không được cung cấp**, nên không thể chấm AC-xx. Bảng dưới dùng *tiêu chí tạm* suy ra từ yêu cầu Phase C/D trong đề bài; Owner cần đối chiếu với AC thật.
| Tiêu chí tạm | Trạng thái |
|---|---|
| P1 Tạo Task | PASS (với double) |
| P2 Giữ danh tính Dispatch | PASS (với double) |
| P3 Gọi worker qua MCP | PASS (mock worker) |
| P4 Hoàn tất hoặc lỗi tường minh | PASS |
| P5 Gán kết quả cho worker/model | PASS |
| P6 Giữ Owner Gate | PASS (với double; chưa xác minh trên Orca) |
| P7 Orca giám sát adapter, nhận worker_done thật, phục hồi worker chết | **BLOCKED** (không có Orca runtime) |
| P8 Worker thật miễn phí suy luận qua gateway | **BLOCKED** (không có xác thực/quota hợp lệ) |
| P9 Fallback worker giữ trạng thái | NOT_TESTED |
| P10 Cô lập file cho worker CLI thật | NOT_TESTED |

**Trạng thái G0: `G0_PARTIAL`** (không phải `G0_PASS`).
