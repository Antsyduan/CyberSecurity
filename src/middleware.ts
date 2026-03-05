import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/api/auth"];
const API_AUTH_PATHS = ["/api/auth"];

/**
 * 審計中介軟體：可在此攔截並記錄敏感操作
 * 登入保護：未登入者導向 /login
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開路徑與 API 認證路徑不檢查
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  if (process.env.NODE_ENV === "development") {
    if (pathname.startsWith("/api/") && !API_AUTH_PATHS.some((p) => pathname.startsWith(p)) && request.method !== "GET") {
      console.log(`[Middleware] ${request.method} ${pathname}`);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
