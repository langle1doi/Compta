# Chatbot COMPTA Assistant — bản sao các file đã làm

Đây là BẢN SAO để tiện xem/bàn giao. Code chạy thật vẫn nằm trong compta-be-develop và compta-fe-develop
(NestJS yêu cầu module trong src/). Sửa ở đó, không sửa ở đây.

## BE/new — file mới (chép nguyên vào cùng đường dẫn trong compta-be-develop)
- src/modules/assistant/   POST /assistant/chat
  - assistant.controller.ts / .module.ts / .dto.ts
  - assistant.service.ts    OpenAI nếu có OPENAI_API_KEY; lỗi hoặc không có key -> trả lời local
  - assistant-context.ts    đọc hóa đơn/báo giá thật theo phạm vi quyền (OWN/COMPANY/TENANT)
  - assistant-local.ts      thuật toán khớp từ khóa (fr/en), không cần LLM
  - assistant-local.spec.ts unit test
- src/cli/seed-demo.ts      dữ liệu mẫu: npm run db:demo:seed

## BE/modified — file có sẵn đã sửa (chỉ thêm các phần dưới đây)
- src/app.module.ts            import + đăng ký AssistantModule
- src/config/env.validation.ts OPENAI_API_KEY (tùy chọn), ASSISTANT_MODEL (mặc định gpt-4o-mini)
- src/common/errors/error-codes.ts  ASSISTANT_UNAVAILABLE
- package.json                 script db:demo:seed
- .env.example                 OPENAI_API_KEY, ASSISTANT_MODEL

## FE/modified
- src/components/assistant/hooks/use-assistant-chat.ts  gọi apiFetch('/assistant/chat') thay cho mock
  (phần đính kèm file vẫn là mock; demo-replies.ts không còn được dùng)

## Chạy demo
BE: docker compose up -d postgres rabbitmq minio mailpit
    npm run db:control:deploy && npm run db:control:seed && npm run db:tenants:deploy && npm run db:demo:seed
    (tùy chọn) đặt OPENAI_API_KEY trong .env;  npm run start:dev      (cổng 3000)
FE: npx next dev -p 3002  ->  http://dfm.localhost:3002/fr/login
Đăng nhập owner@dfm.local / 123456 (sales@ chỉ thấy dữ liệu do mình phụ trách), mở nút trợ lý.
