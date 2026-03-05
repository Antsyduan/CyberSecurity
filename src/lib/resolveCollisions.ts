import type { Node } from "@xyflow/react";

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  moved: boolean;
  node: Node;
};

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;
/** 資料庫節點下方可能有告警紅字 */
const DB_EXTRA_HEIGHT = 50;

function getBoxesFromNodes(
  nodes: Node[],
  margin: number
): Box[] {
  return nodes.map((node) => {
    const measured = node as Node & { width?: number; height?: number };
    const baseW = measured.width ?? DEFAULT_NODE_WIDTH;
    const baseH = measured.height ?? DEFAULT_NODE_HEIGHT;
    const extraH = node.type === "database" ? DB_EXTRA_HEIGHT : 0;
    const w = baseW + margin * 2;
    const h = baseH + extraH + margin * 2;
    return {
      x: node.position.x - margin,
      y: node.position.y - margin,
      width: w,
      height: h,
      moved: false,
      node,
    };
  });
}

export interface ResolveCollisionsOptions {
  maxIterations?: number;
  overlapThreshold?: number;
  margin?: number;
  /** 若提供，此節點保持固定不動，僅移動其他重疊節點 */
  fixedNodeId?: string;
}

/**
 * 解析節點重疊：將重疊的節點沿重疊較小的軸向推開
 */
export function resolveCollisions(
  nodes: Node[],
  options: ResolveCollisionsOptions = {}
): Node[] {
  const {
    maxIterations = 100,
    overlapThreshold = 0.5,
    margin = 15,
    fixedNodeId,
  } = options;

  const boxes = getBoxesFromNodes(nodes, margin);
  const fixedIndex = fixedNodeId
    ? boxes.findIndex((b) => b.node.id === fixedNodeId)
    : -1;

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i];
        const B = boxes[j];

        const centerAX = A.x + A.width * 0.5;
        const centerAY = A.y + A.height * 0.5;
        const centerBX = B.x + B.width * 0.5;
        const centerBY = B.y + B.height * 0.5;

        const dx = centerAX - centerBX;
        const dy = centerAY - centerBY;

        const px = (A.width + B.width) * 0.5 - Math.abs(dx);
        const py = (A.height + B.height) * 0.5 - Math.abs(dy);

        if (px > overlapThreshold && py > overlapThreshold) {
          A.moved = B.moved = moved = true;

          // 若其中一個是固定節點，只移動另一個
          const moveA = fixedIndex !== i;
          const moveB = fixedIndex !== j;

          if (px < py) {
            const sx = dx > 0 ? 1 : -1;
            const moveAmount = (px / 2) * sx;
            if (moveA) A.x += moveAmount;
            if (moveB) B.x -= moveAmount;
          } else {
            const sy = dy > 0 ? 1 : -1;
            const moveAmount = (py / 2) * sy;
            if (moveA) A.y += moveAmount;
            if (moveB) B.y -= moveAmount;
          }
        }
      }
    }

    if (!moved) break;
  }

  return boxes.map((box) => {
    if (box.moved) {
      return {
        ...box.node,
        position: {
          x: box.x + margin,
          y: box.y + margin,
        },
      };
    }
    return box.node;
  });
}
