import { NextResponse } from "next/server";
import { getCanvasState, getConsolidatedData, getMigrationConfig } from "@/lib/db-sqlite";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const { nodes, edges } = getCanvasState();
    const nodesArr = JSON.parse(nodes || "[]") as { id: string; type?: string; data?: { purpose?: string } }[];
    const edgesArr = JSON.parse(edges || "[]") as { source: string; target: string }[];

    let azureData = getConsolidatedData("azure_db");
    if (!azureData || (JSON.parse(azureData.tables).length === 0 && JSON.parse(azureData.procs).length === 0)) {
      const jsonPath = join(process.cwd(), "public", "data", "consolidated.json");
      if (existsSync(jsonPath)) {
        const legacy = JSON.parse(readFileSync(jsonPath, "utf8"));
        azureData = {
          tables: JSON.stringify(legacy.tables || []),
          views: JSON.stringify(legacy.views || []),
          procs: JSON.stringify(legacy.procs || []),
        };
      }
    }

    const fullTables = azureData ? JSON.parse(azureData.tables).length : 0;
    const fullViews = azureData ? JSON.parse(azureData.views || "[]").length : 0;
    const fullProcs = azureData ? JSON.parse(azureData.procs).length : 0;

    const result: Record<string, { tables: number; views: number; procs: number }> = {};

    for (const node of nodesArr) {
      if (node.type !== "database") continue;
      const purpose = node.data?.purpose;

      if (purpose === "backup" || node.id === "db-prod") {
        result[node.id] = { tables: fullTables, views: fullViews, procs: fullProcs };
      } else if (purpose === "application") {
        const upstreamBackup = edgesArr
          .filter((e) => e.target === node.id)
          .map((e) => nodesArr.find((n) => n.id === e.source))
          .find((n) => n?.data?.purpose === "backup");
        if (upstreamBackup) {
          const config = getMigrationConfig(upstreamBackup.id, node.id);
          result[node.id] = {
            tables: config?.tableIds?.length ?? 0,
            views: config?.viewIds?.length ?? 0,
            procs: config?.procIds?.length ?? 0,
          };
        } else {
          result[node.id] = { tables: 0, views: 0, procs: 0 };
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/canvas-node-stats error:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
