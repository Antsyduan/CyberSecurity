import { NextResponse } from "next/server";
import {
  getMigrationConfig,
  saveMigrationConfig,
  type MigrationConfig,
} from "@/lib/db-sqlite";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceNodeId = searchParams.get("sourceNodeId");
    const targetNodeId = searchParams.get("targetNodeId");
    if (!sourceNodeId || !targetNodeId) {
      return NextResponse.json(
        { error: "sourceNodeId and targetNodeId are required" },
        { status: 400 }
      );
    }
    const config = getMigrationConfig(sourceNodeId, targetNodeId);
    return NextResponse.json(config ?? { tableIds: [], viewIds: [], procIds: [], columnsByTable: {}, columnsByView: {} });
  } catch (error) {
    console.error("GET /api/migration-config error:", error);
    return NextResponse.json(
      { error: "Failed to load migration config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceNodeId, targetNodeId, config } = body as {
      sourceNodeId: string;
      targetNodeId: string;
      config: MigrationConfig;
    };
    if (!sourceNodeId || !targetNodeId || !config) {
      return NextResponse.json(
        { error: "sourceNodeId, targetNodeId, and config are required" },
        { status: 400 }
      );
    }
    const normalized: MigrationConfig = {
      tableIds: Array.isArray(config.tableIds) ? config.tableIds : [],
      viewIds: Array.isArray(config.viewIds) ? config.viewIds : [],
      procIds: Array.isArray(config.procIds) ? config.procIds : [],
      columnsByTable: config.columnsByTable && typeof config.columnsByTable === "object" ? config.columnsByTable : {},
      columnsByView: config.columnsByView && typeof config.columnsByView === "object" ? config.columnsByView : {},
    };
    saveMigrationConfig(sourceNodeId, targetNodeId, normalized);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/migration-config error:", error);
    return NextResponse.json(
      { error: "Failed to save migration config" },
      { status: 500 }
    );
  }
}
