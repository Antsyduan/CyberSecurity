import dagre from "@dagrejs/dagre";
import { Position, type Node, type Edge } from "@xyflow/react";

const BASE_WIDTH = 220;
const BASE_HEIGHT = 120;
/** 資料庫節點下方可能有告警紅字，預留額外高度避免重疊 */
const DB_EXTRA_HEIGHT = 50;

function getNodeDimensions(node: Node): { width: number; height: number } {
  const measured = node as Node & { width?: number; height?: number };
  const isDatabase = node.type === "database";
  const w = measured.width ?? BASE_WIDTH;
  const h = measured.height ?? BASE_HEIGHT;
  const extraH = isDatabase ? DB_EXTRA_HEIGHT : 0;
  return { width: Math.max(w, BASE_WIDTH), height: Math.max(h, BASE_HEIGHT) + extraH };
}

export type LayoutDirection = "TB" | "LR";

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "LR"
): { nodes: Node[]; edges: Edge[] } {
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 160,
    nodesep: 120,
  });

  const dims = new Map<string, { width: number; height: number }>();
  nodes.forEach((node) => {
    const d = getNodeDimensions(node);
    dims.set(node.id, d);
    dagreGraph.setNode(node.id, { width: d.width, height: d.height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const isHorizontal = direction === "LR";

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const d = dims.get(node.id) ?? { width: BASE_WIDTH, height: BASE_HEIGHT };
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - d.width / 2,
        y: nodeWithPosition.y - d.height / 2,
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    };
  });

  return { nodes: layoutedNodes, edges };
}
