import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 審計中介軟體：可在此攔截並記錄敏感操作
 * 實際審計寫入由 API 層的 createAuditLog 處理
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 可在此加入 request 日誌（不記錄敏感 body）
  if (process.env.NODE_ENV === "development") {
    const url = request.nextUrl.pathname;
    if (url.startsWith("/api/") && request.method !== "GET") {
      console.log(`[Middleware] ${request.method} ${url}`);
    }
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
