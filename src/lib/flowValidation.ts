/**
 * 流向驗證：當 PII 欄位從備援機流向內部去個資機時，路徑上必須有 Masking Job
 * 若無則回傳需告警的節點與邊緣 ID
 */

export type FlowNode = {
  id: string;
  type: string;
  data: { label: string; hasAlert?: boolean };
  position: { x: number; y: number };
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  data?: { hasMasking?: boolean; hasAlert?: boolean };
};

export type PiiColumnRef = {
  nodeId: string;
  tableId?: string;
  columnName: string;
  piiLevel: string;
};

/**
 * 檢查從備援機到去個資機的邊緣是否有 Masking
 * 若有 PII 欄位流向該路徑但無 Masking，則標記告警
 */
export function computeFlowAlerts(
  nodes: FlowNode[],
  edges: FlowEdge[],
  piiColumns: PiiColumnRef[],
  maskingEdgeIds: Set<string>
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  // 找出從備援機到去個資機的邊緣（需有 Masking）
  const backupToDeidEdges = edges.filter((e) => {
    const sourceNode = nodes.find((n) => n.id === e.source);
    const targetNode = nodes.find((n) => n.id === e.target);
    // 簡化：假設節點 ID 或 data 可辨識環境
    // 實際可從 node.data.zoneType 或關聯的 environmentId 判斷
    return e.source.includes("backup") || e.target.includes("deidentified");
  });

  for (const edge of edges) {
    const hasMasking = maskingEdgeIds.has(edge.id) || edge.data?.hasMasking;
    const isBackupToDeid =
      edge.source.includes("backup") && edge.target.includes("deidentified");

    if (isBackupToDeid && !hasMasking && piiColumns.length > 0) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  return { nodeIds, edgeIds };
}
