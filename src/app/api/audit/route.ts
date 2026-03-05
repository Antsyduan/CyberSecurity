import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const auditSchema = z.object({
  userId: z.string().optional(),
  action: z.enum([
    "edit_column",
    "edit_sp",
    "edit_table",
    "add_column",
    "remove_column",
    "change_pii_level",
  ]),
  entityType: z.enum(["column", "sp", "table"]),
  entityId: z.string().optional(),
  diff: z
    .object({
      before: z.record(z.string(), z.unknown()).optional(),
      after: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = auditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await createAuditLog(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API Audit]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
