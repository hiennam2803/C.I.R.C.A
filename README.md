<div align="center">

---

## 📖 Ý nghĩa tên gọi

|  Chữ cái  | Từ                     | Ý nghĩa trong dự án                                                                      |
| :---------: | ----------------------- | -------------------------------------------------------------------------------------------- |
| **C** | **Context-aware** | Nhớ ngữ cảnh: tự nén lịch sử chat thành summary khi quá dài hoặc khi đổi key    |
| **I** | **Intelligent**   | Task Router tự chọn engine phù hợp cho từng loại câu hỏi                             |
| **R** | **Rotating**      | Xoay vòng tuần hoàn nhiều Gemini API key`1 → 2 → … → N → 1` khi gặp lỗi `429` |
| **C** | **Code**          | Tối ưu cho lập trình: đọc code đang bôi đen, trả code, nút**Apply Code**    |
| **A** | **Assistant**     | Trợ lý nằm ngay Sidebar của VS Code                                                      |

---

## ✨ Key Features

|    | Tính năng                    | Mô tả                                                                                                         |
| :-: | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 💸 | **Chi phí tối thiểu** | Chạy bằng free tier của Gemini; Claude là tuỳ chọn (xem[Lưu ý](#️-license--disclaimer))                 |
| 🔄 | **Auto Key Rotation**    | Bắt lỗi`429 RESOURCE_EXHAUSTED`, tự đổi key kế tiếp, có cooldown cho key vừa lỗi                    |
| 🧠 | **Hybrid Dual-Engine**   | Code khó →**Claude** · Chat nhẹ / tóm tắt → **Gemini** · Claude lỗi → tự fallback Gemini |
| 🧵 | **Context Preservation** | `summarize_context()` nén lịch sử cũ thành đoạn summary ngắn, giữ N tin nhắn gần nhất             |
| ⚡ | **Streaming**            | Chữ hiện dần theo thời gian thực, có nút**Dừng**                                                  |
| 🩹 | **Direct Code Apply**    | Bôi đen code → hỏi → bấm**Apply Code** để thay thẳng vào file                                   |
| 🔒 | **Local-first**          | Server chỉ lắng nghe`127.0.0.1`; key nằm trong `.env`, không commit lên Git                            |

---

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                            VS CODE (Frontend)                              │
│                                                                            │
│  ┌──────────────────┐   postMessage   ┌───────────────────────────────┐    │
│  │ Webview Sidebar  │ ◄─────────────► │  extension.ts (Extension Host)│    │
│  │ (HTML/CSS/JS)    │                 │  • bắt selection / file / lang│    │
│  │ • khung chat     │                 │  • fetch() streaming          │    │
│  │ • Apply / Copy   │                 │  • Apply Code → editor.edit() │    │
│  └──────────────────┘                 └───────────────┬───────────────┘    │
└───────────────────────────────────────────────────────┼────────────────────┘
                                                        │ HTTP POST (JSON)
                                                        │ http://127.0.0.1:8000/chat
                                                        ▼  ▲ text stream (chunked)
┌────────────────────────────────────────────────────────┼───────────────────┐
│                  PYTHON BACKEND  (FastAPI + Uvicorn)   │                   │
│                                                        ▼                   │
│                       ┌──────────────────────────────────────┐             │
│                       │  Context Manager                      │             │
│                       │  • Session store (history + summary)  │             │
│                       │  • summarize_context() khi quá dài    │             │
│                       └───────────────────┬──────────────────┘             │
│                                           ▼                                │
│                       ┌──────────────────────────────────────┐             │
│                       │            TASK ROUTER                │             │
│                       │  chấm điểm: selection, ```, từ khoá  │             │
│                       └───────┬──────────────────────┬───────┘             │
│                  code khó     │                      │   chat nhẹ / tóm tắt│
│                               ▼                      ▼                     │
│              ┌──────────────────────┐   ┌─────────────────────────────┐    │
│              │    Claude Bridge     │   │       Gemini Rotator        │    │
│              │  (Poe API)           │   │  Key1 → Key2 → … → Key10 ─┐ │    │
│              └──────────┬───────────┘   │    ▲   (429 → cooldown)   │ │    │
│                         │ lỗi/hết quota │    └─────────── vòng lại ◄─┘ │    │
│                         └──── fallback ─►                             │    │
│                                         └──────────────┬──────────────┘    │
└────────────────────────────────────────────────────────┼───────────────────┘
                              │                          │
                              ▼                          ▼
                    ☁️  Poe API → Claude       ☁️  Google Gemini API
```

**Luồng xử lý một request:**

1. Bạn bôi đen code, gõ câu hỏi → Webview gửi tin cho Extension Host.
2. Extension đọc `selection`, `file_name`, `language` rồi `POST /chat`.
3. Backend nén context nếu cần → **Task Router** chọn `claude` hoặc `gemini`.
4. Nếu Gemini trả `429` → **Rotator** đánh dấu cooldown, chuyển key kế tiếp, nén context và thử lại — người dùng không thấy gián đoạn.
5. Kết quả stream ngược về Sidebar; khối code có nút **Apply Code**.

---

## 🧰 Prerequisites

| Công cụ                  | Phiên bản                         | Ghi chú                                                       |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| 🐍**Python**         | 3.10 trở lên                      | Kiểm tra:`python --version`                                 |
| 🟢**Node.js**        | 18 LTS trở lên (khuyến nghị 20) | Kèm`npm`                                                    |
| 💻**VS Code**        | 1.90 trở lên                      | Có lệnh`code` trong PATH (tuỳ chọn)                      |
| 🔑**Gemini API Key** | 1 – 10 key                         | Tạo tại[Google AI Studio](https://aistudio.google.com/apikey) |
| 💬**Poe API Key**    | tuỳ chọn                          | Chỉ cần nếu muốn dùng engine Claude                       |

---

## 🚀 Quick Start Guide

### 1️⃣ Chạy Python Backend

```bash
git clone https://github.com/hiennam2803/C.I.R.C.A.git circa && cd circa/backend

python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env                 # Windows: copy .env.example .env
# → mở .env và dán Gemini API Key của bạn

python server.py                     # http://127.0.0.1:8000
```

Kiểm tra server sống: `curl http://127.0.0.1:8000/health`

### 2️⃣ Chạy Extension (chế độ phát triển)

```bash
cd ../extension
npm install
npm run compile
code .                               # mở thư mục extension trong VS Code → bấm F5
```

Cửa sổ **Extension Development Host** mở ra → bấm icon ⟳ **C.I.R.C.A** ở Activity Bar.

### 3️⃣ Cài vĩnh viễn bằng file `.vsix`

```bash
npx vsce package --allow-missing-repository
code --install-extension circa-assistant-0.1.0.vsix
```

### 🎮 Cách dùng nhanh

| Thao tác                                                                              | Kết quả                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Gõ câu hỏi trong Sidebar                                                            | Chat bình thường                                    |
| Bôi đen code → chuột phải →**C.I.R.C.A: Hỏi về đoạn code đang chọn** | Gửi kèm đoạn code                                  |
| Bấm**Apply Code** dưới khối code                                             | Thay đoạn đã bôi đen (hoặc chèn tại con trỏ) |
| **＋ Mới**                                                                      | Xoá hội thoại, tạo session mới                    |

---

## ⚙️ Configuration (`.env`)

```dotenv
# ===== GEMINI API KEYS (Google AI Studio) =====
GEMINI_KEY_1=PASTE_KEY_1_HERE
GEMINI_KEY_2=PASTE_KEY_2_HERE
GEMINI_KEY_3=PASTE_KEY_3_HERE
GEMINI_KEY_4=PASTE_KEY_4_HERE
GEMINI_KEY_5=PASTE_KEY_5_HERE
GEMINI_KEY_6=PASTE_KEY_6_HERE
GEMINI_KEY_7=PASTE_KEY_7_HERE
GEMINI_KEY_8=PASTE_KEY_8_HERE
GEMINI_KEY_9=PASTE_KEY_9_HERE
GEMINI_KEY_10=PASTE_KEY_10_HERE

# ===== MODEL & XOAY KEY =====
GEMINI_MODEL=gemini-2.5-flash
KEY_COOLDOWN_SECONDS=65
KEY_DAILY_COOLDOWN_SECONDS=3600

# ===== CONTEXT MANAGER =====
CONTEXT_CHAR_LIMIT=24000
KEEP_RECENT_MESSAGES=6

# ===== CLAUDE BRIDGE (Poe API) - tuỳ chọn =====
POE_API_KEY=
POE_BOT_NAME=Claude-Sonnet-4.5

# ===== SERVER =====
CIRCA_HOST=127.0.0.1
CIRCA_PORT=8000
CIRCA_DEBUG=0
```

| Biến                    | Ý nghĩa                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `GEMINI_KEY_1…10`     | Key bị bỏ qua nếu để trống hoặc bắt đầu bằng`PASTE_`. Chỉ cần ≥ 1 key.                         |
| `GEMINI_MODEL`         | Tên model. Hãy kiểm tra danh sách model hiện hành trong AI Studio vì Google thay đổi thường xuyên. |
| `KEY_COOLDOWN_SECONDS` | Thời gian "nghỉ" của key vừa dính`429` theo phút.                                                      |
| `CONTEXT_CHAR_LIMIT`   | Lịch sử vượt ngưỡng này sẽ được nén.                                                               |
| `POE_BOT_NAME`         | Tên bot Claude trên Poe — kiểm tra tên chính xác tại poe.com.                                          |
| `CIRCA_DEBUG`          | `1` = bật endpoint `/debug/*` để giả lập hết quota khi test.                                         |

> 🔐 **File `.env` đã nằm trong `.gitignore`. Tuyệt đối không commit hoặc chia sẻ API key.**

---

## 🧪 Kiểm thử nhanh

```bash
cd backend
python -m pytest -q                  # test offline, không tốn quota

# Giả lập key 1 hết quota (cần CIRCA_DEBUG=1)
curl -X POST http://127.0.0.1:8000/debug/kill_key/1
curl http://127.0.0.1:8000/status    # xem key nào đang được dùng
```

---

## 🗂️ Cấu trúc thư mục

```text
circa/
├── backend/
│   ├── server.py            # FastAPI: Rotator + Context Manager + Router + Claude Bridge
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/test_rotator.py
├── extension/
│   ├── package.json         # khai báo Sidebar, command, cấu hình
│   ├── tsconfig.json
│   ├── src/extension.ts     # WebviewViewProvider + streaming + Apply Code
│   └── media/{main.js, main.css, circa.svg}
├── .gitignore
└── README.md
```

---

## ⚖️ License & Disclaimer

**License:** [MIT](https://opensource.org/licenses/MIT) — dùng, sửa, phân phối tự do với điều kiện giữ nguyên thông báo bản quyền.

**⚠️ Lưu ý sử dụng cá nhân — vui lòng đọc kỹ:**

- **Điều khoản của Google.** Hạn mức Gemini API được tính **theo project, không theo từng API key**: nhiều key trong cùng một project dùng chung một hạn mức. Việc tạo nhiều tài khoản/project chỉ để lách giới hạn có thể **vi phạm điều khoản dịch vụ** và có nguy cơ bị khoá key hoặc tài khoản. Hãy tự đọc *Gemini API Additional Terms of Service* trước khi dùng nhiều tài khoản. Rotator trong dự án hoạt động tốt với **1 key** (có cooldown và báo lỗi rõ ràng), và với nhiều key thuộc các project mà bạn sở hữu hợp lệ.
- **Quyền riêng tư.** Ở free tier, Google có thể dùng nội dung prompt/response để cải thiện sản phẩm. **Không gửi** mã nguồn bí mật, khoá truy cập, dữ liệu khách hàng.
- **Claude không "miễn phí vô hạn".** Engine Claude đi qua Poe API và tiêu hao *compute points* của tài khoản Poe; hết điểm thì backend tự fallback sang Gemini. Puter.js là thư viện chạy phía trình duyệt nên không dùng được trực tiếp trong backend Python này.
- **Không có bảo đảm.** Phần mềm cung cấp "nguyên trạng" (*as-is*), không bảo hành. Output của AI có thể sai — luôn đọc và kiểm tra code trước khi chạy/commit.
- **Chỉ dùng cá nhân.** Không đóng gói thành dịch vụ chia sẻ quota cho người khác.

<div align="center">
