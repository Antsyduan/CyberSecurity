import { NextResponse } from "next/server";
import { getCanvasState, saveCanvasState } from "@/lib/db-sqlite";

export async function GET() {
  try {
    const { nodes, edges } = getCanvasState();
    return NextResponse.json({
      nodes: JSON.parse(nodes),
      edges: JSON.parse(edges),
    });
  } catch (error) {
    console.error("GET /api/canvas error:", error);
    return NextResponse.json(
      { error: "Failed to load canvas" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nodes, edges } = body;
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return NextResponse.json(
        { error: "nodes and edges must be arrays" },
        { status: 400 }
      );
    }
    saveCanvasState(JSON.stringify(nodes), JSON.stringify(edges));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/canvas error:", error);
    return NextResponse.json(
      { error: "Failed to save canvas" },
      { status: 500 }
    );
  }
}
