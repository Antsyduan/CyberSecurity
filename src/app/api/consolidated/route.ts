import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  getConsolidatedData,
  saveConsolidatedData,
  getCanvasState,
  getMigrationConfig,
} from "@/lib/db-sqlite";

function filterByMigrationConfig(
  tables: { id: string; columns?: { id: string }[] }[],
  views: { id: string; columns?: { id: string }[] }[],
  procs: { id: string }[],
  config: { tableIds: string[]; viewIds: string[]; procIds: string[]; columnsByTable: Record<string, string[]>; columnsByView: Record<string, string[]> } | null
) {
  if (!config || (config.tableIds.length === 0 && config.viewIds.length === 0 && config.procIds.length === 0)) {
    return { tables: [], views: [], procs: [] };
  }
  const tableSet = new Set(config.tableIds);
  const viewSet = new Set(config.viewIds);
  const procSet = new Set(config.procIds);
  const filteredTables = tables
    .filter((t) => tableSet.has(t.id))
    .map((t) => {
      const colIds = config.columnsByTable[t.id];
      if (!colIds || colIds.length === 0) return t;
      const colSet = new Set(colIds);
      return {
        ...t,
        columns: (t.columns || []).filter((c) => colSet.has(c.id)),
      };
    });
  const filteredViews = views
    .filter((v) => viewSet.has(v.id))
    .map((v) => {
      const colIds = config.columnsByView[v.id];
      if (!colIds || colIds.length === 0) return v;
      const colSet = new Set(colIds);
      return {
        ...v,
        columns: (v.columns || []).filter((c) => colSet.has(c.id)),
      };
    });
  const filteredProcs = procs.filter((p) => procSet.has(p.id));
  return { tables: filteredTables, views: filteredViews, procs: filteredProcs };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("nodeId") || "azure_db";
    let data = getConsolidatedData("azure_db");
    if (!data || (JSON.parse(data.tables).length === 0 && JSON.parse(data.procs).length === 0)) {
      const jsonPath = join(process.cwd(), "public", "data", "consolidated.json");
      if (existsSync(jsonPath)) {
        const legacy = JSON.parse(readFileSync(jsonPath, "utf8"));
        saveConsolidatedData(
          "azure_db",
          JSON.stringify(legacy.tables || []),
          JSON.stringify(legacy.procs || []),
          JSON.stringify(legacy.views || [])
        );
        data = getConsolidatedData("azure_db");
      }
    }
    if (!data) {
      return NextResponse.json({ tables: [], views: [], procs: [] });
    }
    let tables = JSON.parse(data.tables);
    let views = JSON.parse(data.views || "[]");
    let procs = JSON.parse(data.procs);

    // 應用節點：從上游備援取得 schema，依 migration config 過濾
    if (nodeId !== "azure_db") {
      const { nodes, edges } = getCanvasState();
      const nodesArr = JSON.parse(nodes || "[]") as { id: string; data?: { purpose?: string } }[];
      const edgesArr = JSON.parse(edges || "[]") as { source: string; target: string }[];
      const upstreamBackup = edgesArr
        .filter((e) => e.target === nodeId)
        .map((e) => nodesArr.find((n) => n.id === e.source))
        .find((n) => n?.data?.purpose === "backup");
      if (upstreamBackup) {
        const config = getMigrationConfig(upstreamBackup.id, nodeId);
        const filtered = filterByMigrationConfig(tables, views, procs, config);
        tables = filtered.tables;
        views = []; // 應用 DB 僅移轉資料表，不包含 View、預存程序
        procs = [];
      }
      // 無上游備援時（如 db-prod、db-backup）維持完整 schema
    }

    return NextResponse.json({
      tables,
      views,
      procs,
    });
  } catch (error) {
    console.error("GET /api/consolidated error:", error);
    return NextResponse.json(
      { error: "Failed to load consolidated data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nodeId = "azure_db", tables, views, procs } = body;
    if (!Array.isArray(tables) || !Array.isArray(procs)) {
      return NextResponse.json(
        { error: "tables and procs must be arrays" },
        { status: 400 }
      );
    }
    saveConsolidatedData(
      String(nodeId),
      JSON.stringify(tables),
      JSON.stringify(procs),
      Array.isArray(views) ? JSON.stringify(views) : undefined
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/consolidated error:", error);
    return NextResponse.json(
      { error: "Failed to save consolidated data" },
      { status: 500 }
    );
  }
}
