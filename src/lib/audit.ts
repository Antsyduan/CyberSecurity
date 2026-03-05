import { prisma } from "./prisma";

export type AuditAction =
  | "edit_column"
  | "edit_sp"
  | "edit_table"
  | "add_column"
  | "remove_column"
  | "change_pii_level";

export type AuditPayload = {
  userId?: string;
  action: AuditAction;
  entityType: "column" | "sp" | "table";
  entityId?: string;
  diff?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
};

/**
 * 操作審計：記錄編輯欄位、修改 SP 等操作
 * 使用參數化方式寫入，防範注入
 */
export async function createAuditLog(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId ?? null,
        diff: payload.diff ? JSON.stringify(payload.diff) : undefined,
      },
    });
  } catch (err) {
    console.error("[Audit] Failed to create log:", err);
  }
}
