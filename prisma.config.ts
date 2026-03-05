import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma generate 時不需連線，build 環境可無 DATABASE_URL
const databaseUrl =
  process.env.DATABASE_URL ??
  "sqlserver://localhost:1433;database=placeholder;user=sa;password=;encrypt=true;trustServerCertificate=true";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
