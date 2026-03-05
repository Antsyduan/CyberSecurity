# 資料庫架構管理平台

視覺化呈現資料流向、元數據編輯、個資防護管理的企業級平台。

## 功能特色

- **互動式畫布**：React Flow 三區劃分（正式機 / 備援機 / 內部去個資機），Firewall 虛線分隔
- **元數據編輯器**：點擊資料庫節點編輯資料表結構、欄位型別、個資等級 (L1–L4)
- **預存程序**：側邊欄支援 SP SQL 編輯，產生 Migration 腳本供人工審核
- **流向驗證**：PII 欄位流向去個資機時若無 Masking Job，節點與連線紅色閃爍告警
- **資安機制**：環境變數連線、參數化查詢、審計日誌、RBAC、Migration 腳本下載

## 技術棧

- **Frontend**: Next.js (App Router), Tailwind CSS, Lucide React
- **視覺化**: React Flow
- **狀態**: TanStack Query
- **Backend**: Prisma + Microsoft SQL Server（僅儲存元數據，不儲存真實個資）
- **資安**: NextAuth.js, Zod, CryptoJS

## 快速開始

### 1. 環境變數

```bash
cp .env.example .env
# 編輯 .env，設定 DATABASE_URL
```

### 2. 資料庫

```bash
npm run db:push    # 建立 Schema
npm run db:studio  # 可選：Prisma Studio 檢視
```

### 3. 開發

```bash
npm run dev
```

### 4. 資安掃描

```bash
npm run security:audit      # 執行 npm audit
npm run security:audit:fix  # 修復已知漏洞
```

## 專案結構

```
src/
├── app/              # Next.js App Router
├── components/       # UI 組件
│   ├── canvas/       # React Flow 畫布、節點、邊緣
│   ├── sidebar/      # 元數據編輯側邊欄
│   └── ui/           # Shadcn 風格組件
├── lib/              # 工具、Prisma、審計
└── middleware.ts     # API 審計中介
```

## 資安規範

- **禁止硬編碼**：所有 DB 連線使用 `process.env.DATABASE_URL`
- **防 SQL 注入**：Prisma 參數化查詢
- **元數據隔離**：僅儲存 Schema 與流向，不儲存真實個資
- **Vibe Coding**：涉及真實欄位名稱時，請改為 `Field_A` 或 `PII_Column`

## License

MIT
