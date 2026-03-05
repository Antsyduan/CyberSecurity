/**
 * 登入驗證：呼叫 Antsyduan AI API 驗證帳密
 */
const API_URL = process.env.ANTSYDUAN_API_URL ?? "https://core.antsyduan.com/v1/ai/execute";
const PROJECT_KEY = process.env.ANTSYDUAN_PROJECT_KEY ?? "av_99436e59d7e5b9f1d7fea46a9974b4d8";
const LOGIN_SKILL_ID = process.env.ANTSYDUAN_LOGIN_SKILL_ID ?? "abb7a840-56f4-4c98-8920-b43331036afe";

export type LoginResult = { success: true; user: { name: string; email?: string } } | { success: false; error: string };

export async function verifyCredentials(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-Key": PROJECT_KEY,
      },
      body: JSON.stringify({
        skill_id: LOGIN_SKILL_ID,
        params: {
          username,
          password,
          text: username, // 部分 skill 可能使用 text 欄位
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `API 錯誤: ${res.status} ${err}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    // 依 API 回傳格式判斷：有 data/result/success 或無 error 即視為成功
    const hasError = data?.error != null || data?.message === "error";
    const hasSuccess = data?.success === true || data?.data != null || data?.result != null;

    if (hasError) {
      return {
        success: false,
        error: (data?.error as string) ?? (data?.message as string) ?? "驗證失敗",
      };
    }

    if (hasSuccess || res.ok) {
      const userData = (data?.data as Record<string, string>) ?? data;
      return {
        success: true,
        user: {
          name: (userData?.name as string) ?? username,
          email: userData?.email as string | undefined,
        },
      };
    }

    return { success: false, error: "驗證失敗，請檢查帳號密碼" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "連線失敗";
    return { success: false, error: msg };
  }
}
