import { NextResponse } from "next/server";
import { getCanvasSetting, saveCanvasSetting } from "@/lib/db-sqlite";

const LOCK_KEY = "canvas_locked";

export async function GET() {
  try {
    const value = getCanvasSetting(LOCK_KEY);
    const locked = value === "true";
    return NextResponse.json({ locked });
  } catch (error) {
    console.error("GET /api/canvas/lock error:", error);
    return NextResponse.json(
      { error: "Failed to load lock state" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locked } = body;
    const value = Boolean(locked) ? "true" : "false";
    saveCanvasSetting(LOCK_KEY, value);
    return NextResponse.json({ success: true, locked: Boolean(locked) });
  } catch (error) {
    console.error("POST /api/canvas/lock error:", error);
    return NextResponse.json(
      { error: "Failed to save lock state" },
      { status: 500 }
    );
  }
}
